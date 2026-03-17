---
name: Using the luca framework
description: Learn the luca container at runtime — discovery patterns, CLI usage, introspection, and the self-describing API surface that lets you explore features, clients, and servers without leaving your editor or terminal
---
# Luca: Learning the Container at Runtime

The Luca framework `@soederpop/luca` ships a binary `luca` that is a bun based, dependency injection tool.  This project is likely based on it if this skill is present. When you run the `luca` command, it will sometimes auto-discover and auto-load modules in the `commands/`, `clients/`, `servers/`, or `features/` folders when present.

These modules are loaded through luca's VM which will inject the `container` as a global.

**Start here:** The single most useful command is `luca describe`. It is your primary tool for understanding what the container can do. Before reading source files or searching for APIs, ask describe:

```shell
luca describe              # describe the container itself
luca describe fs           # full docs for the fs feature
luca describe features     # index of all available features
luca describe git fs proc  # multiple helpers at once
```

Everything in luca is self-describing. `luca describe` outputs the documentation you need — methods, options, events, state, examples — directly in the terminal. Use it liberally.

## `luca` CLI quick tutorial

Running it like this will tell you all commands that are available (e.g. `luca describe`)

```shell
luca
```

You can see help for any command.  For learning about luca progressively, the describe command is your friend:

```shell
luca help describe
luca describe --help
```

Outputs:

```
luca describe --help

  luca describe  — Describe the container, registries, or individual helpers

  Usage: luca describe [options]

  Flags:

    --json          Output introspection data as JSON instead of markdown
    --pretty        Render markdown with terminal styling via ui.markdown
    --title         Include the title header in the output (use --no-title to omit) (default: true)
    --description   Show the description section
    --usage         Show the usage section
    --methods       Show the methods section
    --getters       Show the getters section
    --events        Show the events section
    --state         Show the state section
    --options       Show the options section
    --env-vars      Show the envVars section
    --envvars       Show the envVars section
    --examples      Show the examples section
```


You can get an index of the available helpers, e.g.

```shell
luca describe features
luca describe clients
luca describe servers # etc 
```

You can describe multiple things at once:

```shell
luca describe self # describes the container
luca describe git fs proc networking # describe all of these features in concatenated output
```

Or you can request only specific aspects of the documentation (e.g. examples)

```shell
luca describe git fs --examples --usage
```

This is pretty helpful if you already kind of know which features you want to use and want the necessary context in a single document.

## Testing snippets of luca code

You can test snippets with the `luca eval` command.

```shell
luca eval "container.feature('proc').exec('ls')"
```

The `eval` command automatically discovers and registers every helper.

## The Luca REPL / Console

You can run `luca console` and have a REPL.  If you have TTY capabilities this is a very useful tool and can stay alive.


Everything starts with `container`. You don't need to memorize APIs — you need to know the shape of things and how to ask the container what it can do. This guide teaches you that shape. From there, the system reveals itself.

## The Container

The container is a singleton that holds everything your application needs. It organizes components into **registries** — collections you can query.

```js
// What registries exist?
container.registries
// => ['features', 'clients', 'servers', 'commands', 'endpoints']

// What's available in each?
container.features.available
// => ['fs', 'git', 'proc', 'vm', 'networking', 'os', 'grep', ...]
container.clients.available
// => ['rest', 'websocket', ...]
container.servers.available
// => ['express', 'websocket', ...]
```

## Getting a Helper

Use the factory function to get an instance. Features auto-enable on first access.

```js
const fs = container.feature('fs')
const rest = container.client('rest')
const express = container.server('express')
```

Core features are also available as top-level shortcuts in eval/repl contexts:

```js
fs.readFile('package.json')
git.branch
proc.exec('ls')
```

## Discovery: The Only Pattern You Need

Every registry can describe its contents. Every helper instance can describe itself.

```js
// From a registry — get docs for any helper by name
container.features.describe('fs')       // => markdown API docs
container.features.describeAll()        // => condensed overview of all features
container.clients.describe('rest')      // => markdown API docs for rest client

// From the CLI
// luca describe fs
// luca describe clients
// luca describe

// From a helper instance — structured introspection
const fs = container.feature('fs')
fs.introspect()         // => { description, methods, getters, events, state, options }
fs.introspectAsText()   // => same info as readable markdown
```

The container itself is introspectable:

```js
container.inspect()          // structured object with all registries, state, events
container.inspectAsText()    // full markdown overview
```

**This is the core loop: if you know something exists, you can learn everything about it at runtime.**

## State

Every helper has observable state — a live object you can read, write, and watch.

```js
const feature = container.feature('fs')

// Read
feature.state.current          // snapshot of all state
feature.state.get('someKey')   // single value

// Write
feature.state.set('key', 'value')

// Watch
feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
})
```

The container itself has state too: `container.state.current`, `container.state.observe()`.

## Events

Every helper is an event emitter. Components announce things without knowing who listens.

```js
feature.on('someEvent', (...args) => { })
feature.once('someEvent', (...args) => { })
feature.emit('someEvent', data)
await feature.waitFor('someEvent')  // promise that resolves on next emit
```

The container emits lifecycle events:

```js
container.on('featureEnabled', (feature) => { })
container.on('stateChange', (key, value) => { })
```

What events does a helper emit? Ask it:

```js
fs.introspect().events
// => { fileChanged: { description, arguments }, ... }
```

## Utilities

The container provides common utilities — no external imports needed:

