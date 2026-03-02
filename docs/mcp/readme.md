# Luca Development Guide

You are working in a **luca project**. The luca container provides all capabilities your code needs. Do not install npm packages or import Node.js builtins directly.

## The Contract

Every capability goes through the container. If you need something that doesn't exist, build it as a feature, client, or server. If it wraps a third-party library, the helper IS the interface — consumer code never imports the library directly.

## Import Rule

All consumer code imports from `@soederpop/luca` only:

```ts
import { Feature, features, z, FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Client, clients, RestClient, ClientStateSchema } from '@soederpop/luca/client'
import { Server, servers, ServerStateSchema } from '@soederpop/luca'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
```

Never import from `fs`, `path`, `crypto`, or other Node builtins. Never import third-party packages in consumer code. The only exception is inside helper implementations themselves — a feature that wraps a library may import it.

## Zod v4

This project uses **Zod v4** — import `z` from `@soederpop/luca`, never from `'zod'` directly. All option, state, and event schemas use Zod v4 syntax. Key patterns:

```ts
// Extending base schemas (options, state, events)
export const MyStateSchema = FeatureStateSchema.extend({
  count: z.number().default(0).describe('Number of items'),
  label: z.string().optional().describe('Display label'),
})

// Events use z.tuple() for listener arguments
export const MyEventsSchema = FeatureEventsSchema.extend({
  itemAdded: z.tuple([z.string().describe('key'), z.number().describe('index')]),
})

// Type inference
export type MyState = z.infer<typeof MyStateSchema>
```

Zod v4 differences from v3 that matter:
- `z.string().check(...)` replaces some v3 refinement patterns
- `.toJSONSchema()` is built-in on any schema — no external library needed
- Error customization uses `z.string({ error: "message" })` not `.refine()` for simple cases
- `z.interface()` exists for recursive/lazy object types
- Do NOT use `z.nativeEnum()` — use `z.enum()` instead

## Dependencies

If the project has `node_modules` and a package manager, helper implementations can import third-party libraries internally. If not (e.g. running via the `luca` binary's VM), all code must import only from `@soederpop/luca`.

## Discovering Capabilities

The container has registries for features, clients, servers, commands, and endpoints. **Do not guess** what is available — use your MCP tools to discover it:

1. **`find_capability`** — Overview of all features, clients, and servers with descriptions. Start here.
2. **`list_registry`** — List all names in a specific registry (features, clients, servers, commands, endpoints).
3. **`describe_helper`** — Full API docs for a specific helper (methods, options, state, events). Call this before writing code that uses a helper.
4. **`eval`** — Once you know what you need, prototype calls in the live sandbox before writing them into files.

## Mini Examples

### Feature with composition

Features access other features via `this.container.feature(...)`:

```ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

export const ConfigStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().default(false).describe('Whether config has been loaded'),
})

export const ConfigOptionsSchema = FeatureOptionsSchema.extend({
  filePath: z.string().default('config.json').describe('Path to config file'),
})

export const ConfigEventsSchema = FeatureEventsSchema.extend({
  configLoaded: z.tuple([z.record(z.unknown()).describe('parsed config')]),
})

export class Config extends Feature<z.infer<typeof ConfigStateSchema>, z.infer<typeof ConfigOptionsSchema>> {
  static override shortcut = 'features.config' as const
  static override stateSchema = ConfigStateSchema
  static override optionsSchema = ConfigOptionsSchema
  static override eventsSchema = ConfigEventsSchema
  static override description = 'Loads and manages project configuration'

  /** Load and parse the config file */
  async load() {
    const fs = this.container.feature('fs')
    const raw = await fs.readFile(this.options.filePath)
    const data = JSON.parse(raw)
    this.state.set('loaded', true)
    this.emit('configLoaded', data)
    return data
  }
}

declare module '@soederpop/luca' {
  interface AvailableFeatures { config: typeof Config }
}
export default features.register('config', Config)
```

### Client with composition

Clients access features and other clients via `this.container`:

```ts
import { z } from 'zod'
import { Client, clients, ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

export const GithubOptionsSchema = ClientOptionsSchema.extend({
  token: z.string().describe('GitHub personal access token'),
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
})

export const GithubEventsSchema = ClientEventsSchema.extend({
  issuesFetched: z.tuple([z.number().describe('count')]),
})

export class GithubClient extends Client<z.infer<typeof ClientStateSchema>, z.infer<typeof GithubOptionsSchema>> {
  static override shortcut = 'clients.github' as const
  static override optionsSchema = GithubOptionsSchema
  static override eventsSchema = GithubEventsSchema
  static override description = 'GitHub API client using container REST client'

  /** Fetch open issues */
  async issues() {
    const rest = this.container.client('rest')
    const res = await rest.get(`https://api.github.com/repos/${this.options.owner}/${this.options.repo}/issues`, {
      headers: { Authorization: `token ${this.options.token}` },
    })
    this.emit('issuesFetched', res.data.length)
    return res.data
  }
}

declare module '@soederpop/luca' {
  interface AvailableClients { github: typeof GithubClient }
}
export default clients.register('github', GithubClient)
```

## Workflow

1. **`find_capability`** — Search what already exists before writing anything
2. **`describe_helper`** — Read the full API docs for the helper you need
3. **`eval`** — Prototype and test container API calls in the sandbox
4. **`scaffold`** — Generate correct boilerplate when building something new
5. **Write the file** — Using the patterns from the scaffold

## Portability

Code that only imports from `@soederpop/luca` can be copied between any luca project. That's the goal. Features, clients, servers, and commands written this way are portable building blocks.
