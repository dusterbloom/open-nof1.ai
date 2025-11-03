# Open Nof1.ai - Development Roadmap

**Version**: 1.0
**Last Updated**: 2025-11-03
**Estimated Timeline**: 10 weeks to production-ready

---

## 🎯 Project Goals

Transform the AI-powered trading platform from a prototype to a production-ready system with:
- ✅ Safety features preventing catastrophic losses
- ✅ Comprehensive monitoring and alerting
- ✅ Backtesting capabilities for strategy validation
- ✅ Advanced risk management

---

## 📊 Progress Overview

- **Total Phases**: 4
- **Total Tasks**: 22
- **Completed**: 1 task (4.5%)
- **In Progress**: Phase 1 (Critical Safety)
- **Current Week**: Week 1
- **Est. Completion**: Week 10 (late January 2026)

---

## 🔴 PHASE 1: Critical Safety (Week 1-2)

**Goal**: Make the system safe for live trading with real money

**Priority**: CRITICAL - Cannot trade with real money until complete

### Tasks

#### ✅ 1.1 Liquidation Protection (COMPLETED)
- **Status**: ✅ DONE (2025-11-03)
- **Estimated**: 2 days
- **Actual**: 1 session
- **Priority**: CRITICAL
- **Files Modified**:
  - `lib/trading/dry-run-wallet.ts`
  - `lib/trading/account-information-and-performance.ts`
  - `lib/ai/run.ts`
  - `lib/ai/prompt.ts`
- **Deliverables**:
  - ✅ Liquidation price calculation for all positions
  - ✅ Auto-close when within 10% of liquidation
  - ✅ AI awareness of liquidation risk
  - ✅ Test suite (`bun run test:liquidation`)
- **Impact**: Prevents catastrophic liquidation losses

#### 🔲 1.2 Error Handling & Retries
- **Status**: TODO - **NEXT PRIORITY**
- **Estimated**: 2 days
- **Priority**: HIGH
- **Description**: Add retry logic with exponential backoff for all API calls
- **Approach**:
  1. Install `bottleneck` library for rate limiting
  2. Create `lib/utils/retry.ts` with generic retry wrapper
  3. Wrap all CCXT calls in `lib/trading/exchange-factory.ts`
  4. Wrap DeepSeek calls in `lib/ai/run.ts`
  5. Add retry configuration to environment variables
- **Success Criteria**:
  - Max 3 retries with exponential backoff (100ms, 200ms, 400ms)
  - Log each retry attempt
  - Fail gracefully after max retries
  - 80% reduction in transient API failures
- **Impact**: Reduces failed trades from API timeouts by ~80%

#### 🔲 1.3 Rate Limiting
- **Status**: TODO
- **Estimated**: 1 day
- **Priority**: HIGH
- **Dependencies**: 1.2 (Error Handling)
- **Description**: Respect Binance API rate limits to prevent bans
- **Limits**:
  - Spot API: 1200 requests/minute
  - Futures API: 2400 requests/minute
  - Order limits: 300 orders/10 seconds
- **Approach**:
  - Use `bottleneck` library already installed for 1.2
  - Configure per-endpoint rate limits
  - Add rate limit headers monitoring
  - Implement backoff on 429 errors
- **Success Criteria**:
  - Zero rate limit violations (429 errors)
  - Graceful degradation when approaching limits
- **Impact**: Prevents exchange API bans

#### 🔲 1.4 Basic Unit Tests
- **Status**: TODO
- **Estimated**: 3 days (ongoing)
- **Priority**: HIGH
- **Description**: Setup testing infrastructure and write core tests
- **Setup**:
  ```bash
  bun add -d vitest @vitest/ui
  ```
- **Test Files to Create**:
  1. `lib/trading/dry-run-wallet.test.ts`
     - Test open/close positions
     - Test PnL calculations
     - Test liquidation calculations
  2. `lib/trading/validator.test.ts`
     - Test buy order validation
     - Test sell order validation
     - Test SL/TP validation
  3. `lib/trading/account-information-and-performance.test.ts`
     - Test account value calculation
     - Test position formatting
- **Success Criteria**:
  - 70%+ code coverage on critical paths
  - All tests passing in CI/CD
  - Test command: `bun test`
- **Impact**: Enables confident refactoring, prevents regressions

#### 🔲 1.5 Fix Dry-Run Partial Sells
- **Status**: TODO
- **Estimated**: 1 day
- **Priority**: MEDIUM
- **Description**: Enable partial position closure in dry-run mode
- **Current Issue**: `sell.ts:43-48` doesn't support partial sells in dry-run
- **Approach**:
  - Modify `DryRunWallet.closePosition()` to accept percentage
  - Update position size instead of removing entirely
  - Adjust margin and PnL calculations
- **Success Criteria**:
  - Can sell 50% of a position in dry-run mode
  - Remaining position tracked correctly
