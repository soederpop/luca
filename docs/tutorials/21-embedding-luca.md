---
title: Embedding Luca in an Existing Project
tags: [setup, npm, library, embedding, integration]
---

# Embedding Luca in an Existing Project

The canonical way to use Luca is the standalone binary — see [Getting Started](./01-getting-started.md). But sometimes you already have an app, a build pipeline, and a `package.json`, and you want the container *inside* it as a library. That's what this path is for.

## When to Choose This Path

Use the **binary** when:

- You're starting a new project or tool
- You want zero npm dependencies and no supply chain exposure
- You want to ship your project as its own standalone binary with `luca bundle`

Embed Luca as a **package** when:

- You have an existing TypeScript/Bun app and want the container's features inside it
- You need to import Luca modules into your own build (bundlers, monorepos, CI pipelines you already own)
- You're using the React bindings or building a browser app on the web container

Both paths use the exact same container — the difference is only who owns the runtime.

## Install

```bash
bun add luca
```

Bun is Luca's runtime; the package assumes it.

## Import the Container

The container is a per-process singleton — dependency injector, event bus, and state machine:

```typescript
import container from 'luca/node'

// Now you have access to all features
const fs = container.fs           // File system operations
const git = container.git         // Git utilities (branch, sha, lsFiles, etc.)
const ui = container.ui           // Terminal UI (colors, prompts, figlet)
const proc = container.feature('proc')  // Process execution
```

Everything you'd get in the binary is on the container: features, clients, servers, observable state, the event bus. The discovery pattern from [Bootstrap](./00-bootstrap.md) works identically:

```typescript
container.features.available          // list every feature
container.features.describe('fs')     // markdown docs at runtime
```

## Entry Points

The package exposes several entry points depending on where your code runs:

```typescript
import container from 'luca'          // node container (default)
import container from 'luca/node'     // node container, explicit
import container from 'luca/web'      // browser container
import { ... } from 'luca/react'      // React bindings
import { ... } from 'luca/agi'        // AGI layer — assistants, conversations, providers
```

In the browser without a bundler, you can load it straight from a CDN — see [Browser ESM](./20-browser-esm.md):

```js
import container from 'https://esm.sh/luca/web'
```

## Using It in Your App

A script in your existing project:

```typescript
// scripts/migrate.ts
import container from 'luca/node'

const sqlite = container.feature('sqlite')
const ui = container.feature('ui')

const db = await sqlite.open('app.db')
await db.exec(`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)`)
ui.print.success('Migration complete')
```

Run it with your own tooling (`bun run scripts/migrate.ts`) — or with the CLI, which the package also installs:

```bash
bunx luca run scripts/migrate.ts
bunx luca serve
bunx luca describe features
```

The convention folders (`commands/`, `endpoints/`, `features/`, `assistants/`) are auto-discovered by the CLI exactly as they are in binary projects, so you can mix both styles: import the container in your own code, and let `luca serve` pick up your `endpoints/` folder.

## Building Custom Helpers

Extending the container works the same in both worlds — features, clients, and servers register themselves:

```typescript
import { Feature } from 'luca/feature'

export class MyCache extends Feature {
  static { Feature.register(this, 'myCache') }
  // ...
}
```

See [Creating Features](./10-creating-features.md) for the full guide.

## Graduating to a Binary

Nothing about the embedded path locks you in. If your Luca-powered corner of the app grows into something you want to ship on its own, `luca bundle <name>` compiles the convention folders into a standalone binary — see [Getting Started, step 5](./01-getting-started.md#5-ship-it).

## What's Next

- [Getting Started](./01-getting-started.md) -- the canonical binary path
- [The Container](./02-container.md) -- deep dive into the container
- [Browser ESM](./20-browser-esm.md) -- the web container without a build step
- [Creating Features](./10-creating-features.md) -- extend the container with your own helpers
- [Assistants](./12-assistants.md) -- build an AI operator into your project
