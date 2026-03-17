# Selector System

## Vision

Commands perform actions. Selectors return data. Together they form a complete agent tool interface — pick which commands and selectors you need and you get free assistant tools. Agents only need to know the external APIs of features, servers, and clients already in the container (which can be learned from `luca describe`).

## What Is a Selector?

A Selector is a new helper type (like Feature, Client, Server, Command) that:

- Extends `Helper` with a `select(options)` method that **returns data**
- Lives in a `SelectorsRegistry`, queryable via `container.selectors`
- Is instantiated via `container.selector('name', options)` factory
- Supports **caching** via `diskCache` — many selector values don't change if git SHAs don't change, so SHA makes a great cache key
- Is discoverable from a `selectors/` folder in projects, just like `commands/`
- Supports both **class-based** and **module-based** (export a `select` function) patterns

## Architecture — How It Maps to Existing Patterns

The implementation follows the exact same pattern as `Command`:

### Files to Create/Modify

1. **`src/schemas/base.ts`** — Add `SelectorStateSchema`, `SelectorOptionsSchema`, `SelectorEventsSchema`
2. **`src/selector.ts`** — New file mirroring `src/command.ts`:
   - `Selector` class extending `Helper` with `select()` method
   - `SelectorsRegistry` extending `Registry` with `discover()` support
   - `selectors` singleton, `helperCache`, `Selector.register()`, `Selector.attach()`
   - `AvailableSelectors` interface, `SelectorsInterface`, `SelectorFactory` type
   - Module-based pattern: `SimpleSelector` type for graft compatibility
3. **`src/node/container.ts`** — Import `Selector` + `SelectorsInterface`, add to `ClientsAndServersInterface`, wire `this.use(Selector)`
4. **`src/node/features/helpers.ts`** — Add `selectors` to `registryMap` and `RegistryType`, add to `discoverAll()` iteration

### Selector Base Class Shape

```typescript
class Selector<T, K> extends Helper<T, K> {
  static shortcut = 'selectors.base'
  static argsSchema: z.ZodType  // schema for select() input
  static cacheable: boolean = true  // opt-out of caching

  // The core method — override in subclass or graft from module export
  async select(args, context): Promise<any> {}

  // Dispatch normalizer (like Command.execute)
  async resolve(args?, source?): Promise<SelectorResult> {}
}
```

### Module-Based Pattern (selectors/ folder)

```typescript
// selectors/package-info.ts
export const description = 'Returns parsed package.json data'
export const argsSchema = z.object({ field: z.string().optional() })
export const cacheable = true

export function cacheKey(args, context) {
  // return a string key — if unchanged, cached value is returned
  return context.container.git.sha
}

export async function select(args, context) {
  const manifest = context.container.manifest
  return args.field ? manifest[args.field] : manifest
}
```

### Caching Strategy

- Built into the `Selector` base class, powered by `diskCache` feature
- Subclasses/modules can export a `cacheKey(args, context)` function
- Default cache key strategy: `hashObject({ selectorName, args, gitSha })`
- `cacheable: false` opts out entirely
- Cache is key-invalidated (key changes = miss), no TTL by default
- The `resolve()` method checks cache before calling `select()`

## Open Questions (Needs Decision)

### 1. Return Shape
Should `select()` return data directly, or a wrapped result like `{ data, metadata, cached }`?

**Leaning toward:** data directly from `select()`, but `resolve()` (the dispatch method) returns `{ data, cached, cacheKey }` so callers know if it was a cache hit.

### 2. CLI Integration
Should there be a `luca select <name>` CLI command? Would make selectors usable from the terminal, printing JSON output.

### 3. Cache TTL
Is pure key-invalidation enough, or do some selectors need time-based expiry?

### 4. Scope of First Delivery

Proposed skateboard:
- `Selector` base class with `select()` and `resolve()` (cached dispatch)
- `SelectorsRegistry` with `discover()`
- Container wiring (`container.selectors`, `container.selector()`)
- Schemas in `schemas/base.ts`
- `selectors/` folder discovery via `Helpers` feature
- Caching integration with `diskCache`
- Module-based pattern support (export `select` + optional `cacheKey`)
- `Selector` + `selectors` exported from `@soederpop/luca` barrel + seeded in VM virtual modules

## Codebase Exploration Notes

These are the key files that were studied to inform this design:

- `src/command.ts` — The primary pattern to mirror. `Command` extends `Helper`, has `CommandsRegistry`, `commands` singleton, `Command.register()`, `Command.attach()`, `execute()`/`run()` split, headless capture, `graftModule` support.
- `src/helper.ts` — Base class providing state, events, options (Zod-validated), introspection, `afterInitialize()` hook.
- `src/registry.ts` — Abstract `Registry<T>` with `register()`, `lookup()`, `has()`, `available`, `describe()`, `describeAll()`, event bus.
- `src/graft.ts` — `graftModule()` synthesizes a class from plain module exports. `RESERVED_EXPORTS` list determines what becomes static vs prototype methods.
- `src/schemas/base.ts` — All Zod schemas. Each helper type has State/Options/Events schemas.
- `src/node/container.ts` — `NodeContainer` wires everything: side-effect imports, `NodeFeatures` interface, `ClientsAndServersInterface`, `this.use(Command)` pattern.
- `src/node/features/helpers.ts` — `Helpers` feature: `registryMap`, `RegistryType`, `discoverAll()`, class-based vs config-based discovery, VM module seeding.
- `src/node/features/disk-cache.ts` — `DiskCache` feature: `get/set/has/rm`, `cacache`-backed, per-project cache dir, `container.utils.hashObject()` for keys.
- `src/container.ts` — Base `Container`: `createHelperInstance()` with `helperCache` Map, `use()` plugin system, `registerHelperType()`.
