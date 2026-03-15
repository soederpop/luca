# Building a Client

A client is a container-managed connection to an external service. Clients handle network communication — HTTP APIs, WebSocket connections, GraphQL endpoints. They extend `RestClient` (for HTTP), `WebSocketClient` (for WS), or the base `Client` class.

When to build a client:
- You need to talk to an external API or service
- You want connection management, error handling, and observability for free
- You're wrapping an API so the rest of the codebase uses `container.client('name')`

## Imports

```ts
import { z } from 'zod'
import { Client, RestClient } from '@soederpop/luca/client'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '@soederpop/luca'
```

Use `RestClient` for HTTP APIs (most common). It gives you `get`, `post`, `put`, `patch`, `delete` methods that handle JSON, headers, and error wrapping.

## Schemas

```ts
export const {{PascalName}}StateSchema = ClientStateSchema.extend({
  // Add your state fields here.
  // Example: authenticated: z.boolean().default(false).describe('Whether API auth is configured'),
})
export type {{PascalName}}State = z.infer<typeof {{PascalName}}StateSchema>

export const {{PascalName}}OptionsSchema = ClientOptionsSchema.extend({
  // Add constructor options here.
  // Example: apiKey: z.string().optional().describe('API key for authentication'),
})
export type {{PascalName}}Options = z.infer<typeof {{PascalName}}OptionsSchema>
```

## Class

Running `luca introspect` captures JSDoc blocks and Zod schemas and includes them in the description whenever somebody calls `container.clients.describe('{{camelName}}')` or `luca describe {{camelName}}`.

```ts
/**
 * {{description}}
 *
 * @example
 * ```typescript
 * const {{camelName}} = container.client('{{camelName}}')
 * ```
 *
 * @extends RestClient
 */
export class {{PascalName}} extends RestClient<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'clients.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Client.register(this, '{{camelName}}') }

  /**
   * Called after the client is initialized. Use this for any setup logic
   * instead of overriding the constructor.
   */
  async afterInitialize() {
    // Set up default headers, configure auth, etc.
  }

  // Add API methods here. Each wraps an endpoint.
  // Example:
  // async listItems(): Promise<Item[]> {
  //   return this.get('/items')
  // }
}
```

**Important**: You almost never need to override the constructor. Use `afterInitialize()` for setup logic — it runs after the client is fully wired into the container. Set `baseURL` via the options schema default instead of constructor manipulation.

## Module Augmentation

```ts
declare module '@soederpop/luca/client' {
  interface AvailableClients {
    {{camelName}}: typeof {{PascalName}}
  }
}
```

## Registration

Registration happens inside the class body using a static block. The default export is just the class itself.

```ts
// Inside the class:
static { Client.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}
```

## Complete Example

```ts
import { z } from 'zod'
import { Client, RestClient } from '@soederpop/luca/client'
import { ClientStateSchema, ClientOptionsSchema } from '@soederpop/luca'

declare module '@soederpop/luca/client' {
  interface AvailableClients {
    {{camelName}}: typeof {{PascalName}}
  }
}

export const {{PascalName}}StateSchema = ClientStateSchema.extend({})
export type {{PascalName}}State = z.infer<typeof {{PascalName}}StateSchema>

export const {{PascalName}}OptionsSchema = ClientOptionsSchema.extend({
  baseURL: z.string().default('https://api.example.com').describe('API base URL'),
})
export type {{PascalName}}Options = z.infer<typeof {{PascalName}}OptionsSchema>

/**
 * {{description}}
 *
 * @example
 * ```typescript
 * const {{camelName}} = container.client('{{camelName}}')
 * ```
 *
 * @extends RestClient
 */
export class {{PascalName}} extends RestClient<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'clients.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Client.register(this, '{{camelName}}') }

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
  }
}

export default {{PascalName}}
```

## Conventions

- **Extend RestClient for HTTP**: It gives you typed HTTP methods. Only use base `Client` if you need a non-HTTP protocol.
- **Set baseURL via options schema**: Use a Zod `.default()` on the `baseURL` field rather than overriding the constructor.
- **Use `afterInitialize()`**: For any setup logic (auth, default headers, etc.) instead of overriding the constructor.
- **Wrap endpoints as methods**: Each API endpoint gets a method. Keep them thin — just map to HTTP calls.
- **JSDoc everything**: Every public method needs `@param`, `@returns`, `@example`. Run `luca introspect` after changes to update generated docs.
- **Auth in options**: Pass API keys, tokens via options schema. Check them in `afterInitialize()` or a setup method.
