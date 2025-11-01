# Exchange Integration Patterns Skill

This skill provides comprehensive guidance for integrating cryptocurrency exchanges (both centralized and decentralized) into the trading platform.

## When This Skill Activates

This skill automatically activates when you're working on exchange integration code or discussing exchange-related topics.

## Core Integration Patterns

### CCXT Library Integration

**For Centralized Exchanges (CEX) - Current: Binance**

```typescript
import ccxt from "ccxt";

export const binance = new ccxt.binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_API_SECRET,
  options: {
    defaultType: "future", // For perpetual futures
  },
});

binance.setSandboxMode(process.env.BINANCE_USE_SANDBOX === "true");
```

**For Decentralized Exchanges (DEX) - Future: Hyperliquid**

```typescript
import ccxt from "ccxt";

export const hyperliquid = new ccxt.hyperliquid({
  privateKey: process.env.WALLET_PRIVATE_KEY,
  walletAddress: process.env.WALLET_ADDRESS,
  options: {
    defaultType: "swap", // For perpetuals
  },
});

// Note: No sandbox mode for DEX - use testnet via different network config
```

### Authentication Patterns

**CEX Authentication (API Keys):**
- Uses API key + secret
- Keys are revocable
- Centralized permission management
- Account recovery possible

**DEX Authentication (Wallet Signing):**
- Uses private key or mnemonic
- Every trade requires transaction signature
- Non-custodial (you control keys)
- Lost keys = lost funds (NO RECOVERY)

**Security Best Practices:**
1. Never hardcode keys in source code
2. Use environment variables (.env)
3. Add private keys to .gitignore
4. For production: Consider hardware wallets or secure key management services
5. Use read-only API keys when possible for data fetching

### Market Data Fetching

**OHLCV Data (Candlestick Data):**

```typescript
// Works for both CEX and DEX via CCXT
const ohlcv = await exchange.fetchOHLCV(
  "BTC/USDT",    // symbol
  "1m",          // timeframe: 1m, 5m, 15m, 1h, 4h, 1d
  undefined,     // since (timestamp)
  100            // limit (number of candles)
);

// Returns: [[timestamp, open, high, low, close, volume], ...]
const closes = ohlcv.map(candle => Number(candle[4]));
```

**Current Price:**

```typescript
const ticker = await exchange.fetchTicker("BTC/USDT");
const currentPrice = ticker.last;
```

**Order Book:**

```typescript
const orderbook = await exchange.fetchOrderBook("BTC/USDT", 20);
const bestBid = orderbook.bids[0][0];
const bestAsk = orderbook.asks[0][0];
```

### Position Management

**Fetch Current Positions (Futures):**

```typescript
const positions = await exchange.fetchPositions(["BTC/USDT"]);

positions.forEach(position => {
  console.log({
    symbol: position.symbol,
    side: position.side,              // 'long' or 'short'
    contracts: position.contracts,    // Position size
    entryPrice: position.entryPrice,
    markPrice: position.markPrice,
    liquidationPrice: position.liquidationPrice,
    unrealizedPnl: position.unrealizedPnl,
    leverage: position.leverage,
    marginType: position.marginType,  // 'cross' or 'isolated'
  });
});
```

**Account Balance:**

```typescript
const balance = await exchange.fetchBalance({ type: "future" });
const usdtBalance = balance.USDT;

console.log({
  total: usdtBalance.total,    // Total balance
  free: usdtBalance.free,      // Available for trading
  used: usdtBalance.used,      // In open positions
});
```

### Order Placement

**Market Order (Immediate Execution):**

```typescript
// Buy (Long)
const buyOrder = await exchange.createMarketOrder(
  "BTC/USDT",
  "buy",
  0.001,  // amount in BTC
  undefined,
  { leverage: 10 }
);

// Sell (Short)
const sellOrder = await exchange.createMarketOrder(
  "BTC/USDT",
  "sell",
  0.001,
  undefined,
  { leverage: 10 }
);
```

**Limit Order (Specific Price):**

```typescript
const limitOrder = await exchange.createLimitOrder(
  "BTC/USDT",
  "buy",
  0.001,      // amount
  95000,      // price
  undefined,
  { leverage: 10 }
);
```

**Stop Loss / Take Profit:**

```typescript
// Set stop loss
const stopLoss = await exchange.createOrder(
  "BTC/USDT",
  "STOP_MARKET",
  "sell",
  0.001,
  undefined,
  {
    stopPrice: 94000,  // Trigger price
    reduceOnly: true   // Only close position, don't open new
  }
);

// Set take profit
const takeProfit = await exchange.createOrder(
  "BTC/USDT",
  "TAKE_PROFIT_MARKET",
  "sell",
  0.001,
  undefined,
  {
    stopPrice: 98000,
    reduceOnly: true
  }
);
```

### Closing Positions

**Close Entire Position:**

```typescript
// For long position - sell to close
const closeOrder = await exchange.createMarketOrder(
  "BTC/USDT",
  "sell",
  position.contracts,
  undefined,
  { reduceOnly: true }
);
```

**Partial Close (Percentage):**

```typescript
const percentage = 50; // Close 50%
const amountToClose = (position.contracts * percentage) / 100;

const partialClose = await exchange.createMarketOrder(
  "BTC/USDT",
  "sell",
  amountToClose,
  undefined,
  { reduceOnly: true }
);
```

### Perpetual Futures Specific

**Funding Rate:**

```typescript
const fundingRate = await exchange.fetchFundingRate("BTC/USDT");
console.log({
  rate: fundingRate.fundingRate,
  timestamp: fundingRate.fundingTimestamp,
  nextFunding: fundingRate.fundingDatetime,
});
```

