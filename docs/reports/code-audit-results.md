---
title: Code Audit - Container Abstraction Violations
status: active
type: report
createdAt: 2026-02-26
updatedAt: 2026-02-26
---

# Code Audit: Container Abstraction Violations

Audit of `src/**/features/**`, `src/**/clients/**`, `src/clients/**`, `src/servers/**`, and `src/commands/**` for violations of the container abstraction pattern.

**Excluded from audit**: `fs.ts`, `proc.ts`, `git.ts`, `os.ts` — these are core wrappers that intentionally import Node builtins. `file-manager.ts` is allowed to use `path` directly.

## Severity Legend

- **HIGH**: Breaks Node.js compatibility, or completely bypasses container when equivalent exists
- **MEDIUM**: Uses builtins/process.env when container provides an alternative
- **LOW**: Minor style issue, or acceptable edge case

---

## Summary

| Category | Files Audited | Files with Violations | HIGH | MEDIUM | LOW |
|----------|--------------|----------------------|------|--------|-----|
| Node Features | 14 | 11 | 19 | 14 | 6 |
| AGI Features | 10 | 3 | 12 | 4 | 0 |
| Clients | 7 | 3 | 3 | 2 | 0 |
| Servers | 3 | 2 | 1 | 1 | 0 |
| Commands | 11 | 5 | 3 | 5 | 2 |
| **Total** | **45** | **24** | **38** | **26** | **8** |

### Top Offenders (by violation count)

1. **`skills-library.ts`** — 7 HIGH (imports `path`, `os`, `fs/promises` and uses throughout)
2. **`claude-code.ts`** — 8 violations (3x `Bun.spawn`, 1x `Bun.write`, 2x dynamic `fs/promises`, 2x `process.env`)
3. **`launcher-app-command-listener.ts`** — 7 HIGH (fs, path, os at module top-level)
4. **`window-manager.ts`** — 7 HIGH (same pattern as launcher-app)
5. **`python.ts`** — 9+ uses of `existsSync`/`join` from builtins
6. **`package-finder.ts`** — 5 violations (partially migrated, inconsistent)
7. **`comfyui/index.ts`** — 5 violations in one method (dynamic imports + `Bun.write`)
8. **`openai-codex.ts`** — 4 violations (3x `Bun.spawn`, 2x `process.env`)

### Bug Found

**`repl.ts` lines 92, 192** — Uses `fs.readFileSync` and `fs.appendFileSync` but **never imports `fs`**. This will throw `ReferenceError` at runtime when history persistence is used.

---

## Detailed Findings

### Node Features (`src/node/features/`)

#### `package-finder.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 4 | `import { readdir, readFile } from 'fs/promises'` | `this.container.fs` | HIGH |
| 5 | `import { resolve, join, basename } from 'path'` | `this.container.paths` | MEDIUM |
| 242 | `readFile(path)` direct usage | `this.container.fs.readFileAsync()` | HIGH |
| 471, 477 | `readdir(...)` direct usage | `this.container.fs.readdirAsync()` | HIGH |
| 475, 477 | `join(...)` direct usage | `this.container.paths.join()` | MEDIUM |

Note: Line 523 correctly uses `this.container.fs.findUpAsync` — file is partially migrated but inconsistent.

#### `python.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 4 | `import { existsSync } from 'fs'` | `this.container.fs.exists()` | HIGH |
| 5 | `import { join, resolve } from 'path'` | `this.container.paths` | MEDIUM |
| 84 | `resolve(this.options.dir)` | `this.container.paths.resolve()` | MEDIUM |
| 93, 145, 158, 171-172, 177, 245-246, 256, 259 | 9+ calls to `existsSync()` | `this.container.fs.exists()` | HIGH |
| 145, 158, 171+ | `join(...)` throughout `detectEnvironment()` | `this.container.paths.join()` | MEDIUM |

Note: `execute()` method (line 313+) correctly uses container features — only `detectEnvironment()` and `enable()` are violating.

#### `launcher-app-command-listener.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 5 | `import { homedir } from 'os'` | `this.container.feature('os').homedir` | MEDIUM |
| 6 | `import { join, dirname } from 'path'` | `this.container.paths` | MEDIUM |
| 7 | `import { existsSync, unlinkSync, mkdirSync } from 'fs'` | `this.container.fs` | HIGH |
| 9-15 | `homedir()`, `join(...)` at module top-level (before container exists) | Must defer to runtime (`enable()` or getter) | HIGH |
| 250-253 | `dirname()`, `existsSync()`, `mkdirSync()` | `this.container.paths`/`this.container.fs` | HIGH |
| 260-263 | `existsSync()`, `unlinkSync()` | `this.container.fs` | HIGH |
| 307-308 | `existsSync()`, `unlinkSync()` | `this.container.fs` | HIGH |

