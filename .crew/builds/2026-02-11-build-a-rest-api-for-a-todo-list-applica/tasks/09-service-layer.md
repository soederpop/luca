---
id: 09-service-layer
title: Todo service implementation and unit tests
status: pending
phase: 2
depends_on:
  - 04-utils
  - 05-models-and-schemas
  - 06-repository-layer
  - 07-error-handling
  - 08-validation-middleware
complexity: large
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Todo Service Implementation and Unit Tests

## Description
Create the application-layer service that orchestrates business logic and interacts with the repository. Include comprehensive unit tests with a mocked repository.

## Files
### Create
- src/services/todo.service.ts
- tests/unit/todo.service.test.ts
### Modify
- (none)
### Reference
- src/repositories/repository.interfaces.ts
- src/models/todo.model.ts
- src/utils/customError.ts

## Agent Instructions
Service methods:
- `createTodo(dto: CreateTodoDTO)` – generates id via `generateUuid`, timestamps, stores.
- `getTodo(id: string)` – 404 if not found.
- `getAllTodos()` – returns list.
- `updateTodo(id: string, dto: UpdateTodoDTO)` – merge & save; error if no fields provided handled earlier.
- `deleteTodo(id: string)` – 404 if missing.

Unit tests should stub repository using Vitest `vi.fn()` mocks to isolate service logic.

## Acceptance Criteria
- [ ] Service compiles and exports each method.
- [ ] All unit tests pass with ≥90 % coverage.
- [ ] Business rules (e.g., 404 on missing, timestamps update) are enforced.
