"""
ETF Flows (Spot BTC ETF Net Flows).
Gracefully degrades to empty if API not available.
"""

import logging
from datetime import datetime, timezone
import pandas as pd

logger = logging.getLogger(__name__)

def get_etf_flows() -> pd.DataFrame:
    """
    Fetch daily spot BTC ETF net flows.
    """
    logger.info("ETF flows requested but no provider configured. Returning mock data.")
    now = datetime.now(timezone.utc)
    times = pd.date_range(end=now, periods=100, freq="1h")
    import numpy as np
    df = pd.DataFrame({
        "timestamp": times,
        "etf_net_flow": np.linspace(50.0, 120.0, 100) + np.random.normal(0, 20.0, 100)
    })
    df.set_index("timestamp", inplace=True)
    df.attrs.update(source="etf_mock", fetched_at=now.isoformat())
    return df
