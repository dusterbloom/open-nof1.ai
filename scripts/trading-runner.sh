#!/bin/bash

# Script to trigger AI trading decisions every 3 minutes
# This simulates a cron job for local development

CRON_SECRET="${CRON_SECRET_KEY:-1234}"
BASE_URL="http://localhost:3001"

echo "Starting AI trading runner..."
echo "Triggering AI trading decisions every 3 minutes..."
echo "Press Ctrl+C to stop"

while true; do
    # Generate JWT token
    TOKEN=$(node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({ iat: Math.floor(Date.now() / 1000) }, '$CRON_SECRET'));")

    # Call trading endpoint
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    echo ""
    echo "[$TIMESTAMP] 🤖 Triggering AI trading decision..."

    RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/cron/3-minutes-run-interval?token=${TOKEN}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "[$TIMESTAMP] ✓ Trading decision completed successfully"
        echo "   Response: $BODY"
    else
        echo "[$TIMESTAMP] ✗ Trading decision failed (HTTP $HTTP_CODE)"
        echo "   Error: $BODY"
    fi

    # Wait 3 minutes (180 seconds)
    echo "   Waiting 3 minutes until next decision..."
    sleep 180
done
