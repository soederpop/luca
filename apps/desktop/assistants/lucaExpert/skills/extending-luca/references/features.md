# Features — Deep Dive

Authoritative source is `luca scaffold feature --tutorial`. This file is a distilled reference; run the tutorial when in doubt.

## Anatomy

A feature file has five parts:

1. **Imports** — `zod` for schemas, `Feature` + `*Schema` base classes from `luca`.
2. **Module augmentation** — teaches TypeScript that `container.feature('name')` exists.
3. **Schemas** — Zod definitions for `State`, `Options`, `Events`.
4. **Class** — extends `Feature<State, Options>`, static registration block.
5. **Default export** — the class itself.

```ts
import { z } from 'zod'
import {
  Feature,
  FeatureStateSchema,
  FeatureOptionsSchema,
  FeatureEventsSchema,
} from 'luca'

declare module 'luca' {
  interface AvailableFeatures {
    diskCache: typeof DiskCache
  }
}

export const DiskCacheStateSchema = FeatureStateSchema.extend({
  itemCount: z.number().default(0).describe('Number of cached items'),
})
export type DiskCacheState = z.infer<typeof DiskCacheStateSchema>

export const DiskCacheOptionsSchema = FeatureOptionsSchema.extend({
  directory: z.string().optional().describe('Storage directory path'),
})
export type DiskCacheOptions = z.infer<typeof DiskCacheOptionsSchema>

export const DiskCacheEventsSchema = FeatureEventsSchema.extend({
  itemAdded: z.tuple([z.string().describe('Item key')]).describe('Emitted when an item is written'),
})

/**
 * File-backed key-value cache.
 *
 * @example
 * ```ts
 * const cache = container.feature('diskCache', { directory: '/tmp/cache' })
 * await cache.set('user:1', { name: 'Alice' })
 * ```
 */
export class DiskCache extends Feature<DiskCacheState, DiskCacheOptions> {
  static override shortcut = 'features.diskCache' as const
  static override stateSchema = DiskCacheStateSchema
  static override optionsSchema = DiskCacheOptionsSchema
  static override eventsSchema = DiskCacheEventsSchema
  static { Feature.register(this, 'diskCache') }

  afterInitialize() {
    // sync setup only
  }

  /**
   * Store a value under a key.
   * @param key   The cache key
   * @param value Anything JSON-serializable
   * @returns The stored value
   * @example
   * await cache.set('foo', 42)
   */
  async set(key: string, value: unknown) {
    // implementation
    this.emit('itemAdded', key)
    this.state.set('itemCount', (this.state.get('itemCount') ?? 0) + 1)
    return value
  }
}

export default DiskCache
```

## Static properties

| Property        | Purpose                                                                    |
|-----------------|----------------------------------------------------------------------------|
| `shortcut`      | Enables the top-level accessor (`container.features.diskCache`)            |
| `stateSchema`   | Validates and introspects state fields                                     |
| `optionsSchema` | Validates constructor options                                              |
| `eventsSchema`  | Documents emitted events for `luca describe --events`                      |
| `register`      | Static block registers under a name in the `AvailableFeatures` interface   |

## Lifecycle

1. **Construction** — Do not override. Framework builds the instance, validates options, wires `this.container`, `this.state`, `this.events`.
2. **`afterInitialize()`** — Sync setup. Runs after construction. Return value ignored. Do NOT `await` async work here — the container will keep going.
3. **Explicit `start()` / `enable()`** — For anything async (opening DB, starting a server, subscribing to a bus), expose an explicit lifecycle method the consumer calls. Store readiness in state so callers can `await feature.state.waitFor('ready', true)`.

## State

Observable key-value store on every feature:

```ts
this.state.set('key', 'value')
this.state.get('key')
this.state.current                            // full snapshot
this.state.observe((changeType, key, value) => { /* ... */ })
this.state.waitFor('ready', true)             // resolves when key hits value
```

Never use plain instance properties for reactive data — consumers can't subscribe to those.

## Events

Every feature is an event emitter:

```ts
this.emit('itemAdded', key)
feature.on('itemAdded', (key) => { /* ... */ })
feature.once('ready', handler)
await feature.waitFor('ready')
```

Declare each event in `eventsSchema` with a `z.tuple([...])` describing listener args. This drives `luca describe <feature> --events`.

## Consuming a feature

```ts
const cache = container.feature('diskCache', { directory: '/tmp/cache' })
```

Features are cached per option-set. Calling `container.feature('diskCache')` twice with the same options returns the same instance. Pass different options to get a distinct instance.

## Conventions

- **File name:** kebab-case matching the registration name (`disk-cache.ts` for `diskCache`).
- **Class:** PascalCase.
- **JSDoc everywhere.** Class, every public method, every getter. `@param` / `@returns` / `@example`.
- **Every Zod field `.describe()`.** No exceptions.
- **Direct library imports allowed inside the feature.** This is the ONE place `import fs from 'fs'` is fine — the feature exists to hide that from consumers.
- **Dynamic imports for heavy or optional deps.** Import inside the method that uses it, so features that aren't touched don't pay the load cost.

## Verifying

```sh
luca describe diskCache          # should show your JSDoc + schema fields
luca describe diskCache --ts     # verify TS surface matches expectations
luca describe diskCache --events # verify events
luca eval "container.feature('diskCache')"
```

If `luca describe diskCache` says "unknown feature", the `static { Feature.register(this, 'diskCache') }` block is missing or the file lives outside `features/`.