#### `window-manager.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 5 | `import { homedir } from 'os'` | `this.container.feature('os').homedir` | MEDIUM |
| 6 | `import { join, dirname } from 'path'` | `this.container.paths` | MEDIUM |
| 8 | `import { existsSync, unlinkSync, mkdirSync } from 'fs'` | `this.container.fs` | HIGH |
| 10-16 | `homedir()`, `join(...)` at module top-level | Must defer to runtime | HIGH |
| 354-372 | `dirname()`, `existsSync()`, `mkdirSync()`, `unlinkSync()` | Container equivalents | HIGH |
| 420-421 | `existsSync()`, `unlinkSync()` | `this.container.fs` | HIGH |

#### `helpers.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 11 | `import { resolve, parse } from 'path'` | `this.container.paths` | MEDIUM |
| 134, 258 | `resolve(this.rootDir, ...)` | `this.container.paths.resolve()` | MEDIUM |
| 324 | `const { Glob } = globalThis.Bun \|\| (await import('bun'))` — unguarded `Bun.Glob` | Guard with `this.container.isBun` or use container glob | HIGH |

#### `tmux.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 479, 531 | `process.env.TMUX` | Container environment handling | MEDIUM |
| 505-509 | `process.platform === 'darwin'` / `'linux'` | `this.container.feature('os').platform` | LOW |
| 543-544 | `process.argv` direct access | Container equivalent | LOW |
| 546 | `import('child_process')` then `execSync(...)` | `this.container.feature('proc')` | HIGH |

#### `process-manager.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 104 | `ReturnType<typeof Bun.spawn>` — type depends on Bun | Runtime-agnostic type or guard | HIGH |
| 164 | `Bun.spawn(...)` — unguarded | `this.container.feature('proc')` or guard with `isBun` | HIGH |
| 166 | `{ ...process.env, ...spawnOptions.env }` | Container environment | MEDIUM |
| 508-530 | `process.on('exit')`, `process.on('SIGINT')`, etc. | Container lifecycle hooks | MEDIUM |

#### `google-auth.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 108, 115, 123, 147, 486 | `process.env.GOOGLE_*` (5 occurrences) | Container env handling (already declares `static envVars`) | MEDIUM |
| 247 | `Bun.serve({...})` — unguarded | Guard with `isBun` or use container server | HIGH |

#### `repl.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 92 | `fs.readFileSync(...)` — **`fs` is NOT imported** | `this.container.fs.readFileSync()` | **HIGH (BUG)** |
| 172 | `Bun.inspect(result, ...)` — unguarded | Guard with `this.container.isBun` | MEDIUM |
| 192 | `fs.appendFileSync(...)` — **`fs` is NOT imported** | `this.container.fs` | **HIGH (BUG)** |

#### `tts.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 67 | `process.env.RUNPOD_API_KEY` | Container env handling | MEDIUM |

Otherwise clean — correctly uses `this.container.paths`, `this.container.fs`, `this.container.feature('os')`.

#### `downloader.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 3 | `import fetch from 'cross-fetch'` | Global `fetch` (available in Bun and Node 18+) or container REST client | HIGH |

Otherwise clean — correctly uses `this.container.fs.writeFileAsync` and `this.container.paths.resolve`.

#### `runpod.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 4 | `import axios from 'axios'` | `this.container.client('rest')` or global `fetch` | HIGH |
| 46 | `process.env.RUNPOD_API_KEY` | Container env handling | MEDIUM |

#### `telegram.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 97 | `process.env.TELEGRAM_BOT_TOKEN` | Container env handling | MEDIUM |

Otherwise clean — properly uses `container.server('express')` and `container.feature('ui')`.

---

### AGI Features (`src/agi/features/`)

#### `skills-library.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 2 | `import path from 'path'` | `this.container.paths` | HIGH |
| 3 | `import os from 'os'` | `this.container.paths.homedir` or container os feature | HIGH |
| 4 | `import fs from 'fs/promises'` | `this.container.fs` | HIGH |
| 131 | `path.resolve(os.homedir(), '.luca', 'skills')` | `this.container.paths.resolve(...)` | HIGH |
| 250 | `await fs.mkdir(..., { recursive: true })` | `this.container.fs.mkdirp()` or `ensureFolder()` | HIGH |
| 330-331 | `path.resolve(...)` in `remove()` | `this.container.paths.resolve()` | HIGH |
| 335 | `await fs.rm(skillDir, { recursive: true })` | `this.container.fs.rm()` | HIGH |

Worst AGI offender — three Node builtin imports at top level used throughout.

