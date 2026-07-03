# Recipes — the shapes models reach for most

These are the tasks that come up over and over in real sessions. Each recipe gives the working shape and names its footguns. **Before using any helper here, spend 10 seconds on `luca describe <helper>` — these recipes show structure; describe is the authority on exact signatures.**

## 1. A CLI command (the hello world)

```ts
// commands/hello.ts  →  luca hello world --loud
import { z } from 'zod'

export const description = 'Print a word as ascii art'
export const positionals = ['word']            // maps `luca hello foo` → options.word
export const argsSchema = z.object({
  word: z.string().default('hello').describe('The word to print'),
  loud: z.boolean().default(false).describe('Uppercase it'),
})

export default async function hello(options: any, context: any) {
  const ui = context.container.feature('ui')
  ui.banner(options.loud ? options.word.toUpperCase() : options.word)  // figlet + gradient
}
```

Auto-discovered — no registration step. Verify with `luca hello test` and `luca describe hello`. Raw positionals also arrive in `options._` (`_[0]` is the command name).

## 2. REST API + client roundtrip

```ts
// endpoints/items.ts  →  served by `luca serve`
export async function get(params: any, ctx: any) {
  const db = ctx.request.app.locals.db          // shared per-server state
  return { items: db.query('SELECT * FROM items').all() }   // return value is JSON-serialized
}

export async function post(params: any, ctx: any) {
  // params = { ...query, ...body, ...urlParams } merged; use ctx.body when you need body-only
  return { created: params.name }
}

const del = async (params: any, ctx: any) => ({ deleted: ctx.params.id })
export { del as delete }                         // `delete` is a reserved word
```

Serve and verify:

```shell
luca serve --any-port          # or --force to evict a stale process from the port
# run the server as a background task, then from a foreground call:
luca eval "await container.client('rest', { baseURL: 'http://localhost:3000' }).get('/items')"
```

The rest client returns **parsed JSON directly** and **returns (not throws) HTTP errors** — check the shape of what came back. `.get(url, params)` = query string; `.post(url, data)` = body.

Put one-time DB setup (create tables, seed) in `luca.cli.ts`'s `main()` hook and stash shared handles on `app.locals` — don't re-open the DB in every endpoint file.

## 3. WebSocket server ↔ client roundtrip

```shell
# Constructor options, then start() — verify the BOUND port before debugging clients
luca eval "
  const server = container.server('websocket', { port: 8099, json: true })
  await server.start()
  server.on('message', (msg, reply) => reply({ echo: msg }))   // verify exact event API: luca describe websocket --events
  await new Promise(r => setTimeout(r, 30000))                 // keep alive for the test window
"
```

Client side (separate invocation): `container.client('websocket', { url: 'ws://localhost:8099', json: true })` — see `luca describe websocket` for the client's ask/reply semantics; the luca ws client and server pair supports request/response, not just fire-and-forget.

Footguns: don't try to sanity-check with `import('ws')` inside eval (npm imports unavailable); server `state` may read `{}` even while listening — trust behavior.

## 4. File watcher pipeline

```ts
const fm = container.feature('fileManager')
fm.on('file:change', (event) => {
  // payload: { type: 'add' | 'change' | 'delete', path }
  if (event.type !== 'add') return
  if (event.path.includes('/valid/') || event.path.includes('/invalid/')) return  // recursive watch fires for subdirs
  setTimeout(() => processFile(event.path), 100)  // NEVER move/delete synchronously — watcher emits before its own stat
})
await fm.watch({ paths: ['inbox'] })
```

Test the `processFile` logic in `luca eval` first; run the live watch as a background task. End the command file with `await container.feature('scheduler').run()` to hold the process open and clean up on SIGINT (or the manual idiom: `await new Promise(() => {})` plus a `SIGINT` handler).

## 5. Persisting state between command runs

Every invocation is a fresh process — module-level variables don't survive. The blessed options:

```shell
luca describe diskCache    # file-backed key-value cache — the default choice
luca describe sqlite       # when you need queries
```

Use one of these instead of inventing an ad-hoc `.stats.json` file; that's exactly what they're for (e.g. a `luca watch` command recording counts that a separate `luca status` command reads).

## 6. Audit / report commands

`container.feature('grep')` already does the heavy lifting: `.todos()` finds TODO/FIXME annotations, `.search()` does content search — check `luca describe grep` before shelling out to `rg`. For `--json` output, print data with `console.log` and gate all `ui.print.*` behind `if (!options.json)`.

## 7. Ink terminal dashboard (skeleton)

```ts
// commands/dashboard.ts — no .tsx in commands; use createElement
import React from 'react'
export default async function dashboard(options: any, context: any) {
  const ink = context.container.feature('ink')
  await ink.loadModules()                        // mandatory, first
  const app = await ink.render(React.createElement(Dashboard))  // the await is mandatory
  await app.waitUntilExit()
}
```

Inside components: guard `useInput` with `process.stdin.isTTY` (raw mode crashes when stdin is piped) and fall back to `process.on('SIGINT', …)`. Keep refresh work cheap — shelling out to slow commands (`top -l 1` is ~2s on macOS) inside a render loop stalls the UI; prefer `ps` or the `os` feature.

## 8. Runnable markdown as a deliverable

When prototyping or documenting, write a markdown file whose code blocks run in the VM:

```shell
luca run docs/how-it-works.md
```

Same envelope rules as `luca run` scripts: container is injected, keep blocks self-contained (no relative static imports).
