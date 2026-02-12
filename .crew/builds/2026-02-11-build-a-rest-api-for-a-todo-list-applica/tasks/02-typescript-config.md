---
id: 02-typescript-config
title: Configure TypeScript and path aliases
status: pending
phase: 1
depends_on:
  - 01-project-setup
complexity: small
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---

# Configure TypeScript and Path Aliases

## Description
Create the TypeScript configuration to compile source files from `src/` into `dist/`, and establish path aliases used throughout the codebase.

## Files
### Create
- /tmp/programming-team-demo/tsconfig.json
### Modify
- package.json (add `"types": "dist/index.d.ts"` and adjust build script if necessary)
### Reference
- None

## Agent Instructions
- Compiler options:
  - target: `ES2020`
  - module: `ES2020`
  - moduleResolution: `node`
  - outDir: `dist`
  - rootDir: `src`
  - strict: true
  - esModuleInterop: true
  - forceConsistentCasingInFileNames: true
  - skipLibCheck: true
  - resolveJsonModule: true
  - baseUrl: "src"
  - paths:
    - "@app/*": ["app/*"]
    - "@routes/*": ["routes/*"]
    - "@controllers/*": ["controllers/*"]
    - "@services/*": ["services/*"]
    - "@repositories/*": ["repositories/*"]
    - "@models/*": ["models/*"]
    - "@schemas/*": ["schemas/*"]
    - "@middlewares/*": ["middlewares/*"]
    - "@utils/*": ["utils/*"]
- Enable `types` array with `["node", "vitest"]`.
- Include `include` = ["src", "tests", "types.d.ts"], `exclude` = ["node_modules", "dist"]

## Acceptance Criteria
- [ ] `tsconfig.json` exists with the listed options and path aliases.
- [ ] Running `npx tsc --noEmit` completes with zero errors (will be empty source now).
