"""
Model training and walk-forward validation orchestrator.
Enforces expanding train windows, embargo gaps, regularized RF with balanced weights, and baseline comparisons.
"""

# pyrefly: ignore [missing-import]
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Dict, Any, List
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, log_loss, confusion_matrix

from model.labeling import prepare_target
from model.backtest import simulate_trading, CONFIDENCE_THRESHOLD

MIN_TEST_SIZE = 50

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
    Execute walk-forward validation with expanding train window and embargo gap.
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

    exclude_cols = {'open', 'high', 'low', 'close', 'volume', 'close_time'}
    feature_names = [
        col for col in df.columns 
        if col not in exclude_cols and pd.api.types.is_numeric_dtype(df[col])
    ]

    importances_accum = np.zeros(len(feature_names))
    fold_metrics = []
    
    majority_baseline_accuracies = []
    persistence_baseline_accuracies = []
    model_accuracies = []

    for fold in range(n_folds):
        train_end = initial_train_size + fold * test_size
        test_start = train_end + horizon
        test_end = min(test_start + test_size, n_samples)

        if test_start >= test_end:
            break
        if (test_end - test_start) < min_test:
            continue

        X_train = df.iloc[:train_end][feature_names].fillna(0)
        y_train = target.iloc[:train_end]
        X_test = df.iloc[test_start:test_end][feature_names].fillna(0)
        y_test = target.iloc[test_start:test_end]

        if len(X_test) == 0 or y_train.nunique() < 2:
            continue

        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            class_weight="balanced",
            min_samples_leaf=5,
            n_jobs=-1
        )
        model.fit(X_train, y_train)

        preds = model.predict(X_test)
        classes_in_train = list(model.classes_)
        probs = model.predict_proba(X_test)

        majority_class = y_train.mode()[0] if not y_train.empty else 0
        majority_acc = accuracy_score(y_test, np.full(len(y_test), majority_class))
        majority_baseline_accuracies.append(majority_acc)

        last_known_class = y_train.iloc[-1] if not y_train.empty else 0
        persistence_acc = accuracy_score(y_test, np.full(len(y_test), last_known_class))
        persistence_baseline_accuracies.append(persistence_acc)

        acc = accuracy_score(y_test, preds)
        model_accuracies.append(acc)

        precision_by_class, recall_by_class, f1_by_class, support_by_class = precision_recall_fscore_support(
            y_test, preds, labels=[-1, 0, 1], average=None, zero_division=0
        )
        precision = float(np.mean(precision_by_class))
        recall = float(np.mean(recall_by_class))
        f1 = float(np.mean(f1_by_class))

        try:
            loss = log_loss(y_test, probs, labels=classes_in_train)
        except Exception:
            loss = np.nan

        cm = confusion_matrix(y_test, preds, labels=[-1, 0, 1]).tolist()
        prices = df.iloc[test_start:test_end]['close']
        sim_metrics = simulate_trading(y_test, preds, probs, prices, classes_in_train)

        fold_metrics.append({
            "fold": fold + 1,
            "train_size": len(X_train),
            "test_size": len(X_test),
            "train_end": str(df.index[train_end - 1]),
            "test_start": str(df.index[test_start]),
            "test_end": str(df.index[test_end - 1]),
            "accuracy": float(acc),
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "per_class": {
                label: {
                    "precision": float(p), "recall": float(r), "f1": float(f), "support": int(s)
                }
                for label, p, r, f, s in zip(
                    ["down", "sideways", "up"], precision_by_class, recall_by_class,
                    f1_by_class, support_by_class
                )
            },
            "log_loss": float(loss) if not np.isnan(loss) else None,
            "confusion_matrix": cm,
            "majority_baseline": float(majority_acc),
            "persistence_baseline": float(persistence_acc),
            "trading": sim_metrics,
            "feature_importances": [
                {"feature": name, "importance": float(importance)}
                for name, importance in sorted(
                    zip(feature_names, model.feature_importances_),
                    key=lambda item: item[1], reverse=True
                )[:10]
            ],
        })
        importances_accum += model.feature_importances_

    n_valid = len(fold_metrics)
    mean_importances = importances_accum / n_valid if n_valid else np.zeros(len(feature_names))
    feature_importance_list = sorted(
        [{"feature": name, "importance": float(imp)} for name, imp in zip(feature_names, mean_importances)],
        key=lambda x: x["importance"], reverse=True
    )

    class_counts = target.value_counts().to_dict()
    total_samples = len(target)
    class_balance = {
        "down": int(class_counts.get(-1, 0)),
        "sideways": int(class_counts.get(0, 0)),
        "up": int(class_counts.get(1, 0))
    }

    accs = [f["accuracy"] for f in fold_metrics]
    mean_model_acc = float(np.mean(accs)) if accs else 0.0
    mean_maj_acc = float(np.mean(majority_baseline_accuracies)) if majority_baseline_accuracies else 0.0
    mean_pers_acc = float(np.mean(persistence_baseline_accuracies)) if persistence_baseline_accuracies else 0.0

    if mean_model_acc > max(mean_maj_acc, mean_pers_acc) + 0.02:
        baseline_comparison = "better"
    elif mean_model_acc < min(mean_maj_acc, mean_pers_acc) - 0.02:
        baseline_comparison = "worse"
    else:
        baseline_comparison = "statistically indistinguishable"

    trading_agg = {
        "mean_strategy_return": float(np.mean([f["trading"]["final_return"] for f in fold_metrics])),
        "mean_bh_return": float(np.mean([f["trading"]["bh_final_return"] for f in fold_metrics])),
        "mean_sharpe": float(np.mean([f["trading"]["sharpe"] for f in fold_metrics])),
        "mean_bh_sharpe": float(np.mean([f["trading"]["bh_sharpe"] for f in fold_metrics])),
        "mean_max_drawdown": float(np.mean([f["trading"]["max_drawdown"] for f in fold_metrics])),
        "mean_win_rate": float(np.mean([f["trading"]["win_rate"] for f in fold_metrics])),
    } if fold_metrics else {}

    log_losses = [f["log_loss"] for f in fold_metrics if f["log_loss"] is not None]

    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "n_folds": n_valid,
            "horizon_periods": horizon,
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "labeling_method": "z_score",
            "embargo_periods": horizon,
            "data_start": str(df.index.min()) if len(df) else None,
            "data_end": str(df.index.max()) if len(df) else None,
            "latest_test_end": str(df.index[min(n_samples - 1, initial_train_size + (n_valid - 1) * test_size + horizon + test_size - 1)]) if n_valid else None,
            "status": "validated" if n_valid >= 8 else "preliminary_fewer_than_8_folds",
        },
        "overall": {
            "mean_accuracy": mean_model_acc,
            "std_accuracy": float(np.std(accs)) if accs else 0.0,
            "mean_precision": float(np.mean([f["precision"] for f in fold_metrics])) if fold_metrics else 0.0,
            "mean_recall": float(np.mean([f["recall"] for f in fold_metrics])) if fold_metrics else 0.0,
            "mean_f1": float(np.mean([f["f1"] for f in fold_metrics])) if fold_metrics else 0.0,
            "std_precision": float(np.std([f["precision"] for f in fold_metrics])) if fold_metrics else 0.0,
            "std_recall": float(np.std([f["recall"] for f in fold_metrics])) if fold_metrics else 0.0,
            "std_f1": float(np.std([f["f1"] for f in fold_metrics])) if fold_metrics else 0.0,
            "mean_log_loss": float(np.mean(log_losses)) if log_losses else None,
            "std_log_loss": float(np.std(log_losses)) if log_losses else None,
            "accuracy_vs_naive_baseline": baseline_comparison,
            "baselines": {
                "mean_majority_class": mean_maj_acc,
                "mean_persistence": mean_pers_acc,
            },
            "trading": trading_agg,
            "class_balance": class_balance,
        },
        "folds": fold_metrics,
        "feature_importances": feature_importance_list[:10],
    }
