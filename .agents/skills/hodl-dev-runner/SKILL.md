---
name: hodl-dev-runner
description: >
  Use this skill whenever you need to start, stop, or test the HODL Watcher
  development environment. Triggers include launching the FastAPI backend,
  starting the React frontend dev server, running the test suite, or building
  the frontend for production verification. Also covers the dev.sh launcher
  and common port/environment issues.
---

# HODL Watcher — Dev Runner Skill

## Quick Reference

| Task | Command | Notes |
|---|---|---|
| **Start backend** | `.venv/bin/uvicorn api.app:app --reload` | Port 8000, hot-reload on save |
| **Start frontend** | `cd frontend && npm run dev` | Port 5173 (Vite) |
| **Run all tests** | `.venv/bin/pytest tests/` | 33 tests, ~28s |
| **Build frontend** | `cd frontend && npm run build` | Verify no TS/Vite errors |
| **Full launcher** | `./dev.sh` | Starts both servers, checks venv |

All commands must be run from the **project root**: `/home/cachy/Proyectos/HODL_watcher`

---

## Backend

```bash
# Standard start (recommended — hot-reload enabled)
.venv/bin/uvicorn api.app:app --reload

# With explicit host/port if 8000 is busy
.venv/bin/uvicorn api.app:app --reload --host 0.0.0.0 --port 8001
```

- **Entry point**: `api/app.py`  
- **Prefix**: All routes at `/api/...`  
- **CORS**: Wildcard allowed for local React dev  
- **Auto-train**: First call to `/api/predict` triggers a training run if no cached model exists

### Check if backend is alive
```bash
curl -s http://localhost:8000/api/predict | python3 -m json.tool | head -30
```

---

## Frontend

```bash
cd frontend
npm run dev        # Dev server → http://localhost:5173
npm run build      # Production build → dist/
npm run preview    # Serve the production build locally
```

- **Framework**: React + Vite  
- **API proxy**: Frontend fetches `http://localhost:8000` directly (no proxy config)  
- **Live price**: Binance WebSocket `wss://stream.binance.com:9443/ws/btcusdt@ticker`

---

## Tests

```bash
# All tests
.venv/bin/pytest tests/ -v

# Single test file
.venv/bin/pytest tests/test_api.py -v

# With coverage
.venv/bin/pytest tests/ --cov=. --cov-report=term-missing
```

### Test files
| File | What it covers |
|---|---|
| `tests/test_api.py` | FastAPI endpoints (predict, train, features) |
| `tests/test_agent_exporter.py` | Payload serialization, risk sizing |
| `tests/test_data_ingestion.py` | All data source clients |
| `tests/test_features.py` | Feature builder, merge_asof, no-leakage |
| `tests/test_validation.py` | Walk-forward validation, metrics |

---

## Virtual Environment

```bash
# First-time setup (if .venv missing)
python3 -m venv .venv
.venv/bin/pip install -e '.[dev]'

# Verify correct Python
.venv/bin/python --version   # should be 3.14.x
```

---

## Common Issues

| Symptom | Fix |
|---|---|
| `[Errno 98] Address already in use` | `fuser -k 8000/tcp` then restart |
| `ModuleNotFoundError: No module named 'pandas'` | Use `.venv/bin/python`, not system `python3` |
| Frontend shows "Backend unreachable" | Ensure uvicorn is running on port 8000 |
| `PydanticSerializationError` | Cast all numpy types to `float()`/`int()` in `agent_exporter.py` |
| Coinglass data shows 0 | No `COINGLASS_API_KEY` set — mock data is used by design |

---

## Environment Variables (`.env` or shell exports)

```bash
COINGLASS_API_KEY=<your_key>   # Optional — mock data used if absent
FRED_API_KEY=<your_key>        # Optional — macro data (CPI, DXY)
```

---

## File Structure Reference

```
HODL_watcher/
├── api/app.py                  # FastAPI entry point
├── data_ingestion/             # All external API clients
├── features/builder.py         # Feature engineering (merge_asof joins)
├── model/
│   ├── validation.py           # Walk-forward validation
│   └── agent_exporter.py       # Payload serialization for frontend/LLM
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Root — state, layout ordering
│   │   ├── components/
│   │   │   ├── CandlestickChart.jsx   # ≤200 lines, imports from utils/
│   │   │   ├── ContentPanels.jsx      # Projections, Strategy, Risk, etc.
│   │   │   └── Sidebar.jsx            # Setup, API pipeline, signal log
│   │   └── utils/
│   │       ├── chartMath.js    # calcEMA, calcBB, calcRSI (pure)
│   │       └── chartFactory.js # Lightweight-Charts series factories
│   └── package.json
├── tests/
└── dev.sh                      # One-shot launcher
```
