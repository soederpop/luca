---
id: 04-utils
title: Implement utility modules (uuid & logger)
status: pending
phase: 1
depends_on:
  - 01-project-setup
  - 02-typescript-config
complexity: small
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Implement Utility Modules (uuid & logger)

## Description
Add generic utility helpers used across the codebase:
1. `utils/uuid.ts` – thin wrapper around the `uuid` package, exposing `generateUuid(): string` using `v4`.
2. `utils/logger.ts` – exports a configured `pino` instance with a readable timestamp format.

## Files
### Create
- src/utils/uuid.ts
- src/utils/logger.ts
### Modify
- (none)
### Reference
- package.json (ensure `uuid` and `pino` are installed) – already done by Task 01.

## Agent Instructions
- Use named exports (`export const generateUuid = () => …`).
- Configure pino with `{ level: process.env.LOG_LEVEL ?? 'info' }`.
- Include JSDoc for each exported member.

## Acceptance Criteria
- [ ] `src/utils/uuid.ts` and `src/utils/logger.ts` compile with `tsc`.
- [ ] No linter warnings.
