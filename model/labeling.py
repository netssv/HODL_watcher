"""
Target preparation and Z-score volatility-normalized labeling.
"""

import numpy as np
import pandas as pd
from typing import Tuple

def prepare_target(
    df: pd.DataFrame,
    horizon: int,
    threshold_pct: float = 0.005,
    vol_window: int = 24,
    z_threshold: float = 0.5,
    use_zscore: bool = True,
) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Generate target labels: 1 (up), -1 (down), 0 (sideways).
    If use_zscore is True and len(df) >= vol_window * 2:
        z-score labeling: return / rolling realized vol.
    Else:
        Fixed percentage threshold.
    """
    future_close = df["close"].shift(-horizon)
    price_change = (future_close - df["close"]) / df["close"]

    if use_zscore and len(df) >= vol_window * 2:
        # Volatility must be known at row t: use historical close-to-close
        # returns, never the future return used to create the label.
        historical_return = df["close"].pct_change()
        realized_vol = historical_return.rolling(
            vol_window, center=False, min_periods=vol_window
        ).std().replace(0, np.nan)
        z_return = price_change / realized_vol
        target = pd.Series(np.nan, index=df.index, dtype=float)
        target[z_return > z_threshold] = 1
        target[z_return < -z_threshold] = -1
        valid_mask = price_change.notna() & target.notna()
        return df[valid_mask], target[valid_mask].astype(int)
    else:
        target = pd.Series(0, index=df.index, dtype=int)
        target[price_change > threshold_pct] = 1
        target[price_change < -threshold_pct] = -1

    valid_mask = price_change.notna()
    return df[valid_mask], target[valid_mask]
