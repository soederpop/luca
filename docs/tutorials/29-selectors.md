# Cached queries with selectors

A selector returns data; a command performs an action. Use a selector when repeated queries can reuse results. Use a feature for reusable behavior or observable state, and `container.store()` for durable records that must survive cache loss.

## Create and run

```sh
luca scaffold selector package-info --tutorial
luca scaffold selector package-info --description "Read the project package name"
```

Replace the generated handler in `selectors/package-info.ts` with:

```ts skip
import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const description = 'Read the project package name'
export const argsSchema = z.object({})
export async function run(_args: z.infer<typeof argsSchema>, { container }: ContainerContext) {
  const pkg = await container.feature('fs').readJsonAsync('package.json')
  return { name: pkg.name }
}
```

```sh
luca select package-info
luca select package-info --json
luca select package-info --json --noCache
```

The normal output wraps data with cache metadata; `--json` prints just the data. `--noCache` forces execution. The CLI discovers `selectors/` before use.

## Choose invalidation deliberately

The default cache key includes selector name, arguments, and Git SHA. Uncommitted file changes and remote API changes do not necessarily change that key. Export a `cacheKey(args, context)` that reflects the input version, disable caching with `export const cacheable = false`, or force a fresh query when appropriate. Do not put irreversible side effects in a cached handler.

Programmatic use is `await container.select('package-info').select({})`; it returns the result envelope. Test the data, repeated-query cache behavior, and the chosen invalidation mechanism. See `luca scaffold selector --tutorial` for the full module contract.
