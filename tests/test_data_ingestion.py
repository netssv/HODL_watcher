"""
Tests for data_ingestion module.

Covers:
  1. No-future-data-leakage: timestamps in returned DataFrames ≤ "now"
  2. Data gap detection: metadata correctly flags gaps
  3. Cache behavior: cache hits avoid network calls
  4. Schema validation: expected columns and dtypes
  5. Graceful degradation: missing API keys return empty DataFrames

These tests use monkeypatching to avoid hitting real APIs.
"""

import json
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import pandas as pd
import pytest
import requests


# ---------------------------------------------------------------------------
# Fixtures — fake API responses
# ---------------------------------------------------------------------------

def _make_kline(open_time_ms: int, interval_ms: int = 3_600_000):
    """Generate a single Binance kline row as a list."""
    close_time_ms = open_time_ms + interval_ms - 1
    return [
        open_time_ms,           # open time
        "50000.0",              # open
        "51000.0",              # high
        "49000.0",              # low
        "50500.0",              # close
        "100.0",                # volume
        close_time_ms,          # close time
        "5000000.0",            # quote volume
        1000,                   # trades
        "60.0",                 # taker buy base
        "3000000.0",            # taker buy quote
        "0",                    # ignore
    ]


def _fake_klines_response(n: int = 5, gap_at: int | None = None):
    """Generate n consecutive 1h klines, optionally with a gap."""
    base_ms = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    interval_ms = 3_600_000  # 1h
    klines = []
    for i in range(n):
        offset = i
        if gap_at is not None and i >= gap_at:
            offset = i + 2  # skip 2 candles to create a gap
        klines.append(_make_kline(base_ms + offset * interval_ms))
    return klines


def _fake_funding_response(n: int = 3):
    """Generate n funding rate entries."""
    base_ms = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    entries = []
    for i in range(n):
        entries.append({
            "symbol": "BTCUSDT",
            "fundingTime": base_ms + i * 8 * 3_600_000,  # every 8h
            "fundingRate": "0.0001",
            "markPrice": "50000.0",
        })
    return entries


def _fake_long_short_response(n: int = 3):
    """Generate n long/short ratio entries."""
    base_ms = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    entries = []
    for i in range(n):
        entries.append({
            "symbol": "BTCUSDT",
            "longShortRatio": "1.5",
            "longAccount": "0.6",
            "shortAccount": "0.4",
            "timestamp": base_ms + i * 3_600_000,
        })
    return entries


def _fake_liq_heatmap_response(n: int = 3):
    klines = _fake_klines_response(n)
    return {
        "oi": [
            {"timestamp": candle[0], "sumOpenInterestValue": str(1_000_000 + i * 10_000)}
            for i, candle in enumerate(klines)
        ],
        "klines": klines,
        "ls": [{"longAccount": "0.6", "shortAccount": "0.4"}],
    }


def _fake_fear_greed_response():
    """Generate Fear & Greed Index response."""
    base_ts = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp())
    return {
        "data": [
            {"value": "50", "value_classification": "Neutral", "timestamp": str(base_ts)},
            {"value": "30", "value_classification": "Fear", "timestamp": str(base_ts - 86400)},
            {"value": "75", "value_classification": "Greed", "timestamp": str(base_ts - 172800)},
        ]
    }


def _fake_coinalyze_response():
    return [{"symbol": "BTCUSDT_PERP.A", "history": [
        {"t": 1_735_689_600, "o": 100, "h": 120, "l": 90, "c": 110},
    ]}]


def _fake_fred_response():
    """Generate FRED observations response."""
    return {
        "observations": [
            {"date": "2025-01-01", "value": "3.2"},
            {"date": "2024-12-01", "value": "3.1"},
            {"date": "2024-11-01", "value": "."},  # missing value
        ]
    }


