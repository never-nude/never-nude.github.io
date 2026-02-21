#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

PORT="${PORT:-6657}"
APP="${APP:-invictus_g}"
TS="$(date +%s)"

echo "REPO=$DIR"
echo "PORT=$PORT"
echo "APP=$APP"

if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "LISTENER=YES"
else
  echo "LISTENER=NO"
  echo "Start server in SERVER tab:"
  echo "  ./server_6657.sh"
  exit 1
fi

TRUTH_URL="http://127.0.0.1:$PORT/$APP/TRUTH.txt?ts=$TS"
echo "TRUTH_URL=$TRUTH_URL"

TRUTH="$(curl -s --max-time 2 "$TRUTH_URL" || true)"
if [ -z "$TRUTH" ]; then
  echo "ERROR: couldn't fetch TRUTH. (Wrong root, wrong port, or server not running.)"
  exit 1
fi

echo "---- TRUTH (first 25 lines) ----"
printf "%s\n" "$TRUTH" | sed -n '1,25p'

BUILD_ID="$(printf "%s\n" "$TRUTH" | awk -F= '/^BUILD_ID=/{print $2}' | tr -d '\r')"
if [ -z "$BUILD_ID" ]; then
  echo "ERROR: BUILD_ID not found in TRUTH."
  exit 1
fi

echo "BUILD_ID(served)=$BUILD_ID"
URL="http://127.0.0.1:$PORT/$APP/?v=$BUILD_ID&ts=$TS"
echo "SAFARI_URL=$URL"
