"""
Feature engineering indicators for BTC/USDT.
"""

import pandas as pd
import numpy as np
from typing import Dict

def compute_market_regime(df: pd.DataFrame, window: int = 14) -> pd.Series:
    """
    Classify market regime using ATR and price bounds.
    Returns: 1 (trending up), -1 (trending down), 0 (ranging/volatile)
    """
    atr = compute_atr(df, window)
    ma_short = df['close'].rolling(window=window, center=False).mean()
    ma_long = df['close'].rolling(window=window*3, center=False).mean()
    
    # Simple logic: distance between short/long MA normalized by ATR
    trend_strength = (ma_short - ma_long) / (atr + 1e-9)
    
    regime = pd.Series(0, index=df.index)
    regime[trend_strength > 1.0] = 1   # Trending Up
    regime[trend_strength < -1.0] = -1 # Trending Down
    return regime


def compute_adx(df: pd.DataFrame, window: int = 14) -> pd.Series:
    """Compute ADX from prior/current candles; lookback window: 2 * window."""
    up_move = df['high'].diff()
    down_move = -df['low'].diff()
    plus_dm = up_move.where((up_move > down_move) & (up_move > 0), 0.0)
    minus_dm = down_move.where((down_move > up_move) & (down_move > 0), 0.0)
    tr = pd.concat([
        df['high'] - df['low'],
        (df['high'] - df['close'].shift()).abs(),
        (df['low'] - df['close'].shift()).abs(),
    ], axis=1).max(axis=1)
    atr = tr.rolling(window, center=False).mean().replace(0, np.nan)
    plus_di = 100 * plus_dm.rolling(window, center=False).mean() / atr
    minus_di = 100 * minus_dm.rolling(window, center=False).mean() / atr
    dx = 100 * (plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, np.nan)
    return dx.rolling(window, center=False).mean()

def compute_rsi(df: pd.DataFrame, window: int) -> pd.Series:
    """
    Compute relative strength index (RSI).
    Lookback window: window + 1 periods.
    """
    delta = df['close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window, center=False).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window, center=False).mean()
    rs = gain / (loss + 1e-9)
    return 100 - (100 / (1 + rs))


def compute_macd(df: pd.DataFrame, fast_window: int = 12, slow_window: int = 26, signal_window: int = 9) -> Dict[str, pd.Series]:
    """
    Compute MACD line and signal line.
    Lookback window: slow_window + signal_window periods.
    """
    fast_ema = df['close'].ewm(span=fast_window, adjust=False).mean()
    slow_ema = df['close'].ewm(span=slow_window, adjust=False).mean()
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal_window, adjust=False).mean()
    return {
        "macd": macd_line,
        "macd_signal": signal_line
    }


def compute_bollinger_bands(df: pd.DataFrame, window: int = 20, num_std: float = 2.0) -> Dict[str, pd.Series]:
    """
    Compute Bollinger Bands (middle, upper, lower).
    Lookback window: window periods.
    """
    rolling_mean = df['close'].rolling(window=window, center=False).mean()
    rolling_std = df['close'].rolling(window=window, center=False).std()
    return {
        "bb_middle": rolling_mean,
        "bb_upper": rolling_mean + (num_std * rolling_std),
        "bb_lower": rolling_mean - (num_std * rolling_std)
    }


def compute_atr(df: pd.DataFrame, window: int = 14) -> pd.Series:
    """
    Compute Average True Range (ATR).
    Lookback window: window + 1 periods.
    """
    high_low = df['high'] - df['low']
    high_close = (df['high'] - df['close'].shift(1)).abs()
    low_close = (df['low'] - df['close'].shift(1)).abs()
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)
    return true_range.rolling(window=window, center=False).mean()


def compute_vwap(df: pd.DataFrame, window: int = 24) -> pd.Series:
    """
    Compute rolling Volume Weighted Average Price (VWAP).
    Lookback window: window periods.
    """
    pv = (df['close'] * df['volume']).rolling(window=window, center=False).sum()
    v = df['volume'].rolling(window=window, center=False).sum()
    return pv / (v + 1e-9)


def compute_realized_volatility(df: pd.DataFrame, window: int = 24) -> pd.Series:
    """
    Compute annualized realized volatility from log returns.
    Lookback window: window + 1 periods.
    """
    log_ret = pd.Series(np.log(df['close'] / (df['close'].shift(1) + 1e-9)), index=df.index)
    # Annualized multiplier for hourly data = sqrt(365 * 24) = sqrt(8760)
    return log_ret.rolling(window=window, center=False).std() * np.sqrt(8760)


def compute_iv_rank(dvol_series: pd.Series, window: int = 720) -> pd.Series:
    """
    Compute Implied Volatility (IV) Rank over a rolling window.
    Lookback window: window periods.
    """
    rolling_min = dvol_series.rolling(window=window, min_periods=min(24, window), center=False).min()
    rolling_max = dvol_series.rolling(window=window, min_periods=min(24, window), center=False).max()
    denom = rolling_max - rolling_min
    return (dvol_series - rolling_min) / (denom + 1e-9) * 100
