---
id: 14-integration-tests
title: Integration tests for /todos routes
status: pending
phase: 3
depends_on:
  - 13-index-export
complexity: medium
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Integration Tests for /todos Routes

## Description
Write end-to-end tests using `supertest` against the Express app to verify the full HTTP stack with validation and error handling.

## Files
### Create
- tests/integration/todo.routes.test.ts
### Modify
- (none)
### Reference
- src/index.ts
- src/schemas/todo.schema.ts

## Agent Instructions
Test cases:
1. `POST /todos` with valid body returns 201 and persisted item.
2. Missing `title` returns 400.
3. `GET /todos` returns array containing created item.
4. `GET /todos/:id` returns single item, 404 on unknown id.
5. `PATCH /todos/:id` toggles `completed` and updates timestamp.
6. `DELETE /todos/:id` returns 204 and item is removed.
7. Validation: `PATCH /todos/:id` with empty body returns 400.
8. Malformed UUID param returns 400.
Use `beforeEach` to reset in-memory repository via direct import or by re-initialising a fresh app instance.

## Acceptance Criteria
- [ ] All tests pass (`npm test`).
- [ ] Coverage across routes ≥80 % lines.
- [ ] No warnings/log errors during test run.
