#!/usr/bin/env bash
# Runs the HomeShield backend (Flask + Socket.IO + serial reader)
# and the frontend (Vite dev server) together.
# Ctrl+C stops both cleanly.

set -u
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

VENV="$REPO_DIR/.venv"
FRONTEND="$REPO_DIR/frontend"

# --- sanity checks ---------------------------------------------------------

if [ ! -x "$VENV/bin/python" ]; then
  echo "[setup] creating Python venv at $VENV"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install --quiet flask flask-socketio pyserial simple-websocket
fi

if [ ! -d "$FRONTEND/node_modules" ]; then
  echo "[setup] installing frontend deps"
  (cd "$FRONTEND" && npm install --silent)
fi

# --- free ports / old processes -------------------------------------------

pkill -f "$VENV/bin/python app.py" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1

# --- launch ----------------------------------------------------------------

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo
  echo "[run] shutting down..."
  [ -n "$BACKEND_PID" ]  && kill "$BACKEND_PID"  2>/dev/null || true
  [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
  # give children a moment, then force-kill anything left
  sleep 1
  pkill -f "$VENV/bin/python app.py" 2>/dev/null || true
  pkill -f "vite" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

echo "[run] starting backend (Flask @ :5000)"
"$VENV/bin/python" app.py 2>&1 | sed -u 's/^/[backend] /' &
BACKEND_PID=$!

echo "[run] starting frontend (Vite @ :5173)"
(cd "$FRONTEND" && npm run dev --silent) 2>&1 | sed -u 's/^/[frontend] /' &
FRONTEND_PID=$!

echo
echo "[run] UI:        http://localhost:5173"
echo "[run] Backend:   http://localhost:5000"
echo "[run] Ctrl+C to stop both."
echo

wait
