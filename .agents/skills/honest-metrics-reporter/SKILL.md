---
name: honest-metrics-reporter
description: Use this skill whenever generating any output — JSON, frontend text, logs, or documentation — that presents the HODL_watcher model's predictions or performance to a human or to the downstream strategy-generating agent. Triggers include writing the /api/predict response, building the React prediction display components, or drafting the validation_summary section of the agent JSON. This skill enforces that no prediction or metric is ever shown without the context needed to judge its reliability.
---

# Honest Metrics Reporter

## Why this exists

A probability or accuracy number shown in isolation implies more certainty than a walk-forward-validated crypto direction model can honestly provide. This skill exists to make sure every surface of this project — API responses, frontend components, and the JSON handed to the strategy agent — carries the model's real reliability context alongside its output, not buried in a separate technical page.

## Non-negotiable rules for any prediction-facing output

1. **Never show a probability without its baseline comparison.** "65% probability of upward movement" must always be accompanied by whether the model beats the naive baseline (majority class / previous-period-persistence) on recent walk-forward folds, and by how much. If it does not beat the baseline, state that plainly instead of omitting the comparison.

2. **Never show a single accuracy number without its variance.** Report mean ± standard deviation across walk-forward folds, not just the mean. If std is large relative to the mean, add an explicit low-confidence flag/label.

3. **Class imbalance must be visible.** If the target has 70% "sideways" and 15%/15% up/down, and the model's accuracy is 68%, that's close to just predicting the majority class every time — say so. Never let a raw accuracy number stand next to a hidden imbalance.

4. **Every prediction output needs a generated_at timestamp and a data_freshness block.** Consumers (human or agent) need to know if they're looking at a prediction from 3 minutes ago or 3 hours ago, and whether any underlying data source was stale or missing when it was generated.

5. **The strategy-generating agent's JSON must include disclaimers as structured data, not just prose.** The `disclaimers` array in the output JSON is a functional field the agent is expected to read and incorporate, not decorative text — treat it as a required field, never omit it to save space.

## Required fields checklist for any prediction-facing payload

- [ ] `direction_probabilities` (never a single "up/down" without the sideways option and its probability)
- [ ] `accuracy_vs_naive_baseline`: one of `"better" | "worse" | "statistically indistinguishable"`
- [ ] `mean_accuracy` AND `std_accuracy` (never mean alone)
- [ ] `class_balance` of the target in the training data
- [ ] `generated_at` and `data_freshness` per source
- [ ] `disclaimers` array, always non-empty, always including at minimum: "This is not financial advice" and a plain-language statement of the model's validated accuracy range

## Frontend-specific rule

Any React component displaying a prediction must render the baseline comparison and variance in the SAME visual component as the headline probability — not in a collapsed tooltip, not on a separate tab. If a design would let someone see "65% up" without also seeing "barely beats a coin flip, ±12% variance across test folds," that design is not acceptable for this project.

## What "done" looks like

- [ ] No prediction, in any output surface, appears without its baseline comparison and variance
- [ ] `disclaimers` is populated in every JSON response, not just a schema placeholder
- [ ] Frontend prediction component visually pairs the headline number with its reliability context, not hidden behind a click
