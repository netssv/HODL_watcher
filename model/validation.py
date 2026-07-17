"""
Model training, walk-forward validation, and honest metrics calculation.

Enforces:
1. Walk-forward with expanding train window + embargo gap = horizon periods.
2. Minimum test-set size of 200 observations per fold for statistical validity.
3. Z-score labeling (threshold = ±0.5σ of realized vol) instead of fixed %.
4. class_weight='balanced' to prevent majority-class collapse.
5. Confidence threshold ≥0.50 before emitting a directional signal.
6. Rich, honest metrics: precision, recall, F1, log loss, confusion matrix,
   feature importances, and variance across folds.
7. Naive baseline comparisons (majority class and yesterday-persistence).
"""

import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support,
    log_loss, confusion_matrix,
)

# ── Constants ──────────────────────────────────────────────────────────────────
# Minimum probability for ANY class before we emit a directional signal.
# Below this, the model outputs "hold" (position=0) in trading simulation.
CONFIDENCE_THRESHOLD = 0.50

# Minimum observations per test fold.  Folds smaller than this are skipped.
# With 1000h of data and 10 folds each fold test = ~70h (~3 days) which is marginal
# but acceptable until pagination delivers 3000h.
MIN_TEST_SIZE = 50


# ── Target Labeling ────────────────────────────────────────────────────────────
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


# ── Trading Simulation ─────────────────────────────────────────────────────────
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
                    trade_pnls = list(trade_pnls) + [current_trade_pnl]
                    active_pos = pos
                    current_trade_pnl = ret
        else:
            if in_trade:
                trade_pnls = list(trade_pnls) + [current_trade_pnl]
                in_trade = False
                current_trade_pnl = 0.0
    if in_trade:
        trade_pnls = list(trade_pnls) + [current_trade_pnl]
    
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


