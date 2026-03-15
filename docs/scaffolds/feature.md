# Building a Feature

A feature is a container-managed capability — something your application needs that lives on the machine (file I/O, caching, encryption, etc). Features are lazy-loaded, observable, and self-documenting.

When to build a feature:
- You need a reusable local capability (not a network call — that's a client)
- You want state management, events, and introspection for free
- You're wrapping a library so the rest of the codebase uses a uniform interface

## Imports

```ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'
```

These are the only imports your feature file needs from luca. If your feature wraps a third-party library, import it here too — feature implementations are the ONE place where direct library imports are allowed.

## Schemas

Define the shape of your feature's state, options, and events using Zod. Every field must have a `.describe()` — this becomes the documentation.

```ts
export const {{PascalName}}StateSchema = FeatureStateSchema.extend({
  // Add your state fields here. These are observable — changes emit events.
  // Example: itemCount: z.number().default(0).describe('Number of items stored'),
})
export type {{PascalName}}State = z.infer<typeof {{PascalName}}StateSchema>

export const {{PascalName}}OptionsSchema = FeatureOptionsSchema.extend({
  // Add constructor options here. Validated when the feature is created.
  // Example: directory: z.string().optional().describe('Storage directory path'),
})
export type {{PascalName}}Options = z.infer<typeof {{PascalName}}OptionsSchema>

export const {{PascalName}}EventsSchema = FeatureEventsSchema.extend({
  // Each key is an event name. Value is z.tuple() of listener arguments.
  // Example: itemAdded: z.tuple([z.string().describe('Item key')]).describe('Emitted when an item is added'),
})
```

## Class

The class extends `Feature` with your state and options types. Static properties drive registration and introspection. Every public method needs a JSDoc block with `@param`, `@returns`, and `@example`.

```ts
/**
 * {{description}}
 *
 * @example
 * ```typescript
 * const {{camelName}} = container.feature('{{camelName}}')
 * ```
 *
 * @extends Feature
 */
export class {{PascalName}} extends Feature<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'features.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static override eventsSchema = {{PascalName}}EventsSchema
  static override description = '{{description}}'
  static { Feature.register(this, '{{camelName}}') }

  constructor(options: {{PascalName}}Options, context: ContainerContext) {
    super(options, context)
    // Initialize state, set up resources
  }

  // Add your methods here. Every public method needs JSDoc.
}
```

## Module Augmentation

This is what gives `container.feature('yourName')` TypeScript autocomplete. Without it, the feature works but TypeScript won't know about it.

```ts
declare module '@soederpop/luca' {
  interface AvailableFeatures {
    {{camelName}}: typeof {{PascalName}}
  }
}
```

## Registration

Registration happens inside the class body using a static block. The default export is just the class itself.

```ts
// Inside the class:
static { Feature.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}
```

## Complete Example

Here's a minimal but complete feature. This is what a real feature file looks like:

```ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    {{camelName}}: typeof {{PascalName}}
  }
}

export const {{PascalName}}StateSchema = FeatureStateSchema.extend({})
export type {{PascalName}}State = z.infer<typeof {{PascalName}}StateSchema>

export const {{PascalName}}OptionsSchema = FeatureOptionsSchema.extend({})
export type {{PascalName}}Options = z.infer<typeof {{PascalName}}OptionsSchema>

/**
 * {{description}}
 *
 * @example
 * ```typescript
 * const {{camelName}} = container.feature('{{camelName}}')
 * ```
 *
 * @extends Feature
 */
export class {{PascalName}} extends Feature<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'features.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static override description = '{{description}}'
  static { Feature.register(this, '{{camelName}}') }

  constructor(options: {{PascalName}}Options, context: ContainerContext) {
    super(options, context)
  }
}

export default {{PascalName}}
```

## Conventions

- **Naming**: PascalCase for class, camelCase for registration ID. The file name should be kebab-case (e.g. `disk-cache.ts`).
- **JSDoc**: Every public method, getter, and the class itself needs a JSDoc block. Include `@example` with working code.
- **Describe everything**: Every Zod field needs `.describe()`. Every event tuple argument needs `.describe()`. This IS the documentation.
- **No Node builtins in consumer code**: If your feature wraps `fs` or `crypto`, that's fine inside the feature. But code that USES your feature should never import those directly.
- **State is observable**: Use `this.state.set()` and `this.state.get()`. Don't use plain instance properties for data that should be reactive.
- **Events for lifecycle**: Emit events for significant state changes so consumers can react.
