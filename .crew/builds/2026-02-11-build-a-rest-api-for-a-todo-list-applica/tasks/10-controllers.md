---
id: 10-controllers
title: Todo controller implementation
status: pending
phase: 2
depends_on:
  - 09-service-layer
complexity: medium
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Todo Controller Implementation

## Description
Create the thin presentation layer that maps HTTP requests to service calls and converts results to JSON responses.

## Files
### Create
- src/controllers/todo.controller.ts
- src/utils/asyncHandler.ts (wrapper to auto-catch async errors)
### Modify
- (none)
### Reference
- src/services/todo.service.ts
- src/utils/customError.ts

## Agent Instructions
- Each controller function (`create`, `getOne`, `getAll`, `update`, `remove`) should be exported.
- Use `asyncHandler` wrapper: `export const create = asyncHandler(async (req, res) => { … })`.
- Return JSON `{ data: result }` with appropriate status codes (201 create, 200 others, 204 on delete with no body).
- Throw `CustomError` for 404 from service layer.

## Acceptance Criteria
- [ ] Controller functions compile and use asyncHandler.
- [ ] No direct repository imports.
- [ ] Proper HTTP status codes set.
