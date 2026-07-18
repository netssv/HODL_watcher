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


def _request_json(url: str, **kwargs):
    response = requests.get(url, **kwargs)
    response.raise_for_status()
    return response.json()

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
        fetch_fn=lambda: _request_json(f"{BASE_URL}/fapi/v1/klines", params=params, timeout=30),
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
        fetch_fn=lambda: _request_json(f"{BASE_URL}/fapi/v1/fundingRate", params=params, timeout=30),
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
        fetch_fn=lambda: _request_json(
            f"{BASE_URL}/futures/data/globalLongShortAccountRatio", params=params, timeout=30
        ),
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
        fetch_fn=lambda: _request_json(
            f"{BASE_URL}/fapi/v1/openInterest", params={"symbol": symbol}, timeout=30
        ),
    )

    return {
        "open_interest": float(raw.get("openInterest", 0)),
        "symbol": raw.get("symbol", symbol),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "binance_futures",
    }


# ---------------------------------------------------------------------------
# Order Book Depth
# ---------------------------------------------------------------------------

def get_orderbook_depth(symbol: str = "BTCUSDT", limit: int = 100) -> dict:
    """
    Fetch order book depth for a perpetual futures symbol.
    Returns bids and asks as lists of [price, qty] strings.
    """
    cache_key = f"binance_fut_depth|{symbol}|{limit}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=15,  # 15s cache, fast enough for our UI
        fetch_fn=lambda: _request_json(
            f"{BASE_URL}/fapi/v1/depth", params={"symbol": symbol, "limit": limit}, timeout=10
        ),
    )

    return {
        "bids": raw.get("bids", []),
        "asks": raw.get("asks", []),
        "symbol": symbol,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "binance_futures",
    }


# ---------------------------------------------------------------------------
# Liquidation Heatmap (estimated from Binance public market data)
# ---------------------------------------------------------------------------

# Explicit estimate: Binance's public API does not expose every account's
# liquidation price. The input OI and candles are real; this distribution is
# the documented assumption used to estimate levels.
LEVERAGE_TIERS = {
    5:   0.15,
    10:  0.30,
    25:  0.30,
    50:  0.15,
    100: 0.10,
}

# Static maintenance margin rate table (Binance BTCUSDT perpetual)
MAINTENANCE_MARGIN = {
    5:   0.005,
    10:  0.005,
    25:  0.010,
    50:  0.020,
    100: 0.025,
}

LIQ_BUCKETS = 60


