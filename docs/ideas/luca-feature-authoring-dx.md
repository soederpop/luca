---
tags: []
status: spark
---

# Luca Feature Authoring DX Improvements

A `defineFeature()` factory function that reduces boilerplate when authoring features, while maintaining the full typed factory system, typed state, typed events, and registry introspection.

## The Problem

### Feature file boilerplate

Even the simplest feature (e.g. `Networking`) requires:

- Importing `FeatureStateSchema` and `FeatureOptionsSchema`
- A class declaration
- 3 static overrides (`shortcut`, `stateSchema`, `optionsSchema`)
- A `features.register()` call at module bottom

For features with custom state/options, add: define schemas, export types, wire generics.

---

## `defineFeature()` — Schema-First Factory Function

A `defineFeature()` function that takes a config object and returns a fully-typed class, already registered.

### Simple feature (no custom state/options)

```typescript
// src/node/features/networking.ts
import { defineFeature } from '../feature.js'
import detectPort from 'detect-port'

export const Networking = defineFeature('networking', {
  // State and options schemas are optional - defaults used if omitted
  methods: {
    async findOpenPort(startAt = 0) {
      return await detectPort(Number(startAt))
    },
    async isPortOpen(checkPort = 0) {
      const nextPort = await detectPort(Number(checkPort))
      return nextPort && nextPort === Number(checkPort)
    },
  },
})
```

### Feature with custom state/options

```typescript
// src/node/features/vault.ts
import { defineFeature } from '../feature.js'
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

export const Vault = defineFeature('vault', {
  state: FeatureStateSchema.extend({
    secret: z.custom<Buffer>().optional().describe('Secret key buffer'),
  }),
  options: FeatureOptionsSchema.extend({
    secret: z.union([z.custom<Buffer>(), z.string()]).optional(),
  }),
  // Called after construction, replaces constructor override
  setup(feature, options) {
    if (typeof options.secret === 'string') {
      feature.state.set('secret', Buffer.from(options.secret, 'base64'))
    }
  },
  methods: {
    encrypt(payload: string) { /* ... */ },
    decrypt(payload: string) { /* ... */ },
  },
  getters: {
    secretText() { return this.state.get('secret')?.toString('base64') },
  },
})
```

### What `defineFeature` does internally

1. Creates a class extending `Feature<InferredState, InferredOptions>`
2. Sets `static shortcut`, `stateSchema`, `optionsSchema` from the config
3. Copies methods and getters onto the prototype
4. Calls `features.register(id, GeneratedClass)`
5. Returns the class (with the correct type for the Features interface)

### What you keep

- Full Zod-powered types on state and options
- `container.feature('vault', { secret: '...' })` stays fully typed
- `container.features.available`, `.describe()`, introspection all work
- The class is still a real class -- `instanceof Feature` works, `introspect()` works

### What you lose (intentionally)

- The ability to write feature logic as a raw class (you can still do that for complex cases -- this is additive, not a replacement)
- Direct constructor control (replaced by `setup`)

---

## Open Questions

- Should `defineFeature` support lifecycle hooks beyond `setup`? (e.g. `onEnable`, `onDisable`, `onContainerReady`)
- How should `this` binding work inside `methods` and `getters`? The feature instance needs to be accessible.
- Should there be a `defineClient` / `defineServer` equivalent for the other helper types?
