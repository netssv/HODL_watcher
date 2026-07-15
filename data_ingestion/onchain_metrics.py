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
    logger.info("Onchain data requested but no provider configured. Returning mock data.")
    now = datetime.now(timezone.utc)
    times = pd.date_range(end=now, periods=100, freq="1h")
    import numpy as np
    df = pd.DataFrame({
        "timestamp": times,
        "exchange_net_flow": np.linspace(-500, 200, 100) + np.random.normal(0, 150, 100),
        "ssr": np.linspace(2.5, 3.1, 100) + np.random.normal(0, 0.1, 100),
        "whale_tx_count": np.linspace(100, 150, 100) + np.random.poisson(10, 100)
    })
    df.set_index("timestamp", inplace=True)
    df.attrs.update(source="onchain_mock", fetched_at=now.isoformat())
    return df
