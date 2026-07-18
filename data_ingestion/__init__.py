"""
data_ingestion — API clients for all external data sources.

Each client:
  - Checks local SQLite cache before making network calls
  - Uses exponential backoff with jitter on failure
  - Returns pandas DataFrames with UTC-normalized timestamps
  - Records metadata: source, fetch timestamp, detected gaps
"""

from . import binance_spot
from . import binance_futures
from . import fear_greed
from . import fred_macro
from . import coingecko
from . import mempool_onchain
from . import news_newsapi
from . import coinalyze
from . import deribit
from . import onchain_metrics
from . import etf_flows
from . import news_currents
from . import hyperliquid
from . import okx
from . import kraken
from . import bybit
from . import news_gnews
from . import news_coindesk
from . import dxy

__all__ = [
    "binance_spot",
    "binance_futures",
    "fear_greed",
    "fred_macro",
    "coingecko",
    "mempool_onchain",
    "news_newsapi",
    "coinalyze",
    "deribit",
    "onchain_metrics",
    "etf_flows",
    "news_currents",
    "hyperliquid",
    "okx",
    "kraken",
    "bybit",
    "news_gnews",
    "news_coindesk",
    "dxy",
]
