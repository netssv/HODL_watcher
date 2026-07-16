"""
Configuration for external API keys and settings.

All keys come from environment variables. Register for free:
  - FRED: https://fred.stlouisfed.org/docs/api/api_key.html
  - CryptoPanic: https://cryptopanic.com/developers/api/
  - NewsAPI: https://newsapi.org/register
"""

import os

from pathlib import Path
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    load_dotenv(dotenv_path=env_path)
except ImportError:
    pass

# FRED API (free, required for macro data)
FRED_API_KEY: str = os.getenv("FRED_API_KEY", "")

# Currents API (news)
CURRENTS_API_KEY: str = os.getenv("CURRENTS_API_KEY", "")

# NewsAPI (free tier, 100 requests/day)
NEWSAPI_KEY: str = os.getenv("NEWSAPI_KEY", "")

# Coinalyze API (futures data)
COINALYZE_API_KEY: str = os.getenv("COINALYZE_API_KEY", "")

# Etherscan API (free, required for real-time on-chain Ethereum metrics)
ETHERSCAN_API_KEY: str = os.getenv("ETHERSCAN_API_KEY", "")

