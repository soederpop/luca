---
title: "Browser: Reactive UIs with No Build Step"
tags:
  - browser
  - esm
  - web
  - frontend
  - react
  - reactive
  - no-build
---
# Browser: Reactive UIs with No Build Step

[Tutorial 20](./20-browser-esm.md) showed you can import Luca from esm.sh and use features in the browser. This tutorial goes one step further: **build a complete, reactive front-end application** — the kind with live-updating panels, streaming data, and real state — with **no bundler, no `npm install`, no build step, and no framework lock-in.**

The whole thing rests on three ideas. Learn them once and you can build any UI this way.

## The three ideas

1. **esm.sh means no build.** Any npm package (React, Preact, marked, chart.js…) is importable as a URL. The browser's native ES module loader does the rest. There is no `package.json` for the front-end, no Webpack, no Vite, nothing to compile. You write an `.html` file and serve it.

2. **A Luca feature is a reactive store.** Every feature already has observable state (`this.state.get/set`) and an event bus (`this.emit/.on/.off`). That is *exactly* what a front-end store is. You don't need Redux, Zustand, or Context — the container gives you one for free, and it's the same API you use on the server.

3. **The view subscribes to the store's events.** Whatever renders the DOM — plain JavaScript, React, Preact, Vue — just listens for the feature's `changed` event and re-reads state. The store never knows about the view. That decoupling is the whole pattern.

Everything below is an elaboration of those three ideas.

## Prove the mechanism with plain DOM

Before any framework, here is the entire pattern in ~20 lines. A feature holds state and emits `changed`; a render function listens and repaints. Save as `public/index.html`:

```html
<!DOCTYPE html>
<html>
<body>
  <button id="dec">−</button>
  <span id="value">0</span>
  <button id="inc">+</button>

  <script type="module">
    import container from "https://esm.sh/luca/web"
    const { Feature } = container

    class Counter extends Feature {
      static shortcut = 'features.counter'
      static { Feature.register(this, 'counter') }

      get value() { return this.state.get('value') || 0 }
      bump(by) {
        this.state.set('value', this.value + by)
        this.emit('changed')          // ← the only line the view cares about
      }
    }

    const counter = container.feature('counter')

    // The view: re-read state whenever the store changes.
    const render = () => { document.getElementById('value').textContent = counter.value }
    counter.on('changed', render)
    render()

    document.getElementById('inc').onclick = () => counter.bump(1)
    document.getElementById('dec').onclick = () => counter.bump(-1)
  </script>
</body>
</html>
```

Serve it:

```shell
luca serve
```

`luca serve` serves `public/` as static files (and `endpoints/` as an API — more on that below). Open the URL, click the buttons. **No build step ran.** The feature is the store; `changed` is the signal; `render` is the subscriber. That is the pattern. React just makes the `render` half nicer.

## Add React from a URL

You do not install React. You import it. `React.createElement` (aliased to `e`) replaces JSX, so there's no compile step — this is plain JavaScript the browser runs directly.

```html
<script type="module">
  import React from "https://esm.sh/react@18.3.1"
  import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1"
  import container from "https://esm.sh/luca/web"

  const e = React.createElement
</script>
```

> **The one React footgun:** react-dom must use the *same* React instance. Pin both to the same version and add `?deps=react@18.3.1` to the react-dom URL (or use an import map — see Gotchas). Skip this and you get "Invalid hook call."

Now bridge the store to React with a tiny hook. This is not part of Luca — it's six lines you write once and reuse everywhere. It subscribes a component to any feature's `changed` event and forces a re-render:

```js
// Re-render this component whenever any of the given features emit 'changed'.
function useFeatureVersion(features) {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    features.forEach((f) => f.on('changed', bump))
    return () => features.forEach((f) => f.off('changed', bump))
  }, features)
}
```

The counter, now in React:

```js
function CounterApp() {
  useFeatureVersion([counter])            // re-render on every 'changed'
  return e('div', null,
    e('button', { onClick: () => counter.bump(-1) }, '−'),
    e('span', { style: { margin: '0 1rem' } }, counter.value),
    e('button', { onClick: () => counter.bump(1) }, '+'),
  )
}

createRoot(document.getElementById('root')).render(e(CounterApp))
```

The feature is unchanged from the plain-DOM version. Only the subscriber changed. **The store has no idea React exists** — which is why you could swap in Preact or Vue without touching it.

## Scale up: the Api / Store / App layers

A counter fits in one feature. A real app — one that fetches data, holds it, and coordinates actions — is clearest as **three features**, each with one job:

| Layer | Responsibility | Never does |
| --- | --- | --- |
| **Api** | Talk to the backend (`fetch`, websocket, SSE). Returns plain data. | Hold state, know about the UI |
| **Store** | Hold in-memory state. Expose getters. `emit('changed')` after every mutation. | Make network calls |
| **App** | Orchestrate: call Api, push results into Store, expose high-level actions (`start()`, `refresh()`). | Render |

