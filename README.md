# HODL Watcher

## ¿Qué es esto?

HODL Watcher es una herramienta para mirar el mercado de Bitcoin (**BTC/USDT** — el par Bitcoin cotizado en USDT, un dólar estable) con cabeza fría.

No es un bot que compra y vende solo. Tampoco promete “ganar siempre”. Es un **tablero de análisis cuantitativo** (*quantitative dashboard*): junta mucha información del mercado (*market data*), la pasa por un modelo de **machine learning** (aprendizaje automático), y te muestra de forma clara **hacia dónde parece inclinarse el precio a corto plazo** — junto con qué tan confiable es esa lectura (*confidence*) y qué datos faltaron (*data gaps*).

La idea central es la **honestidad de métricas** (*honest metrics*): si el modelo no tiene buena evidencia, el sistema lo dice. Si faltan datos, también. No se esconde detrás de gráficos bonitos.

---

## ¿Para quién sirve?

- Si quieres **entender el mercado** con indicadores técnicos (*technical indicators*), sentimiento (*sentiment*) y macroeconomía (*macro*) en un solo lugar.
- Si estás construyendo o usando un **agente de IA** (*LLM agent* — un asistente de lenguaje que razona con contexto) para trading y necesitas un resumen limpio (*payload*) del estado del mercado: precio, *funding rate*, miedo/codicia (*Fear & Greed*), noticias, etc.
- Si eres desarrollador y quieres un proyecto de referencia del flujo completo: **ingesta de datos** → **features** → **modelo validado** → **API** → **dashboard**.

No sustituye tu criterio. Es un copiloto de información, no un oráculo.

---

## ¿Cómo funciona? (historia + términos)

Imagina que el sistema es una cadena de cuatro capas (*pipeline*).

### 1. Escucha el mercado — *data ingestion*

Cada poco tiempo (o cuando se lo pides) el **backend** (el servidor) habla con varias **APIs** externas (interfaces HTTP de otros servicios):

| En lenguaje claro | Término técnico | Fuente típica |
|-------------------|-----------------|---------------|
| Precios y velas japonesas | OHLCV (*Open, High, Low, Close, Volume*), *klines* / *candlesticks* | Binance Spot; si falla → OKX, Kraken, Bybit (*fallback*) |
| Futuros y apalancamiento | *derivatives*: *funding rate*, *long/short ratio*, *open interest* | Binance Futures, Coinalyze, Hyperliquid, etc. |
| Miedo y codicia del mercado | *Fear & Greed Index* | Alternative.me |
| Dólar y macro | *macro* / FRED (índice amplio del USD; **no** es el ICE DXY clásico) | FRED |
| Noticias | *news sentiment* / *headlines* | NewsAPI, Currents, GNews, CoinDesk… |
| Cadena y ETFs | *on-chain*, flujos ETF | mempool / proveedores (a veces *mock* = simulado) |

Muchas de esas APIs son de **capa gratuita** (*free tier*) y tienen **límite de peticiones** (*rate limit*). Por eso el proyecto:

- **cachea** respuestas en **SQLite** (una base de datos local ligera) con un **TTL** (*time-to-live*: caducidad de la caché),
- y si recibe un 429 (*too many requests*), espera con **backoff exponencial** (reintentos cada vez más espaciados).

Así no satura las fuentes ni inventa volúmenes o precios.

### 2. Traduce todo a señales — *feature engineering*

Los números crudos no le sirven al modelo tal cual. El módulo `features/builder.py` hace **feature engineering**:

1. Usa las velas de spot como **espina** (*spine*) temporal.
2. Calcula indicadores: **RSI**, **MACD**, **Bollinger Bands**, **ATR**, **OBV**, **VWAP**, EMAs, etc.
3. Une el resto de series con `pd.merge_asof` (empareja cada instante con el dato *más reciente disponible sin mirar al futuro*).

Eso evita **data leakage** (filtración de información del futuro hacia el entrenamiento — el error clásico que hace que un modelo “brille” en papel y falle en vivo).

El resultado es una **matriz de features**: cada fila = un momento; cada columna = una pista (*feature*) sobre el mercado.

### 3. Entrena y juzga — *Random Forest* + *walk-forward validation*

El modelo es un **Random Forest** (bosque de árboles de decisión) de **clasificación** en tres clases (*labels*):

- **up** — sube  
- **down** — baja  
- **sideways** — lateral  

La etiqueta se arma con un **horizonte** (*horizon_hours*, p. ej. 24 h) y un **umbral** (*threshold_pct*): solo cuenta “sube/baja” si el movimiento supera ese porcentaje; si no, es lateral.

Lo importante no es solo “entrenar y listo”. Usa **validación walk-forward** (*expanding window*):

1. Entrena en el pasado.  
2. Predice el tramo siguiente (*out-of-sample*).  
3. Avanza la ventana.  
4. Repite en varios *folds* (pliegues).

