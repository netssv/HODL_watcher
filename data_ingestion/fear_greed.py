"""
Alternative.me Fear & Greed Index client.

Endpoint:
  - GET https://api.alternative.me/fng/

Free, no API key, full historical data available.
Updates once daily. Cache TTL: 12 hours.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

API_URL = "https://api.alternative.me/fng/"


def get_fear_greed_index(limit: int = 365) -> pd.DataFrame:
    """
    Fetch the Fear & Greed Index history.

    The index ranges from 0 (Extreme Fear) to 100 (Extreme Greed).
    Classification buckets (per Alternative.me):
      - 0-24:  Extreme Fear
      - 25-49: Fear
      - 50-74: Greed
      - 75-100: Extreme Greed

    Lookback window: None (discrete daily observations).

    Parameters
    ----------
    limit : int
        Number of days of history to fetch. Use ``0`` for all available.

    Returns
    -------
    pd.DataFrame
        Columns: ``value`` (int 0-100), ``classification`` (str).
        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC, daily).
    """
    cache_key = f"fear_greed|{limit}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=12 * 3600,  # updates once daily, 12h cache is conservative
        fetch_fn=lambda: requests.get(
            API_URL,
            params={"limit": limit, "format": "json"},
            timeout=30,
        ).json(),
    )

    now_utc = datetime.now(timezone.utc)
    data_list = raw.get("data", [])

    if not data_list:
        df = pd.DataFrame(columns=["value", "classification"])
        df.index.name = "timestamp"
        df.attrs.update(source="alternative_me_fng", fetched_at=now_utc.isoformat())
        return df

    rows = []
    for entry in data_list:
        rows.append({
            "timestamp": pd.to_datetime(int(entry["timestamp"]), unit="s", utc=True),
            "value": int(entry["value"]),
            "classification": entry.get("value_classification", ""),
        })

    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)

    df.attrs.update(
        source="alternative_me_fng",
        fetched_at=now_utc.isoformat(),
        metadata_note="Index: 0=Extreme Fear, 100=Extreme Greed. Updates once daily.",
    )
    return df
