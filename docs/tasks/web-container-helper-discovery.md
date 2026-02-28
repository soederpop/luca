---
repeatable: false
---

# Implement Helper Discovery for WebContainer

The NodeContainer has a `helpers` feature (`src/node/features/helpers.ts`) that provides unified discovery across all registries. The WebContainer has no equivalent. Implement helper discovery for the web container.

## Context

The node `Helpers` feature provides:
- `container.helpers.discover('features')` — scan conventional folders and register what it finds
- `container.helpers.discoverAll()` — discover across all registry types
- `container.helpers.available` — unified view of all registries
- `container.helpers.lookup(type, name)` and `container.helpers.describe(type, name)`

The web container has `features` and `clients` registries (Client is attached via `extension.ts`, which calls `container.use(Client)` and triggers `registerHelperType('clients', 'client')`). It has `RestClient` and `SocketClient` available. No servers, commands, or endpoints registries.

## What to Build

### 1. Create `src/web/features/helpers.ts`

Port the node `Helpers` feature to work in the browser environment. Key differences from the node version:

- **No filesystem scanning** — the browser can't scan directories. Instead, discovery should work via explicit registration or a manifest/config object that lists available helpers and their import paths.
- **Registry scope** — cover `features` and `clients` (both already attached). The `registryMap` should reflect what the web container actually has.
- **No dynamic `import()` from disk** — helper modules need to be bundled or loaded via URL. Consider accepting a map of `{ name: () => import('./my-feature.js') }` lazy loaders.
- **Keep the same public API surface** — `discover()`, `discoverAll()`, `available`, `lookup()`, `describe()` should all work identically from the consumer's perspective.

### 2. Register it in `src/web/extension.ts`

Add the helpers feature to the web extension so it's available as `container.feature('helpers')` / `container.helpers`.

### 3. Approach for Browser Discovery

Since there's no filesystem to scan, discovery needs a different mechanism. Recommended approach:

```typescript
// Option A: Manifest-based discovery
const helpers = container.feature('helpers', {
  enable: true,
  manifest: {
    features: {
      myFeature: () => import('./features/my-feature.js'),
    }
  }
})
await helpers.discoverAll()
```

This keeps the same `discover()` / `discoverAll()` API but replaces folder scanning with a lazy-import manifest. The manifest can be generated at build time by a bundler plugin or written by hand.

### 4. Shared Base

Look at whether a base `Helpers` class can be extracted to `src/features/helpers.ts` (universal, not node or web specific) with the shared API surface (`available`, `lookup`, `describe`, state/events schemas). Then `src/node/features/helpers.ts` and `src/web/features/helpers.ts` extend it with their environment-specific discovery strategies (filesystem vs manifest).

## Files to Touch

- `src/features/helpers.ts` — new, shared base class with common API
- `src/web/features/helpers.ts` — new, web-specific discovery via manifest
- `src/node/features/helpers.ts` — refactor to extend shared base
- `src/web/extension.ts` — register the web helpers feature
- `src/schemas/base.ts` — only if new shared schemas are needed

## Acceptance Criteria

- `container.helpers.available` works in both node and web containers
- `container.helpers.discover('features')` works in web via manifest config
- `container.helpers.lookup()` and `container.helpers.describe()` work in web
- Node behavior is unchanged (existing tests still pass)
- The shared base class eliminates duplicated logic between node and web
