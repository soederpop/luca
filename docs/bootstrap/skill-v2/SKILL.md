---
name: Using the luca framework
description: The Luca framework. Use this skill when a project has luca.cli.ts, commands/, features/, or endpoints/ folders, when luca appears in package.json, when the user asks you to build or debug anything in a Luca project — and BEFORE you add any npm dependency, import node:fs/node:path, or declare that a capability doesn't exist in such a project. The luca CLI is self-describing; this skill teaches you how to ask it instead of guessing.
---

# Luca: Ask the Container

Luca is a dependency-injection container framework. One `container` singleton provides everything — files, processes, databases, HTTP, terminal UI, AI assistants — as **helpers** (features, clients, servers) that carry their own documentation. The `luca` binary can print full docs for any helper, run live code against the container, and generate correct boilerplate.

This changes how you should work. In a normal codebase you read source to learn APIs. Here, **reading source is the fallback, not the first move** — the binary's introspection data is the ground truth (source for built-in helpers may not even exist in the project). The models that succeed with Luca all work the same loop; the ones that struggle all skip it.

## The Loop: Ask → Try → Build → Prove

Every task, no matter the size, goes through these four moves:

### 1. Ask — `luca describe`

```shell
luca describe features          # what exists (also: clients, servers)
luca describe fs                # everything about one helper
luca describe fs.readFile       # one method: params, return type, examples
luca describe fs --ts           # approximate TypeScript interface (~95% accurate)
luca describe express --options # just constructor options
luca describe fileManager --events   # just events
```

**Discipline check** — you are about to break the loop if you catch yourself:
- Running `find`/`grep` over `src/` to learn what a helper does → describe it instead.
- Typing a method name you haven't seen in describe output → describe it first.
- Writing "luca doesn't have X, so I'll build/install it" → run `luca` and `luca describe features clients servers` first. A real session designed a whole new MCP feature that already existed as `luca mcp`.

### 2. Try — `luca eval`

Prove your understanding on the live container *before* writing files:

```shell
luca eval "container.feature('fs').readFile('package.json')"
luca eval "fs.readFile('package.json')"        # core helpers are pre-bound
luca eval "Object.keys(container.docs.models)" # verify assumptions cheaply
```

Eval is also your **test harness**: logic that works in eval will work in a handler — the handler is just plumbing. And it's your **debugger**: `luca eval "container.feature('x').method.toString()"` shows the live implementation when docs aren't enough.

Eval limits (see `references/runtime-envelope.md`): no npm imports, no project-file imports — inline everything. A trailing `undefined` after your console output is just the expression's return value.

### 3. Build — examples first, then `luca scaffold`

**Before writing anything, check `references/recipes.md` and `references/examples/` for your task.** A runnable example beats fifty describes — run it with `luca run` to confirm it works, then adapt it. In a measured A/B, the fastest websocket solution came from finding and running the shipped ask/reply example; the slowest came from scaffolding a custom client from scratch.

```shell
luca scaffold command --tutorial     # the authoritative guide per type
luca scaffold command sync --description "Pull data from staging"
```

Types: `feature`, `command`, `endpoint`, `client`, `server`. The tutorial covers imports, schemas, registration, and complete examples. Never hand-write a helper from memory when a scaffold exists — but also don't scaffold what you don't need: **if a built-in client/server already speaks the protocol (websocket, rest), use it directly with your message conventions on top.** Scaffold a custom client only to wrap an external service the container doesn't cover.

### 4. Prove — verify like a skeptic

- `luca describe <yourNewHelper>` — confirms registration and that your descriptions read correctly.
- Prototype-tested logic (step 2) + a real invocation of the finished thing.
- **Long-running commands (servers, watchers) need the background-task pattern** — never `timeout`/`gtimeout` (sandbox-blocked; models have failed 8 times in a row on these). Full playbook: `references/testing-and-debugging.md`.
- **Check outputs exist.** Builds can exit 0 without writing anything. An empty-string result, `{}` state, or missing model is a silent failure to investigate, not an answer to accept.

---

## Decision Table

| You want to... | Do this |
|---|---|
| Know if a capability exists | `luca` + `luca describe features clients servers` |
| Learn a helper's API | `luca describe <name>`, drill with `<name>.<member>` |
| Get types for code | `luca describe <name> --ts` |
| Verify behavior / debug | `luca eval "…"` (or `luca console` for a REPL session) |
| Create a new helper | `luca scaffold <type> --tutorial`, then `luca scaffold <type> <name>` |
| Run a script with the container | `luca run script.ts` (self-contained — no relative static imports) |
| Serve `endpoints/` | `luca serve` (`--force` to evict a stale process, `--any-port`) |
| Free a squatted port | `luca eval "proc.findPidsByPort(3000)"` → `luca eval "proc.kill(<pid>)"` |
| Common pattern (watcher, API, dashboard…) | `references/recipes.md` before writing from scratch |

