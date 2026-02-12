---
id: 01-project-setup
title: Initialize Node project and core dependencies
status: pending
phase: 1
depends_on: []
complexity: medium
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Initialize Node Project and Core Dependencies

## Description
Create the base project at `/tmp/programming-team-demo` with `package.json`, basic scripts, and essential dependencies. This lays the groundwork for all future tasks.

Include production dependencies:
- express
- zod
- pino
- uuid

Include dev dependencies:
- typescript
- ts-node-dev
- vitest
- @vitest/coverage-c8
- supertest
- @types/express
- @types/node
- @types/supertest
- eslint
- @typescript-eslint/parser
- @typescript-eslint/eslint-plugin
- prettier
- eslint-config-prettier
- eslint-plugin-prettier
- husky
- lint-staged

Add npm scripts:
- "dev": `ts-node-dev --respawn --transpile-only src/app/server.ts`
- "build": `tsc -p .`
- "start": `node dist/app/server.js`
- "test": `vitest run --coverage`
- "lint": `eslint . --ext .ts`
- "prepare": `husky install`

Initialize Git repository and Husky with a pre-commit hook that runs `lint-staged` to lint + format staged files.

## Files
### Create
- /tmp/programming-team-demo/package.json
- /tmp/programming-team-demo/.gitignore
- /tmp/programming-team-demo/README.md
- /tmp/programming-team-demo/.npmrc (set `save-exact=true`)
### Modify
- (none)
### Reference
- (none)

## Agent Instructions
- Use `npm init -y` semantics for the initial JSON but adjust fields as needed.
- Ensure `type` is set to `module` to enable ES module syntax.
- Add `"main": "dist/app/server.js"` and `"module": "dist/app/server.js"`.
- For Husky, add a pre-commit that runs `npm run lint` and `npm test` on staged files via `lint-staged`.
- The repository will remain private; you may skip publishing metadata.

## Acceptance Criteria
- [ ] `package.json` exists with all listed dependencies and scripts.
- [ ] `npm install` completes with no unmet peer dependencies.
- [ ] `.gitignore` ignores `node_modules`, `dist`, and environment files.
- [ ] Husky is enabled (`.husky/` folder) with a working pre-commit hook.
- [ ] `npm run test` executes Vitest (will be empty for now) without errors.