Entre entrenamiento y prueba deja un **embargo** (*embargo buffer*): un hueco temporal para reducir fugas de información correlacionada.

Al final ves métricas **comparadas con un baseline naive** (lo que harías adivinando a ciegas o siempre prediciendo la clase más frecuente / *class balance*). Si el modelo no mejora eso de forma clara, el mensaje no es “somos genios”: es “ojo, el **edge** (ventaja estadística) es limitado”.

Después del walk-forward se ajusta un **modelo final** (*fit_final_model*) para la predicción en vivo (*inference*).

### 4. Te lo muestra — *dashboard* + *agent payload*

Hay dos caras de uso:

1. **Frontend / dashboard** (React + Vite) — gráfico de velas, *overlays* técnicos, cinta (*ribbon*) de macro/sentimiento, perfil de liquidaciones estimado, predicción y notas de confianza.
2. **API REST** (FastAPI) — un **JSON** limpio en `GET /api/predict`, pensado como **payload agentico**: un paquete que un **LLM** (modelo de lenguaje) o tu código pueden leer sin inventar. Incluye:
   - `market_snapshot` — foto del mercado  
   - `model_prediction` — probabilidades por dirección + *feature importance*  
   - `validation_summary` — resumen walk-forward  
   - `news_context` — instrucciones para buscar noticias  
   - `data_gaps` — qué fuente falló  
   - `disclaimers` — avisos legales / de honestidad  

En **producción** (*production*): el frontend está en **Vercel**; el backend en **Google Cloud Run**. En **local** (*dev*) corres ambos en tu máquina (`localhost`).

---

## Cómo usarlo tú (paso a paso)

### Primera vez en una computadora — *setup*

Abre una terminal en la carpeta del proyecto y corre:

```bash
./setup.sh
```

Eso crea el **entorno virtual** de Python (`.venv` — *virtual environment*), instala el paquete en modo editable (`pip install -e .`) y las dependencias del frontend (`npm install` → `node_modules`). Solo hace falta una vez por máquina.

### Configura las llaves — *environment variables*

Copia `.env.example` a `.env` y completa las **API keys** que tengas (`FRED_API_KEY`, `NEWSAPI_KEY`, `CURRENTS_API_KEY`, etc.).

Sin keys el sistema **sigue funcionando** con lo público, pero algunas fuentes aparecerán en `data_gaps`. Eso es esperado, no un *crash*.

Variables útiles del frontend:

- `VITE_API_BASE_URL` — URL del backend  
- `VITE_DEPLOYMENT_MODE=offline|online` — comportamiento de refresh y caché  

### Arranca todo — *dev launcher*

```bash
./dev.sh
```

Eso levanta:

| Pieza | Tecnología | URL |
|-------|------------|-----|
| Backend | FastAPI + Uvicorn | http://localhost:8000 |
| Frontend | React + Vite (HMR) | http://localhost:5173 |
| Docs interactivas | OpenAPI / Swagger UI | http://localhost:8000/docs |

La primera vez el backend puede tardar: en el arranque hace **warmup** (calentamiento) — entrena el modelo en un *background thread*. Cuando termina, `/api/predict` ya puede responder.

También puedes:

```bash
./dev.sh backend   # solo la API
./dev.sh frontend  # solo la UI
./dev.sh test      # pytest (suite de pruebas)
./dev.sh smoke     # smoke test contra un servidor vivo
./dev.sh stop      # libera puertos 8000 / 5173
```

Equivalente con **Make**: `make dev`, `make test`, `make stop`, etc.

### Qué hacer en la pantalla

1. Entra a http://localhost:5173  
2. Mira precio, velas e indicadores (*RSI*, bandas, volumen…).  
3. Lee la predicción **junto con** la *confidence note* y el *validation summary*.  
4. Si macro o noticias no cargaron, verás *gaps* — no inventes la pieza que falta.

**Modo offline** (desarrollo local): puedes forzar *refresh* de fuentes upstream.  
**Modo online** (producción pública): el resultado de `/api/predict` es **compartido** y vive en **caché en memoria del proceso** ~**1 hora** (`TTL = 3600`). No se vuelve a pedir a Binance por cada visitante, IP o *page view*. `force_refresh` en online es solo mantenimiento (`ALLOW_ONLINE_FORCE_REFRESH=true`).

Más detalle: [DEPLOYMENT_MODES.md](DEPLOYMENT_MODES.md).

Contrato de frescura (*freshness*):

- **last updated** — cuándo se creó el resultado servido en el servidor  
- **next update** — cuándo puede refrescarse el caché compartido  
- **source freshness** — timestamps por fuente, si existen  

No uses la hora del navegador como si fuera la del servidor.

---

## Si quieres hablarle a la API (o a un agente)

La documentación automática está en http://localhost:8000/docs (`/openapi.json`).

