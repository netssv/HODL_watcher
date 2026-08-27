"""
Configuration for external API keys and settings.

All keys come from environment variables. Register for free:
  - FRED: https://fred.stlouisfed.org/docs/api/api_key.html
  - CryptoPanic: https://cryptopanic.com/developers/api/
  - NewsAPI: https://newsapi.org/register
  - OKX: https://www.okx.com/account/my-api
  - Kraken: https://www.kraken.com/u/security/api
  - Bybit: https://www.bybit.com/app/user/api-management
  - GNews: https://gnews.io/
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
GNEWS_API_KEY: str = os.getenv("GNEWS_API_KEY", "")

# Coinalyze API (futures data)
COINALYZE_API_KEY: str = os.getenv("COINALYZE_API_KEY", "")

# Etherscan API (free, required for real-time on-chain Ethereum metrics)
ETHERSCAN_API_KEY: str = os.getenv("ETHERSCAN_API_KEY", "")

# OKX API credentials (used for authenticated OKX data endpoints)
OKX_API_KEY: str = os.getenv("OKX_API_KEY", "")
OKX_SECRET_KEY: str = os.getenv("OKX_SECRET_KEY", "")
OKX_PASSPHRASE: str = os.getenv("OKX_PASSPHRASE", "")

# Kraken API credentials (used for authenticated Kraken data endpoints)
KRAKEN_API_KEY: str = os.getenv("KRAKEN_API_KEY", "")
KRAKEN_PRIVATE_KEY: str = os.getenv("KRAKEN_PRIVATE_KEY", "")

# Bybit API credentials
BYBIT_API_KEY: str = os.getenv("BYBIT_API_KEY", "")
BYBIT_SECRET_KEY: str = os.getenv("BYBIT_SECRET_KEY", "")
BYBIT_TESTNET: bool = os.getenv("BYBIT_TESTNET", "false").lower() in {"1", "true", "yes"}
