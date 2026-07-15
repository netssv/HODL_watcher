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
    logger.info("ETF flows requested but no provider configured. Returning empty.")
    df = pd.DataFrame(columns=["etf_net_flow"])
    df.index.name = "timestamp"
    df.attrs.update(source="etf_mock", fetched_at=datetime.now(timezone.utc).isoformat())
    return df