| Método | Endpoint | En criollo | Término |
|--------|----------|------------|---------|
| `GET` | `/api/health` | ¿está vivo? | *liveness* / *healthcheck* |
| `GET` | `/api/predict` | predicción + métricas + paquete para agentes | *inference* + *agent payload* |
| `POST` | `/api/train` | recalibrar el modelo | *walk-forward recalibration* |
| `GET` | `/api/data/{symbol}` | velas crudas | *raw OHLCV* |
| `POST` | `/api/features` | tabla de señales | *feature matrix* |
| `GET` | `/api/indicators` | indicadores para la UI | *technical overlays* |
| `GET` | `/api/news-instructions` | qué buscar en noticias y cómo citar | *agent news context* |
| `GET` | `/api/practice/context` | contexto para modo práctica | *practice mode* |

Explicación larga de la API y el enfoque agentico:

- [En español](docs/API_AGENT_ES.md)  
- [In English](docs/API_AGENT_EN.md)

---

## Mapa del proyecto — *repo layout*

```
api/              → FastAPI: app, routes, schemas, services (orquestación)
data_ingestion/   → clientes HTTP por fuente + caché SQLite + rate limiting
features/         → build_features() + indicadores técnicos
model/            → labeling, walk-forward, inference, agent_exporter
frontend/         → SPA React + Vite + Recharts
execution/        → contrato futuro de ejecución (risk gate)
tests/            → pytest
docs/             → API agentica ES/EN
dev.sh / setup.sh → launcher y setup local
```

Desglose fino: [PROJECT_MAP.md](PROJECT_MAP.md).

**Stack** (pila tecnológica): Python ≥3.10, pandas, NumPy, scikit-learn, FastAPI, Uvicorn, React 19, Vite, Recharts.

---

## Glosario rápido

| Término | Qué significa aquí |
|---------|-------------------|
| **API** | Interfaz HTTP para pedir datos o predicciones |
| **Backend / Frontend** | Servidor (lógica + datos) / interfaz que ves en el navegador |
| **OHLCV / kline** | Vela: apertura, máximo, mínimo, cierre y volumen |
| **Feature** | Variable de entrada del modelo (una “pista”) |
| **Label / target** | Lo que el modelo intenta predecir (up / down / sideways) |
| **Random Forest** | Modelo de ML por muchos árboles de decisión |
| **Walk-forward** | Validación que avanza en el tiempo, como en trading real |
| **Embargo** | Hueco temporal entre train y test anti-leakage |
| **Baseline naive** | Referencia tonta contra la que se compara el modelo |
| **Edge** | Ventaja real sobre el azar / baseline |
| **Payload** | Paquete JSON que consume la UI o un agente |
| **LLM agent** | Asistente de IA que usa este contexto para razonar |
| **TTL / cache** | Tiempo de vida de un resultado guardado |
| **Rate limit** | Tope de llamadas a una API externa |
| **Offline / Online** | Dev local con refresh libre / prod compartida con caché 1h |
| **Warmup** | Entrenamiento inicial en segundo plano al arrancar |
| **Data gap** | Fuente que falló o no devolvió datos |
| **Risk gate** | Candado de riesgo: si la confianza es baja, no operar |

---

## Cuando algo falla — *troubleshooting*

**“Connection Issue” al cambiar de PC**  
En esa máquina aún no corriste el setup. Solución: `./setup.sh`.

**El puerto 8000 está ocupado**  
`./dev.sh stop`, o `lsof -i :8000` (Linux/macOS).

**Python se queja de paquetes faltantes**

```bash
rm -rf .venv
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
./dev.sh
```

**El frontend no arranca**  
Borra `frontend/node_modules` y vuelve a `./setup.sh`.

---

## Una promesa del proyecto (léela en voz alta)

HODL Watcher no está hecho para venderte una narrativa de **“alpha garantizado”** (*alpha* = rendimiento por encima del mercado).

Está hecho para:

1. juntar el **contexto de mercado** (*market microstructure* + macro + sentimiento) en un solo lugar,  
2. aplicar un modelo con **validación seria** (walk-forward + embargo),  
3. decirte con claridad qué tan bueno (o mediocre) es ese modelo hoy vs el **baseline**,  
4. y entregar ese mismo contexto a humanos o a **agentes LLM** sin maquillaje.

Si en el futuro se conecta **ejecución** real de órdenes (*execution adapters*), el contrato es claro: `risk_management.gate` manda. Si el estado es `blocked_low_confidence`, el **tamaño de posición** (*position size*) es **cero** — sin excepciones porque “las *direction probabilities* se veían bien”. Ver [execution/README.md](execution/README.md).

---

## Resumen en una frase

**HODL Watcher es un dashboard + API REST que observa BTC/USDT con datos reales (ingesta + caché), construye features sin leakage, predice dirección a corto plazo con un Random Forest validado walk-forward, y exporta un payload honesto para humanos y agentes de IA.**
