#!/bin/bash
# Stop ngrok tunnel and restore GOOGLE_CALLBACK_URL to localhost:3000
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Stopping ngrok..."
docker compose --profile ngrok stop ngrok

# Restore localhost callback URL
if grep -q "^GOOGLE_CALLBACK_URL=" .env; then
  sed -i "s|^GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback|" .env
fi

# Restart backend with restored URL
echo "Restarting backend with localhost callback URL..."
docker compose up -d --no-deps backend

echo ""
echo "ngrok stopped. GOOGLE_CALLBACK_URL restored to http://localhost:3000/auth/google/callback"
echo ""
