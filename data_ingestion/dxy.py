"""ICE U.S. Dollar Index (DXY) quote via Yahoo Finance's public chart feed."""

from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

URLS = (
    "https://query1.finance.yahoo.com/v8/finance/chart/DX-Y.NYB",
    "https://query2.finance.yahoo.com/v8/finance/chart/DX-Y.NYB",
)
SOURCE_VERSION = "ice_dxy_yahoo"


def get_dxy(range_name: str = "5d") -> pd.DataFrame:
    def fetch():
        last_error = None
        for url in URLS:
            try:
                response = requests.get(
                    url,
                    params={"range": range_name, "interval": "1d"},
                    headers={"User-Agent": "HODL-Watcher/1.0"},
                    timeout=10,
                )
                response.raise_for_status()
                raw = response.json()
                if raw.get("chart", {}).get("result"):
                    return raw
            except (requests.RequestException, ValueError, TypeError) as exc:
                last_error = exc
        raise RuntimeError(f"DXY quote unavailable: {last_error}")

    raw = cached_fetch(f"dxy|DX-Y.NYB|{range_name}|1d", 24 * 3600, fetch)
    result = raw["chart"]["result"][0]
    rows = [
        {"timestamp": pd.to_datetime(ts, unit="s", utc=True), "value": close}
        for ts, close in zip(result["timestamp"], result["indicators"]["quote"][0]["close"])
        if close is not None
    ]
    if not rows:
        return pd.DataFrame(columns=["value"])
    df = pd.DataFrame(rows).set_index("timestamp").sort_index()
    df.attrs.update(
        source="yahoo_finance",
        series_id="DX-Y.NYB",
        macro_dxy_source=SOURCE_VERSION,
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )
    return df
