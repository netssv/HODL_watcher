window.EMBEDDED_PROJECT_MAP = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "schema_version": "1.0.0",
  "generated_at": "2026-08-27T00:16:59.019046+00:00",
  "project": {
    "name": "HODL Watcher",
    "version": "1.0.0",
    "description": "BTC/USDT quantitative analysis dashboard. Random Forest classifier predicts short-term price direction using walk-forward validation with honest metrics and SQLite-cached multi-source data ingestion.",
    "tech_stack": {
      "backend": [
        "Python 3.10+",
        "FastAPI",
        "Pandas",
        "Scikit-Learn",
        "SQLite"
      ],
      "frontend": [
        "React 19",
        "Vite",
        "Recharts",
        "Lucide React",
        "Vanilla CSS"
      ],
      "testing": [
        "Pytest",
        "FastAPI TestClient"
      ]
    },
    "layers": {
      "api": {
        "name": "API Layer",
        "path": "api/",
        "description": "FastAPI routes, schemas, CORS, orchestrators",
        "color": "#3b82f6"
      },
      "data_ingestion": {
        "name": "Data Ingestion",
        "path": "data_ingestion/",
        "description": "Multi-source market, macro, on-chain & news feeds with SQLite caching",
        "color": "#10b981"
      },
      "features": {
        "name": "Feature Engineering",
        "path": "features/",
        "description": "Indicator computation (RSI, MACD, Bollinger, deltas) & time-series alignment",
        "color": "#8b5cf6"
      },
      "model": {
        "name": "ML & Validation",
        "path": "model/",
        "description": "Walk-forward validation, expanding window, honest metrics, agent exporter",
        "color": "#f59e0b"
      },
      "frontend": {
        "name": "Frontend Dashboard",
        "path": "frontend/",
        "description": "Modular React SPA with real-time charts, indicators, and strategy views",
        "color": "#06b6d4"
      },
      "agents": {
        "name": "Agent Customizations & Skills",
        "path": ".agents/",
        "description": "Development agent skills, validation rules, and prompt constraints",
        "color": "#ec4899"
      }
    },
    "endpoints": [
      {
        "method": "GET",
        "path": "/api/predict",
        "description": "Returns current BTC prediction, confidence, market snapshot & validation metrics",
        "params": [],
        "response": "PredictResponse (meta, market_snapshot, model_prediction, validation_summary)"
      },
      {
        "method": "POST",
        "path": "/api/train",
        "description": "Triggers walk-forward recalibration with custom parameters",
        "params": [
          "horizon_hours",
          "n_folds",
          "threshold_pct",
          "features_config"
        ],
        "response": "TrainResponse (success, metrics, validation_summary)"
      },
      {
        "method": "GET",
        "path": "/api/data/{symbol}",
        "description": "Retrieves cached or live OHLCV candle data",
        "params": [
          "symbol",
          "interval",
          "limit"
        ],
        "response": "List[CandleData]"
      },
      {
        "method": "POST",
        "path": "/api/features",
        "description": "Inspects computed feature matrix for given parameters",
        "params": [
          "symbol",
          "limit",
          "features_config"
        ],
        "response": "FeatureMatrixResponse"
      },
      {
        "method": "GET",
        "path": "/api/news-instructions",
        "description": "Agent instructions and search keywords for news ingestion",
        "params": [],
        "response": "NewsInstructionsResponse"
      }
    ],
    "data_flows": [
      {
        "step": 1,
        "title": "Ingestion & Caching",
        "layer": "data_ingestion",
        "detail": "Fetches Binance, Bybit, Coingecko, Mempool, Macro feeds with SQLite TTL caching & exponential backoff."
      },
      {
        "step": 2,
        "title": "Feature Building",
        "layer": "features",
        "detail": "Merges series with merge_asof, computes technical indicators, funding rate deltas, and orderbook pressure."
      },
      {
        "step": 3,
        "title": "Walk-Forward ML Validation",
        "layer": "model",
        "detail": "Expanding window cross-validation with embargo buffer prevents lookahead leakage; calculates honest accuracy vs naive baseline."
      },
      {
        "step": 4,
        "title": "Agent Payload Export",
        "layer": "model",
        "detail": "Generates structured JSON payload including direction probabilities, top features, and confidence notes."
      },
      {
        "step": 5,
        "title": "API & UI Delivery",
        "layer": "frontend",
        "detail": "FastAPI delivers payload to React SPA dashboard for real-time visualization and user interaction."
      }
    ]
  },
  "summary": {
    "total_files": 178,
    "total_loc": 23144,
    "layer_breakdown": {
      "root_config": {
        "files": 18,
        "loc": 3172
      },
      "agents": {
        "files": 39,
        "loc": 2842
      },
      "data_ingestion": {
        "files": 22,
        "loc": 2432
      },
      "features": {
        "files": 3,
        "loc": 372
      },
      "model": {
        "files": 8,
        "loc": 863
      },
      "api": {
        "files": 5,
        "loc": 725
      },
      "tests": {
        "files": 8,
        "loc": 979
      },
      "frontend": {
        "files": 67,
        "loc": 9248
      },
      "scripts": {
        "files": 3,
        "loc": 379
      },
      "docs": {
        "files": 5,
        "loc": 2132
      }
    },
    "compliance": {
      "rule_200_lines_limit": {
        "compliant": false,
        "violations_count": 18,
        "violations": [
          {
            "path": ".agents/skills/caveman-compress/scripts/compress.py",
            "loc": 342,
            "layer": "agents"
          },
          {
            "path": ".agents/skills/caveman-compress/scripts/validate.py",
            "loc": 213,
            "layer": "agents"
          },
          {
            "path": "data_ingestion/binance_futures.py",
            "loc": 494,
            "layer": "data_ingestion"
          },
          {
            "path": "data_ingestion/mempool_onchain.py",
            "loc": 210,
            "layer": "data_ingestion"
          },
          {
            "path": "features/builder.py",
            "loc": 241,
            "layer": "features"
          },
          {
            "path": "model/agent_exporter.py",
            "loc": 254,
            "layer": "model"
          },
          {
            "path": "model/validation.py",
            "loc": 226,
            "layer": "model"
          },
          {
            "path": "api/routes.py",
            "loc": 286,
            "layer": "api"
          },
          {
            "path": "api/services.py",
            "loc": 285,
            "layer": "api"
          },
          {
            "path": "tests/test_data_ingestion.py",
            "loc": 515,
            "layer": "tests"
          },
          {
            "path": "frontend/src/components/CandlestickChart.jsx",
            "loc": 239,
            "layer": "frontend"
          },
          {
            "path": "frontend/src/components/PracticeView.jsx",
            "loc": 264,
            "layer": "frontend"
          },
          {
            "path": "frontend/src/components/TrainModal.jsx",
            "loc": 204,
            "layer": "frontend"
          },
          {
            "path": "frontend/src/styles/controls.css",
            "loc": 225,
            "layer": "frontend"
          },
          {
            "path": "frontend/src/styles/layout.css",
            "loc": 223,
            "layer": "frontend"
          },
          {
            "path": "frontend/src/utils/chartFactory.js",
            "loc": 248,
            "layer": "frontend"
          },
          {
            "path": "frontend/src/utils/chartIndicators.js",
            "loc": 210,
            "layer": "frontend"
          },
          {
            "path": "docs/map_assets/embedded_map.js",
            "loc": 1720,
            "layer": "docs"
          }
        ]
      }
    }
  },
  "files": [
    {
      "path": ".dockerignore",
      "name": ".dockerignore",
      "layer": "root_config",
      "loc": 16,
      "size_bytes": 157,
      "extension": ""
    },
    {
      "path": ".env",
      "name": ".env",
      "layer": "root_config",
      "loc": 37,
      "size_bytes": 1358,
      "extension": ""
    },
    {
      "path": ".env.example",
      "name": ".env.example",
      "layer": "root_config",
      "loc": 37,
      "size_bytes": 1068,
      "extension": ".example"
    },
    {
      "path": ".gitignore",
      "name": ".gitignore",
      "layer": "root_config",
      "loc": 38,
      "size_bytes": 357,
      "extension": ""
    },
    {
      "path": ".vercelignore",
      "name": ".vercelignore",
      "layer": "root_config",
      "loc": 31,
      "size_bytes": 387,
      "extension": ""
    },
    {
      "path": "DEPLOYMENT_MODES.md",
      "name": "DEPLOYMENT_MODES.md",
      "layer": "root_config",
      "loc": 57,
      "size_bytes": 2345,
      "extension": ".md"
    },
    {
      "path": "Dockerfile",
      "name": "Dockerfile",
      "layer": "root_config",
      "loc": 23,
      "size_bytes": 604,
      "extension": ""
    },
    {
      "path": "Makefile",
      "name": "Makefile",
      "layer": "root_config",
      "loc": 59,
      "size_bytes": 2311,
      "extension": ""
    },
    {
      "path": "PROJECT_MAP.md",
      "name": "PROJECT_MAP.md",
      "layer": "root_config",
      "loc": 309,
      "size_bytes": 15621,
      "extension": ".md"
    },
    {
      "path": "README.md",
      "name": "README.md",
      "layer": "root_config",
      "loc": 278,
      "size_bytes": 13719,
      "extension": ".md"
    },
    {
      "path": "dev.sh",
      "name": "dev.sh",
      "layer": "root_config",
      "loc": 252,
      "size_bytes": 8481,
      "extension": ".sh"
    },
    {
      "path": "project_map.html",
      "name": "project_map.html",
      "layer": "root_config",
      "loc": 113,
      "size_bytes": 4207,
      "extension": ".html"
    },
    {
      "path": "project_map.json",
      "name": "project_map.json",
      "layer": "root_config",
      "loc": 1720,
      "size_bytes": 41535,
      "extension": ".json"
    },
    {
      "path": "pyproject.toml",
      "name": "pyproject.toml",
      "layer": "root_config",
      "loc": 36,
      "size_bytes": 800,
      "extension": ".toml"
    },
    {
      "path": "requirements.txt",
      "name": "requirements.txt",
      "layer": "root_config",
      "loc": 8,
      "size_bytes": 127,
      "extension": ".txt"
    },
    {
      "path": "setup.sh",
      "name": "setup.sh",
      "layer": "root_config",
      "loc": 144,
      "size_bytes": 4514,
      "extension": ".sh"
    },
    {
      "path": "skills-lock.json",
      "name": "skills-lock.json",
      "layer": "agents",
      "loc": 47,
      "size_bytes": 1717,
      "extension": ".json"
    },
    {
      "path": "vercel.json",
      "name": "vercel.json",
      "layer": "root_config",
      "loc": 9,
      "size_bytes": 234,
      "extension": ".json"
    },
    {
      "path": ".agents/AGENTS.md",
      "name": "AGENTS.md",
      "layer": "agents",
      "loc": 5,
      "size_bytes": 423,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/free-api-rate-limiter/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 47,
      "size_bytes": 3597,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/free-api-rate-limiter/scripts/cache_utils.py",
      "name": "cache_utils.py",
      "layer": "agents",
      "loc": 108,
      "size_bytes": 3187,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/honest-metrics-reporter/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 41,
      "size_bytes": 3867,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/walk-forward-validator/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 44,
      "size_bytes": 3679,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/fastapi-pandas-endpoint/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 77,
      "size_bytes": 4092,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/no-data-leakage-checker/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 33,
      "size_bytes": 3626,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/no-data-leakage-checker/scripts/check_leakage.py",
      "name": "check_leakage.py",
      "layer": "agents",
      "loc": 80,
      "size_bytes": 2703,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/quant-dashboard-design/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 49,
      "size_bytes": 5538,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/hodl-dev-runner/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 145,
      "size_bytes": 4584,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/ponytail-audit/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 41,
      "size_bytes": 1652,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/ponytail-debt/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 44,
      "size_bytes": 1703,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/ponytail-gain/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 50,
      "size_bytes": 1973,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/ponytail-help/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 71,
      "size_bytes": 2796,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/ponytail-review/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 57,
      "size_bytes": 2383,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/ponytail/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 120,
      "size_bytes": 6637,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/cavecrew/README.md",
      "name": "README.md",
      "layer": "agents",
      "loc": 61,
      "size_bytes": 3043,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/cavecrew/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 82,
      "size_bytes": 3936,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman/README.md",
      "name": "README.md",
      "layer": "agents",
      "loc": 48,
      "size_bytes": 1898,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 78,
      "size_bytes": 5227,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-commit/README.md",
      "name": "README.md",
      "layer": "agents",
      "loc": 44,
      "size_bytes": 1226,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-commit/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 65,
      "size_bytes": 2588,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-compress/README.md",
      "name": "README.md",
      "layer": "agents",
      "loc": 163,
      "size_bytes": 5305,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-compress/SECURITY.md",
      "name": "SECURITY.md",
      "layer": "agents",
      "loc": 31,
      "size_bytes": 1557,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-compress/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 111,
      "size_bytes": 4535,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-compress/scripts/__init__.py",
      "name": "__init__.py",
      "layer": "agents",
      "loc": 9,
      "size_bytes": 224,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/caveman-compress/scripts/__main__.py",
      "name": "__main__.py",
      "layer": "agents",
      "loc": 3,
      "size_bytes": 30,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/caveman-compress/scripts/benchmark.py",
      "name": "benchmark.py",
      "layer": "agents",
      "loc": 80,
      "size_bytes": 2425,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/caveman-compress/scripts/cli.py",
      "name": "cli.py",
      "layer": "agents",
      "loc": 85,
      "size_bytes": 2089,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/caveman-compress/scripts/compress.py",
      "name": "compress.py",
      "layer": "agents",
      "loc": 342,
      "size_bytes": 13146,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/caveman-compress/scripts/detect.py",
      "name": "detect.py",
      "layer": "agents",
      "loc": 139,
      "size_bytes": 4761,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/caveman-compress/scripts/validate.py",
      "name": "validate.py",
      "layer": "agents",
      "loc": 213,
      "size_bytes": 5752,
      "extension": ".py"
    },
    {
      "path": ".agents/skills/caveman-help/README.md",
      "name": "README.md",
      "layer": "agents",
      "loc": 38,
      "size_bytes": 976,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-help/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 63,
      "size_bytes": 2300,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-review/README.md",
      "name": "README.md",
      "layer": "agents",
      "loc": 33,
      "size_bytes": 1210,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-review/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 55,
      "size_bytes": 2739,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-stats/README.md",
      "name": "README.md",
      "layer": "agents",
      "loc": 30,
      "size_bytes": 936,
      "extension": ".md"
    },
    {
      "path": ".agents/skills/caveman-stats/SKILL.md",
      "name": "SKILL.md",
      "layer": "agents",
      "loc": 10,
      "size_bytes": 607,
      "extension": ".md"
    },
    {
      "path": "data_ingestion/__init__.py",
      "name": "__init__.py",
      "layer": "data_ingestion",
      "loc": 51,
      "size_bytes": 1143,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/binance_futures.py",
      "name": "binance_futures.py",
      "layer": "data_ingestion",
      "loc": 494,
      "size_bytes": 16554,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/binance_spot.py",
      "name": "binance_spot.py",
      "layer": "data_ingestion",
      "loc": 183,
      "size_bytes": 5378,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/bybit.py",
      "name": "bybit.py",
      "layer": "data_ingestion",
      "loc": 127,
      "size_bytes": 6360,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/cache_utils.py",
      "name": "cache_utils.py",
      "layer": "data_ingestion",
      "loc": 150,
      "size_bytes": 4723,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/coinalyze.py",
      "name": "coinalyze.py",
      "layer": "data_ingestion",
      "loc": 55,
      "size_bytes": 2024,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/coingecko.py",
      "name": "coingecko.py",
      "layer": "data_ingestion",
      "loc": 187,
      "size_bytes": 5638,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/config.py",
      "name": "config.py",
      "layer": "data_ingestion",
      "loc": 52,
      "size_bytes": 1835,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/deribit.py",
      "name": "deribit.py",
      "layer": "data_ingestion",
      "loc": 55,
      "size_bytes": 2172,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/dxy.py",
      "name": "dxy.py",
      "layer": "data_ingestion",
      "loc": 52,
      "size_bytes": 1771,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/etf_flows.py",
      "name": "etf_flows.py",
      "layer": "data_ingestion",
      "loc": 67,
      "size_bytes": 2400,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/fear_greed.py",
      "name": "fear_greed.py",
      "layer": "data_ingestion",
      "loc": 86,
      "size_bytes": 2315,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/fred_macro.py",
      "name": "fred_macro.py",
      "layer": "data_ingestion",
      "loc": 159,
      "size_bytes": 4918,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/hyperliquid.py",
      "name": "hyperliquid.py",
      "layer": "data_ingestion",
      "loc": 92,
      "size_bytes": 2554,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/kraken.py",
      "name": "kraken.py",
      "layer": "data_ingestion",
      "loc": 53,
      "size_bytes": 2173,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/mempool_onchain.py",
      "name": "mempool_onchain.py",
      "layer": "data_ingestion",
      "loc": 210,
      "size_bytes": 6041,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/news_coindesk.py",
      "name": "news_coindesk.py",
      "layer": "data_ingestion",
      "loc": 45,
      "size_bytes": 1688,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/news_currents.py",
      "name": "news_currents.py",
      "layer": "data_ingestion",
      "loc": 113,
      "size_bytes": 3379,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/news_gnews.py",
      "name": "news_gnews.py",
      "layer": "data_ingestion",
      "loc": 28,
      "size_bytes": 1433,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/news_newsapi.py",
      "name": "news_newsapi.py",
      "layer": "data_ingestion",
      "loc": 107,
      "size_bytes": 3400,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/okx.py",
      "name": "okx.py",
      "layer": "data_ingestion",
      "loc": 54,
      "size_bytes": 2226,
      "extension": ".py"
    },
    {
      "path": "data_ingestion/onchain_metrics.py",
      "name": "onchain_metrics.py",
      "layer": "data_ingestion",
      "loc": 12,
      "size_bytes": 428,
      "extension": ".py"
    },
    {
      "path": "features/__init__.py",
      "name": "__init__.py",
      "layer": "features",
      "loc": 5,
      "size_bytes": 152,
      "extension": ".py"
    },
    {
      "path": "features/builder.py",
      "name": "builder.py",
      "layer": "features",
      "loc": 241,
      "size_bytes": 11268,
      "extension": ".py"
    },
    {
      "path": "features/indicators.py",
      "name": "indicators.py",
      "layer": "features",
      "loc": 126,
      "size_bytes": 5028,
      "extension": ".py"
    },
    {
      "path": "model/__init__.py",
      "name": "__init__.py",
      "layer": "model",
      "loc": 3,
      "size_bytes": 83,
      "extension": ".py"
    },
    {
      "path": "model/agent_exporter.py",
      "name": "agent_exporter.py",
      "layer": "model",
      "loc": 254,
      "size_bytes": 12727,
      "extension": ".py"
    },
    {
      "path": "model/backtest.py",
      "name": "backtest.py",
      "layer": "model",
      "loc": 104,
      "size_bytes": 3542,
      "extension": ".py"
    },
    {
      "path": "model/inference.py",
      "name": "inference.py",
      "layer": "model",
      "loc": 33,
      "size_bytes": 1347,
      "extension": ".py"
    },
    {
      "path": "model/labeling.py",
      "name": "labeling.py",
      "layer": "model",
      "loc": 48,
      "size_bytes": 1820,
      "extension": ".py"
    },
    {
      "path": "model/validation.py",
      "name": "validation.py",
      "layer": "model",
      "loc": 226,
      "size_bytes": 9511,
      "extension": ".py"
    },
    {
      "path": "model/validation_metrics.py",
      "name": "validation_metrics.py",
      "layer": "model",
      "loc": 132,
      "size_bytes": 5240,
      "extension": ".py"
    },
    {
      "path": "model/validation_trading.py",
      "name": "validation_trading.py",
      "layer": "model",
      "loc": 63,
      "size_bytes": 1957,
      "extension": ".py"
    },
    {
      "path": "api/__init__.py",
      "name": "__init__.py",
      "layer": "api",
      "loc": 3,
      "size_bytes": 56,
      "extension": ".py"
    },
    {
      "path": "api/app.py",
      "name": "app.py",
      "layer": "api",
      "loc": 69,
      "size_bytes": 2027,
      "extension": ".py"
    },
    {
      "path": "api/routes.py",
      "name": "routes.py",
      "layer": "api",
      "loc": 286,
      "size_bytes": 14589,
      "extension": ".py"
    },
    {
      "path": "api/schemas.py",
      "name": "schemas.py",
      "layer": "api",
      "loc": 82,
      "size_bytes": 2156,
      "extension": ".py"
    },
    {
      "path": "api/services.py",
      "name": "services.py",
      "layer": "api",
      "loc": 285,
      "size_bytes": 12263,
      "extension": ".py"
    },
    {
      "path": "tests/__init__.py",
      "name": "__init__.py",
      "layer": "tests",
      "loc": 1,
      "size_bytes": 16,
      "extension": ".py"
    },
    {
      "path": "tests/test_agent_exporter.py",
      "name": "test_agent_exporter.py",
      "layer": "tests",
      "loc": 76,
      "size_bytes": 2539,
      "extension": ".py"
    },
    {
      "path": "tests/test_api.py",
      "name": "test_api.py",
      "layer": "tests",
      "loc": 112,
      "size_bytes": 3350,
      "extension": ".py"
    },
    {
      "path": "tests/test_data_ingestion.py",
      "name": "test_data_ingestion.py",
      "layer": "tests",
      "loc": 515,
      "size_bytes": 19471,
      "extension": ".py"
    },
    {
      "path": "tests/test_features.py",
      "name": "test_features.py",
      "layer": "tests",
      "loc": 120,
      "size_bytes": 3875,
      "extension": ".py"
    },
    {
      "path": "tests/test_inference.py",
      "name": "test_inference.py",
      "layer": "tests",
      "loc": 15,
      "size_bytes": 630,
      "extension": ".py"
    },
    {
      "path": "tests/test_project_map.py",
      "name": "test_project_map.py",
      "layer": "tests",
      "loc": 27,
      "size_bytes": 825,
      "extension": ".py"
    },
    {
      "path": "tests/test_validation.py",
      "name": "test_validation.py",
      "layer": "tests",
      "loc": 113,
      "size_bytes": 4197,
      "extension": ".py"
    },
    {
      "path": "frontend/.env.example",
      "name": ".env.example",
      "layer": "frontend",
      "loc": 8,
      "size_bytes": 303,
      "extension": ".example"
    },
    {
      "path": "frontend/.env.production",
      "name": ".env.production",
      "layer": "frontend",
      "loc": 4,
      "size_bytes": 311,
      "extension": ".production"
    },
    {
      "path": "frontend/.gitignore",
      "name": ".gitignore",
      "layer": "frontend",
      "loc": 24,
      "size_bytes": 253,
      "extension": ""
    },
    {
      "path": "frontend/.oxlintrc.json",
      "name": ".oxlintrc.json",
      "layer": "frontend",
      "loc": 8,
      "size_bytes": 231,
      "extension": ".json"
    },
    {
      "path": "frontend/README.md",
      "name": "README.md",
      "layer": "frontend",
      "loc": 16,
      "size_bytes": 1009,
      "extension": ".md"
    },
    {
      "path": "frontend/index.html",
      "name": "index.html",
      "layer": "frontend",
      "loc": 13,
      "size_bytes": 364,
      "extension": ".html"
    },
    {
      "path": "frontend/package-lock.json",
      "name": "package-lock.json",
      "layer": "frontend",
      "loc": 1931,
      "size_bytes": 64949,
      "extension": ".json"
    },
    {
      "path": "frontend/package.json",
      "name": "package.json",
      "layer": "frontend",
      "loc": 28,
      "size_bytes": 614,
      "extension": ".json"
    },
    {
      "path": "frontend/vercel.json",
      "name": "vercel.json",
      "layer": "frontend",
      "loc": 9,
      "size_bytes": 197,
      "extension": ".json"
    },
    {
      "path": "frontend/vite.config.js",
      "name": "vite.config.js",
      "layer": "frontend",
      "loc": 25,
      "size_bytes": 666,
      "extension": ".js"
    },
    {
      "path": "frontend/public/chime.wav",
      "name": "chime.wav",
      "layer": "frontend",
      "loc": 1023,
      "size_bytes": 35324,
      "extension": ".wav"
    },
    {
      "path": "frontend/public/click.wav",
      "name": "click.wav",
      "layer": "frontend",
      "loc": 149,
      "size_bytes": 8864,
      "extension": ".wav"
    },
    {
      "path": "frontend/public/favicon.svg",
      "name": "favicon.svg",
      "layer": "frontend",
      "loc": 4,
      "size_bytes": 689,
      "extension": ".svg"
    },
    {
      "path": "frontend/public/icons.svg",
      "name": "icons.svg",
      "layer": "frontend",
      "loc": 24,
      "size_bytes": 5031,
      "extension": ".svg"
    },
    {
      "path": "frontend/src/App.css",
      "name": "App.css",
      "layer": "frontend",
      "loc": 192,
      "size_bytes": 3256,
      "extension": ".css"
    },
    {
      "path": "frontend/src/App.jsx",
      "name": "App.jsx",
      "layer": "frontend",
      "loc": 200,
      "size_bytes": 8700,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/index.css",
      "name": "index.css",
      "layer": "frontend",
      "loc": 11,
      "size_bytes": 401,
      "extension": ".css"
    },
    {
      "path": "frontend/src/main.jsx",
      "name": "main.jsx",
      "layer": "frontend",
      "loc": 41,
      "size_bytes": 1242,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/utils.jsx",
      "name": "utils.jsx",
      "layer": "frontend",
      "loc": 155,
      "size_bytes": 8939,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/assets/hero.png",
      "name": "hero.png",
      "layer": "frontend",
      "loc": 98,
      "size_bytes": 13057,
      "extension": ".png"
    },
    {
      "path": "frontend/src/assets/react.svg",
      "name": "react.svg",
      "layer": "frontend",
      "loc": 1,
      "size_bytes": 4126,
      "extension": ".svg"
    },
    {
      "path": "frontend/src/assets/vite.svg",
      "name": "vite.svg",
      "layer": "frontend",
      "loc": 1,
      "size_bytes": 8709,
      "extension": ".svg"
    },
    {
      "path": "frontend/src/components/AddWidgetMenu.jsx",
      "name": "AddWidgetMenu.jsx",
      "layer": "frontend",
      "loc": 71,
      "size_bytes": 2736,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/AdvancedIndicators.jsx",
      "name": "AdvancedIndicators.jsx",
      "layer": "frontend",
      "loc": 80,
      "size_bytes": 2823,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/ApiPipelineCard.jsx",
      "name": "ApiPipelineCard.jsx",
      "layer": "frontend",
      "loc": 74,
      "size_bytes": 3593,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/CandlestickChart.jsx",
      "name": "CandlestickChart.jsx",
      "layer": "frontend",
      "loc": 239,
      "size_bytes": 11455,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/ChartSubComponents.jsx",
      "name": "ChartSubComponents.jsx",
      "layer": "frontend",
      "loc": 165,
      "size_bytes": 6437,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/ChartUI.jsx",
      "name": "ChartUI.jsx",
      "layer": "frontend",
      "loc": 145,
      "size_bytes": 6796,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/CompositeScore.jsx",
      "name": "CompositeScore.jsx",
      "layer": "frontend",
      "loc": 88,
      "size_bytes": 5678,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/ContentPanels.jsx",
      "name": "ContentPanels.jsx",
      "layer": "frontend",
      "loc": 7,
      "size_bytes": 430,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/GuideBanner.jsx",
      "name": "GuideBanner.jsx",
      "layer": "frontend",
      "loc": 49,
      "size_bytes": 3955,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/Header.jsx",
      "name": "Header.jsx",
      "layer": "frontend",
      "loc": 200,
      "size_bytes": 10833,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/LLMPayloadCard.jsx",
      "name": "LLMPayloadCard.jsx",
      "layer": "frontend",
      "loc": 105,
      "size_bytes": 5874,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/LiqProfilePanel.jsx",
      "name": "LiqProfilePanel.jsx",
      "layer": "frontend",
      "loc": 192,
      "size_bytes": 8036,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/MicrostructureGroup.jsx",
      "name": "MicrostructureGroup.jsx",
      "layer": "frontend",
      "loc": 76,
      "size_bytes": 4243,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/NewsSentimentCard.jsx",
      "name": "NewsSentimentCard.jsx",
      "layer": "frontend",
      "loc": 41,
      "size_bytes": 1899,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/PracticeView.jsx",
      "name": "PracticeView.jsx",
      "layer": "frontend",
      "loc": 264,
      "size_bytes": 23459,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/ProjectionsPanel.jsx",
      "name": "ProjectionsPanel.jsx",
      "layer": "frontend",
      "loc": 95,
      "size_bytes": 4656,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/RiskManagementCard.jsx",
      "name": "RiskManagementCard.jsx",
      "layer": "frontend",
      "loc": 38,
      "size_bytes": 1906,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/SetupCard.jsx",
      "name": "SetupCard.jsx",
      "layer": "frontend",
      "loc": 150,
      "size_bytes": 8662,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/Sidebar.jsx",
      "name": "Sidebar.jsx",
      "layer": "frontend",
      "loc": 4,
      "size_bytes": 253,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/SnapshotCards.jsx",
      "name": "SnapshotCards.jsx",
      "layer": "frontend",
      "loc": 98,
      "size_bytes": 4919,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/SnapshotGroups.jsx",
      "name": "SnapshotGroups.jsx",
      "layer": "frontend",
      "loc": 113,
      "size_bytes": 6435,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/StrategyCard.jsx",
      "name": "StrategyCard.jsx",
      "layer": "frontend",
      "loc": 40,
      "size_bytes": 1917,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/TrainModal.jsx",
      "name": "TrainModal.jsx",
      "layer": "frontend",
      "loc": 204,
      "size_bytes": 7653,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/ValidationChart.jsx",
      "name": "ValidationChart.jsx",
      "layer": "frontend",
      "loc": 125,
      "size_bytes": 7777,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/WidgetGrid.jsx",
      "name": "WidgetGrid.jsx",
      "layer": "frontend",
      "loc": 151,
      "size_bytes": 5064,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/WidgetTray.jsx",
      "name": "WidgetTray.jsx",
      "layer": "frontend",
      "loc": 61,
      "size_bytes": 2462,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/components/indHelpers.jsx",
      "name": "indHelpers.jsx",
      "layer": "frontend",
      "loc": 56,
      "size_bytes": 1814,
      "extension": ".jsx"
    },
    {
      "path": "frontend/src/styles/controls.css",
      "name": "controls.css",
      "layer": "frontend",
      "loc": 225,
      "size_bytes": 6290,
      "extension": ".css"
    },
    {
      "path": "frontend/src/styles/indicators.css",
      "name": "indicators.css",
      "layer": "frontend",
      "loc": 199,
      "size_bytes": 5712,
      "extension": ".css"
    },
    {
      "path": "frontend/src/styles/layout.css",
      "name": "layout.css",
      "layer": "frontend",
      "loc": 223,
      "size_bytes": 8433,
      "extension": ".css"
    },
    {
      "path": "frontend/src/styles/modal.css",
      "name": "modal.css",
      "layer": "frontend",
      "loc": 91,
      "size_bytes": 5607,
      "extension": ".css"
    },
    {
      "path": "frontend/src/styles/projections.css",
      "name": "projections.css",
      "layer": "frontend",
      "loc": 155,
      "size_bytes": 5411,
      "extension": ".css"
    },
    {
      "path": "frontend/src/styles/tokens.css",
      "name": "tokens.css",
      "layer": "frontend",
      "loc": 122,
      "size_bytes": 4330,
      "extension": ".css"
    },
    {
      "path": "frontend/src/styles/ui.css",
      "name": "ui.css",
      "layer": "frontend",
      "loc": 69,
      "size_bytes": 6954,
      "extension": ".css"
    },
    {
      "path": "frontend/src/styles/widget.css",
      "name": "widget.css",
      "layer": "frontend",
      "loc": 36,
      "size_bytes": 1319,
      "extension": ".css"
    },
    {
      "path": "frontend/src/hooks/useChartData.js",
      "name": "useChartData.js",
      "layer": "frontend",
      "loc": 117,
      "size_bytes": 4455,
      "extension": ".js"
    },
    {
      "path": "frontend/src/hooks/useLiqMap.js",
      "name": "useLiqMap.js",
      "layer": "frontend",
      "loc": 190,
      "size_bytes": 6131,
      "extension": ".js"
    },
    {
      "path": "frontend/src/hooks/usePracticeSession.js",
      "name": "usePracticeSession.js",
      "layer": "frontend",
      "loc": 71,
      "size_bytes": 2474,
      "extension": ".js"
    },
    {
      "path": "frontend/src/hooks/usePredictData.js",
      "name": "usePredictData.js",
      "layer": "frontend",
      "loc": 188,
      "size_bytes": 8619,
      "extension": ".js"
    },
    {
      "path": "frontend/src/hooks/useSidebarCollapse.js",
      "name": "useSidebarCollapse.js",
      "layer": "frontend",
      "loc": 22,
      "size_bytes": 545,
      "extension": ".js"
    },
    {
      "path": "frontend/src/hooks/useVisiblePriceRange.js",
      "name": "useVisiblePriceRange.js",
      "layer": "frontend",
      "loc": 43,
      "size_bytes": 1392,
      "extension": ".js"
    },
    {
      "path": "frontend/src/hooks/useWidgetLayout.js",
      "name": "useWidgetLayout.js",
      "layer": "frontend",
      "loc": 73,
      "size_bytes": 2271,
      "extension": ".js"
    },
    {
      "path": "frontend/src/utils/chartFactory.js",
      "name": "chartFactory.js",
      "layer": "frontend",
      "loc": 248,
      "size_bytes": 10448,
      "extension": ".js"
    },
    {
      "path": "frontend/src/utils/chartIndicators.js",
      "name": "chartIndicators.js",
      "layer": "frontend",
      "loc": 210,
      "size_bytes": 6739,
      "extension": ".js"
    },
    {
      "path": "frontend/src/utils/chartMath.js",
      "name": "chartMath.js",
      "layer": "frontend",
      "loc": 70,
      "size_bytes": 2424,
      "extension": ".js"
    },
    {
      "path": "scripts/generate_project_map.py",
      "name": "generate_project_map.py",
      "layer": "scripts",
      "loc": 172,
      "size_bytes": 5511,
      "extension": ".py"
    },
    {
      "path": "scripts/map_metadata.py",
      "name": "map_metadata.py",
      "layer": "scripts",
      "loc": 123,
      "size_bytes": 4910,
      "extension": ".py"
    },
    {
      "path": "scripts/smoke_test.py",
      "name": "smoke_test.py",
      "layer": "scripts",
      "loc": 84,
      "size_bytes": 2776,
      "extension": ".py"
    },
    {
      "path": "docs/API_AGENT_EN.md",
      "name": "API_AGENT_EN.md",
      "layer": "docs",
      "loc": 35,
      "size_bytes": 1294,
      "extension": ".md"
    },
    {
      "path": "docs/API_AGENT_ES.md",
      "name": "API_AGENT_ES.md",
      "layer": "docs",
      "loc": 33,
      "size_bytes": 1344,
      "extension": ".md"
    },
    {
      "path": "docs/map_assets/embedded_map.js",
      "name": "embedded_map.js",
      "layer": "docs",
      "loc": 1720,
      "size_bytes": 41567,
      "extension": ".js"
    },
    {
      "path": "docs/map_assets/map_viewer.css",
      "name": "map_viewer.css",
      "layer": "docs",
      "loc": 180,
      "size_bytes": 5643,
      "extension": ".css"
    },
    {
      "path": "docs/map_assets/map_viewer.js",
      "name": "map_viewer.js",
      "layer": "docs",
      "loc": 164,
      "size_bytes": 6170,
      "extension": ".js"
    },
    {
      "path": "execution/README.md",
      "name": "README.md",
      "layer": "root_config",
      "loc": 5,
      "size_bytes": 263,
      "extension": ".md"
    }
  ]
};
