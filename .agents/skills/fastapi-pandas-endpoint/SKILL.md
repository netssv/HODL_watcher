---
name: fastapi-pandas-endpoint
description: Use this skill whenever creating or editing a FastAPI endpoint in the HODL_watcher backend, especially endpoints that call data_ingestion clients, run pandas transformations, or return data consumed by the React frontend. Triggers include adding a new route under /api/, changing a response schema, or handling errors from an external data source inside a route handler.
---

# FastAPI + Pandas Endpoint Pattern

## Why this exists

With multiple free external APIs in play (Binance, CoinGecko, FRED, CryptoPanic, etc.), any one of them can go down or rate-limit independently. Without a consistent pattern, one failed provider can crash unrelated endpoints or return silently wrong data to the frontend. This skill defines the shared structure every endpoint should follow.

## Required structure for every endpoint

1. **Pydantic response models for everything.** No endpoint should return a raw dict or DataFrame — define a Pydantic model for the response shape so the frontend has a stable, typed contract. Use `df.to_dict(orient="records")` only after validating shape against the model, or better, construct the Pydantic objects explicitly.

2. **Never call raw `requests` inside a route handler.** Route handlers call functions from `data_ingestion/` (which are already wrapped with the caching skill), never the HTTP client directly. This keeps caching and backoff consistent regardless of which endpoint triggers the call.

3. **Explicit partial-failure handling.** If an endpoint aggregates multiple sources (e.g. `/api/predict` needs price + funding rate + Fear & Greed), and one source fails, the endpoint must NOT return a 500 for the whole request. Instead:
   - Return whatever succeeded
   - Include a `data_gaps` field in the response listing which sources failed and why
   - Log the failure with enough detail to debug later

   Example response shape:
   ```python
   class MarketSnapshotResponse(BaseModel):
       price: float | None
       rsi: dict | None
       fear_greed_index: int | None
       data_gaps: list[str]  # e.g. ["fear_greed_index: alternative.me timeout after 3 retries"]
   ```

4. **pandas operations stay out of route handlers.** Route handlers should be thin: fetch data (via cached client), call a function from `features/` or `models/` that does the actual pandas/sklearn work, then serialize the result. This keeps handlers testable without needing to mock FastAPI's request/response cycle.

5. **All configurable parameters (horizon, active feature groups) are query params or request body fields with validation, never hardcoded.** Use Pydantic's `Field` with explicit allowed ranges/enums so the frontend gets a clear 422 error on invalid input instead of a confusing 500 from deep inside the model code.

## Standard endpoint skeleton

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

class PredictRequest(BaseModel):
    horizon_hours: int = 24
    feature_groups: list[str] = ["technical", "derivatives", "sentiment"]

class PredictResponse(BaseModel):
    prediction: dict
    validation_summary: dict
    data_gaps: list[str]

@router.post("/api/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    data_gaps = []
    try:
        market_data = data_ingestion.get_market_snapshot()
    except Exception as e:
        data_gaps.append(f"market_data: {e}")
        market_data = None

    result = model.run_prediction(
        market_data, horizon_hours=req.horizon_hours, feature_groups=req.feature_groups
    )
    return PredictResponse(
        prediction=result.prediction,
        validation_summary=result.validation_summary,
        data_gaps=data_gaps,
    )
```

## What "done" looks like for a new endpoint

- [ ] Response has an explicit Pydantic model, no raw dicts
- [ ] No direct `requests`/`httpx` calls inside the handler
- [ ] Partial failures degrade gracefully with a `data_gaps` field, not a 500
- [ ] Configurable parameters are validated request fields, not hardcoded constants
