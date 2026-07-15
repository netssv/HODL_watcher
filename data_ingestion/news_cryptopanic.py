"""
CryptoPanic API client — crypto news headlines with sentiment.

Endpoint: https://cryptopanic.com/api/developer/v3/posts/

Free tier with API key (register at https://cryptopanic.com/developers/api/).
Limited requests — uses QuotaTracker to avoid exhausting the free tier.
Cache TTL: 30 minutes.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch, QuotaTracker
from .config import CRYPTOPANIC_API_KEY

logger = logging.getLogger(__name__)

BASE_URL = "https://cryptopanic.com/api/developer/v3/posts/"

# Conservative daily quota for the free tier
_quota = QuotaTracker(name="cryptopanic", limit=50, window_seconds=86_400)


def get_news(
    currencies: str = "BTC",
    kind: str = "news",
    limit: int = 50,
) -> pd.DataFrame:
    """
    Fetch recent crypto news headlines with sentiment labels.

    This data is intended for the **external LLM agent** (Phase 4),
    NOT as a direct model feature.

    Parameters
    ----------
    currencies : str
        Comma-separated currency codes, e.g. ``"BTC"`` or ``"BTC,ETH"``.
    kind : str
        ``"news"`` or ``"media"``.
    limit : int
        Number of posts (CryptoPanic default page size).

    Returns
    -------
    pd.DataFrame
        Columns: ``title``, ``url``, ``source``, ``sentiment``
        (``"positive"`` / ``"negative"`` / ``"neutral"`` / ``None``),
        ``votes_positive``, ``votes_negative``.
        Index: ``DatetimeIndex`` named ``"published_at"`` (UTC).
    """
    if not CRYPTOPANIC_API_KEY:
        logger.warning(
            "CRYPTOPANIC_API_KEY not set. Set the environment variable to "
            "fetch news data. Returning empty DataFrame."
        )
        df = pd.DataFrame(columns=["title", "url", "source", "sentiment"])
        df.index.name = "published_at"
        df.attrs.update(source="cryptopanic", fetched_at=datetime.now(timezone.utc).isoformat())
        return df

    if not _quota.can_call():
        logger.warning("CryptoPanic daily quota near limit — returning cached data only.")
        # Return whatever is cached (cached_fetch with infinite TTL)
        cache_key = f"cryptopanic|{currencies}|{kind}|{limit}"
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=float("inf"),
            fetch_fn=lambda: {"results": []},
        )
    else:
        cache_key = f"cryptopanic|{currencies}|{kind}|{limit}"
        raw = cached_fetch(
            key=cache_key,
            ttl_seconds=1800,  # 30 min cache
            fetch_fn=lambda: requests.get(
                BASE_URL,
                params={
                    "auth_token": CRYPTOPANIC_API_KEY,
                    "currencies": currencies,
                    "kind": kind,
                    "public": "true",
                },
                timeout=30,
            ).json(),
        )
        _quota.record_call()

    now_utc = datetime.now(timezone.utc)
    results = raw.get("results", [])

    if not results:
        df = pd.DataFrame(columns=["title", "url", "source", "sentiment"])
        df.index.name = "published_at"
        df.attrs.update(source="cryptopanic", fetched_at=now_utc.isoformat())
        return df

    rows = []
    for post in results:
        votes = post.get("votes", {})
        source_info = post.get("source", {})
        rows.append({
            "published_at": pd.to_datetime(post.get("published_at"), utc=True),
            "title": post.get("title", ""),
            "url": post.get("url", ""),
            "source": source_info.get("title", "") if isinstance(source_info, dict) else "",
            "sentiment": _extract_sentiment(post),
            "votes_positive": votes.get("positive", 0),
            "votes_negative": votes.get("negative", 0),
        })

    df = pd.DataFrame(rows)
    df.set_index("published_at", inplace=True)
    df.sort_index(inplace=True)

    df.attrs.update(source="cryptopanic", fetched_at=now_utc.isoformat())
    return df


def _extract_sentiment(post: dict) -> str | None:
    """Extract sentiment from CryptoPanic's metadata or vote-based labels."""
    # CryptoPanic may include a 'metadata' field with sentiment
    metadata = post.get("metadata", {})
    if isinstance(metadata, dict) and "sentiment" in metadata:
        return metadata["sentiment"]

    # Fallback: infer from votes
    votes = post.get("votes", {})
    pos = votes.get("positive", 0)
    neg = votes.get("negative", 0)
    if pos > neg and pos > 0:
        return "positive"
    elif neg > pos and neg > 0:
        return "negative"
    return None
