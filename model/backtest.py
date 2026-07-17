"""
Trading backtester simulation with confidence thresholds and trade-level win rate metrics.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any

CONFIDENCE_THRESHOLD = 0.50

def simulate_trading(
    y_test: pd.Series,
    preds: np.ndarray,
    probs: np.ndarray,
    prices: pd.Series,
    classes: list,
    fee_pct: float = 0.001,
) -> Dict[str, Any]:
    """
    Simulate P&L equity curve applying CONFIDENCE_THRESHOLD gate.

    A position is only opened when the highest class probability exceeds
    CONFIDENCE_THRESHOLD; otherwise the model sits flat (position=0).
    fees: 0.1% per trade on position change.
    """
    max_prob = probs.max(axis=1)
    confident_mask = max_prob >= CONFIDENCE_THRESHOLD

    # Map class labels to position: +1=long, -1=short, 0=flat
    raw_positions = np.where(preds == 1, 1, np.where(preds == -1, -1, 0))
    positions = np.where(confident_mask, raw_positions, 0)

    returns = prices.pct_change().shift(-1).fillna(0)
    strat_returns = returns * positions

    pos_changes = np.abs(np.diff(np.insert(positions, 0, 0)))
    fees = pos_changes * fee_pct
    net_returns = strat_returns - fees

    equity_curve = (1 + net_returns).cumprod()
    bh_equity_curve = (1 + returns).cumprod()

    # Calculate trade-level win rate
    trade_pnls = []
    current_trade_pnl = 0.0
    in_trade = False
    active_pos = 0
    for i in range(len(positions)):
        pos = positions[i]
        ret = net_returns.iloc[i] if hasattr(net_returns, "iloc") else net_returns[i]
        if pos != 0:
            if not in_trade:
                in_trade = True
                active_pos = pos
                current_trade_pnl = ret
            else:
                if pos == active_pos:
                    current_trade_pnl += ret
                else:
                    trade_pnls.append(current_trade_pnl)
                    active_pos = pos
                    current_trade_pnl = ret
        else:
            if in_trade:
                trade_pnls.append(current_trade_pnl)
                in_trade = False
                current_trade_pnl = 0.0
    if in_trade:
        trade_pnls.append(current_trade_pnl)

    trade_pnls = np.array(trade_pnls)
    total_trades = len(trade_pnls)
    winning_trades = int(np.sum(trade_pnls > 0))
    win_rate = float(winning_trades / total_trades) if total_trades > 0 else 0.0

    roll_max = equity_curve.cummax()
    max_dd = float(((equity_curve - roll_max) / roll_max).min())

    mean_ret = net_returns.mean()
    std_ret = net_returns.std()
    sharpe = float((mean_ret / std_ret) * np.sqrt(8760)) if std_ret > 0 else 0.0

    bh_mean = returns.mean()
    bh_std = returns.std()
    bh_sharpe = float((bh_mean / bh_std) * np.sqrt(8760)) if bh_std > 0 else 0.0
    bh_roll_max = bh_equity_curve.cummax()
    bh_max_dd = float(((bh_equity_curve - bh_roll_max) / bh_roll_max).min())

    equity_points = [
        {"time": str(idx), "strategy": float(eq), "buy_hold": float(bh)}
        for idx, eq, bh in zip(equity_curve.index, equity_curve.values, bh_equity_curve.values)
    ]

    return {
        "final_return": float(equity_curve.iloc[-1] - 1) if len(equity_curve) > 0 else 0.0,
        "sharpe": sharpe,
        "max_drawdown": max_dd,
        "win_rate": float(win_rate),
        "total_trades": total_trades,
        "bh_final_return": float(bh_equity_curve.iloc[-1] - 1) if len(bh_equity_curve) > 0 else 0.0,
        "bh_sharpe": bh_sharpe,
        "bh_max_drawdown": bh_max_dd,
        "equity_curve": equity_points,
    }
