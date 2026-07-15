"""
NewsAPI client — general news search for Bitcoin/macro keywords.

Endpoint: https://newsapi.org/v2/everything

Free tier: 100 requests/day (hard limit, tracked by QuotaTracker).
Cache TTL: 60 minutes.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch, QuotaTracker
from .config import NEWSAPI_KEY

logger = logging.getLogger(__name__)

BASE_URL = "https://newsapi.org/v2/everything"

# Hard daily limit for the free tier
_quota = QuotaTracker(name="newsapi", limit=100, window_seconds=86_400)


def search_news(
    query: str = "Bitcoin OR BTC",
    language: str = "en",
    sort_by: str = "publishedAt",
    page_size: int = 20,
) -> pd.DataFrame:
    """
    Search for recent news articles matching a query.

    This data is intended for the **external LLM agent** (Phase 4),
    NOT as a direct model feature.

    Parameters
    ----------
    query : str
        Search keywords. Supports AND/OR/NOT operators.
    language : str
        Two-letter ISO language code.
    sort_by : str
        ``"publishedAt"``, ``"relevancy"``, or ``"popularity"``.
    page_size : int
        Number of articles per page (max 100 on free tier).

    Returns
    -------
    pd.DataFrame
        Columns: ``title``, ``description``, ``url``, ``source``,
        ``author``.
        Index: ``DatetimeIndex`` named ``"published_at"`` (UTC).
    """
    if not NEWSAPI_KEY:
        logger.warning(
            "NEWSAPI_KEY not set. Set the environment variable to fetch "
            "news data. Returning empty DataFrame."
        )
        df = pd.DataFrame(columns=["title", "description", "url", "source"])
        df.index.name = "published_at"
        df.attrs.update(source="newsapi", fetched_at=datetime.now(timezone.utc).isoformat())
        return df

    cache_key = f"newsapi|{query}|{language}|{sort_by}|{page_size}"

    if not _quota.can_call():
        logger.warning(
            "NewsAPI daily quota exhausted (100/day). Returning cached data only."
        )
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=float("inf"),
            fetch_fn=lambda: {"articles": []},
        )
    else:
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=3600,  # 60 min cache
            fetch_fn=lambda: requests.get(
                BASE_URL,
                params={
                    "q": query,
                    "language": language,
                    "sortBy": sort_by,
                    "pageSize": page_size,
                    "apiKey": NEWSAPI_KEY,
                },
                timeout=30,
            ).json(),
        )
        _quota.record_call()

    now_utc = datetime.now(timezone.utc)
    articles = raw.get("articles", [])

    if not articles:
        df = pd.DataFrame(columns=["title", "description", "url", "source"])
        df.index.name = "published_at"
        df.attrs.update(source="newsapi", fetched_at=now_utc.isoformat())
        return df

    rows = []
    for article in articles:
        source_info = article.get("source", {})
        rows.append({
            "published_at": pd.to_datetime(article.get("publishedAt"), utc=True),
            "title": article.get("title", ""),
            "description": article.get("description", ""),
            "url": article.get("url", ""),
            "source": source_info.get("name", "") if isinstance(source_info, dict) else "",
            "author": article.get("author", ""),
        })

    df = pd.DataFrame(rows)
    df.set_index("published_at", inplace=True)
    df.sort_index(inplace=True)

    df.attrs.update(source="newsapi", fetched_at=now_utc.isoformat())
    return df
