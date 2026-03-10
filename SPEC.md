---
tags: [dx, registration, metaprogramming, luca, architecture, "1.0"]
status: exploring
goal: get-luca-to-1.0-release
---

# Class Registration Refactor Possibilities

Exploring how static initialization blocks and class-level hooks could simplify helper registration, inspired by Ruby's `self.inherited(subclass)` pattern and how ActiveRecord::Base uses it.

## Why This Matters for 1.0

Luca currently has **114 `.register()` calls** spread across 44 features, ~23 clients, and 3 servers. Adding a new feature requires touching **4 separate locations** (see the [Adding a New Feature checklist](../../../luca/CLAUDE.md)). This ceremony is the kind of friction that kills adoption — the [Luca 1.0 goal](../../goals/get-luca-to-1.0-release.md) explicitly requires that external developers can build their own features easily.

The 4-step checklist today:
1. Feature file with class + trailing `features.register()` call
2. Side-effect import in `container.ts` (lines 20-63 — currently 44 of these)
3. Type import + re-export in `container.ts` (lines 65-148)
4. `NodeFeatures` interface entry in `container.ts` (lines 170-215)

Steps 2-4 exist because registration is **disconnected from the class**. If the class declared itself, the container wiring could be derived.

## The Ruby Inspiration

In Ruby, when you write `class Post < ActiveRecord::Base`, the `inherited` hook fires automatically:

```ruby
class ActiveRecord::Base
  def self.inherited(subclass)
    subclass.table_name = subclass.name.tableize
    subclass.establish_connection
    # The parent configures the child at definition time
  end
end

class Post < ActiveRecord::Base
end
# That's it. Full ORM-backed model. No registration call needed.
```

The magic: `inherited` fires at **class definition time**, receives the subclass, and lets the parent **reach into the child and set it up**. The empty class that does everything.

## Current Luca Registration Pattern

Today, every helper requires explicit registration at the bottom of the file:

```typescript
// src/node/features/fs.ts
import { features, Feature } from "../feature.js"

export class FS extends Feature {
  static override shortcut = "features.fs" as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  // ... methods ...
}

export default features.register("fs", FS)
```

And for extension features (AGI, etc), there's the `attach` pattern:

```typescript
export class Assistant extends Feature<AssistantState, AssistantOptions> {
  static attach(container: Container<AvailableFeatures, any>) {
    features.register('assistant', Assistant)
    return container
  }
}

export default features.register('assistant', Assistant)
```

The registration is always a separate, imperative call disconnected from the class definition itself. The class doesn't know it's been registered. The registry doesn't know until that line runs.

### What the registry actually does

The core `Registry.register()` method (`luca/src/registry.ts:65-70`) does three things:
1. Stores the constructor in a private `members` Map
2. Calls `interceptRegistration()` for introspection metadata capture
3. Emits a `'helperRegistered'` event on the registry bus

This is straightforward enough that the base class can own it entirely.

## The Static Block Approach

ES2022 static initialization blocks let code run at **class definition time**, inside the class body. This is JavaScript's closest equivalent to Ruby's `inherited`:

```typescript
class Feature {
  static registry: Registry

  // This is our "inherited" hook
  static __initSubclass(SubClass: typeof Feature, id: string) {
    this.registry.register(id, SubClass)
  }
}
```

### What it could look like for authors

```typescript
// The dream: define, register, and export in one declaration
export default class FS extends Feature {
  static {
    Feature.register(this, "fs")
  }

  static override shortcut = "features.fs" as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  async readFile(path: string) { /* ... */ }
}
```

No trailing `features.register()` call. No disconnect between the class and its registration. The class **declares itself** as a registered member of the system.

### The id could be derived from convention

If we adopt a naming convention (like ActiveRecord derives table names from class names), we could eliminate the explicit id entirely:

```typescript
export default class DiskCache extends Feature {
  static {
    Feature.register(this) // id inferred as "diskCache" from class name
  }
}
```

The `register` implementation:

```typescript
class Feature {
  static register(SubClass: typeof Feature, id?: string) {
    // Convention: PascalCase class name -> camelCase registry id
    const registryId = id ?? SubClass.name[0].toLowerCase() + SubClass.name.slice(1)
    features.register(registryId, SubClass)
  }
}
```

