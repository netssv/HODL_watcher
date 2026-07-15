# HODL Watcher — Project Map

> **Purpose**: BTC/USDT quantitative analysis dashboard.  A Random Forest classifier predicts short-term price direction (up / down / sideways) using walk-forward validation with honest metrics.  A React dashboard visualises the predictions, model confidence, and a simulated LLM strategy agent.

---

## 1. High-Level Architecture

```
┌──────────────┐     HTTP/JSON      ┌──────────────────┐
│  React SPA   │ ◄────────────────► │  FastAPI Backend  │
│  (Vite)      │   localhost:8000   │  api/app.py       │
│  port 5173   │                    └────────┬─────────┘
└──────────────┘                             │
                                             │ calls
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                   data_ingestion/     features/           model/
                   (8 API clients)     builder.py          validation.py
                   + SQLite cache                          agent_exporter.py
```

### Data Flow (request lifecycle)

1. **Frontend** calls `GET /api/predict` or `POST /api/train`.
2. **`api/app.py`** orchestrates: fetches raw data → builds features → trains/predicts → formats payload.
3. **`data_ingestion/`** fetches from external APIs with SQLite caching + exponential backoff.
4. **`features/builder.py`** merges all DataFrames via `pd.merge_asof` and computes indicators (RSI, MACD, Bollinger, funding-rate deltas, etc.).
5. **`model/validation.py`** runs walk-forward expanding-window cross-validation with embargo buffer.
6. **`model/agent_exporter.py`** formats the final JSON payload with honest metrics, confidence notes, and disclaimers.
7. Response is rendered in the React dashboard.

---

## 2. Directory Tree & Module Responsibilities

```
HODL_watcher/
├── .agents/skills/            # 6 coding-agent skills (see §8)
├── api/
│   └── app.py                 # FastAPI app, CORS, all REST endpoints
├── data_ingestion/
│   ├── __init__.py            # Re-exports all client modules
│   ├── config.py              # Shared constants (BASE_URLs, default limits)
│   ├── cache_utils.py         # SQLite read/write helpers for TTL caching
│   ├── binance_spot.py        # get_klines(), get_order_book()
│   ├── binance_futures.py     # get_klines(), get_funding_rate(), get_long_short_ratio()
│   ├── fear_greed.py          # get_fear_greed_index() — Alternative.me
│   ├── fred_macro.py          # get_cpi(), get_dxy() — FRED API
│   ├── coingecko.py           # get_market_chart(), get_global_data()
│   ├── mempool_onchain.py     # get_mempool_stats(), get_difficulty_adjustment()
│   ├── news_cryptopanic.py    # get_news() — CryptoPanic
│   ├── news_newsapi.py        # get_headlines() — NewsAPI
│   └── cache.sqlite           # Auto-created SQLite DB for API response caching
├── features/
│   ├── __init__.py
│   └── builder.py             # build_features() — merges + computes all indicators
├── model/
│   ├── __init__.py
│   ├── validation.py          # prepare_target(), run_walk_forward_validation()
│   └── agent_exporter.py      # export_agent_payload() → structured JSON
├── frontend/
│   ├── package.json           # React 19 + Vite 8 + Recharts 3 + Lucide React
│   ├── vite.config.js
│   └── src/
│       ├── main.jsx           # React entry point
│       ├── App.jsx            # Entire SPA (single-file component)
│       ├── index.css          # All custom CSS (dark + simple-mode themes)
│       └── App.css            # (legacy, mostly unused)
├── tests/
│   ├── test_data_ingestion.py # 23 tests — all 8 clients
│   ├── test_features.py       # 3 tests  — feature builder
│   ├── test_validation.py     # 2 tests  — walk-forward + target prep
│   ├── test_agent_exporter.py # 1 test   — payload schema
│   └── test_api.py            # 4 tests  — endpoint integration
├── scripts/                   # Utility scripts (currently empty)
├── pyproject.toml             # Python project metadata & deps
└── prompt_sistema_prediccion_btc.md  # Original system design prompt (Spanish)
```

