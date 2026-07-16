"""
Model training and walk-forward validation orchestrator.

Enforces:
1. Walk-forward validation with configurable folds (minimum 8-10).
2. Embargo/purge gap equal to horizon between train and test sets.
3. Honest metrics via validation_metrics.py.
4. Naive baseline comparisons via validation_metrics.compute_baselines().

Helper modules:
  validation_trading.py  — simulate_trading()
  validation_metrics.py  — feature selection, baselines, report builder
"""

import numpy as np
import pandas as pd
from typing import Any, Dict, List, Tuple

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score,
    precision_recall_fscore_support,
    log_loss,
    confusion_matrix,
)

from .validation_trading import simulate_trading
from .validation_metrics import (
    select_feature_names,
    compute_baselines,
    aggregate_importances,
    build_report,
)


# ── Target preparation ────────────────────────────────────────────────────────

def prepare_target(
    df: pd.DataFrame,
    horizon: int,
    threshold_pct: float = 0.005,
) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Generate target labels: 1 (up), -1 (down), 0 (sideways).

    Target: price change over the next `horizon` periods.
    Strictly forward-looking — uses shift(-horizon) so no lookahead leakage.
    """
    future_close = df["close"].shift(-horizon)
    price_change = (future_close - df["close"]) / df["close"]

    target = pd.Series(0, index=df.index)
    target[price_change > threshold_pct] = 1
    target[price_change < -threshold_pct] = -1

    valid_mask = price_change.notna()
    return df[valid_mask], target[valid_mask]


# ── Per-fold training ─────────────────────────────────────────────────────────

def _train_fold(
    df: pd.DataFrame,
    target: pd.Series,
    feature_names: List[str],
    train_end: int,
    test_start: int,
    test_end: int,
    n_estimators: int,
    max_depth: int,
    random_state: int,
    fold: int,
) -> Tuple[Dict[str, Any], np.ndarray, float, float]:
    """Train one walk-forward fold. Returns (metrics_dict, importances, maj_acc, pers_acc)."""
    X_train = df.iloc[:train_end][feature_names].fillna(0)
    y_train = target.iloc[:train_end]
    X_test = df.iloc[test_start:test_end][feature_names].fillna(0)
    y_test = target.iloc[test_start:test_end]

    model = RandomForestClassifier(
        n_estimators=n_estimators,
        max_depth=max_depth,
        random_state=random_state,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    preds = model.predict(X_test)
    probs = model.predict_proba(X_test)

    maj_acc, pers_acc = compute_baselines(y_train, y_test)
    acc = accuracy_score(y_test, preds)
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, preds, average="macro", zero_division=0
    )

    try:
        loss = float(log_loss(y_test, probs, labels=list(model.classes_)))
    except Exception:
        loss = None

    cm = confusion_matrix(y_test, preds, labels=[-1, 0, 1]).tolist()
    prices = df.iloc[test_start:test_end]["close"]

    fold_dict = {
        "fold": fold + 1,
        "train_size": len(X_train),
        "test_size": len(X_test),
        "accuracy": float(acc),
        "precision": float(precision),
        "recall": float(recall),
        "f1": float(f1),
        "log_loss": loss,
        "confusion_matrix": cm,
        "majority_baseline": maj_acc,
        "persistence_baseline": pers_acc,
        "trading": simulate_trading(y_test, preds, prices),
    }
    return fold_dict, model.feature_importances_, maj_acc, pers_acc


# ── Walk-forward orchestrator ─────────────────────────────────────────────────

def run_walk_forward_validation(
    df: pd.DataFrame,
    target: pd.Series,
    n_folds: int = 10,
    horizon: int = 24,
    n_estimators: int = 100,
    max_depth: int = 5,
    random_state: int = 42,
) -> Dict[str, Any]:
    """Execute walk-forward validation with expanding train window and embargo gap."""
    assert len(df) == len(target), "Features and target must have the same length"

    n_samples = len(df)
    initial_train_size = int(n_samples * 0.3)
    test_size = (n_samples - initial_train_size) // n_folds
    feature_names = select_feature_names(df)

    fold_metrics: List[Dict] = []
    maj_accs: List[float] = []
    pers_accs: List[float] = []
    importances_accum = np.zeros(len(feature_names))

    for fold in range(n_folds):
        train_end = initial_train_size + fold * test_size
        test_start = train_end + horizon          # embargo gap = horizon
        test_end = min(test_start + test_size, n_samples)

        if test_start >= test_end:
            break

        fold_dict, importances, maj_acc, pers_acc = _train_fold(
            df, target, feature_names,
            train_end, test_start, test_end,
            n_estimators, max_depth, random_state, fold,
        )
        fold_metrics.append(fold_dict)
        importances_accum += importances
        maj_accs.append(maj_acc)
        pers_accs.append(pers_acc)

    feature_list = aggregate_importances(
        importances_accum, feature_names, len(fold_metrics)
    )
    return build_report(fold_metrics, feature_list, target, horizon, maj_accs, pers_accs)
