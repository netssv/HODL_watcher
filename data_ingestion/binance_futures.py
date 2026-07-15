"""
Binance Futures API client.

Endpoints:
  - GET /fapi/v1/klines                          — OHLCV perpetual futures
  - GET /fapi/v1/fundingRate                      — Historical funding rate
  - GET /futures/data/globalLongShortAccountRatio  — Long/short ratio
  - GET /fapi/v1/openInterest                     — Current open interest

No API key required. Rate limit: 2400 req/min (weight-based).
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

BASE_URL = "https://fapi.binance.com"

INTERVAL_SECONDS: dict[str, int] = {
    "15m": 900,
    "1h": 3600,
    "4h": 14_400,
    "1d": 86_400,
}

_KLINE_COLUMNS = [
    "open_time", "open", "high", "low", "close", "volume",
    "close_time", "quote_volume", "trades",
    "taker_buy_base", "taker_buy_quote", "_ignore",
]


# ---------------------------------------------------------------------------
# Klines (OHLCV)
# ---------------------------------------------------------------------------

def get_klines(
    symbol: str = "BTCUSDT",
    interval: str = "1h",
    limit: int = 500,
    start_time: int | None = None,
    end_time: int | None = None,
) -> pd.DataFrame:
    """
    Fetch OHLCV klines from Binance perpetual futures.

    Lookback window: None (discrete candles).

    Returns
    -------
    pd.DataFrame
        Same schema as ``binance_spot.get_klines``.
    """
    params: dict = {"symbol": symbol, "interval": interval, "limit": limit}
    if start_time is not None:
        params["startTime"] = start_time
    if end_time is not None:
        params["endTime"] = end_time

    ttl = INTERVAL_SECONDS.get(interval, 3600)
    cache_key = f"binance_fut_klines|{symbol}|{interval}|{limit}|{start_time}|{end_time}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=ttl,
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/fapi/v1/klines", params=params, timeout=30
        ).json(),
    )

    now_utc = datetime.now(timezone.utc)

    if not raw:
        df = pd.DataFrame()
        df.attrs.update(source="binance_futures", fetched_at=now_utc.isoformat(), gaps_detected=[])
        return df

    df = pd.DataFrame(raw, columns=_KLINE_COLUMNS).drop(columns=["_ignore"])

    for col in ["open", "high", "low", "close", "volume",
                "quote_volume", "taker_buy_base", "taker_buy_quote"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["trades"] = df["trades"].astype(int)

    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms", utc=True)
    df.set_index("open_time", inplace=True)
    df.index.name = "timestamp"

    # Gap detection
    expected_delta = pd.Timedelta(seconds=INTERVAL_SECONDS.get(interval, 3600))
    time_diffs = df.index.to_series().diff()
    gaps = time_diffs[time_diffs > expected_delta * 1.5]

    df.attrs.update(
        source="binance_futures",
        fetched_at=now_utc.isoformat(),
        gaps_detected=[
            {"after": str(idx), "gap_size": str(gap)} for idx, gap in gaps.items()
        ],
    )
    return df


# ---------------------------------------------------------------------------
# Funding Rate
# ---------------------------------------------------------------------------

def get_funding_rate(
    symbol: str = "BTCUSDT",
    limit: int = 100,
    start_time: int | None = None,
    end_time: int | None = None,
) -> pd.DataFrame:
    """
    Fetch historical funding rate for a perpetual futures symbol.

    Funding settles every 8 hours on Binance.

    Lookback window: None (discrete observations).

    Returns
    -------
    pd.DataFrame
        Columns: ``funding_rate`` (float), ``mark_price`` (float).
        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC).
    """
    params: dict = {"symbol": symbol, "limit": limit}
    if start_time is not None:
        params["startTime"] = start_time
    if end_time is not None:
        params["endTime"] = end_time

    cache_key = f"binance_fut_funding|{symbol}|{limit}|{start_time}|{end_time}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=3600,  # funding updates every 8h, 1h cache is fine
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/fapi/v1/fundingRate", params=params, timeout=30
        ).json(),
    )

    now_utc = datetime.now(timezone.utc)

    if not raw:
        df = pd.DataFrame(columns=["funding_rate", "mark_price"])
        df.index.name = "timestamp"
        df.attrs.update(source="binance_futures", fetched_at=now_utc.isoformat())
        return df

    df = pd.DataFrame(raw)
    df["fundingTime"] = pd.to_datetime(df["fundingTime"], unit="ms", utc=True)
    df["fundingRate"] = pd.to_numeric(df["fundingRate"], errors="coerce")
    df["markPrice"] = pd.to_numeric(df.get("markPrice", pd.Series(dtype=float)), errors="coerce")
    df = df.rename(columns={
        "fundingTime": "timestamp",
        "fundingRate": "funding_rate",
        "markPrice": "mark_price",
    })
    df.set_index("timestamp", inplace=True)
    df = df[["funding_rate", "mark_price"]]

    df.attrs.update(source="binance_futures", fetched_at=now_utc.isoformat())
    return df


# ---------------------------------------------------------------------------
# Long / Short Account Ratio
# ---------------------------------------------------------------------------

def get_long_short_ratio(
    symbol: str = "BTCUSDT",
    period: str = "1h",
    limit: int = 100,
    start_time: int | None = None,
    end_time: int | None = None,
) -> pd.DataFrame:
    """
    Fetch global long/short account ratio.

    Lookback window: None (discrete observations per period).

    Returns
    -------
    pd.DataFrame
        Columns: ``long_short_ratio``, ``long_account``, ``short_account``.
        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC).
    """
    params: dict = {"symbol": symbol, "period": period, "limit": limit}
    if start_time is not None:
        params["startTime"] = start_time
    if end_time is not None:
        params["endTime"] = end_time

    ttl = INTERVAL_SECONDS.get(period, 3600)
    cache_key = f"binance_fut_ls_ratio|{symbol}|{period}|{limit}|{start_time}|{end_time}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=ttl,
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/futures/data/globalLongShortAccountRatio",
            params=params, timeout=30,
        ).json(),
    )

    now_utc = datetime.now(timezone.utc)

    if not raw:
        df = pd.DataFrame(columns=["long_short_ratio", "long_account", "short_account"])
        df.index.name = "timestamp"
        df.attrs.update(source="binance_futures", fetched_at=now_utc.isoformat())
        return df

    df = pd.DataFrame(raw)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    for col in ["longShortRatio", "longAccount", "shortAccount"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.rename(columns={
        "longShortRatio": "long_short_ratio",
        "longAccount": "long_account",
        "shortAccount": "short_account",
    })
    df.set_index("timestamp", inplace=True)
    df = df[["long_short_ratio", "long_account", "short_account"]]

    df.attrs.update(source="binance_futures", fetched_at=now_utc.isoformat())
    return df


# ---------------------------------------------------------------------------
# Open Interest
# ---------------------------------------------------------------------------

def get_open_interest(symbol: str = "BTCUSDT") -> dict:
    """
    Fetch current open interest for a perpetual futures symbol.

    Returns a dict (not a DataFrame) since this is a single-point snapshot:
    ``{"open_interest": float, "symbol": str, "fetched_at": str}``.
    """
    cache_key = f"binance_fut_oi|{symbol}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=300,  # 5 min cache for a point-in-time value
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/fapi/v1/openInterest",
            params={"symbol": symbol},
            timeout=30,
        ).json(),
    )

    return {
        "open_interest": float(raw.get("openInterest", 0)),
        "symbol": raw.get("symbol", symbol),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "binance_futures",
    }
