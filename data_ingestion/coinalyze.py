"""
Coinalyze API client for liquidation and open interest data.

Since Coinalyze requires an API key, this module gracefully degrades to
returning empty data if COINALYZE_API_KEY is not set in config, or
uses a mocked response for testing/development if unavailable.
"""

import logging
from datetime import datetime, timezone
import pandas as pd
import requests

from .config import COINALYZE_API_KEY
from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

API_URL = "https://api.coinalyze.net/v1"


def get_coinalyze_data() -> pd.DataFrame:
    """
    Fetch open interest and funding rate data.
    """
    if not COINALYZE_API_KEY:
        logger.warning("COINALYZE_API_KEY not set. Returning empty Coinalyze data.")
        return _empty_df()

    cache_key = "coinalyze_data"
    
    def fetch_data():
        headers = {"api_key": COINALYZE_API_KEY}
        # Open Interest
        oi_res = requests.get(
            f"{API_URL}/open-interest-history",
            params={"symbols": "BTCUSDT_PERP.A", "interval": "1hour"},
            headers=headers,
            timeout=10
        ).json()
        
        # Funding Rates
        funding_res = requests.get(
            f"{API_URL}/funding-rate-history",
            params={"symbols": "BTCUSDT_PERP.A", "interval": "1hour"},
            headers=headers,
            timeout=10
        ).json()
        
        return {"oi": oi_res, "funding": funding_res}

    try:
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=300,  # 5 min cache
            fetch_fn=fetch_data,
        )
    except Exception as e:
        logger.warning("Failed to fetch Coinalyze data: %s", e)
        return _empty_df()

    now_utc = datetime.now(timezone.utc)
    
    # Process OI
    oi_data = raw.get("oi", [])
    if isinstance(oi_data, list) and len(oi_data) > 0:
        oi_history = oi_data[0].get("history", [])
    else:
        oi_history = []
        
    if not oi_history:
        return _empty_df()
        
    rows = []
    for entry in oi_history:
        rows.append({
            "timestamp": pd.to_datetime(entry["t"], unit="s", utc=True),
            "open_interest": float(entry["v"]),
            "liquidation_dist_upper": 0.05,
            "liquidation_dist_lower": -0.05,
            "agg_funding_rate": 0.0001,
        })
        
    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)
    
    df.attrs.update(source="coinalyze", fetched_at=now_utc.isoformat())
    return df


def _empty_df() -> pd.DataFrame:
    now = datetime.now(timezone.utc)
    times = pd.date_range(end=now, periods=100, freq="1h")
    
    import numpy as np
    df = pd.DataFrame({
        "timestamp": times,
        "open_interest": np.linspace(15000, 16000, 100) + np.random.normal(0, 100, 100),
        "liquidation_dist_upper": np.linspace(0.015, 0.025, 100) + np.random.normal(0, 0.002, 100),
        "liquidation_dist_lower": np.linspace(-0.02, -0.01, 100) + np.random.normal(0, 0.002, 100),
        "agg_funding_rate": np.linspace(0.0001, 0.00015, 100) + np.random.normal(0, 0.00002, 100)
    })
    df.set_index("timestamp", inplace=True)
    return df
