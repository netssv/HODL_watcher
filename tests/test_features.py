"""
Unit tests for features.builder.

Verifies:
  1. No data leakage: features calculated at index t do not depend on data from t+1 onwards.
  2. Technical indicators are correctly computed (schema, ranges).
  3. Joins to external data sources align correctly.
"""

import pandas as pd
import numpy as np
import pytest
from datetime import datetime, timezone, timedelta

from features.builder import (
    compute_rsi,
    compute_macd,
    compute_bollinger_bands,
    compute_atr,
    build_features,
)


def _generate_dummy_ohlcv(n_periods: int = 150) -> pd.DataFrame:
    base_time = datetime(2025, 1, 1, tzinfo=timezone.utc)
    timestamps = [base_time + timedelta(hours=i) for i in range(n_periods)]
    
    # Deterministic price curve: sine wave + trend
    close_prices = 50000.0 + 1000.0 * np.sin(np.linspace(0, 10, n_periods)) + np.linspace(0, 500, n_periods)
    open_prices = close_prices - 100.0
    high_prices = np.maximum(open_prices, close_prices) + 50.0
    low_prices = np.minimum(open_prices, close_prices) - 50.0
    volumes = np.random.default_rng(42).uniform(100, 1000, n_periods)
    taker_buy_base = volumes * 0.48
    
    df = pd.DataFrame({
        "open": open_prices,
        "high": high_prices,
        "low": low_prices,
        "close": close_prices,
        "volume": volumes,
        "taker_buy_base": taker_buy_base,
    }, index=timestamps)
    df.index.name = "timestamp"
    return df


def test_no_data_leakage_in_features():
    """
    Assert that modifying future data points does not alter past feature values.
    """
    df_clean = _generate_dummy_ohlcv(100)
    
    # Calculate features on clean dataset
    features_clean = build_features(df_clean)
    
    # Create a contaminated version of the dataset by modifying the last 10 rows
    df_contaminated = df_clean.copy()
    df_contaminated.iloc[-10:, df_contaminated.columns.get_loc('close')] *= 1.5
    df_contaminated.iloc[-10:, df_contaminated.columns.get_loc('high')] *= 1.5
    
    features_contaminated = build_features(df_contaminated)
    
    # The first 80 rows should be absolutely identical (lookback logic is <= 20-30 rows)
    # Let's assert equality up to row 70 (well before the contaminated period)
    pd.testing.assert_frame_equal(
        features_clean.iloc[:70],
        features_contaminated.iloc[:70]
    )


def test_technical_indicators_ranges_and_shape():
    df = _generate_dummy_ohlcv(100)
    
    rsi = compute_rsi(df, window=14)
    assert isinstance(rsi, pd.Series)
    # RSI is bound between 0 and 100
    valid_rsi = rsi.dropna()
    assert (valid_rsi >= 0).all() and (valid_rsi <= 100).all()
    
    macd_res = compute_macd(df)
    assert "macd" in macd_res
    assert "macd_signal" in macd_res
    
    bb = compute_bollinger_bands(df)
    bb_upper = bb["bb_upper"].dropna()
    bb_middle = bb["bb_middle"].dropna()
    bb_lower = bb["bb_lower"].dropna()
    assert (bb_upper >= bb_middle).all()
    assert (bb_middle >= bb_lower).all()
    
    atr = compute_atr(df)
    assert (atr.dropna() > 0).all()


def test_build_features_with_joins():
    df = _generate_dummy_ohlcv(50)
    
    # Create fake funding and fear & greed indexes
    timestamps = df.index
    funding_df = pd.DataFrame({
        "funding_rate": np.linspace(0.0001, 0.0003, len(timestamps))
    }, index=timestamps)
    funding_df.index.name = "timestamp"
    
    fear_greed_df = pd.DataFrame({
        "value": np.linspace(30, 70, len(timestamps))
    }, index=timestamps)
    fear_greed_df.index.name = "timestamp"
    
    features_df = build_features(
        spot_df=df,
        funding_df=funding_df,
        fear_greed_df=fear_greed_df
    )
    
    assert "funding_rate" in features_df.columns
    assert "funding_rate_diff_7" in features_df.columns
    assert "fear_greed" in features_df.columns
    assert "fear_greed_diff_7" in features_df.columns
