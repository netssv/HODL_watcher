"""
Currents API client — latest news.

Endpoint: https://api.currentsapi.services/v1/latest-news

Limited requests — uses QuotaTracker to avoid exhausting the free tier.
Cache TTL: 30 minutes.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch, QuotaTracker
from .config import CURRENTS_API_KEY

logger = logging.getLogger(__name__)

BASE_URL = "https://api.currentsapi.services/v1/latest-news"

_quota = QuotaTracker(name="currents", limit=50, window_seconds=86_400)


def get_news(
    currencies: str = "BTC",
    limit: int = 50,
) -> pd.DataFrame:
    """
    Fetch recent news headlines.

    Parameters
    ----------
    currencies : str
        Used as keywords (e.g. "BTC").
    limit : int
        Number of posts.

    Returns
    -------
    pd.DataFrame
        Columns: ``title``, ``url``, ``source``, ``sentiment``
        Index: ``DatetimeIndex`` named ``"published_at"`` (UTC).
    """
    if not CURRENTS_API_KEY:
        logger.warning(
            "CURRENTS_API_KEY not set. Set the environment variable to "
            "fetch news data. Returning empty DataFrame."
        )
        df = pd.DataFrame(columns=["title", "url", "source", "sentiment"])
        df.index.name = "published_at"
        df.attrs.update(source="currents", fetched_at=datetime.now(timezone.utc).isoformat())
        return df

    if not _quota.can_call():
        logger.warning("Currents daily quota near limit — returning cached data only.")
        cache_key = f"currents|{currencies}|{limit}"
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=float("inf"),
            fetch_fn=lambda: {"news": []},
        )
    else:
        cache_key = f"currents|{currencies}|{limit}"
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=1800,  # 30 min cache
            fetch_fn=lambda: requests.get(
                BASE_URL,
                headers={"Authorization": CURRENTS_API_KEY},
                params={
                    "language": "en",
                    "keywords": currencies,
                },
                timeout=30,
            ).json(),
        )
        _quota.record_call()

    now_utc = datetime.now(timezone.utc)
    results = raw.get("news", [])

    if not results:
        df = pd.DataFrame(columns=["title", "url", "source", "sentiment"])
        df.index.name = "published_at"
        df.attrs.update(source="currents", fetched_at=now_utc.isoformat())
        return df

    rows = []
    for post in results[:limit]:
        rows.append({
            "published_at": pd.to_datetime(post.get("published"), utc=True),
            "title": post.get("title", ""),
            "url": post.get("url", ""),
            "source": post.get("author", ""),
            "sentiment": None,
        })

    df = pd.DataFrame(rows)
    # drop rows where published_at is NaT
    df = df.dropna(subset=['published_at'])
    if df.empty:
        df = pd.DataFrame(columns=["title", "url", "source", "sentiment"])
        df.index.name = "published_at"
        df.attrs.update(source="currents", fetched_at=now_utc.isoformat())
        return df
        
    df.set_index("published_at", inplace=True)
    df.sort_index(inplace=True)

    df.attrs.update(source="currents", fetched_at=now_utc.isoformat())
    return df
