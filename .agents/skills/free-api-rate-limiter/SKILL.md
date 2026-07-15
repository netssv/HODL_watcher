---
name: free-api-rate-limiter
description: Use this skill whenever writing or editing code in the data_ingestion/ module that calls external free-tier APIs (Binance, CoinGecko, FRED, Alternative.me Fear and Greed Index, CryptoPanic, NewsAPI, mempool.space, Hyperliquid). Triggers include adding a new API client, writing a function that makes an HTTP request to any of these services, or debugging rate-limit errors. This skill enforces caching and backoff so development iterations don't burn through free-tier quotas.
---

# Free API Rate Limiter

## Why this exists

This project deliberately uses only free-tier APIs, several of which have tight daily or per-minute limits (NewsAPI: 100 requests/day, CryptoPanic free tier: limited, FRED: generous but still rate-limited). Re-fetching the same data on every dev iteration or every frontend refresh will exhaust these quotas quickly. This skill enforces caching and backoff so the project stays inside free tiers indefinitely.

## Required pattern for any new API client

1. **Local cache first.** Every client function must check a local cache (SQLite or parquet, keyed by symbol + timeframe + endpoint) before making a network call. Use a TTL appropriate to the data's actual update frequency:
   - OHLCV candles: cache TTL = the candle interval itself (no point re-fetching a 1h candle more than once per hour)
   - Funding rate: TTL = 1 hour (funding settles every 8h on most exchanges, but check periodically for the countdown)
   - Fear & Greed Index: TTL = 12 hours (updates once daily)
   - News (CryptoPanic/NewsAPI): TTL = 30-60 minutes, and always check the daily quota counter before calling
   - Macro data (FRED): TTL = 24 hours minimum — these series update monthly/quarterly

2. **Exponential backoff with jitter on failure.** Any 429 (rate limited) or 5xx response must trigger retry with exponential backoff (base 1s, cap at ~60s) plus random jitter, not a fixed retry interval. Never retry immediately in a tight loop.

3. **Explicit quota tracking for hard-limited APIs.** For NewsAPI (100/day) and CryptoPanic free tier, maintain a simple counter (persisted, e.g. in the same cache DB) that increments per call and resets on the provider's reset window. Refuse to call and return the cached value instead once the quota is close to exhausted, with a log warning — don't silently fail.

4. **Never call an external API directly from a FastAPI request handler without going through the cached client.** Every endpoint that needs external data should call the cached client function, not `requests.get()` inline. This keeps the caching behavior consistent across all consumers (backend endpoints, model training scripts, ad-hoc debugging).

## How to use the included helper

`scripts/cache_utils.py` provides a `cached_fetch(key, ttl_seconds, fetch_fn)` decorator/helper backed by SQLite that any new client can wrap around its raw HTTP call. Use it rather than writing a new caching layer per source.

```python
from cache_utils import cached_fetch

def get_fear_greed_index():
    return cached_fetch(
        key="fear_greed_index",
        ttl_seconds=12 * 3600,
        fetch_fn=lambda: requests.get("https://api.alternative.me/fng/").json(),
    )
```

## What "done" looks like for a new API client

- [ ] Wrapped with `cached_fetch` or equivalent, with a TTL matched to real data freshness
- [ ] Retry logic uses exponential backoff with jitter, not fixed intervals
- [ ] If the API has a hard daily/monthly quota, a counter is tracked and respected
- [ ] No FastAPI endpoint calls the raw HTTP client directly
