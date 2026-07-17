"""Real open-interest history, preferring Coinalyze then Binance's free API."""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch
from .config import COINALYZE_API_KEY

logger = logging.getLogger(__name__)
COINALYZE_URL = "https://api.coinalyze.net/v1/open-interest-history"
BINANCE_URL = "https://fapi.binance.com/futures/data/openInterestHist"


def _frame(rows: list[dict], source: str) -> pd.DataFrame:
    if not rows:
        return pd.DataFrame(columns=["open_interest"])
    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    df["open_interest"] = pd.to_numeric(df["open_interest"], errors="coerce")
    df = df.set_index("timestamp")[["open_interest"]].sort_index().dropna()
    df.attrs.update(source=source, fetched_at=datetime.now(timezone.utc).isoformat())
    return df


def get_coinalyze_data() -> pd.DataFrame:
    """Fetch real BTC perpetual open interest; never manufacture a history."""
    if COINALYZE_API_KEY:
        def fetch_coinalyze():
            response = requests.get(
                COINALYZE_URL,
                params={"symbols": "BTCUSDT_PERP.A", "interval": "1hour"},
                headers={"api_key": COINALYZE_API_KEY}, timeout=10,
            )
            response.raise_for_status()
            return response.json()

        try:
            raw = cached_fetch("coinalyze_open_interest", 300, fetch_coinalyze)
            history = raw[0].get("history", []) if isinstance(raw, list) and raw else []
            return _frame(
                [{"timestamp": x["t"] * 1000, "open_interest": x["v"]} for x in history],
                "coinalyze",
            )
        except Exception as exc:
            logger.warning("Coinalyze unavailable; using Binance OI history: %s", exc)

    def fetch_binance():
        response = requests.get(
            BINANCE_URL, params={"symbol": "BTCUSDT", "period": "1h", "limit": 500}, timeout=10
        )
        response.raise_for_status()
        return response.json()

    try:
        raw = cached_fetch("binance_open_interest_history|BTCUSDT|1h|500", 3600, fetch_binance)
        return _frame(
            [{"timestamp": x["timestamp"], "open_interest": x["sumOpenInterestValue"]} for x in raw],
            "binance_futures",
        )
    except Exception as exc:
        logger.warning("Binance OI history unavailable: %s", exc)
        return pd.DataFrame(columns=["open_interest"])
