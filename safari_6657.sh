#!/bin/sh
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

OUT="$(./verify_6657.sh)"
printf "%s\n" "$OUT"

URL="$(printf "%s\n" "$OUT" | awk -F= '/^SAFARI_URL=/{print $2}' | tail -n 1)"
if [ -z "$URL" ]; then
  echo "ERROR: SAFARI_URL missing (verify failed?)"
  exit 1
fi

echo "OPENING=$URL"
open -a Safari "$URL"
osascript -e 'tell application "Safari" to activate'
