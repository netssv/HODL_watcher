"""
Minimal SQLite-backed cache with TTL for free-tier API calls.

Adapted from .agents/skills/free-api-rate-limiter/scripts/cache_utils.py.
Import into any data_ingestion client instead of writing a new cache layer.
"""

import json
import logging
import random
import sqlite3
import time
from pathlib import Path
from typing import Callable, Any

import requests

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent / "cache.sqlite"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH), check_same_thread=False)
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
    Return cached value for ``key`` if fresher than *ttl_seconds*, otherwise
    call *fetch_fn()*, store the result, and return it.
    """
    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT value, fetched_at FROM cache WHERE key = ?", (key,)
        ).fetchone()

        if row:
            value, fetched_at = row
            age = time.time() - fetched_at
            if age < ttl_seconds:
                logger.debug("Cache HIT for %s (age=%.0fs, ttl=%.0fs)", key, age, ttl_seconds)
                return json.loads(value)
            logger.debug("Cache STALE for %s (age=%.0fs, ttl=%.0fs)", key, age, ttl_seconds)
        else:
            logger.debug("Cache MISS for %s", key)

        result = _with_backoff(fetch_fn)
        conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, fetched_at) VALUES (?, ?, ?)",
            (key, json.dumps(result), time.time()),
        )
        conn.commit()
        return result
    finally:
        conn.close()


def _with_backoff(fetch_fn: Callable[[], Any], max_retries: int = 5) -> Any:
    """Retry *fetch_fn* with exponential backoff + jitter on failure."""
    for attempt in range(max_retries):
        try:
            return fetch_fn()
        except Exception as exc:
            response = exc.response if isinstance(exc, requests.HTTPError) else None
            if response is not None and response.status_code not in (429,) and response.status_code < 500:
                raise
            is_last = attempt == max_retries - 1
            if is_last:
                raise
            base_delay = min(60, 2**attempt)
            jitter = random.uniform(0, base_delay * 0.3)
            wait = base_delay + jitter
            logger.warning(
                "Attempt %d/%d failed (%s), retrying in %.1fs",
                attempt + 1, max_retries, exc, wait,
            )
            time.sleep(wait)
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
            # Window expired — reset counter
            self.conn.execute(
                "INSERT OR REPLACE INTO quota (name, count, window_start) VALUES (?, 0, ?)",
                (self.name, now),
            )
            self.conn.commit()
            return True
        remaining = self.limit - row[0]
        if remaining <= 0:
            logger.warning(
                "Quota exhausted for %s (%d/%d used). Returning cached data.",
                self.name, row[0], self.limit,
            )
        return remaining > 0

    def record_call(self):
        self.conn.execute(
            "UPDATE quota SET count = count + 1 WHERE name = ?", (self.name,)
        )
        self.conn.commit()

    def close(self):
        self.conn.close()