## Lessons From Real Sessions — wrong vs right

These are actual failures from session transcripts. Learn the shape, not just the instance:

**Guessing property names.**
✗ `docs.path` → undefined; `docs._path` → undefined; `docs.modelsPath` → undefined; reflection via `Object.getOwnPropertyNames`... (4 round-trips)
✓ `luca describe contentDb` → it's `collectionPath` (1 round-trip)

**Declaring capabilities missing.**
✗ "The bridge goes the wrong direction — we need to build a new `mcpHost` feature" (wrong architecture proposed, user had to correct)
✓ `luca` → command list includes `luca mcp` → read `luca help mcp`

**Trusting a claimed success.**
✗ `server.start(…)` prints "listening", client can't connect → hours debugging the client
✓ Options belong in the **constructor** (`container.server('websocket', { port: 8099, json: true })`); confirm the *bound* port before touching the client

**Fighting the sandbox to test a watcher.**
✗ `timeout 5 luca watch` / `gtimeout` / `perl -e 'alarm'` — 8 consecutive failures
✓ Test the processing logic in `luca eval`; run the live watch as a background task and read its output file

**Escaping to npm.**
✗ `bun add xlsx` + `import fs from 'node:fs'` to convert spreadsheets (user rejected it)
✓ `luca describe features | grep -i sheet` → `googleSheets.saveAsCsv` already existed

**Papering over a missing API.**
✗ `new Document({ collection: null as any })` — `as any` hides the gap, breaks later
✓ Raise the constraint: "the container doesn't cover X, should we add it?" That is the designed escalation path.

## The Debugging Ladder

Work bottom-up; each rung is one command, not a grep session:

1. **`X is not a function` / `undefined is not an object`** → you guessed an API. `luca describe <helper>.<method>`.
2. **`"name" was not found in any registry`** → the error prints an "Available:" list — read it. Registry names are camelCase (`cipherSocial`); files are kebab-case (`cipher-social.ts`).
3. **Opaque import failure in eval/run** → run the file with plain `bun` to see the real resolution error.
4. **Empty result where data was expected** → silent failure. Probe layer by layer with `luca eval`, innermost first. (Known ones: `docs.models` showing only `["Base"]` = models.ts failed to load, run `bun docs/models.ts`; assistant `.ask()` returning `""` = transport swallowed an error.)
5. **Server/port weirdness** → stale process. `luca serve --force`, or `proc.findPidsByPort` + `proc.kill`.
6. **Docs and reality disagree** → `luca eval "helper.method.toString()"` reads the live code; trust behavior > `state` values (state is not always hydrated) > docs.

## Reference Material

- `references/testing-and-debugging.md` — the full verification playbook: eval-as-test-harness, background tasks, port hygiene, silent-failure catalog
- `references/recipes.md` — complete, tested shapes for the tasks models attempt most: commands, REST API + client roundtrip, websocket roundtrip, file watcher, persistence between runs, shared endpoint context
- `references/gotchas.md` — every known trap with the wrong→right pair (`fs.readFile` encoding, `execAndCapture` splitting, watch event ordering, rest client semantics, …)
- `references/runtime-envelope.md` — what can import what, where the container exists, process lifetime rules (`'luca'` vs `'luca/agi'`, eval/run/bun matrix)
- `references/examples/` and `references/tutorials/` — per-feature examples and long-form guides (when present, copied by bootstrap)

## Container Primitives (30-second model)

```js
const fs = container.feature('fs')          // features: local capabilities
const rest = container.client('rest', {baseURL}) // clients: talk to external services
const server = container.server('express')  // servers: accept connections
```

- Every helper + the container are **event emitters** (`on`, `once`, `emit`, `waitFor`) with **observable state** (`helper.state.current`, `.get/.set`, `.observe(cb)`).
- `container.utils` — `uuid()`, `hashObject()`, `lodash` (groupBy, keyBy, pick…), `stringUtils` (camelCase, pluralize…).
- `container.paths` — `resolve()` respects absolute paths; `join()` **always prepends cwd**, even for absolute args.
- `container.docs` — the contentDb feature: markdown documents with frontmatter models.
- Introspection is programmatic too: `container.features.describe('fs')`, `feature.introspect()`.
- Runnable markdown: `luca run doc.md` executes its code blocks in the VM — a great deliverable for prototypes and how-tos.

Everything else: `luca describe <name>`. That command is the whole point of the framework — use it liberally.
