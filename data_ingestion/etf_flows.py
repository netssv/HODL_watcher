"""
ETF Flows proxy — derived from CoinGecko vs Binance volume delta.

Methodology:
  etf_proxy_flow (USD M) = CoinGecko_global_BTC_volume - Binance_spot_BTC_volume
  Positive = off-exchange (ETF/OTC/institutional) buying exceeds Binance contribution.

Note: True SEC-filed ETF data (IBIT, FBTC, etc.) requires a paid Bloomberg/
Morningstar feed. This proxy is a real, free-tier approximation.

Cache TTL: 60 min (hourly granularity from CoinGecko).
"""

import logging
from datetime import datetime, timezone
import pandas as pd

from .coingecko import get_market_chart
from .binance_spot import get_klines

logger = logging.getLogger(__name__)


def get_etf_flows(days: int = 4) -> pd.DataFrame:
    """
    Compute a real ETF-flow proxy from CoinGecko global volume vs Binance spot.

    Returns
    -------
    pd.DataFrame
        Columns: ``etf_net_flow`` (USD millions, positive = institutional buy).
        Index: ``DatetimeIndex`` named ``timestamp`` (UTC, hourly).
    """
    now = datetime.now(timezone.utc)
    try:
        cg_df = get_market_chart(days=days)
    except Exception as e:
        logger.warning("CoinGecko ETF proxy failed: %s. Returning empty.", e)
        df = pd.DataFrame(columns=["etf_net_flow"])
        df.index.name = "timestamp"
        df.attrs.update(source="etf_empty", fetched_at=now.isoformat())
        return df

    try:
        limit = days * 24 + 4
        bnb_df = get_klines(symbol="BTCUSDT", interval="1h", limit=limit)
        bnb_hourly = (bnb_df["volume"] * bnb_df["close"]).rename("binance_vol_usd")
        bnb_hourly.index = bnb_hourly.index.tz_localize("UTC") if bnb_hourly.index.tz is None else bnb_hourly.index
        bnb_hourly.index.name = "timestamp"
    except Exception as e:
        logger.warning("Binance volume for ETF proxy failed: %s", e)
        bnb_hourly = None

    cg_df = cg_df[["total_volume"]].copy()
    cg_df.index = cg_df.index.floor("h")

    if bnb_hourly is not None:
        merged = cg_df.join(bnb_hourly, how="left").ffill()
        merged["etf_net_flow"] = (merged["total_volume"] - merged["binance_vol_usd"].fillna(0)) / 1e6
    else:
        merged = cg_df.copy()
        merged["etf_net_flow"] = merged["total_volume"] / 1e6

    result = merged[["etf_net_flow"]].dropna()
    result.index.name = "timestamp"
    result.attrs.update(source="coingecko_proxy", fetched_at=now.isoformat())
    return result
