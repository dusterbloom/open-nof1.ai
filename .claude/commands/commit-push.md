---
description: Generate Conventional Commits message, commit, and push
argument-hint: "[optional scope]"
model: sonnet
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git branch:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*)
---

## Context

- Current git status: !`git status`
- Current git diff: !`git diff HEAD`
- Current branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -10`
- Optional scope argument: $ARGUMENTS

## Your task

Generate a commit message following Conventional Commits and execute the full workflow:

### Commit Message Format

**Structure**: `<type>(<scope>): <imperative summary, ≤50 chars>`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting, missing semicolons, etc.
- `refactor`: Code restructuring without behavior change
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system or dependencies
- `ci`: CI configuration changes
- `chore`: Other changes that don't modify src or test files
- `revert`: Reverting a previous commit

**Guidelines**:
- Subject: imperative mood (e.g., "add" not "added"), capitalized, no period, max 50 chars
- Scope: optional, use $ARGUMENTS if provided, otherwise infer from changes (kebab-case)
- Body: optional, wrap at 72 chars, explain *what* and *why* (not how)
- Footer: optional, issue references (Closes #123), BREAKING CHANGE if needed

### Execution Steps

1. Analyze the staged and unstaged changes
2. Generate a single, most appropriate commit message
3. If $ARGUMENTS is provided, use it as the scope
4. Execute: `git add -A`
5. Execute: `git commit -m "<generated message>"`
6. Execute: `git push`
7. Report the commit hash and confirmation

## Constraints

- DO NOT add Claude co-authorship footer
- Be concise and clear
- Follow imperative mood strictly
