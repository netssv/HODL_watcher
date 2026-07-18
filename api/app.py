"""
FastAPI application containing the endpoints for the HODL Watcher system.

Ensures:
1. Pydantic request and response validation models for all endpoints.
2. Graceful degradation via `data_gaps` on external API errors (no 500s).
3. Configurable horizons/features via POST request payloads.
4. Clean separation: route handlers do not run pandas operations directly.
"""

import os
import logging
import threading
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.routes import router, warmup_training
from data_ingestion.dxy import SOURCE_VERSION as MACRO_DXY_SOURCE

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Active macro_dxy source: %s", MACRO_DXY_SOURCE)
    # Warm up model in background — predict returns 503 until done
    threading.Thread(target=warmup_training, daemon=True).start()
    yield

app = FastAPI(
    title="HODL Watcher API",
    description="BTC/USDT Quantitative Analysis Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — explicit origins for production, env var override for flexibility
_extra_origin = os.environ.get("ALLOWED_ORIGIN", "")
_origins = [
    "http://localhost:5173",           # local Vite dev server
    "https://hodl-watcher.vercel.app", # production Vercel URL (update if renamed)
]
if _extra_origin:
    _origins.append(_extra_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://[a-zA-Z0-9-]+\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
