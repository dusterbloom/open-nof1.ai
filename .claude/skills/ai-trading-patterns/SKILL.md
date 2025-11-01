# AI Trading Patterns Skill

This skill provides comprehensive guidance for developing AI-driven cryptocurrency trading systems, including prompt engineering, model selection, and decision validation.

## When This Skill Activates

This skill automatically activates when you're working on AI trading logic, prompts, or model configurations.

## Core AI Trading Architecture

### System Flow

```
Market Data → AI Prompt → Model Decision → Validation → Execution → Database
```

1. **Gather Market Data**: Technical indicators (EMA, MACD, RSI, ATR), account balance, positions
2. **Generate Prompt**: Combine market state + account performance into AI-readable format
3. **AI Decision**: DeepSeek R1 analyzes and outputs structured JSON (Buy/Sell/Hold)
4. **Validate Output**: Check schema compliance, leverage limits, balance constraints
5. **Execute Trade**: Call CCXT exchange API
6. **Persist**: Store reasoning, prompt, trade in database

### Current Implementation Files

- `lib/ai/model.ts` - Model configurations (DeepSeek, OpenRouter)
- `lib/ai/prompt.ts` - System and user prompt generation
- `lib/ai/run.ts` - Main orchestration logic
- `lib/ai/tool.ts` - AI tools/functions (minimal currently)

## Model Selection

### DeepSeek R1 (Current - Recommended)

**Strengths:**
- Extended reasoning with chain-of-thought
- 671B parameters - excellent at complex analysis
- Affordable ($0.55/M input, $2.19/M output via OpenRouter)
- Good at technical indicator interpretation
- Strong at risk assessment

**Usage:**
```typescript
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const deepseekR1 = openrouter("deepseek/deepseek-r1-0528");
```

**Best For:**
- Trading decisions requiring multi-step reasoning
- Complex market analysis
- Risk-reward calculations

### DeepSeek V3.2 Chat (Alternative)

**Strengths:**
- Faster inference
- Lower cost ($0.27/M input, $1.10/M output)
- Still highly capable
- Good for simpler decisions

**Usage:**
```typescript
export const deepseekv31 = openrouter("deepseek/deepseek-v3.2-exp");
```

**Best For:**
- High-frequency decisions
- Simpler hold/monitor scenarios
- Cost optimization

### Model Configuration Pattern

```typescript
import { generateObject } from "ai";

const { object, reasoning } = await generateObject({
  model: deepseekR1,              // Model choice
  system: tradingPrompt,          // System instructions
  prompt: userPrompt,             // Market data + account state
  output: "object",               // Structured output
  mode: "json",                   // JSON mode
  schema: z.object({ ... }),      // Zod schema for validation
});
```

## Prompt Engineering for Trading

### System Prompt Structure

```typescript
export const tradingPrompt = `
You are an expert cryptocurrency analyst and trader with deep knowledge of
blockchain technology, market dynamics, and technical analysis.

Your role is to:
- Analyze cryptocurrency market data, including price movements, trading volumes,
  and market sentiment
- Evaluate technical indicators such as RSI, MACD, moving averages, and
  support/resistance levels
- Consider fundamental factors like project developments, adoption rates,
  regulatory news, and market trends
- Assess risk factors and market volatility specific to cryptocurrency markets
- Provide clear trading recommendations (BUY, SELL, or HOLD) with detailed reasoning
- Suggest entry and exit points, stop-loss levels, and position sizing when appropriate
- Stay objective and data-driven in your analysis

[... detailed instructions ...]

IMPORTANT: You MUST conclude your analysis with one of these three recommendations:
- **BUY**: When technical indicators are bullish, momentum is positive, and
  risk-reward ratio favors entering a long position
- **SELL**: When technical indicators are bearish, momentum is negative, or
  it's time to take profits/cut losses
- **HOLD**: When the market is consolidating, signals are mixed, or it's prudent
  to wait for clearer direction

Today is ${new Date().toDateString()}
`;
```

**Key Elements:**
1. **Role Definition**: Expert persona establishes context
2. **Responsibilities**: Clear list of what AI should do
3. **Required Actions**: Must provide specific recommendation
4. **Date Context**: Current date for time-aware decisions

