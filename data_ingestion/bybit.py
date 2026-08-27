"""Bybit public market-data fallback client."""
import logging
from datetime import datetime, timezone
import pandas as pd
import requests
from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

BASE_URL = "https://api.bybit.com"
INTERVAL_MAP = {"15m": "15", "1h": "60", "4h": "240", "1d": "D"}
INTERVAL_SECONDS = {"15m": 900, "1h": 3600, "4h": 14_400, "1d": 86_400}

def get_klines(symbol="BTCUSDT", interval="1h", limit=100, **_kwargs):
    bar = INTERVAL_MAP.get(interval, "60")
    limit = min(int(limit), 1000)
    raw = cached_fetch(
        key=f"bybit_spot_klines|{symbol}|{bar}|{limit}", ttl_seconds=INTERVAL_SECONDS.get(interval, 3600),
        fetch_fn=lambda: _request(symbol, bar, limit),
    )
    rows = raw.get("result", {}).get("list", [])
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["open_time", "open", "high", "low", "close", "volume", "quote_volume"])
    for col in ["open", "high", "low", "close", "volume", "quote_volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df["close_time"] = df["open_time"] + pd.Timedelta(seconds=INTERVAL_SECONDS.get(interval, 3600))
    df["trades"] = 0; df["taker_buy_base"] = 0.0; df["taker_buy_quote"] = 0.0
    df = df.sort_values("open_time").set_index("open_time")
    df.index.name = "timestamp"
    df.attrs.update(source="bybit", fetched_at=datetime.now(timezone.utc).isoformat(), gaps_detected=[])
    return df[["open", "high", "low", "close", "volume", "close_time", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote"]]

def _request(symbol, interval, limit):
    response = requests.get(f"{BASE_URL}/v5/market/kline", params={"category": "spot", "symbol": symbol, "interval": interval, "limit": limit}, timeout=30)
    response.raise_for_status()
    payload = response.json()
    if payload.get("retCode") != 0:
        raise RuntimeError(f"Bybit API error: {payload.get('retMsg', 'unknown error')}")
    return payload


def get_liq_heatmap_data(symbol="BTCUSDT", oi_limit=48, kline_limit=48):
    """Build the existing estimated-liquidity profile from Bybit linear data."""
    def fetch():
        def get(path, params):
            response = requests.get(f"{BASE_URL}{path}", params=params, timeout=15)
            response.raise_for_status()
            payload = response.json()
            if payload.get("retCode") != 0:
                raise RuntimeError(f"Bybit API error: {payload.get('retMsg', 'unknown error')}")
            return payload.get("result", {}).get("list", [])

        return {
            "oi": get("/v5/market/open-interest", {
                "category": "linear", "symbol": symbol, "intervalTime": "1h", "limit": oi_limit,
            }),
            "klines": get("/v5/market/kline", {
                "category": "linear", "symbol": symbol, "interval": "60", "limit": kline_limit,
            }),
            "ratio": get("/v5/market/account-ratio", {
                "category": "linear", "symbol": symbol, "period": "1h", "limit": 1,
            }),
        }

    try:
        raw = cached_fetch(f"bybit_liq_heatmap|{symbol}|{oi_limit}", 300, fetch)
    except Exception as exc:
        logger.warning("Bybit liquidation fallback failed: %s", exc)
        return {}

    oi_rows, kline_rows = raw.get("oi", []), raw.get("klines", [])
    if not oi_rows or not kline_rows:
        return {}

    # Bybit reports linear OI in BTC; convert it to USD at the matching candle price.
    kline_by_ts = {
        int(row[0]): (float(row[2]) + float(row[3])) / 2
        for row in kline_rows if len(row) >= 5
    }
    entries = []
    for row in sorted(oi_rows, key=lambda item: int(item["timestamp"])):
        timestamp = int(row["timestamp"])
        price = kline_by_ts.get(timestamp)
        if price:
            entries.append({"price": price, "oi": float(row["openInterest"]) * price})
    if not entries:
        return {}

    ratio = (raw.get("ratio") or [{}])[-1]
    try:
        long_pct, short_pct = float(ratio["buyRatio"]), float(ratio["sellRatio"])
    except (KeyError, TypeError, ValueError):
        long_pct, short_pct = 0.60, 0.40

    from .binance_futures import LEVERAGE_TIERS, LIQ_BUCKETS, MAINTENANCE_MARGIN, _nearest_liq_distance
    for index, entry in enumerate(entries):
        entry["weight"] = 0.5 ** ((len(entries) - 1 - index) * 0.15)

    current_price = entries[-1]["price"]
    long_prices = [entry["price"] * (1 - 1 / leverage + MAINTENANCE_MARGIN[leverage]) for entry in entries for leverage in LEVERAGE_TIERS]
    short_prices = [entry["price"] * (1 + 1 / leverage - MAINTENANCE_MARGIN[leverage]) for entry in entries for leverage in LEVERAGE_TIERS]
    low, high = min(*long_prices, current_price), max(*short_prices, current_price)
    step = (high - low) / LIQ_BUCKETS
    if step <= 0:
        return {}
    long_buckets = [{"price": low + (i + 0.5) * step, "notionalUSD": 0.0} for i in range(LIQ_BUCKETS)]
    short_buckets = [{"price": low + (i + 0.5) * step, "notionalUSD": 0.0} for i in range(LIQ_BUCKETS)]
    for entry in entries:
        for leverage, fraction in LEVERAGE_TIERS.items():
            notional = entry["oi"] * entry["weight"] * fraction
            long_index = int((entry["price"] * (1 - 1 / leverage + MAINTENANCE_MARGIN[leverage]) - low) / step)
            short_index = int((entry["price"] * (1 + 1 / leverage - MAINTENANCE_MARGIN[leverage]) - low) / step)
            if 0 <= long_index < LIQ_BUCKETS:
                long_buckets[long_index]["notionalUSD"] += notional * long_pct
            if 0 <= short_index < LIQ_BUCKETS:
                short_buckets[short_index]["notionalUSD"] += notional * short_pct
    return {
        "long_buckets": long_buckets, "short_buckets": short_buckets,
        "current_price": current_price, "long_pct": long_pct, "short_pct": short_pct,
        "upper": _nearest_liq_distance(short_buckets, current_price, above=True),
        "lower": _nearest_liq_distance(long_buckets, current_price, above=False),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "bybit_public_open_interest", "data_type": "estimated_liquidation_levels",
        "methodology": "Real Bybit linear OI, distributed across explicit leverage tiers and smoothed for display.",
    }
