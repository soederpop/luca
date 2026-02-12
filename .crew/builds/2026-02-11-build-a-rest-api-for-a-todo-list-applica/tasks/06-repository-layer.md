---
id: 06-repository-layer
title: Repository interface, in-memory implementation, and unit tests
status: pending
phase: 1
depends_on:
  - 04-utils
  - 05-models-and-schemas
complexity: large
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Repository Interface, In-memory Implementation, and Unit Tests

## Description
Provide the data-access layer:
1. `repositories/repository.interfaces.ts` defining `ITodoRepository` with CRUD async methods.
2. `repositories/inMemoryTodo.repository.ts` concrete class using a `Map<string, Todo>` store.
3. Unit tests validating all methods incl. edge cases and state reset between tests.

## Files
### Create
- src/repositories/repository.interfaces.ts
- src/repositories/inMemoryTodo.repository.ts
- tests/unit/todo.repository.test.ts
### Modify
- (none)
### Reference
- src/models/todo.model.ts
- src/utils/uuid.ts

## Agent Instructions
- CRUD methods: `create`, `findById`, `findAll`, `update`, `delete` – all return `Promise`.
- `create` should enforce unique `id` (throw Error if duplicate, though shouldn’t occur in Map).
- Use `beforeEach` in tests to instantiate a fresh repository.
- Aim for ≥95 % coverage for this file.

## Acceptance Criteria
- [ ] Interface and class compile with strict TS.
- [ ] All repository tests pass (`vitest run tests/unit`).
- [ ] Mutation methods update `updatedAt` timestamp.
- [ ] Coverage for repository ≥95 %.
