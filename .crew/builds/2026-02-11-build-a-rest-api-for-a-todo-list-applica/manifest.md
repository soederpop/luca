---
goal: "Build a REST API for a todo list application using Express and TypeScript with validation via Zod and automated tests via Vitest."
status: ready
architect_model: o3
planner_model: o3
coding_model: sonnet
created_at: "2024-06-25T12:00:00Z"
revision: 0
max_revisions: 2
max_concurrent: 3
permission_mode: bypassPermissions
project_path: "/tmp/programming-team-demo"
total_phases: 3
---

# Build Plan: Todo REST API

## Architectural Context
The API follows a Clean/Hexagonal architecture:
- Presentation: Express routes & controllers (HTTP only)
- Application: Services (business logic)
- Domain/Data: Repository interface with an in-memory implementation
- Cross-cutting: Validation (Zod), logging (pino), error handling
Testing strategy: unit tests for repository & service, integration tests for routes using supertest.
The codebase is TypeScript-first, uses path aliases, eslint/prettier for style, and aims for ≥90 % unit-test coverage.

## Global Agent Instructions
- Use 2-space indentation, semicolons, single quotes.
- Keep layers independent; no Express objects in service layer, etc.
- All new files MUST compile under `ts-node` and pass `vitest`.
- Do not introduce persistence beyond the in-memory repository.
- Update exports so that `import` paths match the directory structure & TS aliases.
- All errors MUST propagate as `CustomError` or be handled by the global error middleware.
- Every exported function/class needs JSDoc.

## Execution Order
Phase 1: 01-project-setup, 02-typescript-config, 03-quality-tooling, 04-utils, 05-models-and-schemas, 06-repository-layer, 07-error-handling, 08-validation-middleware
Phase 2: 09-service-layer, 10-controllers, 11-routes, 12-server-bootstrap, 13-index-export
Phase 3: 14-integration-tests

## Review Criteria
- Project boots via `npm run dev` without runtime errors.
- All unit & integration tests pass (`vitest run`).
- Clean architecture boundaries are respected.
- Validation rejects malformed requests; happy paths return correct JSON & HTTP codes.
- Code style follows eslint/prettier rules with no linter errors.
- Repository & service unit tests achieve ≥90 % coverage.
- No file modifies the same content as another parallel task.
