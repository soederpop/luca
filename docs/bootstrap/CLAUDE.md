# Luca Project

This project uses the [Luca framework](https://github.com/soederpop/luca) — Lightweight Universal Conversational Architecture.

For a deep dive into the framework internals, see the [Luca GitHub repository](https://github.com/soederpop/luca).

## Runtime

The runtime is **bun**. Use `bun run` for scripts, `bun test` for tests.

## The `luca` CLI

The `luca` binary is available in the path. Key commands:

- `luca` — list available commands (built-in + project commands)
- `luca eval "expression"` — evaluate JS with the container in scope
- `luca describe <name>` — full docs for any feature, client, or server (e.g. `luca describe fs`)
- `luca describe <name>.<member>` — docs for a specific method or getter (e.g. `luca describe ui.banner`, `luca describe fs.readFile`)
- `luca describe features` — index of all available features (also: `clients`, `servers`)
- `luca serve` — start a local server using `endpoints/` folder
- `luca run script.ts` — run a script with the container
- `luca scaffold <type> <name>` — generate boilerplate for a new helper (run `luca scaffold` for full help)

## Container Rules

- **NEVER import from `fs`, `path`, or other Node builtins.** Use `container.feature('fs')` for file operations, `container.paths` for path operations.
- The container should provide everything you need. If something is missing, raise the concern rather than pulling in external dependencies.
- Use `container.utils` for common utilities (uuid, lodash helpers, string utils).

## Learning the Framework

1. **Discover** — Run `luca describe features`, `luca describe clients`, `luca describe servers` to see what's available. Then `luca describe <name>` for full docs on any helper (including per-method examples), or `luca describe <name>.<member>` to drill into a specific method or getter. This is your first move, always. (See `.claude/skills/luca-framework/SKILL.md` for the full mental model.)
2. **Build** — Check `.claude/skills/luca-framework/references/examples/` first: runnable multi-helper composition patterns (`luca run <doc.md>` executes one) — a working example beats fifty describes. Then `luca scaffold <type> --tutorial` before creating a new helper; it covers the full guide for that type.
3. **Prototype** — Use `luca eval "expression"` to test container code before wiring up full handlers. Reach for eval when you're stuck — it gives you full runtime access.
4. **Reference** — The skill file (`.claude/skills/luca-framework/SKILL.md`) includes a full Framework Index with every feature, client, and server organized by category, plus a task-to-example routing table. `references/tutorials/` holds the long-form guides.

## Project Structure

- `commands/` — custom CLI commands, run via `luca <commandName>` (auto-discovered)
- `endpoints/` — file-based HTTP routes, served via `luca serve` (auto-discovered)
- `features/`, `clients/`, `servers/` — custom container helpers. **NOT auto-discovered** — add `await container.helpers.discoverAll()` to `luca.cli.ts` `main()` so every entry point registers them. (`luca eval` discovers them on its own, which can mislead: works in eval ≠ registered in your command.)
- `docs/` — content documents managed by the `contentDb` feature (`container.docs`). See [contentbase](https://github.com/soederpop/contentbase) for the document model system.
- `luca.cli.ts` — optional project-level CLI customization (runs before any command)

## Command Arguments

Command handlers receive `(options, context)`. The `options` object contains:
- **Named flags** from `argsSchema`: `--verbose` → `options.verbose`
- **Positional args** mapped via `positionals` export: `luca cmd ./src` → `options.target`
- **Raw positionals** in `options._`: array where `_[0]` is the command name, `_[1+]` are positional args

To accept positional arguments, export a `positionals` array that maps them to named fields in `argsSchema`:

```ts
export const positionals = ['target']  // luca myCmd ./src => options.target === './src'
export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})
```

## Command Help

`luca <cmd> --help` is generated from what the command declares — make it teach:
- **`.describe()` every argsSchema field** — powers the Options/Flags listing.
- **`positionals`** render as an `Arguments:` section (described via the matching schema field, or use the object form `{ name, description, required }` when there is no schema field).
- **`export const examples = [...]`** — strings or `{ command, description }` objects, rendered as an `Examples:` section.
- **`export const subcommands = { verb: { args: '<name>', description, examples } }`** — renders a `Subcommands:` section, and `luca <cmd> <verb> --help` shows focused help for that verb. Dispatch is still yours: map the verb via `positionals` and branch on it in the handler.

## What's Available

The container provides more than you might expect. Before importing anything external, check here:

- **YAML** — `container.feature('yaml')` wraps `js-yaml`. Use `.parse(str)` and `.stringify(obj)`.
- **SQLite** — `container.feature('sqlite')` for databases. Parameterized queries, tagged templates.
- **Cross-process state** — `container.store('name', { schema })` opens a durable JSON document in `.luca/store/` shared by all luca processes. `await store.update(s => { s.count++ })` is a locked read-modify-write (concurrent commands can't lose each other's writes); `read()` always re-reads. `luca describe store` for the full guide.
- **REST client** — `container.client('rest', { baseURL })`. Methods (`get`, `post`, etc.) return **parsed JSON directly**, not `{ data, status, headers }`. On HTTP errors, the error is returned (not thrown).
- **Content DB** — `container.docs` (alias for `container.feature('contentDb')`) manages markdown documents with frontmatter. Query with `docs.query(docs.models.MyModel).fetchAll()`.
- **Grep** — `container.feature('grep')` has `search()` and `todos()` for finding TODOs/FIXMEs/etc.
- **chalk** — available as `container.feature('ui').colors`, not via `import('chalk')`.
- **figlet** — available as `container.feature('ui').asciiArt(text)`.
- **uuid** — `container.utils.uuid()`
- **Scheduler** — `container.feature('scheduler')` for named recurring tasks: `every('5m', fn)`, `cron('0 9 * * mon-fri', fn)`, one-shots via `at()`/`in()`, and `run()` for the daemon lifecycle (holds the process open, stops all tasks on SIGINT/SIGTERM). Inspect `scheduler.tasks` for run counts and errors.
- **timing** — `container.utils.sleep(ms)`, `container.utils.backoff(fn, { attempts, delay })` (retry with exponential backoff), `container.utils.every(ms, fn)` (bare poll loop with no overlapping runs; returns `stop()`).
- **lodash** — `container.utils.lodash`. Exactly these: `uniq`, `uniqBy`, `keyBy`, `groupBy`, `debounce`, `throttle`, `mapValues`, `mapKeys`, `pick`, `get`, `set`, `omit`. Nothing else (no `sortBy`, `orderBy`, `chunk`, …) — use native array methods for the rest.
- **string utils** — `container.utils.stringUtils`. Exactly these: `camelCase`, `kebabCase`, `upperFirst`, `lowerFirst`, `pluralize`, `singularize`.

## Known Gotchas

- **For DELETE endpoint handlers, use `export { del as delete }`** — `delete` is a JS reserved word. Define your function with any name, then re-export it as `delete`.
- **Bun globals (`Bun.spawn`, `Bun.serve`) are unavailable** in command/endpoint handlers. Use Node's `child_process` for spawning processes, or use `container.feature('proc').exec()`.
- **`ui.print.*` writes to stdout** — if your command supports `--json`, gate UI output behind `if (!options.json)`.
- **`ui.print.<color>()` is not a string formatter** — it prints immediately and returns `undefined`, so `` `${ui.print.green('OK')}` `` interpolates `undefined`. To compose colored strings, use `ui.colors.<color>()`, which returns the styled string. (`ui.print` mirrors every chalk color/style name that `ui.colors` has — but it always prints.)
- **Checking whether a PID is alive**: `proc.kill(pid, 0)` sends nothing and returns `false` if the process is gone (it doesn't throw) — the standard liveness check for PIDs persisted from an earlier run.
- **VM contexts start near-empty — and command/endpoint handlers run in that same VM.** JS built-ins (`Promise`, `Date`, `Math`, `JSON`) plus `console`, timers, `process`, `Buffer`, `fetch`, `crypto`, and `TextEncoder`/`TextDecoder` are provided; when you build your own context with `container.feature('vm')`, inject anything beyond that explicitly. zod is always importable (`import { z } from 'zod'`) — export schemas unconditionally. In `luca eval`, `z` and `require` are already in scope — prototype schemas directly.
- **Long-running commands** (servers, watchers) must hold the process open. The easy path is `await container.feature('scheduler').run()` — it blocks until SIGINT/SIGTERM, then stops all scheduled tasks and runs your `onShutdown` hook. The manual idiom is `await new Promise(() => {})` plus a `process.on('SIGINT', ...)` cleanup handler.
- **Shared state between endpoints**: use `ctx.request.app.locals` to share data across endpoint files.
- **Database init**: use `luca.cli.ts` `main()` hook for table creation and seeding — it runs before any command or server starts.
- **Which store for cross-process state?** Every `luca <command>` is a separate process — never keep shared state in memory. In-process/ephemeral → `container.state`; **cross-process state → `container.store(name)`** (durable JSON document; `update(fn)` is a locked read-modify-write, so concurrent siblings can't clobber each other — never hand-roll a state dotfile); caches with TTL → `diskCache` (entries are losable by contract — not for state); queryable/relational/durable queues → `sqlite` (use `transaction()` and `UPDATE … RETURNING` for atomic job claims); cross-process pub/sub → `redis`.
- **Scheduling**: `container.feature('scheduler')` is the managed layer (named tasks, cron, run history, daemon `run()`); `container.utils.every(ms, fn)` / `sleep(ms)` / `backoff(fn, opts)` are the bare primitives when you don't need names or lifecycle. Neither ever overlaps runs of the same task.
- **`paths.join()` prepends `container.cwd` even when the first arg is absolute** — use `paths.resolve(absPath, 'sub')` when the base is already absolute (e.g. `os.tmpdir`); `resolve` behaves like Node's.
- **Colors silently disappear when stdout isn't a real TTY** — chalk auto-disables in pipes and sandboxed shells; this is not a bug in your command. Verify with `FORCE_COLOR=1 luca yourCmd | cat -v`.
- **`useInput` requires a TTY** (`setRawMode`) and crashes on piped stdin — guard with `process.stdin.isTTY` and fall back to `process.on('SIGINT', ...)`.
- **ink/react must be single-instance.** `import React from 'react'` and `import { Text, useInput } from 'ink'` in commands resolve to the runtime's own copies — use them freely alongside `ink.components`/`ink.hooks`/`ink.render`. Never add react or ink to a local `node_modules`: a second React copy breaks every hook ("Invalid hook call", `isRawModeSupported === undefined`).
- **`fileManager.watch` emits `file:change` before its own bookkeeping** — a handler that moves or deletes the file crashes the watcher's internal `statSync`; defer mutating work (`setTimeout(() => processFile(e.path), 100)`). Watching is recursive by default — filter by directory in your handler.
- **`docs.models` showing only `["Base"]`** means `docs/models.ts` failed to load *silently* — run `bun docs/models.ts` to see the real error (often package resolution).
- **Registry names are camelCase, files are kebab-case** (`cipherSocial` ↔ `cipher-social.ts`). Don't guess short names; when `luca describe` fails, its "Available:" list is authoritative.
- **Server options belong in the constructor** — `container.server('websocket', { port: 8099, json: true })`, then `start()`. If a server "isn't responding," verify the port it *actually* bound before debugging the client.
- **Builds can lie** — `bun build --compile` can exit 0 without writing the binary. Check the artifact exists on disk before reporting success.
- **Don't scaffold a custom client when a built-in speaks the protocol** (websocket, rest) — use it directly with your message conventions on top. If you do write one: `afterInitialize()` fires but is **not awaited** — do synchronous setup there and put connection work behind an explicit `connect()`.

## Extending the Container

Use `luca scaffold` to generate new helpers:

```sh
luca scaffold command myTask --description "Automate something"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint users --description "User management API"
```

Run `luca scaffold` with no arguments for full usage and examples.

## Assistants

`luca scaffold assistant <name>` creates `assistants/<name>/` — an assistant is just that folder:

- `CORE.md` — injected into the system prompt
- `tools.ts` — exports a `schemas` object (zod v4, keys = tool names) plus a matching exported function per key. The luca `container` is available as a **global** in tools.ts and hooks.ts (add `declare const container: any` for your editor).
- `hooks.ts` — exported functions named after assistant lifecycle events

At runtime `assistant.tools.<name>` is `{ handler, parameters, description }` — call `assistant.tools.myTool.handler({...})`, not `assistant.tools.myTool()`. Check what's registered with `container.feature('assistantsManager').availableAssistants`. Chat interactively with `luca chat <name>`.

## Shipping a Binary

`luca bundle <name>` compiles the whole project — features, commands, endpoints, and every `assistants/` folder with a CORE.md — into a standalone consumer binary at `dist/<name>-<platform>`:

```sh
luca bundle fortune                          # darwin-arm64 by default
luca bundle fortune --targets darwin-arm64,linux-x64
luca bundle fortune --builtins eval,describe # opt in to luca built-ins
```

- **Built-in luca commands are opt-in** via `--builtins` (only `run` is always included, and bundling assistants implies `chat` + `assistant`). If you skip `eval`/`describe`, the binary can't be introspected — you'd have to rebuild.
- **Verify from the binary itself**, not just the dev CLI:
  ```sh
  ./dist/<name>-<platform> <yourCommand>
  ./dist/<name>-<platform> run scripts/smoke.ts
  ./dist/<name>-<platform> eval "container.feature('assistantsManager').availableAssistants"   # needs --builtins eval
  ```
- Bundled assistants are embedded in the binary and materialized to `~/.luca/bundles/<name>/assistants` on first run — edits to your `assistants/` folder don't reach an already-built binary; rebundle.

## Git Strategy

Roll on main. Commit with good messages that explain why, not just what.
