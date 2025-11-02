# Cron Setup Guide

## Overview

The trading bot requires two cron jobs to operate:
1. **Metrics Collection**: Every 20 seconds - collects account balance and performance data
2. **Trading Decisions**: Every 3 minutes - analyzes market and makes trading decisions

## Quick Start

### Development (Recommended)

Run the cron daemon alongside your dev server:

```bash
# Terminal 1 - Dev Server
bun dev

# Terminal 2 - Cron Daemon
bun run cron
```

The cron daemon will:
- ✅ Automatically trigger metrics collection every 20 seconds
- ✅ Automatically trigger trading decisions every 3 minutes
- ✅ Provide real-time logging of all operations
- ✅ Run until stopped with Ctrl+C

### Manual Testing

Trigger individual cron operations:

```bash
# Collect metrics once
bun run cron:metrics

# Make trading decision once
bun run cron:trading
```

## Architecture

### Cron Endpoints

The application exposes two authenticated API endpoints:

1. **GET /api/cron/20-seconds-metrics-interval?token={JWT}**
   - Collects current account metrics
   - Stores in database (max 100 metrics, downsampled)
   - Returns: `Process executed successfully. Metrics count: X (cron)`

2. **GET /api/cron/3-minutes-run-interval?token={JWT}**
   - Fetches market data for all supported coins
   - Analyzes with AI (DeepSeek R1)
   - Makes trading decision (Buy/Sell/Hold)
   - Returns: `Process executed successfully`

Both endpoints require JWT authentication using `CRON_SECRET_KEY` from `.env`.

### Cron Daemon (`scripts/cron-daemon.js`)

Node.js script that:
- Generates JWT tokens for authentication
- Uses `setInterval()` to trigger endpoints at configured intervals
- Runs indefinitely until stopped
- Provides timestamped logging

**Configuration**:
- `CRON_SECRET_KEY` env var (defaults to "1234")
- `NEXT_PUBLIC_URL` env var (defaults to "http://localhost:3001")
- Metrics interval: 20 seconds (hardcoded)
- Trading interval: 3 minutes (hardcoded)

## Production Deployment

### Option 1: PM2 (Recommended)

Use PM2 to manage both processes:

```bash
# Install PM2
npm install -g pm2

# Start processes
pm2 start bun --name "nof1-app" -- run start
pm2 start bun --name "nof1-cron" -- run cron

# Save process list
pm2 save

# Auto-start on system reboot
pm2 startup
```

View logs:
```bash
pm2 logs nof1-cron
pm2 logs nof1-app
```

### Option 2: Docker Compose

Add cron service to `docker-compose.yml`:

```yaml
services:
  app:
    # ... existing app config

  cron:
    build: .
    command: bun run cron
    env_file:
      - .env
    depends_on:
      - postgres
      - app
    restart: unless-stopped
```

### Option 3: System Crontab

Add to crontab for automatic triggers:

```bash
crontab -e
```

Add these lines:
```cron
# Generate token helper (create /tmp/cron_token.sh)
* * * * * TOKEN=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({},'YOUR_CRON_SECRET'))") && echo $TOKEN > /tmp/nof1_token

# Metrics every 20 seconds
* * * * * sleep 0  && curl -s "http://localhost:3001/api/cron/20-seconds-metrics-interval?token=$(cat /tmp/nof1_token)" >> /var/log/nof1-metrics.log 2>&1
* * * * * sleep 20 && curl -s "http://localhost:3001/api/cron/20-seconds-metrics-interval?token=$(cat /tmp/nof1_token)" >> /var/log/nof1-metrics.log 2>&1
* * * * * sleep 40 && curl -s "http://localhost:3001/api/cron/20-seconds-metrics-interval?token=$(cat /tmp/nof1_token)" >> /var/log/nof1-metrics.log 2>&1

# Trading every 3 minutes
*/3 * * * * curl -s "http://localhost:3001/api/cron/3-minutes-run-interval?token=$(cat /tmp/nof1_token)" >> /var/log/nof1-trading.log 2>&1
```

⚠️ **Note**: Crontab approach is less reliable and harder to monitor. PM2 is strongly recommended.