### User Prompt Construction

**Template:**
```typescript
function generateUserPrompt(options: {
  currentMarketState: MarketState;
  accountInformationAndPerformance: AccountInformationAndPerformance;
  startTime: Date;
  invocationCount: number;
}) {
  return `
It has been ${minutesSinceStart} minutes since you started trading.
The current time is ${new Date().toISOString()} and you've been invoked
${invocationCount} times.

ALL OF THE PRICE OR SIGNAL DATA BELOW IS ORDERED: OLDEST → NEWEST

# HERE IS THE CURRENT MARKET STATE
## ALL BTC DATA FOR YOU TO ANALYZE
${formatMarketState(currentMarketState)}

## HERE IS YOUR ACCOUNT INFORMATION & PERFORMANCE
${formatAccountPerformance(accountInformationAndPerformance)}
`;
}
```

**Best Practices:**
1. **Temporal Context**: Include time elapsed, invocation count
2. **Data Ordering**: Explicitly state oldest→newest ordering
3. **Structured Sections**: Use headers for clarity
4. **Complete Data**: Include all indicators, not cherry-picked

### Market State Formatting

```typescript
export function formatMarketState(state: MarketState): string {
  return `
Current Market State:
current_price = ${state.current_price}, current_ema20 = ${state.current_ema20},
current_macd = ${state.current_macd}, current_rsi (7 period) = ${state.current_rsi}

Open Interest: Latest: ${state.open_interest.latest} Average: ${state.open_interest.average}
Funding Rate: ${state.funding_rate}

Intraday series (by minute, oldest → latest):
Mid prices: [${state.intraday.mid_prices.join(", ")}]
EMA indicators (20‑period): [${state.intraday.ema_20.join(", ")}]
MACD indicators: [${state.intraday.macd.join(", ")}]
RSI indicators (7‑Period): [${state.intraday.rsi_7.join(", ")}]
RSI indicators (14‑Period): [${state.intraday.rsi_14.join(", ")}]

Longer‑term context (4‑hour timeframe):
20‑Period EMA: ${state.longer_term.ema_20} vs. 50‑Period EMA: ${state.longer_term.ema_50}
3‑Period ATR: ${state.longer_term.atr_3} vs. 14‑Period ATR: ${state.longer_term.atr_14}
Current Volume: ${state.longer_term.current_volume} vs. Average Volume: ${state.longer_term.average_volume}
MACD indicators: [${state.longer_term.macd.join(", ")}]
RSI indicators (14‑Period): [${state.longer_term.rsi_14.join(", ")}]
`.trim();
}
```

**Formatting Principles:**
- Use consistent number formatting (toFixed for decimals)
- Arrays show progression over time
- Include both raw values and comparisons
- Multi-timeframe analysis (1m intraday + 4h longer-term)

## Output Schema Design

### Structured Decision Schema

```typescript
import { z } from "zod";
import { operation, Symbol } from "@prisma/client";

const tradingDecisionSchema = z.object({
  operation: z.nativeEnum(operation), // Buy, Sell, Hold

  buy: z.object({
    pricing: z.number().describe("The pricing of you want to buy in."),
    amount: z.number(),
    leverage: z.number().min(1).max(20),
  }).optional().describe("If operation is buy, generate object"),

  sell: z.object({
    percentage: z.number().min(0).max(100)
      .describe("Percentage of position to sell"),
  }).optional().describe("If operation is sell, generate object"),

  adjustProfit: z.object({
    stopLoss: z.number().optional()
      .describe("The stop loss of you want to set."),
    takeProfit: z.number().optional()
      .describe("The take profit of you want to set."),
  }).optional().describe("If operation is hold and you want to adjust profit"),

  chat: z.string().describe(
    "The reason why you do this operation, and tell me your analysis"
  ),
});
```

**Schema Design Principles:**
1. **Enum Constraints**: Use `nativeEnum` to enforce valid operations
2. **Conditional Fields**: Make buy/sell/adjustProfit optional based on operation
3. **Value Validation**: Min/max constraints (leverage 1-20, percentage 0-100)
4. **Descriptions**: Guide AI on what to generate
5. **Reasoning Field**: Require explanation (chat field)

