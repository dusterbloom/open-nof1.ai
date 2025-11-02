# Trades API Endpoint

**Last Updated**: 2025-11-02
**Endpoint**: `/api/trades`
**File**: `app/api/trades/route.ts`
**Version**: 1.0.0

## Overview

The Trades API endpoint provides read-only access to the complete historical record of all trading operations executed by the AI trading system. This endpoint returns all trades with their associated metadata, including position tracking information, execution details, and linked AI reasoning from Chat records.

## Table of Contents

- [Endpoint Details](#endpoint-details)
- [Request Format](#request-format)
- [Response Format](#response-format)
- [Position Linking System](#position-linking-system)
- [Data Models](#data-models)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Performance Considerations](#performance-considerations)

## Endpoint Details

### HTTP Method
`GET`

### Path
`/api/trades`

### Authentication
None (currently publicly accessible)

> **Note**: In production, consider adding authentication middleware to protect trading data.

### Rate Limiting
None (currently)

### Response Time
- Typical: 50-200ms for 1000 trades
- Large datasets (5000+ trades): 200-500ms

## Request Format

### HTTP Request

```http
GET /api/trades HTTP/1.1
Host: your-domain.com
Accept: application/json
```

### Query Parameters

Currently, this endpoint does not accept any query parameters. All trades are returned in a single response.

**Future Considerations**:
- Pagination: `?page=1&limit=100`
- Symbol filtering: `?symbol=BTC`
- Date range: `?from=2025-01-01&to=2025-02-01`
- Operation filtering: `?operation=Buy`

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-string",
      "symbol": "BTC",
      "operation": "Buy",
      "amount": 0.001,
      "pricing": 45000.50,
      "leverage": 5,
      "stopLoss": 44000.00,
      "takeProfit": 47000.00,
      "positionId": "position-uuid",
      "success": true,
      "errorMessage": null,
      "createdAt": "2025-11-02T10:30:00.000Z",
      "updatedAt": "2025-11-02T10:30:00.000Z",
      "chat": {
        "reasoning": "Market shows strong upward momentum with RSI indicating oversold conditions...",
        "chat": "Full AI conversation context..."
      }
    },
    {
      "id": "uuid-string-2",
      "symbol": "BTC",
      "operation": "Sell",
      "amount": 0.001,
      "pricing": 46500.75,
      "leverage": 5,
      "stopLoss": null,
      "takeProfit": null,
      "positionId": "position-uuid",
      "success": true,
      "errorMessage": null,
      "createdAt": "2025-11-02T12:45:00.000Z",
      "updatedAt": "2025-11-02T12:45:00.000Z",
      "chat": {
        "reasoning": "Taking profits as resistance level reached...",
        "chat": "Full AI conversation context..."
      }
    }
  ]
}
```

### Error Response (500 Internal Server Error)

```json
{
  "success": false,
  "error": "Failed to fetch trades data"
}
```

## Response Fields

### Trade Object

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | string | No | Unique trade identifier (UUID) |
| `symbol` | string | No | Cryptocurrency symbol: "BTC", "ETH", "BNB", "SOL", "DOGE" |
| `operation` | string | No | Trade operation: "Buy", "Sell", "Hold" |
| `amount` | number | Yes | Trade amount in base currency (e.g., 0.001 BTC) |
| `pricing` | number | Yes | Execution price in USDT |
| `leverage` | number | Yes | Leverage multiplier (e.g., 5 for 5x) |
| `stopLoss` | number | Yes | Stop loss price in USDT |
| `takeProfit` | number | Yes | Take profit price in USDT |
| `positionId` | string | Yes | Links Buy/Sell pairs (same ID = same position) |
| `success` | boolean | No | Whether trade executed successfully |
| `errorMessage` | string | Yes | Error description if success=false |
| `createdAt` | string | No | Trade execution timestamp (ISO 8601) |
| `updatedAt` | string | No | Last update timestamp (ISO 8601) |
| `chat` | object | Yes | Associated AI reasoning (optional) |
| `chat.reasoning` | string | Yes | AI's reasoning for the trade decision |
| `chat.chat` | string | Yes | Complete AI conversation context |

## Position Linking System

### Concept

The `positionId` field creates a relationship between Buy (entry) and Sell (exit) operations, allowing tracking of complete trading positions from entry to exit.

### Position Lifecycle

```
1. AI decides to open position
   → Trading record created with operation="Buy", positionId="pos-123"

2. Position remains open (tracked by exchange)
   → No additional Trading records

3. AI decides to close position
   → Trading record created with operation="Sell", positionId="pos-123"
```

### Position Matching Logic

To find complete positions (entry + exit pairs):

```typescript
// Group trades by positionId
const positions = new Map<string, { entry: Trade | null; exit: Trade | null }>();

trades.forEach(trade => {
  if (!trade.positionId) return;

  if (!positions.has(trade.positionId)) {
    positions.set(trade.positionId, { entry: null, exit: null });
  }

  const position = positions.get(trade.positionId)!;

  if (trade.operation === "Buy") {
    position.entry = trade;
  } else if (trade.operation === "Sell") {
    position.exit = trade;
  }
});

// Calculate position profitability
positions.forEach((position, positionId) => {
  if (position.entry && position.exit) {
    const profitLoss = (position.exit.pricing! - position.entry.pricing!) * position.entry.amount!;
    const returnPercent = ((position.exit.pricing! / position.entry.pricing!) - 1) * 100;
    console.log(`Position ${positionId}: ${returnPercent.toFixed(2)}% return`);
  }
});
```

### Edge Cases

**Open Positions** (entry without exit):
```typescript
const openPositions = Array.from(positions.values()).filter(
  p => p.entry && !p.exit
);
```

**Orphaned Exits** (exit without entry - should not happen):
```typescript
const orphanedExits = Array.from(positions.values()).filter(
  p => !p.entry && p.exit
);
```

**Hold Operations**:
- `operation="Hold"` indicates AI decided not to trade
- May or may not have `positionId`
- Does not affect position entry/exit pairing

## Data Models

### Prisma Schema

```prisma
model Trading {
  id String @id @default(uuid())

  symbol     Symbol
  operation  operation
  leverage   Int?
  amount     Float?
  pricing    Float?
  stopLoss   Float?
  takeProfit Float?

  // Position tracking for buy/sell pairing
  positionId String?

  // Trade execution status
  success      Boolean @default(true)
  errorMessage String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  Chat   Chat?   @relation(fields: [chatId], references: [id], onDelete: Cascade)
  chatId String?
}

enum operation {
  Buy
  Sell
  Hold
}

enum Symbol {
  BTC
  ETH
  BNB
  SOL
  DOGE
}
```

### TypeScript Interface

```typescript
interface Trade {
  id: string;
  symbol: "BTC" | "ETH" | "BNB" | "SOL" | "DOGE";
  operation: "Buy" | "Sell" | "Hold";
  amount: number | null;
  pricing: number | null;
  leverage: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  positionId: string | null;
  success: boolean;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  chat?: {
    reasoning: string;
    chat: string;
  };
}
```

## Usage Examples

### Fetch All Trades (Browser)

```typescript
async function fetchTrades() {
  try {
    const response = await fetch("/api/trades");
    const result = await response.json();

    if (result.success) {
      console.log(`Fetched ${result.data.length} trades`);
      return result.data;
    } else {
      console.error("Failed to fetch trades:", result.error);
      return [];
    }
  } catch (error) {
    console.error("Network error:", error);
    return [];
  }
}
```

### React Hook with SWR

```typescript
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export function useTrades() {
  const { data, error, isLoading } = useSWR("/api/trades", fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  return {
    trades: data?.success ? data.data : [],
    isLoading,
    isError: error || !data?.success,
  };
}
```

### Calculate Position Statistics

```typescript
async function getPositionStats() {
  const response = await fetch("/api/trades");
  const { data: trades } = await response.json();

  // Group by positionId
  const positions = new Map();
  trades.forEach(trade => {
    if (!trade.positionId) return;

    if (!positions.has(trade.positionId)) {
      positions.set(trade.positionId, { entry: null, exit: null });
    }

    const pos = positions.get(trade.positionId);
    if (trade.operation === "Buy") pos.entry = trade;
    if (trade.operation === "Sell") pos.exit = trade;
  });

  // Calculate stats
  let profitable = 0;
  let losing = 0;
  let totalReturn = 0;

  positions.forEach(({ entry, exit }) => {
    if (!entry || !exit || !entry.pricing || !exit.pricing) return;

    const returnPercent = ((exit.pricing / entry.pricing) - 1) * 100;
    totalReturn += returnPercent;

    if (exit.pricing > entry.pricing) {
      profitable++;
    } else {
      losing++;
    }
  });

  return {
    totalPositions: positions.size,
    completedPositions: profitable + losing,
    profitable,
    losing,
    winRate: profitable / (profitable + losing),
    avgReturn: totalReturn / (profitable + losing),
  };
}
```

### Filter by Symbol and Date Range

```typescript
async function getBTCTradesThisWeek() {
  const response = await fetch("/api/trades");
  const { data: trades } = await response.json();

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return trades.filter(trade => {
    const tradeDate = new Date(trade.createdAt);
    return trade.symbol === "BTC" && tradeDate >= weekAgo;
  });
}
```

### cURL Example

```bash
# Basic request
curl -X GET https://your-domain.com/api/trades

# Pretty-print JSON response
curl -X GET https://your-domain.com/api/trades | jq '.'

# Get only BTC trades
curl -X GET https://your-domain.com/api/trades | jq '.data[] | select(.symbol == "BTC")'

# Count profitable trades
curl -X GET https://your-domain.com/api/trades | jq '[.data[] | select(.operation == "Sell" and .success == true)] | length'
```

## Error Handling

### Common Error Scenarios

#### Database Connection Failure

```json
{
  "success": false,
  "error": "Failed to fetch trades data"
}
```

**HTTP Status**: 500
**Cause**: Database unavailable, connection timeout, or Prisma error
**Client Action**: Retry with exponential backoff

#### No Trades Available

```json
{
  "success": true,
  "data": []
}
```

**HTTP Status**: 200
**Cause**: No trades have been executed yet
**Client Action**: Handle empty state gracefully

### Client-Side Error Handling

```typescript
async function safeFetchTrades() {
  try {
    const response = await fetch("/api/trades");

    // Check HTTP status
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    // Check success flag
    if (!result.success) {
      throw new Error(result.error || "Unknown error");
    }

    return result.data;
  } catch (error) {
    if (error instanceof TypeError) {
      console.error("Network error - check connection");
    } else {
      console.error("Failed to fetch trades:", error);
    }
    return [];
  }
}
```

### Retry Logic

```typescript
async function fetchTradesWithRetry(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("/api/trades");
      const result = await response.json();

      if (result.success) {
        return result.data;
      }

      throw new Error(result.error);
    } catch (error) {
      console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve =>
        setTimeout(resolve, Math.pow(2, attempt - 1) * 1000)
      );
    }
  }
}
```

## Performance Considerations

### Response Size

**Current Implementation**: Returns all trades in single response

**Estimated Sizes**:
- 100 trades: ~50 KB
- 1,000 trades: ~500 KB
- 10,000 trades: ~5 MB

**Recommendations**:
- For datasets > 1000 trades, implement pagination
- Consider compression (gzip) for large responses
- Use streaming for very large datasets

### Database Query Optimization

**Current Query**:
```typescript
const trades = await prisma.trading.findMany({
  orderBy: {
    createdAt: "asc",
  },
  include: {
    Chat: {
      select: {
        reasoning: true,
        chat: true,
      },
    },
  },
});
```

**Optimization Opportunities**:

1. **Add Index on createdAt**:
```prisma
model Trading {
  // ...
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

2. **Pagination**:
```typescript
const trades = await prisma.trading.findMany({
  skip: (page - 1) * limit,
  take: limit,
  orderBy: { createdAt: "asc" },
});
```

3. **Conditional Chat Inclusion**:
```typescript
// Only include Chat if requested
include: includeChat ? {
  Chat: { select: { reasoning: true, chat: true } }
} : undefined
```

### Caching Strategy

```typescript
// In-memory cache with 60-second TTL
let cachedTrades: { data: any[]; timestamp: number } | null = null;
const CACHE_TTL = 60000; // 60 seconds

export const GET = async () => {
  const now = Date.now();

  // Return cached data if still valid
  if (cachedTrades && (now - cachedTrades.timestamp) < CACHE_TTL) {
    return NextResponse.json({
      data: cachedTrades.data,
      success: true,
      cached: true,
    });
  }

  // Fetch fresh data
  const trades = await prisma.trading.findMany({
    // ...
  });

  // Update cache
  cachedTrades = {
    data: formattedTrades,
    timestamp: now,
  };

  return NextResponse.json({
    data: formattedTrades,
    success: true,
    cached: false,
  });
};
```

## Implementation Details

### Database Include Pattern

The endpoint uses Prisma's `include` to join Chat records:

```typescript
const trades = await prisma.trading.findMany({
  include: {
    Chat: {
      select: {
        reasoning: true,
        chat: true,
      },
    },
  },
});
```

**Why Selective Select?**

The Chat model contains additional fields (id, createdAt, model, etc.) that aren't needed in the trades response. Using `select` reduces response payload size.

### Data Transformation

Raw Prisma data is transformed to match the expected API format:

```typescript
const formattedTrades = trades.map((trade) => ({
  id: trade.id,
  symbol: trade.symbol,
  operation: trade.operation,
  amount: trade.amount,
  pricing: trade.pricing,
  leverage: trade.leverage,
  stopLoss: trade.stopLoss,
  takeProfit: trade.takeProfit,
  positionId: trade.positionId,
  success: trade.success,
  errorMessage: trade.errorMessage,
  createdAt: trade.createdAt.toISOString(),  // Date → ISO string
  updatedAt: trade.updatedAt.toISOString(),  // Date → ISO string
  chat: trade.Chat
    ? {
        reasoning: trade.Chat.reasoning,
        chat: trade.Chat.chat,
      }
    : undefined,  // Omit chat if not present
}));
```

### Ordering

Trades are ordered by `createdAt` ascending (oldest first):

```typescript
orderBy: {
  createdAt: "asc",
}
```

This ensures chronological ordering for chart visualization and position matching logic.

## Security Considerations

### Current State
- No authentication required
- No rate limiting
- No field filtering

### Production Recommendations

1. **Add Authentication**:
```typescript
import { auth } from "@/lib/auth";

export const GET = async (request: Request) => {
  const session = await auth(request);
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  // ...
};
```

2. **Implement Rate Limiting**:
```typescript
import { ratelimit } from "@/lib/redis";

export const GET = async (request: Request) => {
  const ip = request.headers.get("x-forwarded-for") ?? "unknown";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { success: false, error: "Too many requests" },
      { status: 429 }
    );
  }
  // ...
};
```

3. **Sanitize Error Messages**:
```typescript
catch (error) {
  console.error("[TRADES] Error fetching trades:", error);
  return NextResponse.json(
    {
      error: "Failed to fetch trades data",  // Generic message
      success: false,
    },
    { status: 500 }
  );
}
```

## Related Documentation

- [Metrics Chart Component](../components/METRICS_CHART.md) - Primary consumer of this API
- [Prisma Schema](../../prisma/schema.prisma) - Database models
- [Trading System](../../lib/trading/README.md) - Trade execution logic
- [AI Run Logic](../../lib/ai/run.ts) - How trades are created

## Future Enhancements

### Planned Features

1. **Pagination**:
   - Query params: `?page=1&limit=100`
   - Response includes total count and page metadata

2. **Filtering**:
   - Symbol: `?symbol=BTC,ETH`
   - Operation: `?operation=Buy,Sell`
   - Date range: `?from=2025-01-01&to=2025-02-01`
   - Success status: `?success=true`

3. **Field Selection**:
   - Specify returned fields: `?fields=id,symbol,operation,createdAt`
   - Reduce payload size for simple queries

4. **Aggregations Endpoint**:
   - `/api/trades/stats`
   - Returns pre-calculated statistics (win rate, total PnL, etc.)

5. **WebSocket Support**:
   - Real-time trade notifications
   - Subscribe to new trades without polling

## Changelog

- **1.0.0** (2025-11-02): Initial release with full trade history support
