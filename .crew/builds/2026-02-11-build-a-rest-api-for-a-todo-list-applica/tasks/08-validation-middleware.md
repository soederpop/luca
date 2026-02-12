---
id: 08-validation-middleware
title: Validation middleware and Express type augmentation
status: pending
phase: 1
depends_on:
  - 05-models-and-schemas
complexity: medium
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Validation Middleware and Express Type Augmentation

## Description
Implement a generic middleware that receives a Zod schema and validates `req.body`, `req.params`, or `req.query`, attaching the parsed data to `req.validated` (custom property).

## Files
### Create
- src/middlewares/validation.middleware.ts
- types.d.ts (at project root)
### Modify
- (none)
### Reference
- src/schemas/todo.schema.ts
- src/utils/customError.ts

## Agent Instructions
- Middleware factory `validate(schema: ZodSchema, target: 'body' | 'params' | 'query')` returns the actual Express middleware.
- On success, set `(req as any).validated = parsed` then `next()`.
- On failure, throw the ZodError so it bubbles to error middleware.
- In `types.d.ts`, augment `Express.Request` with optional `validated: unknown`.

## Acceptance Criteria
- [ ] Type augmentation allows `req.validated` without TS errors.
- [ ] Unit tests (optional here) compile if imported.
- [ ] Lint passes.