### Validation After AI Response

```typescript
const { object, reasoning } = await generateObject({
  model: deepseekR1,
  system: tradingPrompt,
  prompt: userPrompt,
  schema: tradingDecisionSchema,
});

// Additional validation beyond schema
if (object.operation === operation.Buy) {
  const balance = await fetchBalance();
  const requiredMargin = (object.buy!.pricing * object.buy!.amount) / object.buy!.leverage;

  if (requiredMargin > balance.USDT.free) {
    throw new Error("Insufficient funds for this trade");
  }
}

if (object.operation === operation.Sell) {
  const positions = await fetchPositions();
  const currentPosition = positions.find(p => p.symbol === "BTC/USDT");

  if (!currentPosition || currentPosition.contracts === 0) {
    throw new Error("No position to sell");
  }
}
```

## Risk Management Patterns

### Position Sizing

```typescript
// Never risk more than X% of account per trade
const maxRiskPerTrade = 0.02; // 2%
const accountValue = balance.USDT.total;
const maxLoss = accountValue * maxRiskPerTrade;

// Calculate position size based on stop loss distance
const stopLossDistance = Math.abs(entryPrice - stopLossPrice);
const positionSize = maxLoss / stopLossDistance;
```

### Leverage Constraints

```typescript
// AI may suggest leverage, but cap it
const maxAllowedLeverage = 10;
const safeLeverage = Math.min(aiDecision.buy.leverage, maxAllowedLeverage);
```

### Stop Loss Enforcement

```typescript
// Never enter position without stop loss
if (aiDecision.operation === operation.Buy) {
  if (!aiDecision.buy.stopLoss && !aiDecision.adjustProfit?.stopLoss) {
    // Calculate automatic stop loss if AI didn't provide
    const autoStopLoss = aiDecision.buy.pricing * 0.95; // 5% below entry
    aiDecision.adjustProfit = { stopLoss: autoStopLoss };
  }
}
```

## Handling AI Reasoning (DeepSeek R1)

DeepSeek R1 provides extended reasoning in the `reasoning` field:

```typescript
const { object, reasoning } = await generateObject({ ... });

// Store both in database for transparency
await prisma.chat.create({
  data: {
    reasoning: reasoning || "<no reasoning>",  // Chain-of-thought
    chat: object.chat || "<no chat>",          // Final decision summary
    userPrompt: userPrompt,                    // What we asked
    tradings: { create: tradeRecord }
  }
});
```

**Uses for Reasoning:**
- Debugging AI decisions
- Understanding failure modes
- Improving prompts
- Transparency to users
- Audit trail

## Testing AI Decisions

### Unit Testing Prompts

```typescript
// Test prompt generation
const testMarketState = {
  current_price: 95000,
  current_ema20: 94500,
  current_macd: 100,
  current_rsi: 65,
  // ... full state
};

const prompt = generateUserPrompt({
  currentMarketState: testMarketState,
  accountInformationAndPerformance: testAccount,
  startTime: new Date(),
  invocationCount: 1,
});

expect(prompt).toContain("current_price = 95000");
expect(prompt).toContain("OLDEST → NEWEST");
```

### Integration Testing with Real Model

```typescript
// Test with small values
const testDecision = await generateObject({
  model: deepseekR1,
  system: tradingPrompt,
  prompt: userPrompt,
  schema: tradingDecisionSchema,
});

console.log("AI Decision:", testDecision.object);
console.log("AI Reasoning:", testDecision.reasoning);

// Verify schema compliance
expect(testDecision.object.operation).toBeOneOf(['Buy', 'Sell', 'Hold']);
if (testDecision.object.operation === 'Buy') {
  expect(testDecision.object.buy).toBeDefined();
  expect(testDecision.object.buy.leverage).toBeGreaterThanOrEqual(1);
  expect(testDecision.object.buy.leverage).toBeLessThanOrEqual(20);
}
```

## Common Pitfalls

### ❌ Don't Do This

