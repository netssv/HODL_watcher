"""
data_ingestion — API clients for all external data sources.

Each client:
  - Checks local SQLite cache before making network calls
  - Uses exponential backoff with jitter on failure
  - Returns pandas DataFrames with UTC-normalized timestamps
  - Records metadata: source, fetch timestamp, detected gaps
"""
