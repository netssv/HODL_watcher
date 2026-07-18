# HODL Watcher deployment modes

This project has two operating modes. Identify the mode before changing API
calls, refresh controls, caching, or deployment configuration.

## Local/offline mode

- Vite frontend: `http://localhost:5173`
- FastAPI backend: `.venv/bin/uvicorn api.app:app --reload`
- `VITE_API_BASE_URL=http://localhost:8000`
- `VITE_DEPLOYMENT_MODE=offline`
- Manual source refresh is allowed for development and testing.
- Local cache behavior must not be described as shared/public behavior.

## Public/online mode

- Frontend: Vercel
- Shared backend: `https://hodl-watcher-api-443601756311.us-central1.run.app`
- Vercel Production variables:

  ```text
  VITE_API_BASE_URL=https://hodl-watcher-api-443601756311.us-central1.run.app
  VITE_DEPLOYMENT_MODE=online
  ```

- `VITE_*` values are public client-side configuration. Never put API keys or
  credentials in them.
- Every visitor reads the shared server-side prediction result. Do not refresh
  upstream data per browser, IP address, page view, or visit.
- `/api/predict` uses a one-hour server cache (`3600` seconds). Online manual
  refresh stays disabled. `force_refresh` is maintenance-only and requires
  `ALLOW_ONLINE_FORCE_REFRESH=true`.
- The current cache is process-memory based. If Cloud Run runs multiple
  instances and strict cross-instance sharing is required, use a shared cache
  and refresh lock instead of process memory.

## Freshness contract

User-facing prediction status must distinguish:

- `last updated`: when the served server result/data was created;
- `next update`: the next permitted shared refresh, normally one hour later;
- source freshness: source-specific timestamps when available.

Use UTC timestamps and do not substitute the browser fetch time for the
server's update time. If the API does not return cache-created and next-refresh
timestamps, add them before claiming the UI reports them.

## Verification

1. Confirm the active mode and API base URL.
2. Local: `GET http://localhost:8000/api/health`.
3. Production: `GET https://hodl-watcher-api-443601756311.us-central1.run.app/api/health`.
4. Confirm CORS includes the actual Vercel hostname; use `ALLOWED_ORIGIN` if it
   differs from the default.
5. Confirm online requests do not send `force_refresh`.
6. Confirm displayed last-update and next-update values are truthful.
