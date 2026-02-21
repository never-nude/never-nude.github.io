#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PORT="${PORT:-6657}"

if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: Port $PORT already has a listener:"
  lsof -nP -iTCP:$PORT -sTCP:LISTEN
  echo
  echo "If that listener is your correct server, leave it running."
  echo "If it's stale/wrong, stop it (Ctrl+C in that server tab) or kill it with:"
  echo "  lsof -tiTCP:$PORT -sTCP:LISTEN | xargs -n1 kill"
  exit 1
fi

echo "Serving repo root: $DIR"
echo "URL: http://127.0.0.1:$PORT/"
echo "Stop with Ctrl+C."
python3 -m http.server "$PORT" --bind 127.0.0.1
