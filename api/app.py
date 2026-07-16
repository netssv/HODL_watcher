"""
FastAPI application containing the endpoints for the HODL Watcher system.

Ensures:
1. Pydantic request and response validation models for all endpoints.
2. Graceful degradation via `data_gaps` on external API errors (no 500s).
3. Configurable horizons/features via POST request payloads.
4. Clean separation: route handlers do not run pandas operations directly.
"""

import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="HODL Watcher API",
    description="BTC/USDT Quantitative Analysis Backend",
    version="1.0.0"
)

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
