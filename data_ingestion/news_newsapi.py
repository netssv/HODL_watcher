"""
NewsAPI client — general news search for Bitcoin/macro keywords.

Uses official newsapi-python client library.
Free tier: 1,000 requests/month (~33/day). Budget capped at 30/day here.
Cache TTL: 6 hours to stay well within the monthly allowance.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
from newsapi import NewsApiClient

from .cache_utils import cached_fetch, QuotaTracker
from .config import NEWSAPI_KEY

logger = logging.getLogger(__name__)

# Budget: 30 calls/day keeps us under 1,000/month (real free-tier limit)
_quota = QuotaTracker(name="newsapi", limit=30, window_seconds=86_400)


def search_news(
    query: str = "Bitcoin OR BTC",
    language: str = "en",
    sort_by: str = "publishedAt",
    page_size: int = 20,
) -> pd.DataFrame:
    """
    Search for recent news articles matching a query.

    Parameters
    ----------
    query : str
        Search keywords.
    language : str
        Two-letter ISO language code.
    sort_by : str
        "publishedAt", "relevancy", or "popularity".
    page_size : int
        Number of articles per page.

    Returns
    -------
    pd.DataFrame
        Columns: ``title``, ``description``, ``url``, ``source``, ``author``.
        Index: ``DatetimeIndex`` named ``"published_at"`` (UTC).
    """
    if not NEWSAPI_KEY:
        logger.warning("NEWSAPI_KEY not set. Returning empty DataFrame.")
        df = pd.DataFrame(columns=["title", "description", "url", "source"])
        df.index.name = "published_at"
        df.attrs.update(source="newsapi", fetched_at=datetime.now(timezone.utc).isoformat())
        return df

    cache_key = f"newsapi_lib|{query}|{language}|{sort_by}|{page_size}"

    if not _quota.can_call():
        logger.warning("NewsAPI daily quota exhausted. Returning cached data only.")
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=float("inf"),
            fetch_fn=lambda: {"articles": []},
        )
    else:
        newsapi = NewsApiClient(api_key=NEWSAPI_KEY)
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=21_600,  # 6-hour cache — 1,000 req/month budget
            fetch_fn=lambda: newsapi.get_everything(
                q=query,
                language=language,
                sort_by=sort_by,
                page_size=page_size
            ),
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

