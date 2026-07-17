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

# Setup logger
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