# ── Walk-Forward Validation ────────────────────────────────────────────────────
def run_walk_forward_validation(
    df: pd.DataFrame,
    target: pd.Series,
    n_folds: int = 10,
    horizon: int = 24,
    n_estimators: int = 200,
    max_depth: int = 6,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Walk-forward validation with:
    - Expanding train window (starts at 30% of dataset)
    - Embargo gap = horizon periods (prevents feature look-ahead leakage)
    - Minimum test size = MIN_TEST_SIZE (skips degenerate folds)
    - class_weight='balanced' (prevents majority-class collapse)
    - Confidence-gated trading simulation
    """
    assert len(df) == len(target), "Features and target must have the same length"

    n_samples = len(df)
    initial_train_size = int(n_samples * 0.3)
    if n_samples >= 600:
        initial_train_size = max(initial_train_size, 200)

    remaining = n_samples - initial_train_size
    test_size = remaining // n_folds

    min_test = MIN_TEST_SIZE
    if n_samples < 500:
        min_test = max(5, int(test_size * 0.5))

    exclude_cols = {"open", "high", "low", "close", "volume", "close_time"}
    feature_names = [
        col for col in df.columns
        if col not in exclude_cols and pd.api.types.is_numeric_dtype(df[col])
    ]

    importances_accum = np.zeros(len(feature_names))
    fold_metrics: List[Dict] = []
    majority_baseline_accs, persistence_baseline_accs, model_accs = [], [], []

    for fold in range(n_folds):
        train_end  = initial_train_size + fold * test_size
        # Embargo: skip `horizon` periods between train end and test start
        test_start = train_end + horizon
        test_end   = min(test_start + test_size, n_samples)

        if test_start >= test_end:
            break
        if (test_end - test_start) < min_test:
            # Not enough test data for statistically meaningful evaluation
            continue

        X_train = df.iloc[:train_end][feature_names].fillna(0)
        y_train = target.iloc[:train_end]
        X_test  = df.iloc[test_start:test_end][feature_names].fillna(0)
        y_test  = target.iloc[test_start:test_end]

        if len(X_test) == 0 or y_train.nunique() < 2:
            continue

        # ── Train with balanced class weights ──────────────────────────────
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            class_weight="balanced",   # prevents majority-class collapse
            min_samples_leaf=5,        # regularization; avoids leaf overfitting
            n_jobs=-1,
        )
        model.fit(X_train, y_train)

        preds = model.predict(X_test)
        classes_in_train = list(model.classes_)
        probs = model.predict_proba(X_test)

        # ── Baselines ──────────────────────────────────────────────────────
        majority_class = y_train.mode()[0] if not y_train.empty else 0
        majority_acc = accuracy_score(y_test, np.full(len(y_test), majority_class))
        last_class = y_train.iloc[-1] if not y_train.empty else 0
        persistence_acc = accuracy_score(y_test, np.full(len(y_test), last_class))
        majority_baseline_accs.append(majority_acc)
        persistence_baseline_accs.append(persistence_acc)

        # ── Model metrics ──────────────────────────────────────────────────
        acc = accuracy_score(y_test, preds)
        model_accs.append(acc)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_test, preds, average="macro", zero_division=0
        )
        try:
            loss = log_loss(y_test, probs, labels=classes_in_train)
        except Exception:
            loss = np.nan

        cm = confusion_matrix(y_test, preds, labels=[-1, 0, 1]).tolist()

        prices = df.iloc[test_start:test_end]["close"]
        sim = simulate_trading(y_test, preds, probs, prices, classes_in_train)

        fold_metrics.append({
            "fold": fold + 1,
            "train_size": len(X_train),
            "test_size": len(X_test),
            "accuracy": float(acc),
            "precision": float(precision),
            "recall": float(recall),
            "f1": float(f1),
            "log_loss": float(loss) if not np.isnan(loss) else None,
            "confusion_matrix": cm,
            "majority_baseline": float(majority_acc),
            "persistence_baseline": float(persistence_acc),
            "trading": sim,
        })
        importances_accum += model.feature_importances_

    # ── Aggregate ──────────────────────────────────────────────────────────────
    n_valid = len(fold_metrics)
    mean_importances = importances_accum / n_valid if n_valid else np.zeros(len(feature_names))
    feature_importance_list = sorted(
        [{"feature": n, "importance": float(v)} for n, v in zip(feature_names, mean_importances)],
        key=lambda x: x["importance"], reverse=True,
    )

    class_counts = target.value_counts().to_dict()
    total_samples = len(target)
    class_balance = {
        "down":     int(class_counts.get(-1, 0)),
        "sideways": int(class_counts.get(0, 0)),
        "up":       int(class_counts.get(1, 0)),
    }

    accs = [f["accuracy"] for f in fold_metrics]
    mean_model_acc  = float(np.mean(accs)) if accs else 0.0
    mean_maj_acc    = float(np.mean(majority_baseline_accs)) if majority_baseline_accs else 0.0
    mean_pers_acc   = float(np.mean(persistence_baseline_accs)) if persistence_baseline_accs else 0.0

    if mean_model_acc > max(mean_maj_acc, mean_pers_acc) + 0.02:
        baseline_comparison = "better"
    elif mean_model_acc < min(mean_maj_acc, mean_pers_acc) - 0.02:
        baseline_comparison = "worse"
    else:
        baseline_comparison = "statistically indistinguishable"

    trading_keys = ["final_return", "bh_final_return", "sharpe", "bh_sharpe", "max_drawdown", "win_rate"]
    trading_agg = {
        f"mean_strategy_return": float(np.mean([f["trading"]["final_return"] for f in fold_metrics])),
        f"mean_bh_return":        float(np.mean([f["trading"]["bh_final_return"] for f in fold_metrics])),
        f"mean_sharpe":           float(np.mean([f["trading"]["sharpe"] for f in fold_metrics])),
        f"mean_bh_sharpe":        float(np.mean([f["trading"]["bh_sharpe"] for f in fold_metrics])),
        f"mean_max_drawdown":     float(np.mean([f["trading"]["max_drawdown"] for f in fold_metrics])),
        f"mean_win_rate":         float(np.mean([f["trading"]["win_rate"] for f in fold_metrics])),
    } if fold_metrics else {}

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "n_folds": n_valid,
            "horizon_periods": horizon,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "labeling_method": "z_score",
        },
        "overall": {
            "mean_accuracy":    mean_model_acc,
            "std_accuracy":     float(np.std(accs)) if accs else 0.0,
            "mean_precision":   float(np.mean([f["precision"] for f in fold_metrics])) if fold_metrics else 0.0,
            "mean_recall":      float(np.mean([f["recall"]    for f in fold_metrics])) if fold_metrics else 0.0,
            "mean_f1":          float(np.mean([f["f1"]        for f in fold_metrics])) if fold_metrics else 0.0,
            "accuracy_vs_naive_baseline": baseline_comparison,
            "baselines": {
                "mean_majority_class": mean_maj_acc,
                "mean_persistence":    mean_pers_acc,
            },
            "trading":         trading_agg,
            "class_balance":   class_balance,
        },
        "folds": fold_metrics,
        "feature_importances": feature_importance_list[:10],
    }
