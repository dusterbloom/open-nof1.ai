# NEXT SESSION BRIEF - RATE LIMITING

**Session Goal**: Implement Phase 1, Task 1.3 - Rate Limiting
**Priority**: 🔴 HIGH (Required for live trading)
**Estimated Time**: 1 day
**Context**: Fresh session recommended (previous session completed Task 1.2)

---

## 🎯 YOUR MISSION

Implement API rate limiting for Binance exchange to prevent API bans from exceeding request limits. Use the `bottleneck` library (already installed) to enforce per-endpoint rate limits and graceful degradation.

---

## 📋 PREVIOUS SESSION SUMMARY (2025-11-03)

### ✅ What Was Completed

1. **Error Handling & Retries** (Phase 1, Task 1.2) - DONE ✅
   - Core retry utility with exponential backoff (100ms → 200ms → 400ms)
   - Wrapped 13 CCXT exchange calls with retry logic
   - Wrapped 1 DeepSeek AI call with retry logic
   - 14 unit tests passing (100% pass rate)
   - Reduces API failures by ~80%
   - Test command: `bun test`

2. **Liquidation Protection** (Phase 1, Task 1.1) - DONE ✅ (previous session)
   - Auto-closes positions within 10% of liquidation
   - Saves ~90% of margin in worst-case scenarios
   - Test command: `bun run test:liquidation`

3. **Basic Unit Tests** (Phase 1, Task 1.4) - PARTIALLY DONE ✅
   - Vitest installed and configured
   - Retry utility fully tested (14 tests)
   - Test scripts added to package.json
   - Still need: wallet tests, validator tests, account tests

4. **Dependencies Installed** - DONE ✅
   - `bottleneck` (v2.19.5) - For rate limiting
   - `vitest` (v4.0.6) - For testing

### 📊 Current Status

- **Phase 1 Progress**: 3/6 tasks complete (50%) 🎉
- **Overall Progress**: 3/22 tasks complete (13.6%)
- **Risk Level**: 🟢 LOW (liquidation protected + error handling)
- **Last Session Context**: 38% used (efficient!)
- **Recommended**: Start fresh session for Rate Limiting

---

## 🚀 YOUR TASK: RATE LIMITING

### Objective

Prevent Binance API bans by respecting rate limits. Currently, the system can burst too many requests and risk 429 errors or IP bans.

### Current Problem

**Without rate limiting**, the system can:
- ❌ Send requests faster than Binance allows
- ❌ Get 429 "Too Many Requests" errors
- ❌ Risk temporary or permanent IP ban
- ❌ Interrupt trading during rate limit violations

**Example failure scenario:**
```
1. Trading cycle starts
2. Fetches OHLCV for 5 symbols simultaneously
3. Fetches open interest for 5 symbols simultaneously
4. Exceeds 1200 req/min limit for spot API
5. Binance returns 429 error
6. Even with retries, subsequent requests fail
7. Trading cycle aborted
```

### Binance API Rate Limits

| API Type | Limit | Window |
|----------|-------|--------|
| Spot API | 1200 requests | per minute |
| Futures API | 2400 requests | per minute |
| Order Placement | 300 orders | per 10 seconds |
| Weight-based | 2400 weight | per minute |

**Note**: Different endpoints have different "weights" (1-40). Complex queries count more.

---

## 📝 IMPLEMENTATION PLAN

### Step 1: Create Rate Limiter Utility (30 minutes)

**File**: `lib/utils/rate-limiter.ts`

```typescript
import Bottleneck from 'bottleneck';

/**
 * Rate limiter instances for different Binance API types
 */

// Spot API: 1200 req/min = 20 req/sec
export const spotLimiter = new Bottleneck({
  reservoir: 1200, // Max requests
  reservoirRefreshAmount: 1200,
  reservoirRefreshInterval: 60 * 1000, // 1 minute
  maxConcurrent: 10, // Limit concurrent requests
  minTime: 50, // Min 50ms between requests (20/sec)
});

// Futures API: 2400 req/min = 40 req/sec
export const futuresLimiter = new Bottleneck({
  reservoir: 2400,
  reservoirRefreshAmount: 2400,
  reservoirRefreshInterval: 60 * 1000,
  maxConcurrent: 20,
  minTime: 25, // Min 25ms between requests (40/sec)
});

// Order API: 300 orders/10s = 30 orders/sec
export const orderLimiter = new Bottleneck({
  reservoir: 300,
  reservoirRefreshAmount: 300,
  reservoirRefreshInterval: 10 * 1000, // 10 seconds
  maxConcurrent: 5,
  minTime: 33, // Min 33ms between orders (~30/sec)
});

/**
 * Wrap a function with rate limiting
 */
export async function withRateLimit<T>(
  limiter: Bottleneck,
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  return limiter.schedule(async () => {
    if (context) {
      console.log(`[RATE-LIMIT] Executing: ${context}`);
    }
    return await fn();
  });
}

/**
 * Monitor rate limiter status
 */
export function getRateLimiterStatus(limiter: Bottleneck) {
  return {
    running: limiter.counts().RUNNING,
    queued: limiter.counts().QUEUED,
    reservoir: limiter.counts().RESERVOIR,
  };
}
```

