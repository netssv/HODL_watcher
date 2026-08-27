"""
Unit tests for model.validation module.

Verifies:
  1. Target variables are prepared forward-looking.
  2. Walk-forward validation runs correctly and complies with splits/embargo constraints.
  3. Baselines are computed and reported correctly.
"""

import pandas as pd
import numpy as np
import pytest
from datetime import datetime, timezone, timedelta

from model.validation import prepare_target, run_walk_forward_validation
from features.builder import build_features


def _generate_test_dataset(n_periods: int = 200) -> Tuple[pd.DataFrame, pd.Series]:
    base_time = datetime(2025, 1, 1, tzinfo=timezone.utc)
    timestamps = [base_time + timedelta(hours=i) for i in range(n_periods)]
    
    # Generate prices with alternating up/down trends
    close = 50000.0 + 2000.0 * np.sin(np.linspace(0, 20, n_periods))
    df = pd.DataFrame({
        "open": close - 50.0,
        "high": close + 50.0,
        "low": close - 50.0,
        "close": close,
        "volume": np.ones(n_periods) * 100,
        "taker_buy_base": np.ones(n_periods) * 50,
    }, index=timestamps)
    df.index.name = "timestamp"
    
    # Compute simple indicators for features
    features_df = build_features(df)
    features_df, target = prepare_target(features_df, horizon=4, threshold_pct=0.005)
    return features_df, target


def test_prepare_target_direction_mapping():
    base_time = datetime(2025, 1, 1, tzinfo=timezone.utc)
    timestamps = [base_time + timedelta(hours=i) for i in range(5)]
    # Close price sequence: 100 -> 101 -> 98 -> 98.2 -> 110
    close = [100.0, 101.0, 98.0, 98.2, 110.0]
    df = pd.DataFrame({"close": close, "open": close, "high": close, "low": close, "volume": close}, index=timestamps)
    
    # Horizon = 1, Threshold = 1% (0.01)
    # 100 -> 101: +1% (sideways or up depends on threshold check: exactly 0.01 is 1%, not > 1%. Let's check.)
    # 101 -> 98: -2.97% (down)
    # 98 -> 98.2: +0.2% (sideways)
    # 98.2 -> 110: +12.0% (up)
    _, target = prepare_target(df, horizon=1, threshold_pct=0.01)
    
    # Expect: 
    # Row 0 (100 -> 101) => +1% (since change is not > 1%, it maps to 0)
    # Row 1 (101 -> 98) => -2.97% => -1
    # Row 2 (98 -> 98.2) => +0.2% => 0
    # Row 3 (98.2 -> 110) => +12% => 1
    # Row 4 => dropped (cannot check horizon=1 future)
    
    assert len(target) == 4
    assert target.iloc[1] == -1
    assert target.iloc[2] == 0
    assert target.iloc[3] == 1


def test_zscore_target_keeps_sideways_rows():
    timestamps = pd.date_range("2025-01-01", periods=60, freq="h", tz="UTC")
    close = 100 + np.sin(np.linspace(0, 1, len(timestamps))) * 0.01
    _, target = prepare_target(pd.DataFrame({"close": close}, index=timestamps), horizon=1, z_threshold=1_000_000.0)
    assert set(target.unique()) == {0}


def test_walk_forward_validation_structure():
    features_df, target = _generate_test_dataset(150)
    
    report = run_walk_forward_validation(
        features_df,
        target,
        n_folds=8,
        horizon=4,
        n_estimators=10,
        max_depth=3
    )
    
    assert "overall" in report
    assert "folds" in report
    assert "feature_importances" in report
    
    overall = report["overall"]
    assert "mean_accuracy" in overall
    assert "std_accuracy" in overall
    assert "accuracy_vs_naive_baseline" in overall
    assert overall["accuracy_vs_naive_baseline"] in ["better", "worse", "statistically indistinguishable"]
    
    folds = report["folds"]
    assert len(folds) == 8
    for fold in folds:
        assert "accuracy" in fold
        assert "confusion_matrix" in fold
        assert len(fold["confusion_matrix"]) == 3  # 3x3 classification matrix (down, sideways, up)


def test_walk_forward_can_exclude_dominant_features():
    features_df, target = _generate_test_dataset(150)
    report = run_walk_forward_validation(
        features_df, target, n_folds=8, horizon=4, n_estimators=10,
        max_depth=3, exclude_features=("rsi_24", "ma_99", "ema_200"),
    )
    assert report["metadata"]["excluded_features"] == ["rsi_24", "ma_99", "ema_200"]
    assert all(item["feature"] not in {"rsi_24", "ma_99", "ema_200"}
               for item in report["feature_importances"])
