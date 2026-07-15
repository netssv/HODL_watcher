"""
Integration smoke test to verify backend startup and endpoint connectivity.
Starts uvicorn, hits the predict, data, and train routes, verifies structures, and exits.
"""

import sys
import time
import subprocess
import requests
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("smoke_test")


def main():
    logger.info("Starting HODL Watcher backend for smoke tests...")
    
    # Start FastAPI server as a subprocess
    proc = subprocess.Popen(
        ["uvicorn", "api.app:app", "--host", "127.0.0.1", "--port", "8000"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    # Wait for server startup
    time.sleep(3)
    
    # Verify process is still running
    if proc.poll() is not None:
        logger.error("FastAPI server failed to start. Logs:")
        out, err = proc.communicate()
        logger.error(err.decode())
        sys.exit(1)
        
    try:
        # 1. Hit Predict Endpoint
        logger.info("Hitting GET /api/predict ...")
        res = requests.get("http://127.0.0.1:8000/api/predict", timeout=10)
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"
        payload = res.json()["payload"]
        
        # Verify required keys in JSON
        assert "meta" in payload
        assert "market_snapshot" in payload
        assert "model_prediction" in payload
        assert "validation_summary" in payload
        assert "news_context" in payload
        assert "disclaimers" in payload
        
        # Verify specific details
        assert payload["meta"]["horizon_hours"] == 24
        assert len(payload["disclaimers"]) > 0
        logger.info("Predict endpoint verified successfully!")

        # 2. Hit Data Endpoint
        logger.info("Hitting GET /api/data/BTCUSDT ...")
        res = requests.get("http://127.0.0.1:8000/api/data/BTCUSDT?limit=10", timeout=10)
        assert res.status_code == 200
        assert len(res.json()["data"]) > 0
        logger.info("Data endpoint verified successfully!")

        # 3. Hit News Instructions Endpoint
        logger.info("Hitting GET /api/news-instructions ...")
        res = requests.get("http://127.0.0.1:8000/api/news-instructions", timeout=10)
        assert res.status_code == 200
        assert len(res.json()["keywords_to_search"]) > 0
        logger.info("News instructions endpoint verified successfully!")
        
        logger.info("All smoke tests completed successfully! No issues found.")
        
    except Exception as e:
        logger.error(f"Smoke test failed: {e}")
        proc.terminate()
        sys.exit(1)
        
    finally:
        logger.info("Stopping FastAPI server...")
        proc.terminate()
        proc.wait()


if __name__ == "__main__":
    main()
