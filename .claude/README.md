# Claude Code Infrastructure for MCP SME Toolkit

## Overview

This `.claude/` directory contains the infrastructure for professional Claude Code assistance with your MCP-based SME toolkit. The focus is on **integrating existing MCP servers** rather than building from scratch.

## Project Tech Stack

- **Backend**: Python + **FastMCP** (Anthropic's MCP framework - auto-generates schemas from docstrings)
- **Voice Agent**: Pipecat-based with tool calling (already done)
- **Frontend**: Tauri + React
- **Database**: SQLite + FAISS
- **Deployment**: Self-hosted first

**Framework Decision**: Using FastMCP instead of raw FastAPI for MCP server development. FastMCP provides automatic schema generation from Python type hints and docstrings, reducing boilerplate code significantly.

## Existing MCP Servers to Integrate

- ✅ [dushaobindoudou/mcp-wallet](https://github.com/dushaobindoudou/mcp-wallet) - Web3 wallet with EVM chains
- ✅ [msaelices/whatsapp-mcp-server](https://github.com/msaelices/whatsapp-mcp-server) - Python WhatsApp integration
- ✅ [egyptianego17/email-mcp-server](https://github.com/egyptianego17/email-mcp-server) - Email MCP server
- ✅ [mcp.shop](https://github.com/workos/mcp.shop) - Reference for shop patterns

## Directory Structure

```
.claude/
├── settings.json                           # Hook configuration
├── skills/
│   ├── skill-rules.json                   # Skill activation rules
│   ├── skill-developer/                   # Meta-skill for creating skills
│   └── mcp-builder/                       # Anthropic's official MCP server guide
│       ├── SKILL.md                       # 4-phase MCP development process
│       ├── reference/                     # Implementation guides
│       │   ├── python_mcp_server.md       # FastMCP patterns
│       │   ├── mcp_best_practices.md      # MCP protocol best practices
│       │   ├── evaluation.md              # Testing guide
│       │   └── node_mcp_server.md         # Node/TypeScript reference
│       └── scripts/                       # Evaluation tools
│           ├── evaluation.py              # Automated testing
│           ├── connections.py             # MCP connection utilities
│           └── example_evaluation.xml     # Evaluation template
├── agents/
│   ├── code-architecture-reviewer.md      # Reviews code architecture (adapted for Python/FastMCP/MCP)
│   ├── documentation-architect.md         # Creates comprehensive documentation
│   └── git-workflow-manager.md            # Git workflow optimization and automation
├── hooks/
│   ├── skill-activation-prompt.sh         # Auto-suggests relevant skills
│   ├── skill-activation-prompt.ts         # TypeScript implementation
│   ├── post-tool-use-tracker.sh          # Tracks file changes
│   ├── package.json                       # Hook dependencies
│   └── node_modules/                      # Installed dependencies
└── commands/                              # Slash commands
    ├── commit.md                          # Interactive Conventional Commits
    └── commit-push.md                     # Quick commit and push
```

## Phase 1: Foundation ✅ COMPLETE

- ✅ Created `.claude/` directory structure
- ✅ Copied hooks from showcase (skill-activation, post-tool-use-tracker)
- ✅ Installed hook dependencies (npm packages)
- ✅ Copied skill-developer skill (teaches skill creation)
- ✅ Copied and adapted agents:
  - code-architecture-reviewer (updated for Python/FastAPI/MCP)
  - documentation-architect (generic, works as-is)
- ✅ Created settings.json with hook configuration
- ✅ Created skill-rules.json with skill-developer triggers
- ✅ Validated JSON files and hook permissions

## What's Installed

### Hooks
- **skill-activation-prompt**: Automatically suggests relevant skills based on your prompts and keywords
- **post-tool-use-tracker**: Tracks file changes for better context management

### Skills
- **skill-developer**: Meta-skill that teaches how to create more skills. Triggers when you mention "skill system", "create skill", "skill triggers", etc.
- **mcp-builder**: Anthropic's official guide for building MCP servers with Python FastMCP. Triggers when you mention "MCP server", "build MCP", "MCP tool", "FastMCP", etc. Includes:
  - 4-phase development process (Research → Implement → Review → Evaluate)
  - Python FastMCP implementation patterns
  - MCP best practices (naming, pagination, character limits, security)
  - Evaluation scripts for automated testing

### Agents
- **code-architecture-reviewer**: Reviews code for Python/FastMCP/MCP best practices, architectural consistency, and system integration
- **documentation-architect**: Creates comprehensive documentation for MCP interfaces, data flows, and system architecture
- **git-workflow-manager**: Senior Git workflow manager specializing in version control optimization, branching strategies, commit standards, merge management, and automation setup

### Commands
- **/commit**: Interactive git commit with Conventional Commits format. Generates 3 message candidates, shows reasoning, and commits with your choice
- **/commit-push**: Quick commit and push workflow. Generates Conventional Commits message, commits all changes, and pushes to remote. Supports optional scope argument

## How to Use

### Skills

Skills auto-activate based on your prompts:

**skill-developer** triggers when you:
- Mention "create skill" or "add skill"
- Ask about "skill triggers" or "skill system"
- Work with skill-rules.json

**mcp-builder** triggers when you:
- Mention "MCP server", "build MCP", or "create MCP tool"
- Work on files in `mcp-servers/`, `mcp-core/`, or `mcp-client/`
- Use FastMCP decorators like `@mcp.tool()`
- Ask about "MCP best practices" or "MCP protocol"

Example:
```
How do I implement a shop_list_products tool with FastMCP?
```
The mcp-builder skill will auto-suggest and provide official Anthropic guidance.

### Agents

Use agents with the Task tool:
```
Use the code-architecture-reviewer agent to review my MCP server implementation
```
or
```
Use the documentation-architect agent to document the wallet integration
```
or
```
Use the git-workflow-manager agent to review my repository workflow and suggest improvements
```

### Commands

Use slash commands by typing `/` followed by the command name:

**Interactive Commit**:
```
/commit
```
- Analyzes your changes
- Generates 3 Conventional Commits message candidates
- Shows reasoning for each option
- Commits with the best choice

**Quick Commit & Push**:
```
/commit-push
```
or with a scope:
```
/commit-push auth
```
- Analyzes changes and generates a single best commit message
- Commits all changes
- Pushes to remote
- Fast workflow for quick iterations

**Conventional Commits Format**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code restructuring
- `test:` - Test additions/changes
- `chore:` - Maintenance tasks

### Building MCP Servers

The **mcp-builder skill** provides a 4-phase process:
1. **Research**: Study MCP protocol, plan tools (workflow-oriented, not just CRUD)
2. **Implement**: Use FastMCP framework, Pydantic models, async/await patterns
3. **Review**: Code quality check, test with evaluation harness
4. **Evaluate**: Create 10 test questions, verify with scripts

Just mention "build MCP server" and the skill will guide you through the process.

## Phase 1.5: Recently Added ✅

- ✅ **mcp-builder skill** integrated (Anthropic's official MCP guide)
  - Replaces need for custom "python-fastapi-mcp-patterns" skill
  - Provides FastMCP framework patterns
  - Includes evaluation scripts for testing
  - Auto-activates when working on MCP servers

## Phase 2: Next Steps (TODO)

### Skills to Create (Updated based on mcp-builder)
1. ~~**python-fastapi-mcp-patterns**~~ → **REPLACED by mcp-builder skill**

2. **mcp-integration-patterns** (create new)
   - How to connect to existing MCP servers
   - Transport layers (stdio, WebSocket, HTTP)
   - JSON-RPC 2.0 client patterns
   - Tool discovery and invocation

3. **wallet-security-patterns** (create new)
   - Secure key management with mcp-wallet
   - Transaction signing patterns
   - NO private keys in code
   - Audit logging

### Agents to Create
1. **mcp-protocol-tester** - Tests JSON-RPC communication, tool discovery, transport layers
2. **mcp-integration-mapper** - Maps data flows between voice agent → MCP servers → external APIs
3. **wallet-security-auditor** - Audits wallet integration security

### Commands to Create
1. **dev-docs** - Documentation management (copy & adapt from showcase)
2. **mcp-test** - Quick MCP server connection testing

### Commands Created ✅
1. ✅ **/commit** - Interactive git commit with Conventional Commits format
2. ✅ **/commit-push** - Quick commit and push workflow

## Testing

Verify the installation:
```bash
# Check hook permissions
ls -la .claude/hooks/*.sh

# Validate JSON files
cat .claude/skills/skill-rules.json | jq .
cat .claude/settings.json | jq .

# Test skill-activation hook manually
echo '{"session_id":"test","prompt":"how do I create a skill?"}' | npx tsx .claude/hooks/skill-activation-prompt.ts
```

## Key Principles

✅ **Integration over development** - Connect existing MCP servers, don't build new ones
✅ **Minimal new code** - Leverage open-source MCP components
✅ **Focus on Python/FastAPI** - All patterns adapted for this stack
✅ **Security first** - Wallet operations need careful review
✅ **Testing essential** - MCP protocol communication must be validated

## Resources

- [MCP Official Docs](https://modelcontextprotocol.io/)
- [idea_1_explored.md](../idea_1_explored.md) - Full system architecture
- [idea_1_local_ai_mcp.md](../idea_1_local_ai_mcp.md) - MCP component details
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code)

## Support

- Use the **skill-developer** skill to learn how to create new skills
- Use the **mcp-builder** skill for building MCP servers (just mention "build MCP server")
- Use the **code-architecture-reviewer** agent to review implementations
- Use the **documentation-architect** agent to document complex systems

---

**Status**: Phase 1.5 Complete ✅ | Git workflow tools added | Ready for MVP Implementation
**Last Updated**: 2025-11-01

**Recent Changes**:
- Added mcp-builder skill from Anthropic (official MCP server development guide)
- Updated tech stack to use FastMCP framework (instead of raw FastAPI)
- Auto-schema generation from docstrings and type hints
- Evaluation scripts included for automated MCP server testing
- Added git-workflow-manager agent for professional version control workflows
- Added /commit and /commit-push commands for Conventional Commits automation
