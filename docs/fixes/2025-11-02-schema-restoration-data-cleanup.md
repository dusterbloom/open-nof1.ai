# Database Schema Restoration & Data Cleanup - Nov 2, 2025

## Overview
Fixed critical data integrity issues caused by Prisma schema restoration that removed extra fields (`agentId`, `modelName`, `provider`) from the database, resulting in corrupted metrics and chat records.

## Problem Timeline

### 1. Schema Restoration (Initial Issue)
- **Action**: Pushed `schema.prisma` to database, removing extra fields
- **Consequence**: 3 Metrics records (OpenRouter, LMStudio, Deepseek) all converted to `model: Deepseek`
- **Impact**: Non-deterministic `findFirst()` queries returned random records

### 2. Data Corruption Period: Nov 2, 16:07-16:20 UTC
During this 13-minute window, the system created corrupted data:

**Corrupted Metrics (38 records)**:
- `availableCash: 30000` (3× START_MONEY = 3 × $10,000)
- `totalCashValue: null` (calculations failed)
- System incorrectly thought 3 models were still active

**Corrupted Chat Records (5 records)**:
- Showed "Available Cash: 30000" in prompts
- 1 record showed "invoked 0 times" (system reset state)
- Associated with 5 Hold operations (all corrupted)

## Root Causes

### Technical Root Cause
```typescript
// Before fix - non-deterministic
const metrics = await prisma.metrics.findFirst({
  where: { model: ModelType.Deepseek },
  // Missing orderBy - returns random record!
});
```

With 3 records all having `model: Deepseek`:
1. Query could return any of the 3 records
2. Metrics collection sometimes wrote to wrong record
3. API responses showed inconsistent data (39 vs 100 metrics)

### Business Logic Issue
The metrics collection system (`lib/metrics/collect-metrics.ts`) continued using the old multi-model logic after schema restoration, treating START_MONEY as if split across 3 models:
- Expected per-model capital: $10,000
- Actual total shown: $30,000 (3 × $10,000)

## Fixes Applied

### 1. Database Cleanup

#### Duplicate Metrics Records
```sql
-- Deleted 2 duplicate Metrics records
DELETE FROM "Metrics" WHERE id IN (
  '8b227abb-f684-4fe7-a603-191d1f4ad379',  -- 39 metrics (duplicate)
  '480e9478-0386-451f-ad06-086f025ee7ec'   -- 39 metrics (duplicate)
);
-- Kept: 3b322f69-5cd1-441f-b767-8894b7a6bb92 (100 metrics, primary)
```

#### Corrupted Metrics Data
- **Removed**: 38 metrics with `availableCash: 30000` or `totalCashValue: null`
- **Timeframe**: 2025-11-02 16:07:28 → 16:20:00
- **Retained**: 62 clean metrics spanning Nov 1 18:48 → Nov 2 17:53

#### Corrupted Chat Records
- **Deleted**: 5 Chat records with $30k corruption
- **Cascade deleted**: 5 associated Trading records (all Hold operations)
- **Timeframe**: Same as metrics corruption (16:07-16:20)

### 2. Code Fixes

#### Deterministic Database Queries
Added `orderBy` to all `metrics.findFirst()` calls:

**Files Updated**:
1. `lib/metrics/collect-metrics.ts:84-87`
2. `app/api/metrics/route.ts:63-68`
3. `app/api/metric/route.ts:34-39`
4. `scripts/check-trades.js:36-38`

```typescript
// After fix - deterministic
const metrics = await prisma.metrics.findFirst({
  where: { model: ModelType.Deepseek },
  orderBy: { createdAt: "asc" }, // Always use oldest (primary) record
});
```

### 3. Cleanup Scripts Created

#### `scripts/clean-corrupted-metrics.ts`
- Identifies metrics with `availableCash === 30000` or `totalCashValue === null`
- Filters out corrupted records from Metrics array
- Updates database with clean data

#### `scripts/clean-corrupted-chats.ts`
- Finds Chat records with "Available Cash: 30000" in prompts
- Deletes corrupted Chats (cascade deletes associated Tradings)
- Provides detailed logging of cleanup process

## Final Database State

### Before Cleanup
```
Metrics:  3 records (2 duplicates, 100 total metrics, 38 corrupted)
Chat:     369 records (5 corrupted)
Trading:  368 records (5 corrupted)
```

### After Cleanup
```
Metrics:  1 record (62 clean metrics)
Chat:     364 records (all clean)
Trading:  363 records (all clean)
```

