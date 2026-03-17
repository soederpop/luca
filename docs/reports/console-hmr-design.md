---
tags:
  - console
  - hmr
  - repl
  - design
---
# Console HMR Design Research

Add a `--hmr` flag to `luca console` that watches source files and hot-swaps feature instances in the live REPL session, preserving state where possible.

## How the Console Works Today

The `luca console` command (`src/commands/console.ts`) creates a REPL that:

1. Calls `container.helpers.discoverAll()` to load all features, commands, endpoints
2. Snapshots every available feature into a `featureContext` object via `container.feature(name)` for each name
3. Optionally loads a `luca.console.ts` project module and merges its exports
4. Optionally runs `--eval` code/script/markdown before the REPL starts
5. Creates a `Repl` feature instance with a `vm.Context` built from the snapshot
6. Enters a hand-rolled readline loop (`repl.ts`) that evaluates expressions in that VM context

The REPL's `_vmContext` is a **mutable plain object** — variables can be reassigned at runtime (`ctx.featureName = newInstance`). Tab completion reads from `Object.keys(ctx)` dynamically, so new/replaced bindings are immediately visible.

## Architectural Facts Relevant to HMR

### helperCache is module-private

`container.ts:618` — `const helperCache = new Map()`. There is no public API to evict or replace a cached feature instance. Calling `container.feature('fs')` with the same options always returns the same object. Any HMR implementation needs either:
- A new `container.evictHelper(cacheKey)` method
- A bypass that creates instances outside the cache

### attachToContainer uses configurable: true

`feature.ts` — `Object.defineProperty(this.container, shortcutName, { get: () => this, configurable: true })`. The property descriptor **can** be redefined, which is the only existing affordance for swapping a feature on the container object.

### vm.loadModule() always reads fresh from disk

`vm.ts` — reads file content via `container.fs.readFile()`, transpiles with esbuild `transformSync`, runs in a `vm.Script` context. No module cache to bust. But this runs in a CJS-like VM sandbox — real ES `import` statements inside the file won't work.

### Bun import() cache busting

The only cache-busting pattern in the codebase is `Endpoint.reload()` (`endpoint.ts:176`): `import(\`${path}?t=${Date.now()}\`)`. This works for Bun's native module loader and preserves real ES module semantics.

### State has no serialize/deserialize

`State` (`state.ts`) is an in-memory observable key-value bag with `set()`, `setState()`, `clear()`, and observer callbacks. There is no `toJSON()`/`fromSnapshot()` API. Transferring state between instances requires manually reading `state.current` from old and calling `state.setState()` on new.

### FileManager has chokidar file watching

`file-manager.ts` — `fileManager.watch()` uses chokidar and emits `"file:change"` events with `{ type, path }`. Currently not wired to anything automatically. This is the primitive we'd compose for watching source files.

### Feature self-registration is a static side effect

Features register via `static { Feature.register(this, 'name') }` which stores the **class constructor** in a module-level `FeaturesRegistry` Map. Re-importing a module would call `register()` again with a new constructor — the registry would need to handle overwrites.

## The HMR Flow (Conceptual)

```
[file change detected]
  → identify which feature(s) the file maps to
  → re-import the module (cache-busted)
  → new class constructor registers over old one
  → snapshot old instance state: state.current + any serializable instance data
  → evict old instance from helperCache
  → create new instance via container.feature(name)
  → transfer state: newInstance.state.setState(oldState)
  → patch REPL vm context: ctx[featureName] = newInstance
  → re-define container shortcut property to point to new instance
  → print "[HMR] Reloaded: featureName" in REPL
```

## Open Design Questions

### 1. Scope — which files trigger a reload?

- Just feature source files (`src/node/features/*.ts`)?
- Also command files, `luca.console.ts`, endpoint files?
- Or anything under `src/`?

Recommendation: Start with feature files only. Commands and endpoints are less stateful and easier to add later.

### 2. State transfer strategy

- **Best-effort `state.current` transfer**: Read `oldInstance.state.current`, call `newInstance.state.setState(snapshot)`. Simple, covers most cases.
- **Opt-in hooks**: Features declare `serialize()` / `deserialize()` methods for fine-grained control (e.g., FileManager could note which directories it was watching but not try to transfer the chokidar FSWatcher handle).
- **Hybrid**: Always transfer `state.current`, and if the feature has a `hmrSerialize()` hook, use that for additional instance data.

