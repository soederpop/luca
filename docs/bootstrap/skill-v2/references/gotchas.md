# Known Gotchas — wrong → right

Every entry here cost at least one real session real time. Format: the trap, the failure you'll see, the correct move.

## File system

**`fs.readFile` defaults to utf-8 — corrupts binary files.**
✗ `fs.readFile('audio.mp3')` → returns a mangled string
✓ `fs.readFile('audio.mp3', null)` → Buffer

**`paths.join()` always prepends `container.cwd`, even when the first arg is absolute.**
✗ `container.paths.join(os.tmpdir, 'x')` → `<cwd>/<tmpdir>/x`
✓ `container.paths.resolve(os.tmpdir, 'x')` — `resolve` respects absolute first args like Node's

## Processes

**`proc.execAndCapture` naively splits the command string on spaces.**
✗ `proc.execAndCapture('bun build --outfile "/tmp/my path/bin"')` → malformed args, and format strings keep literal quotes (`curl -w "%{http_code}"` → `"200"`)
✓ `proc.spawnAndCapture(cmd, [arg1, arg2, ...])` with an explicit args array for anything containing paths, quotes, or spaces

**Builds can lie.** `bun build --compile` can exit 0 without writing the binary. Always check the artifact exists on disk before reporting success.

## Watching files

**`fileManager.watch` emits `file:change` synchronously, *before* its internal bookkeeping.** If your handler moves or deletes the file, the watcher's own `statSync` crashes with ENOENT.
✓ Defer mutating work: `fm.on('file:change', e => setTimeout(() => processFile(e.path), 100))`

**Watching is recursive by default.** Moving a file into `inbox/valid/` while watching `inbox/` fires another event. Filter by directory in your handler.

**Event payload** is `{ type: 'add' | 'change' | 'delete', path }`.

## Servers and endpoints

**Options belong in the constructor.** `container.server('websocket', { port: 8099, json: true })` then `await server.start()`. If a server seems to ignore an option, run `luca describe <server> --options` and confirm where it belongs — then verify the port it *actually* bound before debugging anything else.

**Endpoint handler signature is `(params, ctx)`** where `params = { ...ctx.query, ...ctx.body, ...ctx.params }` merged (URL params win). Use the separated `ctx.query` / `ctx.body` / `ctx.params` when the distinction matters. Return values are JSON-serialized; touch `ctx.response` only for streaming or custom status codes.

**`delete` is a reserved word.**
✓ `const del = async (params, ctx) => {…}; export { del as delete }`

**Sharing state across endpoint files:** `ctx.request.app.locals`. Database/table init goes in `luca.cli.ts`'s `main()` hook (runs before any command or server).

**Long-running commands** need `await new Promise(() => {})` at the end plus `process.on('SIGINT', …)` cleanup.

## REST client

- `.get(url, params)` → `params` becomes the **query string**; `.post(url, data)` → `data` becomes the **body**.
- Methods return **parsed JSON directly** — not `{ data, status, headers }`.
- HTTP errors are **returned, not thrown**. Check whether you got the shape you expected.

## contentDb / contentbase

- `docs.models` showing only `["Base"]` means `docs/models.ts` failed to load **silently**. Run `bun docs/models.ts` to see the real error (often a package-resolution failure).
- `docs.query(undefined)` explodes deep in library code as `undefined is not an object (evaluating 'definition.name')`. Verify the model exists first: `luca eval "Object.keys(container.docs.models)"`.

## Naming

- Registry names are **camelCase**, files are **kebab-case**: `cipherSocial` ↔ `cipher-social.ts`.
- Don't guess short registry names (`telnyx` when the feature is `telnyxAssistantConnector`). When describe fails, its "Available:" list is authoritative — read it.

## Terminal UI / ink

- **No `.tsx` in commands** — build elements with `React.createElement()`.
- `useInput` requires a TTY (`process.stdin.setRawMode`); it crashes when stdin is piped. Guard with `process.stdin.isTTY` and fall back to `process.on('SIGINT', …)`.
- Lifecycle order: `loadModules()` → `await ink.render(element)` → `waitUntilExit()`. The `render` await is mandatory.
- `ui.print.*` writes to stdout. For `--json` commands, print data with `console.log` and gate decorative output behind `if (!options.json)`.

## Runtime / environment

- **Bun globals (`Bun.spawn`, `Bun.serve`) are unavailable** inside command/endpoint handlers — use `container.feature('proc')` or Node's `child_process`.
- **VM contexts start empty** — with `container.feature('vm')`, inject `console`, `Date`, `Promise`, `crypto`, `TextEncoder`, `setTimeout` yourself.
- Helper **`state` may not hydrate** even when the helper works (a listening server can report `state == {}`). Debug from events and behavior, not state.
- **Every `luca run` / `luca eval` is a fresh process and container.** Registrations don't persist between invocations; only disk does. For cross-run persistence use `diskCache` or `sqlite`, not module-level variables.
- **`as any` is not an integration strategy.** If a first-party API doesn't support what you need, raise the constraint (the container philosophy has an escalation path for this) instead of casting through it — recorded `as any` workarounds turned into standing typecheck debt that later sessions had to unwind.
