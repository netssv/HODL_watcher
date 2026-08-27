"""GNews client used as the final news-source fallback."""
from datetime import datetime, timezone
import pandas as pd
import requests
from .cache_utils import cached_fetch, QuotaTracker
from .config import GNEWS_API_KEY

_quota = QuotaTracker(name="gnews", limit=90, window_seconds=86_400)

def search_news(query="Bitcoin OR BTC", max_results=10):
    columns = ["title", "description", "url", "source", "author"]
    if not GNEWS_API_KEY or not _quota.can_call():
        df = pd.DataFrame(columns=columns); df.index.name = "published_at"; return df
    key = f"gnews|{query}|{max_results}"
    raw = cached_fetch(key=key, ttl_seconds=3600, fetch_fn=lambda: requests.get(
        "https://gnews.io/api/v4/search",
        params={"q": query, "lang": "en", "max": max_results, "apikey": GNEWS_API_KEY}, timeout=30
    ).json())
    _quota.record_call()
    rows = [{"published_at": pd.to_datetime(a.get("publishedAt"), utc=True), "title": a.get("title", ""),
             "description": a.get("description", ""), "url": a.get("url", ""),
             "source": a.get("source", {}).get("name", ""), "author": ""}
            for a in raw.get("articles", [])]
    df = pd.DataFrame(rows, columns=["published_at", *columns])
    if not df.empty: df = df.set_index("published_at").sort_index()
    else: df.index.name = "published_at"
    df.attrs.update(source="gnews", fetched_at=datetime.now(timezone.utc).isoformat())
    return df
