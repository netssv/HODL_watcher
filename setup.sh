#!/usr/bin/env bash
# =============================================================================
# HODL Watcher — One-Time Setup Script
# Run this ONCE on each new computer to set up the project
# Usage:
#   ./setup.sh
# =============================================================================

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
BOLD='\033[1m'
CYAN='\033[1;36m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
RESET='\033[0m'

# Helpers
banner() {
  echo ""
  echo -e "${CYAN}${BOLD}╔════════════════════════════════════════════╗${RESET}"
  echo -e "${CYAN}${BOLD}║   HODL Watcher — Setup Script             ║${RESET}"
  echo -e "${CYAN}${BOLD}╚════════════════════════════════════════════╝${RESET}"
  echo ""
}

ok()   { echo -e "${GREEN}✔${RESET}  $*"; }
err()  { echo -e "${RED}✖${RESET}  $*"; }
info() { echo -e "${CYAN}ℹ${RESET}  $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }

banner

# Check Python version
info "Checking Python version..."
if ! command -v python3 &>/dev/null; then
  err "Python 3 not found. Please install Python 3.10+ first."
  exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
info "Found Python $PYTHON_VERSION"

# Create virtual environment
info "Setting up Python virtual environment..."
if [[ ! -d "$ROOT/.venv" ]]; then
  python3 -m venv "$ROOT/.venv"
  ok "Virtual environment created"
else
  ok "Virtual environment already exists"
fi

# Fix broken symlinks on systems that point to /usr/bin/python instead of embedded Python
# (CachyOS, Fedora, and others sometimes create broken venv symlinks)
info "Verifying Python symlinks..."
if [[ -L "$ROOT/.venv/bin/python3" ]] && [[ "$(readlink "$ROOT/.venv/bin/python3")" == "/usr/bin/python3" ]]; then
  rm "$ROOT/.venv/bin/python3"
  ln -s "$(which python3.13 || which python3)" "$ROOT/.venv/bin/python3"
  ok "Fixed python3 symlink"
fi

# Upgrade pip in the venv
info "Installing/upgrading pip..."
if ! "$ROOT/.venv/bin/pip" install --upgrade pip setuptools wheel > /dev/null 2>&1; then
  err "Failed to upgrade pip"
  "$ROOT/.venv/bin/pip" install --upgrade pip setuptools wheel  # Show errors
  exit 1
fi
ok "pip upgraded"

# Install Python dependencies
info "Installing Python dependencies..."
cd "$ROOT"
if ! "$ROOT/.venv/bin/pip" install -e ".[dev]"; then
  err "Failed to install Python dependencies"
  echo ""
  echo "Try running manually:"
  echo "    .venv/bin/pip install -e '.[dev]'"
  exit 1
fi
ok "Python dependencies installed"

# Check Node.js
info "Checking Node.js..."

# Handle Flatpak environment: detect host-spawn for Node.js access
if [[ -f "/app/bin/host-spawn" ]] && ! command -v node &>/dev/null; then
  info "Detected Flatpak environment, using host-spawn for Node.js"
  export NPM="/app/bin/host-spawn npm"
  NODE_CMD="/app/bin/host-spawn node"
else
  export NPM="npm"
  NODE_CMD="node"
fi

if ! $NODE_CMD --version &>/dev/null; then
  err "Node.js not found. Please install Node.js first (https://nodejs.org/ or use nvm)"
  exit 1
fi

NODE_VERSION=$($NODE_CMD -v)
info "Found $NODE_VERSION"

# Install frontend dependencies
info "Installing frontend dependencies..."
if [[ ! -x "$ROOT/frontend/node_modules/.bin/vite" ]]; then
  cd "$ROOT/frontend"
  if ! $NPM install --silent; then
    err "Failed to install frontend dependencies"
    $NPM install  # Show errors
    exit 1
  fi
  ok "Frontend dependencies installed"
else
  ok "Frontend dependencies already exist"
fi

# Check for .env file
if [[ ! -f "$ROOT/.env" ]]; then
  warn "⚠${RESET}  .env file not found. Create one with your API credentials (FRED, NewsAPI, Deribit keys)"
  echo ""
  echo "    Optional API keys for optional data sources:"
  echo "    FRED_API_KEY=your_key"
  echo "    NEWSAPI_KEY=your_key"
  echo "    DERIBIT_CLIENT_ID=your_id"
  echo "    DERIBIT_CLIENT_SECRET=your_secret"
  echo ""
else
  ok ".env file exists"
fi

echo ""
echo -e "${GREEN}${BOLD}✓ Setup complete!${RESET}"
echo ""
echo "Next steps:"
echo "  1. (Optional) Create .env with API credentials"
echo "  2. Run the project:"
echo "     ${BOLD}./dev.sh${RESET}          (start both backend + frontend)"
echo "     ${BOLD}./dev.sh backend${RESET}  (backend only)"
echo "     ${BOLD}./dev.sh frontend${RESET} (frontend only)"
echo ""
