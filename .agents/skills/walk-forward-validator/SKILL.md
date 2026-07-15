---
name: walk-forward-validator
description: Use this skill whenever training, retraining, or evaluating the Random Forest (or any other) model in the HODL_watcher project. Triggers include writing model training code, cross-validation logic, backtest scripts, or any code that reports model performance metrics. This skill defines the mandatory walk-forward validation methodology and the minimum set of honest metrics that must accompany every reported result — accuracy alone is never sufficient.
---

# Walk-Forward Validator

## Why this exists

A single random train/test split on financial time-series data reliably produces flattering, unreproducible numbers. This skill exists so every model evaluation in this project follows the same disciplined methodology, and so results are never reported without the context needed to judge whether they're meaningful.

## Required methodology

1. **No single train/test split.** Use an expanding or rolling window walk-forward scheme via `sklearn.model_selection.TimeSeriesSplit`, or a manual implementation if more control over window size is needed.
2. **Minimum 8 folds** across the available history. Fewer folds means the variance estimate on the metrics is unreliable — say so explicitly if fewer are used for a quick iteration and label the result as preliminary.
3. **Embargo/purge gap required.** Leave a gap between the end of each training window and the start of the following test window at least equal to the prediction horizon (e.g. horizon = 24h → embargo ≥ 24h). This prevents leakage via autocorrelation at the train/test boundary.
4. **Report per-fold results, not just the aggregate.** A single averaged accuracy hides instability. Always report the list of per-fold metrics plus mean ± standard deviation.

## Required metrics — never accuracy alone

For every fold, and in the aggregate report, include:

- **Accuracy** — always paired with the metrics below, never presented alone
- **Precision, recall, F1 per class** (up / down / sideways) — accuracy is misleading with class imbalance, which is expected in this project
- **Full confusion matrix**
- **Directional accuracy vs. a naive baseline** — compare against (a) "predict the majority class every time" and (b) "predict the same direction as the previous period." If the model does not beat both baselines consistently across folds, this must be stated plainly in the output, not smoothed over
- **Log loss or Brier score** — evaluates probability calibration, not just the argmax class
- **Feature importance per fold** (permutation importance preferred over Gini) — if importance rankings shift dramatically between folds, that instability is itself a finding to report, as it suggests overfitting to fold-specific noise
- **Standard deviation of every metric across folds** — a high-variance model is not a reliable model, regardless of its mean score

## Output format

Every training run should produce a report (JSON + human-readable summary) containing:
- Per-fold metrics table
- Aggregate mean ± std for each metric
- Explicit comparison line: "Model vs. naive baseline: [better / worse / statistically indistinguishable]"
- Class balance of the target across the full dataset
- Date range of training data and the date of the most recent fold

## What to never do

- Never report a single accuracy number without its baseline comparison and variance
- Never cherry-pick the best fold to represent overall performance
- Never optimize hyperparameters against the same folds used for the final reported metrics — use a separate, earlier portion of history for tuning, or nested walk-forward if tuning is required