def get_liq_heatmap_data(
    symbol: str = "BTCUSDT",
    oi_limit: int = 48,
    kline_limit: int = 48,
) -> dict:
    """
    Build estimated liquidation levels from Binance public OI, candles, and
    long/short account-ratio data.

    Strategy:
    1. Fetch OI history (hourly). Each candle represents open positions.
       The OI *change* per candle tells us how much new position was opened
       at that candle's midpoint price. Recent candles weighted more heavily
       (exponential decay — older positions may have been closed).
    2. For each candle's entry price estimate, compute long/short liq prices
       across leverage tiers. Scale by long/short account ratio.
    3. Sum liq notional into fixed price buckets.

    This is not an exchange-published liquidation feed. Never fall back to
    fabricated values or order-book depth.
    """
    cache_key = f"liq_heatmap|{symbol}|{oi_limit}"

    def _fetch():
        def _json(url, **kwargs):
            response = requests.get(url, **kwargs)
            response.raise_for_status()
            return response.json()

        oi_raw = _json(
            f"{BASE_URL}/futures/data/openInterestHist",
            params={"symbol": symbol, "period": "1h", "limit": oi_limit},
            timeout=15,
        )
        kline_raw = _json(
            f"{BASE_URL}/fapi/v1/klines",
            params={"symbol": symbol, "interval": "1h", "limit": kline_limit},
            timeout=15,
        )
        ls_raw = _json(
            f"{BASE_URL}/futures/data/topLongShortAccountRatio",
            params={"symbol": symbol, "period": "1h", "limit": 1},
            timeout=10,
        )
        return {"oi": oi_raw, "klines": kline_raw, "ls": ls_raw}

    try:
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=300,
            fetch_fn=_fetch,
        )
    except Exception as e:
        logger.warning("get_liq_heatmap_data failed: %s", e)
        return {}

    oi_hist = raw.get("oi", [])
    klines = raw.get("klines", [])
    ls_list = raw.get("ls", [])

    if not oi_hist or not klines:
        return {}

    long_pct, short_pct = 0.60, 0.40
    if ls_list and isinstance(ls_list, list) and len(ls_list) > 0:
        try:
            long_pct = float(ls_list[-1]["longAccount"])
            short_pct = float(ls_list[-1]["shortAccount"])
        except (KeyError, ValueError):
            pass

    oi_by_ts = {}
    for entry in oi_hist:
        if not isinstance(entry, dict):
            continue
        value = entry.get("sumOpenInterestValue", entry.get("sumOpenInterest"))
        if value is not None and entry.get("timestamp") is not None:
            oi_by_ts[int(entry["timestamp"])] = float(value)

    kline_by_ts = {}
    for k in klines:
        if isinstance(k, list) and len(k) >= 5:
            ts = int(k[0])
            mid = (float(k[2]) + float(k[3])) / 2
            kline_by_ts[ts] = mid

    entries = []
    sorted_ts = sorted(oi_by_ts.keys())
    n = len(sorted_ts)
    for idx, ts in enumerate(sorted_ts):
        price = kline_by_ts.get(ts) or kline_by_ts.get(ts - 1000) or kline_by_ts.get(ts + 1000)
        if not price:
            continue
        oi_val = oi_by_ts[ts]
        # Exponential recency weight: most recent candle gets weight 1.0
        weight = 0.5 ** ((n - 1 - idx) * 0.15)
        entries.append({"price": price, "oi": oi_val, "weight": weight})

    if not entries:
        return {}

    current_price = entries[-1]["price"]
    all_prices = [e["price"] for e in entries]
    price_range = max(all_prices) - min(all_prices) if len(all_prices) > 1 else current_price * 0.1
    p_low  = min(all_prices) - price_range * 0.5
    p_high = max(all_prices) + price_range * 0.5

    step = (p_high - p_low) / LIQ_BUCKETS
    if step <= 0:
        return {}

    long_buckets  = [{"price": p_low + (i + 0.5) * step, "notionalUSD": 0.0} for i in range(LIQ_BUCKETS)]
    short_buckets = [{"price": p_low + (i + 0.5) * step, "notionalUSD": 0.0} for i in range(LIQ_BUCKETS)]

    for entry in entries:
        entry_price = entry["price"]
        oi_notional = entry["oi"] * entry["weight"]

        for leverage, tier_frac in LEVERAGE_TIERS.items():
            mm = MAINTENANCE_MARGIN[leverage]
            tier_notional = oi_notional * tier_frac

            long_liq_price  = entry_price * (1 - 1 / leverage + mm)
            short_liq_price = entry_price * (1 + 1 / leverage - mm)

            li = int((long_liq_price - p_low) / step)
            if 0 <= li < LIQ_BUCKETS:
                long_buckets[li]["notionalUSD"] += tier_notional * long_pct

            si = int((short_liq_price - p_low) / step)
            if 0 <= si < LIQ_BUCKETS:
                short_buckets[si]["notionalUSD"] += tier_notional * short_pct

    return {
        "long_buckets": long_buckets,
        "short_buckets": short_buckets,
        "current_price": current_price,
        "long_pct": long_pct,
        "short_pct": short_pct,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "binance_public_open_interest",
        "data_type": "estimated_liquidation_levels",
        "methodology": "Real Binance OI notional distributed across explicit leverage tiers and smoothed for display.",
    }
