---
id: 05-models-and-schemas
title: Define domain model and Zod schemas
status: pending
phase: 1
depends_on:
  - 02-typescript-config
complexity: medium
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Define Domain Model and Zod Schemas

## Description
Create TypeScript model definitions for a Todo item and validation schemas that enforce correct client input.

## Files
### Create
- src/models/todo.model.ts
- src/schemas/todo.schema.ts
### Modify
- (none)
### Reference
- src/utils/uuid.ts (for ID type documentation)

## Agent Instructions
- The `Todo` interface should include: `id: string`, `title: string`, `completed: boolean`, `createdAt: Date`, `updatedAt: Date`.
- Zod schemas to export:
  - `createTodoSchema` – body must have `title` (string, min 1, max 100); server will set `completed` false.
  - `updateTodoSchema` – partial object of `title?: string`, `completed?: boolean` but must contain at least one key (use `.refine`).
  - `idParamSchema` – route param `{ id: string(uuid) }` using `.uuid()`.
- Use `z.infer<typeof createTodoSchema>` etc. to export TypeScript types `CreateTodoDTO`, `UpdateTodoDTO`, and `IdParam`.

## Acceptance Criteria
- [ ] `Todo` model and exported DTO types compile.
- [ ] Validation correctly rejects empty bodies for update (unit test will be created later).
- [ ] Lint passes.
