"""
mempool.space API client — on-chain Bitcoin metrics.

Endpoint base: https://mempool.space/api/

Free, no API key. Provides real-time on-chain data:
  - Recommended fees
  - Mempool statistics
  - Hashrate and difficulty
  - Block information

Cache TTL: 10 minutes (on-chain data updates with each block, ~10 min).
"""

import logging
from datetime import datetime, timezone

import pandas as pd
import requests

from .cache_utils import cached_fetch

logger = logging.getLogger(__name__)

BASE_URL = "https://mempool.space/api"


def get_recommended_fees() -> dict:
    """
    Fetch current recommended transaction fees (sat/vB).

    Returns
    -------
    dict
        Keys: ``fastest_fee``, ``half_hour_fee``, ``hour_fee``,
        ``economy_fee``, ``minimum_fee``, ``fetched_at``, ``source``.
    """
    cache_key = "mempool_fees"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=600,  # 10 min
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/v1/fees/recommended", timeout=30
        ).json(),
    )

    return {
        "fastest_fee": raw.get("fastestFee", 0),
        "half_hour_fee": raw.get("halfHourFee", 0),
        "hour_fee": raw.get("hourFee", 0),
        "economy_fee": raw.get("economyFee", 0),
        "minimum_fee": raw.get("minimumFee", 0),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "mempool_space",
    }


def get_mempool_stats() -> dict:
    """
    Fetch current mempool statistics.

    Returns
    -------
    dict
        Keys: ``count`` (number of unconfirmed txs), ``vsize``
        (total virtual size in vbytes), ``total_fee`` (BTC),
        ``fetched_at``, ``source``.
    """
    cache_key = "mempool_stats"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=600,
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/mempool", timeout=30
        ).json(),
    )

    return {
        "count": raw.get("count", 0),
        "vsize": raw.get("vsize", 0),
        "total_fee": raw.get("total_fee", 0),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "mempool_space",
    }


def get_hashrate(timeframe: str = "1m") -> pd.DataFrame:
    """
    Fetch hashrate and difficulty history.

    Parameters
    ----------
    timeframe : str
        One of ``"1m"``, ``"3m"``, ``"6m"``, ``"1y"``, ``"2y"``, ``"3y"``.

    Returns
    -------
    pd.DataFrame
        Columns: ``avg_hashrate`` (H/s), ``difficulty``.
        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC).
    """
    cache_key = f"mempool_hashrate|{timeframe}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=3600,  # hashrate doesn't change fast, 1h cache
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/v1/mining/hashrate/{timeframe}", timeout=30
        ).json(),
    )

    now_utc = datetime.now(timezone.utc)

    hashrates = raw.get("hashrates", [])
    difficulty_data = raw.get("difficulty", [])

    if not hashrates:
        df = pd.DataFrame(columns=["avg_hashrate"])
        df.index.name = "timestamp"
        df.attrs.update(source="mempool_space", fetched_at=now_utc.isoformat())
        return df

    rows = []
    for entry in hashrates:
        rows.append({
            "timestamp": pd.to_datetime(entry["timestamp"], unit="s", utc=True),
            "avg_hashrate": float(entry.get("avgHashrate", 0)),
        })

    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)

    # Merge difficulty if available (different granularity, use merge_asof
    # with direction='backward' to avoid pulling future values)
    if difficulty_data:
        diff_rows = []
        for entry in difficulty_data:
            diff_rows.append({
                "timestamp": pd.to_datetime(entry["time"], unit="s", utc=True),
                "difficulty": float(entry.get("difficulty", 0)),
            })
        diff_df = pd.DataFrame(diff_rows).set_index("timestamp").sort_index()
        # merge_asof with backward direction: each hashrate row gets the
        # most recent difficulty value at or before its timestamp
        df = pd.merge_asof(
            df.reset_index().sort_values("timestamp"),
            diff_df.reset_index().sort_values("timestamp"),
            on="timestamp",
            direction="backward",
        ).set_index("timestamp")

    df.attrs.update(source="mempool_space", fetched_at=now_utc.isoformat())
    return df


def get_blocks_recent(count: int = 10) -> pd.DataFrame:
    """
    Fetch the most recent blocks.

    Parameters
    ----------
    count : int
        Number of recent blocks (max ~15 without pagination).

    Returns
    -------
    pd.DataFrame
        Columns: ``height``, ``size``, ``weight``, ``tx_count``,
        ``total_fees`` (sat).
        Index: ``DatetimeIndex`` named ``"timestamp"`` (UTC).
    """
    cache_key = f"mempool_blocks_recent|{count}"

    raw = cached_fetch(
        key=cache_key,
        ttl_seconds=600,
        fetch_fn=lambda: requests.get(
            f"{BASE_URL}/v1/blocks", timeout=30
        ).json(),
    )

    now_utc = datetime.now(timezone.utc)

    if not raw:
        df = pd.DataFrame(columns=["height", "size", "weight", "tx_count", "total_fees"])
        df.index.name = "timestamp"
        df.attrs.update(source="mempool_space", fetched_at=now_utc.isoformat())
        return df

    rows = []
    for block in raw[:count]:
        extras = block.get("extras", {})
        rows.append({
            "timestamp": pd.to_datetime(block["timestamp"], unit="s", utc=True),
            "height": block.get("height", 0),
            "size": block.get("size", 0),
            "weight": block.get("weight", 0),
            "tx_count": block.get("tx_count", 0),
            "total_fees": extras.get("totalFees", 0),
        })

    df = pd.DataFrame(rows)
    df.set_index("timestamp", inplace=True)
    df.sort_index(inplace=True)

    df.attrs.update(source="mempool_space", fetched_at=now_utc.isoformat())
    return df
