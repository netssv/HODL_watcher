"""
Unit tests for FastAPI routes.
"""

from fastapi.testclient import TestClient
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from datetime import datetime, timezone

from api.app import app


client = TestClient(app)


def _mock_spot_klines():
    timestamps = pd.to_datetime(["2025-01-01 00:00:00", "2025-01-01 01:00:00", "2025-01-01 02:00:00"], utc=True)
    df = pd.DataFrame({
        "open": [50000.0, 50100.0, 50200.0],
        "high": [50200.0, 50300.0, 50400.0],
        "low": [49900.0, 50000.0, 50100.0],
        "close": [50100.0, 50200.0, 50300.0],
        "volume": [100.0, 150.0, 200.0],
        "taker_buy_base": [48.0, 72.0, 96.0],
        "trades": [100, 150, 200]
    }, index=timestamps)
    df.index.name = "timestamp"
    df.attrs = {"source": "binance_spot", "gaps_detected": []}
    return df


@patch("data_ingestion.binance_spot.get_klines")
def test_get_raw_data_endpoint(mock_get_klines):
    mock_get_klines.return_value = _mock_spot_klines()
    
    response = client.get("/api/data/BTCUSDT?interval=1h&limit=3")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["symbol"] == "BTCUSDT"
    assert len(json_data["data"]) == 3
    assert json_data["data"][0]["close"] == 50100.0


@patch("api.routes.fetch_all_sources")
def test_calculate_features_endpoint(mock_fetch):
    # Mock return values for fetch all sources
    mock_fetch.return_value = (
        {
            "spot_df": _mock_spot_klines(),
            "futures_df": None,
            "funding_df": None,
            "long_short_df": None,
            "fear_greed_df": None,
            "macro_dfs": {},
            "order_book_df": None,
            "coinalyze_df": None,
            "deribit_df": None,
            "onchain_df": None,
            "etf_df": None
        },
        ["some_warning"]
    )
    
    response = client.post(
        "/api/features",
        json={
            "symbol": "BTCUSDT",
            "interval": "1h",
            "limit": 500,
            "features_config": {"include_derivatives": False}
        }
    )
    assert response.status_code == 200
    json_data = response.json()
    assert "columns" in json_data
    assert "rsi_6" in json_data["columns"]
    assert "data_gaps" in json_data
    assert json_data["data_gaps"] == ["some_warning"]


@patch("api.routes.fetch_all_sources")
def test_train_model_insufficient_samples(mock_fetch):
    mock_fetch.return_value = (
        {
            "spot_df": _mock_spot_klines(),  # Only 3 samples, will fail train rule
            "futures_df": None,
            "funding_df": None,
            "long_short_df": None,
            "fear_greed_df": None,
            "macro_dfs": {},
            "order_book_df": None,
            "coinalyze_df": None,
            "deribit_df": None,
            "onchain_df": None,
            "etf_df": None
        },
        []
    )
    
    response = client.post(
        "/api/train",
        json={"horizon_hours": 1, "n_folds": 5, "threshold_pct": 0.005}
    )
    assert response.status_code == 400
    assert "Insufficient training samples" in response.json()["detail"]


def test_news_instructions_endpoint():
    response = client.get("/api/news-instructions")
    assert response.status_code == 200
    assert "keywords_to_search" in response.json()
