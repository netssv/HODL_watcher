import logging
import os
import time
import pandas as pd
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException

from api.schemas import (
    DataResponseItem, DataResponse, FeatureCalculateRequest,
    FeatureCalculateResponse, TrainRequest, TrainResponse,
    PredictResponse, NewsInstructionsResponse, IndicatorsResponse
    , PracticeContextResponse, PracticeContextPoint, HealthResponse
)
from api.services import fetch_all_sources
from data_ingestion import binance_spot, okx, kraken, bybit
from data_ingestion import fear_greed, dxy
from features.builder import build_features
from model.validation import prepare_target, run_walk_forward_validation
from model.inference import fit_final_model, predict_probabilities
from model.agent_exporter import export_agent_payload

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")

_LATEST_TRAINING_REPORT: Optional[Dict[str, Any]] = None
_LATEST_MODEL = None
_LATEST_FEATURE_NAMES: list[str] = []
_WARMING_UP = False
_PREDICTION_CACHE = None
_PREDICTION_CACHE_AT = 0.0
_PREDICTION_CACHE_TTL = 3600

@router.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok")

def warmup_training():
    """Called once at startup in a background thread."""
    global _WARMING_UP
    _WARMING_UP = True
    try:
        logger.info("Background warmup: training model...")
        _train(horizon=24, folds=10, threshold=0.005, limit=3000)
        logger.info("Background warmup complete.")
    except Exception as e:
        logger.error("Warmup training failed: %s", e)
    finally:
        _WARMING_UP = False

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

def _train(horizon: int, folds: int, threshold: float, cfg=None, limit=3000, force_refresh=False):
    global _LATEST_TRAINING_REPORT, _LATEST_MODEL, _LATEST_FEATURE_NAMES
    srcs, gaps = fetch_all_sources(limit=limit, interval="1h", force_refresh=force_refresh)
    if srcs["spot_df"] is None or srcs["spot_df"].empty:
        raise HTTPException(status_code=400, detail="Binance Spot dataset missing.")
    df, target = prepare_target(_build(srcs, cfg), horizon=horizon, threshold_pct=threshold)
    if len(df) < 500:
        raise HTTPException(status_code=400, detail=f"Insufficient training samples ({len(df)}). Need ≥500.")
    _LATEST_TRAINING_REPORT = run_walk_forward_validation(df, target, folds, horizon)
    _LATEST_MODEL, _LATEST_FEATURE_NAMES = fit_final_model(df, target)
    return _LATEST_TRAINING_REPORT, gaps


@router.get("/data/{symbol}", response_model=DataResponse)
def get_raw_data(symbol: str, interval: str = "1h", limit: int = 100):
    data_gaps = []
    try:
        df = binance_spot.get_klines(symbol=symbol, interval=interval, limit=limit)
        if df is None or df.empty:
            raise RuntimeError("Empty response returned")
    except Exception as e:
        data_gaps = [f"binance_spot: {e}; trying OKX fallback"]
        try:
            df = okx.get_klines(symbol=symbol, interval=interval, limit=limit)
            if df is None or df.empty:
                raise RuntimeError("Empty response returned")
            data_gaps.append("spot_source: okx_fallback")
        except Exception as okx_error:
            data_gaps.append(f"okx_spot: {okx_error}; trying Kraken fallback")
            try:
                df = kraken.get_klines(symbol=symbol, interval=interval, limit=limit)
                if df is None or df.empty:
                    raise RuntimeError("Empty response returned")
                data_gaps.append("spot_source: kraken_fallback")
            except Exception as kraken_error:
                data_gaps.append(f"kraken_spot: {kraken_error}; trying Bybit fallback")
                try:
                    df = bybit.get_klines(symbol=symbol, interval=interval, limit=limit)
                    if df is None or df.empty:
                        raise RuntimeError("Empty response returned")
                    data_gaps.append("spot_source: bybit_fallback")
                except Exception as bybit_error:
                    df, data_gaps = None, data_gaps + [f"bybit_spot: {bybit_error}"]
        
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
    requested_refresh = req.force_refresh
    force_refresh = requested_refresh and os.getenv("ALLOW_ONLINE_FORCE_REFRESH", "false").lower() == "true"
    online_server = bool(os.getenv("K_SERVICE")) or os.getenv("DEPLOYMENT_MODE", "offline").lower() == "online"
    if requested_refresh and online_server and not force_refresh:
        raise HTTPException(status_code=409, detail="Online refresh disabled: the shared server cache updates on its scheduled interval.")
    rep, gaps = _train(req.horizon_hours, req.n_folds, req.threshold_pct, req.features_config, force_refresh=force_refresh)
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
    # Optional providers can leave individual feature columns absent. Keep
    # the endpoint usable and expose nulls instead of turning that gap into 500.
    available = feat.reindex(columns=cols)
    for ts, row in available.dropna(how="all").tail(limit).iterrows():
        entry = {"timestamp": str(ts)}
        for c in cols:
            v = row.get(c)
            entry[c] = float(v) if v is not None and not pd.isna(v) else None
        records.append(entry)
    return IndicatorsResponse(symbol=symbol, interval=interval, data=records, data_gaps=gaps)