---

## 3. Backend: API Endpoints

| Method | Path                | Purpose | Key params |
|--------|---------------------|---------|------------|
| GET    | `/api/predict`      | Returns current prediction + validation metrics | None |
| POST   | `/api/train`        | Triggers walk-forward recalibration | `horizon_hours`, `n_folds`, `threshold_pct`, `features_config` |
| GET    | `/api/data/{symbol}` | Raw OHLCV candle data | `interval`, `limit` |
| POST   | `/api/features`     | Computed feature matrix (for inspection) | `symbol`, `limit`, `features_config` |
| GET    | `/api/news-instructions` | Agent instructions + search keywords | None |

### `/api/predict` response shape (PredictResponse)
```json
{
  "payload": {
    "meta": { "generated_at", "model_version", "horizon_hours", "data_freshness" },
    "market_snapshot": { "price", "rsi", "funding_rate", "long_short_ratio", "fear_greed_index", "order_book_support_resistance" },
    "model_prediction": { "direction_probabilities": { "up", "down", "sideways" }, "confidence_note", "feature_importance_top5" },
    "validation_summary": { "walk_forward_folds", "mean_accuracy", "std_accuracy", "accuracy_vs_naive_baseline", "class_balance", "folds": [...] },
    "news_context": { "instructions_for_agent", "keywords_to_search" },
    "disclaimers": [...]
  },
  "data_gaps": [...]
}
```

### `/api/train` response shape (TrainResponse)
```json
{
  "status": "success",
  "validation_summary": { /* full walk-forward report with folds[] */ },
  "data_gaps": [...]
}
```

### In-memory state
- `_LATEST_TRAINING_REPORT` (global dict): Caches the last walk-forward validation report. If `None` on first `/api/predict`, an auto-training run is triggered.

---

## 4. Data Ingestion Modules

Each client follows the same pattern:
1. Check SQLite cache → return if TTL is valid.
2. HTTP GET with exponential backoff on rate-limit (429) responses.
3. Parse JSON → pandas DataFrame with `DatetimeIndex`.
4. Write to SQLite cache.

| Module | External API | Free-tier rate limit | Cache TTL |
|--------|-------------|---------------------|-----------|
| `binance_spot` | Binance REST v3 | 1200 req/min | 60s |
| `binance_futures` | Binance Futures v1 | 1200 req/min | 60s |
| `fear_greed` | alternative.me | ~10 req/min | 300s |
| `fred_macro` | FRED (St. Louis Fed) | 120 req/min | 3600s |
| `coingecko` | CoinGecko free | 10-30 req/min | 120s |
| `mempool_onchain` | mempool.space | No key needed | 120s |
| `news_cryptopanic` | CryptoPanic | 10 req/min | 300s |
| `news_newsapi` | NewsAPI | 100 req/day | 900s |

---

## 5. Feature Engineering (`features/builder.py`)

`build_features()` accepts individual DataFrames from each ingestion client and:

1. Starts with Binance spot OHLCV as the spine DataFrame.
2. Computes **technical indicators**: RSI (6/12/24), MACD, Bollinger Bands, ATR, OBV.
3. Left-joins **derivatives** (funding rate, long/short ratio) via `pd.merge_asof` on timestamp.
4. Left-joins **sentiment** (Fear & Greed) via `pd.merge_asof`.
5. Left-joins **macro** (CPI, DXY) via `pd.merge_asof`.
6. Computes **diff features** (7-period change deltas) for funding rate, long/short ratio.
7. Returns a single clean DataFrame with all features.

### Critical Gotcha: Timestamp Resolution
All join keys are explicitly cast to `datetime64[ns, UTC]` before `merge_asof`. Binance returns `ms`, FRED returns `s` — mixing resolutions causes `MergeError`.

---

## 6. Model Pipeline (`model/`)

