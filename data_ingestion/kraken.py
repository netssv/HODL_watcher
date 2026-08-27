"""Kraken public market-data fallback client."""

from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

BASE_URL = "https://api.kraken.com"
PAIR = "XBTUSDT"
INTERVAL_MAP = {"15m": 15, "1h": 60, "4h": 240, "1d": 1440}
INTERVAL_SECONDS = {"15m": 900, "1h": 3600, "4h": 14_400, "1d": 86_400}


def get_klines(symbol="BTCUSDT", interval="1h", limit=720, **_kwargs):
    interval_minutes = INTERVAL_MAP.get(interval, 60)
    raw = cached_fetch(
        key=f"kraken_spot_klines|{PAIR}|{interval_minutes}|{limit}",
        ttl_seconds=INTERVAL_SECONDS.get(interval, 3600),
        fetch_fn=lambda: _request(interval_minutes),
    )
    result = raw.get("result", {})
    rows = next((value for key, value in result.items() if key != "last"), [])
    if not rows:
        return pd.DataFrame()

    df = pd.DataFrame(rows, columns=["open_time", "open", "high", "low", "close", "vwap", "volume", "count"])
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["open_time"] = pd.to_datetime(df["open_time"], unit="s", utc=True)
    df["close_time"] = df["open_time"] + pd.Timedelta(seconds=INTERVAL_SECONDS.get(interval, 3600))
    df["quote_volume"] = df["close"] * df["volume"]
    df["trades"] = pd.to_numeric(df["count"], errors="coerce").fillna(0).astype(int)
    df["taker_buy_base"] = 0.0
    df["taker_buy_quote"] = 0.0
    df = df.sort_values("open_time").set_index("open_time")
    df.index.name = "timestamp"
    df.attrs.update(source="kraken", fetched_at=datetime.now(timezone.utc).isoformat(), gaps_detected=[])
    return df[["open", "high", "low", "close", "volume", "close_time", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote"]].tail(limit)


def _request(interval_minutes):
    response = requests.get(
        f"{BASE_URL}/0/public/OHLC",
        params={"pair": PAIR, "interval": interval_minutes},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("error"):
        raise RuntimeError(f"Kraken API error: {', '.join(payload['error'])}")
    return payload
