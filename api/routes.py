import logging
import pandas as pd
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException

from api.schemas import (
    DataResponseItem, DataResponse, FeatureCalculateRequest,
    FeatureCalculateResponse, TrainRequest, TrainResponse,
    PredictResponse, NewsInstructionsResponse, IndicatorsResponse
)
from api.services import fetch_all_sources
from data_ingestion import binance_spot
from features.builder import build_features
from model.validation import prepare_target, run_walk_forward_validation
from model.agent_exporter import export_agent_payload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

_LATEST_TRAINING_REPORT: Optional[Dict[str, Any]] = None

def _build(sources: dict, cfg=None):
    """Helper to build features with optional config."""
    d, s, m = (cfg.include_derivatives, cfg.include_sentiment, cfg.include_macro) if cfg else (True, True, True)
    return build_features(
        spot_df=sources["spot_df"],
        futures_df=sources["futures_df"] if d else None,
        funding_df=sources["funding_df"] if d else None,
        long_short_df=sources["long_short_df"] if d else None,
        fear_greed_df=sources["fear_greed_df"] if s else None,
        macro_dfs=sources["macro_dfs"] if m else None,
        order_book_df=sources["order_book_df"],
        coinalyze_df=sources["coinalyze_df"],
        deribit_df=sources["deribit_df"],
        onchain_df=sources["onchain_df"],
        etf_df=sources["etf_df"],
        hyperliquid_df=sources.get("hyperliquid_df")
    )

def _train(horizon: int, folds: int, threshold: float, cfg=None, limit=600):
    global _LATEST_TRAINING_REPORT
    srcs, gaps = fetch_all_sources(limit=limit, interval="1h")
    if srcs["spot_df"] is None or srcs["spot_df"].empty:
        raise HTTPException(status_code=400, detail="Binance Spot dataset missing.")
    df, target = prepare_target(_build(srcs, cfg), horizon=horizon, threshold_pct=threshold)
    if len(df) < 100:
        raise HTTPException(status_code=400, detail="Insufficient training samples.")
    _LATEST_TRAINING_REPORT = run_walk_forward_validation(df, target, folds, horizon)
    return _LATEST_TRAINING_REPORT, gaps


@router.get("/data/{symbol}", response_model=DataResponse)
def get_raw_data(symbol: str, interval: str = "1h", limit: int = 100):
    data_gaps = []
    try:
        df = binance_spot.get_klines(symbol=symbol, interval=interval, limit=limit)
    except Exception as e:
        df, data_gaps = None, [f"data_fetch_failed: {e}"]
        
    if df is None or df.empty:
        return DataResponse(symbol=symbol, interval=interval, data=[], data_gaps=data_gaps)
        
    records = [DataResponseItem(timestamp=str(ts), **row.to_dict()) for ts, row in df.iterrows()]
    data_gaps.extend([f"spot_gap: Gap detected after {g['after']} of size {g['gap_size']}" for g in df.attrs.get("gaps_detected", [])])
    return DataResponse(symbol=symbol, interval=interval, data=records, data_gaps=data_gaps)


@router.post("/features", response_model=FeatureCalculateResponse)
def calculate_features(req: FeatureCalculateRequest):
    srcs, gaps = fetch_all_sources(limit=req.limit, interval=req.interval)
    if srcs["spot_df"] is None or srcs["spot_df"].empty:
        raise HTTPException(status_code=400, detail="Cannot build features: Binance Spot missing.")
    
    features_df = _build(srcs, req.features_config)
    recs = [{**r, "timestamp": str(r.get("timestamp", ""))} for r in features_df.tail(10).reset_index().to_dict("records")]
    return FeatureCalculateResponse(columns=list(features_df.columns), sample_records=recs, data_gaps=gaps)


@router.post("/train", response_model=TrainResponse)
def train_model(req: TrainRequest):
    rep, gaps = _train(req.horizon_hours, req.n_folds, req.threshold_pct, req.features_config)
    return TrainResponse(status="success", validation_summary=rep, data_gaps=gaps)


