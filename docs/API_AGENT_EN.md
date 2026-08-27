# API and agent behavior

## API

The backend uses FastAPI and separates configuration, routes, schemas, and
services across `api/app.py`, `api/routes.py`, `api/schemas.py`, and
`api/services.py`.

Automatic documentation is available at:

- Local: `http://localhost:8000/docs`
- Production: `https://hodl-watcher-api-443601756311.us-central1.run.app/docs`

Main endpoints are `/api/health`, `/api/data/{symbol}`, `/api/features`,
`/api/train`, `/api/predict`, `/api/indicators`, `/api/practice/context`, and
`/api/news-instructions`.

Vercel hosts the frontend; Google Cloud Run hosts the backend.

## Skills and agent behavior

Project skills live in `.agents/skills/`. They are reusable instructions for
consistent endpoints, model validation, data-leakage prevention, API rate
limits, and honest presentation of metrics.

The agent-oriented behavior is most visible in `/api/news-instructions`, which
provides instructions for searching recent news and reporting sourced facts.
`/api/predict` also includes validation context, freshness, data gaps, and
disclaimers.

## AI usage

AI assistants supported the initial structure, endpoints, and documentation.
Suggestions were manually reviewed and adjusted with validation, fallbacks,
caching, tests, and reliability context for predictions.
