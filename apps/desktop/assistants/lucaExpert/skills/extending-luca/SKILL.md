---
name: extending-luca
description: How to extend a Luca-based project by adding new features, commands, endpoints, clients, or servers. Use this skill whenever the request is to build a new luca helper — "add a feature that does X", "make a `luca foo` command", "wrap this library as a container helper", "expose a REST endpoint via `luca serve`" — or when starting a new capability inside a project with `features/`, `commands/`, `endpoints/`, or `luca.plugin.ts`. Covers the container mental model, the scaffold flow, the "features over commands" pattern, lifecycle, testing, and common pitfalls that cause a helper to silently fail to register.
---

# Extending the Luca Framework

Luca extends via **helpers** — self-registering modules that the container auto-discovers from convention folders. Adding capabilities means writing a helper, not editing framework code.

For discovering what already exists, run the container, or debugging existing helpers, use the `luca-framework` skill. This skill is specifically about *writing new* helpers.

## Types of helper

| Folder        | Type       | When                                                                                     |
|---------------|------------|------------------------------------------------------------------------------------------|
| `features/`   | Feature    | A reusable local capability (caching, wrapping a library, background service, state)     |
| `commands/`   | Command    | A CLI task (`luca myTask`) — usually a thin wrapper around a feature                     |
| `endpoints/`  | Endpoint   | An HTTP route served by `luca serve` (file-based routing)                                |
| `clients/`    | Client     | A wrapper around a network service or SDK (REST, WS, GraphQL)                            |
| `servers/`    | Server     | An inbound-connection surface (HTTP server, WS server, IPC socket, MCP)                  |

**Default to a feature.** The "features over commands" pattern (below) means most new logic starts as a feature; commands are the thinnest possible entry point.

## The core loop

Every helper is built by the same three-step loop:

1. **Discover** — `luca describe <name>` to check nothing already does what you need. Use `luca describe features`, `luca describe clients`, `luca describe servers` for the index.
2. **Scaffold** — `luca scaffold <type> --tutorial` first, then `luca scaffold <type> <name> --description "..."`. The tutorial is authoritative; read it before writing code.
3. **Prototype** — `luca eval "container.feature('yourHelper').someMethod()"` to test as you go. No rebuild required — helpers are hot-loaded on the next process start.

Do not skip step 1. Duplicating a container feature is the single most common mistake — every capability listed in `luca describe features` is a helper you don't have to write.

## Features over commands

The pattern this project (and every Luca project) follows:

- **Business logic lives in a feature.** State, events, lifecycle, methods.
- **The command is a thin wrapper.** Parse args → call `container.feature('foo').doThing(opts)` → print result.
- **Endpoints, native app surfaces, and other commands** all reuse the same feature.

