"""
FRED (Federal Reserve Economic Data) client.

Endpoint:
  - GET https://api.stlouisfed.org/fred/series/observations

Free with API key (register at https://fred.stlouisfed.org/docs/api/api_key.html).
Used for macro context features (CPI, Fed Funds Rate, broad USD index).

These series update monthly/quarterly — cache TTL: 24 hours.
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch
from .config import FRED_API_KEY

logger = logging.getLogger(__name__)

BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# Common FRED series IDs for macro context
SERIES_IDS = {
    "cpi": "CPIAUCSL",           # Consumer Price Index (monthly)
    "fed_funds": "FEDFUNDS",     # Federal Funds Effective Rate (monthly)
    "dxy": "DTWEXBGS",           # Nominal Broad U.S. Dollar Index (not ICE DXY)
    "treasury_10y": "DGS10",     # 10-Year Treasury Constant Maturity Rate (daily)
}


def get_series(
    series_id: str,
    observation_start: str | None = None,
    observation_end: str | None = None,
    limit: int = 1000,
) -> pd.DataFrame:
    """
    Fetch a single FRED time series.

    Lookback window: None (discrete observations — monthly or daily
    depending on series).

    Parameters
    ----------
    series_id : str
        FRED series ID (e.g. ``"CPIAUCSL"``).
    observation_start : str, optional
        Start date ``"YYYY-MM-DD"``.
    observation_end : str, optional
        End date ``"YYYY-MM-DD"``.
    limit : int
        Max observations to return.

    Returns
    -------
    pd.DataFrame
        Columns: ``value`` (float). Missing values marked as NaN
        (FRED uses ``"."`` for missing — we convert, not interpolate).
        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC).
    """
    if not FRED_API_KEY:
        logger.warning(
            "FRED_API_KEY not set. Set the FRED_API_KEY environment variable "
            "to fetch macro data. Returning empty DataFrame."
        )
        df = pd.DataFrame(columns=["value"])
        df.index.name = "timestamp"
        df.attrs.update(source="fred", series_id=series_id, fetched_at=datetime.now(timezone.utc).isoformat())
        return df

    params: dict = {
        "series_id": series_id,
        "api_key": FRED_API_KEY,
        "file_type": "json",
        "limit": limit,
        "sort_order": "desc",
    }
    if observation_start:
        params["observation_start"] = observation_start
    if observation_end:
        params["observation_end"] = observation_end

    cache_key = f"fred|{series_id}|{observation_start}|{observation_end}|{limit}"

    def _fetch_json():
        response = requests.get(BASE_URL, params=params, timeout=30)
        response.raise_for_status()
        return response.json()

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=24 * 3600,  # macro data updates monthly/quarterly
        fetch_fn=_fetch_json,
    )

    now_utc = datetime.now(timezone.utc)
    observations = raw.get("observations", [])

    if not observations:
        df = pd.DataFrame(columns=["value"])
        df.index.name = "timestamp"
        df.attrs.update(source="fred", series_id=series_id, fetched_at=now_utc.isoformat())
        return df

    rows = []
    for obs in observations:
        val = obs.get("value", ".")
        rows.append({
            "timestamp": pd.to_datetime(obs["date"], utc=True),
            "value": float(val) if val != "." else float("nan"),
        })

    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)

    # Count missing values explicitly — never silently interpolate
    n_missing = df["value"].isna().sum()
    if n_missing > 0:
        logger.info(
            "FRED %s: %d/%d observations are missing (marked as NaN, not interpolated).",
            series_id, n_missing, len(df),
        )

    df.attrs.update(
        source="fred",
        series_id=series_id,
        **({"macro_dxy_source": "fred_dtwexbgs"} if series_id == "DTWEXBGS" else {}),
        fetched_at=now_utc.isoformat(),
        missing_count=int(n_missing),
    )
    return df


def get_cpi(**kwargs) -> pd.DataFrame:
    """Shortcut: fetch CPI (Consumer Price Index, monthly)."""
    return get_series(SERIES_IDS["cpi"], **kwargs)


def get_fed_funds_rate(**kwargs) -> pd.DataFrame:
    """Shortcut: fetch Federal Funds Effective Rate (monthly)."""
    return get_series(SERIES_IDS["fed_funds"], **kwargs)


def get_dxy(**kwargs) -> pd.DataFrame:
    """Fetch FRED's Nominal Broad U.S. Dollar Index (DTWEXBGS, daily).

    This is a broad trade-weighted USD index, not the ICE DXY contract.
    """
    return get_series(SERIES_IDS["dxy"], **kwargs)


def get_treasury_10y(**kwargs) -> pd.DataFrame:
    """Shortcut: fetch 10-Year Treasury Rate (daily)."""
    return get_series(SERIES_IDS["treasury_10y"], **kwargs)