- **Impact**: More realistic dry-run testing

#### 🔲 1.6 Structured Logging (Pino)
- **Status**: TODO
- **Estimated**: 1 day
- **Priority**: MEDIUM
- **Description**: Replace console.log with proper structured logging
- **Setup**:
  ```bash
  bun add pino pino-pretty
  ```
- **Approach**:
  - Create `lib/utils/logger.ts` with Pino instance
  - Replace all `console.log` calls
  - Add log levels: debug, info, warn, error
  - Configure JSON logs for production, pretty logs for dev
- **Log Categories**:
  - Trading actions (buy/sell/hold)
  - AI decisions and reasoning
  - API calls and responses
  - Errors and exceptions
  - Liquidation protection triggers
- **Success Criteria**:
  - All console.log replaced
  - Structured JSON output in production
  - Log rotation configured
- **Impact**: Better debugging, monitoring, and auditing

---

## 🟡 PHASE 2: Analytics & Monitoring (Week 3-4)

**Goal**: Understand performance and catch problems early

**Priority**: HIGH - Critical for evaluating AI performance

### Tasks

#### 🔲 2.1 Performance Metrics Dashboard
- **Status**: TODO
- **Estimated**: 3 days
- **Priority**: HIGH
- **Description**: Calculate and display comprehensive trading metrics
- **Metrics to Add**:
  - Win rate (winning trades / total trades)
  - Average win / average loss ratio
  - Maximum drawdown (peak to trough)
  - Sortino ratio (downside deviation)
  - Profit factor (total wins / total losses)
  - Trade duration analysis
  - **Fix**: Sharpe ratio calculation (currently incorrect)
- **Approach**:
  1. Create `lib/analytics/calculate-metrics.ts`
  2. Add `PerformanceMetrics` table to schema
  3. Calculate metrics after each trade
  4. Create `/app/analytics/page.tsx` dashboard
  5. Visualize metrics with Recharts
- **Success Criteria**:
  - All metrics calculated correctly
  - Dashboard updates in real-time
  - Historical metrics stored in DB
- **Impact**: Enables data-driven strategy improvements

#### 🔲 2.2 Alert System (Discord)
- **Status**: TODO
- **Estimated**: 2 days
- **Priority**: HIGH
- **Description**: Real-time notifications for critical events
- **Setup**:
  ```bash
  bun add discord-webhook
  ```
- **Alert Types**:
  - ✅ Trade executed (buy/sell with price and size)
  - ⚠️ Large loss (> -3% on a position)
  - 🚨 Liquidation protection triggered
  - ❌ API errors / failures
  - 🔧 Cron job failures
  - 💰 Daily P&L summary
- **Approach**:
  - Create `lib/notifications/discord.ts`
  - Add `DISCORD_WEBHOOK_URL` to env vars
  - Integrate in `lib/ai/run.ts`
  - Add preference: `ALERT_THRESHOLD` (default: -3%)
- **Success Criteria**:
  - Alerts sent within 5 seconds of event
  - Rich embed formatting
  - Configurable alert preferences
- **Impact**: Enables quick intervention on losses

#### 🔲 2.3 Health Check Endpoint
- **Status**: TODO
- **Estimated**: 1 day
- **Priority**: MEDIUM
- **Description**: API endpoint for monitoring system health
- **File**: `app/api/health/route.ts`
- **Response Format**:
  ```json
  {
    "status": "healthy",
    "uptime": 86400,
    "lastTrade": "2025-11-03T12:00:00Z",
    "errorCount24h": 2,
    "database": "connected",
    "binance": "connected",
    "deepseek": "connected",
    "positions": 3,
    "totalValue": 10542.15
  }
  ```
- **Success Criteria**:
  - Returns 200 for healthy, 503 for unhealthy
  - Checks DB, exchange, AI API connectivity
  - Can be used by uptime monitors (UptimeRobot, etc.)
- **Impact**: Enables external monitoring

#### 🔲 2.4 Better AI Prompt (Dynamic Targets)
- **Status**: TODO
- **Estimated**: 2 days
- **Priority**: HIGH
- **Description**: Make profit targets adaptive based on market conditions
- **Current Issue**: Fixed 10%/15% profit targets regardless of volatility
- **Approach**:
  - Calculate ATR (Average True Range) for each symbol
  - Set profit target = 2x ATR (dynamic based on volatility)
  - Set stop loss = 1x ATR
  - Add trend detection (trending vs ranging)
  - Allow holding winners longer in strong trends
- **File**: `lib/ai/prompt.ts`
- **Success Criteria**:
  - Profit targets adjust to volatility
  - AI considers trend strength
  - Better win rate on volatile markets
- **Impact**: Could improve profitability by 20-30%

