---
title: "Advanced: An Assistant That Drives Your UI"
tags:
  - browser
  - assistant
  - tools
  - containerLink
  - reactive
  - advanced
  - rpc
---
# Advanced: An Assistant That Drives Your UI

You have a reactive browser app ([tutorial 22](./22-reactive-frontend.md)) and you know features expose tools that assistants pick up with `assistant.use()` ([Features as Tool Providers](../examples/feature-as-tool-provider.md)). This tutorial connects the two: **a server-side assistant that can operate the front-end the user is looking at** — add items, flip tabs, run a query — with every action visibly updating the live UI.

This is the "assistant spawns a UI, then drives it" loop. It's built entirely from generic Luca primitives; nothing here is bespoke.

## The one insight: it's the same tool pattern, plus one hop

Exposing tools never changes. A feature declares `static tools` (name → `{ description, schema }`), implements a matching method per tool, and an assistant calls `use(feature)` to register them. That's true for `fileTools`, for your own server features, and for this.

The *only* new problem is a **location gap**: the assistant runs in a Node process, but the app's state and methods live in the user's browser. You need a way for server code to call a method over in the browser and get the result back. That transport is the **`containerLink`** feature — and once you have it, the tool-provider pattern drops in unchanged.

```
┌─ Node process ──────────────┐         ┌─ Browser ───────────────┐
│  assistant.use(remote)      │  ws     │  container.feature('app')│
│  remote.addTodo(args) ──────┼────────▶│  .addTodo(args)          │
│         ▲ result            │  eval   │   → mutates state        │
│         └───────────────────┼─────────┤   → emit('changed')      │
└─────────────────────────────┘         │   → UI re-renders        │
                                         └──────────────────────────┘
```

## `containerLink` in a nutshell

`containerLink` is one feature with two sides — the browser gets the client, a Node process gets the host:

- **Host (Node):** `container.feature('containerLink', { port: 8089 })`, then `await link.start()`. It's a WebSocket server. It emits `connection(uuid, meta)` when a browser registers, and its key method is **`eval(containerId, code, context?, timeout?)`** — run code inside that browser and get the (awaited) result back.
- **Client (browser):** `container.feature('containerLink', { hostUrl })`, then `await link.connect()`. It registers with the host and services eval requests.

The trust is **one-directional**: the host can eval in the browser, never the reverse (the browser can only `emitToHost(event, data)`). Evaluated code runs through the browser's `vm` with the **`container` in scope**, and — crucially — the host `await`s a Promise the code returns. So an async method call round-trips cleanly.

> `luca describe containerLink` and `luca describe containerLink --platform=web` show the full surface of each side.

## Step 1 — the browser app, with methods worth calling

Start from tutorial 22's store-as-feature. The only thing that matters for remote control: **each mutating method ends with `emit('changed')`**, so when the assistant calls it, the human watching the page sees the update. Reference the app through `container.feature('app')` (that's what's in scope on the browser side) — not `window.app`.

```html
<script type="module">
  import container from "https://esm.sh/luca@3.3.3/web"
  const { Feature } = container

  class TodoApp extends Feature {
    static shortcut = 'features.app'
    static { Feature.register(this, 'app') }

    get todos() { return this.state.get('todos') || [] }

    async addTodo({ title }) {
      const todo = { id: container.utils.uuid(), title, done: false }
      this.state.set('todos', [...this.todos, todo])
      this.emit('changed')                 // ← the user sees it appear
      return todo
    }
    async toggleTodo({ id }) {
      this.state.set('todos', this.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t))
      this.emit('changed')
      return { id }
    }
    async listTodos() { return this.todos }
  }

  const app = container.feature('app')
  // ...render with React exactly as in tutorial 22...

  // Connect back to the host so it can drive this app.
  const link = container.feature('containerLink', {
    hostUrl: `ws://${location.hostname}:8089`,
    meta: { app: 'todos' },              // lets the host tell windows apart
  })
  await link.connect()
</script>
```

That's the entire browser-side change: three callable methods and one `connect()`.

## Step 2 — a server feature that exposes those methods as tools

This is an ordinary tool-provider feature (`features/todo-remote.ts`), identical in shape to `fileTools`. The difference is that each method, instead of doing the work locally, **evals the call over the link**. The server owns the Zod schemas — it's the side talking to the model.

```ts
// features/todo-remote.ts
import { z } from 'zod'
import { Feature } from 'luca'

export class TodoRemote extends Feature {
  static override stability = 'experimental' as const
  static { Feature.register(this, 'todoRemote') }

  // 1. The tool surface the assistant sees (Zod, per the standard pattern)
  static override tools = {
    addTodo: {
      description: 'Add a todo to the UI the user is looking at.',
      schema: z.object({ title: z.string().describe('The todo text') })
        .describe('Add a todo to the UI the user is looking at.'),
    },
    toggleTodo: {
      description: 'Toggle a todo done/undone by its id.',
      schema: z.object({ id: z.string().describe('The todo id') })
        .describe('Toggle a todo done/undone by its id.'),
    },
    listTodos: {
      description: 'List the todos currently shown in the UI.',
      schema: z.object({}).describe('List the todos currently shown in the UI.'),
    },
  }

  get link() { return this.container.feature('containerLink') }
  get uiId() { return this.state.get('uiId') as string | undefined }

