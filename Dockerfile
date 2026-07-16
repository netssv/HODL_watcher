FROM python:3.11-slim

WORKDIR /app

# Install deps first (Docker layer cache — faster rebuilds)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY api/            ./api/
COPY data_ingestion/ ./data_ingestion/
COPY features/       ./features/
COPY model/          ./model/
COPY pyproject.toml  .

# Install the package in editable mode so Python finds the modules
RUN pip install --no-cache-dir -e .

# Cloud Run injects $PORT at runtime (default 8080)
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "uvicorn api.app:app --host 0.0.0.0 --port ${PORT}"]
