"""OKX public market-data fallback client."""

from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

BASE_URL = "https://www.okx.com"
INTERVAL_MAP = {"15m": "15m", "1h": "1H", "4h": "4H", "1d": "1D"}
INTERVAL_SECONDS = {"15m": 900, "1h": 3600, "4h": 14_400, "1d": 86_400}


def get_klines(symbol="BTCUSDT", interval="1h", limit=100, **_kwargs):
    """Return OKX candles using the same schema as the Binance spot client."""
    inst_id = symbol.replace("USDT", "-USDT")
    bar = INTERVAL_MAP.get(interval, interval)
    limit = min(int(limit), 100)
    raw = cached_fetch(
        key=f"okx_spot_klines|{inst_id}|{bar}|{limit}",
        ttl_seconds=INTERVAL_SECONDS.get(interval, 3600),
        fetch_fn=lambda: _request(inst_id, bar, limit),
    )
    rows = raw.get("data", [])
    if not rows:
        return pd.DataFrame()

    # OKX returns newest-first: ts, open, high, low, close, volume, ...
    df = pd.DataFrame(rows, columns=["open_time", "open", "high", "low", "close", "volume", "volume_currency", "quote_volume", "confirm"])
    for col in ["open", "high", "low", "close", "volume", "quote_volume"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
    df["close_time"] = df["open_time"] + pd.Timedelta(seconds=INTERVAL_SECONDS.get(interval, 3600))
    df["trades"] = 0
    df["taker_buy_base"] = 0.0
    df["taker_buy_quote"] = 0.0
    df = df.sort_values("open_time").set_index("open_time")
    df.index.name = "timestamp"
    df.attrs.update(source="okx", fetched_at=datetime.now(timezone.utc).isoformat(), gaps_detected=[])
    return df[["open", "high", "low", "close", "volume", "close_time", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote"]]


def _request(inst_id, bar, limit):
    response = requests.get(
        f"{BASE_URL}/api/v5/market/candles",
        params={"instId": inst_id, "bar": bar, "limit": limit},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("code") != "0":
        raise RuntimeError(f"OKX API error: {payload.get('msg', 'unknown error')}")
    return payload
