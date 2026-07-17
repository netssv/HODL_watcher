"""Deribit public options data. Missing data remains missing, never simulated."""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)
API_URL = "https://www.deribit.com/api/v2/public/"


def get_options_data() -> pd.DataFrame:
    """Fetch real DVOL history and the current put/call volume ratio."""
    def fetch_data():
        dvol = requests.get(
            f"{API_URL}get_volatility_index_data",
            params={"currency": "BTC", "resolution": "3600"}, timeout=10,
        )
        book = requests.get(
            f"{API_URL}get_book_summary_by_currency",
            params={"currency": "BTC", "kind": "option"}, timeout=10,
        )
        dvol.raise_for_status()
        book.raise_for_status()
        return {"dvol": dvol.json(), "book": book.json()}

    try:
        raw = cached_fetch("deribit_options_data", 300, fetch_data)
    except Exception as exc:
        logger.warning("Deribit options data unavailable: %s", exc)
        return pd.DataFrame(columns=["dvol", "put_call_ratio"])

    dvol_rows = raw.get("dvol", {}).get("result", {}).get("data", [])
    rows = [
        {"timestamp": pd.to_datetime(x[0], unit="ms", utc=True), "dvol": float(x[4])}
        for x in dvol_rows if len(x) >= 5
    ]
    book = raw.get("book", {}).get("result", [])
    puts = sum(float(x.get("volume", 0)) for x in book if x.get("instrument_name", "").endswith("-P"))
    calls = sum(float(x.get("volume", 0)) for x in book if x.get("instrument_name", "").endswith("-C"))
    if calls:
        rows.append({"timestamp": datetime.now(timezone.utc), "put_call_ratio": puts / calls})
    if not rows:
        return pd.DataFrame(columns=["dvol", "put_call_ratio"])
    df = pd.DataFrame(rows).set_index("timestamp").sort_index()
    df.attrs.update(source="deribit_public", fetched_at=datetime.now(timezone.utc).isoformat())
    return df