@router.get("/predict", response_model=PredictResponse)
def get_prediction(force_refresh: bool = False):
    global _LATEST_TRAINING_REPORT, _LATEST_MODEL, _PREDICTION_CACHE, _PREDICTION_CACHE_AT
    # Do this before contacting any upstream provider.  The startup training
    # runs in a background thread, so a browser request should get a quick
    # retryable response instead of waiting on every external data source.
    if _WARMING_UP or _LATEST_TRAINING_REPORT is None or _LATEST_MODEL is None:
        raise HTTPException(status_code=503, detail="Model warming up, retry in a moment.")

    # Online users share one server-side result. Do not let every browser
    # refresh fan out into a full upstream refresh; force refresh is opt-in
    # for maintenance only.
    force_refresh = force_refresh and os.getenv("ALLOW_ONLINE_FORCE_REFRESH", "false").lower() == "true"
    if not force_refresh and _PREDICTION_CACHE is not None and time.time() - _PREDICTION_CACHE_AT < _PREDICTION_CACHE_TTL:
        return _PREDICTION_CACHE
    srcs, gaps = fetch_all_sources(limit=100, interval="1h", force_refresh=force_refresh)
    if srcs["spot_df"] is None or srcs["spot_df"].empty:
        raise HTTPException(status_code=503, detail="Spot market data unavailable.")
    
    latest_row = _build(srcs).iloc[-1].to_dict()
    if any(latest_row.get(field) is None or pd.isna(latest_row.get(field))
           for field in ("liquidation_dist_upper", "liquidation_dist_lower")):
        gaps.append("liquidation_proximity: unavailable")
    
    probabilities = predict_probabilities(_LATEST_MODEL, _LATEST_FEATURE_NAMES, latest_row)
    
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
        dxy_values = dxy_df["value"].dropna()
        if not dxy_values.empty:
            macro_snap["dxy"] = float(dxy_values.iloc[-1])
            macro_snap["dxy_source"] = "ICE U.S. Dollar Index (DXY), Yahoo Finance DX-Y.NYB"
            macro_snap["macro_dxy_source"] = dxy_df.attrs.get(
                "macro_dxy_source", "unknown"
            )
            if len(dxy_values) > 1 and dxy_values.iloc[-2] != 0:
                macro_snap["dxy_change_pct"] = float((dxy_values.iloc[-1] / dxy_values.iloc[-2]) - 1)
    fed_df = srcs.get("macro_dfs", {}).get("fed_funds")
    if fed_df is not None and not fed_df.empty:
        macro_snap["fed_rate"] = float(fed_df["value"].dropna().iloc[-1])
        
    payload = export_agent_payload(
        market_df=latest_row, validation_report=_LATEST_TRAINING_REPORT,
        prediction_probs=probabilities,
        order_book_walls=walls, horizon_hours=_LATEST_TRAINING_REPORT["metadata"]["horizon_periods"],
        news_sentiment_bullish_pct=news_bullish_pct,
        macro_snapshot=macro_snap or None,
        order_book_depth=srcs.get("futures_depth_dict"),
        liq_heatmap=srcs.get("liq_heatmap_dict"),
        data_freshness={
            "price_last_update": str(srcs["spot_df"].index[-1]),
            "funding_last_update": (
                str(srcs["funding_df"].index[-1])
                if srcs.get("funding_df") is not None and not srcs["funding_df"].empty else None
            ),
            "liquidation_estimate_last_update": (
                srcs["liq_heatmap_dict"].get("fetched_at")
                if srcs.get("liq_heatmap_dict") else None
            ),
            "usd_index_last_update": (
                str(dxy_df.index[-1]) if dxy_df is not None and not dxy_df.empty else None
            ),
        },
        data_gaps=gaps,
        network_snapshot=srcs.get("network_snapshot"),
    )
    payload["news"] = news_rows_out
    
    _PREDICTION_CACHE = PredictResponse(payload=payload, data_gaps=list(set(gaps)))
    _PREDICTION_CACHE_AT = time.time()
    return _PREDICTION_CACHE


@router.get("/news-instructions", response_model=NewsInstructionsResponse)
def get_news_instructions():
    return NewsInstructionsResponse(
        instructions_for_agent="The agent must search for news of the last 24-48 hours regarding: Bitcoin, Federal Reserve policy / rate decisions, macro economic markers (CPI, employment rates), and report only factual, source-backed events.",
        keywords_to_search=["Bitcoin", "Fed rate decision", "CPI", "Inflation", "US Dollar Index"]
    )

@router.get("/practice/context", response_model=PracticeContextResponse)
def get_practice_context():
    gaps = []
    fg = dxy_df = None
    try: fg = fear_greed.get_fear_greed_index(limit=0)
    except Exception as exc: gaps.append(f"fear_greed: {exc}")
    try: dxy_df = dxy.get_dxy(range_name="2y")
    except Exception as exc: gaps.append(f"dxy: {exc}")
    timestamps = set()
    if fg is not None: timestamps.update(fg.index)
    if dxy_df is not None: timestamps.update(dxy_df.index)
    points = []
    for ts in sorted(timestamps):
        f = fg.asof(ts) if fg is not None and not fg.empty else None
        d = dxy_df.asof(ts) if dxy_df is not None and not dxy_df.empty else None
        points.append(PracticeContextPoint(
            timestamp=ts.isoformat(),
            fear_greed=int(f["value"]) if f is not None and pd.notna(f.get("value")) else None,
            fear_greed_classification=str(f["classification"]) if f is not None and pd.notna(f.get("classification")) else None,
            dxy=float(d["value"]) if d is not None and pd.notna(d.get("value")) else None,
        ))
    return PracticeContextResponse(data=points, data_gaps=gaps)
