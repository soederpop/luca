---
id: 11-routes
title: Express router for /todos endpoints
status: pending
phase: 2
depends_on:
  - 10-controllers
  - 08-validation-middleware
  - 05-models-and-schemas
complexity: small
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Express Router for /todos Endpoints

## Description
Wire up RESTful routes applying validation middleware and delegating to controllers.

## Files
### Create
- src/routes/todo.router.ts
### Modify
- (none)
### Reference
- src/controllers/todo.controller.ts
- src/schemas/todo.schema.ts
- src/middlewares/validation.middleware.ts

## Agent Instructions
- Endpoints:
  - POST `/todos` – validate body with `createTodoSchema`.
  - GET `/todos` – no validation.
  - GET `/todos/:id` – validate params with `idParamSchema`.
  - PATCH `/todos/:id` – validate params + body.
  - DELETE `/todos/:id` – validate params.
- Export router as default.

## Acceptance Criteria
- [ ] Router compiles and all routes call correct controllers.
- [ ] Validation middleware is applied in correct order.
