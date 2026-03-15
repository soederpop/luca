# Building a Server

A server is a container-managed listener — something that accepts connections and handles requests. Servers manage their own lifecycle (configure, start, stop) and expose observable state.

When to build a server:
- You need to accept incoming connections (HTTP, WebSocket, custom protocol)
- You want lifecycle management, port handling, and observability for free
- You're wrapping a server library so the codebase uses `container.server('name')`

## Imports

```ts
import { z } from 'zod'
import { Server } from '@soederpop/luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from '@soederpop/luca'
import type { NodeContainer } from '@soederpop/luca'
import type { ServersInterface } from '@soederpop/luca'
```

## Schemas

```ts
export const {{PascalName}}StateSchema = ServerStateSchema.extend({
  // Add your state fields here.
  // Example: connectionCount: z.number().default(0).describe('Active connections'),
})
export type {{PascalName}}State = z.infer<typeof {{PascalName}}StateSchema>

export const {{PascalName}}OptionsSchema = ServerOptionsSchema.extend({
  // Add constructor options here. port and host come from ServerOptionsSchema.
  // Example: cors: z.boolean().default(true).describe('Enable CORS'),
})
export type {{PascalName}}Options = z.infer<typeof {{PascalName}}OptionsSchema>

export const {{PascalName}}EventsSchema = ServerEventsSchema.extend({
  // Add your events here.
  // Example: connection: z.tuple([z.string().describe('Client ID')]).describe('New client connected'),
})
```

## Class

Running `luca introspect` captures JSDoc blocks and Zod schemas and includes them in the description whenever somebody calls `container.servers.describe('{{camelName}}')` or `luca describe {{camelName}}`.

```ts
/**
 * {{description}}
 *
 * @example
 * ```typescript
 * const {{camelName}} = container.server('{{camelName}}', { port: 3000 })
 * await {{camelName}}.start()
 * ```
 *
 * @extends Server
 */
export class {{PascalName}} extends Server<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'servers.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static override eventsSchema = {{PascalName}}EventsSchema
  static { Server.register(this, '{{camelName}}') }

  static override attach(container: NodeContainer & ServersInterface) {
    return container
  }

  override async configure() {
    if (this.isConfigured) return this
    // Set up the underlying server here
    this.state.set('configured', true)
    return this
  }

  override async start(options?: { port?: number }) {
    if (this.isListening) return this
    if (!this.isConfigured) await this.configure()

    const port = options?.port || this.options.port || 3000
    // Start listening here
    this.state.set('port', port)
    this.state.set('listening', true)
    return this
  }

  override async stop() {
    if (this.isStopped) return this
    // Clean up connections here
    this.state.set('listening', false)
    this.state.set('stopped', true)
    return this
  }
}
```

## Module Augmentation

```ts
declare module '@soederpop/luca' {
  interface AvailableServers {
    {{camelName}}: typeof {{PascalName}}
  }
}
```

## Registration

Registration happens inside the class body using a static block. The default export is just the class itself.

```ts
// Inside the class:
static { Server.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}
```

## Complete Example

```ts
import { z } from 'zod'
import { Server } from '@soederpop/luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from '@soederpop/luca'
import type { NodeContainer } from '@soederpop/luca'
import type { ServersInterface } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableServers {
    {{camelName}}: typeof {{PascalName}}
  }
}

export const {{PascalName}}StateSchema = ServerStateSchema.extend({})
export type {{PascalName}}State = z.infer<typeof {{PascalName}}StateSchema>

export const {{PascalName}}OptionsSchema = ServerOptionsSchema.extend({})
export type {{PascalName}}Options = z.infer<typeof {{PascalName}}OptionsSchema>

export const {{PascalName}}EventsSchema = ServerEventsSchema.extend({})

/**
 * {{description}}
 *
 * @example
 * ```typescript
 * const {{camelName}} = container.server('{{camelName}}', { port: 3000 })
 * await {{camelName}}.start()
 * ```
 *
 * @extends Server
 */
export class {{PascalName}} extends Server<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'servers.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static override eventsSchema = {{PascalName}}EventsSchema
  static { Server.register(this, '{{camelName}}') }

  static override attach(container: NodeContainer & ServersInterface) {
    return container
  }

  override async configure() {
    if (this.isConfigured) return this
    this.state.set('configured', true)
    return this
  }

  override async start(options?: { port?: number }) {
    if (this.isListening) return this
    if (!this.isConfigured) await this.configure()
    const port = options?.port || this.options.port || 3000
    this.state.set('port', port)
    this.state.set('listening', true)
    return this
  }

  override async stop() {
    if (this.isStopped) return this
    this.state.set('listening', false)
    this.state.set('stopped', true)
    return this
  }
}

export default {{PascalName}}
```

## Conventions

- **Lifecycle**: Implement `configure()`, `start()`, and `stop()`. Check guards (`isConfigured`, `isListening`, `isStopped`) at the top of each.
- **Use `afterInitialize()`**: For any setup logic instead of overriding the constructor. Lifecycle methods (`configure`, `start`, `stop`) handle the server's runtime phases.
- **State tracking**: Set `configured`, `listening`, `stopped`, and `port` on the state. This powers the introspection system.
- **attach() is static**: It runs when the container first loads the server class. Use it for container-level setup if needed.
- **Port from options**: Accept port via options schema and respect it in `start()`. Allow override via start options.
- **JSDoc everything**: Every public method needs `@param`, `@returns`, `@example`. Run `luca introspect` after changes to update generated docs.