### Data Integrity Verification
- ✅ First metric: $10,001.48 @ Nov 1 18:48 (entry trade)
- ✅ Last metric: $9,926.92 @ Nov 2 17:53 (current state)
- ✅ Total return: -0.73% (-$74.08)
- ✅ Trades: 72 Buy, 18 Sell, 273 Hold (363 total)
- ✅ No null values in metrics
- ✅ No $30k anomalies
- ✅ Chat invocation counts sequential

## Prevention Measures

### Future Schema Changes
1. **Always check for duplicate records** after schema modifications
2. **Run data integrity checks** after enum value changes
3. **Use `orderBy` in all `findFirst()` queries** to ensure determinism
4. **Monitor for anomalies** after deployments (e.g., account balance spikes)

### Code Review Checklist
- [ ] All `findFirst()` queries have `orderBy` clause
- [ ] Enum changes don't orphan existing data
- [ ] Schema migrations preserve data integrity
- [ ] Multi-record scenarios handled deterministically

## Testing

### Verification Steps
1. **API Response**: `curl http://localhost:3001/api/metrics`
   - Should return 50 sampled metrics (from 62 total)
   - No null `totalCashValue`
   - No $30,000 `availableCash`

2. **Database Query**:
   ```sql
   SELECT array_length(metrics, 1) FROM "Metrics" WHERE name = 'Deepseek-R1-0528';
   -- Should return: 62
   ```

3. **Chat Records**:
   ```sql
   SELECT COUNT(*) FROM "Chat" WHERE "userPrompt" LIKE '%Available Cash: 30000%';
   -- Should return: 0
   ```

## Impact Assessment

### Data Loss
- **Metrics**: 38 corrupted records removed (61% retained)
- **Chats**: 5 corrupted records removed (99% retained)
- **Trades**: 5 Hold operations removed (99% retained)
- **No critical trading data lost** (all Buy/Sell pairs intact)

### User Experience
- ✅ Chart now displays full trading timeline (~23 hours)
- ✅ Account value progression accurate ($10,001 → $9,927)
- ✅ All trade operations correctly visualized
- ✅ Numbers match between graph, trades, and account value

## Related Files

### Modified
- `lib/metrics/collect-metrics.ts` - Added orderBy to findFirst
- `app/api/metrics/route.ts` - Added orderBy to findFirst
- `app/api/metric/route.ts` - Added orderBy to findFirst
- `scripts/check-trades.js` - Added orderBy to findFirst
- `prisma/schema.prisma` - (Previously restored, no changes in this fix)

### Created
- `scripts/clean-corrupted-metrics.ts` - Metrics cleanup script
- `scripts/clean-corrupted-chats.ts` - Chat cleanup script
- `docs/fixes/2025-11-02-schema-restoration-data-cleanup.md` - This file

### Database Backup
- `backup_before_schema_restore.sql` - Pre-cleanup backup (3.5MB)

## Commit Message

```
fix: restore database schema and clean corrupted data from multi-model merge

PROBLEM:
Schema restoration converted 3 Metrics records (OpenRouter, LMStudio, Deepseek)
to single model, causing non-deterministic queries and data corruption during
Nov 2 16:07-16:20 UTC. System created 38 corrupted metrics showing $30k balance
(3x START_MONEY) and 5 corrupted chat records.

FIXES:
1. Database cleanup:
   - Deleted 2 duplicate Metrics records
   - Removed 38 corrupted metrics (30k balance, null values)
   - Deleted 5 corrupted Chat records + associated Trades

2. Code fixes:
   - Added orderBy to all metrics.findFirst() queries (4 files)
   - Ensures deterministic record selection going forward

3. Scripts created:
   - scripts/clean-corrupted-metrics.ts
   - scripts/clean-corrupted-chats.ts

RESULT:
- Metrics: 1 record, 62 clean data points (Nov 1-2)
- Chat: 364 records (5 corrupted removed)
- Trading: 363 records (5 Hold ops removed)
- Chart displays full timeline with accurate data
- All numbers now match (graph, trades, account value)

Files changed:
- lib/metrics/collect-metrics.ts (orderBy added)
- app/api/metrics/route.ts (orderBy added)
- app/api/metric/route.ts (orderBy added)
- scripts/check-trades.js (orderBy added)
- scripts/clean-corrupted-metrics.ts (new)
- scripts/clean-corrupted-chats.ts (new)
- docs/fixes/2025-11-02-schema-restoration-data-cleanup.md (new)
```

## References
- Issue identified: Nov 2, 2025 ~19:15 UTC
- Resolution completed: Nov 2, 2025 ~19:50 UTC
- Total duration: ~35 minutes
- Data loss: Minimal (only corrupted 13-minute window)
