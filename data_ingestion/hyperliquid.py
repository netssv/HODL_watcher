"""
Hyperliquid API client for DEX futures data.

Endpoint: https://api.hyperliquid.xyz/info
No API key required for public info endpoints.
"""

import logging
from datetime import datetime, timezone
import pandas as pd
import requests

from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

API_URL = "https://api.hyperliquid.xyz/info"


def get_hyperliquid_data() -> pd.DataFrame:
    """
    Fetch market context for BTC from Hyperliquid.
    Returns funding rate and oracle price.
    """
    cache_key = "hyperliquid_data"
    
    def fetch_data():
        res = requests.post(
            API_URL,
            json={"type": "metaAndAssetCtxs"},
            timeout=10
        ).json()
        return res

    try:
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=60,  # 1 min cache since it's free and fast
            fetch_fn=fetch_data,
        )
    except Exception as e:
        logger.warning("Failed to fetch Hyperliquid data: %s", e)
        return _empty_df()

    now_utc = datetime.now(timezone.utc)
    
    # Process Meta and Asset Contexts
    try:
        meta = raw[0]
        asset_ctxs = raw[1]
        
        # Find BTC index
        btc_idx = next((i for i, asset in enumerate(meta["universe"]) if asset["name"] == "BTC"), None)
        
        if btc_idx is not None:
            btc_ctx = asset_ctxs[btc_idx]
            funding = float(btc_ctx.get("funding", 0))
            oracle_px = float(btc_ctx.get("oraclePx", 0))
            mark_px = float(btc_ctx.get("markPx", 0))
            open_interest = float(btc_ctx.get("openInterest", 0))
            
            df = pd.DataFrame([{
                "timestamp": now_utc,
                "hl_funding_rate": funding,
                "hl_oracle_price": oracle_px,
                "hl_mark_price": mark_px,
                "hl_open_interest": open_interest
            }])
        else:
            df = _empty_df()
            
    except (IndexError, KeyError, TypeError) as e:
        logger.warning("Error parsing Hyperliquid data: %s", e)
        df = _empty_df()
        
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)
    
    df.attrs.update(source="hyperliquid", fetched_at=now_utc.isoformat())
    return df


def _empty_df() -> pd.DataFrame:
    now = datetime.now(timezone.utc)
    df = pd.DataFrame([{
        "timestamp": now,
        "hl_funding_rate": 0.0,
        "hl_oracle_price": 0.0,
        "hl_mark_price": 0.0,
        "hl_open_interest": 0.0
    }])
    return df
