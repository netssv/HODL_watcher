import pandas as pd
import numpy as np
from data_ingestion.cvd_engine import calculate_cvd, detect_cvd_divergence
from features.squeeze_indicators import compute_squeeze_probability
from data_ingestion.cycle_metrics import fetch_cycle_metrics


def test_calculate_cvd():
    # Mock spot dataframe
    df = pd.DataFrame({
        "open": [60000, 60100, 60200],
        "close": [60100, 60200, 60300],
        "volume": [100.0, 150.0, 200.0],
        "taker_buy_base": [60.0, 90.0, 120.0]
    })
    res = calculate_cvd(df)
    assert "vol_delta" in res.columns
    assert "cvd" in res.columns
    # Row 0: taker_buy=60, sell=40 -> delta=+20, cvd=20
    assert res["vol_delta"].iloc[0] == 20.0
    assert res["cvd"].iloc[0] == 20.0
    # Row 1: taker_buy=90, sell=60 -> delta=+30, cvd=50
    assert res["cvd"].iloc[1] == 50.0


def test_detect_cvd_divergence():
    # Create 30 hourly candles with flat price but rising spot CVD
    dates = pd.date_range("2026-01-01", periods=30, freq="1h")
    spot_df = pd.DataFrame({
        "close": [63000.0] * 30,
        "volume": [100.0] * 30,
        "taker_buy_base": [80.0] * 30  # Persistent heavy taker buying
    }, index=dates)

    futures_df = pd.DataFrame({
        "close": [63000.0] * 30,
        "volume": [100.0] * 30,
        "taker_buy_base": [40.0] * 30  # Heavy taker selling on perps
    }, index=dates)

    div = detect_cvd_divergence(spot_df, futures_df, lookback=24)
    assert div["divergence_type"] in ["bullish_spot_absorption", "moderate_spot_accumulation"]
    assert div["spot_cvd_delta"] > 0
    assert div["futures_cvd_delta"] < 0
    assert div["spot_absorption_score"] >= 65.0


def test_compute_squeeze_probability():
    # Negative funding + low LSR = high short squeeze risk
    squeeze = compute_squeeze_probability(
        funding_rate=-0.0003,  # Negative funding (-0.03%)
        long_short_ratio=0.75,  # Heavily short-skewed
        realized_vol_24=0.012,  # Compressed volatility
        price=63000.0,
        liq_clusters=[{"price": 66000.0, "notionalUSD": 50000000}]
    )
    assert squeeze["squeeze_probability_score"] >= 70.0
    assert squeeze["alert_level"] in ["HIGH", "EXTREME"]
    assert squeeze["upper_liquidation_magnet_usd"] == 66000.0


def test_cycle_metrics():
    cycle = fetch_cycle_metrics(current_price=68000.0)
    assert "mvrv_ratio" in cycle
    assert "cycle_phase" in cycle
    assert "realized_price_usd" in cycle
    assert cycle["mvrv_ratio"] > 0