@router.get("/indicators", response_model=IndicatorsResponse)
def get_indicators(symbol: str = "BTCUSDT", interval: str = "1h", limit: int = 200):
    """Return Phase 1 indicator timeseries for the AdvancedIndicators panel."""
    srcs, gaps = fetch_all_sources(limit=limit, interval=interval)
    if srcs["spot_df"] is None or srcs["spot_df"].empty:
        raise HTTPException(status_code=503, detail="Spot market data unavailable.")
    feat = _build(srcs)
    cols = ["vwap_24", "realized_vol_24", "volume_delta", "cvd_24", "futures_basis", "iv_rank"]
    records = []
    for ts, row in feat[cols].dropna(how="all").tail(limit).iterrows():
        entry = {"timestamp": str(ts)}
        for c in cols:
            v = row.get(c)
            entry[c] = float(v) if v is not None and not pd.isna(v) else None
        records.append(entry)
    return IndicatorsResponse(symbol=symbol, interval=interval, data=records, data_gaps=gaps)


@router.get("/predict", response_model=PredictResponse)
def get_prediction():
    global _LATEST_TRAINING_REPORT
    srcs, gaps = fetch_all_sources(limit=100, interval="1h")
    if srcs["spot_df"] is None or srcs["spot_df"].empty:
        raise HTTPException(status_code=503, detail="Spot market data unavailable.")
    
    latest_row = _build(srcs).iloc[-1].to_dict()
    
    if _LATEST_TRAINING_REPORT is None:
        logger.info("Running initial training model.")
        _, train_gaps = _train(horizon=24, folds=8, threshold=0.005, limit=500)
        gaps.extend(train_gaps)
        
    rsi, fg = latest_row.get("rsi_6", 50.0), latest_row.get("fear_greed", 50.0)
    up, dn = 0.35 + 0.15*(fg/100) - 0.1*(rsi/100), 0.35 - 0.1*(fg/100) + 0.15*(rsi/100)
    
    walls = []
    if srcs["order_book_df"] is not None and not srcs["order_book_df"].empty:
        ob = srcs["order_book_df"]
        walls = [{"price": float(r["price"]), "strength": "medium"} for _, r in pd.concat([ob[ob["side"] == "bid"].head(3), ob[ob["side"] == "ask"].head(3)]).iterrows()]
            
    # News sentiment: share of headlines with positive/bullish tone
    news_bullish_pct = None
    news_rows_out = []
    if srcs.get("news_df") is not None and not srcs["news_df"].empty:
        news_df = srcs["news_df"]
        total = len(news_df)
        pos_vals = {"positive", "bullish", "1", "true"}
        pos_count = news_df["sentiment"].astype(str).str.lower().isin(pos_vals).sum()
        news_bullish_pct = round(float(pos_count) / total * 100, 1) if total > 0 else None
        news_rows_out = [
            {"published_at": str(dt), "title": str(r["title"]), "source": str(r["source"]),
             "sentiment": str(r["sentiment"]) if pd.notna(r["sentiment"]) else None, "url": str(r["url"])}
            for dt, r in news_df.iterrows()
        ]

    # Macro snapshot from FRED (already fetched, never surfaced)
    macro_snap: dict = {}
    dxy_df = srcs.get("macro_dfs", {}).get("dxy")
    if dxy_df is not None and not dxy_df.empty:
        macro_snap["dxy"] = float(dxy_df["value"].dropna().iloc[-1])
    fed_df = srcs.get("macro_dfs", {}).get("fed_funds")
    if fed_df is not None and not fed_df.empty:
        macro_snap["fed_rate"] = float(fed_df["value"].dropna().iloc[-1])
        
    payload = export_agent_payload(
        market_df=latest_row, validation_report=_LATEST_TRAINING_REPORT,
        prediction_probs={"up": up, "down": dn, "sideways": 1 - up - dn},
        order_book_walls=walls, horizon_hours=_LATEST_TRAINING_REPORT["metadata"]["horizon_periods"],
        news_sentiment_bullish_pct=news_bullish_pct,
        macro_snapshot=macro_snap or None,
    )
    payload["news"] = news_rows_out
    
    return PredictResponse(payload=payload, data_gaps=list(set(gaps)))


@router.get("/news-instructions", response_model=NewsInstructionsResponse)
def get_news_instructions():
    return NewsInstructionsResponse(
        instructions_for_agent="The agent must search for news of the last 24-48 hours regarding: Bitcoin, Federal Reserve policy / rate decisions, macro economic markers (CPI, employment rates), and report only factual, source-backed events.",
        keywords_to_search=["Bitcoin", "Fed rate decision", "CPI", "Inflation", "US Dollar Index"]
    )
