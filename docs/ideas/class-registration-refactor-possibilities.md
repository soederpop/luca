---
tags: [dx, registration, metaprogramming]
status: spark
---

# Class Registration Refactor Possibilities

Exploring how static initialization blocks and class-level hooks could simplify helper registration, inspired by Ruby's `self.inherited(subclass)` pattern and how ActiveRecord::Base uses it.

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

## Open Questions

- **Registry detection**: Can `Feature.register(this)` figure out which registry to use automatically? The base class (`Feature` vs `Client` vs `Server`) already implies it. A shared `Helper.register(this)` could dispatch to the right registry.
- **Module augmentation**: The `declare module` blocks for TypeScript are the remaining boilerplate that can't be eliminated by runtime mechanics. Could a codegen step or a TS plugin handle this?
- **Import side effects**: Today, importing a feature file triggers registration. With static blocks, this is still true — but the registration is more visible and intentional. Is there value in making registration lazy or explicit via `container.use()`?
- **`attach()` consolidation**: Many `attach()` methods just call `register()` and return the container. If `Feature.register()` generates a default `attach()`, do we still need custom ones? The ones that do more (like wiring up other features) would still override.
