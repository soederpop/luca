# Runtime conventions

Read the section relevant to your task: discovery/plugins, command arguments/help, available utilities, or VM/terminal contracts. For process lifetime and durable worker records see [process lifecycle](tutorials/28-process-lifecycle.md).

### How Auto-Discovery Works

The CLI discovers **all** project helper folders before dispatching a command — `features/`, `clients/`, `servers/`, `commands/`, `endpoints/`, `selectors/` — so `container.feature('myThing')` works inside any command without extra wiring. `~/.luca/{features,clients,servers,commands}` (user-level helpers) are discovered on every CLI run too.

Discovery registers endpoint modules; `luca serve` mounts their routes when the server starts. `luca eval` also performs discovery internally.

Opt-outs via the `LUCA_COMMAND_DISCOVERY` env var: `commands-only` (only discover `commands/`, the pre-auto-discovery behavior), `no-local` (skip the project), `no-home` (skip `~/.luca`), `disable` (skip both). These flags govern discovery; they do not suppress global/project CLI startup hooks or environment-configured plugins.

**Non-CLI entry points** (embedding the container in your own script or service) don't get this for free — discover explicitly:

```js
await container.helpers.discoverAll()                               // everything
await container.helpers.discover('features')                        // one type
await container.helpers.discover('commands', { directory: dir })    // from a custom folder (plugins)
```

### Plugins

Any folder with the standard project layout (`features/`, `commands/`, `endpoints/`, ...) can be loaded as a plugin. Drop (or symlink) it into `~/.luca/plugins/<name>`, then either:

```sh
# .env — the CLI loads these automatically before your luca.cli.ts runs
LUCA_PLUGINS=my-plugin,other-plugin
```

```js
await container.helpers.usePlugin('my-plugin')   // by name (~/.luca/plugins) or path
container.use('my-plugin'); await container.start()  // sync call sites — start() awaits plugin loads
```

If the plugin has a `luca.plugin.ts` (or `plugin.ts`) entry, its `attach(container, { pluginDir })` export runs after discovery — the hook for assets beyond the standard folders (assistants, workflows, contexts).


## Command Arguments

Command handlers receive `(options, context)`. The `options` object contains:
- **Named flags** from `argsSchema`: `--verbose` → `options.verbose`
- **Positional args** mapped via `positionals` export: `luca cmd ./src` → `options.target`
- **Raw positionals** in `options._`: array where `_[0]` is the command name, `_[1+]` are positional args. Type the handler's options as `CommandArgs<typeof argsSchema>` (from `'luca'`) to get `_` typed.

To accept positional arguments, export a `positionals` array that maps them to named fields in `argsSchema`:

```ts
export const positionals = ['target']  // luca myCmd ./src => options.target === './src'
export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})
```

A trailing `'...rest'` positional (or a trailing `z.array(...)` field) collects all remaining args as an array: `positionals = ['action', '...files']`.

Parsing agrees with the schema — boolean flags never consume a following positional (`luca cmd --json foo` keeps `foo` positional), and positionals arrive as strings coerced to what the field expects (`z.string()` accepts `8080`, `z.number()` accepts `'8080'` — no `z.union` workarounds needed).

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

## Runtime and terminal contracts

- **For DELETE endpoint handlers, use `export { del as delete }`** — `delete` is a JS reserved word. Define your function with any name, then re-export it as `delete`.
- **Bun globals (`Bun.spawn`, `Bun.serve`) are unavailable** in command/endpoint handlers. Use `container.feature('proc')` for spawning processes.
- **`ui.print.*` writes to stdout** — if your command supports `--json`, gate UI output behind `if (!options.json)`.
- **`ui.print.<color>()` is not a string formatter** — it prints immediately and returns `undefined`, so `` `${ui.print.green('OK')}` `` interpolates `undefined`. To compose colored strings, use `ui.colors.<color>()`, which returns the styled string. (`ui.print` mirrors every chalk color/style name that `ui.colors` has — but it always prints.)
- **Checking whether a PID is alive**: `proc.kill(pid, 0)` sends nothing and returns `false` if the process is gone (it doesn't throw) — the standard liveness check for PIDs persisted from an earlier run.
- **VM contexts start near-empty — and command/endpoint handlers run in that same VM.** JS built-ins (`Promise`, `Date`, `Math`, `JSON`) plus `console`, timers, `process`, `Buffer`, `fetch`, `crypto`, and `TextEncoder`/`TextDecoder` are provided; when you build your own context with `container.feature('vm')`, inject anything beyond that explicitly. zod is always importable (`import { z } from 'zod'`) — export schemas unconditionally. In `luca eval`, `z` and `require` are already in scope — prototype schemas directly.
- **Long-running commands** (servers, watchers) end with `await context.runUntilShutdown(async () => { /* cleanup */ })` — it holds the process open, wires SIGINT/SIGTERM, runs the cleanup (5s guard, second Ctrl-C exits immediately), and exits 0. Also on the container (`container.runUntilShutdown`) for `luca run` scripts. For recurring tasks, `await container.feature('scheduler').run({ onShutdown })` layers named intervals/cron on the same lifecycle.
- **Shared state between endpoints**: use `ctx.request.app.locals` to share data across endpoint files.
- **Database init**: use `luca.cli.ts` `main()` hook for table creation and seeding — it runs before any command or server starts.
- **`paths.join()` prepends `container.cwd` even when the first arg is absolute** — use `paths.resolve(absPath, 'sub')` when the base is already absolute (e.g. `os.tmpdir`); `resolve` behaves like Node's.
- **Colors silently disappear when stdout isn't a real TTY** — chalk auto-disables in pipes and sandboxed shells; this is not a bug in your command. Verify with `FORCE_COLOR=1 luca yourCmd | cat -v`.
- **`useInput` requires a TTY** (`setRawMode`) and crashes on piped stdin — guard with `process.stdin.isTTY` and fall back to `process.on('SIGINT', ...)`.
- **ink/react must be single-instance.** `import React from 'react'` and `import { Text, useInput } from 'ink'` in commands resolve to the runtime's own copies — use them freely alongside `ink.components`/`ink.hooks`/`ink.render`. Never add react or ink to a local `node_modules`: a second React copy breaks every hook ("Invalid hook call", `isRawModeSupported === undefined`).
- **Registry names are camelCase, files are kebab-case** (`cipherSocial` ↔ `cipher-social.ts`). Don't guess short names; when `luca describe` fails, its "Available:" list is authoritative.
- **Server options belong in the constructor** — `container.server('websocket', { port: 8099, json: true })`, then `start()`. If a server "isn't responding," verify the port it *actually* bound before debugging the client.
- **Don't scaffold a custom client when a built-in speaks the protocol** (websocket, rest) — use it directly with your message conventions on top. If you do write one: `afterInitialize()` fires but is **not awaited** — do synchronous setup there and put connection work behind an explicit `connect()`.
- **Markdown code blocks and eval modes**: `luca run doc.md` executes `ts`/`js`/`tsx`/`jsx` fences by default; `luca prompt` does NOT — blocks ship to the agent as literal source unless the doc declares `evalMode: all` (or `optIn`, which runs only ` ```ts eval ` fences) in frontmatter, or the caller passes `--eval-mode`. ` ```ts skip ` opts a block out in any mode (exact word in the fence meta). Prompts that gather live context via code blocks need the opt-in.


## Secrets across invocations

`vault.secret()` creates a random key when no secret was configured. For decryption in another process, supply the same securely stored key through the vault options. Do not write encryption keys into committed state documents. Inspect `luca describe vault --options` before configuring it.
