"""
Feature engineering functions for BTC/USDT.

Rules:
1. Every function declares its lookback window in the docstring.
2. All rolling computations use center=False (default) to prevent data leakage.
3. Joins must use merge_asof with direction='backward' to avoid future lookahead.
"""

import pandas as pd
import numpy as np
from typing import Dict, Any
from features.indicators import (
    compute_market_regime,
    compute_rsi,
    compute_macd,
    compute_bollinger_bands,
    compute_atr,
    compute_vwap,
    compute_realized_volatility,
    compute_iv_rank
)

def build_features(
    spot_df: pd.DataFrame,
    futures_df: pd.DataFrame = None,
    funding_df: pd.DataFrame = None,
    long_short_df: pd.DataFrame = None,
    fear_greed_df: pd.DataFrame = None,
    macro_dfs: Dict[str, pd.DataFrame] = None,
    order_book_df: pd.DataFrame = None,
    coinalyze_df: pd.DataFrame = None,
    deribit_df: pd.DataFrame = None,
    onchain_df: pd.DataFrame = None,
    etf_df: pd.DataFrame = None,
    hyperliquid_df: pd.DataFrame = None,
) -> pd.DataFrame:
    """
    Build complete feature matrix aligning timestamps chronologically.
    """
    # Use spot price as the core time series index
    df = spot_df.copy()
    
    # 1. Technical Indicators
    df['rsi_6'] = compute_rsi(df, 6)
    df['rsi_12'] = compute_rsi(df, 12)
    df['rsi_24'] = compute_rsi(df, 24)
    
    macd_res = compute_macd(df)
    df['macd'] = macd_res['macd']
    df['macd_signal'] = macd_res['macd_signal']
    
    bb_res = compute_bollinger_bands(df)
    df['bb_upper'] = bb_res['bb_upper']
    df['bb_lower'] = bb_res['bb_lower']
    
    df['ma_7'] = df['close'].rolling(window=7, center=False).mean()
    df['ma_25'] = df['close'].rolling(window=25, center=False).mean()
    df['ma_99'] = df['close'].rolling(window=99, center=False).mean()
    
    df['atr'] = compute_atr(df)
    
    # Distance to MAs
    df['dist_ma_7'] = (df['close'] - df['ma_7']) / df['ma_7']
    df['dist_ma_25'] = (df['close'] - df['ma_25']) / df['ma_25']
    df['dist_ma_99'] = (df['close'] - df['ma_99']) / df['ma_99']

    # Regime & Multi-timeframe proxies
    df['market_regime'] = compute_market_regime(df)
    # 4h proxy (close vs close 4 periods ago if hourly)
    df['momentum_4h'] = df['close'] / df['close'].shift(4) - 1
    df['momentum_24h'] = df['close'] / df['close'].shift(24) - 1

    # 2. Volume relative to MA
    df['vol_ma_20'] = df['volume'].rolling(window=20, center=False).mean()
    df['relative_volume'] = df['volume'] / (df['vol_ma_20'] + 1e-9)
    df['taker_buy_sell_ratio'] = df['taker_buy_base'] / (df['volume'] - df['taker_buy_base'] + 1e-9)

    # Phase 1 — local calculations (no future leak; all rolling backward)
    df['vwap_24'] = compute_vwap(df, window=24)
    df['realized_vol_24'] = compute_realized_volatility(df, window=24)
    df['realized_vol_4'] = compute_realized_volatility(df, window=4)
    # Volume Delta = taker buy volume − taker sell volume (per candle)
    df['volume_delta'] = df['taker_buy_base'] - (df['volume'] - df['taker_buy_base'])
    # Cumulative Volume Delta: rolling 24-candle net taker flow
    df['cvd_24'] = df['volume_delta'].rolling(window=24, center=False).sum()
    # CVD z-score: anomalous buy/sell pressure vs recent history
    cvd_mean = df['cvd_24'].rolling(48, center=False).mean()
    cvd_std  = df['cvd_24'].rolling(48, center=False).std().replace(0, np.nan)
    df['cvd_zscore'] = (df['cvd_24'] - cvd_mean) / cvd_std
    # Volatility regime: ratio of short-term to long-term realized vol
    # <0.7 = compression (breakout likely), >1.5 = already moved (reversal risk)
    df['rv_ratio'] = df['realized_vol_4'] / (df['realized_vol_24'] + 1e-9)

    # Convert index to a column to allow merge_asof
    df = df.reset_index()
    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True).dt.as_unit('ns')

    # 3. Join Derivatives (Binance Futures)
    if funding_df is not None and not funding_df.empty:
        funding_sorted = funding_df.reset_index().sort_values('timestamp')
        funding_sorted['timestamp'] = pd.to_datetime(funding_sorted['timestamp'], utc=True).dt.as_unit('ns')
        df = pd.merge_asof(
            df.sort_values('timestamp'),
            funding_sorted,
            on='timestamp',
            direction='backward'
        )
        df['funding_available'] = (~df['funding_rate'].isna()).astype(int)
        df['funding_rate'] = df['funding_rate'].ffill().fillna(0)
        # Velocity of funding change: captures sentiment shift, not just level
        df['funding_rate_delta_8h'] = df['funding_rate'].diff(8)
        df['funding_rate_diff_7'] = df['funding_rate'].diff(7)
        
    if long_short_df is not None and not long_short_df.empty:
        ls_sorted = long_short_df.reset_index().sort_values('timestamp')
        ls_sorted['timestamp'] = pd.to_datetime(ls_sorted['timestamp'], utc=True).dt.as_unit('ns')
        df = pd.merge_asof(
            df.sort_values('timestamp'),
            ls_sorted,
            on='timestamp',
            direction='backward'
        )
        df['long_short_ratio_diff_7'] = df['long_short_ratio'].diff(7)

    # Futures Basis: (perp price − spot price) / spot price
    if futures_df is not None and not futures_df.empty:
        fut_sorted = futures_df[['close']].rename(columns={'close': 'futures_close'}).reset_index().sort_values('timestamp')
        fut_sorted['timestamp'] = pd.to_datetime(fut_sorted['timestamp'], utc=True).dt.as_unit('ns')
        df = pd.merge_asof(
            df.sort_values('timestamp'),
            fut_sorted,
            on='timestamp',
            direction='backward'
        )
        df['futures_basis'] = (df['futures_close'] - df['close']) / (df['close'] + 1e-9)
        # Basis z-score: abnormal futures premium/discount vs 48h history
        basis_mean = df['futures_basis'].rolling(48, center=False).mean()
        basis_std  = df['futures_basis'].rolling(48, center=False).std().replace(0, np.nan)
        df['basis_zscore'] = (df['futures_basis'] - basis_mean) / basis_std

    # 4. Join Fear & Greed Index
    if fear_greed_df is not None and not fear_greed_df.empty:
        fg_sorted = fear_greed_df.reset_index().sort_values('timestamp')
        fg_sorted['timestamp'] = pd.to_datetime(fg_sorted['timestamp'], utc=True).dt.as_unit('ns')
        df = pd.merge_asof(
            df.sort_values('timestamp'),
            fg_sorted[['timestamp', 'value']],
            on='timestamp',
            direction='backward'
        )
        df.rename(columns={'value': 'fear_greed'}, inplace=True)
        df['fear_greed_diff_7'] = df['fear_greed'].diff(7)

    # 5. Join Macro indicators
    if macro_dfs:
        for name, macro_df in macro_dfs.items():
            if macro_df is not None and not macro_df.empty:
                macro_sorted = macro_df.reset_index().sort_values('timestamp')
                macro_sorted['timestamp'] = pd.to_datetime(macro_sorted['timestamp'], utc=True).dt.as_unit('ns')
                df = pd.merge_asof(
                    df.sort_values('timestamp'),
                    macro_sorted[['timestamp', 'value']],
                    on='timestamp',
                    direction='backward'
                )
                df.rename(columns={'value': f'macro_{name}'}, inplace=True)

    # 6. Join order book features (distance to large bids/asks & imbalance)
    if order_book_df is not None and not order_book_df.empty:
        bids = order_book_df[order_book_df['side'] == 'bid']
        asks = order_book_df[order_book_df['side'] == 'ask']
        
        best_bid = bids['price'].max() if not bids.empty else np.nan
        best_ask = asks['price'].min() if not asks.empty else np.nan
        
        df['dist_best_bid'] = (df['close'] - best_bid) / (best_bid + 1e-9)
        df['dist_best_ask'] = (best_ask - df['close']) / (df['close'] + 1e-9)

        # Multi-level imbalance: volume of top 10 bids vs top 10 asks
        top_10_bid_vol = bids.nlargest(10, 'price')['quantity'].sum() if not bids.empty else 0
        top_10_ask_vol = asks.nsmallest(10, 'price')['quantity'].sum() if not asks.empty else 0
        df['ob_imbalance_10'] = (top_10_bid_vol - top_10_ask_vol) / (top_10_bid_vol + top_10_ask_vol + 1e-9)
        
        # We can expand to 50 levels
        top_50_bid_vol = bids.nlargest(50, 'price')['quantity'].sum() if not bids.empty else 0
        top_50_ask_vol = asks.nsmallest(50, 'price')['quantity'].sum() if not asks.empty else 0
        df['ob_imbalance_50'] = (top_50_bid_vol - top_50_ask_vol) / (top_50_bid_vol + top_50_ask_vol + 1e-9)
        # Proximity to support/resistance: % distance from current price to best bid/ask
        if best_bid and not np.isnan(best_bid):
            df['ob_pressure'] = (df['close'] - best_bid) / (df['close'] + 1e-9)

    # 7. Join Coinalyze, Deribit, Onchain, ETF, Hyperliquid
    for name, extra_df in [('coinalyze', coinalyze_df), ('deribit', deribit_df), ('onchain', onchain_df), ('etf', etf_df), ('hyperliquid', hyperliquid_df)]:
        if extra_df is not None and not extra_df.empty:
            extra_sorted = extra_df.reset_index().sort_values('timestamp')
            extra_sorted['timestamp'] = pd.to_datetime(extra_sorted['timestamp'], utc=True).dt.as_unit('ns')
            df = pd.merge_asof(
                df.sort_values('timestamp'),
                extra_sorted,
                on='timestamp',
                direction='backward'
            )

    # IV Rank: computed over the merged dvol column if Deribit data was joined
    if 'dvol' in df.columns:
        df['iv_rank'] = compute_iv_rank(df['dvol'], window=720)

    df.set_index('timestamp', inplace=True)
    return df
