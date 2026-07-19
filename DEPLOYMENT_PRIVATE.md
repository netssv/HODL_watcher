# HODL Watcher deployment (private)

This file is intentionally ignored by Git. Never commit API keys or service-account JSON.

## 1. Prepare the backend

The backend is a FastAPI service designed for Google Cloud Run. The Dockerfile already starts it on Cloud Run's `$PORT`.

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

gcloud run deploy hodl-watcher-api \
  --source . \
  --region YOUR_REGION \
  --allow-unauthenticated \
  --min-instances 1 \
  --max-instances 1 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --set-env-vars ALLOWED_ORIGIN=https://YOUR_VERCEL_DOMAIN,ALLOW_ONLINE_FORCE_REFRESH=false
```

Add optional secrets in Cloud Run's environment settings, not in this repository:

```text
FRED_API_KEY=...
NEWSAPI_KEY=...
GNEWS_API_KEY=...
COINALYZE_API_KEY=...
```

Copy the deployed Cloud Run HTTPS URL. Test it before connecting the frontend:

```bash
curl https://YOUR_CLOUD_RUN_URL/health
curl https://YOUR_CLOUD_RUN_URL/api/practice/context
```

## 2. Deploy the frontend to Vercel

Import this repository in Vercel. Set **Root Directory** to `frontend`.
Vercel must not use the repository root, because the root contains the
Cloud Run backend's `pyproject.toml` and would install Python dependencies.
`frontend/vercel.json` builds only the Vite app and publishes `frontend/dist`.

Set this Vercel environment variable for Production and Preview:

```text
VITE_API_BASE_URL=https://YOUR_CLOUD_RUN_URL
VITE_DEPLOYMENT_MODE=online
```

For local development, use `VITE_DEPLOYMENT_MODE=offline` in
`frontend/.env.local` (or leave it unset). Offline mode keeps normal local
refresh behavior. Online mode makes refresh/force-refresh buttons show a
simulation notice and never fan out upstream requests from the browser.

### Where each secret belongs

| Secret/configuration | Vercel | Google Cloud Run |
|---|---:|---:|
| `VITE_API_BASE_URL` | Yes | No |
| `ALLOWED_ORIGIN` | No | Yes |
| `FRED_API_KEY` | No | Yes |
| `NEWSAPI_KEY` / `GNEWS_API_KEY` | No | Yes |
| Exchange private keys | Never | Only if truly required |

In Vercel, open **Project → Settings → Environment Variables**. Add only
`VITE_API_BASE_URL`. Anything beginning with `VITE_` is bundled into browser
JavaScript and must be treated as public.

In Google Cloud, open **Cloud Run → hodl-watcher-api → Edit & deploy new
revision → Variables & Secrets → Environment variables**, or use Secret
Manager for keys:

```bash
printf '%s' 'YOUR_FRED_KEY' | gcloud secrets create fred-api-key --data-file=-
gcloud secrets add-iam-policy-binding fred-api-key \
  --member="serviceAccount:YOUR_CLOUD_RUN_SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
gcloud run services update hodl-watcher-api \
  --region YOUR_REGION \
  --update-secrets FRED_API_KEY=fred-api-key:latest
```

Prefer Secret Manager for every paid or quota-limited key. Do not put keys in
React code, `VITE_*` variables, Git, screenshots, shell history, or this file.
Keep `.env` local and ignored. If a key was ever committed or shared, revoke
it at the provider and create a replacement; deleting the file is not enough.

Restrict every provider key where supported by:

- allowed API operations (read-only; no trading or withdrawals)
- allowed domains/IPs or Cloud Run egress where supported
- the smallest quota and spending limit
- separate development and production keys

After deployment, verify that the browser source contains only the backend
URL and no provider key.

Deploy:

```bash
npx vercel --prod
```

After the Vercel URL is known, update Cloud Run's `ALLOWED_ORIGIN` to that exact URL and redeploy the backend.

## 3. Refresh and quota policy

- `/api/predict` is cached server-side for one hour.
- Multiple browsers share that one result; browser refreshes do not refresh upstream APIs.
- Production frontend force-refresh requests are disabled.
- `ALLOW_ONLINE_FORCE_REFRESH` stays `false` in production.
- Keep Cloud Run at `--max-instances 1` so the in-memory prediction cache is shared by all users.
- The upstream SQLite cache is also retained inside the running instance, with each data source's own TTL.
- Do not scale to multiple instances unless the cache is moved to Redis/Firestore.

## 4. Verify the production split

1. Open the Vercel URL.
2. Confirm the browser requests use `https://YOUR_CLOUD_RUN_URL/api/...`.
3. Confirm the chart loads and Practice Mode context is available.
4. Open the Cloud Run logs and verify repeated page refreshes do not trigger repeated upstream fetches within one hour.
5. Keep API keys only in Cloud Run environment variables and Vercel's environment settings.

## 5. Local verification

For local/offline mode, start the backend and frontend separately. The
frontend automatically uses `http://localhost:8000` in Vite development when
`VITE_API_BASE_URL` is not set:

```bash
./dev.sh backend
cd frontend && npm run dev
```

If you prefer an explicit local file, copy `frontend/.env.example` to
`frontend/.env.local` and keep `VITE_DEPLOYMENT_MODE=offline`.

```bash
.venv/bin/python -m py_compile api/routes.py api/schemas.py data_ingestion/dxy.py
.venv/bin/pytest tests/ -q
cd frontend && npm run build
```
