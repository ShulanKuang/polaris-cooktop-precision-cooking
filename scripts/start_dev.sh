#!/usr/bin/env bash
# Quick script to verify or start local server and localtunnel

PORT=8080
SUBDOMAIN="busy-baths-search"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Checking port $PORT..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "Local server is already running on port $PORT."
else
    echo "Starting local Python HTTP server on port $PORT..."
    python3 -m http.server $PORT -d "$PROJECT_DIR" &
    sleep 1
fi

# Detect Wi-Fi IP
WIFI_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "127.0.0.1")

echo ""
echo "=========================================================="
echo " Polaris Cooktop Prototype Dev Environment"
echo "=========================================================="
echo " Local URL:     http://localhost:$PORT/?task=3#task3"
echo " Wi-Fi iPad:    http://$WIFI_IP:$PORT/?task=3#task3"
echo " Live Tunnel:   https://e48738366e84c57c-4-53-66-82.serveousercontent.com/?task=3#task3"
echo " CDP Debugger:  http://127.0.0.1:9245"
echo "=========================================================="
