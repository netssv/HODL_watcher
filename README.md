# HODL Watcher

A quantitative dashboard and honest strategy generator for BTC/USDT. It combines live market microstructure indicators, option metrics, macro data, and news sentiment with a Random Forest model to predict price trends and export formatted context payloads for downstream LLM trading agents.

## API y comportamiento agentico

La explicación completa de la API, endpoints, skills, integración agentica y
uso consciente de IA está disponible en formato wiki:

- [Documentación en español](docs/API_AGENT_ES.md)
- [English documentation](docs/API_AGENT_EN.md)

La API FastAPI genera además documentación interactiva en `/docs` y
`/openapi.json`. En producción el frontend está en Vercel y el backend en
Google Cloud Run.

## Core Features

* Live Candlestick Chart: Real-time price actions, volatility bands, and indicators via Binance WebSocket.
* Liquidation Profile: Gaussian-smoothed, explicitly estimated levels from Binance public USDⓈ-M open-interest history, candles, and long/short account ratios. Missing data produces empty bars, never synthetic volume.
* Technical Overlays: Volume, EMAs, Bollinger Bands, RSI, and custom volume-weighted average price (VWAP) line.
* Macro & Sentiment Ribbon: Live summaries for Fear & Greed index, News Tone sentiment distribution, FRED's Nominal Broad USD Index, and exchange flows. The USD series is explicitly not ICE DXY. Includes hover tooltips detailing explanation definitions and concrete examples.
* Honest Strategist Payload: Standardized API endpoints exporting clean market microstructure data directly to external strategy makers.

* Composite score backlog: real VPVR still requires persisted historical volume-by-price data; the current composite uses Order Book Depth (not VPVR) and does not claim to be a volume profile.

## Quick Start

### First Time Setup (One-Time Per Computer)

```bash
./setup.sh
```

This will:
- Create and activate the Python virtual environment (`.venv`)
- Install Python dependencies
- Install Node.js dependencies (`node_modules`)

**After setup, the project is ready to run.** If you switch to another computer, run `./setup.sh` once on that machine too.

### Backend
1. Set up your API credentials in .env (FRED, NewsAPI, Deribit).
2. Install dependencies and start the FastAPI service:
   ```bash
   ./dev.sh backend
   ```

### Frontend
1. Install node dependencies:
   ```bash
   cd frontend && npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```

### Run Everything at Once

```bash
./dev.sh
```

This starts both backend (port 8000) and frontend (port 5173) in parallel.

## Troubleshooting

### "Connection Issue" Error When Switching Computers

**Problem:** You see `**Connection Issue:** Start backend using: `.venv/bin/uvicorn api.app:app --reload``

**Solution:** The `.venv` folder and `node_modules` don't exist on this computer. Run setup once:

```bash
./setup.sh
```

### Backend Won't Start

1. Check if port 8000 is already in use:
   ```bash
   lsof -i :8000  # macOS/Linux
   netstat -ano | findstr :8000  # Windows
   ```
2. Kill any existing process on port 8000
3. Re-run: `./dev.sh backend`

### Frontend Won't Start

1. Ensure Node.js is installed: `node --version`
2. Delete `node_modules` and reinstall:
   ```bash
   rm -rf frontend/node_modules
   ./setup.sh
   ```

### Virtual Environment Issues

If you get errors about missing packages even after `./setup.sh`:

```bash
# Manually recreate the venv
rm -rf .venv
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
./dev.sh
```
