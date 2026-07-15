"""
CoinGecko API client — aggregated market data for cross-validation.

Endpoint: https://api.coingecko.com/api/v3/

Free (no key for basic usage). Rate limit: ~10-30 req/min.
Used primarily to cross-validate Binance prices and get market cap data.
Cache TTL: 5 minutes for current data, 1 hour for historical.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

BASE_URL = "https://api.coingecko.com/api/v3"


def get_current_price(
    coin_id: str = "bitcoin",
    vs_currency: str = "usd",
) -> dict:
    """
    Fetch current price, market cap, and 24h volume from CoinGecko.

    Useful as a cross-validation check against Binance spot price.

    Returns
    -------
    dict
        Keys: ``price``, ``market_cap``, ``total_volume``,
        ``price_change_24h_pct``, ``fetched_at``, ``source``.
    """
    cache_key = f"coingecko_price|{coin_id}|{vs_currency}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=300,  # 5 min for current price
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/simple/price",
            params={
                "ids": coin_id,
                "vs_currencies": vs_currency,
                "include_market_cap": "true",
                "include_24hr_vol": "true",
                "include_24hr_change": "true",
            },
            timeout=30,
        ).json(),
    )

    coin_data = raw.get(coin_id, {})
    return {
        "price": coin_data.get(vs_currency, 0),
        "market_cap": coin_data.get(f"{vs_currency}_market_cap", 0),
        "total_volume": coin_data.get(f"{vs_currency}_24h_vol", 0),
        "price_change_24h_pct": coin_data.get(f"{vs_currency}_24h_change", 0),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "coingecko",
    }


def get_market_chart(
    coin_id: str = "bitcoin",
    vs_currency: str = "usd",
    days: int | str = 90,
) -> pd.DataFrame:
    """
    Fetch historical market data (price, market cap, volume).

    CoinGecko auto-selects granularity based on ``days``:
      - 1 day  → 5-min intervals
      - 2-90 days → hourly
      - >90 days → daily

    Lookback window: None (fetches discrete historical data points).

    Parameters
    ----------
    coin_id : str
        CoinGecko coin ID (e.g. ``"bitcoin"``).
    vs_currency : str
        Quote currency (e.g. ``"usd"``).
    days : int or str
        Number of days of history. Use ``"max"`` for all available.

    Returns
    -------
    pd.DataFrame
        Columns: ``price``, ``market_cap``, ``total_volume``.
        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC).
    """
    cache_key = f"coingecko_chart|{coin_id}|{vs_currency}|{days}"

    # Historical data doesn't change; longer cache for older data
    ttl = 3600 if isinstance(days, int) and days > 1 else 300

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=ttl,
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/coins/{coin_id}/market_chart",
            params={"vs_currency": vs_currency, "days": days},
            timeout=30,
        ).json(),
    )

    now_utc = datetime.now(timezone.utc)

    prices = raw.get("prices", [])
    market_caps = raw.get("market_caps", [])
    volumes = raw.get("total_volumes", [])

    if not prices:
        df = pd.DataFrame(columns=["price", "market_cap", "total_volume"])
        df.index.name = "timestamp"
        df.attrs.update(source="coingecko", fetched_at=now_utc.isoformat())
        return df

    # Build DataFrame from price timestamps (most reliable)
    rows = []
    mc_dict = {ts: val for ts, val in market_caps}
    vol_dict = {ts: val for ts, val in volumes}

    for ts, price in prices:
        rows.append({
            "timestamp": pd.to_datetime(ts, unit="ms", utc=True),
            "price": price,
            "market_cap": mc_dict.get(ts, float("nan")),
            "total_volume": vol_dict.get(ts, float("nan")),
        })

    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)

    df.attrs.update(
        source="coingecko",
        fetched_at=now_utc.isoformat(),
        granularity_note=(
            "5-min for 1 day, hourly for 2-90 days, daily for >90 days "
            "(auto-selected by CoinGecko)"
        ),
    )
    return df


def get_coin_info(coin_id: str = "bitcoin") -> dict:
    """
    Fetch detailed coin information (for context, not model features).

    Returns a dict with market_data, community_data, and developer_data
    subsets relevant to the project.
    """
    cache_key = f"coingecko_info|{coin_id}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=3600,
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/coins/{coin_id}",
            params={
                "localization": "false",
                "tickers": "false",
                "community_data": "true",
                "developer_data": "false",
            },
            timeout=30,
        ).json(),
    )

    market = raw.get("market_data", {})
    return {
        "name": raw.get("name", coin_id),
        "current_price_usd": market.get("current_price", {}).get("usd", 0),
        "ath_usd": market.get("ath", {}).get("usd", 0),
        "ath_change_pct": market.get("ath_change_percentage", {}).get("usd", 0),
        "circulating_supply": market.get("circulating_supply", 0),
        "max_supply": market.get("max_supply", 0),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "coingecko",
    }
