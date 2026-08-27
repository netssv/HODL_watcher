"""Static metadata and architectural definitions for HODL Watcher project map."""

PROJECT_METADATA = {
    "name": "HODL Watcher",
    "version": "1.0.0",
    "description": (
        "BTC/USDT quantitative analysis dashboard. Random Forest classifier "
        "predicts short-term price direction using walk-forward validation with "
        "honest metrics and SQLite-cached multi-source data ingestion."
    ),
    "tech_stack": {
        "backend": ["Python 3.10+", "FastAPI", "Pandas", "Scikit-Learn", "SQLite"],
        "frontend": ["React 19", "Vite", "Recharts", "Lucide React", "Vanilla CSS"],
        "testing": ["Pytest", "FastAPI TestClient"],
    },
    "layers": {
        "api": {
            "name": "API Layer",
            "path": "api/",
            "description": "FastAPI routes, schemas, CORS, orchestrators",
            "color": "#3b82f6",
        },
        "data_ingestion": {
            "name": "Data Ingestion",
            "path": "data_ingestion/",
            "description": "Multi-source market, macro, on-chain & news feeds with SQLite caching",
            "color": "#10b981",
        },
        "features": {
            "name": "Feature Engineering",
            "path": "features/",
            "description": "Indicator computation (RSI, MACD, Bollinger, deltas) & time-series alignment",
            "color": "#8b5cf6",
        },
        "model": {
            "name": "ML & Validation",
            "path": "model/",
            "description": "Walk-forward validation, expanding window, honest metrics, agent exporter",
            "color": "#f59e0b",
        },
        "frontend": {
            "name": "Frontend Dashboard",
            "path": "frontend/",
            "description": "Modular React SPA with real-time charts, indicators, and strategy views",
            "color": "#06b6d4",
        },
        "agents": {
            "name": "Agent Customizations & Skills",
            "path": ".agents/",
            "description": "Development agent skills, validation rules, and prompt constraints",
            "color": "#ec4899",
        },
    },
    "endpoints": [
        {
            "method": "GET",
            "path": "/api/predict",
            "description": "Returns current BTC prediction, confidence, market snapshot & validation metrics",
            "params": [],
            "response": "PredictResponse (meta, market_snapshot, model_prediction, validation_summary)",
        },
        {
            "method": "POST",
            "path": "/api/train",
            "description": "Triggers walk-forward recalibration with custom parameters",
            "params": ["horizon_hours", "n_folds", "threshold_pct", "features_config"],
            "response": "TrainResponse (success, metrics, validation_summary)",
        },
        {
            "method": "GET",
            "path": "/api/data/{symbol}",
            "description": "Retrieves cached or live OHLCV candle data",
            "params": ["symbol", "interval", "limit"],
            "response": "List[CandleData]",
        },
        {
            "method": "POST",
            "path": "/api/features",
            "description": "Inspects computed feature matrix for given parameters",
            "params": ["symbol", "limit", "features_config"],
            "response": "FeatureMatrixResponse",
        },
        {
            "method": "GET",
            "path": "/api/news-instructions",
            "description": "Agent instructions and search keywords for news ingestion",
            "params": [],
            "response": "NewsInstructionsResponse",
        },
    ],
    "data_flows": [
        {
            "step": 1,
            "title": "Ingestion & Caching",
            "layer": "data_ingestion",
            "detail": "Fetches Binance, Bybit, Coingecko, Mempool, Macro feeds with SQLite TTL caching & exponential backoff.",
        },
        {
            "step": 2,
            "title": "Feature Building",
            "layer": "features",
            "detail": "Merges series with merge_asof, computes technical indicators, funding rate deltas, and orderbook pressure.",
        },
        {
            "step": 3,
            "title": "Walk-Forward ML Validation",
            "layer": "model",
            "detail": "Expanding window cross-validation with embargo buffer prevents lookahead leakage; calculates honest accuracy vs naive baseline.",
        },
        {
            "step": 4,
            "title": "Agent Payload Export",
            "layer": "model",
            "detail": "Generates structured JSON payload including direction probabilities, top features, and confidence notes.",
        },
        {
            "step": 5,
            "title": "API & UI Delivery",
            "layer": "frontend",
            "detail": "FastAPI delivers payload to React SPA dashboard for real-time visualization and user interaction.",
        },
    ],
}