#### `claude-code.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 7 | `import type { Subprocess } from 'bun'` | Runtime-agnostic type | MEDIUM |
| 275 | `Bun.spawn([this.claudePath, '--version'], ...)` | Container `proc` feature | HIGH |
| 334 | `const { appendFile } = await import('node:fs/promises')` | `this.container.fs` | HIGH |
| 382 | `process.env.TMPDIR` | Container temp dir handling | MEDIUM |
| 384 | `await Bun.write(tmpPath, ...)` | Container fs write | HIGH |
| 619-624 | `Bun.spawn(...)` + `{ ...process.env }` | Container `proc` + env | HIGH |
| 750-755 | `Bun.spawn(...)` + `{ ...process.env }` | Same | HIGH |
| 920 | `const { unlink } = await import('node:fs/promises')` | `this.container.fs` | HIGH |

Completely Bun-locked. Three `Bun.spawn` call sites, one `Bun.write`, two dynamic `fs/promises` imports.

#### `openai-codex.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 7 | `import type { Subprocess } from 'bun'` | Runtime-agnostic type | MEDIUM |
| 174 | `Bun.spawn([this.codexPath, '--version'], ...)` | Container `proc` feature | HIGH |
| 375-379 | `Bun.spawn(...)` + `{ ...process.env }` | Container `proc` + env | HIGH |
| 502-507 | `Bun.spawn(...)` + `{ ...process.env }` | Same | HIGH |

Same pattern as `claude-code.ts`.

#### Clean AGI Files

- `conversation.ts` — Clean
- `conversation-history.ts` — Clean (uses `container.feature('diskCache')`)
- `assistant.ts` — Exemplary (uses `container.fs`, `container.paths`, `container.feature('vm')`)
- `assistants-manager.ts` — Clean (uses `container.paths`, `container.fs`)
- `docs-reader.ts` — Clean
- `openapi.ts` — Clean (uses global `fetch`)
- `heartbeat.ts` — Clean (uses `container.feature('proc')`, `container.feature('vm')`, etc.)

---

### Clients (`src/clients/`, `src/web/clients/`)

#### `comfyui/index.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 531 | `const { mkdir } = await import("fs/promises")` | `this.container.fs.ensureFolder()` | HIGH |
| 532 | `const { join } = await import("path")` | `this.container.paths.join()` | MEDIUM |
| 533 | `await mkdir(options.outputDir, { recursive: true })` | `this.container.fs.ensureFolder()` | HIGH |
| 537 | `const localPath = join(...)` | `this.container.paths.join()` | MEDIUM |
| 538 | `await Bun.write(localPath, buf)` — unguarded | `this.container.fs.writeFileAsync()` | HIGH |

All 5 violations are in the `runWorkflow` method (lines 530-541).

#### `openai/index.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 76 | `process.env.OPENAI_API_KEY` | Container env (already declares `static envVars`) | MEDIUM |

#### `elevenlabs/index.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 100 | `process.env.ELEVENLABS_API_KEY` | Container env (already declares `static envVars`) | MEDIUM |

#### Clean Client Files

- `civitai/index.ts` — Exemplary (uses `container.fs`, `container.paths`, `container.feature("downloader")`)
- `supabase/index.ts` — Clean
- `client-template.ts` — Clean
- `web/clients/socket.ts` — Clean

---

### Servers (`src/servers/`)

#### `express.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 123 | `new Bun.Glob('**/*.ts')` — unguarded | Container glob/fs.walk or guard with `isBun` | HIGH |

The entire `useEndpoints` method (lines 123-146) depends on `Bun.Glob`.

#### `mcp.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 440 | `const { randomUUID } = await import('node:crypto')` | `crypto.randomUUID()` (global Web Crypto) or `this.container.utils.uuid()` | MEDIUM |

#### Clean Server Files

- `socket.ts` — Clean

---

### Commands (`src/commands/`)

#### `prompt.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 250 | `await Bun.write(resolvedPath, updated)` — unguarded | `container.fs.writeFileAsync()` (already destructures `fs` on line 205!) | HIGH |
| 256 | `await Bun.write(outPath, markdown)` — unguarded | `container.fs.writeFileAsync()` | HIGH |
| 85, 88, 118, 147-179 | Extensive `process.stdout.write()` for streaming | Container `ui` feature | MEDIUM |

Inconsistent — lines 205+ use `container.fs` properly, but lines 250/256 use `Bun.write`.

#### `chat.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 2 | `import * as readline from 'readline'` | Container `repl` feature or `ui.askQuestion()` | HIGH |
| 94-97 | `readline.createInterface({ input: process.stdin, output: process.stdout })` | Container input abstraction | HIGH |
| 68-69, 76, 81, 86, 90 | `process.stdout.write(...)` | Container `ui` feature | MEDIUM |