Non-state instance data (open file handles, chokidar watchers, readline interfaces, cached esbuild services) cannot be naively transferred. Features with complex resources would need explicit HMR support or accept that those resources restart fresh.

### 3. Module re-import strategy

Two options:

**Option A — Bun `import()` with `?t=` cache busting**: Real ES module semantics, `import` statements inside the feature file work. The new module's `static {}` block re-registers the class. This is what `Endpoint.reload()` already does.

**Option B — `vm.loadModule()`**: Always reads fresh from disk, no cache issues. But runs in a CJS sandbox — internal `import` statements won't resolve. Feature files heavily use `import`, so this likely won't work.

Recommendation: Option A. It's proven in the codebase and preserves full module semantics.

### 4. Registry re-registration

`Feature.register()` currently does `features.register(id, SubClass)` which calls `registry.members.set(id, SubClass)`. A re-import with a new class constructor would overwrite the old entry. This actually works — `Map.set` overwrites silently. But we should verify there are no side effects in `interceptRegistration` hooks or other registration logic that would break.

### 5. REPL context patching — automatic vs explicit

- **Automatic**: FileManager watches, detects change, swaps feature, patches `ctx[name]`, prints HMR message. User sees updated behavior on next expression.
- **Explicit**: User types `hmr.reload('fs')` or similar in the REPL to trigger a reload manually.
- **Both**: Auto-reload on file change, plus a manual `hmr.reload('name')` for forcing reloads or reloading things that aren't file-backed.

Recommendation: Both. Auto is the main UX, manual is the escape hatch.

### 6. Feedback in the REPL

Print a colored message when a feature reloads:
```
[HMR] Reloaded: fs (state transferred)
[HMR] Reloaded: diskCache (fresh — no prior state)
[HMR] Error reloading vm: SyntaxError: Unexpected token (kept old instance)
```

This should be non-intrusive — printed above the prompt line if possible.

### 7. Failure mode

If the new code has a syntax error or the constructor throws:
- Keep the old instance alive
- Print the error in the REPL
- Do not crash the session

This is the only sane approach for a dev tool.

## Implementation Sketch

### New infrastructure needed

1. **`container.evictHelper(type, id, options?)`** — public method on Container that deletes from `helperCache` and cleans up `featureIdToHelperCacheKeyMap` and `contextMap`
2. **`Feature.prototype.hmrSerialize?()` / `hmrDeserialize?(data)`** — optional hooks for features that need custom state transfer beyond `state.current`
3. **`registry.register()` handling overwrites** — verify this works cleanly, add a `"re-registered"` event if useful
4. **File-to-feature mapping** — a way to know that `src/node/features/disk-cache.ts` corresponds to the `diskCache` feature ID

### Changes to existing code

1. **`src/commands/console.ts`** — add `--hmr` flag to `argsSchema`, wire up file watching and the reload loop when enabled
2. **`src/container.ts`** — expose `evictHelper()` (or a more targeted `replaceFeature()`)
3. **`src/node/features/repl.ts`** — expose a method to patch the VM context (or just expose `_vmContext` which is already accessible)

### Rough dependency graph

```
argsSchema adds --hmr flag
  → console handler checks for --hmr
  → starts FileManager.watch() on src/ directory
  → subscribes to "file:change" events
  → on change: resolveFeatureFromPath(changedFile)
  → cache-bust import the module
  → container.evictHelper('feature', featureId)
  → newInstance = container.feature(featureId, { enable: wasEnabled })
  → transfer state from old → new
  → patch repl._vmContext[featureId] = newInstance
  → print HMR message
```

## Risks and Unknowns

- **Circular dependency during re-import**: If feature A imports feature B at module level, and both are being reloaded, the order matters. May need to batch reloads or do a dependency-aware reload order.
- **Event listener cleanup**: Old feature instances may have registered listeners on the container event bus. Need to remove those or they'll fire on stale instances.
- **Observer cleanup**: State observers from the old instance need to be unsubscribed or they'll leak.
- **Features that modify globals**: Some features might set up global state (process event handlers, etc.) that won't be cleaned up by replacing the instance.
- **The `?t=` trick and TypeScript**: Bun handles `import('./foo.ts?t=123')` but we should verify this works for all feature files, especially those with complex re-exports.
