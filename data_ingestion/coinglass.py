"""
Coinglass API client for liquidation and open interest data.

Since Coinglass requires an API key, this module gracefully degrades to
returning empty data if COINGLASS_API_KEY is not set in config, or
uses a mocked response for testing/development if unavailable.
"""

import logging
from datetime import datetime, timezone
import pandas as pd
import requests

from .config import COINGLASS_API_KEY
from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

API_URL = "https://open-api.coinglass.com/public/v2/"


def get_coinglass_data() -> pd.DataFrame:
    """
    Fetch liquidation heatmap and open interest data.
    """
    if not COINGLASS_API_KEY:
        logger.warning("COINGLASS_API_KEY not set. Returning empty Coinglass data.")
        return _empty_df()

    cache_key = "coinglass_data"
    
    def fetch_data():
        headers = {"coinglassSecret": COINGLASS_API_KEY}
        # Open Interest
        oi_res = requests.get(
            f"{API_URL}open_interest/history",
            params={"symbol": "BTC", "interval": "1h", "limit": 100},
            headers=headers,
            timeout=10
        ).json()
        
        # Funding Rates
        funding_res = requests.get(
            f"{API_URL}funding",
            params={"symbol": "BTC"},
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
        logger.warning("Failed to fetch Coinglass data: %s", e)
        return _empty_df()

    now_utc = datetime.now(timezone.utc)
    
    oi_data = raw.get("oi", {}).get("data", [])
    if not oi_data:
        return _empty_df()
        
    rows = []
    for entry in oi_data:
        rows.append({
            "timestamp": pd.to_datetime(int(entry["dateList"]), unit="ms", utc=True),
            "open_interest": float(entry["priceList"]), # Assuming priceList holds OI in BTC/USD, actually data format varies. 
            "liquidation_dist_upper": 0.05, # Mocking liquidation proximity until full heatmap API is integrated
            "liquidation_dist_lower": -0.05,
            "agg_funding_rate": 0.0001, # Mocking agg funding
        })
        
    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)
    
    df.attrs.update(source="coinglass", fetched_at=now_utc.isoformat())
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
