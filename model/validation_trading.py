"""
Trading simulation helper for walk-forward validation.
"""

import numpy as np
import pandas as pd
from typing import Any, Dict


def simulate_trading(
    y_test: pd.Series,
    preds: np.ndarray,
    prices: pd.Series,
    fee_pct: float = 0.001,
) -> Dict[str, Any]:
    """
    Simulate trading P&L equity curve.
    preds: 1 (long), -1 (short), 0 (flat)
    fees:  0.1% per trade (entry and exit)
    """
    returns = prices.pct_change().shift(-1).fillna(0)
    strat_returns = returns * preds

    pos_changes = np.abs(np.diff(np.insert(preds, 0, 0)))
    fees = pos_changes * fee_pct
    net_returns = strat_returns - fees

    equity_curve = (1 + net_returns).cumprod()
    bh_equity_curve = (1 + returns).cumprod()

    total_trades = int(np.sum(pos_changes > 0))
    winning_trades = np.sum(net_returns > 0)
    win_rate = float(winning_trades / total_trades) if total_trades > 0 else 0.0

    def _sharpe(r: pd.Series) -> float:
        mu, sigma = r.mean(), r.std()
        return float((mu / sigma) * np.sqrt(8760)) if sigma > 0 else 0.0

    def _max_dd(curve: pd.Series) -> float:
        roll_max = curve.cummax()
        return float(((curve - roll_max) / roll_max).min())

    equity_points = [
        {"time": str(idx), "strategy": float(eq), "buy_hold": float(bh)}
        for idx, eq, bh in zip(
            equity_curve.index, equity_curve.values, bh_equity_curve.values
        )
    ]

    final = float(equity_curve.iloc[-1] - 1) if len(equity_curve) > 0 else 0.0
    bh_final = float(bh_equity_curve.iloc[-1] - 1) if len(bh_equity_curve) > 0 else 0.0

    return {
        "final_return": final,
        "sharpe": _sharpe(net_returns),
        "max_drawdown": _max_dd(equity_curve),
        "win_rate": win_rate,
        "total_trades": total_trades,
        "bh_final_return": bh_final,
        "bh_sharpe": _sharpe(returns),
        "bh_max_drawdown": _max_dd(bh_equity_curve),
        "equity_curve": equity_points,
    }