The `console` command demonstrates the correct pattern using `container.feature('repl')`.

#### `console.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 67 | `Bun` injected into REPL context without guard | Guard with `container.isBun` | MEDIUM |

#### `sandbox-mcp.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 42 | `Bun` injected into VM context without guard | Guard with `container.isBun` | MEDIUM |

#### `run.ts`

| Line(s) | Violation | Should Use | Severity |
|---------|-----------|-----------|----------|
| 218 | `Bun` injected into REPL context without guard | Guard with `container.isBun` | MEDIUM |

#### Clean Command Files

- `eval.ts` — Clean
- `describe.ts` — Exemplary
- `help.ts` — Clean
- `index.ts` — Clean (barrel file)
- `serve.ts` — Clean (uses container throughout)
- `mcp.ts` — Clean

---

## Recurring Patterns

### 1. `process.env` for API Keys (MEDIUM, 10+ files)
Many features/clients declare `static envVars = [...]` but then read `process.env.KEY` directly in getters. The container should mediate this. Affected: `google-auth.ts`, `tts.ts`, `runpod.ts`, `telegram.ts`, `openai/index.ts`, `elevenlabs/index.ts`.

### 2. Unguarded `Bun.spawn` (HIGH, 5 files)
`claude-code.ts`, `openai-codex.ts`, `process-manager.ts` all call `Bun.spawn` without checking `container.isBun`. These need either proc feature usage or runtime guards.

### 3. Unguarded `Bun.write` (HIGH, 3 files)
`prompt.ts`, `claude-code.ts`, `comfyui/index.ts` use `Bun.write` when `container.fs.writeFileAsync()` is available.

### 4. Module-level `homedir()`/`join()` (HIGH, 2 files)
`launcher-app-command-listener.ts` and `window-manager.ts` compute paths at import time using `os.homedir()` and `path.join()`, before any container exists. These must be deferred to `enable()` or computed lazily.

### 5. Third-party HTTP imports (HIGH, 2 files)
`downloader.ts` imports `cross-fetch` and `runpod.ts` imports `axios` when global `fetch` and `container.client('rest')` are available.

### 6. Unguarded `Bun.Glob` (HIGH, 2 files)
`helpers.ts` and `express.ts` use `Bun.Glob` without runtime guards. The container's fs feature provides glob/walk capabilities.

---

## Recommended Fix Priority

### Priority 1 — Bugs
- [ ] `repl.ts` — Fix missing `fs` import (lines 92, 192). Use `this.container.fs` instead.

### Priority 2 — Bun-only code (breaks Node compatibility)
- [ ] `claude-code.ts` — Replace `Bun.spawn` with proc feature or add `isBun` guards
- [ ] `openai-codex.ts` — Same pattern as claude-code
- [ ] `process-manager.ts` — Replace `Bun.spawn` with proc feature or guard
- [ ] `google-auth.ts` — Replace `Bun.serve` with guard or container server
- [ ] `express.ts` — Replace `Bun.Glob` with container glob or guard
- [ ] `helpers.ts` — Replace `Bun.Glob` with container glob or guard
- [ ] `prompt.ts` — Replace `Bun.write` with `container.fs.writeFileAsync`
- [ ] `comfyui/index.ts` — Replace `Bun.write` + dynamic imports with container equivalents

### Priority 3 — Direct builtin imports (bypasses container)
- [ ] `skills-library.ts` — Replace all `path`, `os`, `fs/promises` with container equivalents
- [ ] `package-finder.ts` — Complete migration to container fs/paths
- [ ] `python.ts` — Replace `existsSync`/`join` with container equivalents
- [ ] `launcher-app-command-listener.ts` — Replace fs/path/os with container, defer module-level computations
- [ ] `window-manager.ts` — Same as launcher-app
- [ ] `downloader.ts` — Remove `cross-fetch`, use global `fetch`
- [ ] `runpod.ts` — Remove `axios`, use global `fetch` or container REST client
- [ ] `chat.ts` — Replace `readline` with container `repl` feature

### Priority 4 — `process.env` standardization
- [ ] Create or document a standard pattern for env var access across features/clients
- [ ] Update `google-auth.ts`, `tts.ts`, `runpod.ts`, `telegram.ts`, `openai/index.ts`, `elevenlabs/index.ts`

### Priority 5 — Minor guards
- [ ] `console.ts`, `sandbox-mcp.ts`, `run.ts` — Guard `Bun` global injection with `container.isBun`
- [ ] `tmux.ts` — Replace `execSync` dynamic import with `container.feature('proc')`
