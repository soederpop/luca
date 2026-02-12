---
id: 07-error-handling
title: Custom error class and error middleware
status: pending
phase: 1
depends_on:
  - 02-typescript-config
complexity: small
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Custom Error Class and Error Middleware

## Description
Create a reusable `CustomError` plus global Express error-handling middleware.

## Files
### Create
- src/middlewares/error.middleware.ts
- src/utils/customError.ts
### Modify
- (none)
### Reference
- src/utils/logger.ts

## Agent Instructions
- `CustomError` extends `Error` with `statusCode` and optional `details`.
- `error.middleware.ts` must handle:
  1. `CustomError` – respond with its `statusCode` and message.
  2. `ZodError` – respond 400 and provide `issues` array.
  3. Fallback – respond 500.
- Log errors with `logger.error`.

## Acceptance Criteria
- [ ] Middleware has signature `(err, req, res, next)` and ends response.
- [ ] Unknown errors do NOT leak stack traces in response JSON.
- [ ] Compiles with TS and has no linter errors.
