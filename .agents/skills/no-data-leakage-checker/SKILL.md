---
name: no-data-leakage-checker
description: Use this skill whenever writing, editing, or reviewing code that builds a training dataset, computes features, or creates a train/test/validation split for the HODL_watcher price prediction pipeline. Triggers include working with pandas DataFrames that mix timestamps, computing rolling/lookback features (RSI, MACD, moving averages, funding rate deltas), constructing labels/targets from future price movement, or splitting data for model training. This skill enforces that no row in any training or validation set uses information that would not have been available at that row's timestamp in real time.
---

# No Data Leakage Checker

## Why this exists

Time-series financial models look artificially accurate almost entirely because of subtle data leakage: a feature computed with a centered rolling window, a label built by looking backward instead of forward, or a random shuffle-based train/test split. None of these show up as bugs — they show up as suspiciously good backtest numbers. This skill exists to catch that class of error before it reaches a walk-forward validation run.

## Rules to enforce in any code you write or review

1. **No shuffled splits.** Never use `train_test_split(..., shuffle=True)` or any random sampling to build train/test sets for this project. All splits must be chronological.
2. **Every feature function must declare its lookback window.** When writing a feature function (e.g. `compute_rsi(df, window=14)`), add a docstring line stating exactly how many periods back it reads. If a feature uses `.rolling()`, confirm `center=False` (default) — a centered rolling window silently uses future data.
3. **Labels must be built strictly forward-looking, features strictly backward-looking.** When constructing the target column (e.g. "price direction over the next N hours"), the shift must be negative relative to now (`df['target'] = df['close'].shift(-horizon)` pattern), and it must never be used as an input to any feature that describes "now."
4. **External data joins need a freshness check.** When joining data from a second source (funding rate, Fear & Greed Index, macro data, news), verify the join uses `merge_asof` with `direction='backward'` (or equivalent) so that each row only picks up the most recent value available *at or before* that timestamp — never an exact-timestamp join that could silently pull a value published later.
5. **Run the automated check after any change to `features/` or `data_ingestion/`.** Use `scripts/check_leakage.py` (see below) as a smoke test — it is not exhaustive, but it catches the most common mistakes (centered rolling windows, positive shifts on labels, use of `.shuffle()`/`random_state` in a split call).

## How to use the included script

```bash
python .agents/skills/no-data-leakage-checker/scripts/check_leakage.py path/to/file_or_directory.py
```

This performs a static scan (not execution) looking for the patterns above and prints warnings with file/line references. It is a first-pass filter, not a proof of correctness — always pair it with a manual review of any new feature or split logic, and ideally a unit test that asserts `feature_timestamp <= row_timestamp` for a sample of rows.

## What "done" looks like

Before considering any data pipeline change complete:
- [ ] Ran `check_leakage.py` on the changed files, zero unresolved warnings
- [ ] Confirmed all splits are chronological with an explicit embargo/purge gap around the horizon length
- [ ] Added or updated a test that asserts no feature column uses a timestamp later than its row's timestamp
