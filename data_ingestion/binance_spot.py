"""
Binance Spot API client.

Endpoints:
  - GET /api/v3/klines  — OHLCV candles, multiple timeframes
  - GET /api/v3/depth   — Order book snapshot (for liquidity features)

No API key required. Rate limit: 1200 req/min (weight-based).
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

BASE_URL = "https://api.binance.com"


def _request_json(url: str, **kwargs):
    response = requests.get(url, **kwargs)
    response.raise_for_status()
    return response.json()

# Interval string → seconds, used both for cache TTL and gap detection
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


def get_klines(
    symbol: str = "BTCUSDT",
    interval: str = "1h",
    limit: int = 500,
    start_time: int | None = None,
    end_time: int | None = None,
) -> pd.DataFrame:
    """
    Fetch OHLCV klines from Binance spot.

    Lookback window: None (fetches discrete candles, no rolling computation).

    Parameters
    ----------
    symbol : str
        Trading pair, e.g. ``"BTCUSDT"``.
    interval : str
        Candle interval: ``"15m"``, ``"1h"``, ``"4h"``, ``"1d"``.
    limit : int
        Number of candles to fetch (max 1000 per Binance docs).
    start_time : int, optional
        Start time in **milliseconds** (inclusive).
    end_time : int, optional
        End time in **milliseconds** (inclusive).

    Returns
    -------
    pd.DataFrame
        Columns: open, high, low, close, volume, close_time,
        quote_volume, trades, taker_buy_base, taker_buy_quote.

        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC), derived from
        the candle open time.

    Metadata (``df.attrs``):
        source, fetched_at, gaps_detected (list of dicts with
        ``after`` timestamp and ``gap_size``).
    """
    params: dict = {"symbol": symbol, "interval": interval, "limit": limit}
    if start_time is not None:
        params["startTime"] = start_time
    if end_time is not None:
        params["endTime"] = end_time

    ttl = INTERVAL_SECONDS.get(interval, 3600)
    cache_key = f"binance_spot_klines|{symbol}|{interval}|{limit}|{start_time}|{end_time}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=ttl,
        fetch_fn=lambda: _request_json(f"{BASE_URL}/api/v3/klines", params=params, timeout=30),
    )

    now_utc = datetime.now(timezone.utc)

    if not raw:
        df = pd.DataFrame()
        df.attrs.update(source="binance_spot", fetched_at=now_utc.isoformat(), gaps_detected=[])
        return df

    df = pd.DataFrame(raw, columns=_KLINE_COLUMNS).drop(columns=["_ignore"])

    # Numeric conversions
    for col in ["open", "high", "low", "close", "volume",
                "quote_volume", "taker_buy_base", "taker_buy_quote"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["trades"] = df["trades"].astype(int)

    # Timestamps → UTC datetime
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms", utc=True)
    df.set_index("open_time", inplace=True)
    df.index.name = "timestamp"

    # --- Gap detection (do NOT interpolate, just flag) ---
    expected_delta = pd.Timedelta(seconds=INTERVAL_SECONDS.get(interval, 3600))
    time_diffs = df.index.to_series().diff()
    gaps = time_diffs[time_diffs > expected_delta * 1.5]

    df.attrs.update(
        source="binance_spot",
        fetched_at=now_utc.isoformat(),
        gaps_detected=[
            {"after": str(idx), "gap_size": str(gap)} for idx, gap in gaps.items()
        ],
    )

    if df.attrs["gaps_detected"]:
        logger.warning(
            "Binance spot klines: %d gap(s) detected in %s %s data",
            len(df.attrs["gaps_detected"]), symbol, interval,
        )

    return df


def get_order_book(
    symbol: str = "BTCUSDT",
    limit: int = 100,
) -> pd.DataFrame:
    """
    Fetch order book depth snapshot from Binance spot.

    Useful for computing support/resistance features (distance to
    large bid/ask walls).

    Parameters
    ----------
    symbol : str
        Trading pair.
    limit : int
        Depth levels (valid: 5, 10, 20, 50, 100, 500, 1000).

    Returns
    -------
    pd.DataFrame
        Columns: ``side`` ("bid" / "ask"), ``price``, ``quantity``.
    """
    cache_key = f"binance_spot_depth|{symbol}|{limit}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=60,  # order book is highly dynamic, short TTL
        fetch_fn=lambda: _request_json(
            f"{BASE_URL}/api/v3/depth", params={"symbol": symbol, "limit": limit}, timeout=30
        ),
    )

    rows: list[dict] = []
    for price, qty in raw.get("bids", []):
        rows.append({"side": "bid", "price": float(price), "quantity": float(qty)})
    for price, qty in raw.get("asks", []):
        rows.append({"side": "ask", "price": float(price), "quantity": float(qty)})

    df = pd.DataFrame(rows)
    df.attrs.update(
        source="binance_spot",
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )
    return df