### `validation.py` — Walk-Forward Validation

- **`prepare_target(df, horizon, threshold_pct)`**: Creates classification labels using `shift(-horizon)`. Returns `(df_trimmed, target_series)`.
- **`run_walk_forward_validation(df, target, n_folds, horizon)`**: Expanding-window walk-forward with:
  - 30% initial training window.
  - **Embargo gap** = `horizon` periods between train end and test start.
  - `RandomForestClassifier(n_estimators=100, max_depth=5)`.
  - Per-fold metrics: accuracy, precision, recall, F1, log loss, confusion matrix.
  - **Baseline comparisons**: majority-class and persistence (yesterday's class).
  - Returns a full report dict with `folds[]`, `overall{}`, `feature_importances[]`, `metadata{}`.

### `agent_exporter.py` — Payload Formatter

- **`export_agent_payload()`**: Takes the latest market row, validation report, prediction probabilities, and order book walls → returns the structured JSON consumed by the frontend and downstream agents.
- Generates a dynamic **confidence note** based on accuracy vs baselines.
- Includes **disclaimers** (required by `honest-metrics-reporter` skill).

---

## 7. Frontend (`frontend/src/`)

**Stack**: React 19 + Vite 8 + Recharts 3 + Lucide React icons + Vanilla CSS.

### `App.jsx` — Single-file SPA

**State variables**:
| State | Type | Purpose |
|-------|------|---------|
| `isSimpleMode` | bool | Toggles Simple (light/pastel) vs Advanced (dark) UI |
| `predictionData` | object | Full payload from `/api/predict` |
| `trainingReport` | object | `validation_summary` with `folds[]` |
| `loading` / `trainLoading` | bool | Loading spinners |
| `lastFetchedTime` | number | Timestamp for 5-second fetch throttle |
| `simulatedStrategy` | object | Mock LLM agent strategy recommendation |
| `showExplainers` / `showF1Tooltip` / `showLossTooltip` / `showEmbargoTooltip` | bool | UI toggles |

**Key functions**:
- `fetchPrediction(force)`: GET `/api/predict`. Has a 5-second TTL guard (bypassed when `force=true`).
- `handleTrain()`: POST `/api/train` → updates `trainingReport` → calls `fetchPrediction(true)`.
- `generateStrategy(payload)`: Deterministic mock that maps prediction probabilities to ACCUMULATE / REDUCE / HOLD.
- `renderBaselineBadge(status)`: Dynamic badge color (green/red/grey) based on `accuracy_vs_naive_baseline`.
- `renderSimpleProjections(payload)`: Friendly emoji badge for Simple Mode.

**UI Sections** (top to bottom):
1. **Header**: Title + Simple/Advanced toggle + Methodology Guide + Refresh.
2. **Error Banner**: Shows when backend is unreachable.
3. **Guide Banner**: Expandable methodology explainer.
4. **Left Sidebar**: Projections Setup (sliders + feature toggles + Recalibrate), API Pipeline Status, Market Snapshot.
5. **Right Content**: Directional Projections (cards + probability bar + reliability details in Advanced; single emoji badge in Simple), Strategy Recommendation, Validation Performance Trend (Recharts LineChart), Disclaimers.

### `index.css` — Dual-Theme Design System

- **Default (Advanced)**: Dark slate (`#080b11`) with glassmorphism cards, neon accent colors.
- **`.simple-mode`**: Light pastel (`#f8fafc`) with soft shadows, high-contrast readable text, friendly warm colors.
- Semantic color tokens: `--up-color`, `--down-color`, `--neutral-color`, baseline variants.
- All components use CSS custom properties — no inline color definitions.

---

## 8. Agent Skills (`.agents/skills/`)

| Skill | Trigger | What it enforces |
|-------|---------|-----------------|
| `fastapi-pandas-endpoint` | Creating/editing FastAPI routes | Pydantic schemas, error boundaries, no raw pandas in routes |
| `free-api-rate-limiter` | Calling external APIs in `data_ingestion/` | SQLite caching, exponential backoff, TTL enforcement |
| `honest-metrics-reporter` | Presenting predictions or metrics to users | No metric without context, baseline comparisons, disclaimers |
| `no-data-leakage-checker` | Building training data or computing features | No future data in features, chronological splits, merge_asof direction |
| `quant-dashboard-design` | Creating/editing UI views | First-time readability, semantic colors, empty/error states |
| `walk-forward-validator` | Training or evaluating the model | Walk-forward methodology, embargo, honest multi-metric reporting |

---

## 9. Testing

**Framework**: pytest (33 tests, all passing)

| Test file | Count | Coverage |
|-----------|-------|----------|
| `test_data_ingestion.py` | 23 | All 8 client modules, caching, error handling |
| `test_features.py` | 3 | Feature builder output shape, indicators, joins |
| `test_validation.py` | 2 | Walk-forward splits, target preparation |
| `test_agent_exporter.py` | 1 | Payload schema compliance |
| `test_api.py` | 4 | Endpoint integration (predict, train, data, features) |

Run: `cd /home/netss/Projects/HODL_watcher && .venv/bin/python -m pytest`

---

## 10. How to Run

### Backend
```bash
cd /home/netss/Projects/HODL_watcher
.venv/bin/uvicorn api.app:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend
```bash
cd /home/netss/Projects/HODL_watcher/frontend
npm run dev
# Opens at http://localhost:5173
```

### Tests
```bash
cd /home/netss/Projects/HODL_watcher
.venv/bin/python -m pytest
```

---

## 11. Known Gotchas & Decisions

| Issue | Detail |
|-------|--------|
| **Timestamp resolution mismatch** | Binance returns `datetime64[ms, UTC]`, FRED returns `datetime64[s, UTC]`. All must be cast to `datetime64[ns, UTC]` before `merge_asof`. |
| **Non-numeric columns in train matrix** | `close_time` column from Binance must be excluded from `feature_names` before fitting sklearn models. |
| **In-memory model cache** | `_LATEST_TRAINING_REPORT` lives in process memory. Server restart triggers auto-retrain on first `/api/predict`. |
| **Frontend fetch throttle** | `fetchPrediction()` has a 5-second TTL guard. User-initiated actions (Recalibrate, Refresh) pass `force=true` to bypass. |
| **Auto-train on first load** | If no cached report exists, `/api/predict` triggers a full 8-fold walk-forward training (takes ~5s). |
| **Model accuracy is low** | This is expected and honestly reported. The model accuracy (~18-34%) is often indistinguishable from or worse than naive baselines. The honest-metrics-reporter skill requires this to be surfaced, not hidden. |
| **Simple Mode hides advanced charts** | The Validation Performance Trend chart is only visible in Advanced Mode. |
| **Backend must use --reload** | Always start uvicorn with `--reload` during development so code changes take effect without manual restarts. |

---

## 12. Dependencies

### Python (`pyproject.toml`)
- pandas ≥2.0, numpy ≥1.24, scikit-learn ≥1.3
- requests ≥2.31, fastapi ≥0.100, uvicorn ≥0.23
- Dev: pytest, pytest-cov, httpx

### Frontend (`package.json`)
- react 19, react-dom 19
- recharts 3.9, lucide-react 1.24
- Dev: vite 8, @vitejs/plugin-react 6

---

## 13. Future Work / Extension Points

- **Persist trained model to disk** (joblib/pickle) so server restarts don't retrain.
- **Add WebSocket** for live price streaming instead of polling.
- **Real LLM agent integration** — currently the strategy is a deterministic mock.
- **Code-split the frontend** — bundle is 557 KB, could benefit from dynamic imports.
- **Add more indicators** — on-chain metrics from mempool, news sentiment scoring.
- **Historical backtest view** — show equity curve from walk-forward folds.