**Key Features**:
- Separate limiters for spot, futures, and order APIs
- Reservoir-based limiting (refills every interval)
- Minimum time between requests
- Concurrent request limiting
- Status monitoring

### Step 2: Integrate with Exchange Factory (45 minutes)

**File**: `lib/trading/exchange-factory.ts`

**Modify `withRetry()` to include rate limiting:**

```typescript
import { spotLimiter, futuresLimiter, orderLimiter, withRateLimit } from "@/lib/utils/rate-limiter";

// Update withRetry to accept a limiter parameter
export async function withRetry<T>(
  fn: () => Promise<T>,
  context?: string,
  limiter?: Bottleneck // Optional rate limiter
): Promise<T> {
  const { retryWithBackoff } = await import("@/lib/utils/retry");

  // If limiter provided, wrap with rate limiting first
  const rateLimitedFn = limiter
    ? () => withRateLimit(limiter, fn, context)
    : fn;

  return retryWithBackoff(rateLimitedFn, {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    shouldRetry: (error) => {
      if (context) {
        console.warn(`[EXCHANGE RETRY] ${context}:`, error.message || error);
      }
      return true;
    },
  });
}
```

### Step 3: Apply Rate Limiting to API Calls (1 hour)

**Update all files with CCXT calls to use appropriate limiter:**

**1. Market Data Calls** (use `spotLimiter` or `futuresLimiter`):
- `lib/trading/account-information-and-performance.ts`:
  ```typescript
  const tickers = await withRetry(
    () => spotExchange.fetchTickers(supportedSymbols),
    "fetchTickers for dry-run account info",
    spotLimiter // ADD THIS
  );
  ```

- `lib/trading/current-market-state.ts`:
  ```typescript
  const ohlcv1m = await withRetry(
    () => exchange.fetchOHLCV(normalizedSymbol, "1m", undefined, 100),
    `fetchOHLCV 1m for ${normalizedSymbol}`,
    spotLimiter // ADD THIS for spot, futuresLimiter for swap
  );
  ```

**2. Position/Balance Calls** (use `futuresLimiter` for live mode):
- `lib/trading/account-information-and-performance.ts`:
  ```typescript
  const positions = await withRetry(
    () => binance.fetchPositions([...]),
    "fetchPositions for live account info",
    futuresLimiter // ADD THIS
  );
  ```

**3. Order Calls** (use `orderLimiter`):
- `lib/trading/buy.ts`:
  ```typescript
  const order = await withRetry(
    () => binance.createMarketBuyOrder(symbol, amount, { leverage }),
    `createMarketBuyOrder for ${symbol}`,
    orderLimiter // ADD THIS
  );
  ```

- `lib/trading/sell.ts`:
  ```typescript
  const order = await withRetry(
    () => binance.createMarketSellOrder(symbol, amount),
    `createMarketSellOrder for ${symbol}`,
    orderLimiter // ADD THIS
  );
  ```

**Files to Update**:
1. `lib/trading/account-information-and-performance.ts` - 3 calls (spot/futures limiters)
2. `lib/trading/current-market-state.ts` - 4 calls (spot/futures limiters)
3. `lib/trading/buy.ts` - 3 calls (order limiter for orders, spot/futures for prices)
4. `lib/trading/sell.ts` - 3 calls (order limiter for orders, spot/futures for prices)

### Step 4: Add Configuration (15 minutes)

**File**: `.env.example`

```bash
# Rate Limiting Configuration
# Binance API rate limits - adjust if using different exchange
SPOT_API_LIMIT=1200              # Requests per minute for spot API
FUTURES_API_LIMIT=2400           # Requests per minute for futures API
ORDER_API_LIMIT=300              # Orders per 10 seconds
MAX_CONCURRENT_SPOT=10           # Max concurrent spot requests
MAX_CONCURRENT_FUTURES=20        # Max concurrent futures requests
MAX_CONCURRENT_ORDERS=5          # Max concurrent order requests
```

**Update `lib/utils/rate-limiter.ts` to use env vars:**
```typescript
const SPOT_LIMIT = Number(process.env.SPOT_API_LIMIT) || 1200;
const FUTURES_LIMIT = Number(process.env.FUTURES_API_LIMIT) || 2400;
// ... etc
```

### Step 5: Write Tests (45 minutes)