## Going Further: The Base Class Does All The Work

What if the base classes (`Feature`, `Client`, `Server`) provided a static `register` that also handled module augmentation hints and the `attach` pattern?

```typescript
// Before: 15+ lines of boilerplate per feature
import { z } from 'zod'
import { features, Feature } from '@soederpop/luca/feature'
import type { AvailableFeatures } from '@soederpop/luca/feature'

declare module '@soederpop/luca/feature' {
  interface AvailableFeatures {
    conversation: typeof Conversation
  }
}

export class Conversation extends Feature<ConversationState, ConversationOptions> {
  static override shortcut = 'features.conversation' as const
  static attach(container: Container<AvailableFeatures, any>) {
    features.register('conversation', Conversation)
    return container
  }
  // ...
}

export default features.register('conversation', Conversation)
```

```typescript
// After: the class IS the registration
import { Feature } from '@soederpop/luca/feature'

export default class Conversation extends Feature<ConversationState, ConversationOptions> {
  static {
    Feature.register(this, 'conversation')
  }

  // shortcut derived automatically from registry + id
  // attach() provided by base class using the registered id
  // ...
}
```

The base `Feature.register()` could:
1. Call `features.register(id, SubClass)`
2. Set `SubClass.shortcut` automatically (`features.${id}`)
3. Generate a default `attach()` that registers and returns the container
4. Emit a `"subclass:registered"` event on the registry for any other wiring

## Codebase Reality Check

**Current scale of the problem** (from `luca/src/`):
- 44 feature files, each with a trailing `features.register()` call
- 44 side-effect imports in `node/container.ts` lines 20-63
- 44 type imports in `node/container.ts` lines 65-108
- 44 entries in the `NodeFeatures` interface at lines 170-215
- ~23 client files with `clients.register()` calls
- 3 server files with `servers.register()` calls
- 0 files currently using static initialization blocks

**The `attach()` pattern is mostly ceremonial**: most `attach()` methods in features just call `register()` and return the container. The base classes (`Client`, `Server`, `Command`, `Endpoint`) all have their own `attach()` at the helper-type level (`luca/src/client.ts:41-69`, `luca/src/server.ts:49-73`, etc.) which wire up the registry and factory onto the container. Individual helpers rarely need custom `attach()` logic.

**The 4-step checklist creates coupling**: every new feature requires editing `container.ts` in three separate places. This is a maintenance burden and a contributor friction point — exactly the kind of thing that needs solving before 1.0.

## Connection to Related Ideas

This refactor sits at the intersection of several exploring ideas:

- **[Feature Stacks](./feature-stacks.md)**: Stacks group features into lazy-loaded bundles. If features self-register via static blocks, stacks become simpler — a stack is just an async module that imports a set of feature files, and each feature registers itself on import. No stack-level registration wiring needed.

- **[Container `.use()` API](./container-use-api.md)**: The `.use()` API loads stacks/plugins via dynamic import. Static block registration means `container.use(import('./my-feature'))` just works — the import triggers the static block, which calls `Feature.register(this)`, and the feature is available. No `attach()` ceremony.

- **[Feature Authoring DX](./luca-feature-authoring-dx.md)**: Complementary, not competing. `defineFeature()` is for simple bag-of-methods features; static block registration is for full class-based helpers. Both reduce boilerplate, both feed into the "one file, one command" authoring goal.

- **[Introspection Enhancement](./introspection-enhancement.md)**: `interceptRegistration()` already fires during `register()`. If registration moves into the class body, introspection metadata can be co-located too — the static block could declare description, category, and other metadata that introspection currently scrapes from JSDoc.

## Comparison With Other Approaches

| Approach | When it runs | Cooperation needed | Ceremony |
|----------|-------------|-------------------|----------|
| Ruby `inherited` | Class definition | None | Zero — just `extends` |
| Static block + `register` | Class definition | One line in static block | Minimal — inside the class |
| Trailing `registry.register()` | Module evaluation | Separate call after class | Moderate — disconnected |
| `defineFeature()` factory | Module evaluation | Wrap entire definition | Different paradigm entirely |
| Decorators (`@tracked`) | Class definition | One line above class | Minimal — but external |

