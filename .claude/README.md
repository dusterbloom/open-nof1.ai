# Claude Code Infrastructure for open-nof1.ai

## Overview

This `.claude/` directory contains the infrastructure for professional Claude Code assistance with the **open-nof1.ai** cryptocurrency trading platform - an AI-powered system that tests trading models with real money in real markets.

## Project Tech Stack

- **Frontend/Backend**: Next.js 15 (App Router) with Turbopack
- **Runtime**: Bun (fast package management)
- **Database**: PostgreSQL + Prisma ORM
- **AI**: Vercel AI SDK + DeepSeek R1 (reasoning model)
- **Trading**: CCXT library (Binance Futures, future: Hyperliquid DEX)
- **Technical Analysis**: technicalindicators library
- **UI**: React 19 + Tailwind CSS v4 + shadcn/ui

## Directory Structure

```
.claude/
├── settings.json                           # Hook configuration
├── settings.local.json                     # Local MCP permissions
├── skills/
│   ├── skill-rules.json                   # Skill activation triggers
│   ├── exchange-integration-patterns/      # Exchange (CEX/DEX) integration guidance
│   │   └── SKILL.md
│   ├── ai-trading-patterns/               # AI trading & prompt engineering
│   │   └── SKILL.md
│   └── mcp-builder/                       # MCP server development (kept for future)
│       ├── SKILL.md
│       └── reference/
├── agents/
│   ├── exchange-migration-assistant.md     # Exchange migration specialist
│   ├── code-architecture-reviewer.md       # Code review for Next.js/TypeScript
│   ├── documentation-architect.md          # Documentation creation
│   └── git-workflow-manager.md             # Git workflow optimization
├── hooks/
│   ├── skill-activation-prompt.sh         # Auto-suggests relevant skills
│   ├── skill-activation-prompt.ts         # TypeScript implementation
│   ├── post-tool-use-tracker.sh          # Tracks file changes
│   └── package.json                       # Hook dependencies
└── commands/
    ├── commit.md                          # Interactive Conventional Commits
    └── commit-push.md                     # Quick commit and push
```

## What's Installed

### Skills

Skills automatically activate based on your prompts and file edits.

**exchange-integration-patterns** - Activates when:
- Mentioning: "exchange", "binance", "hyperliquid", "dex", "ccxt", "migrate exchange"
- Working on files in `lib/trading/`
- Using CCXT methods like `fetchOHLCV`, `createMarketOrder`

Provides:
- CCXT integration patterns for CEX and DEX
- Authentication differences (API keys vs wallet signing)
- Market data fetching, order placement, position management
- Migration checklist (Binance → Hyperliquid/MEXC/dYdX)
- Error handling and retry patterns

**ai-trading-patterns** - Activates when:
- Mentioning: "trading prompt", "deepseek", "ai model", "risk management", "leverage"
- Working on files in `lib/ai/`
- Using `generateObject`, `tradingPrompt`, Zod schemas

Provides:
- Prompt engineering for trading decisions
- DeepSeek model selection (R1 vs V3)
- Schema design with Zod for structured outputs
- Risk management patterns (position sizing, stop losses)
- AI decision validation and testing
- Multi-timeframe analysis patterns

**mcp-builder** (Kept for future use) - Activates when:
- Mentioning: "MCP server", "build MCP", "FastMCP"
- Working on MCP-related files

Provides:
- Anthropic's official MCP server development guide
- Python FastMCP framework patterns
- Tool design and evaluation

### Agents

Agents are invoked explicitly using the Task tool.

**exchange-migration-assistant** - Use for:
```
Use the exchange-migration-assistant agent to migrate from Binance to Hyperliquid
```

Responsibilities:
- Analyzes current exchange integration
- Creates step-by-step migration plan (CEX→CEX, CEX→DEX)
- Provides code templates for new exchange
- Security review (private key handling, API keys)
- Testing strategy and validation checklist
- Supports: Binance → Hyperliquid (DEX), MEXC (CEX), dYdX v4 (DEX)

**code-architecture-reviewer** - Use for:
```
Use the code-architecture-reviewer agent to review my trading execution code
```

Responsibilities:
- Reviews code for Next.js/TypeScript best practices
- Checks trading-specific issues (risk management, validation)
- Verifies CCXT integration patterns
- Ensures Prisma ORM usage is correct
- Security review (API keys, sensitive data in logs)
- Validates AI decision schema compliance

**documentation-architect** - Use for:
```
Use the documentation-architect agent to document the AI prompt system
```

Responsibilities:
- Creates comprehensive documentation
- Developer guides with code examples
- API documentation and data flow diagrams
- Testing documentation

**git-workflow-manager** - Use for:
```
Use the git-workflow-manager agent to optimize our branching strategy
```

Responsibilities:
- Git workflow optimization
- Branching strategies
- Commit standards
- Merge management
- Automation setup

### Commands

Slash commands for quick workflows.

**/commit** - Interactive git commit:
```
/commit
```
- Analyzes your changes
- Generates 3 Conventional Commits message candidates
- Shows reasoning for each option
- Commits with the best choice

**/commit-push** - Quick commit & push:
```
/commit-push
```
or with scope:
```
/commit-push trading
```
- Generates one best commit message
- Commits all changes
- Pushes to remote
- Fast workflow for iterations

