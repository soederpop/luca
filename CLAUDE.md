# LUCA

Lightweight Universal Conversational Architecture. Runtime is bun.

## Vision

This is a self-programming AGI framework. The container runtime has typed registries of Features, Clients, and Servers — all introspectable at runtime. An LLM uses this by writing scripts against its own features, not by calling pre-defined tools. When it needs a capability it doesn't have, it builds a new Feature and registers it. The single action primitive is: write TypeScript, execute it in the VM, read the result.


## Path Aliases

`@/*` maps to `src/*`, `@/node/*` to `src/node/*`, `@/web/*` to `src/web/*`, `@/identities/*` to `identities/*`. Always use these in imports.

## Architecture

The container is a per-process singleton with observable `State`, an event `Bus`, and registries for Features, Clients, and Servers. `NodeContainer` extends `Container` for server-side (bun). Each subprocess that imports the container gets its own singleton scoped to its folder's `package.json`.

### Class Hierarchy

- `Helper` — base class with state, events, introspection, cacheKey
  - `Feature` — `enable()`/`disable()`, registered in `FeaturesRegistry`
  - `Client` — `connect()`/`configure()`, registered in `ClientsRegistry`
    - `RestClient` — axios-based HTTP
  - `Server` — `start()`/`stop()`, registered in `ServersRegistry`

### Introspection

Build-time TS AST analysis produces runtime-accessible API docs. Any helper instance can call `this.introspect()` or `this.introspectAsText()`. Run `bun run introspect` to regenerate. This is how the AI learns its own API surface.

## Conventions for Writing Features

Node features extend from `src/node/feature.ts` (which re-exports a node-typed `Feature` that knows its container is a `NodeContainer`).

### Pattern

```typescript
import { Feature, features, type FeatureOptions, type FeatureState } from '../feature.js'

// 1. State interface — always extend FeatureState
export interface ThingState extends FeatureState {
  someValue: string
}

// 2. Options interface — always extend FeatureOptions
export interface ThingOptions extends FeatureOptions {
  configParam?: string
}

// 3. Class with JSDoc on the class and every public method
/**
 * Short description of what this feature does.
 *
 * @extends Feature
 */
export class Thing extends Feature<ThingState, ThingOptions> {
  // Required: dot-path shortcut for container access
  static override shortcut = 'features.thing' as const

  override get initialState(): ThingState {
    return {
      ...super.initialState,
      someValue: 'default'
    }
  }

  /**
   * Description of method.
   *
   * @param {string} arg - what it is
   * @returns {Promise<string>} what comes back
   */
  async doSomething(arg: string): Promise<string> {
    // Access other features via this.container.feature('x') or this.container.x
    return arg
  }
}

// 4. Register with the features registry
export default features.register('thing', Thing)
```

### Registration in NodeContainer

After creating a feature file in `src/node/features/`:

1. Add the side-effect import in `src/node/container.ts`: `import './features/thing'`
2. Add the type import: `import type { Thing } from './features/thing'`
3. Add to `NodeFeatures` interface: `thing: typeof Thing`
4. Add to the export block: `type Thing`
5. Optionally add as a property on `NodeContainer` class (`thing?: Thing` or `thing!: Thing` if auto-enabled)
6. If auto-enabled, add `this.feature('thing', { enable: true })` in the constructor

### Module Augmentation for Clients

Clients use `declare module '@/client'` to augment `AvailableClients`:

```typescript
import { RestClient, type ClientOptions, type ClientState } from '@/client'

declare module '@/client' {
  interface AvailableClients {
    myService: typeof MyServiceClient
  }
}

export class MyServiceClient<T extends MyServiceState> extends RestClient<T> {
  static attach(container: Container & ClientsInterface) {
    container.clients.register('myService', MyServiceClient)
    return container
  }
}
```

### Module Augmentation for Servers

Servers use `declare module '../server/index'` to augment `AvailableServers`:

```typescript
declare module '../server/index' {
  interface AvailableServers {
    myServer: typeof MyServer
  }
}
```

## JSDoc Style

Every public method gets full JSDoc with `@param`, `@returns`, and `@example` blocks. The introspection system parses these at build time to generate runtime API docs that the AI reads. Thorough JSDoc directly improves Luca's ability to use its own features.

## Key Files

- `src/container.ts` — base Container class
- `src/node/container.ts` — NodeContainer with all node feature imports and registration
- `src/node/feature.ts` — node-specific Feature base (re-exports with typed container)
- `src/feature.ts` — universal Feature base + FeaturesRegistry
- `src/helper.ts` — Helper base (state, events, introspection)
- `src/registry.ts` — generic Registry class
- `src/state.ts` — observable State
- `src/agi/container.server.ts` — AGIContainer extending NodeContainer
- `src/agi/features/identity.ts` — identity + memory system
- `src/agi/features/container-chat.ts` — LLM code generation against introspected features
- `src/mcp/index.ts` — MCP server exposing `evaluate_code` tool
- `src/introspection/` — build-time TS AST scanner
- `identities/bootstrapper/` — root AGI identity (system prompt, memories)

## AGI / Identity System

`AGIContainer` loads an identity from `identities/<name>/`. An identity is a `system-prompt.md` + `memories.json`. Memories have types: `biographical`, `procedural`, `longterm-goal`, `shortterm-goal`, `notes`, `capability`. The `ContainerChat` feature uses introspected feature docs to generate executable VM code from natural language.

## Current Phase: Phase 0

Building the root process — the top-level AGI container from which Luca's life starts. The root identity needs full self-awareness of its architecture, the script-first principle (no tool calls, write code instead), and the ability to persist and grow its own memories over time.
