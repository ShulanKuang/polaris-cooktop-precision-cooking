#!/usr/bin/env bash
# Publish a change to all three prototype links:
#   1. Local link  (http://localhost:8080)      - served live from this folder
#   2. iPad link   (http://<wifi-ip>:8080)      - same local server over Wi-Fi
#   3. Live link   (GitHub Pages)               - updated by pushing to main
#
# Usage: scripts/publish.sh "commit message"
#
# Steps: bump the ?v= cache tags on styles.css and app.js in index.html so
# Safari/iPad home-screen apps fetch fresh files on refresh, make sure the
# local server is running, commit + push to main, then wait until GitHub
# Pages serves the new version.
set -euo pipefail

MSG="${1:?Usage: scripts/publish.sh \"commit message\"}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
GH="$(command -v gh || echo "$HOME/bin/gh")"
PORT=8080
LIVE_URL="https://shulankuang.github.io/polaris-cooktop-precision-cooking/"

# 1. Cache-busting version tag (same tag for CSS and JS)
VER="$(date +%Y%m%d-%H%M%S)"
sed -i '' -E "s/(styles\.css\?v=)[^\"]*/\1${VER}/; s/(app\.js\?v=)[^\"]*/\1${VER}/" index.html
echo "Cache tag -> v=${VER}"

# 2. Local + iPad server
if ! lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
  echo "Starting local server on port $PORT..."
  nohup python3 -m http.server $PORT --bind 0.0.0.0 -d "$ROOT" >/dev/null 2>&1 &
  sleep 1
fi
WIFI_IP="$(ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")"
if curl -s "http://localhost:$PORT/" | grep -q "app.js?v=${VER}"; then
  echo "Local:  http://localhost:$PORT/?task=3#task3  (updated)"
  echo "iPad:   http://$WIFI_IP:$PORT/?task=3#task3  (updated)"
else
  echo "WARNING: local server on :$PORT is not serving this folder ($ROOT)" >&2
fi

# 3. Commit + push to main (GitHub Pages builds from main /)
git add -A

# Images/fonts/sounds edited in place keep their filename, so iPad Safari keeps its cached copy.
# Give every modified asset a fresh ?v= tag wherever index.html / styles.css / app.js reference it.
git fetch -q origin main || true
CHANGED_ASSETS="$(git diff --cached --name-only --diff-filter=M origin/main -- assets fonts || true)"
if [ -n "$CHANGED_ASSETS" ]; then
  while IFS= read -r asset; do
    [ -z "$asset" ] && continue
    ASSET="$asset" VER="$VER" perl -pi -e 's/(\Q$ENV{ASSET}\E)(\?v=[^"\x27)\s]*)?(?=["\x27)\s])/$1?v=$ENV{VER}/g' index.html styles.css app.js
    echo "Cache tag -> $asset"
  done <<< "$CHANGED_ASSETS"
  git add index.html styles.css app.js
fi

if git diff --cached --quiet; then
  echo "Nothing to commit."
else
  git commit -q -m "$MSG"
fi
git push -q origin main
echo "Pushed $(git rev-parse --short HEAD) to main."

# 4. Wait for GitHub Pages to serve the new version (usually < 1 min)
for _ in $(seq 1 30); do
  if curl -s "${LIVE_URL}?nc=$RANDOM" | grep -q "app.js?v=${VER}"; then
    echo "Live:   ${LIVE_URL}  (updated)"
    exit 0
  fi
  sleep 10
done
echo "WARNING: GitHub Pages has not picked up v=${VER} after 5 min; check: $GH run list" >&2
exit 1
