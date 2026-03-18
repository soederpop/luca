# Building an Endpoint

An endpoint is a route handler that `luca serve` auto-discovers and mounts on an Express server. Endpoints live in `endpoints/` and follow a file-based routing convention — each file becomes an API route with automatic validation, OpenAPI spec generation, and rate limiting.

When to build an endpoint:
- You need a REST API route (GET, POST, PUT, PATCH, DELETE)
- You want Zod validation, OpenAPI docs, and rate limiting for free
- You're building an API that `luca serve` manages

## File Location

Endpoints go in `endpoints/` at your project root:
- `endpoints/health.ts` → `/health`
- `endpoints/posts.ts` → `/api/posts`
- `endpoints/posts/[id].ts` → `/api/posts/:id` (requires `path` export)

Run `luca serve` and they're automatically discovered and mounted.

## Imports

Endpoints are lightweight — just exports and handler functions. No imports are required.

If your project has `@soederpop/luca` as an npm dependency, you can import `z` from `zod` and `EndpointContext` from `@soederpop/luca` for type safety. Otherwise, use `any` types — the framework handles validation and context injection for you.

Access framework capabilities through the `ctx` parameter:
- `ctx.container.feature('fs')` for file operations
- `ctx.container.feature('yaml')` for YAML parsing
- `ctx.container.feature('sqlite')` for database access

## Required Exports

Every endpoint MUST export a `path` string:

```ts
export const path = '/api/{{camelName}}'
export const description = '{{description}}'
export const tags = ['{{camelName}}']
```

## Handler Functions

Export named functions for each HTTP method you support. Each receives validated parameters and a context object:

```ts
export async function get(params: any, ctx: any) {
  const fs = ctx.container.feature('fs')
  // Your logic here
  return { message: 'ok' }
}

export async function post(params: any, ctx: any) {
  // Create something
  return { created: true }
}
```

The `EndpointContext` gives you:
- `ctx.container` — the luca container (access any feature, client, etc.)
- `ctx.request` — Express request object
- `ctx.response` — Express response object
- `ctx.query` — parsed query string
- `ctx.body` — parsed request body
- `ctx.params` — URL parameters (`:id`, etc.)

Return any object — it's automatically JSON-serialized as the response.

## Validation Schemas

If `zod` is available (via `@soederpop/luca` dependency or `node_modules`), export Zod schemas to validate parameters for each method. Name them `{method}Schema`:

```ts
import { z } from 'zod'

export const getSchema = z.object({
  q: z.string().optional().describe('Search query'),
  limit: z.number().default(20).describe('Max results'),
})

export const postSchema = z.object({
  title: z.string().min(1).describe('Item title'),
  body: z.string().min(1).describe('Item content'),
})
```

Invalid requests automatically return 400 with Zod error details. Schemas also feed the auto-generated OpenAPI spec. If zod is not available, skip schema exports — the endpoint still works, you just lose automatic validation.

## Rate Limiting

Export rate limit config to protect endpoints:

```ts
// Global rate limit for all methods
export const rateLimit = { maxRequests: 100, windowSeconds: 60 }

// Per-method rate limit
export const postRateLimit = { maxRequests: 10, windowSeconds: 1 }
```

## Delete Handler

`delete` is a reserved word in JS, so you can't use it as a function name directly. Use a named export alias:

```ts
// Use a local name, then re-export as `delete`
const del = async (params: any, ctx: any) => {
  return { deleted: true }
}
export { del as delete }
```

You can also export `deleteSchema` and `deleteRateLimit` for validation and rate limiting on DELETE.

## Complete Example

A CRUD endpoint for a resource (no external imports needed):

```ts
export const path = '/api/{{camelName}}'
export const description = '{{description}}'
export const tags = ['{{camelName}}']

export async function get(params: any, ctx: any) {
  return { items: [], total: 0 }
}

export async function post(params: any, ctx: any) {
  return { item: { id: '1', ...params }, message: 'Created' }
}

const del = async (params: any, ctx: any) => {
  const { id } = ctx.params
  return { message: `Deleted ${id}` }
}
export { del as delete }
```

## Dynamic Route Example

For routes with URL parameters, create a nested file:

```ts
// endpoints/{{camelName}}/[id].ts
export const path = '/api/{{camelName}}/:id'
export const description = 'Get, update, or delete a specific item'
export const tags = ['{{camelName}}']

export async function get(params: any, ctx: any) {
  const { id } = ctx.params
  return { item: { id } }
}

export async function put(params: any, ctx: any) {
  const { id } = ctx.params
  return { item: { id, ...params }, message: 'Updated' }
}

const del = async (params: any, ctx: any) => {
  const { id } = ctx.params
  return { message: `Deleted ${id}` }
}
export { del as delete }
```

## Conventions

- **File = route**: The file path maps to the URL path. `endpoints/users.ts` serves `/api/users`.
- **Export `path`**: Every endpoint must export a `path` string. This is the mounted route.
- **Use Zod schemas**: Name them `getSchema`, `postSchema`, etc. They validate AND document.
- **Use the container**: Access features via `ctx.container.feature('fs')`, not Node.js imports.
- **Return objects**: Handler return values are JSON-serialized. Use `ctx.response` only for streaming or custom status codes.
- **OpenAPI for free**: Your `path`, `description`, `tags`, and schemas automatically generate an OpenAPI spec at `/openapi.json`.
