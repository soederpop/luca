---
id: 03-quality-tooling
title: ESLint, Prettier, and Vitest configuration
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

# Configure ESLint, Prettier, and Vitest

## Description
Set up `.eslintrc.js`, `.prettierrc`, and `vitest.config.ts` to enforce code style and enable fast testing.

## Files
### Create
- /.eslintrc.js
- /.prettierrc
- /vitest.config.ts
### Modify
- package.json (add `"lint-staged"` config to format `*.{ts,js,json,md}` with prettier and lint with eslint)
### Reference
- tsconfig.json (for `vitest` paths)

## Agent Instructions
- `.eslintrc.js` should extend `['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended']` and set the parser to `@typescript-eslint/parser`.
- Prettier config: `{ "singleQuote": true, "trailingComma": "all", "semi": true, "tabWidth": 2 }`.
- `vitest.config.ts` should use `defineConfig` from `vitest/config`, set `test.environment: 'node'`, `coverage.provider: 'c8'`, and `globals: true`.

## Acceptance Criteria
- [ ] Lint passes on an empty `src` directory (`npm run lint`).
- [ ] `vitest` command executes successfully.
