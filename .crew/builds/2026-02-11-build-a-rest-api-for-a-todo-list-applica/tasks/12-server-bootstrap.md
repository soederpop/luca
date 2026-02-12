---
id: 12-server-bootstrap
title: Application bootstrap and middleware wiring
status: pending
phase: 2
depends_on:
  - 11-routes
  - 07-error-handling
complexity: medium
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Application Bootstrap and Middleware Wiring

## Description
Create the Express app, configure JSON parsing, logging, routes, 404 handler, and global error handler. Provide a `start()` function that listens on `process.env.PORT || 3000` when invoked.

## Files
### Create
- src/app/server.ts
- src/middlewares/notFound.middleware.ts
### Modify
- (none)
### Reference
- src/routes/todo.router.ts
- src/middlewares/error.middleware.ts
- src/utils/logger.ts

## Agent Instructions
- `notFound.middleware.ts` should return 404 JSON `{ message: 'Not Found' }`.
- `server.ts` should export both the `app` instance and a `start()` that only executes if the file is run directly (`import.meta.url === ...`).
- Apply Express middlewares in order: `express.json({ limit: '100kb' })` ➜ request logging (`pino-http` optional) ➜ `/todos` router ➜ 404 ➜ error middleware.

## Acceptance Criteria
- [ ] `npm run dev` starts server and responds to `/health` with 200 (add simple route) (optional for tests).
- [ ] Server logs startup message with logger.
- [ ] No unhandled promise rejections on boot.
