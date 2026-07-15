"""
Onchain metrics (Exchange flow, SSR, Whale count).
Mocked if APIs are not available since most robust providers (Glassnode/CryptoQuant) 
are paid. Designed to degrade gracefully to empty DataFrames.
"""

import logging
from datetime import datetime, timezone
import pandas as pd

logger = logging.getLogger(__name__)

def get_onchain_data() -> pd.DataFrame:
    """
    Fetch onchain metrics. 
    Gracefully returning empty if no key/provider configured.
    """
    logger.info("Onchain data requested but no provider configured. Returning empty.")
    df = pd.DataFrame(columns=["exchange_net_flow", "ssr", "whale_tx_count"])
    df.index.name = "timestamp"
    df.attrs.update(source="onchain_mock", fetched_at=datetime.now(timezone.utc).isoformat())
    return df
