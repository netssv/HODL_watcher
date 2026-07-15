# HODL Watcher — Developer Makefile
# Run `make` or `make help` to see all available commands.

.PHONY: help dev backend frontend test smoke stop install install-dev

ROOT := $(shell pwd)
VENV := $(ROOT)/.venv/bin

# ─── Default: show help ───────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  🪙  HODL Watcher — Make commands"
	@echo ""
	@echo "  make dev        → Start backend + frontend (Ctrl-C to stop)"
	@echo "  make backend    → Start FastAPI backend only (port 8000)"
	@echo "  make frontend   → Start Vite frontend only  (port 5173)"
	@echo "  make test       → Run full pytest suite"
	@echo "  make test K=foo → Run tests matching keyword 'foo'"
	@echo "  make smoke      → Run smoke tests against a temp live server"
	@echo "  make stop       → Kill any processes on ports 8000 / 5173"
	@echo "  make install    → pip install project in editable mode"
	@echo "  make install-dev→ pip install with dev extras (pytest, httpx)"
	@echo ""

# ─── Server commands ──────────────────────────────────────────────────────────
dev:
	@bash $(ROOT)/dev.sh both

backend:
	@bash $(ROOT)/dev.sh backend

frontend:
	@bash $(ROOT)/dev.sh frontend

stop:
	@bash $(ROOT)/dev.sh stop

# ─── Testing ──────────────────────────────────────────────────────────────────
# Usage: make test            → all tests
#        make test K=features → only tests matching "features"
#        make test K=api V=1  → verbose + filter
K ?=
V ?=

test:
	@cd $(ROOT) && $(VENV)/python -m pytest --tb=short \
		$(if $(K),-k "$(K)",) \
		$(if $(V),-v,) \
		tests/

smoke:
	@bash $(ROOT)/dev.sh smoke

# ─── Setup ───────────────────────────────────────────────────────────────────
install:
	$(VENV)/pip install -e .

install-dev:
	$(VENV)/pip install -e ".[dev]"
