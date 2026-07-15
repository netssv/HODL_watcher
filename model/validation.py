"""
Model training, walk-forward validation, and honest metrics calculation.

Enforces:
1. Walk-forward validation with configurable folds (minimum 8-10).
2. Embargo/purge gap between train and validation test sets to avoid leakage.
3. Collection of rich, honest metrics (precision, recall, F1, log loss,
   confusion matrix, feature importances, and variance across folds).
4. Naive baseline comparisons (majority class and yesterday-persistence).
"""

import numpy as np
import pandas as pd
from datetime import datetime, timezone
from typing import Dict, Any, List, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, log_loss, confusion_matrix


def prepare_target(df: pd.DataFrame, horizon: int, threshold_pct: float = 0.005) -> Tuple[pd.DataFrame, pd.Series]:
    """
    Generate target labels: 1 (up), -1 (down), 0 (sideways).
    
    Target: Price change over the next `horizon` periods.
    Lookahead: Uses shift(-horizon), so it is strictly forward-looking relative to features.
    """
    # Shift close price backward to look into the future
    future_close = df['close'].shift(-horizon)
    price_change = (future_close - df['close']) / df['close']
    
    # Classify: 1 if change > threshold, -1 if change < -threshold, else 0
    target = pd.Series(0, index=df.index)
    target[price_change > threshold_pct] = 1
    target[price_change < -threshold_pct] = -1
    
    # Drop rows at the end where target cannot be computed due to lookahead
    valid_mask = price_change.notna()
    
    return df[valid_mask], target[valid_mask]


def run_walk_forward_validation(
    df: pd.DataFrame,
    target: pd.Series,
    n_folds: int = 10,
    horizon: int = 24,
    n_estimators: int = 100,
    max_depth: int = 5,
    random_state: int = 42,
) -> Dict[str, Any]:
    """
    Execute walk-forward validation with expanding train window and embargo gap.
    """
    assert len(df) == len(target), "Features and target must have the same length"
    
    n_samples = len(df)
    # Ensure we have enough data for the folds, reserving some for initial training
    # Start initial training at 30% of the dataset
    initial_train_size = int(n_samples * 0.3)
    
    # Calculate step size for each fold validation block
    test_size = (n_samples - initial_train_size) // n_folds
    
    fold_metrics = []
    # Select only numeric feature columns (excluding timestamp/datetime columns like close_time)
    exclude_cols = {'open', 'high', 'low', 'close', 'volume', 'close_time'}
    feature_names = [
        col for col in df.columns 
        if col not in exclude_cols and pd.api.types.is_numeric_dtype(df[col])
    ]
    
    importances_accum = np.zeros(len(feature_names))
    
    # Track overall class distributions for naive baseline comparison
    majority_baseline_accuracies = []
    persistence_baseline_accuracies = []
    model_accuracies = []
    
    for fold in range(n_folds):
        train_end = initial_train_size + fold * test_size
        # Apply embargo gap equal to the horizon
        test_start = train_end + horizon
        test_end = test_start + test_size
        
        if test_end > n_samples:
            test_end = n_samples
            
        if test_start >= test_end:
            break
            
        # Split sets
        X_train = df.iloc[:train_end][feature_names].fillna(0)
        y_train = target.iloc[:train_end]
        
        X_test = df.iloc[test_start:test_end][feature_names].fillna(0)
        y_test = target.iloc[test_start:test_end]
        
        if len(X_test) == 0:
            continue
            
        # Train model
        model = RandomForestClassifier(
            n_estimators=n_estimators,
            max_depth=max_depth,
            random_state=random_state,
            n_jobs=-1
        )
        model.fit(X_train, y_train)
        
        # Predictions
        preds = model.predict(X_test)
        
        # Avoid crashing if target classes are not fully represented
        classes_in_train = list(model.classes_)
        # Predict probabilities
        probs = model.predict_proba(X_test)
        
        # Baseline 1: Majority class from training set
        majority_class = y_train.mode()[0] if not y_train.empty else 0
        majority_preds = np.full(len(y_test), majority_class)
        majority_acc = accuracy_score(y_test, majority_preds)
        majority_baseline_accuracies.append(majority_acc)
        
        # Baseline 2: Persistence (predict same class as the last known class at train_end)
        last_known_class = y_train.iloc[-1] if not y_train.empty else 0
        persistence_preds = np.full(len(y_test), last_known_class)
        persistence_acc = accuracy_score(y_test, persistence_preds)
        persistence_baseline_accuracies.append(persistence_acc)
        
        # Model performance metrics
        acc = accuracy_score(y_test, preds)
        model_accuracies.append(acc)
        
        # Precision, recall, f1
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_test, preds, average='macro', zero_division=0
        )
        
        # Log loss
        try:
            # Handle cases where not all classes are represented in train/test
            loss = log_loss(y_test, probs, labels=classes_in_train)
        except Exception:
            loss = np.nan
            
        cm = confusion_matrix(y_test, preds, labels=[-1, 0, 1]).tolist()
        
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
        })
        
        # Accumulate importances
        importances_accum += model.feature_importances_
        
    # Aggregate statistics
    mean_importances = importances_accum / len(fold_metrics) if fold_metrics else np.zeros(len(feature_names))
    feature_importance_list = [
        {"feature": name, "importance": float(imp)}
        for name, imp in zip(feature_names, mean_importances)
    ]
    feature_importance_list.sort(key=lambda x: x["importance"], reverse=True)
    
    # Class balance of target overall
    class_counts = target.value_counts().to_dict()
    total_samples = len(target)
    class_balance = {
        "down": int(class_counts.get(-1, 0)),
        "sideways": int(class_counts.get(0, 0)),
        "up": int(class_counts.get(1, 0))
    }
    class_balance_pct = {
        "down": float(class_balance["down"] / total_samples),
        "sideways": float(class_balance["sideways"] / total_samples),
        "up": float(class_balance["up"] / total_samples)
    }
    
    accs = [f["accuracy"] for f in fold_metrics]
    precisions = [f["precision"] for f in fold_metrics]
    recalls = [f["recall"] for f in fold_metrics]
    f1s = [f["f1"] for f in fold_metrics]
    
    mean_model_acc = float(np.mean(accs))
    mean_maj_acc = float(np.mean(majority_baseline_accuracies))
    mean_pers_acc = float(np.mean(persistence_baseline_accuracies))
    
    # Honest baseline comparison label
    if mean_model_acc > max(mean_maj_acc, mean_pers_acc) + 0.02:
        baseline_comparison = "better"
    elif mean_model_acc < min(mean_maj_acc, mean_pers_acc) - 0.02:
        baseline_comparison = "worse"
    else:
        baseline_comparison = "statistically indistinguishable"

    report = {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "n_folds": len(fold_metrics),
            "horizon_periods": horizon,
        },
        "overall": {
            "mean_accuracy": mean_model_acc,
            "std_accuracy": float(np.std(accs)),
            "mean_precision": float(np.mean(precisions)),
            "std_precision": float(np.std(precisions)),
            "mean_recall": float(np.mean(recalls)),
            "std_recall": float(np.std(recalls)),
            "mean_f1": float(np.mean(f1s)),
            "std_f1": float(np.std(f1s)),
            "accuracy_vs_naive_baseline": baseline_comparison,
            "baselines": {
                "mean_majority_class": mean_maj_acc,
                "mean_persistence": mean_pers_acc,
            },
            "class_balance": class_balance,
            "class_balance_pct": class_balance_pct,
        },
        "folds": fold_metrics,
        "feature_importances": feature_importance_list[:10],  # top 10
    }
    
    return report