def _fake_coingecko_chart_response():
    """Generate CoinGecko market_chart response."""
    base_ms = int(datetime(2025, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    return {
        "prices": [
            [base_ms, 50000.0],
            [base_ms + 3_600_000, 50100.0],
            [base_ms + 7_200_000, 50200.0],
        ],
        "market_caps": [
            [base_ms, 1e12],
            [base_ms + 3_600_000, 1.01e12],
            [base_ms + 7_200_000, 1.02e12],
        ],
        "total_volumes": [
            [base_ms, 5e10],
            [base_ms + 3_600_000, 5.1e10],
            [base_ms + 7_200_000, 5.2e10],
        ],
    }


# ---------------------------------------------------------------------------
# Helper: patch cached_fetch to bypass SQLite and network
# ---------------------------------------------------------------------------

def _patch_cached_fetch(module_path: str, return_value):
    """
    Return a patch context manager that replaces cached_fetch in the
    given module, bypassing both cache and network.
    """
    return patch(
        f"data_ingestion.{module_path}.cached_fetch",
        return_value=return_value,
    )


# ===================================================================
# TEST GROUP 1: No future data leakage
# ===================================================================

def test_liq_heatmap_keeps_calculated_levels():
    with _patch_cached_fetch("binance_futures", _fake_liq_heatmap_response()):
        from data_ingestion.binance_futures import get_liq_heatmap_data
        heatmap = get_liq_heatmap_data()

    assert heatmap["upper"] is not None
    assert heatmap["lower"] is not None
    assert any(bucket["notionalUSD"] > 0 for bucket in heatmap["long_buckets"])
    assert any(bucket["notionalUSD"] > 0 for bucket in heatmap["short_buckets"])


def test_bybit_liq_heatmap_keeps_calculated_levels():
    raw = _fake_liq_heatmap_response()
    raw["oi"] = [{"timestamp": item["timestamp"], "openInterest": "20"} for item in raw["oi"]]
    raw["klines"] = [[*item[:7]] for item in raw["klines"]]
    raw["ratio"] = [{"buyRatio": "0.6", "sellRatio": "0.4"}]
    with _patch_cached_fetch("bybit", raw):
        from data_ingestion.bybit import get_liq_heatmap_data
        heatmap = get_liq_heatmap_data()

    assert heatmap["source"] == "bybit_public_open_interest"
    assert heatmap["upper"] is not None and heatmap["lower"] is not None


class TestNoFutureDataLeakage:
    """
    Every DataFrame returned by a client must have ALL timestamps ≤ now.
    This catches any accidental inclusion of future-dated data.
    """

    def test_binance_spot_klines_no_future_timestamps(self):
        with _patch_cached_fetch("binance_spot", _fake_klines_response(5)):
            from data_ingestion.binance_spot import get_klines
            df = get_klines(symbol="BTCUSDT", interval="1h", limit=5)

        now = datetime.now(timezone.utc)
        assert df.index.max() <= now, (
            f"Spot klines contain future timestamp: {df.index.max()} > {now}"
        )

    def test_binance_futures_klines_no_future_timestamps(self):
        with _patch_cached_fetch("binance_futures", _fake_klines_response(5)):
            from data_ingestion.binance_futures import get_klines
            df = get_klines(symbol="BTCUSDT", interval="1h", limit=5)

        now = datetime.now(timezone.utc)
        assert df.index.max() <= now, (
            f"Futures klines contain future timestamp: {df.index.max()} > {now}"
        )

    def test_funding_rate_no_future_timestamps(self):
        with _patch_cached_fetch("binance_futures", _fake_funding_response(3)):
            from data_ingestion.binance_futures import get_funding_rate
            df = get_funding_rate(symbol="BTCUSDT", limit=3)

        now = datetime.now(timezone.utc)
        assert df.index.max() <= now, (
            f"Funding rate contains future timestamp: {df.index.max()} > {now}"
        )

    def test_fear_greed_no_future_timestamps(self):
        with _patch_cached_fetch("fear_greed", _fake_fear_greed_response()):
            from data_ingestion.fear_greed import get_fear_greed_index
            df = get_fear_greed_index(limit=3)

        now = datetime.now(timezone.utc)
        assert df.index.max() <= now, (
            f"Fear & Greed contains future timestamp: {df.index.max()} > {now}"
        )

    def test_coingecko_chart_no_future_timestamps(self):
        with _patch_cached_fetch("coingecko", _fake_coingecko_chart_response()):
            from data_ingestion.coingecko import get_market_chart
            df = get_market_chart(coin_id="bitcoin", days=1)

        now = datetime.now(timezone.utc)
        assert df.index.max() <= now, (
            f"CoinGecko chart contains future timestamp: {df.index.max()} > {now}"
        )


# ===================================================================
# TEST GROUP 2: Gap detection
# ===================================================================

class TestGapDetection:
    """Clients must detect and flag gaps in time series data."""

    def test_spot_klines_detects_gaps(self):
        # Create klines with a gap at position 2 (skips 2 candles)
        klines = _fake_klines_response(5, gap_at=2)
        with _patch_cached_fetch("binance_spot", klines):
            from data_ingestion.binance_spot import get_klines
            df = get_klines(symbol="BTCUSDT", interval="1h", limit=5)

        gaps = df.attrs.get("gaps_detected", [])
        assert len(gaps) > 0, "Gap not detected in spot klines data"

    def test_spot_klines_no_gaps_when_continuous(self):
        klines = _fake_klines_response(5, gap_at=None)
        with _patch_cached_fetch("binance_spot", klines):
            from data_ingestion.binance_spot import get_klines
            df = get_klines(symbol="BTCUSDT", interval="1h", limit=5)

        gaps = df.attrs.get("gaps_detected", [])
        assert len(gaps) == 0, f"False positive gap detected: {gaps}"


# ===================================================================
# TEST GROUP 3: Schema validation
# ===================================================================

class TestSchemaValidation:
    """Verify returned DataFrames have expected columns and dtypes."""

    def test_spot_klines_schema(self):
        with _patch_cached_fetch("binance_spot", _fake_klines_response(3)):
            from data_ingestion.binance_spot import get_klines
            df = get_klines(symbol="BTCUSDT", interval="1h", limit=3)

        expected_cols = {"open", "high", "low", "close", "volume",
                         "close_time", "quote_volume", "trades",
                         "taker_buy_base", "taker_buy_quote"}
        assert expected_cols.issubset(set(df.columns)), (
            f"Missing columns: {expected_cols - set(df.columns)}"
        )
        assert df.index.name == "timestamp"
        assert df.index.tz is not None, "Index must be timezone-aware (UTC)"

    def test_funding_rate_schema(self):
        with _patch_cached_fetch("binance_futures", _fake_funding_response(3)):
            from data_ingestion.binance_futures import get_funding_rate
            df = get_funding_rate(symbol="BTCUSDT", limit=3)

        assert "funding_rate" in df.columns
        assert df.index.name == "timestamp"

    def test_long_short_ratio_schema(self):
        with _patch_cached_fetch("binance_futures", _fake_long_short_response(3)):
            from data_ingestion.binance_futures import get_long_short_ratio
            df = get_long_short_ratio(symbol="BTCUSDT", limit=3)

        expected_cols = {"long_short_ratio", "long_account", "short_account"}
        assert expected_cols.issubset(set(df.columns))
        assert df.index.name == "timestamp"

    def test_fear_greed_schema(self):
        with _patch_cached_fetch("fear_greed", _fake_fear_greed_response()):
            from data_ingestion.fear_greed import get_fear_greed_index
            df = get_fear_greed_index(limit=3)

        assert "value" in df.columns
        assert "classification" in df.columns
        assert df.index.name == "timestamp"
        # Values should be 0-100
        assert df["value"].between(0, 100).all()

    def test_fred_schema_with_missing_values(self):
        with _patch_cached_fetch("fred_macro", _fake_fred_response()):
            # Also need to mock the API key check
            with patch("data_ingestion.fred_macro.FRED_API_KEY", "fake_key"):
                from data_ingestion.fred_macro import get_series
                df = get_series("CPIAUCSL")

        assert "value" in df.columns
        assert df.index.name == "timestamp"
        # The "." value should be NaN, not interpolated
        assert df["value"].isna().sum() == 1, (
            "Missing FRED value (\".\") should be NaN, not interpolated"
        )

    def test_coingecko_chart_schema(self):
        with _patch_cached_fetch("coingecko", _fake_coingecko_chart_response()):
            from data_ingestion.coingecko import get_market_chart
            df = get_market_chart(coin_id="bitcoin", days=1)

        expected_cols = {"price", "market_cap", "total_volume"}
        assert expected_cols.issubset(set(df.columns))
        assert df.index.name == "timestamp"

    def test_coinalyze_uses_oi_close_and_usd_conversion(self):
        with _patch_cached_fetch("coinalyze", _fake_coinalyze_response()), \
             patch("data_ingestion.coinalyze.COINALYZE_API_KEY", "test-key"):
            from data_ingestion.coinalyze import get_coinalyze_data
            df = get_coinalyze_data()

        assert df.iloc[0]["open_interest"] == 110
        assert df.attrs["source"] == "coinalyze"


# ===================================================================
# TEST GROUP 4: Metadata
# ===================================================================

class TestMetadata:
    """Verify that all DataFrames carry source and fetch metadata."""

    def test_spot_klines_metadata(self):
        with _patch_cached_fetch("binance_spot", _fake_klines_response(3)):
            from data_ingestion.binance_spot import get_klines
            df = get_klines()

        assert df.attrs.get("source") == "binance_spot"
        assert "fetched_at" in df.attrs
        # fetched_at should be a valid ISO timestamp
        datetime.fromisoformat(df.attrs["fetched_at"])

    def test_fear_greed_metadata(self):
        with _patch_cached_fetch("fear_greed", _fake_fear_greed_response()):
            from data_ingestion.fear_greed import get_fear_greed_index
            df = get_fear_greed_index()

        assert df.attrs.get("source") == "alternative_me_fng"
        assert "fetched_at" in df.attrs


# ===================================================================
# TEST GROUP 5: Graceful degradation (missing API keys)
# ===================================================================

class TestGracefulDegradation:
    """Clients for keyed APIs must return empty DataFrames without crashing."""

    def test_fred_no_key_returns_empty(self):
        with patch("data_ingestion.fred_macro.FRED_API_KEY", ""):
            from data_ingestion.fred_macro import get_cpi
            df = get_cpi()

        assert df.empty
        assert df.attrs.get("source") == "fred"

    def test_currents_no_key_returns_empty(self):
        with patch("data_ingestion.news_currents.CURRENTS_API_KEY", ""):
            from data_ingestion.news_currents import get_news
            df = get_news()

        assert df.empty
        assert df.attrs.get("source") == "currents"

    def test_newsapi_no_key_returns_empty(self):
        with patch("data_ingestion.news_newsapi.NEWSAPI_KEY", ""):
            from data_ingestion.news_newsapi import search_news
            df = search_news()

        assert df.empty
        assert df.attrs.get("source") == "newsapi"


# ===================================================================
# TEST GROUP 6: Cache behavior
# ===================================================================

class TestCacheBehavior:
    """Verify the cache layer works as expected."""

    def test_cached_fetch_returns_cached_value_within_ttl(self):
        from data_ingestion.cache_utils import cached_fetch, _get_conn, DB_PATH

        call_count = 0

        def counting_fetch():
            nonlocal call_count
            call_count += 1
            return {"test": "data"}

        # Use a unique key so it doesn't collide with other tests
        test_key = f"test_cache_ttl_{time.time()}"

        # First call should invoke fetch
        result1 = cached_fetch(test_key, ttl_seconds=60, fetch_fn=counting_fetch)
        assert call_count == 1
        assert result1 == {"test": "data"}

        # Second call within TTL should return cached
        result2 = cached_fetch(test_key, ttl_seconds=60, fetch_fn=counting_fetch)
        assert call_count == 1, "fetch_fn was called again despite cache being fresh"
        assert result2 == {"test": "data"}

    def test_cached_fetch_refreshes_after_ttl(self):
        from data_ingestion.cache_utils import cached_fetch

        call_count = 0

        def counting_fetch():
            nonlocal call_count
            call_count += 1
            return {"version": call_count}

        test_key = f"test_cache_expire_{time.time()}"

        # First call
        result1 = cached_fetch(test_key, ttl_seconds=0.1, fetch_fn=counting_fetch)
        assert call_count == 1

        # Wait for TTL to expire
        time.sleep(0.2)

        # Should re-fetch
        result2 = cached_fetch(test_key, ttl_seconds=0.1, fetch_fn=counting_fetch)
        assert call_count == 2, "fetch_fn was not called after TTL expired"

    def test_cached_fetch_does_not_retry_client_errors(self, monkeypatch):
        from data_ingestion.cache_utils import cached_fetch

        calls = 0
        def bad_request():
            nonlocal calls
            calls += 1
            response = MagicMock(status_code=400)
            raise requests.HTTPError("bad request", response=response)

        monkeypatch.setattr("data_ingestion.cache_utils.time.sleep", lambda _: None)
        with pytest.raises(requests.HTTPError):
            cached_fetch(f"test_cache_400_{time.time()}", 60, bad_request)
        assert calls == 1


# ===================================================================
# TEST GROUP 7: Empty response handling
# ===================================================================

class TestEmptyResponses:
    """Clients must handle empty API responses without crashing."""

    def test_spot_klines_empty_response(self):
        with _patch_cached_fetch("binance_spot", []):
            from data_ingestion.binance_spot import get_klines
            df = get_klines()

        assert df.empty
        assert df.attrs.get("source") == "binance_spot"

    def test_fear_greed_empty_response(self):
        with _patch_cached_fetch("fear_greed", {"data": []}):
            from data_ingestion.fear_greed import get_fear_greed_index
            df = get_fear_greed_index()

        assert df.empty

    def test_order_book_empty_response(self):
        with _patch_cached_fetch("binance_spot", {"bids": [], "asks": []}):
            from data_ingestion.binance_spot import get_order_book
            df = get_order_book()

        assert df.empty