### Option 4: Vercel Cron (Cloud Deployment)

If deploying to Vercel, use [Vercel Cron](https://vercel.com/docs/cron-jobs):

1. Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/20-seconds-metrics-interval",
      "schedule": "*/1 * * * *"
    },
    {
      "path": "/api/cron/3-minutes-run-interval",
      "schedule": "*/3 * * * *"
    }
  ]
}
```

2. Configure environment variables in Vercel dashboard:
   - `CRON_SECRET_KEY`
   - All other required env vars

⚠️ **Limitation**: Vercel cron only supports minute-level granularity. Metrics will collect every 1 minute instead of 20 seconds.

## Monitoring

### Check if Cron is Working

**Database query**:
```sql
-- Check latest activity
SELECT
  'Last Metric' as event,
  MAX(updatedAt) as timestamp
FROM "Metrics"
UNION ALL
SELECT
  'Last Trading',
  MAX(createdAt)
FROM "Trading";
```

**API check**:
```bash
# Get latest metric timestamp
curl -s http://localhost:3001/api/metrics | jq '.data.metrics[-1].createdAt'

# Get latest trading decision
curl -s http://localhost:3001/api/model/chat | jq '.[0].createdAt'
```

### Expected Behavior

**Healthy system**:
- Metrics updated within last 20 seconds
- Trading decision within last 3 minutes (if market is open)
- No error messages in cron daemon logs

**Unhealthy indicators**:
- Last metric > 1 minute old → Metrics cron stopped
- Last trading > 10 minutes old → Trading cron stopped
- Chat shows "Available Cash: 30000" → Data corruption (see fixes/2025-11-02-schema-restoration-data-cleanup.md)

### Logs

**Cron daemon output**:
```
🚀 Starting Cron Daemon...
   BASE_URL: http://localhost:3001
   Metrics interval: 20s
   Trading interval: 180s

✅ Cron Daemon running. Press Ctrl+C to stop.

[2025-11-02T19:03:57.123Z] 📊 Metrics #1: Process executed successfully. Metrics count: 63 (cron)
[2025-11-02T19:03:57.456Z] 🤖 Trading #1: Process executed successfully
[2025-11-02T19:04:17.234Z] 📊 Metrics #2: Process executed successfully. Metrics count: 64 (cron)
```

## Troubleshooting

### Issue: Agent stopped trading

**Symptoms**:
- Dashboard shows old data
- No new trades in Model Activity

**Solution**:
```bash
# Check if cron daemon is running
ps aux | grep cron-daemon

# If not running, start it
bun run cron
```

### Issue: "Invalid token" error

**Cause**: CRON_SECRET_KEY mismatch

**Solution**:
```bash
# Check your .env file
grep CRON_SECRET_KEY .env

# Restart cron daemon after changing secret
```

### Issue: Metrics collecting but no trading

**Possible causes**:
1. Trading cron endpoint not being called
2. AI API rate limit reached
3. Exchange API errors

**Debug**:
```bash
# Manually trigger trading to see error
bun run cron:trading

# Check application logs
# Look for errors in trading logic
```

### Issue: Connection refused

**Cause**: Dev server not running or wrong port

**Solution**:
```bash
# Verify dev server is running
curl http://localhost:3001/api/metrics

# Check NEXT_PUBLIC_URL in .env
# Make sure it matches your dev server port
```

## Scripts Reference

| Script | Command | Purpose |
|--------|---------|---------|
| Cron Daemon | `bun run cron` | Continuous automated operation |
| Metrics Trigger | `bun run cron:metrics` | Manual metrics collection |
| Trading Trigger | `bun run cron:trading` | Manual trading decision |

## Security Notes

1. **Never commit CRON_SECRET_KEY** to version control
2. Use a strong secret in production (not "1234")
3. Consider IP whitelisting for cron endpoints in production
4. Use HTTPS in production to encrypt JWT tokens in transit

## Related Documentation

- [Schema Restoration Fix](fixes/2025-11-02-schema-restoration-data-cleanup.md) - Data corruption prevention
- [CLAUDE.md](../CLAUDE.md) - Overall project documentation
- [API Routes](../app/api/cron/) - Cron endpoint implementation