```js
container.utils.uuid()                          // v4 UUID
container.utils.hashObject(obj)                 // deterministic hash
container.utils.stringUtils.camelCase('foo-bar')
container.utils.lodash.groupBy(items, 'type')
container.paths.resolve('src', 'index.ts')      // path operations
```

## Summary

The entire API surface is discoverable from a single object:

| Want to know...              | Ask                                    |
|------------------------------|----------------------------------------|
| What registries exist?       | `container.registries`                 |
| What features are available? | `container.features.available`         |
| Full docs for a feature?     | `container.features.describe('fs')`    |
| All features at a glance?    | `container.features.describeAll()`     |
| Structured introspection?    | `feature.introspect()`                 |
| What state does it have?     | `feature.state.current`                |
| What events does it emit?    | `feature.introspect().events`          |
| Full container overview?     | `container.inspectAsText()`            |

You now know the shape. For specifics — what methods `fs` has, what options `express` takes, what events `git` emits — ask the container. It will tell you everything.

## Extending the Container with `luca scaffold`

The `scaffold` command generates boilerplate for new helpers — features, commands, clients, servers, and endpoints. It writes the file, sets up the correct structure, and you fill in the logic.

```shell
luca scaffold <type> <name> --description "What it does"
```

Every scaffolded helper is auto-discovered by the container at runtime. After generating, the workflow is:

```shell
luca scaffold <type> <name>        # 1. Generate the file
# edit the generated file           # 2. Add your logic
luca describe <name>               # 3. Verify it shows up and reads correctly
```

### Learning about a helper type

Before building something, you can read the full tutorial for any type:

```shell
luca scaffold feature --tutorial
luca scaffold command --tutorial
luca scaffold endpoint --tutorial
luca scaffold client --tutorial
luca scaffold server --tutorial
```

These tutorials cover imports, schemas, class structure, registration, conventions, and complete examples. They're the authoritative reference for how each helper type works.

### When to use each type

| You need to…                                      | Scaffold a…  | Example                                                        |
|---------------------------------------------------|--------------|----------------------------------------------------------------|
| Add a reusable local capability (caching, crypto) | **feature**  | `luca scaffold feature disk-cache --description "File-backed key-value cache"` |
| Add a CLI task (build, deploy, generate)           | **command**  | `luca scaffold command deploy --description "Deploy to production"` |
| Talk to an external API or service                 | **client**   | `luca scaffold client github --description "GitHub API wrapper"` |
| Accept incoming connections (HTTP, WS)             | **server**   | `luca scaffold server mqtt --description "MQTT broker"` |
| Add a REST route to `luca serve`                   | **endpoint** | `luca scaffold endpoint users --description "User management API"` |

### Use case: adding a new command

Commands are the most common thing you'll scaffold. They extend the `luca` CLI with project-specific tasks.

```shell
luca scaffold command sync-data --description "Pull latest data from staging"
```

This creates `commands/sync-data.ts`. The generated file exports a description, an args schema (Zod — each field becomes a `--flag`), and a default async handler that receives parsed options and the container:

```typescript
export default async function syncData(options, context) {
  const { container } = context
  const fs = container.feature('fs')
  const rest = container.client('rest')
  // your logic here
}
```

Run it with `luca sync-data`. Flags are auto-parsed. Help is auto-generated via `luca sync-data --help`.

### Use case: adding a new feature

Features are container-managed capabilities with observable state, events, and self-documenting schemas.

```shell
luca scaffold feature rate-limiter --description "Token bucket rate limiter"
```

This creates `features/rate-limiter.ts` with Zod schemas for state, options, and events, a class that extends `Feature`, and module augmentation for TypeScript. The key things to fill in:

- **State schema** — fields that should be observable and reactive
- **Options schema** — constructor parameters validated at creation time
- **Events schema** — what this feature emits so consumers can react
- **`afterInitialize()`** — setup logic (never override the constructor)
- **Public methods** — each needs a JSDoc block with `@param`, `@returns`, `@example`

Once saved, `container.feature('rateLimiter')` works from any command, endpoint, or script.

### Use case: adding a new endpoint

Endpoints are file-based REST routes served by `luca serve`.

```shell
luca scaffold endpoint webhooks --description "Incoming webhook receiver"
```

This creates `endpoints/webhooks.ts`. Export handler functions named after HTTP methods (`get`, `post`, `put`, `delete`), and Zod schemas named `getSchema`, `postSchema`, etc. for automatic validation:

```typescript
export const path = '/api/webhooks'

export async function post(params, ctx) {
  const { container } = ctx
  // handle incoming webhook
  return { received: true }
}
```

Run `luca serve` and it's live at the exported path. Validation errors return 400 automatically. An OpenAPI spec is generated at `/openapi.json`.

### Use case: adding a new client

Clients wrap external service connections. Most extend `RestClient` for HTTP APIs.

```shell
luca scaffold client stripe --description "Stripe payments API"
```

This creates `clients/stripe.ts`. Set `baseURL` via the options schema default, add API methods that delegate to `this.get()`, `this.post()`, etc., and use `afterInitialize()` for auth setup. Then `container.client('stripe')` is available everywhere.

### Scaffold options

```shell
luca scaffold command deploy --description "..."   # Write to commands/deploy.ts
luca scaffold endpoint users --print               # Print to stdout instead of writing
luca scaffold feature cache --output lib/cache.ts   # Override output path
```

See `references/api-docs/` for the full pre-generated API reference.