```typescript
// 1. No validation after AI response
const decision = await generateObject({ ... });
await executeTradeImmediately(decision); // DANGEROUS

// 2. Cherry-picking data in prompts
const prompt = `Price is ${price}`; // Too little context

// 3. No error handling
const decision = await generateObject({ ... }); // What if API fails?

// 4. Ignoring AI reasoning
const { object } = await generateObject({ ... });
// reasoning ignored - missed debugging opportunity

// 5. Hardcoded invocation count
const prompt = `You've been invoked 5 times`; // Wrong on 6th run
```

### ✅ Do This

```typescript
// 1. Validate before execution
const decision = await generateObject({ ... });
await validateDecision(decision, balance, positions);
await executeTradeWithConfirmation(decision);

// 2. Provide complete context
const prompt = generateUserPrompt({
  currentMarketState,     // Full technical indicators
  accountPerformance,     // Complete account state
  startTime,              // Temporal context
  invocationCount,        // Dynamic counter
});

// 3. Robust error handling
try {
  const decision = await generateObject({ ... });
} catch (error) {
  if (error instanceof AIProviderError) {
    console.error("AI provider issue:", error);
    // Fallback: Hold position
  }
}

// 4. Store and analyze reasoning
const { object, reasoning } = await generateObject({ ... });
await prisma.chat.create({
  data: { reasoning, chat: object.chat, ... }
});

// 5. Dynamic invocation tracking
const invocationCount = await prisma.chat.count();
const prompt = `You've been invoked ${invocationCount} times`;
```

## Advanced Patterns

### Multi-Timeframe Analysis

Currently implements 1-minute (intraday) + 4-hour (longer-term):

```typescript
// 1-minute OHLCV (last 100 candles)
const ohlcv1m = await exchange.fetchOHLCV("BTC/USDT", "1m", undefined, 100);

// 4-hour OHLCV (last 100 candles)
const ohlcv4h = await exchange.fetchOHLCV("BTC/USDT", "4h", undefined, 100);

// Calculate indicators on both timeframes
const ema20_1m = calculateEMA(closes1m, 20);
const ema20_4h = calculateEMA(closes4h, 20);

// Include both in prompt for AI
const prompt = `
Intraday (1-minute): ${formatIntraday(indicators1m)}
Longer-term (4-hour): ${formatLongerTerm(indicators4h)}
`;
```

**Why Multi-Timeframe:**
- 1-minute: Capture recent momentum, entry/exit timing
- 4-hour: Identify trends, avoid false signals
- AI gets both micro and macro view

### Incorporating External Data

```typescript
// Add news sentiment (optional - requires EXA_API_KEY)
import Exa from "exa-js";

const exa = new Exa(process.env.EXA_API_KEY);
const newsResults = await exa.searchAndContents(
  "Bitcoin BTC cryptocurrency news",
  { numResults: 5, type: "keyword" }
);

const newsContext = newsResults.results
  .map(r => `${r.title}: ${r.text.slice(0, 200)}`)
  .join("\n");

const enhancedPrompt = `
${basePrompt}

## RECENT NEWS SENTIMENT
${newsContext}
`;
```

## Performance Optimization

### Prompt Caching (Future)

Some AI providers support prompt caching to reduce costs:

```typescript
// Cache expensive system prompt
const { object } = await generateObject({
  model: deepseekR1,
  system: tradingPrompt,  // Cached (rarely changes)
  prompt: userPrompt,     // Dynamic (changes each invocation)
  schema: tradingDecisionSchema,
});
```

### Streaming Responses (Not Used Currently)

For real-time UI updates:

```typescript
const stream = await streamObject({
  model: deepseekR1,
  system: tradingPrompt,
  prompt: userPrompt,
  schema: tradingDecisionSchema,
});

for await (const chunk of stream) {
  console.log("Partial decision:", chunk);
  // Update UI in real-time
}
```

## Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [DeepSeek API Docs](https://www.deepseek.com/docs)
- [OpenRouter Provider Docs](https://openrouter.ai/docs)
- [Zod Schema Validation](https://zod.dev/)
- Current project files:
  - `lib/ai/model.ts` - Model configurations
  - `lib/ai/prompt.ts` - Prompt generation
  - `lib/ai/run.ts` - Main AI orchestration
  - `lib/ai/tool.ts` - AI tools/functions
