# Building a Selector

A selector returns data. Where commands perform actions, selectors query and return structured results with built-in caching. Selectors live in a project's `selectors/` folder and are automatically discovered.

When to build a selector:
- You need to query project data (package info, file listings, config values)
- The result benefits from caching (keyed by git SHA or custom key)
- You want the data available via `container.select('name')` or `luca select name`

## Imports

```ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
```

## Args Schema

Define the selector's input arguments with Zod.

```ts
export const argsSchema = z.object({
  // Add your input arguments here.
  // Example: field: z.string().optional().describe('Specific field to return'),
})
```

## Description

Export a description string for discoverability:

```ts
export const description = '{{description}}'
```

## Caching

Selectors cache by default. The default cache key is `hashObject({ selectorName, args, gitSha })` — same args + same commit = cache hit.

To customize the cache key:

```ts
export function cacheKey(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  return context.container.git.currentCommitSha
}
```

To disable caching:

```ts
export const cacheable = false
```

## Handler

Export a `run` function that returns data. It receives parsed args and the container context.

```ts
export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  // Query and return your data
  return { /* your data */ }
}
```

## Complete Example

```ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = '{{description}}'

export const argsSchema = z.object({})

export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Return your data here
  return {}
}
```

## Conventions

- **File location**: `selectors/{{kebabName}}.ts` in the project root. Discovered automatically.
- **Naming**: kebab-case for filename. `luca select {{kebabName}}` maps to `selectors/{{kebabName}}.ts`.
- **Use the container**: Never import `fs`, `path` directly. Use `container.feature('fs')`, `container.paths`.
- **Return data**: The `run` function must return the data. It gets wrapped in `{ data, cached, cacheKey }` by the framework.
- **Caching**: On by default. Override `cacheKey()` for custom invalidation, or set `cacheable = false` to skip.
- **CLI**: `luca select {{kebabName}}` runs the selector and prints JSON. Use `--json` for data only, `--no-cache` to force fresh.