  // 2. Each method forwards the call into the browser and returns its result.
  //    Pass args via the eval *context* (second arg) — no string interpolation,
  //    no injection surface. `args` and `container` are both in scope over there.
  async addTodo(args: { title: string }) {
    return this.callUi(`container.feature('app').addTodo(args)`, args)
  }
  async toggleTodo(args: { id: string }) {
    return this.callUi(`container.feature('app').toggleTodo(args)`, args)
  }
  async listTodos() {
    return this.callUi(`container.feature('app').listTodos()`, {})
  }

  private async callUi(code: string, args: any) {
    if (!this.uiId) throw new Error('No UI is connected yet — open the app in a browser first.')
    return this.link.eval(this.uiId, code, { args })
  }

  // 3. Teach the assistant it's operating a live surface, not a database.
  override setupToolsConsumer(consumer: any) {
    if (typeof consumer.addSystemPromptExtension === 'function') {
      consumer.addSystemPromptExtension('todoRemote', [
        '## Todo UI',
        'These tools operate the live todo list the user is watching on screen.',
        'Prefer listTodos to see current state before toggling. Actions are visible immediately.',
      ].join('\n'))
    }
  }
}

export default TodoRemote
```

Because `TodoRemote` is a normal feature, everything from the tool-provider example still holds: handlers are auto-bound by name in `toTools()`, you can call them directly to test without a model, and `toTools({ only })` scopes them down.

## Step 3 — wire the host, track the window, hand it to the assistant

Put the plumbing where it runs before anything else — `luca.cli.ts`'s `main()`, or a dedicated command. Serve the app with `luca serve` (tutorial 22), and run the link host alongside it:

```ts
// in luca.cli.ts main(), a command, or a script
await container.helpers.discoverAll()          // register features/todo-remote.ts

const link = container.feature('containerLink', { port: 8089 })
await link.start()

const remote = container.feature('todoRemote')

// When a browser opens the app, remember which container is the todo UI.
link.on('connection', (uuid: string, meta: any) => {
  if (meta?.meta?.app === 'todos') remote.state.set('uiId', uuid)
})
link.on('disconnection', (uuid: string) => {
  if (remote.uiId === uuid) remote.state.set('uiId', undefined)
})

const assistant = container.feature('assistant', {
  systemPrompt: 'You help the user manage their todo list.',
  model: 'gpt-4.1-mini',
})
assistant.use(remote)                          // addTodo / toggleTodo / listTodos now registered

await assistant.start()
console.log(await assistant.ask('Add todos for milk, eggs, and bread, then show me the list.'))
// The three items pop into the browser as the model calls addTodo, and
// listTodos returns the real state — the assistant narrates what's on screen.
```

The loop is closed: the model calls a tool → the handler evals into the browser → the method mutates state and emits `changed` → the user's UI re-renders → the result flows back to the model. Everything you already learned about tool providers and reactive features composes; `containerLink` just carries the call across the process boundary.

## Scaling up: let the browser own its tool surface

Hardcoding `TodoRemote`'s schemas on the server is right when *you* wrote the UI. But if UIs are generated on the fly — an assistant writes a new workflow, serves it, and wants to drive it without anyone updating server code — the tool contract has to come *from the browser*.

The shape: have the browser app expose its own tools (in the browser, schemas are plain JSON Schema — there's no Zod), and fetch them over the link at connect time:

```ts
// host: discover the app's declared tools
const schemas = await link.eval(uiId,
  `JSON.stringify(container.feature('app').toTools().schemas)`)   // returns { toolName: jsonSchema }

// build one proxy handler per tool, each evaling the matching method in the browser
for (const name of Object.keys(JSON.parse(schemas))) {
  // handler forwards to container.feature('app')[name](args) over the link
}
```

One friction point to plan for: **`assistant.addTool()` wants a Zod schema** (it calls `schema.toJSONSchema()` internally). Browser-declared schemas arrive as JSON Schema, so a fully dynamic path needs a JSON-Schema→Zod step on the host. That conversion is the reason most apps keep the tool contract on the server (Step 2) and only reach for dynamic discovery when the set of UIs genuinely isn't known ahead of time.

> **Alternate transport.** If your app runs in *native* windows you spawn (not a persistent WebSocket link), you can inject and evaluate JS in a window directly and poll a result global instead of using `containerLink.eval`. Same author-facing idea — the app exposes `toTools()`; only the pipe differs.

## Gotchas

- **Host→browser eval runs arbitrary code in the user's page.** Only connect a browser to a host you control, and treat the `containerLink` port like any other trusted local service. Connections are token-authenticated per session.
- **`emit('changed')` in every mutating method**, or the assistant will change state the user can't see — defeating the point.
- **Results must be JSON-serializable.** `eval` marshals the return value over WebSocket; return plain objects, not class instances or DOM nodes.
- **Handle "no UI connected."** The assistant may call a tool before any browser has opened the app — fail with a clear message (as `callUi` does) rather than evaling into `undefined`.
- **Pass arguments via the eval context, not string interpolation** — `link.eval(id, 'fn(args)', { args })` keeps model-supplied values out of the code string.
- **Reference `container.feature('app')` in evaled code.** `container` is in scope on the browser side; `window`-globals may not be, depending on how the page loaded.
- **Route by `meta` when multiple windows connect.** The `connection(uuid, meta)` event carries the `meta` you passed to `connect()` — use it to pick the right UI, or track several.

## What's Next

- [Browser: Reactive UIs with No Build Step](./22-reactive-frontend.md) — the app this drives
- [Features as Tool Providers](../examples/feature-as-tool-provider.md) — `static tools`, `toTools()`, `use()`, `setupToolsConsumer()` in depth
- [Assistants](./12-assistants.md) — building and running assistants
- `luca describe containerLink` / `--platform=web` — the full host and client APIs
