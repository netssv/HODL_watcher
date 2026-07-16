"""
Pure metric helpers for walk-forward validation.
Stateless functions — no sklearn/model imports needed here.
"""

import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Any, Dict, List, Tuple

from sklearn.metrics import accuracy_score

_EXCLUDE_COLS = {"open", "high", "low", "close", "volume", "close_time"}


# ── Feature selection ─────────────────────────────────────────────────────────

def select_feature_names(df: pd.DataFrame) -> List[str]:
    """Return numeric columns that are not raw OHLCV fields."""
    return [
        col for col in df.columns
        if col not in _EXCLUDE_COLS and pd.api.types.is_numeric_dtype(df[col])
    ]


# ── Baseline metrics ──────────────────────────────────────────────────────────

def compute_baselines(
    y_train: pd.Series, y_test: pd.Series
) -> Tuple[float, float]:
    """Return (majority_class_acc, persistence_acc) for a single fold."""
    majority_class = y_train.mode()[0] if not y_train.empty else 0
    last_known = y_train.iloc[-1] if not y_train.empty else 0
    maj_acc = accuracy_score(y_test, np.full(len(y_test), majority_class))
    pers_acc = accuracy_score(y_test, np.full(len(y_test), last_known))
    return float(maj_acc), float(pers_acc)


def baseline_label(model_acc: float, maj_acc: float, pers_acc: float) -> str:
    """Honest three-way label: better / worse / statistically indistinguishable."""
    if model_acc > max(maj_acc, pers_acc) + 0.02:
        return "better"
    if model_acc < min(maj_acc, pers_acc) - 0.02:
        return "worse"
    return "statistically indistinguishable"


# ── Aggregation helpers ───────────────────────────────────────────────────────

def _mean_std(values: List[float]) -> Tuple[float, float]:
    arr = np.array(values)
    return float(np.mean(arr)), float(np.std(arr))


def aggregate_importances(
    accum: np.ndarray, feature_names: List[str], n_folds: int
) -> List[Dict[str, Any]]:
    mean_imp = accum / n_folds if n_folds else np.zeros(len(feature_names))
    result = [
        {"feature": name, "importance": float(imp)}
        for name, imp in zip(feature_names, mean_imp)
    ]
    result.sort(key=lambda x: x["importance"], reverse=True)
    return result


def class_balance_stats(target: pd.Series) -> Tuple[Dict, Dict]:
    counts = target.value_counts().to_dict()
    total = len(target)
    balance = {
        "down": int(counts.get(-1, 0)),
        "sideways": int(counts.get(0, 0)),
        "up": int(counts.get(1, 0)),
    }
    pct = {k: float(v / total) for k, v in balance.items()}
    return balance, pct


# ── Report builder ────────────────────────────────────────────────────────────

def build_report(
    fold_metrics: List[Dict],
    feature_importance_list: List[Dict],
    target: pd.Series,
    horizon: int,
    maj_accs: List[float],
    pers_accs: List[float],
) -> Dict[str, Any]:
    """Assemble the final validation report dict from per-fold results."""
    mean_acc, std_acc = _mean_std([f["accuracy"] for f in fold_metrics])
    mean_prec, std_prec = _mean_std([f["precision"] for f in fold_metrics])
    mean_rec, std_rec = _mean_std([f["recall"] for f in fold_metrics])
    mean_f1, std_f1 = _mean_std([f["f1"] for f in fold_metrics])

    mean_maj = float(np.mean(maj_accs))
    mean_pers = float(np.mean(pers_accs))
    balance, balance_pct = class_balance_stats(target)

    def _trade(key: str) -> float:
        return float(np.mean([f["trading"][key] for f in fold_metrics]))

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "n_folds": len(fold_metrics),
            "horizon_periods": horizon,
        },
        "overall": {
            "mean_accuracy": mean_acc,
            "std_accuracy": std_acc,
            "mean_precision": mean_prec,
            "std_precision": std_prec,
            "mean_recall": mean_rec,
            "std_recall": std_rec,
            "mean_f1": mean_f1,
            "std_f1": std_f1,
            "accuracy_vs_naive_baseline": baseline_label(mean_acc, mean_maj, mean_pers),
            "baselines": {"mean_majority_class": mean_maj, "mean_persistence": mean_pers},
            "trading": {
                "mean_strategy_return": _trade("final_return"),
                "mean_bh_return": _trade("bh_final_return"),
                "mean_sharpe": _trade("sharpe"),
                "mean_bh_sharpe": _trade("bh_sharpe"),
                "mean_max_drawdown": _trade("max_drawdown"),
                "mean_win_rate": _trade("win_rate"),
            },
            "class_balance": balance,
            "class_balance_pct": balance_pct,
        },
        "folds": fold_metrics,
        "feature_importances": feature_importance_list[:10],
    }
