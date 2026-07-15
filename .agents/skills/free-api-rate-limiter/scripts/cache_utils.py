"""
Minimal SQLite-backed cache with TTL for free-tier API calls.
Import this into any data_ingestion client instead of writing a new cache layer.
"""

import json
import random
import sqlite3
import time
from pathlib import Path
from typing import Callable, Any

DB_PATH = Path(__file__).resolve().parents[3] / "data_ingestion" / "cache.sqlite"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            fetched_at REAL
        )
        """
    )
    return conn


def cached_fetch(key: str, ttl_seconds: float, fetch_fn: Callable[[], Any]) -> Any:
    """
    Return cached value for `key` if fresher than ttl_seconds, otherwise call
    fetch_fn(), store, and return the fresh result.
    """
    conn = _get_conn()
    row = conn.execute(
        "SELECT value, fetched_at FROM cache WHERE key = ?", (key,)
    ).fetchone()

    if row:
        value, fetched_at = row
        if time.time() - fetched_at < ttl_seconds:
            conn.close()
            return json.loads(value)

    result = _with_backoff(fetch_fn)
    conn.execute(
        "INSERT OR REPLACE INTO cache (key, value, fetched_at) VALUES (?, ?, ?)",
        (key, json.dumps(result), time.time()),
    )
    conn.commit()
    conn.close()
    return result


def _with_backoff(fetch_fn: Callable[[], Any], max_retries: int = 5) -> Any:
    for attempt in range(max_retries):
        try:
            return fetch_fn()
        except Exception as e:
            is_last = attempt == max_retries - 1
            if is_last:
                raise
            base_delay = min(60, 2 ** attempt)
            jitter = random.uniform(0, base_delay * 0.3)
            time.sleep(base_delay + jitter)
    raise RuntimeError("Unreachable: retry loop exhausted without returning or raising")


class QuotaTracker:
    """Track hard daily/monthly quotas for APIs like NewsAPI (100/day)."""

    def __init__(self, name: str, limit: int, window_seconds: float):
        self.name = name
        self.limit = limit
        self.window_seconds = window_seconds
        self.conn = _get_conn()
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS quota (
                name TEXT PRIMARY KEY,
                count INTEGER,
                window_start REAL
            )
            """
        )
        self.conn.commit()

    def can_call(self) -> bool:
        row = self.conn.execute(
            "SELECT count, window_start FROM quota WHERE name = ?", (self.name,)
        ).fetchone()
        now = time.time()
        if not row or now - row[1] > self.window_seconds:
            self.conn.execute(
                "INSERT OR REPLACE INTO quota (name, count, window_start) VALUES (?, 0, ?)",
                (self.name, now),
            )
            self.conn.commit()
            return True
        return row[0] < self.limit

    def record_call(self):
        self.conn.execute(
            "UPDATE quota SET count = count + 1 WHERE name = ?", (self.name,)
        )
        self.conn.commit()
