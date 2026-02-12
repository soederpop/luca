---
id: 13-index-export
title: Export configured Express app for tests
status: pending
phase: 2
depends_on:
  - 12-server-bootstrap
complexity: small
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Export Configured Express App for Tests

## Description
Provide a simple entry point that imports the configured app from `src/app/server.ts` and re-exports it for integration tests.

## Files
### Create
- src/index.ts
### Modify
- (none)
### Reference
- src/app/server.ts

## Agent Instructions
```ts
import { app } from './app/server.js';
export default app;
```
Use ESM export style to match `type: module`.

## Acceptance Criteria
- [ ] Tests can `import app from '@root/index'` (relative path in tests) without side effects (server should NOT listen when imported).
