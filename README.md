# HODL Watcher

A quantitative dashboard and honest strategy generator for BTC/USDT. It combines live market microstructure indicators, option metrics, macro data, and news sentiment with a Random Forest model to predict price trends and export formatted context payloads for downstream LLM trading agents.

## Core Features

* Live Candlestick Chart: Real-time price actions, volatility bands, and indicators via Binance WebSocket.
* Liquidation Heatmap: Multi-level leverage proximity bands mapping order book shelves directly on the chart.
* Technical Overlays: Volume, EMAs, Bollinger Bands, RSI, and custom volume-weighted average price (VWAP) line.
* Macro & Sentiment Ribbon: Live summaries for Fear & Greed index, News Tone sentiment distribution, DXY strength, and exchange flows. Includes hover tooltips detailing explanation definitions and concrete examples.
* Honest Strategist Payload: Standardized API endpoints exporting clean market microstructure data directly to external strategy makers.

## Quick Start

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
