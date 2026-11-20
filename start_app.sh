#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/app"

if [ -d "$HOME/.nvm/versions/node" ]; then
  NODE_BIN="$(find "$HOME/.nvm/versions/node" -maxdepth 2 -type d -name bin 2>/dev/null | head -n 1)"
  [ -n "$NODE_BIN" ] && export PATH="$NODE_BIN:$PATH"
fi

export PORT="${PORT:-5174}"
export HOST="${HOST:-0.0.0.0}"

echo "Starting JBM Logistics Optimization Platform (LoadIQ) on http://${HOST}:${PORT}..."
exec npm run dev -- --host "$HOST" --port "$PORT"