**Open Interest:**

```typescript
const symbol = "BTCUSDT"; // Without slash for some exchanges
const openInterest = await exchange.fetchOpenInterest(symbol);
console.log({
  openInterestAmount: openInterest.openInterestAmount,
  openInterestValue: openInterest.openInterestValue,
});
```

**Leverage Management:**

```typescript
// Set leverage for symbol
await exchange.setLeverage(10, "BTC/USDT");

// Set margin mode
await exchange.setMarginMode("cross", "BTC/USDT");
// or
await exchange.setMarginMode("isolated", "BTC/USDT");
```

## Exchange-Specific Differences

### Binance (CEX)
- Symbol format: `BTC/USDT`
- Instant execution
- Sandbox mode available
- Rate limits: Respect weight limits
- Open interest symbol: `BTCUSDT` (no slash)

### Hyperliquid (DEX)
- Symbol format: `BTC-PERP` or `BTC/USDT`
- On-chain confirmation delays (1-3 seconds)
- No sandbox - use testnet
- Wallet signing required
- Gas fees may apply
- CCXT support: Recent addition (verify compatibility)

### MEXC (CEX - Alternative)
- Symbol format: `BTC/USDT`
- Similar to Binance
- API key authentication
- 10 BTC/day withdrawal without KYC
- Check sandbox availability

## Error Handling

**Common Patterns:**

```typescript
try {
  const order = await exchange.createMarketOrder(...);
} catch (error) {
  if (error instanceof ccxt.InsufficientFunds) {
    console.error("Not enough balance");
  } else if (error instanceof ccxt.InvalidOrder) {
    console.error("Invalid order parameters");
  } else if (error instanceof ccxt.NetworkError) {
    console.error("Network issue - retry");
  } else if (error instanceof ccxt.ExchangeError) {
    console.error("Exchange rejected:", error.message);
  }
}
```

**Retry Logic for Network Errors:**

```typescript
async function fetchWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ccxt.NetworkError && i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
}

// Usage
const ohlcv = await fetchWithRetry(() =>
  exchange.fetchOHLCV("BTC/USDT", "1m", undefined, 100)
);
```

## Migration Checklist: Binance → Hyperliquid

When migrating from Binance to Hyperliquid via CCXT:

### 1. Environment Variables
- [ ] Add `WALLET_PRIVATE_KEY` or `MNEMONIC_PHRASE`
- [ ] Add `WALLET_ADDRESS`
- [ ] Keep sandbox mode handling (use testnet instead)

### 2. Exchange Initialization
- [ ] Update `lib/trading/binance.ts` → `lib/trading/hyperliquid.ts`
- [ ] Change authentication from API keys to private key
- [ ] Update `defaultType` if needed

### 3. Symbol Format
- [ ] Test if `BTC/USDT` or `BTC-PERP` format is required
- [ ] Update all symbol references consistently

### 4. API Method Compatibility
- [ ] Test `fetchOHLCV` - verify timeframe support
- [ ] Test `fetchPositions` - verify response structure
- [ ] Test `fetchBalance` - verify USDT vs USD naming
- [ ] Test `fetchFundingRate` - may not be available
- [ ] Test `fetchOpenInterest` - may not be available

### 5. Order Placement
- [ ] Test `createMarketOrder` with leverage parameter
- [ ] Test `createLimitOrder`
- [ ] Verify stop loss / take profit support
- [ ] Test `reduceOnly` flag

### 6. Timing Adjustments
- [ ] Add delays for on-chain confirmation
- [ ] Update cron intervals if needed (3min → 5min?)
- [ ] Implement transaction status polling

### 7. Security
- [ ] Never commit private keys
- [ ] Use encrypted storage for production
- [ ] Add `.env` to `.gitignore`
- [ ] Document key backup procedures

### 8. Testing
- [ ] Test on testnet first
- [ ] Verify all technical indicators still calculate
- [ ] Test with small amounts
- [ ] Monitor for failed transactions

## Best Practices

### For AI Trading Bots

1. **Always check available balance before placing orders**
   ```typescript
   const balance = await exchange.fetchBalance({ type: "future" });
   if (balance.USDT.free < requiredAmount) {
     throw new Error("Insufficient funds");
   }
   ```

2. **Validate AI output before execution**
   ```typescript
   if (aiDecision.leverage > 20 || aiDecision.leverage < 1) {
     throw new Error("Invalid leverage");
   }
   ```

3. **Implement position size limits**
   ```typescript
   const maxPositionSize = balance.USDT.total * 0.1; // Max 10% per trade
   const orderSize = Math.min(aiDecision.amount, maxPositionSize);
   ```

4. **Always use stop losses**
   ```typescript
   // Never enter position without stop loss
   const position = await createMarketOrder(...);
   await setStopLoss(position, stopLossPrice);
   ```

5. **Log all decisions for debugging**
   ```typescript
   await prisma.chat.create({
     data: {
       reasoning: aiReasoning,
       chat: aiChat,
       userPrompt: marketData,
       tradings: { create: tradeRecord }
     }
   });
   ```

## Resources

- [CCXT Documentation](https://docs.ccxt.com/)
- [Hyperliquid CCXT Integration](https://github.com/ccxt/ccxt/blob/master/js/hyperliquid.js)
- [Binance Futures API Docs](https://binance-docs.github.io/apidocs/futures/en/)
- Current project files:
  - `lib/trading/binance.ts` - Exchange client
  - `lib/trading/current-market-state.ts` - Market data fetching
  - `lib/trading/account-information-and-performance.ts` - Account queries
  - `lib/trading/buy.ts` - Buy execution (to be implemented)
  - `lib/trading/sell.ts` - Sell execution (to be implemented)
