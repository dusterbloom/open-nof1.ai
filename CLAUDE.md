# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an open-source AI-powered cryptocurrency trading platform inspired by nof1.ai's Alpha Arena. It uses AI models (primarily DeepSeek) to make autonomous trading decisions on Binance perpetual contracts. The platform evaluates trading performance with real money in real markets, testing AI where static benchmarks cannot.

## Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router) with Turbopack
- **Runtime**: Bun (NOT npm/yarn)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Vercel AI SDK with DeepSeek R1 for trading decisions
- **Trading**: CCXT library for Binance exchange connectivity
- **Technical Analysis**: technicalindicators library for RSI, MACD, EMA, ATR calculations
- **Styling**: Tailwind CSS v4 with shadcn/ui components

## Common Commands

### Development
```bash
bun install              # Install dependencies
bun dev                  # Start development server (with Turbopack)
bun run build           # Build for production (with Turbopack)
bun start               # Start production server
bun run lint            # Run ESLint
```

### Database
```bash
bunx prisma generate    # Generate Prisma client
bunx prisma db push     # Push schema changes to database
bunx prisma studio      # Open Prisma Studio GUI
```

### Docker
```bash
docker-compose build --no-cache   # Rebuild containers without cache
docker-compose up                  # Start containers
docker-compose down                # Stop containers
docker-compose logs <service>      # View logs for specific service
```

## Architecture

### Core Trading Loop

The system operates on two automated intervals:

1. **Metrics Collection (20 seconds)**: `app/api/cron/20-seconds-metrics-interval/route.ts`
   - Collects account balance, positions, and PnL data
   - Stores metrics in the database for dashboard visualization

2. **Trading Execution (3 minutes)**: `app/api/cron/3-minutes-run-interval/route.ts`
   - Calls `lib/ai/run.ts` which orchestrates the trading decision process
   - Uses JWT token authentication via `CRON_SECRET_KEY`

### AI Trading Decision Flow

The trading logic follows this sequence (see `lib/ai/run.ts`):

1. **Gather Market Data**: `getCurrentMarketState()` fetches OHLCV data, calculates technical indicators (EMA, MACD, RSI, ATR) on both 1-minute and 4-hour timeframes
2. **Get Account Status**: `getAccountInformationAndPerformance()` retrieves current positions, balances, PnL from Binance
3. **Generate Prompt**: `generateUserPrompt()` combines market state + account data into a comprehensive prompt
4. **AI Decision**: Uses Vercel AI SDK's `generateObject()` with DeepSeek R1 model to output structured JSON with operation (Buy/Sell/Hold), reasoning, and parameters
5. **Persist Decision**: Stores the chat reasoning, user prompt, and trading action in the database

### Key Modules

**Trading (`lib/trading/`)**:
- `binance.ts`: CCXT client initialization with sandbox mode support
- `current-market-state.ts`: Fetches OHLCV candles and calculates all technical indicators using the `technicalindicators` library
- `account-information-and-performance.ts`: Retrieves positions, balances, calculates returns and Sharpe ratio
- `buy.ts` / `sell.ts`: Execute trades on Binance (currently not fully implemented in run.ts)

**AI (`lib/ai/`)**:
- `model.ts`: Configures DeepSeek models via both direct API and OpenRouter
- `prompt.ts`: Contains system prompt defining the AI's role as a crypto analyst and generates user prompts with market/account data
- `run.ts`: Main orchestration function that ties everything together
- `tool.ts`: Placeholder for AI tools (currently minimal - just exports Exa instance)

**Database (`prisma/schema.prisma`)**:
- `Metrics`: Time-series account performance data (JSON array format)
- `Chat`: Stores each AI invocation's reasoning, prompt, and decision
- `Trading`: Individual trade records linked to Chat entries
- Enums: `operation` (Buy/Sell/Hold), `Symbol` (BTC/ETH/BNB/SOL/DOGE), `ModelType` (Deepseek variants)

### Important Technical Details

- The AI currently only trades BTC/USDT perpetual futures (hardcoded in `run.ts:14` and position tracking)
- `START_MONEY` environment variable sets the initial capital for performance calculations
- Binance sandbox mode is controlled via `BINANCE_USE_SANDBOX` env var
- The system uses futures market (`defaultType: "future"` in binance.ts)
- Technical indicators are calculated on two timeframes: 1-minute (intraday, last 10 values) and 4-hour (longer-term context)
- Cron endpoints require JWT authentication with `CRON_SECRET_KEY`
- Dashboard reads from `/api/metrics` and `/api/model/chat` endpoints to display charts and trade history

### Frontend Structure

- `app/page.tsx`: Main dashboard with crypto prices, account chart, and trade history
- `components/metrics-chart.tsx`: Recharts-based visualization of account value over time
- `components/models-view.tsx`: Displays trade history and AI chat reasoning
- `components/crypto-card.tsx`: Real-time price display cards for supported coins

## Development Notes

- Always use `bun` instead of npm/yarn
- When modifying trading logic, test thoroughly with sandbox mode enabled
- The database schema uses `Json[]` for metrics - array of JSON objects for time-series data
- Type definitions for market state and account performance are in the respective trading module files
- The AI prompt emphasizes risk management and requires clear BUY/SELL/HOLD recommendations
- Recent fix: The prompt now uses `invocationCount` from database count instead of hardcoded values

## Environment Variables

Required variables (see `.env.example`):
- `NEXT_PUBLIC_URL`: Application URL
- `DATABASE_URL`: PostgreSQL connection string
- `DEEPSEEK_API_KEY`: DeepSeek direct API key
- `OPENROUTER_API_KEY`: OpenRouter API key for alternative model access
- `EXA_API_KEY`: Optional for enhanced market analysis
- `BINANCE_API_KEY` / `BINANCE_API_SECRET`: Binance credentials
- `BINANCE_USE_SANDBOX`: Set to "true" for testnet, "false" for live trading
- `START_MONEY`: Initial capital in USDT (e.g., 10000 = $10,000)
- `CRON_SECRET_KEY`: Secret token for cron endpoint authentication