The static block approach is the sweet spot for Luca: it's **standard JavaScript**, runs at **definition time**, lives **inside the class body**, and keeps the class as the primary authoring unit (unlike `defineFeature()` which replaces the class with a factory call).

## The `defineFeature` Relationship

This is complementary to the [`defineFeature()` idea](./luca-feature-authoring-dx.md), not a replacement. They solve different problems:

- **`defineFeature()`** reduces boilerplate for simple features that are mostly a bag of methods — you skip writing a class entirely
- **Static block registration** reduces boilerplate for full class-based helpers — you still write the class, but registration is self-contained

For complex features that need class inheritance, lifecycle hooks, and full OOP — the static block pattern is cleaner. For simple features that are essentially a named collection of functions — `defineFeature()` is cleaner.

## Implementation Sketch

### Phase 1: Add `Helper.register()` to the base class

Each helper base class (`Feature`, `Client`, `Server`) gets a static `register()` that dispatches to its registry:

```typescript
// In feature.ts
class Feature {
  static register(SubClass: typeof Feature, id?: string) {
    const registryId = id ?? SubClass.name[0].toLowerCase() + SubClass.name.slice(1)

    // 1. Register in the features registry
    features.register(registryId, SubClass as any)

    // 2. Auto-set shortcut if not overridden
    if (!Object.getOwnPropertyDescriptor(SubClass, 'shortcut')?.value) {
      ;(SubClass as any).shortcut = `features.${registryId}` as const
    }

    // 3. Generate default attach() if not overridden
    if (!Object.getOwnPropertyDescriptor(SubClass, 'attach')) {
      ;(SubClass as any).attach = (container: any) => {
        features.register(registryId, SubClass as any)
        return container
      }
    }
  }
}
```

This is backward-compatible — existing `features.register()` calls still work. New features can opt into the static block pattern.

### Phase 2: Migrate one feature as proof of concept

Pick a simple feature like `dns` or `yaml` and convert it:

```typescript
// Before (dns.ts)
export class DNS extends Feature { /* ... */ }
export default features.register("dns", DNS)

// After (dns.ts)
export default class DNS extends Feature {
  static { Feature.register(this, "dns") }
  /* ... */
}
```

### Phase 3: Codegen for container.ts wiring

Build a `luca gen:features` command that scans `src/node/features/` and generates the side-effect imports, type imports, and `NodeFeatures` interface entries. This eliminates steps 2-4 of the checklist entirely — the only manual step is writing the feature file itself.

### Phase 4: Gradual migration

Convert remaining features at leisure. The old and new patterns coexist since `features.register()` is the underlying mechanism either way.

## Open Questions

- ~~**Registry detection**~~: **Yes.** `Helper.register(this)` walks the prototype chain to find which base class (`Feature`, `Client`, `Server`) owns the registry, then dispatches automatically. Verified in Bun. The `register` call also accepts an options bag (`{ id, stateSchema, optionsSchema }`) so schemas are set on the class *before* the registry call fires — meaning `interceptRegistration` sees a fully-decorated class. Id inference from class name works for most cases; acronym-style names (DNS, REST, SSH) need an explicit `id` passed.
- ~~**Module augmentation**~~: The `declare module` blocks are necessary boilerplate — they're the one piece that can't be eliminated by runtime mechanics. Codegen is off the table, and TS language service plugins only affect editor intellisense (not `tsc`), so they'd require non-standard toolchain hacks. Not worth pursuing. One `declare module` block per feature file, co-located with the class, is acceptable.
- ~~**Import side effects**~~: Not worth changing right now. Registration on import is fine — the static block just makes it more visible and intentional. Lazy registration via `container.use()` is a separate concern for later.
- ~~**`attach()` consolidation**~~: **Yes, do it.** `Helper.register()` should generate a default `attach()` that registers and returns the container. The vast majority of `attach()` methods are just that. The few that do more (wiring up other features) can still override.
- ~~**Bun compatibility**~~: **Verified on Bun 1.2.15** — `this` inside `static { }` correctly binds to the subclass being defined, not the parent. Name inference from `SubClass.name`, coexistence with other static properties, and registration dispatch all work as expected. No issues found.
