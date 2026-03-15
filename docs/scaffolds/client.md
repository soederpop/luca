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
import type { ContainerContext } from '@soederpop/luca'
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
  static override description = '{{description}}'
  static { Client.register(this, '{{camelName}}') }

  constructor(options: {{PascalName}}Options, context: ContainerContext) {
    options = {
      ...options,
      baseURL: options.baseURL || 'https://api.example.com',
    }
    super(options, context)
  }

  // Add API methods here. Each wraps an endpoint.
  // Example:
  // async listItems(): Promise<Item[]> {
  //   return this.get('/items')
  // }
}
```

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
import type { ContainerContext } from '@soederpop/luca'

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
  static override description = '{{description}}'
  static { Client.register(this, '{{camelName}}') }

  constructor(options: {{PascalName}}Options, context: ContainerContext) {
    super({ ...options, baseURL: options.baseURL }, context)
  }
}

export default {{PascalName}}
```

## Conventions

- **Extend RestClient for HTTP**: It gives you typed HTTP methods. Only use base `Client` if you need a non-HTTP protocol.
- **Set baseURL in constructor**: Override options to hardcode or default the API base URL.
- **Wrap endpoints as methods**: Each API endpoint gets a method. Keep them thin — just map to HTTP calls.
- **JSDoc everything**: Every public method needs `@param`, `@returns`, `@example`.
- **Auth in options**: Pass API keys, tokens via options schema. Check them in the constructor or a setup method.
