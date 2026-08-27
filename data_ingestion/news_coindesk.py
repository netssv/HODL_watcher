"""CoinDesk RSS client with local caching for recent crypto headlines."""

from datetime import datetime, timezone
from xml.etree import ElementTree

import pandas as pd
import requests

from .cache_utils import cached_fetch

RSS_URL = "https://www.coindesk.com/arc/outboundfeeds/rss/"


def get_news(limit: int = 20) -> pd.DataFrame:
    """Return recent CoinDesk headlines; RSS is public and needs no API key."""
    columns = ["title", "description", "url", "source", "sentiment"]

    def fetch():
        response = requests.get(RSS_URL, headers={"User-Agent": "HODL-Watcher/1.0"}, timeout=20)
        response.raise_for_status()
        return response.text

    raw_xml = cached_fetch(key=f"coindesk_rss|{limit}", ttl_seconds=1800, fetch_fn=fetch)
    root = ElementTree.fromstring(raw_xml)
    rows = []
    for item in root.findall(".//item")[:limit]:
        def text(tag):
            node = item.find(tag)
            return (node.text or "").strip() if node is not None else ""

        published = pd.to_datetime(text("pubDate"), utc=True, errors="coerce")
        if pd.isna(published):
            continue
        rows.append({"published_at": published, "title": text("title"),
                     "description": text("description"), "url": text("link"),
                     "source": "CoinDesk", "sentiment": None})

    df = pd.DataFrame(rows, columns=["published_at", *columns])
    if df.empty:
        df = pd.DataFrame(columns=columns)
        df.index.name = "published_at"
    else:
        df = df.set_index("published_at").sort_index(ascending=False)
    df.attrs.update(source="coindesk_rss", fetched_at=datetime.now(timezone.utc).isoformat())
    return df
