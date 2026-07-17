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

    target = pd.Series(0, index=df.index, dtype=int)

    if use_zscore and len(df) >= vol_window * 2:
        # Realized vol over the last vol_window periods (backward-looking only)
        realized_vol = price_change.rolling(vol_window, center=False, min_periods=max(1, vol_window // 2)).std()
        realized_vol = realized_vol.replace(0, np.nan).ffill().fillna(price_change.std())
        z_return = price_change / realized_vol
        target[z_return >  z_threshold] =  1
        target[z_return < -z_threshold] = -1
    else:
        target[price_change > threshold_pct] = 1
        target[price_change < -threshold_pct] = -1

    valid_mask = price_change.notna()
    return df[valid_mask], target[valid_mask]
