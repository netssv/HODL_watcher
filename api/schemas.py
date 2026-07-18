from typing import List, Dict, Any
from pydantic import BaseModel, Field

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
    n_folds: int = Field(default=8, ge=8, le=15)
    threshold_pct: float = Field(default=0.005, ge=0.0, le=0.05)
    features_config: FeatureGroupConfig = FeatureGroupConfig()
    force_refresh: bool = False

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


class IndicatorRecord(BaseModel):
    timestamp: str
    vwap_24: float | None = None
    realized_vol_24: float | None = None
    volume_delta: float | None = None
    cvd_24: float | None = None
    futures_basis: float | None = None
    iv_rank: float | None = None


class IndicatorsResponse(BaseModel):
    symbol: str
    interval: str
    data: List[IndicatorRecord]
    data_gaps: List[str]
