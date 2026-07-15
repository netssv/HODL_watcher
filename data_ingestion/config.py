"""
Configuration for external API keys and settings.

All keys come from environment variables. Register for free:
  - FRED: https://fred.stlouisfed.org/docs/api/api_key.html
  - CryptoPanic: https://cryptopanic.com/developers/api/
  - NewsAPI: https://newsapi.org/register
"""

import os

# FRED API (free, required for macro data)
FRED_API_KEY: str = os.getenv("FRED_API_KEY", "bfa96fe377174f4e5957f1002136bbc0")

# CryptoPanic (free tier, limited requests)
CRYPTOPANIC_API_KEY: str = os.getenv("CRYPTOPANIC_API_KEY", "")

# NewsAPI (free tier, 100 requests/day)
NEWSAPI_KEY: str = os.getenv("NEWSAPI_KEY", "c05f86cf9bfc4cc0930864c153bbb26b")