**Conventional Commits Format**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code restructuring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### Hooks

Hooks run automatically on events.

**skill-activation-prompt** - Runs on every user prompt:
- Analyzes your message
- Suggests relevant skills based on keywords/intent
- Non-blocking (suggests but doesn't force)

**post-tool-use-tracker** - Runs after file edits:
- Tracks which files were modified
- Helps maintain context across sessions

## How to Use

### Skills

Just work naturally - skills auto-activate:

```
# This triggers exchange-integration-patterns skill
"How do I migrate from Binance to Hyperliquid?"

# This triggers ai-trading-patterns skill
"I want to improve the trading prompt for better risk management"

# This triggers exchange-integration-patterns skill (file trigger)
# When you edit lib/trading/binance.ts
```

### Agents

Invoke explicitly with Task tool:

```
# Exchange migration
Use the exchange-migration-assistant agent to plan migration to MEXC

# Code review
Use the code-architecture-reviewer agent to review lib/ai/run.ts

# Documentation
Use the documentation-architect agent to document the CCXT integration
```

### Commands

Type slash commands:

```
# Interactive commit
/commit

# Quick commit and push
/commit-push

# With scope
/commit-push ai
```

## Key Development Patterns

### Trading System Flow

1. **Metrics Collection (20s interval)**:
   - `app/api/cron/20-seconds-metrics-interval/route.ts`
   - Collects account balance, positions, PnL

2. **AI Decision Making (3min interval)**:
   - `app/api/cron/3-minutes-run-interval/route.ts`
   - Calls `lib/ai/run.ts`
   - Flow: Market Data → AI Prompt → DeepSeek R1 → Decision → Execute → Database

3. **Core Modules**:
   - `lib/trading/` - Exchange integration (CCXT)
   - `lib/ai/` - AI models, prompts, orchestration
   - `app/api/` - Next.js API routes
   - `prisma/schema.prisma` - Database models

### Important Files

- `lib/ai/run.ts` - Main AI trading orchestration
- `lib/ai/prompt.ts` - System and user prompt generation
- `lib/trading/binance.ts` - CCXT exchange client
- `lib/trading/current-market-state.ts` - Technical indicators
- `lib/trading/account-information-and-performance.ts` - Account queries

### Future: Hyperliquid Migration

When ready to migrate to Hyperliquid (KYC-free DEX):

1. Use the **exchange-migration-assistant** agent:
   ```
   Use the exchange-migration-assistant agent to migrate to Hyperliquid
   ```

2. Agent will:
   - Analyze current Binance integration
   - Create migration plan (3-5 day effort, medium complexity)
   - Provide code templates (hyperliquid.ts, updated API calls)
   - Security review (wallet private key handling)
   - Testnet setup guide and validation checklist

3. Key Changes:
   - Authentication: API keys → Wallet private key
   - Symbol format: BTC/USDT → BTC-PERP (test both)
   - Delays: Instant → On-chain confirmation (1-3s)
   - File changes: binance.ts, market-state.ts, performance.ts

## Testing

Verify the installation:

```bash
# Check hook permissions
ls -la .claude/hooks/*.sh

# Validate JSON files
cat .claude/skills/skill-rules.json | jq .
cat .claude/settings.json | jq .

# Test skill-activation hook manually
echo '{"session_id":"test","prompt":"how do I integrate hyperliquid?"}' | npx tsx .claude/hooks/skill-activation-prompt.ts
```

## Key Principles

✅ **Security First**: Never commit API keys or private keys
✅ **Test Thoroughly**: Sandbox/testnet before live trading
✅ **Risk Management**: Always set stop losses, validate leverage
✅ **AI Validation**: Never execute AI decisions without validation
✅ **Documentation**: Update CLAUDE.md when architecture changes

## Resources

- [CLAUDE.md](../CLAUDE.md) - Main project documentation
- [Open-nof1.ai README](../README.md) - Project setup and usage
- [CCXT Documentation](https://docs.ccxt.com/)
- [Vercel AI SDK](https://sdk.vercel.ai/)
- [DeepSeek Models](https://www.deepseek.com/)
- [Prisma ORM](https://www.prisma.io/)

## Support

- Use the **exchange-integration-patterns** skill for exchange work (auto-activates)
- Use the **ai-trading-patterns** skill for AI/prompt work (auto-activates)
- Use the **exchange-migration-assistant** agent for migrations (invoke explicitly)
- Use the **code-architecture-reviewer** agent for code reviews (invoke explicitly)
- Use **/commit** or **/commit-push** for quick git workflows

---

**Status**: Infrastructure Complete ✅
**Last Updated**: 2025-11-01
**Project**: open-nof1.ai - AI Cryptocurrency Trading Platform

**Recent Changes**:
- Replaced MCP-focused infrastructure with crypto trading tools
- Added exchange-integration-patterns skill (CEX/DEX)
- Added ai-trading-patterns skill (prompt engineering, DeepSeek)
- Added exchange-migration-assistant agent (Binance → Hyperliquid/MEXC/dYdX)
- Updated code-architecture-reviewer for Next.js/TypeScript/trading patterns
- Kept git workflow tools (/commit, /commit-push, git-workflow-manager)
- Kept mcp-builder skill for potential future use