```js
class Api extends Feature {
  static shortcut = 'features.api'
  static { Feature.register(this, 'api') }
  get rest() { return this.container.client('rest', { baseURL: '/api' }) }
  loadTodos() { return this.rest.get('/todos') }        // returns parsed JSON directly
}

class Store extends Feature {
  static shortcut = 'features.store'
  static { Feature.register(this, 'store') }
  get todos() { return this.state.get('todos') || [] }
  setTodos(todos) { this.state.set('todos', todos); this.emit('changed') }
}

class App extends Feature {
  static shortcut = 'features.app'
  static { Feature.register(this, 'app') }
  get api() { return this.container.feature('api') }
  get store() { return this.container.feature('store') }

  async start() {
    this.state.set('loading', true); this.emit('changed')
    try {
      this.store.setTodos(await this.api.loadTodos())
    } catch (err) {
      this.state.set('error', err.message)
    }
    this.state.set('loading', false); this.emit('changed')
  }

  // One atomic read for the view — no scattered getters, no stale closures.
  snapshot() {
    return {
      loading: this.state.get('loading'),
      error: this.state.get('error'),
      todos: this.store.todos,
    }
  }
}
```

Features compose through the container (`this.container.feature('api')`) — the same way server-side features depend on each other. The **`snapshot()` idiom** is worth adopting: the component makes one call and reads a single plain object, instead of pulling from several getters that might drift out of sync mid-render.

```js
function TodoApp() {
  const app = container.feature('app')
  const store = container.feature('store')
  useFeatureVersion([app, store])           // subscribe to both

  const { loading, error, todos } = app.snapshot()
  if (loading) return e('p', null, 'Loading…')
  if (error) return e('p', { style: { color: 'red' } }, error)
  return e('ul', null, todos.map((t) => e('li', { key: t.id }, t.title)))
}

const app = container.feature('app')
createRoot(document.getElementById('root')).render(e(TodoApp))
app.start()                                 // kick off the initial load
```

## The backend half: `endpoints/` + `luca serve`

`luca serve` serves your static `public/` **and** file-based routes from `endpoints/` on the *same origin*. Same origin means the browser makes no cross-origin request, so **there's no CORS to configure** — the Api layer just fetches `/api/...`.

```ts
// endpoints/todos.ts  →  GET /api/todos
import type { EndpointContext } from 'luca'

export const path = '/api/todos'

// Handlers are (params, ctx). Return a value — it's serialized to JSON.
export async function get(_params: any, ctx: EndpointContext) {
  const db = ctx.container.feature('sqlite')       // full node container on the server
  return db.query('SELECT id, title FROM todos').all()
}
```

```shell
luca serve --watch        # hot-reloads endpoints on change
```

Your browser has the *web* container (no `fs`, `git`, `proc`); your endpoints have the *node* container (everything). The REST client is the bridge between them. See [Endpoints](./07-endpoints.md) and [Servers](./06-servers.md) for the full API.

## Live updates

The `changed`-event pattern makes live data trivial — the transport pushes into the Store, the Store emits, the view repaints. Pick the transport that fits:

- **Polling** — simplest. An `App` timer calls `refresh()` every few seconds.
- **WebSocket** — `container.client('socket', { url })`; `socket.on('message', …)` pushes into the Store.
- **Server-Sent Events** — for one-way streams (LLM tokens, build logs). Read `res.body.getReader()` and dispatch each `data:` line into the Store. When parsing SSE by hand, keep the trailing partial line in a buffer across chunks (`buffer = lines.pop()`), or you'll drop events split across a network boundary.

In every case the view code is identical — it only ever knows about `changed`.

## Gotchas

- **Pin versions; esm.sh caches hard.** `https://esm.sh/luca@3.3.3/web`, not bare `luca/web`, for anything you want to be stable.
- **One React instance.** react-dom must resolve the same React as your components. Pin both versions and add `?deps=react@VERSION` to react-dom, or use an **import map** (cleanest when you split code across files):
  ```html
  <script type="importmap">
  { "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1",
    "luca/web": "https://esm.sh/luca@3.3.3/web"
  }}
  </script>
  ```
  Then `import React from "react"` resolves through the map — one instance, everywhere.
- **`?dev` while developing.** `https://esm.sh/react@18.3.1?dev` gives readable errors and warnings; drop it in production.
- **Emit `changed` after *every* mutation.** A forgotten `emit` is the #1 cause of "the state updated but the UI didn't." Centralize mutations in Store methods so the emit lives in one place.
- **Web container ≠ node container.** No `fs`/`git`/`proc` in the browser. Anything node-only goes behind an endpoint.
- **SPA routing.** When you serve only `public/` (no explicit `--static-dir`), `luca serve` enables history fallback so client-side routes resolve to `index.html`.

## It's framework-agnostic

Nothing above is React-specific except `useFeatureVersion` and `createElement`. The store is a plain Luca feature. Swap the view layer freely:

- **Vanilla DOM** — the first example; a `render()` function on `changed`.
- **Preact** — identical to the React code; import from `https://esm.sh/preact@10/compat`.
- **Vue / Svelte / lit** — subscribe their reactivity primitive to the feature's `changed` event.

The durable skill is the pattern — *a feature is your reactive store; the view subscribes to its events* — not any one library.

## What's Next

- [Browser: Import Luca from esm.sh](./20-browser-esm.md) — the feature/state/event basics this builds on
- [Endpoints](./07-endpoints.md) — file-based API routes served by `luca serve`
- [Servers](./06-servers.md) — the Express server, static serving, and CORS options
- [State and Events](./05-state-and-events.md) — the state machine and event bus, in depth
- [Creating Features](./10-creating-features.md) — full feature anatomy (schemas, lifecycle, events)
