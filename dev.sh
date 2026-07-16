#!/usr/bin/env bash
# =============================================================================
# HODL Watcher — Dev Launcher
# Usage:
#   ./dev.sh           → start backend + frontend
#   ./dev.sh backend   → backend only
#   ./dev.sh frontend  → frontend only
#   ./dev.sh test      → run pytest suite
#   ./dev.sh smoke     → run smoke tests against a live server
#   ./dev.sh stop      → kill any lingering processes on ports 8000/5173
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$ROOT/.venv/bin"
LOG_DIR="$ROOT/.dev_logs"
mkdir -p "$LOG_DIR"

# ── Colours ──────────────────────────────────────────────────────────────────
BOLD='\033[1m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
MAGENTA='\033[1;35m'
DIM='\033[2m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
banner() {
  echo ""
  echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║         🪙  HODL Watcher  Dev Launcher        ║${RESET}"
  echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
  echo ""
}

log()  { echo -e "${DIM}[$(date +%H:%M:%S)]${RESET} $*"; }
ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✖${RESET}  $*"; }
info() { echo -e "${MAGENTA}ℹ${RESET}  $*"; }

kill_port() {
  local port=$1
  # Prefer fuser (works without lsof), fall back to lsof
  if command -v fuser &>/dev/null; then
    if fuser "${port}/tcp" &>/dev/null 2>&1; then
      warn "Killing existing process on port $port"
      fuser -k "${port}/tcp" 2>/dev/null || true
    fi
  elif command -v lsof &>/dev/null; then
    local pid
    pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [[ -n "$pid" ]]; then
      warn "Killing existing process on port $port (PID $pid)"
      kill "$pid" 2>/dev/null || true
    fi
  fi
  # Wait until the OS releases the port (max 3s)
  local i
  for i in 1 2 3; do
    ss -tlnp 2>/dev/null | grep -q ":${port} " || return 0
    sleep 1
  done
}

wait_for_port() {
  local port=$1 name=$2 retries=30
  for ((i=1; i<=retries; i++)); do
    # Use ss if nc is unavailable
    if command -v nc &>/dev/null; then
      nc -z 127.0.0.1 "$port" 2>/dev/null && { ok "$name is up on port $port"; return 0; }
    else
      ss -tlnp 2>/dev/null | grep -q ":${port} " && { ok "$name is up on port $port"; return 0; }
    fi
    echo -ne "${DIM}  waiting for $name... ($i/$retries)\r${RESET}"
    sleep 1
  done
  err "$name failed to start on port $port"
  return 1
}

check_venv() {
  if [[ ! -x "$VENV/python" ]]; then
    err "Virtual-env not found at .venv/"
    info "Create it with:  python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'"
    exit 1
  fi
}

check_node() {
  if ! command -v npm &>/dev/null; then
    err "npm not found — install Node.js first."
    exit 1
  fi
  if [[ ! -d "$ROOT/frontend/node_modules" ]]; then
    warn "node_modules missing. Installing frontend deps..."
    (cd "$ROOT/frontend" && npm install --silent)
  fi
}

ensure_backend_ready() {
  local retries=20
  for ((i=1; i<=retries; i++)); do
    if curl -fsS http://127.0.0.1:8000/docs >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  err "Backend did not become ready on http://127.0.0.1:8000"
  return 1
}

# ── Modes ─────────────────────────────────────────────────────────────────────
start_backend() {
  check_venv
  kill_port 8000
  log "Starting FastAPI backend..."
  "$VENV/uvicorn" api.app:app \
    --host 127.0.0.1 --port 8000 --reload \
    --log-level info \
    2>&1 | sed "s/^/$(printf "${CYAN}[backend]${RESET} ")/" &
  BACKEND_PID=$!
  wait_for_port 8000 "Backend"
}

start_frontend() {
  check_node
  kill_port 5173
  log "Starting Vite frontend..."
  (cd "$ROOT/frontend" && VITE_API_PROXY_TARGET=http://127.0.0.1:8000 npm run dev -- --host 127.0.0.1 2>&1 \
    | sed "s/^/$(printf "${MAGENTA}[frontend]${RESET} ")/") &
  FRONTEND_PID=$!
  wait_for_port 5173 "Frontend"
}

run_tests() {
  check_venv
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${CYAN}${BOLD}  Running pytest suite…${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  cd "$ROOT"
  "$VENV/python" -m pytest --tb=short -v "$@"
}

run_smoke() {
  check_venv
  echo ""
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${YELLOW}${BOLD}  Running smoke tests (starts a temp server)…${RESET}"
  echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  cd "$ROOT"
  "$VENV/python" scripts/smoke_test.py
}

stop_all() {
  warn "Stopping all HODL Watcher dev processes..."
  kill_port 8000
  kill_port 5173
  ok "Done."
}

# ── Trap (graceful Ctrl-C) ────────────────────────────────────────────────────
cleanup() {
  echo ""
  warn "Shutting down HODL Watcher..."
  # Kill child processes we started
  [[ -n "${BACKEND_PID:-}" ]]  && kill "$BACKEND_PID"  2>/dev/null || true
  [[ -n "${FRONTEND_PID:-}" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
  # Belt-and-suspenders: kill anything still on the ports
  kill_port 8000
  kill_port 5173
  ok "Goodbye. 🪙"
  exit 0
}
trap cleanup INT TERM

# ── Entry point ───────────────────────────────────────────────────────────────
CMD="${1:-both}"

case "$CMD" in
  both|"")
    banner
    start_backend
    ensure_backend_ready
    start_frontend
    echo ""
    ok  "HODL Watcher is running!"
    info "Backend  → ${BOLD}http://127.0.0.1:8000${RESET}        (API docs: /docs)"
    info "Frontend → ${BOLD}http://127.0.0.1:5173${RESET}"
    echo ""
    echo -e "${DIM}Press Ctrl+C to stop both servers.${RESET}"
    echo ""
    wait   # Wait for background jobs
    ;;
  backend)
    banner
    start_backend
    info "Backend  → ${BOLD}http://127.0.0.1:8000/docs${RESET}"
    echo -e "${DIM}Press Ctrl+C to stop.${RESET}"
    wait
    ;;
  frontend)
    banner
    start_frontend
    info "Frontend → ${BOLD}http://127.0.0.1:5173${RESET}"
    echo -e "${DIM}Press Ctrl+C to stop.${RESET}"
    wait
    ;;
  test|tests)
    shift || true
    run_tests "$@"
    ;;
  smoke)
    run_smoke
    ;;
  stop)
    stop_all
    ;;
  *)
    err "Unknown command: $CMD"
    echo ""
    echo -e "Usage: ${BOLD}./dev.sh${RESET} [both|backend|frontend|test|smoke|stop]"
    exit 1
    ;;
esac
