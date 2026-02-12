---
name: luca-feature-development
description: This skill should be used when the user asks to "create a feature", "add a feature", "scaffold a feature", "write a new feature", "build a feature for luca", or discusses implementing new Feature subclasses for the Luca dependency injection container framework.
version: 0.1.0
---

# Luca Feature Development

This skill provides the complete patterns and procedures for creating new Feature subclasses in the Luca framework, covering core, node, web, and AGI layer features.

## Overview

Features are the primary extension point in Luca. A Feature is a `Helper` subclass that attaches to a `Container`, has observable state, an event bus, introspectable methods, and a standardized registration/discovery lifecycle. Features are created through the container's factory method (`container.feature('name', options)`) and cached by a hash of their id + options + container uuid.

## When This Skill Applies

This skill activates when creating, modifying, or understanding Feature subclasses in the Luca framework, including node-side features (`src/node/features/`), web features (`src/web/features/`), and AGI features (`src/agi/features/`).

## Feature Anatomy

Every feature file follows this exact structure:

1. **Imports** - zod, base schemas, Feature class, features registry
2. **Module augmentation** - declare the feature in `AvailableFeatures`
3. **State interface/schema** - extends `FeatureStateSchema`
4. **Options interface/schema** - extends `FeatureOptionsSchema`
5. **Class definition** - extends `Feature<State, Options>`
6. **Registration** - `features.register('name', Class)` as default export

## Core Patterns

### File Template

```typescript
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures, features, Feature } from '@/feature'

declare module '@/feature' {
  interface AvailableFeatures {
    myFeature: typeof MyFeature
  }
}

export const MyFeatureStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().describe('Whether the feature has been loaded'),
})

export const MyFeatureOptionsSchema = FeatureOptionsSchema.extend({
  somePath: z.string().optional().describe('Path to something'),
})

export type MyFeatureState = z.infer<typeof MyFeatureStateSchema>
export type MyFeatureOptions = z.infer<typeof MyFeatureOptionsSchema>

/**
 * JSDoc description is critical - the introspection system extracts it.
 *
 * @extends Feature
 */
export class MyFeature extends Feature<MyFeatureState, MyFeatureOptions> {
  static override stateSchema = MyFeatureStateSchema
  static override optionsSchema = MyFeatureOptionsSchema
  static override shortcut = 'features.myFeature' as const

  static attach(container: Container<AvailableFeatures, any>) {
    features.register('myFeature', MyFeature)
    return container
  }

  override get initialState(): MyFeatureState {
    return {
      ...super.initialState,
      loaded: false,
    }
  }

  // Public methods with JSDoc (introspection extracts these)
  // Getters for computed properties
  // Private helpers
}

export default features.register('myFeature', MyFeature)
```

### Key Rules

- **`static shortcut`** must follow the pattern `'features.camelCaseName'` and use `as const`
- **`static attach()`** is required for features registered via `container.use(FeatureClass)`. It calls `features.register()` and optionally `.enable()`.
- **`initialState`** getter must spread `...super.initialState` first, then add feature-specific defaults
- **Schema `.describe()` calls** on every field - the introspection system uses these
- **JSDoc on all public methods and getters** - the AST scanner extracts documentation from these
- **Module augmentation** must use the correct relative path based on the feature's layer:
  - Core/Node: `'../feature'` or `'../../feature.js'`
  - AGI: `'@/feature'`
- **Default export** must be `features.register('name', Class)` - this is what the module system uses to register features

### Container Integration

Register features in the container file for the appropriate layer:

- **Node features**: Auto-imported in `src/node/container.ts` via side-effect imports
- **AGI features**: Added to `src/agi/container.server.ts` with `import` + `.use(FeatureClass)` + typed property on the class

For AGI container registration:

```typescript
// In src/agi/container.server.ts
import { MyFeature } from './features/my-feature'

export class AGIContainer extends NodeContainer {
  myFeature?: MyFeature  // typed property
}

const container = new AGIContainer()
  .use(MyFeature)  // registers via static attach()
```

### Accessing Container Features

Inside a feature, access other features and container utilities through `this.container`:

```typescript
// Access other features
const fs = (this.container as any).fs           // FS feature
const diskCache = this.container.feature('diskCache')
const ui = this.container.feature('ui')

// Container utilities
this.container.utils.uuid()                     // UUID generation
this.container.utils.zodToJsonSchema(schema)    // Schema conversion
this.container.utils.lodash                     // lodash subset

// Container paths (NodeContainer)
(this.container as any).paths.resolve('some', 'path')
```

### State Management

State is observable. Update it properly so observers and events fire:

```typescript
// Single field
this.state.set('loaded', true)

// Multiple fields atomically
this.state.setState({
  loaded: true,
  count: 5,
})

// Read state
this.state.get('loaded')       // typed getter
this.state.current             // full snapshot
```

### Events

Emit events for lifecycle moments and significant operations. Consumers bind with `on()`, `once()`, or `waitFor()`:

```typescript
this.emit('loaded')
this.emit('itemCreated', item)
this.emit('error', new Error('something broke'))
```

### Persistence Patterns

For features that persist data, use `diskCache`:

```typescript
get diskCache() {
  return this.container.feature('diskCache')
}

async save(key: string, data: any) {
  await this.diskCache.set(key, data)
}

async load(key: string) {
  if (await this.diskCache.has(key)) {
    return this.diskCache.get(key, true) // true = parse JSON
  }
  return null
}
```

For features backed by markdown files on disk, use `contentDb` / contentbase:

```typescript
import { Collection, defineModel } from 'contentbase'

// Create a collection pointed at a directory
const collection = new Collection({ rootPath: '/path/to/content', extensions: ['md'] })
await collection.load()

// Define a model with zod meta schema
const MyModel = defineModel('MyModel', {
  meta: z.object({ title: z.string(), status: z.string() }),
  match: (doc) => doc.id.startsWith('some-prefix'),
})
collection.register(MyModel)

// CRUD
await collection.saveItem('path/id', { content: '---\ntitle: foo\n---\n\nBody' })
await collection.deleteItem('path/id')
const items = collection.available  // string[] of pathIds
const item = collection.items.get('path/id')  // { meta, content, raw }
```

## Additional Resources

### Reference Files

For complete annotated code examples of real features at each layer:

- **`references/patterns.md`** - Full annotated examples from the codebase showing AGI features (SkillsLibrary, Identity, Expert), node features (ContentDb, DiskCache, FS), and the ContentBase integration pattern

## Quick Checklist

Before finalizing a new feature:

- [ ] Extends `Feature<MyState, MyOptions>` with proper generics
- [ ] `static shortcut` uses `'features.camelCase' as const`
- [ ] `static stateSchema` and `static optionsSchema` set to extended Zod schemas
- [ ] `static attach()` calls `features.register()`
- [ ] `initialState` getter spreads `...super.initialState`
- [ ] Module augmentation declares the feature in `AvailableFeatures`
- [ ] Default export is `features.register('name', Class)`
- [ ] All Zod fields have `.describe()` calls
- [ ] All public methods and getters have JSDoc comments
- [ ] Container file updated with import, `.use()`, and typed property
- [ ] State updates use `state.set()` or `state.setState()`
- [ ] Events emitted for lifecycle and key operations
