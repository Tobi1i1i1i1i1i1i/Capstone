#!/bin/bash
# Start ngrok tunnel, auto-update GOOGLE_CALLBACK_URL, restart backend
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load .env
if [ -f .env ]; then
  set -a; source .env; set +a
fi

if [ -z "$NGROK_AUTHTOKEN" ]; then
  echo "ERROR: NGROK_AUTHTOKEN is not set in .env"
  echo "Get your token at: https://dashboard.ngrok.com/get-started/your-authtoken"
  exit 1
fi

echo "Starting ngrok..."
docker compose --profile ngrok up -d ngrok

# Wait for ngrok API to be ready (up to 20 seconds)
echo "Waiting for tunnel..."
PUBLIC_URL=""
for i in $(seq 1 20); do
  PUBLIC_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
    | grep -o '"public_url":"https://[^"]*"' \
    | grep -o 'https://[^"]*' \
    | head -1)
  [ -n "$PUBLIC_URL" ] && break
  sleep 1
done

if [ -z "$PUBLIC_URL" ]; then
  echo "ERROR: ngrok tunnel did not start in time."
  echo "Check logs: docker compose --profile ngrok logs ngrok"
  exit 1
fi

CALLBACK_URL="$PUBLIC_URL/auth/google/callback"

# Update GOOGLE_CALLBACK_URL in .env
if grep -q "^GOOGLE_CALLBACK_URL=" .env; then
  sed -i "s|^GOOGLE_CALLBACK_URL=.*|GOOGLE_CALLBACK_URL=$CALLBACK_URL|" .env
else
  echo "GOOGLE_CALLBACK_URL=$CALLBACK_URL" >> .env
fi

# Restart backend so it picks up the new callback URL
echo "Restarting backend with new GOOGLE_CALLBACK_URL..."
docker compose up -d --no-deps backend

echo ""
echo "======================================================"
echo "  ngrok tunnel active"
echo "======================================================"
echo "  Public URL : $PUBLIC_URL"
echo "  ngrok UI   : http://localhost:4040"
echo "======================================================"
echo ""
echo "ACTION REQUIRED — add this redirect URI in Google Cloud Console:"
echo "  $CALLBACK_URL"
echo ""
echo "  https://console.cloud.google.com/apis/credentials"
echo "  → OAuth 2.0 Client → Authorised redirect URIs → Add URI"
echo ""
