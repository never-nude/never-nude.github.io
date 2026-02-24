#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-6657}"
APP="${APP:-invictus_acies}"
ts="$(date +%s)"

cd "$(dirname "$0")/.."

# Start server if not listening
if ! lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Starting server on http://127.0.0.1:$PORT (from $(pwd))"
  python3 -m http.server "$PORT" --bind 127.0.0.1 >/tmp/invictus_${PORT}.log 2>&1 &
  sleep 0.2
else
  pid="$(lsof -ti tcp:$PORT -sTCP:LISTEN 2>/dev/null | head -n 1 || true)"
  echo "Server already listening on $PORT (pid: ${pid:-?})"
fi

base="http://127.0.0.1:${PORT}"
echo "EXPECT 200:"
for p in "/${APP}/" "/${APP}/TRUTH.txt" "/${APP}/scenario.json" "/${APP}/board_layout.json"; do
  code="$(curl -s -o /dev/null -w "%{http_code}" "${base}${p}?ts=${ts}")"
  printf "  %-28s -> %s\n" "$p" "$code"
done

GAME_URL="${base}/${APP}/?ts=${ts}"
TRUTH_URL="${base}/${APP}/TRUTH.txt?ts=${ts}"

# Drive Safari; fall back to printing URLs
if ! osascript <<OSA >/dev/null 2>&1
tell application "Safari"
  activate
  if (count of windows) = 0 then make new document
  tell window 1
    set current tab to (make new tab with properties {URL:"$GAME_URL"})
    set current tab to (make new tab with properties {URL:"$TRUTH_URL"})
  end tell
end tell
OSA
then
  echo "Safari automation failed (check: System Settings → Privacy & Security → Automation → Terminal → Safari)."
  echo "Open manually:"
  echo "  $GAME_URL"
  echo "  $TRUTH_URL"
  open -a Safari "$GAME_URL" || true
  open -a Safari "$TRUTH_URL" || true
fi

echo "DONE."
