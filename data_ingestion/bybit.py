"""Bybit public market-data fallback client."""
from datetime import datetime, timezone
import pandas as pd
import requests
from .cache_utils import cached_fetch

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