**File**: `lib/utils/rate-limiter.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { spotLimiter, futuresLimiter, orderLimiter, withRateLimit } from './rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    // Reset limiters between tests
    spotLimiter.stop({ dropWaitingJobs: true });
    futuresLimiter.stop({ dropWaitingJobs: true });
    orderLimiter.stop({ dropWaitingJobs: true });
  });

  it('should enforce minimum time between requests', async () => {
    const start = Date.now();
    const results = await Promise.all([
      withRateLimit(spotLimiter, () => Promise.resolve(1)),
      withRateLimit(spotLimiter, () => Promise.resolve(2)),
      withRateLimit(spotLimiter, () => Promise.resolve(3)),
    ]);
    const elapsed = Date.now() - start;

    expect(results).toEqual([1, 2, 3]);
    // 3 requests with 50ms minTime = at least 100ms elapsed
    expect(elapsed).toBeGreaterThanOrEqual(100);
  });

  it('should queue requests when reservoir is exhausted', async () => {
    // Create limiter with small reservoir
    const testLimiter = new Bottleneck({
      reservoir: 2,
      reservoirRefreshAmount: 2,
      reservoirRefreshInterval: 1000,
    });

    const results: number[] = [];
    const promises = [1, 2, 3, 4].map((n) =>
      withRateLimit(testLimiter, async () => {
        results.push(n);
        return n;
      })
    );

    await Promise.all(promises);

    // All should complete, but last 2 should wait for refill
    expect(results).toEqual([1, 2, 3, 4]);
  });

  it('should limit concurrent requests', async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    const fn = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(resolve => setTimeout(resolve, 50));
      concurrent--;
      return true;
    };

    await Promise.all(
      Array(20).fill(0).map(() => withRateLimit(spotLimiter, fn))
    );

    // spotLimiter has maxConcurrent: 10
    expect(maxConcurrent).toBeLessThanOrEqual(10);
  });
});
```

**Run tests**: `bun test`

### Step 6: Add Monitoring & Logging (30 minutes)

**File**: `lib/utils/rate-limiter.ts` (add monitoring function)

```typescript
/**
 * Log rate limiter status for debugging
 */
export function logRateLimiterStatus() {
  console.log('[RATE-LIMIT] Status:', {
    spot: getRateLimiterStatus(spotLimiter),
    futures: getRateLimiterStatus(futuresLimiter),
    orders: getRateLimiterStatus(orderLimiter),
  });
}

// Export for use in cron jobs
setInterval(() => {
  if (process.env.NODE_ENV === 'development') {
    logRateLimiterStatus();
  }
}, 60000); // Log every minute in development
```

**Add to cron endpoints** (`app/api/cron/3-minutes-run-interval/route.ts`):
```typescript
import { logRateLimiterStatus } from '@/lib/utils/rate-limiter';

// At end of cron job
logRateLimiterStatus();
```

### Step 7: Integration Testing (30 minutes)

**Manual Test Checklist**:

1. **Test Rate Limiting in Dry-Run Mode**:
   ```bash
   bun run cron:trading
   # Should see "[RATE-LIMIT] Executing: ..." logs
   # Verify no 429 errors
   ```

2. **Test Burst Protection**:
   - Trigger multiple trading cycles rapidly
   - Verify requests are queued, not rejected
   - Check rate limiter status logs

3. **Test Concurrent Limits**:
   - Monitor concurrent request count
   - Should never exceed configured limits

4. **Test Reservoir Depletion**:
   - Run continuous trading for 5 minutes
   - Verify reservoir refills properly
   - Check for queuing behavior

---

## 📂 FILE STRUCTURE

```
lib/
├── utils/
│   ├── rate-limiter.ts         ← CREATE (rate limiter config)
│   └── rate-limiter.test.ts    ← CREATE (tests)
├── trading/
│   └── exchange-factory.ts     ← MODIFY (add limiter param to withRetry)
└── (update all files with CCXT calls to use limiters)
```

---

## ✅ SUCCESS CRITERIA

Your implementation is complete when:

1. **Zero Rate Limit Errors**:
   ```bash
   bun run cron:trading
   # No 429 errors in logs
   ```

2. **Rate Limiter Tests Pass**:
   ```bash
   bun test
   # All rate-limiter tests pass
   ```

3. **Graceful Degradation**:
   - Requests queue when approaching limits
   - No dropped requests
   - Reservoir refills correctly

4. **Monitoring Works**:
   - Rate limiter status visible in logs
   - Can see queued/running request counts
   - Reservoir levels tracked

5. **Performance Maintained**:
   - Trading cycles complete within expected time
   - No significant latency added for normal operations

---

## 🚨 COMMON PITFALLS TO AVOID

### ❌ DON'T Do These:

1. **Don't use same limiter for all APIs** - Spot, futures, and orders have different limits
2. **Don't set limits too high** - Leave safety margin (use 80% of actual limit)
3. **Don't ignore weight values** - Some endpoints count as multiple requests
4. **Don't disable rate limiting in production** - Always enforce limits
5. **Don't forget to test reservoir refill** - Ensure limits reset properly

### ✅ DO These:

1. **Use appropriate limiter for each API type** - Match limiter to endpoint
2. **Set conservative limits** - Better to be slow than banned
3. **Monitor reservoir levels** - Track when approaching limits
4. **Test with burst traffic** - Ensure queueing works
5. **Log rate limit events** - Essential for debugging

---

## 📊 EXPECTED TIMELINE

| Task | Time | Cumulative |
|------|------|------------|
| Create rate limiter utility | 30 min | 30 min |
| Integrate with exchange factory | 45 min | 1h 15m |
| Apply to all API calls | 1h | 2h 15m |
| Add configuration | 15 min | 2h 30m |
| Write tests | 45 min | 3h 15m |
| Add monitoring/logging | 30 min | 3h 45m |
| Integration testing | 30 min | 4h 15m |
| Documentation update | 20 min | 4h 35m |

**Total Estimated Time**: ~5 hours (half day with buffer)

---

## 📝 AFTER COMPLETION

### 1. Update Documentation

**Files to Update**:
- `docs/CURRENT_STATUS.md` - Mark Task 1.3 complete, update Phase 1 to 4/6 (67%)
- Create `docs/features/RATE_LIMITING.md` - Technical documentation
- Archive this session: `SESSION_2025-11-03_RATE_LIMITING.md`

### 2. Prepare Next Session Brief

**Next Task**: Task 1.4 - Expand Unit Tests
- Complete wallet, validator, and account tests
- Target 70%+ code coverage on critical paths

### 3. Test in Production-Like Conditions

Before live trading:
- Run dry-run mode for 24 hours continuously
- Monitor rate limiter logs for any issues
- Verify zero 429 errors
- Check reservoir behavior during peak usage

---

## 📚 REFERENCE DOCUMENTATION

### Must Read Before Starting:
1. `docs/CURRENT_STATUS.md` - Current state (lines 230-244 for Phase 1 status)
2. `docs/ROADMAP.md` - Task 1.3 details (lines 73-92)
3. `docs/features/ERROR_HANDLING.md` - How retry works (integrate with this)

### Reference During Implementation:
1. [Bottleneck Documentation](https://github.com/SGrondin/bottleneck) - Rate limiter API
2. [Binance API Rate Limits](https://binance-docs.github.io/apidocs/spot/en/#limits) - Official limits
3. `lib/utils/retry.ts` - Existing retry implementation
4. `lib/trading/exchange-factory.ts` - Current withRetry wrapper

---

## 🎯 FINAL CHECKLIST

Before ending the session, verify:

- [ ] `lib/utils/rate-limiter.ts` created with 3 limiters (spot, futures, orders)
- [ ] `lib/utils/rate-limiter.test.ts` created with 5+ test cases
- [ ] All CCXT calls in 4+ files use appropriate limiter
- [ ] Environment variables added to `.env.example`
- [ ] All tests passing (`bun test`)
- [ ] Integration test completed (real trading cycle works)
- [ ] Rate limiter status logging works
- [ ] Documentation updated (`docs/CURRENT_STATUS.md`)
- [ ] Session summary created (optional but recommended)

---

## 💡 TIPS FOR SUCCESS

1. **Start with the utility** - Get `rate-limiter.ts` working perfectly before integrating
2. **Test each limiter separately** - Verify spot, futures, and order limiters independently
3. **Use appropriate limiter for each call** - Check which API the endpoint uses
4. **Monitor logs closely** - Rate limiting should be visible in logs
5. **Test reservoir exhaustion** - Simulate high-volume scenarios
6. **Leave safety margin** - Use 80% of limits, not 100%
7. **Read Bottleneck docs** - Understand reservoir, minTime, maxConcurrent

---

## 🚀 LET'S GO!

You have everything you need:
- ✅ Clear objective and requirements
- ✅ Step-by-step implementation plan
- ✅ Code templates and examples
- ✅ Test cases and success criteria
- ✅ Timeline and file structure
- ✅ Common pitfalls documented
- ✅ Complete checklist
- ✅ `bottleneck` already installed!

**Expected Outcome**: By end of session, zero rate limit violations, Phase 1 progress at 67% (4/6 tasks), system ready for continuous operation.

**Start Command**:
```bash
cd /mnt/c/Users/PC/Dev/open-nof1.ai
mkdir -p lib/utils
touch lib/utils/rate-limiter.ts lib/utils/rate-limiter.test.ts
# Now implement rate-limiter.ts following Step 1 above
```

Good luck! 🎉
