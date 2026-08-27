"""Fit and run the production Random Forest after walk-forward evaluation."""

import pandas as pd
from sklearn.ensemble import RandomForestClassifier


def _feature_names(df: pd.DataFrame) -> list[str]:
    excluded = {"open", "high", "low", "close", "volume", "close_time"}
    return [c for c in df if c not in excluded and pd.api.types.is_numeric_dtype(df[c])]


def fit_final_model(df: pd.DataFrame, target: pd.Series):
    """Fit on all labeled historical rows; labels are strictly forward-looking."""
    names = _feature_names(df)
    if target.nunique() < 2:
        raise ValueError("Training target contains fewer than two classes.")
    model = RandomForestClassifier(
        n_estimators=200, max_depth=6, random_state=42,
        class_weight="balanced", min_samples_leaf=5, n_jobs=-1,
    )
    model.fit(df[names].fillna(0), target)
    return model, names


def predict_probabilities(model, feature_names: list[str], row: dict) -> dict[str, float]:
    """Return all three class probabilities, including classes absent in training."""
    X = pd.DataFrame([row]).reindex(columns=feature_names).fillna(0)
    by_class = dict(zip(model.classes_, model.predict_proba(X)[0]))
    return {
        "down": float(by_class.get(-1, 0.0)),
        "sideways": float(by_class.get(0, 0.0)),
        "up": float(by_class.get(1, 0.0)),
    }
