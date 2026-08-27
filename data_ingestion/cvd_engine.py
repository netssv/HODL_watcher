"""
Cumulative Volume Delta (CVD) Engine for HODL Watcher.

Computes buy/sell volume imbalances and tracks institutional absorption
in Spot vs. Perpetual markets to detect early breakout divergences.
"""

from datetime import datetime, timezone
from typing import Dict, Any, Optional
import pandas as pd
import numpy as np
from .cache_utils import cached_fetch


def calculate_cvd(df: pd.DataFrame) -> pd.DataFrame:
    """
    Calculate Volume Delta and Cumulative Volume Delta (CVD) for a kline DataFrame.
    Expects 'volume' and 'taker_buy_base' columns.
    """
    if df is None or df.empty or "volume" not in df:
        return pd.DataFrame()

    out = df.copy()
    if "taker_buy_base" in out:
        taker_buy = pd.to_numeric(out["taker_buy_base"], errors="coerce").fillna(0)
    else:
        # Fallback estimation if taker_buy is missing: estimate 50%
        taker_buy = pd.to_numeric(out["volume"], errors="coerce").fillna(0) * 0.5

    volume = pd.to_numeric(out["volume"], errors="coerce").fillna(0)
    taker_sell = np.maximum(0, volume - taker_buy)

    out["vol_delta"] = taker_buy - taker_sell
    out["cvd"] = out["vol_delta"].cumsum()
    out["cvd_rolling_24"] = out["vol_delta"].rolling(window=24, min_periods=1).sum()
    return out


def detect_cvd_divergence(
    spot_df: pd.DataFrame,
    futures_df: Optional[pd.DataFrame] = None,
    lookback: int = 24
) -> Dict[str, Any]:
    """
    Detect CVD divergences between Spot absorption and Perpetual derivatives.
    
    A strong bullish divergence occurs when Spot CVD is trending UP (institutions buying)
    while Price is flat/down and Perpetual CVD is flat or negative.
    """
    if spot_df is None or spot_df.empty or len(spot_df) < lookback:
        return {
            "divergence_type": "none",
            "spot_cvd_delta": 0.0,
            "futures_cvd_delta": 0.0,
            "spot_absorption_score": 0.0,
            "signal": "neutral",
            "note": "Insufficient data for CVD analysis"
        }

    spot_with_cvd = calculate_cvd(spot_df)
    recent_spot = spot_with_cvd.iloc[-lookback:]
    
    price_start = float(recent_spot["close"].iloc[0])
    price_end = float(recent_spot["close"].iloc[-1])
    price_change_pct = (price_end - price_start) / max(price_start, 1e-6) * 100.0

    spot_cvd_start = float(recent_spot["cvd"].iloc[0])
    spot_cvd_end = float(recent_spot["cvd"].iloc[-1])
    spot_cvd_delta = spot_cvd_end - spot_cvd_start

    futures_cvd_delta = 0.0
    if futures_df is not None and not futures_df.empty and len(futures_df) >= lookback:
        fut_with_cvd = calculate_cvd(futures_df)
        recent_fut = fut_with_cvd.iloc[-lookback:]
        futures_cvd_start = float(recent_fut["cvd"].iloc[0])
        futures_cvd_end = float(recent_fut["cvd"].iloc[-1])
        futures_cvd_delta = futures_cvd_end - futures_cvd_start

    # Determine Divergence
    # Bullish Absorption: Price flat/down (-3% to +1%), but Spot CVD strongly positive (> 0)
    is_spot_accumulating = spot_cvd_delta > 0
    is_futures_shorting = futures_cvd_delta <= 0
    
    if price_change_pct <= 1.0 and is_spot_accumulating:
        if is_futures_shorting:
            divergence_type = "bullish_spot_absorption"
            score = 85.0
            signal = "strong_bullish"
            note = "Institutions aggressively buying spot while perps are flat/shorting."
        else:
            divergence_type = "moderate_spot_accumulation"
            score = 65.0
            signal = "bullish"
            note = "Spot buying volume outpacing price action."
    elif price_change_pct >= 3.0 and spot_cvd_delta < 0:
        divergence_type = "bearish_exhaustion"
        score = 25.0
        signal = "bearish"
        note = "Price rising on declining spot volume delta (exhaustion)."
    else:
        divergence_type = "neutral"
        score = 50.0
        signal = "neutral"
        note = "Spot and perpetual order flows are in equilibrium."

    return {
        "divergence_type": divergence_type,
        "price_change_pct_24h": round(price_change_pct, 2),
        "spot_cvd_delta": round(spot_cvd_delta, 2),
        "futures_cvd_delta": round(futures_cvd_delta, 2),
        "spot_absorption_score": score,
        "signal": signal,
        "note": note,
        "calculated_at": datetime.now(timezone.utc).isoformat()
    }
