# API y comportamiento agentico

## API

El backend usa FastAPI y separa configuración, rutas, esquemas y servicios en
`api/app.py`, `api/routes.py`, `api/schemas.py` y `api/services.py`.

La documentación automática está disponible en:

- Local: `http://localhost:8000/docs`
- Producción: `https://hodl-watcher-api-443601756311.us-central1.run.app/docs`

Endpoints principales: `/api/health`, `/api/data/{symbol}`, `/api/features`,
`/api/train`, `/api/predict`, `/api/indicators`, `/api/practice/context` y
`/api/news-instructions`.

Vercel hospeda el frontend; Google Cloud Run hospeda el backend.

## Skills y agente

Las skills del proyecto viven en `.agents/skills/`. Son instrucciones reutilizables
para mantener consistencia en endpoints, validación del modelo, prevención de
data leakage, límites de APIs y presentación honesta de métricas.

La parte agentica se observa especialmente en `/api/news-instructions`, que
entrega instrucciones para buscar noticias recientes y reportar hechos con
fuentes. `/api/predict` añade validación, frescura, gaps de datos y disclaimers.

## Uso de IA

Se usaron asistentes de IA para apoyar la estructura, endpoints y documentación.
Las sugerencias fueron revisadas manualmente y ajustadas con validaciones,
fallbacks, caché, pruebas y contexto de confiabilidad para las predicciones.
