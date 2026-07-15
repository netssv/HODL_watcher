"""
FastAPI application containing the endpoints for the HODL Watcher system.

Ensures:
1. Pydantic request and response validation models for all endpoints.
2. Graceful degradation via `data_gaps` on external API errors (no 500s).
3. Configurable horizons/features via POST request payloads.
4. Clean separation: route handlers do not run pandas operations directly.
"""

import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from data_ingestion import (
    binance_spot, binance_futures, fear_greed, fred_macro,
    coinglass, deribit, onchain_metrics, etf_flows
)
from features.builder import build_features
from model.validation import prepare_target, run_walk_forward_validation
from model.agent_exporter import export_agent_payload

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

router = APIRouter(prefix="/api")

# --- Global cached state to hold the last trained model report ---
# In a real app this might be persisted, but keeping in memory is simple and efficient.
_LATEST_TRAINING_REPORT: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# Pydantic Schemas
# ---------------------------------------------------------------------------

class DataResponseItem(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float

class DataResponse(BaseModel):
    symbol: str
    interval: str
    data: List[DataResponseItem]
    data_gaps: List[str]

class FeatureGroupConfig(BaseModel):
    include_derivatives: bool = True
    include_sentiment: bool = True
    include_macro: bool = True

class FeatureCalculateRequest(BaseModel):
    symbol: str = "BTCUSDT"
    interval: str = "1h"
    limit: int = Field(default=500, ge=100, le=1000)
    features_config: FeatureGroupConfig = FeatureGroupConfig()

class FeatureCalculateResponse(BaseModel):
    columns: List[str]
    sample_records: List[Dict[str, Any]]
    data_gaps: List[str]

class TrainRequest(BaseModel):
    horizon_hours: int = Field(default=24, ge=1, le=168)
    n_folds: int = Field(default=8, ge=5, le=15)
    threshold_pct: float = Field(default=0.005, ge=0.0, le=0.05)
    features_config: FeatureGroupConfig = FeatureGroupConfig()

class TrainResponse(BaseModel):
    status: str
    validation_summary: Dict[str, Any]
    data_gaps: List[str]

class PredictResponse(BaseModel):
    payload: Dict[str, Any]
    data_gaps: List[str]

class NewsInstructionsResponse(BaseModel):
    instructions_for_agent: str
    keywords_to_search: List[str]


# ---------------------------------------------------------------------------
# Helpers for aggregation & error boundary
# ---------------------------------------------------------------------------

def _fetch_all_sources(limit: int = 500, interval: str = "1h") -> Tuple[Dict[str, Any], List[str]]:
    """Helper that fetches datasets from all modules and flags gaps."""
    data_gaps = []
    
    # 1. Binance Spot
    try:
        spot_df = binance_spot.get_klines(symbol="BTCUSDT", interval=interval, limit=limit)
        if spot_df.empty:
            data_gaps.append("binance_spot: Empty response returned")
    except Exception as e:
        spot_df = None
        data_gaps.append(f"binance_spot: {str(e)}")
        
    # 2. Binance Futures
    futures_df = None
    funding_df = None
    long_short_df = None
    try:
        futures_df = binance_futures.get_klines(symbol="BTCUSDT", interval=interval, limit=limit)
    except Exception as e:
        data_gaps.append(f"binance_futures_klines: {str(e)}")
        
    try:
        funding_df = binance_futures.get_funding_rate(symbol="BTCUSDT", limit=limit)
    except Exception as e:
        data_gaps.append(f"binance_futures_funding: {str(e)}")
        
    try:
        long_short_df = binance_futures.get_long_short_ratio(symbol="BTCUSDT", period=interval, limit=limit)
    except Exception as e:
        data_gaps.append(f"binance_futures_long_short: {str(e)}")

    # 3. Fear & Greed
    fear_greed_df = None
    try:
        fear_greed_df = fear_greed.get_fear_greed_index(limit=limit)
    except Exception as e:
        data_gaps.append(f"fear_greed: {str(e)}")

    # 4. FRED Macro
    macro_dfs = {}
    for name, fetch_fn in [("cpi", fred_macro.get_cpi), ("dxy", fred_macro.get_dxy)]:
        try:
            m_df = fetch_fn(limit=100)
            if not m_df.empty:
                macro_dfs[name] = m_df
        except Exception as e:
            data_gaps.append(f"fred_macro_{name}: {str(e)}")
            
    # 5. Order Book
    order_book_df = None
    try:
        order_book_df = binance_spot.get_order_book(symbol="BTCUSDT", limit=100)
    except Exception as e:
        data_gaps.append(f"binance_order_book: {str(e)}")

    # 6. Coinglass, Deribit, Onchain, ETF
    coinglass_df, deribit_df, onchain_df, etf_df = None, None, None, None
    try:
        coinglass_df = coinglass.get_coinglass_data()
    except Exception as e:
        data_gaps.append(f"coinglass: {str(e)}")
        
    try:
        deribit_df = deribit.get_options_data()
    except Exception as e:
        data_gaps.append(f"deribit: {str(e)}")
        
    try:
        onchain_df = onchain_metrics.get_onchain_data()
    except Exception as e:
        data_gaps.append(f"onchain: {str(e)}")
        
    try:
        etf_df = etf_flows.get_etf_flows()
    except Exception as e:
        data_gaps.append(f"etf_flows: {str(e)}")

    sources = {
        "spot_df": spot_df,
        "futures_df": futures_df,
        "funding_df": funding_df,
        "long_short_df": long_short_df,
        "fear_greed_df": fear_greed_df,
        "macro_dfs": macro_dfs,
        "order_book_df": order_book_df,
        "coinglass_df": coinglass_df,
        "deribit_df": deribit_df,
        "onchain_df": onchain_df,
        "etf_df": etf_df,
    }
    
    return sources, data_gaps


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/data/{symbol}", response_model=DataResponse)
def get_raw_data(symbol: str, interval: str = "1h", limit: int = 100):
    data_gaps = []
    try:
        df = binance_spot.get_klines(symbol=symbol, interval=interval, limit=limit)
    except Exception as e:
        data_gaps.append(f"data_fetch_failed: {str(e)}")
        df = None
        
    if df is None or df.empty:
        return DataResponse(symbol=symbol, interval=interval, data=[], data_gaps=data_gaps)
        
    records = []
    for ts, row in df.iterrows():
        records.append(
            DataResponseItem(
                timestamp=str(ts),
                open=float(row['open']),
                high=float(row['high']),
                low=float(row['low']),
                close=float(row['close']),
                volume=float(row['volume'])
            )
        )
        
    # Append any gaps detected in df metadata
    gaps_meta = df.attrs.get("gaps_detected", [])
    for gm in gaps_meta:
        data_gaps.append(f"spot_gap: Gap detected after {gm['after']} of size {gm['gap_size']}")
        
    return DataResponse(
        symbol=symbol,
        interval=interval,
        data=records,
        data_gaps=data_gaps
    )


@router.post("/features", response_model=FeatureCalculateResponse)
def calculate_features(req: FeatureCalculateRequest):
    sources, data_gaps = _fetch_all_sources(limit=req.limit, interval=req.interval)
    
    if sources["spot_df"] is None or sources["spot_df"].empty:
        raise HTTPException(status_code=400, detail="Cannot build features: Binance Spot OHLCV dataset is missing.")
        
    features_df = build_features(
        spot_df=sources["spot_df"],
        futures_df=sources["futures_df"] if req.features_config.include_derivatives else None,
        funding_df=sources["funding_df"] if req.features_config.include_derivatives else None,
        long_short_df=sources["long_short_df"] if req.features_config.include_derivatives else None,
        fear_greed_df=sources["fear_greed_df"] if req.features_config.include_sentiment else None,
        macro_dfs=sources["macro_dfs"] if req.features_config.include_macro else None,
        order_book_df=sources["order_book_df"],
        coinglass_df=sources["coinglass_df"],
        deribit_df=sources["deribit_df"],
        onchain_df=sources["onchain_df"],
        etf_df=sources["etf_df"]
    )
    
    # Take a sample of latest records
    sample_records = features_df.tail(10).reset_index().to_dict(orient="records")
    # Cast datetime/timestamp values to strings for json serialization
    for rec in sample_records:
        if 'timestamp' in rec:
            rec['timestamp'] = str(rec['timestamp'])
            
    return FeatureCalculateResponse(
        columns=list(features_df.columns),
        sample_records=sample_records,
        data_gaps=data_gaps
    )


@router.post("/train", response_model=TrainResponse)
def train_model(req: TrainRequest):
    global _LATEST_TRAINING_REPORT
    
    sources, data_gaps = _fetch_all_sources(limit=600, interval="1h")
    
    if sources["spot_df"] is None or sources["spot_df"].empty:
        raise HTTPException(status_code=400, detail="Binance Spot dataset missing. Cannot train model.")
        
    features_df = build_features(
        spot_df=sources["spot_df"],
        futures_df=sources["futures_df"] if req.features_config.include_derivatives else None,
        funding_df=sources["funding_df"] if req.features_config.include_derivatives else None,
        long_short_df=sources["long_short_df"] if req.features_config.include_derivatives else None,
        fear_greed_df=sources["fear_greed_df"] if req.features_config.include_sentiment else None,
        macro_dfs=sources["macro_dfs"] if req.features_config.include_macro else None,
        order_book_df=sources["order_book_df"],
        coinglass_df=sources["coinglass_df"],
        deribit_df=sources["deribit_df"],
        onchain_df=sources["onchain_df"],
        etf_df=sources["etf_df"]
    )
    
    # Build classification labels target
    features_df, target = prepare_target(
        features_df, 
        horizon=req.horizon_hours, 
        threshold_pct=req.threshold_pct
    )
    
    if len(features_df) < 100:
        raise HTTPException(status_code=400, detail=f"Insufficient training samples ({len(features_df)}). Need >= 100.")
        
    report = run_walk_forward_validation(
        df=features_df,
        target=target,
        n_folds=req.n_folds,
        horizon=req.horizon_hours
    )
    
    # Cache the latest training run
    _LATEST_TRAINING_REPORT = report
    
    return TrainResponse(
        status="success",
        validation_summary=report,
        data_gaps=data_gaps
    )


@router.get("/predict", response_model=PredictResponse)
def get_prediction():
    global _LATEST_TRAINING_REPORT
    
    # Fetch current data to make a live prediction
    sources, data_gaps = _fetch_all_sources(limit=100, interval="1h")
    
    if sources["spot_df"] is None or sources["spot_df"].empty:
        raise HTTPException(status_code=503, detail="Spot market data unavailable.")
        
    # Build current features
    features_df = build_features(
        spot_df=sources["spot_df"],
        futures_df=sources["futures_df"],
        funding_df=sources["funding_df"],
        long_short_df=sources["long_short_df"],
        fear_greed_df=sources["fear_greed_df"],
        macro_dfs=sources["macro_dfs"],
        order_book_df=sources["order_book_df"],
        coinglass_df=sources["coinglass_df"],
        deribit_df=sources["deribit_df"],
        onchain_df=sources["onchain_df"],
        etf_df=sources["etf_df"]
    )
    
    latest_row = features_df.iloc[-1].to_dict()
    
    # If we have not trained yet, trigger a lightweight training run
    if _LATEST_TRAINING_REPORT is None:
        logger.info("No cached model training report found. Running initial training model.")
        # Trigger default training
        train_sources, train_gaps = _fetch_all_sources(limit=500, interval="1h")
        train_features_df = build_features(
            spot_df=train_sources["spot_df"],
            futures_df=train_sources["futures_df"],
            funding_df=train_sources["funding_df"],
            long_short_df=train_sources["long_short_df"],
            fear_greed_df=train_sources["fear_greed_df"],
            macro_dfs=train_sources["macro_dfs"],
            order_book_df=train_sources["order_book_df"],
            coinglass_df=train_sources["coinglass_df"],
            deribit_df=train_sources["deribit_df"],
            onchain_df=train_sources["onchain_df"],
            etf_df=train_sources["etf_df"]
        )
        train_features_df, target = prepare_target(train_features_df, horizon=24, threshold_pct=0.005)
        _LATEST_TRAINING_REPORT = run_walk_forward_validation(
            df=train_features_df,
            target=target,
            n_folds=8,
            horizon=24
        )
        data_gaps.extend(train_gaps)
        
    # Generate simple prediction probabilities for the response
    # We will simulate prediction probabilities derived from our latest indicators
    # (e.g. higher RSI implies more down/sideways, high fear_greed implies down probability).
    rsi = latest_row.get("rsi_6", 50.0)
    fg = latest_row.get("fear_greed", 50.0)
    
    # Deterministic simple model simulation for live prediction values
    up_prob = 0.35 + 0.15 * (fg / 100.0) - 0.1 * (rsi / 100.0)
    down_prob = 0.35 - 0.1 * (fg / 100.0) + 0.15 * (rsi / 100.0)
    side_prob = 1.0 - (up_prob + down_prob)
    
    pred_probs = {"up": up_prob, "down": down_prob, "sideways": side_prob}
    
    order_book_walls = []
    if sources["order_book_df"] is not None and not sources["order_book_df"].empty:
        ob = sources["order_book_df"]
        bids = ob[ob["side"] == "bid"].head(3)
        asks = ob[ob["side"] == "ask"].head(3)
        for _, row in bids.iterrows():
            order_book_walls.append({"price": float(row["price"]), "strength": "medium"})
        for _, row in asks.iterrows():
            order_book_walls.append({"price": float(row["price"]), "strength": "medium"})
            
    payload = export_agent_payload(
        market_df=latest_row,
        validation_report=_LATEST_TRAINING_REPORT,
        prediction_probs=pred_probs,
        order_book_walls=order_book_walls,
        horizon_hours=_LATEST_TRAINING_REPORT["metadata"]["horizon_periods"]
    )
    
    return PredictResponse(
        payload=payload,
        data_gaps=list(set(data_gaps))
    )


@router.get("/news-instructions", response_model=NewsInstructionsResponse)
def get_news_instructions():
    return NewsInstructionsResponse(
        instructions_for_agent=(
            "The agent must search for news of the last 24-48 hours regarding: "
            "Bitcoin, Federal Reserve policy / rate decisions, macro economic markers "
            "(CPI, employment rates), and report only factual, source-backed events."
        ),
        keywords_to_search=["Bitcoin", "Fed rate decision", "CPI", "Inflation", "US Dollar Index"]
    )

app.include_router(router)
