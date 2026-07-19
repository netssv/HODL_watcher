"""Real Coinalyze BTC perpetual open-interest history."""

import logging
import time
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch
from .config import COINALYZE_API_KEY

logger = logging.getLogger(__name__)
COINALYZE_URL = "https://api.coinalyze.net/v1/open-interest-history"


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
    if not COINALYZE_API_KEY:
        logger.warning("COINALYZE_API_KEY not set; open interest is unavailable.")
        return pd.DataFrame(columns=["open_interest"])

    def fetch_coinalyze():
        end = int(time.time())
        response = requests.get(
            COINALYZE_URL,
            params={
                "symbols": "BTCUSDT_PERP.A", "interval": "1hour",
                "from": end - 500 * 3600, "to": end, "convert_to_usd": "true",
            }, headers={"api_key": COINALYZE_API_KEY}, timeout=10,
        )
        response.raise_for_status()
        return response.json()

    try:
        raw = cached_fetch("coinalyze_open_interest", 300, fetch_coinalyze)
        history = raw[0].get("history", []) if isinstance(raw, list) and raw else []
        return _frame(
            [{"timestamp": x["t"] * 1000, "open_interest": x["c"]} for x in history],
            "coinalyze",
        )
    except Exception as exc:
        logger.warning("Coinalyze OI history unavailable: %s", exc)
        return pd.DataFrame(columns=["open_interest"])