#### 🔲 2.5 Trading Journal
- **Status**: TODO
- **Estimated**: 2 days
- **Priority**: LOW
- **Description**: Enhanced trade record keeping
- **Features**:
  - AI reasoning for each trade
  - Trade tags (breakout, pullback, momentum, etc.)
  - Manual notes capability
  - Entry/exit quality scoring
- **Approach**:
  - Update schema to add `tags` and `notes` fields
  - Create `/app/journal/page.tsx`
  - Add tagging UI to trade detail modal
- **Success Criteria**:
  - All trades have reasoning attached
  - Can filter by tag
  - Can add manual notes
- **Impact**: Better understanding of AI decision patterns

---

## 🟢 PHASE 3: Backtesting & Strategy Optimization (Week 5-7)

**Goal**: Test strategies before deploying to live trading

**Priority**: MEDIUM - Valuable but not critical for initial deployment

### Tasks

#### 🔲 3.1 Historical Data Loader
- **Status**: TODO
- **Estimated**: 3 days
- **Priority**: MEDIUM
- **Description**: Download and store historical OHLCV data
- **Data Requirements**:
  - 1 year of 1-minute candles for all symbols
  - ~525,600 candles per symbol
  - ~2.6 million total candles
- **Approach**:
  - Create `lib/backtest/data-loader.ts`
  - Use CCXT `fetchOHLCV()` with pagination
  - Store in new `HistoricalData` table (or cache files)
  - Update weekly via cron
- **Success Criteria**:
  - All symbols have 1 year of data
  - Data validated for gaps
  - Efficient storage (~100MB total)
- **Impact**: Enables backtesting

#### 🔲 3.2 Backtest Engine
- **Status**: TODO
- **Estimated**: 5 days
- **Priority**: MEDIUM
- **Description**: Replay historical data through AI trading logic
- **Approach**:
  - Create `lib/backtest/engine.ts`
  - Feed historical candles to AI in sequence
  - Simulate trades with realistic fees/slippage
  - Track performance metrics
  - Generate HTML report
- **Features**:
  - Fast mode (skip AI, use cached decisions)
  - Detailed mode (full AI reasoning)
  - Parameter sweeping (test different settings)
- **Success Criteria**:
  - Can backtest 1 month in < 5 minutes
  - Accurate P&L simulation
  - Generates equity curve
- **Impact**: Validates strategies before live deployment

#### 🔲 3.3 Backtest UI
- **Status**: TODO
- **Estimated**: 3 days
- **Priority**: MEDIUM
- **Description**: Web interface for running and comparing backtests
- **File**: `app/backtest/page.tsx`
- **Features**:
  - Date range selection
  - Strategy parameter inputs
  - Run backtest button
  - Results comparison table
  - Equity curve visualization
  - Trade-by-trade breakdown
- **Success Criteria**:
  - Can run multiple backtests and compare
  - Visual equity curve
  - Export results to CSV
- **Impact**: Easier strategy optimization

#### 🔲 3.4 Strategy Parameters
- **Status**: TODO
- **Estimated**: 2 days
- **Priority**: MEDIUM
- **Description**: Extract hardcoded values to configuration
- **Current Hardcoded Values**:
  - Profit targets: 10%, 15%
  - Loss limits: -3%, -5%
  - Leverage limits: 1x-20x
  - Position size: $1000
  - Max positions: 5
- **Approach**:
  - Create `lib/config/strategy.ts`
  - Move values to config object
  - Allow A/B testing different configs
  - Update AI prompt to use config
- **Success Criteria**:
  - All parameters configurable
  - Can switch configs without code changes
  - Can backtest multiple configs
- **Impact**: Enables systematic optimization

---

## 🟢 PHASE 4: Advanced Features (Week 8-10)

**Goal**: Scale and improve profitability

**Priority**: LOW - Nice to have, not critical for MVP

### Tasks

#### 🔲 4.1 Portfolio Risk Management
- **Status**: TODO
- **Estimated**: 4 days
- **Priority**: MEDIUM
- **Description**: Advanced risk controls
- **Features**:
  1. **Max Drawdown Limit**: Auto-pause if account drops X% from peak
  2. **Kelly Criterion**: Optimal position sizing based on win rate
  3. **Correlation Analysis**: Avoid over-correlated positions
  4. **Daily Loss Limit**: Stop trading if down X% in a day
- **Approach**:
  - Create `lib/risk/portfolio-manager.ts`
  - Calculate correlations between positions
  - Implement Kelly formula: `kellyPercent = (winRate * avgWin - lossRate * avgLoss) / avgWin`
  - Add risk checks in `lib/ai/run.ts`
- **Success Criteria**:
  - Max drawdown enforced
  - Position sizes optimized
  - Correlation warnings
- **Impact**: Better risk-adjusted returns

