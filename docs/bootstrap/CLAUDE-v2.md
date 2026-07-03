# Luca Project

This project uses the [Luca framework](https://github.com/soederpop/luca) — Lightweight Universal Conversational Architecture. The runtime is **bun** (`bun run`, `bun test` — never vitest).

Luca gives you a `container`: a singleton that provides every dependency you need — file system, processes, databases, HTTP, AI assistants — as self-describing helpers. The container can tell you what it can do. **Your job is to ask it, not to guess.**

## First Moves — read this before anything else

Almost every failed session follows the same script: the model guesses an API name, gets `undefined is not a function`, greps source files, guesses again. The fix is mechanical. Match your situation to the command:

| Situation | Run this — before anything else |
|---|---|
| "Does luca have X?" / "I don't think luca can..." | `luca` (lists all commands) then `luca describe features` (also: `clients`, `servers`) |
| "How does helper X work?" | `luca describe X` (e.g. `luca describe fs`) |
| "What does method X.y take / return?" | `luca describe X.y` (e.g. `luca describe fs.readFile`) |
| "Will this code actually work?" | `luca eval "…"` — run it against the live container |
| "I need to build a new command/feature/endpoint" | `luca scaffold <type> --tutorial` first, then `luca scaffold <type> <name>` |
| "Why is this behaving strangely?" | `luca eval` to probe the live instance; `luca eval "container.feature('x').someMethod.toString()"` to read the real implementation |

**Two rules with no exceptions:**

1. **Never declare a capability missing until you have run `luca` and `luca describe features clients servers`.** A real session proposed building a whole new MCP feature from scratch; `luca mcp` already existed and one command would have shown it.
2. **Never call a method you haven't seen in `luca describe` output.** A real session burned four round-trips guessing `docs.path`, `docs._path`, `docs.modelsPath` — the answer (`collectionPath`) was one `luca describe contentDb` away.

## Hard Rules

- **NEVER import `fs`, `path`, or other Node builtins.** Use `container.feature('fs')` and `container.paths`. This applies to every script you write inside this project, including "one-off" helper scripts.
- **NEVER `bun add` / `npm install` a package without asking first.** The container almost certainly already covers it (see What's Available below). If it truly doesn't, raise the gap instead of installing.
- **Tests are `bun:test` only.** Even if a `package.json` here or in a sibling repo says `vitest` — that is stale; do not "fix" tests by converting them to vitest.
- **Verify outputs exist.** `bun build --compile` can exit 0 without writing a binary. After any build/generate step, check the file is on disk before reporting success.
- **Treat empty results as failures to investigate.** An empty string from an assistant call, `{}` from state, `["Base"]` from `docs.models` — these are silent failures, not answers. Probe with `luca eval` before building on them.

## The `luca` CLI

- `luca` — list all commands (built-in + this project's `commands/`)
- `luca describe <name>` — full docs for any feature/client/server; `luca describe <name>.<member>` for one method; flags: `--methods`, `--events`, `--options`, `--examples`, `--ts`
- `luca eval "expr"` — run JS with the live container in scope (core helpers like `fs`, `git`, `proc` are pre-bound)
- `luca run script.ts` / `luca run doc.md` — run a script or runnable markdown in the luca VM
- `luca serve` — serve `endpoints/`; `--force` kills whatever holds the port, `--any-port` picks a free one
- `luca scaffold <type> <name>` — generate a helper (`feature`, `command`, `endpoint`, `client`, `server`); `--tutorial` prints the full guide for that type
- `luca console` — persistent REPL with the container

## Testing What You Build — the verification playbook

This is where sessions lose the most time. Follow this order:

1. **Prototype the logic in `luca eval` before wiring the full handler.** Test the file move, the query, the event subscription in isolation. If it works in eval, the handler is plumbing.
2. **Long-running commands (servers, watchers) cannot be run in the foreground.** Do NOT reach for `timeout`, `gtimeout`, or `perl -e 'alarm…'` — they are typically sandbox-blocked and models have burned 7–8 straight failures on them. Run the command as a background task and read its output; or verify the behavior through `luca eval` instead of running the command at all.
3. **Port hygiene.** Stale servers from earlier attempts squat on ports constantly. Before starting: `luca serve --force` (replaces the holder) or `--any-port`. To clean up manually: `luca eval "proc.findPidsByPort(3000)"` then `luca eval "proc.kill(<pid>)"`. If you start a server, kill it before you finish.
4. **Verify servers on the port they actually bound, not the one you asked for.** Pass `port` in the **constructor options** — `container.server('websocket', { port: 8099, json: true })` — not only in `start()`. If a server "isn't responding," confirm the bound port first; a real session spent its whole debugging budget on the client when the server was on the default port.

## Where Code Runs — the runtime envelope

Different entry points have different powers. Getting this wrong produces opaque `Could not import the module` errors:

| Entry point | Container? | Can import npm packages? | Can import project files? |
|---|---|---|---|
| `luca eval "…"` | yes, live | **no** | **no** — inline everything |
| `luca run script.ts` | yes, injected | bundled deps only | **no relative static imports** — keep scripts self-contained, or use absolute-path dynamic `await import()` |
| `bun script.ts` | no (unless you import it) | yes | yes |
| command/endpoint handlers | yes, via `context` | avoid — use the container | yes |

- If `luca eval` or `luca run` gives an opaque import error, run the file with plain `bun` to see the real resolution error.
- Importing the `luca` package from a plain-bun script can crash on native bindings; prefer `luca run` or the container-injected entry points. Assistants/AI helpers live on the AGI container: `import container from 'luca/agi'`, not `'luca'`.
- Every `luca run` / `luca eval` is a **fresh process and fresh container** — registrations from a previous run do not persist; only disk does.
- **No Bun globals** (`Bun.spawn`, `Bun.serve`) in command/endpoint handlers — use `container.feature('proc')`.
- **No `.tsx` in commands** — use `React.createElement()` with the `ink` feature; `useInput` requires a TTY (guard with `process.stdin.isTTY`).

## Commands

Handlers receive `(options, context)`. Named flags come from `argsSchema`; positionals map via a `positionals` export; raw positionals are in `options._` (`_[0]` is the command name).

```ts
// commands/hello.ts — complete working command
import { z } from 'zod'
export const description = 'Print a word as ascii art'
export const positionals = ['word']                    // luca hello world → options.word
export const argsSchema = z.object({
  word: z.string().default('hello').describe('The word to print'),
})
export default async function hello(options: any, context: any) {
  const ui = context.container.feature('ui')
  ui.banner(options.word)                              // figlet + gradient in one call
}
```

If your command supports `--json`, print machine output with `console.log` and gate all `ui.print.*` behind `if (!options.json)`.

## Endpoints

Handlers are `(params, ctx)` where **`params` is `{...query, ...body, ...urlParams}` merged** (URL params win). Use `ctx.query` / `ctx.body` / `ctx.params` when you need them separated. Return value is JSON-serialized; use `ctx.response` only for streaming/custom status.

- `delete` is a reserved word: define `const del = async (params, ctx) => {…}` then `export { del as delete }`.
- Share state across endpoint files via `ctx.request.app.locals`.
- DB/table init belongs in `luca.cli.ts`'s `main()` hook — it runs before any command or server.

## Known Gotchas — each of these has cost a real session

- **`fs.readFile` defaults to utf-8** and will corrupt binary files. Pass `null` as the encoding to get a Buffer: `fs.readFile(path, null)`.
- **`proc.execAndCapture` splits the command on spaces** — quoted paths and format strings (`curl -w "%{http_code}"`) get mangled or keep their literal quotes. Use `spawnAndCapture` with an explicit args array for anything containing paths, quotes, or spaces.
- **`fileManager.watch` emits `file:change` synchronously, before its own bookkeeping.** If your handler moves or deletes the file, the watcher crashes with ENOENT — defer the work (`setTimeout(() => process(path), 100)`). Watching is **recursive by default**, so moving files into subfolders of the watched dir fires more events; filter by path. Event payload is `{ type: 'add'|'change'|'delete', path }`.
- **REST client:** `.get(url, params)` sends `params` as the query string; `.post(url, data)` sends `data` as the body. Methods return **parsed JSON directly**; on HTTP errors the error is **returned, not thrown** — check what you got back.
- **contentDb silent failure:** if `luca eval "Object.keys(container.docs.models)"` shows only `["Base"]`, your `docs/models.ts` failed to load silently. Run `bun docs/models.ts` directly to see the real error. Never call `docs.query()` with an undefined model — the error surfaces as `undefined is not an object (evaluating 'definition.name')` deep in library code.
- **Helper `state` may not be hydrated** even when the helper works (e.g. a listening server with `state == {}`). Trust events and observed behavior over state values when debugging.
- **Registry names are camelCase, source files are kebab-case:** `cipherSocial` lives in `cipher-social.ts`. When a name lookup fails, the error's "Available:" list is authoritative — read it instead of guessing variants.
- **VM contexts start empty** — with `container.feature('vm')`, inject `console`, `Date`, `Promise`, `crypto`, `TextEncoder`, `setTimeout` explicitly.
- **Long-running commands** end with `await container.feature('scheduler').run()` — blocks until SIGINT/SIGTERM, stops all scheduled tasks, runs your `onShutdown` hook. (Manual idiom: `await new Promise(() => {})` plus a `process.on('SIGINT', …)` cleanup handler.)
- **Persisting state between command runs:** each invocation is a fresh process. Use `container.feature('diskCache')` (or sqlite) rather than inventing ad-hoc JSON files.

## What's Available

Before importing anything external, check here — then check `luca describe features`:

- **Files/search** — `fs`, `grep` (has `.todos()` and `codeAnnotations()`), `fileManager` (watching)
- **Processes** — `proc` (`exec`, `spawnAndCapture`, `findPidsByPort`, `kill`), `processManager`
- **Data** — `sqlite`, `postgres`, `diskCache`, `contentDb` (`container.docs`), `yaml`
- **HTTP** — `rest` client, `express` server, `websocket` client+server, `mcp` server
- **UI** — `ui` (`ui.colors` = chalk, `ui.banner()` = figlet+gradient, `ui.print.*`), `ink`
- **Utils** — `container.utils.uuid()`, `.lodash` (groupBy, keyBy, pick…), `.stringUtils` (camelCase, pluralize…), `.hashObject()`, `container.paths.resolve()/join()`
- **AI** — `assistant`, `conversation`, `openai` client; Google Workspace features (`googleDrive`, `googleSheets`, …)

**`paths.join()` vs `paths.resolve()`:** `join()` always prepends `container.cwd`, even for absolute first args. Use `resolve()` when the base is already absolute.

## When You're Stuck — the debugging ladder

1. `X is not a function` / `undefined` → you guessed an API. `luca describe <helper>.<method>`.
2. Name not found in registry → read the error's "Available:" list; try `luca describe features | grep -i <word>`.
3. Opaque import error in eval/run → run the file with plain `bun` to see the real error.
4. Empty result where you expected data → silent failure. Probe each layer with `luca eval`, innermost first.
5. Server not responding → verify the bound port (`proc.findPidsByPort`), check for stale processes, check constructor vs `start()` options with `luca describe <server> --options`.
6. Still stuck → `luca eval "container.feature('x').method.toString()"` reads the live implementation; `luca console` for interactive exploration.

The full mental model, recipes, and deeper reference material are in `.claude/skills/luca-framework/SKILL.md`.

## Git Strategy

Roll on main. Commit with messages that explain why, not just what.
