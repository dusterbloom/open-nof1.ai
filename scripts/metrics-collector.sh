#!/bin/bash

# Script to collect metrics every 20 seconds
# This simulates a cron job for local development

CRON_SECRET="${CRON_SECRET_KEY:-1234}"
BASE_URL="http://localhost:3001"

echo "Starting metrics collector..."
echo "Collecting metrics every 20 seconds..."
echo "Press Ctrl+C to stop"

while true; do
    # Generate JWT token
    TOKEN=$(node -e "const jwt = require('jsonwebtoken'); console.log(jwt.sign({ iat: Math.floor(Date.now() / 1000) }, '$CRON_SECRET'));")

    # Call metrics endpoint
    RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/cron/20-seconds-metrics-interval?token=${TOKEN}")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | head -n-1)

    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

    if [ "$HTTP_CODE" -eq 200 ]; then
        echo "[$TIMESTAMP] ✓ Metrics collected: $BODY"
    else
        echo "[$TIMESTAMP] ✗ Failed (HTTP $HTTP_CODE): $BODY"
    fi

    # Wait 20 seconds
    sleep 20
done