Concrete example from this repo:
- `features/communications.ts` — the whole comms behavior (channels, state, events).
- `commands/comms-service.ts` — parses CLI args, spins up the feature, prints output. Trivial.
- The `endpoints/channels` routes (which the desktop app's Channels surface calls) and any other consumer also use the same feature.

If you find yourself putting real logic in a command handler, stop and extract it into a feature. This is what makes the same behavior reachable from CLI, HTTP, the native apps, and other features without duplication.

## Adding a feature

```sh
luca scaffold feature --tutorial          # read this first
luca scaffold feature disk-cache --description "File-backed key-value cache"
```

A feature is a class that extends `Feature` with Zod schemas for state, options, and events. The registration happens inside the class via a static block — you do not touch any registry file.

Minimal shape:

```ts
import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema } from 'luca'

declare module 'luca' {
  interface AvailableFeatures {
    diskCache: typeof DiskCache
  }
}

export const DiskCacheStateSchema = FeatureStateSchema.extend({})
export const DiskCacheOptionsSchema = FeatureOptionsSchema.extend({
  directory: z.string().optional().describe('Storage directory path'),
})

export class DiskCache extends Feature<
  z.infer<typeof DiskCacheStateSchema>,
  z.infer<typeof DiskCacheOptionsSchema>
> {
  static override shortcut = 'features.diskCache' as const
  static override stateSchema = DiskCacheStateSchema
  static override optionsSchema = DiskCacheOptionsSchema
  static { Feature.register(this, 'diskCache') }

  afterInitialize() {
    // setup — NOT the constructor, NOT awaited
  }
}

export default DiskCache
```

Key rules:

- **Do not override the constructor.** Use `afterInitialize()` for setup. It runs after `this.container`, `this.options`, `this.state` are wired.
- **`afterInitialize` is not awaited.** Async work goes behind an explicit method or a `start()` / `enable()` lifecycle hook the consumer calls.
- **Every Zod field needs `.describe()`.** This IS the documentation `luca describe` renders.
- **Every public method needs JSDoc with `@param`, `@returns`, `@example`.** Same reason.
- **State is observable** — use `this.state.set()` / `this.state.get()`, not instance properties, for anything reactive.

Full deep dive: [references/features.md](references/features.md).

## Adding a command

```sh
luca scaffold command --tutorial
luca scaffold command sync-data --description "Pull data from staging"
```

Command files export a default async handler plus a few named exports for schema, positionals, help metadata:

```ts
import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'

export const description = 'Pull data from staging'

export const argsSchema = z.object({
  json: z.boolean().default(false).describe('Machine-readable JSON output'),
  target: z.string().optional().describe('Directory to sync into'),
})

export const positionals = ['target']  // luca sync-data ./out => options.target === './out'

export const examples = [
  'luca sync-data ./out',
  { command: 'luca sync-data --json', description: 'Machine-readable output' },
]

export default async function syncData(
  options: CommandArgs<typeof argsSchema>,
  context: ContainerContext,
) {
  const { container } = context
  const result = await container.feature('yourFeature').sync(options.target)
  if (options.json) return console.log(JSON.stringify(result))
  container.feature('ui').print.green(`✓ synced ${result.count}`)
}
```

Conventions:

- **Support `--json`.** Gate all `ui.print.*` behind `if (!options.json)`. With `--json`, emit exactly one `JSON.stringify(...)`.
- **Fail loud.** Throw on real errors (framework prints them cleanly and exits non-zero). For soft failures where you already printed diagnostics, `process.exitCode = 1`.
- **DELETE endpoints:** `delete` is a JS reserved word — `export { del as delete }`.

Full deep dive: [references/commands.md](references/commands.md).

## Container rules (non-negotiable)

- **Never `import` from `fs`, `path`, or other Node builtins** in consumer code. Use `container.feature('fs')` and `container.paths`. Direct imports are only allowed *inside* the feature that wraps that library.
- **Never import third-party libs directly** if a feature or client already wraps them (`chalk` → `ui.colors`, `figlet` → `ui.asciiArt`, `js-yaml` → `feature('yaml')`, `uuid` → `container.utils.uuid()`, `lodash` → `container.utils.lodash`).
- **Bun globals (`Bun.spawn`, `Bun.serve`) don't work in handlers.** Use `container.feature('proc').execSync()` or Node's `child_process`.
- **Discover before writing.** `luca describe features` first — the container almost certainly has what you need.

## Testing a helper during development

The fastest loop is `luca eval`. No build step, no restart.

```sh
# Feature exists and can be instantiated
luca eval "container.feature('diskCache')"

# Call a method
luca eval "await container.feature('diskCache').set('k', 'v')"

# Verify description reads correctly
luca describe diskCache
luca describe diskCache.set          # single method
luca describe diskCache --ts         # TS shape
luca describe diskCache --events     # events emitted
```

For commands:

```sh
luca my-command --help               # help renders — args, subcommands, examples
luca my-command --json | jq          # machine output round-trips
```

For runnable-markdown validation, write a `docs/scratch/foo.md` with `ts`-tagged code blocks and run `luca run docs/scratch/foo.md`. The `container` global is in scope in every block. Variables persist across blocks unless a block uses a top-level await.

For long-running features (servers, watchers), pair development with `luca console` — a persistent REPL with the container in scope.

## The `luca.plugin.ts` entry point

Most projects don't need this. Write a `luca.plugin.ts` only when packaging your project as a plugin that *other* Luca projects can mount via `LUCA_PLUGINS=your-project` or `container.use('your-project')`.

By the time `attach(container, { pluginDir })` runs, the framework has already auto-discovered everything in `features/`, `commands/`, `endpoints/`, `clients/`, `servers/`. `attach` is only for non-standard assets: registering assistants, lending skills folders, wiring context objects.

Full walkthrough: [references/plugins.md](references/plugins.md).

## Common pitfalls (in order of frequency)

1. **Setup work put in the constructor.** Symptom: `this.container` is undefined. Fix: move it to `afterInitialize()`.
2. **Async work in `afterInitialize` that the framework silently drops.** `afterInitialize` is NOT awaited. Put async setup behind an explicit `start()` / `enable()` method that a consumer calls.
3. **Missing `static { Feature.register(this, 'name') }` block.** Symptom: `container.feature('name')` throws "unknown feature". The class is imported but never registered.
4. **`Bun.spawn` in a handler.** Symptom: silent hang or "Bun is not defined". Use `container.feature('proc').execSync()`.
5. **Two long-running services fighting over a port.** Symptom: `EADDRINUSE`. Use `container.feature('proc').findPidsByPort(port)` + `.kill(pid)` from `luca eval` to clear it; add `--force` support to your server command.
6. **Direct imports of `fs` / `path`.** Symptom: works on your machine, breaks under `luca run` sandbox or in a browser container. Route through `container.feature('fs')` and `container.paths`.
7. **DELETE endpoint named `delete`.** Symptom: syntax error. `export { del as delete }`.
8. **Zod fields without `.describe()`.** Symptom: `luca describe` shows blank docs. Every field must have a description.
9. **Long-running commands returning early.** Symptom: `luca my-server` exits immediately. End the handler with `await new Promise(() => {})` and register a `SIGINT` cleanup handler.
10. **Skill / helper folder outside a discovery path.** Features and commands must live in `features/`, `commands/`, etc. Custom locations require an explicit `container.helpers.discoverAll({ dirs: [...] })` call in `luca.cli.ts` — usually done via `luca.plugin.ts` for reusable layers.

## References

- [references/features.md](references/features.md) — Feature class deep dive: schemas, lifecycle, state/events, method conventions.
- [references/commands.md](references/commands.md) — Command exports deep dive: positionals, subcommands, help metadata, JSON output, exit codes.
- [references/plugins.md](references/plugins.md) — `luca.plugin.ts` pattern for packaging a project as a reusable layer.
- Use the `luca-framework` skill in parallel for the runtime-discovery side (`luca describe`, `luca eval`, container introspection).