#### 🔲 4.2 Manual Trading Controls
- **Status**: TODO
- **Estimated**: 2 days
- **Priority**: HIGH (for live trading)
- **Description**: UI controls for emergency intervention
- **Features**:
  - Pause/Resume AI button
  - Manual close position button
  - Emergency "Close All" button
  - Override AI decision (force sell)
- **Approach**:
  - Create `/app/api/control/pause.ts`
  - Create `/app/api/control/close-position.ts`
  - Create `/app/api/control/close-all.ts`
  - Add UI controls to dashboard
- **Success Criteria**:
  - Can pause AI without restarting
  - Can manually close positions
  - Emergency close works within 2 seconds
- **Impact**: Essential safety feature for live trading

#### 🔲 4.3 Multiple Positions Per Symbol
- **Status**: TODO
- **Estimated**: 3 days
- **Priority**: MEDIUM
- **Description**: Allow scaling into winners
- **Current Limitation**: Single position per symbol (line 88-93 in `validator.ts`)
- **Approach**:
  - Remove single-position restriction
  - Update position tracking (multiple `positionId`s per symbol)
  - Update AI prompt to handle multiple entries
  - Add position aggregation in UI
- **Success Criteria**:
  - Can have 2-3 positions in same symbol
  - Each position tracked independently
  - Can scale in and out
- **Impact**: Better strategy execution

#### 🔲 4.4 Trailing Stop-Loss
- **Status**: TODO
- **Estimated**: 3 days
- **Priority**: MEDIUM
- **Description**: Automatically adjust stop-loss as price moves in favor
- **Logic**:
  - Once position is +5% profitable, activate trailing stop
  - Stop follows price at 5% below peak
  - If price falls back to stop level, auto-sell
- **Approach**:
  - Create `lib/trading/trailing-stop.ts`
  - Add cron job to check trailing stops every minute
  - Store trail state in `TrailingStop` table
- **Success Criteria**:
  - Stops trail correctly
  - Auto-executes on trigger
  - Logs trailing stop actions
- **Impact**: Locks in profits on winning trades

#### 🔲 4.5 Chart Performance Optimization
- **Status**: TODO
- **Estimated**: 2 days
- **Priority**: LOW
- **Description**: Improve chart rendering performance
- **Current Issue**: Re-creates entire chart on every update (inefficient)
- **Approach**:
  - Use `chart.update()` instead of re-creating
  - Memoize expensive calculations
  - Use `React.memo` on chart component
  - Consider WebSocket for streaming updates
- **Success Criteria**:
  - Chart updates in < 50ms
  - No flickering on updates
  - Smooth animations
- **Impact**: Better UX, lower CPU usage

---

## 📅 Timeline Summary

| Week | Phase | Focus | Deliverables |
|------|-------|-------|--------------|
| 1 | Phase 1 | Safety | Liquidation protection ✅, Error handling, Tests |
| 2 | Phase 1 | Safety | Rate limiting, Logging, Partial sells |
| 3 | Phase 2 | Monitoring | Metrics dashboard, Alerts |
| 4 | Phase 2 | Monitoring | Health checks, Better AI prompt |
| 5 | Phase 3 | Backtesting | Historical data loader |
| 6 | Phase 3 | Backtesting | Backtest engine |
| 7 | Phase 3 | Backtesting | Backtest UI, Strategy params |
| 8 | Phase 4 | Advanced | Portfolio risk, Manual controls |
| 9 | Phase 4 | Advanced | Multiple positions, Trailing stops |
| 10 | Phase 4 | Polish | Chart optimization, Final testing |

---

## 🎯 Success Criteria by Phase

### Phase 1: Ready for Live Trading
- ✅ Zero liquidations
- ✅ API error rate < 1%
- ✅ Trade execution success > 99%
- ✅ Test coverage > 70%

### Phase 2: Monitored & Optimized
- ✅ Real-time alerts working
- ✅ Performance metrics tracked
- ✅ Sharpe ratio > 1.5
- ✅ Max drawdown < 15%

### Phase 3: Strategy Validated
- ✅ Backtest engine functional
- ✅ 6+ months historical data
- ✅ Strategy parameters optimized
- ✅ Win rate > 50%

### Phase 4: Production Ready
- ✅ Manual controls working
- ✅ Risk management active
- ✅ Chart performance optimized
- ✅ All features documented

---

## 🚦 Current Status

**We are here**: ⭐ Week 1, Phase 1, Task 1.1 COMPLETE

**Next up**: Task 1.2 - Error Handling & Retries

**Blockers**: None

**Risk Level**: 🟢 LOW (Liquidation protection active)

---

## 📝 Notes

- This roadmap is flexible - priorities may shift based on testing results
- Each task should be committed separately for easy rollback
- Update this file after completing each task
- Real-world trading may reveal new priorities not listed here

---

**Document Version**: 1.0
**Last Updated**: 2025-11-03
**Next Review**: After completing Phase 1
