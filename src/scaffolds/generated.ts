// Auto-generated scaffold and MCP readme content
// Source: docs/scaffolds/*.md, docs/examples/assistant/, and docs/mcp/readme.md
//
// Do not edit manually. Run: luca build-scaffolds

export interface ScaffoldSection {
  heading: string
  code: string
}

export interface ScaffoldData {
  sections: ScaffoldSection[]
  full: string
  tutorial: string
}

export const scaffolds: Record<string, ScaffoldData> = {
  feature: {
    sections: [
      { heading: "Imports", code: `import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'
import { Feature } from 'luca'` },
      { heading: "Schemas", code: `export const {{PascalName}}StateSchema = FeatureStateSchema.extend({
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
})` },
      { heading: "Class", code: `/**
 * {{description}}
 * \`\`\`typescript
 * const {{camelName}} = container.feature('{{camelName}}')
 * \`\`\`
 *
 * @extends Feature
 */
export class {{PascalName}} extends Feature<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'features.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static override eventsSchema = {{PascalName}}EventsSchema

  static { Feature.register(this, '{{camelName}}') }

  /**
   * Called after the feature is fully constructed. Use this for any setup logic
   * instead of overriding the constructor. NOTE: the return value is not
   * awaited — keep this synchronous and put async work behind an explicit
   * method or an enable()/start() lifecycle hook.
   */
  afterInitialize() {
    // Set up initial state, start background tasks, etc.
  }
}` },
      { heading: "Module Augmentation", code: `declare module 'luca' {
  interface AvailableFeatures {
    {{camelName}}: typeof {{PascalName}}
  }
}` },
      { heading: "Registration", code: `// Inside the class:
static { Feature.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from 'luca'
import { Feature } from 'luca'

declare module 'luca' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.feature('{{camelName}}')
 * \`\`\`
 *
 * @extends Feature
 */
export class {{PascalName}} extends Feature<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'features.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Feature.register(this, '{{camelName}}') }

  afterInitialize() {
    // Setup logic goes here — not in the constructor (runs after construction; not awaited)
  }
}

export default {{PascalName}}` }
    ],
    full: `import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from 'luca'
import { Feature } from 'luca'

declare module 'luca' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.feature('{{camelName}}')
 * \`\`\`
 *
 * @extends Feature
 */
export class {{PascalName}} extends Feature<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'features.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Feature.register(this, '{{camelName}}') }

  afterInitialize() {
    // Setup logic goes here — not in the constructor (runs after construction; not awaited)
  }
}

export default {{PascalName}}`,
    tutorial: `# Building a Feature

A feature is a container-managed capability — something your application needs that lives on the machine (file I/O, caching, encryption, etc). Features are lazy-loaded, observable, and self-documenting.

When to build a feature:
- You need a reusable local capability (not a network call — that's a client)
- You want state management, events, and introspection for free
- You're wrapping a library so the rest of the codebase uses a uniform interface

## Imports

\`\`\`ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'
import { Feature } from 'luca'
\`\`\`

These are the only imports your feature file needs from luca. If your feature wraps a third-party library, import it here too — feature implementations are the ONE place where direct library imports are allowed.

The use of dynamic imports is encouraged here, only import libraries you need when the feature is used, and only when necessary in the lifecycle of the feature if it can be done.

feature's have built in ways to check if their requirements are supported and can be enabled cautiously.

## Schemas

Define the shape of your feature's state, options, and events using Zod. Every field must have a \`.describe()\` — this becomes the documentation.

\`\`\`ts
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
\`\`\`

## Class

The class extends \`Feature\` with your state and options types. Static properties drive registration and introspection. Every public method needs a JSDoc block with \`@param\`, \`@returns\`, and \`@example\`.

Running \`luca introspect\` captures JSDoc blocks and Zod schemas and includes them in the description whenever somebody calls \`container.features.describe('{{camelName}}')\` or \`luca describe {{camelName}}\`.

\`\`\`ts
/**
 * {{description}}
 * \`\`\`typescript
 * const {{camelName}} = container.feature('{{camelName}}')
 * \`\`\`
 *
 * @extends Feature
 */
export class {{PascalName}} extends Feature<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'features.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static override eventsSchema = {{PascalName}}EventsSchema

  static { Feature.register(this, '{{camelName}}') }

  /**
   * Called after the feature is fully constructed. Use this for any setup logic
   * instead of overriding the constructor. NOTE: the return value is not
   * awaited — keep this synchronous and put async work behind an explicit
   * method or an enable()/start() lifecycle hook.
   */
  afterInitialize() {
    // Set up initial state, start background tasks, etc.
  }
}
\`\`\`

**Important**: You almost never need to override the constructor. Use \`afterInitialize()\` for any setup logic — it runs after the feature is fully wired into the container and has access to \`this.container\`, \`this.options\`, \`this.state\`, etc.

## Module Augmentation

This is what gives \`container.feature('yourName')\` TypeScript autocomplete. Without it, the feature works but TypeScript won't know about it.

\`\`\`ts
declare module 'luca' {
  interface AvailableFeatures {
    {{camelName}}: typeof {{PascalName}}
  }
}
\`\`\`

## Registration

Registration happens inside the class body using a static block. The default export is just the class itself.

\`\`\`ts
// Inside the class:
static { Feature.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}
\`\`\`

## Complete Example

Here's a minimal but complete feature. This is what a real feature file looks like:

\`\`\`ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from 'luca'
import { Feature } from 'luca'

declare module 'luca' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.feature('{{camelName}}')
 * \`\`\`
 *
 * @extends Feature
 */
export class {{PascalName}} extends Feature<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'features.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Feature.register(this, '{{camelName}}') }

  afterInitialize() {
    // Setup logic goes here — not in the constructor (runs after construction; not awaited)
  }
}

export default {{PascalName}}
\`\`\`

## Conventions

- **Naming**: PascalCase for class, camelCase for registration ID. The file name should be kebab-case (e.g. \`disk-cache.ts\`).
- **JSDoc**: Every public method, getter, and the class itself needs a JSDoc block. Include \`@example\` with working code.
- **Describe everything**: Every Zod field needs \`.describe()\`. Every event tuple argument needs \`.describe()\`. This IS the documentation.
- **No Node builtins in consumer code**: If your feature wraps \`fs\` or \`crypto\`, that's fine inside the feature. But code that USES your feature should never import those directly.
- **State is observable**: Use \`this.state.set()\` and \`this.state.get()\`. Don't use plain instance properties for data that should be reactive.
- **Events for lifecycle**: Emit events for significant state changes so consumers can react.
`,
  },
  client: {
    sections: [
      { heading: "Imports", code: `import { z } from 'zod'
import { Client, RestClient } from 'luca/client'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from 'luca'` },
      { heading: "Schemas", code: `export const {{PascalName}}StateSchema = ClientStateSchema.extend({
  // Add your state fields here.
  // Example: authenticated: z.boolean().default(false).describe('Whether API auth is configured'),
})
export type {{PascalName}}State = z.infer<typeof {{PascalName}}StateSchema>

export const {{PascalName}}OptionsSchema = ClientOptionsSchema.extend({
  // Add constructor options here.
  // Example: apiKey: z.string().optional().describe('API key for authentication'),
})
export type {{PascalName}}Options = z.infer<typeof {{PascalName}}OptionsSchema>` },
      { heading: "Class", code: `/**
 * {{description}}
 *
 * @example
 * \`\`\`typescript
 * const {{camelName}} = container.client('{{camelName}}')
 * \`\`\`
 *
 * @extends RestClient
 */
export class {{PascalName}} extends RestClient<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'clients.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Client.register(this, '{{camelName}}') }

  /**
   * Called after the client is fully constructed. Use this for any setup logic
   * instead of overriding the constructor. NOTE: the return value is not
   * awaited — keep this synchronous and put async work (connecting, handshakes)
   * behind an explicit method like \`connect()\`.
   */
  afterInitialize() {
    // Set up default headers, configure auth, etc.
  }

  // Add API methods here. Each wraps an endpoint.
  // Example:
  // async listItems(): Promise<Item[]> {
  //   return this.get('/items')
  // }
}` },
      { heading: "Module Augmentation", code: `declare module 'luca/client' {
  interface AvailableClients {
    {{camelName}}: typeof {{PascalName}}
  }
}` },
      { heading: "Registration", code: `// Inside the class:
static { Client.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
import { Client, RestClient } from 'luca/client'
import { ClientStateSchema, ClientOptionsSchema } from 'luca'

declare module 'luca/client' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.client('{{camelName}}')
 * \`\`\`
 *
 * @extends RestClient
 */
export class {{PascalName}} extends RestClient<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'clients.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Client.register(this, '{{camelName}}') }

  afterInitialize() {
    // Setup logic goes here — not in the constructor (runs after construction; not awaited)
  }
}

export default {{PascalName}}` }
    ],
    full: `import { z } from 'zod'
import { Client, RestClient } from 'luca/client'
import { ClientStateSchema, ClientOptionsSchema } from 'luca'

declare module 'luca/client' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.client('{{camelName}}')
 * \`\`\`
 *
 * @extends RestClient
 */
export class {{PascalName}} extends RestClient<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'clients.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Client.register(this, '{{camelName}}') }

  afterInitialize() {
    // Setup logic goes here — not in the constructor (runs after construction; not awaited)
  }
}

export default {{PascalName}}`,
    tutorial: `# Building a Client

A client is a container-managed connection to an external service. Clients handle network communication — HTTP APIs, WebSocket connections, GraphQL endpoints. They extend \`RestClient\` (for HTTP), \`WebSocketClient\` (for WS), or the base \`Client\` class.

When to build a client:
- You need to talk to an external API or service
- You want connection management, error handling, and observability for free
- You're wrapping an API so the rest of the codebase uses \`container.client('name')\`

## Imports

\`\`\`ts
import { z } from 'zod'
import { Client, RestClient } from 'luca/client'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from 'luca'
\`\`\`

Use \`RestClient\` for HTTP APIs (most common). It gives you \`get\`, \`post\`, \`put\`, \`patch\`, \`delete\` methods that handle JSON, headers, and error wrapping.

## Schemas

\`\`\`ts
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
\`\`\`

## Class

Running \`luca introspect\` captures JSDoc blocks and Zod schemas and includes them in the description whenever somebody calls \`container.clients.describe('{{camelName}}')\` or \`luca describe {{camelName}}\`.

\`\`\`ts
/**
 * {{description}}
 *
 * @example
 * \`\`\`typescript
 * const {{camelName}} = container.client('{{camelName}}')
 * \`\`\`
 *
 * @extends RestClient
 */
export class {{PascalName}} extends RestClient<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'clients.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Client.register(this, '{{camelName}}') }

  /**
   * Called after the client is fully constructed. Use this for any setup logic
   * instead of overriding the constructor. NOTE: the return value is not
   * awaited — keep this synchronous and put async work (connecting, handshakes)
   * behind an explicit method like \`connect()\`.
   */
  afterInitialize() {
    // Set up default headers, configure auth, etc.
  }

  // Add API methods here. Each wraps an endpoint.
  // Example:
  // async listItems(): Promise<Item[]> {
  //   return this.get('/items')
  // }
}
\`\`\`

**Important**: You almost never need to override the constructor. Use \`afterInitialize()\` for setup logic — it runs after the client is fully wired into the container. Set \`baseURL\` via the options schema default instead of constructor manipulation.

## Module Augmentation

\`\`\`ts
declare module 'luca/client' {
  interface AvailableClients {
    {{camelName}}: typeof {{PascalName}}
  }
}
\`\`\`

## Registration

Registration happens inside the class body using a static block. The default export is just the class itself.

\`\`\`ts
// Inside the class:
static { Client.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}
\`\`\`

## Complete Example

\`\`\`ts
import { z } from 'zod'
import { Client, RestClient } from 'luca/client'
import { ClientStateSchema, ClientOptionsSchema } from 'luca'

declare module 'luca/client' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.client('{{camelName}}')
 * \`\`\`
 *
 * @extends RestClient
 */
export class {{PascalName}} extends RestClient<{{PascalName}}State, {{PascalName}}Options> {
  static override shortcut = 'clients.{{camelName}}' as const
  static override stateSchema = {{PascalName}}StateSchema
  static override optionsSchema = {{PascalName}}OptionsSchema
  static { Client.register(this, '{{camelName}}') }

  afterInitialize() {
    // Setup logic goes here — not in the constructor (runs after construction; not awaited)
  }
}

export default {{PascalName}}
\`\`\`

## Conventions

- **Extend RestClient for HTTP**: It gives you typed HTTP methods. Only use base \`Client\` if you need a non-HTTP protocol.
- **Set baseURL via options schema**: Use a Zod \`.default()\` on the \`baseURL\` field rather than overriding the constructor.
- **Use \`afterInitialize()\`**: For any setup logic (auth, default headers, etc.) instead of overriding the constructor.
- **Wrap endpoints as methods**: Each API endpoint gets a method. Keep them thin — just map to HTTP calls.
- **JSDoc everything**: Every public method needs \`@param\`, \`@returns\`, \`@example\`. Run \`luca introspect\` after changes to update generated docs.
- **Auth in options**: Pass API keys, tokens via options schema. Check them in \`afterInitialize()\` or a setup method.
`,
  },
  server: {
    sections: [
      { heading: "Imports", code: `import { z } from 'zod'
import { Server } from 'luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from 'luca'
import type { NodeContainer } from 'luca'
import type { ServersInterface } from 'luca'` },
      { heading: "Schemas", code: `export const {{PascalName}}StateSchema = ServerStateSchema.extend({
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
})` },
      { heading: "Class", code: `/**
 * {{description}}
 *
 * @example
 * \`\`\`typescript
 * const {{camelName}} = container.server('{{camelName}}', { port: 3000 })
 * await {{camelName}}.start()
 * \`\`\`
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
}` },
      { heading: "Module Augmentation", code: `declare module 'luca' {
  interface AvailableServers {
    {{camelName}}: typeof {{PascalName}}
  }
}` },
      { heading: "Registration", code: `// Inside the class:
static { Server.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
import { Server } from 'luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from 'luca'
import type { NodeContainer } from 'luca'
import type { ServersInterface } from 'luca'

declare module 'luca' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.server('{{camelName}}', { port: 3000 })
 * await {{camelName}}.start()
 * \`\`\`
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

export default {{PascalName}}` }
    ],
    full: `import { z } from 'zod'
import { Server } from 'luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from 'luca'
import type { NodeContainer } from 'luca'
import type { ServersInterface } from 'luca'

declare module 'luca' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.server('{{camelName}}', { port: 3000 })
 * await {{camelName}}.start()
 * \`\`\`
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

export default {{PascalName}}`,
    tutorial: `# Building a Server

A server is a container-managed listener — something that accepts connections and handles requests. Servers manage their own lifecycle (configure, start, stop) and expose observable state.

When to build a server:
- You need to accept incoming connections (HTTP, WebSocket, custom protocol)
- You want lifecycle management, port handling, and observability for free
- You're wrapping a server library so the codebase uses \`container.server('name')\`

## Imports

\`\`\`ts
import { z } from 'zod'
import { Server } from 'luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from 'luca'
import type { NodeContainer } from 'luca'
import type { ServersInterface } from 'luca'
\`\`\`

## Schemas

\`\`\`ts
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
\`\`\`

## Class

Running \`luca introspect\` captures JSDoc blocks and Zod schemas and includes them in the description whenever somebody calls \`container.servers.describe('{{camelName}}')\` or \`luca describe {{camelName}}\`.

\`\`\`ts
/**
 * {{description}}
 *
 * @example
 * \`\`\`typescript
 * const {{camelName}} = container.server('{{camelName}}', { port: 3000 })
 * await {{camelName}}.start()
 * \`\`\`
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
\`\`\`

## Module Augmentation

\`\`\`ts
declare module 'luca' {
  interface AvailableServers {
    {{camelName}}: typeof {{PascalName}}
  }
}
\`\`\`

## Registration

Registration happens inside the class body using a static block. The default export is just the class itself.

\`\`\`ts
// Inside the class:
static { Server.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}
\`\`\`

## Complete Example

\`\`\`ts
import { z } from 'zod'
import { Server } from 'luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from 'luca'
import type { NodeContainer } from 'luca'
import type { ServersInterface } from 'luca'

declare module 'luca' {
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
 * \`\`\`typescript
 * const {{camelName}} = container.server('{{camelName}}', { port: 3000 })
 * await {{camelName}}.start()
 * \`\`\`
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
\`\`\`

## Conventions

- **Lifecycle**: Implement \`configure()\`, \`start()\`, and \`stop()\`. Check guards (\`isConfigured\`, \`isListening\`, \`isStopped\`) at the top of each.
- **Use \`afterInitialize()\`**: For any setup logic instead of overriding the constructor. Lifecycle methods (\`configure\`, \`start\`, \`stop\`) handle the server's runtime phases.
- **State tracking**: Set \`configured\`, \`listening\`, \`stopped\`, and \`port\` on the state. This powers the introspection system.
- **attach() is static**: It runs when the container first loads the server class. Use it for container-level setup if needed.
- **Port from options**: Accept port via options schema and respect it in \`start()\`. Allow override via start options.
- **JSDoc everything**: Every public method needs \`@param\`, \`@returns\`, \`@example\`. Run \`luca introspect\` after changes to update generated docs.
`,
  },
  command: {
    sections: [
      { heading: "Imports", code: `import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'` },
      { heading: "Positional Arguments", code: `// luca {{kebabName}} ./src  =>  options.target === './src'
export const positionals = ['target']` },
      { heading: "Positional Arguments", code: `export const positionals = [
  { name: 'target', description: 'The file or folder to operate on', required: false },
]` },
      { heading: "Positional Arguments", code: `// luca {{kebabName}} sum 1 2 3  =>  options.request === 'sum', options.numbers === [1, 2, 3]
export const positionals = ['request', '...numbers']

export const argsSchema = z.object({
  request: z.string().describe('The operation to perform'),
  numbers: z.array(z.number()).default([]).describe('Values to operate on'),
})` },
      { heading: "Rich Help: Subcommands and Examples", code: `// Renders a Subcommands: section, and gives each subcommand focused help:
// \`luca {{kebabName}} sync --help\` shows just that entry with its examples.
export const subcommands = {
  sync: {
    args: '<source>',
    description: 'Pull the latest data from a source',
    examples: ['luca {{kebabName}} sync ./data'],
  },
  status: {
    description: 'Show what would change without applying it',
  },
}

// Renders an Examples: section at the bottom of --help.
// Plain strings, or { command, description } to add a one-line comment.
export const examples = [
  'luca {{kebabName}} sync ./data',
  { command: 'luca {{kebabName}} status --json', description: 'Machine-readable output' },
]` },
      { heading: "Args Schema", code: `export const argsSchema = z.object({
  // Positional: first arg after command name (via positionals array above)
  // target: z.string().optional().describe('The target to operate on'),

  // Flags: passed as --flag on the CLI
  // verbose: z.boolean().default(false).describe('Enable verbose output'),
  // output: z.string().optional().describe('Output file path'),
})` },
      { heading: "Description", code: `export const description = '{{description}}'` },
      { heading: "Handler", code: `export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // options.<field> comes from --flags and mapped positionals
  // options._ is the raw positional array, typed as string[]

  // Your implementation here
}` },
      { heading: "Output and Exit Codes", code: `export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  const result = await doTheWork(container)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  ui.print.green(\`✓ processed \${result.count} items\`) // ui.print prints; ui.colors composes strings
  if (!result.ok) process.exitCode = 1
}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'

export const description = '{{description}}'

export const argsSchema = z.object({
  json: z.boolean().default(false).describe('Output machine-readable JSON'),
  // Each field becomes a --flag. Add positional args via the positionals export:
  // target: z.string().optional().describe('The target to operate on'),
})

// export const positionals = ['target']  // luca {{kebabName}} ./src => options.target === './src'

export const examples = [
  'luca {{kebabName}}',
  { command: 'luca {{kebabName}} --json', description: 'Machine-readable output' },
]

export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  const result = { ok: true }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  ui.print.green('{{kebabName}} ran successfully')
}` },
      { heading: "Container Properties", code: `export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Current working directory
  container.cwd                    // '/path/to/project'

  // Path utilities (scoped to cwd)
  container.paths.resolve('src')   // '/path/to/project/src'
  container.paths.join('a', 'b')   // '/path/to/project/a/b'
  container.paths.relative('src')  // 'src'

  // Package manifest (parsed package.json)
  container.manifest.name          // 'my-project'
  container.manifest.version       // '1.0.0'

  // Raw CLI arguments (from minimist) — prefer positionals export for positional args
  container.argv                   // { _: ['{{kebabName}}', ...], verbose: true, ... }
}` },
      { heading: "Long-Running Commands (daemons, pollers, watchers)", code: `export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  const server = container.server('express', { port: 4000 })
  await server.start()

  // Blocks until SIGINT/SIGTERM, then runs the cleanup and exits 0
  await context.runUntilShutdown(async () => {
    await server.stop()
  })
}` },
      { heading: "Long-Running Commands (daemons, pollers, watchers)", code: `export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Single-instance guard: exits if another copy is already running, cleans up the pid file on exit
  const proc = container.feature('proc')
  proc.establishLock('tmp/{{kebabName}}.pid')

  const scheduler = container.feature('scheduler')
  scheduler.every('30s', () => doOneUnitOfWork(container), { name: 'worker', immediate: true })

  // Hold the process open; on Ctrl-C every task stops, then onShutdown runs
  await scheduler.run({ onShutdown: () => flushBuffers() })
}` },
      { heading: "State Shared Between Invocations", code: `const stats = container.store('{{kebabName}}-stats', {
  schema: z.object({ processed: z.number().default(0), lastRunAt: z.string().optional() }),
})

// update() = lock → read → mutate → validate → atomic write.
// Concurrent invocations can never overwrite each other's writes.
await stats.update(s => { s.processed++; s.lastRunAt = new Date().toISOString() })

// A sibling process just reads — always fresh from disk
const { processed } = await stats.read()` }
    ],
    full: `import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'

export const description = '{{description}}'

export const argsSchema = z.object({
  json: z.boolean().default(false).describe('Output machine-readable JSON'),
  // Each field becomes a --flag. Add positional args via the positionals export:
  // target: z.string().optional().describe('The target to operate on'),
})

// export const positionals = ['target']  // luca {{kebabName}} ./src => options.target === './src'

export const examples = [
  'luca {{kebabName}}',
  { command: 'luca {{kebabName}} --json', description: 'Machine-readable output' },
]

export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  const result = { ok: true }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  ui.print.green('{{kebabName}} ran successfully')
}`,
    tutorial: `# Building a Command

A command extends the \`luca\` CLI. Commands live in a project's \`commands/\` folder and are automatically discovered. They are Helper subclasses under the hood — the framework grafts your module exports into a Command class at runtime.

When to build a command:
- You need a CLI task for a project (build scripts, generators, automation)
- You want argument parsing, help text, and container access for free
- The task should be runnable via \`luca yourCommand\`

## Imports

\`\`\`ts
import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'
\`\`\`

## Positional Arguments

Export a \`positionals\` array to map CLI positional args into named options fields. The first positional (\`_[0]\`) is always the command name — \`positionals\` maps \`_[1]\`, \`_[2]\`, etc.

\`\`\`ts
// luca {{kebabName}} ./src  =>  options.target === './src'
export const positionals = ['target']
\`\`\`

Positionals show up in \`--help\` as an \`Arguments:\` section. The description comes from the matching \`argsSchema\` field. When a positional has no schema field, use the object form to describe it inline:

\`\`\`ts
export const positionals = [
  { name: 'target', description: 'The file or folder to operate on', required: false },
]
\`\`\`

A trailing \`'...name'\` positional collects all remaining args as an array (a trailing field typed \`z.array(...)\` in the schema does the same):

\`\`\`ts
// luca {{kebabName}} sum 1 2 3  =>  options.request === 'sum', options.numbers === [1, 2, 3]
export const positionals = ['request', '...numbers']

export const argsSchema = z.object({
  request: z.string().describe('The operation to perform'),
  numbers: z.array(z.number()).default([]).describe('Values to operate on'),
})
\`\`\`

Parsing agrees with your schema — no workarounds needed:
- Boolean flags never consume a following positional (\`luca {{kebabName}} --json foo\` keeps \`foo\` as a positional).
- Positionals arrive as strings and are coerced to what the schema field expects — \`z.string()\` accepts \`8080\`, \`z.number()\` accepts \`'8080'\`. Don't reach for \`z.union([z.string(), z.number()])\`.

## Rich Help: Subcommands and Examples

Commands are how you teach other developers (and agents) to use your project's tooling — \`--help\` should tell the whole story. Two more exports feed the help system:

\`\`\`ts
// Renders a Subcommands: section, and gives each subcommand focused help:
// \`luca {{kebabName}} sync --help\` shows just that entry with its examples.
export const subcommands = {
  sync: {
    args: '<source>',
    description: 'Pull the latest data from a source',
    examples: ['luca {{kebabName}} sync ./data'],
  },
  status: {
    description: 'Show what would change without applying it',
  },
}

// Renders an Examples: section at the bottom of --help.
// Plain strings, or { command, description } to add a one-line comment.
export const examples = [
  'luca {{kebabName}} sync ./data',
  { command: 'luca {{kebabName}} status --json', description: 'Machine-readable output' },
]
\`\`\`

Subcommand *dispatch* stays in your handler — read the subcommand from a positional (\`export const positionals = ['subcommand']\`, then branch on \`options.subcommand\`). The \`subcommands\` export is the declarative help metadata that makes it discoverable. Fields named in \`positionals\` are automatically excluded from the \`Options:\` listing so they aren't documented twice.

## Args Schema

Define your command's arguments and flags with Zod. Each field becomes a \`--flag\` on the CLI. Fields named in \`positionals\` also accept positional args.

\`\`\`ts
export const argsSchema = z.object({
  // Positional: first arg after command name (via positionals array above)
  // target: z.string().optional().describe('The target to operate on'),

  // Flags: passed as --flag on the CLI
  // verbose: z.boolean().default(false).describe('Enable verbose output'),
  // output: z.string().optional().describe('Output file path'),
})
\`\`\`

## Description

Export a description string for \`luca --help\` display:

\`\`\`ts
export const description = '{{description}}'
\`\`\`

## Handler

Export a default async function. It receives parsed options and the container context. Use the container for all I/O. Positional args declared in the \`positionals\` export are available as named fields on \`options\`.

Type the options with \`CommandArgs<typeof argsSchema>\` — it's the inferred schema fields plus the raw positional array \`options._\` (where \`_[0]\` is the command name):

\`\`\`ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // options.<field> comes from --flags and mapped positionals
  // options._ is the raw positional array, typed as string[]

  // Your implementation here
}
\`\`\`

## Output and Exit Codes

Conventions that make commands scriptable and agent-friendly:

- **Support \`--json\` for machine output.** Declare \`json: z.boolean().default(false)\` and gate all human-facing output (\`ui.print.*\`, banners, spinners) behind \`if (!options.json)\`. With \`--json\`, print exactly one \`JSON.stringify(...)\` to stdout. If the command also writes an artifact (a report file), still write it — print the machine summary alongside.
- **Fail by throwing or by setting \`process.exitCode = 1\`.** A thrown error is reported cleanly (message only; \`--verbose\` or \`DEBUG=1\` adds the stack) and exits non-zero. For "soft" failures where you've already printed diagnostics, set \`process.exitCode = 1\` and return.
- **Verifier commands** (health checks, \`status\`, \`doctor\`) should exit non-zero on failure so shells and CI can branch on them. Test non-interactively with \`luca {{kebabName}} || echo failed\`.

\`\`\`ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  const result = await doTheWork(container)

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  ui.print.green(\`✓ processed \${result.count} items\`) // ui.print prints; ui.colors composes strings
  if (!result.ok) process.exitCode = 1
}
\`\`\`

## Complete Example

\`\`\`ts
import { z } from 'zod'
import type { ContainerContext, CommandArgs } from 'luca'

export const description = '{{description}}'

export const argsSchema = z.object({
  json: z.boolean().default(false).describe('Output machine-readable JSON'),
  // Each field becomes a --flag. Add positional args via the positionals export:
  // target: z.string().optional().describe('The target to operate on'),
})

// export const positionals = ['target']  // luca {{kebabName}} ./src => options.target === './src'

export const examples = [
  'luca {{kebabName}}',
  { command: 'luca {{kebabName}} --json', description: 'Machine-readable output' },
]

export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const ui = container.feature('ui')

  const result = { ok: true }

  if (options.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  ui.print.green('{{kebabName}} ran successfully')
}
\`\`\`

## Container Properties

The \`context.container\` object provides useful properties beyond features:

\`\`\`ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Current working directory
  container.cwd                    // '/path/to/project'

  // Path utilities (scoped to cwd)
  container.paths.resolve('src')   // '/path/to/project/src'
  container.paths.join('a', 'b')   // '/path/to/project/a/b'
  container.paths.relative('src')  // 'src'

  // Package manifest (parsed package.json)
  container.manifest.name          // 'my-project'
  container.manifest.version       // '1.0.0'

  // Raw CLI arguments (from minimist) — prefer positionals export for positional args
  container.argv                   // { _: ['{{kebabName}}', ...], verbose: true, ... }
}
\`\`\`

## Long-Running Commands (daemons, pollers, watchers)

A command that should keep running (a server, a watcher, a queue worker) ends with
\`context.runUntilShutdown(cleanup)\` — it holds the process open, wires SIGINT/SIGTERM,
runs your cleanup (5s guard; a second Ctrl-C exits immediately), then exits 0. Don't
hand-roll \`await new Promise(() => {})\` plus signal handlers:

\`\`\`ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  const server = container.server('express', { port: 4000 })
  await server.start()

  // Blocks until SIGINT/SIGTERM, then runs the cleanup and exits 0
  await context.runUntilShutdown(async () => {
    await server.stop()
  })
}
\`\`\`

Multiple calls share one shutdown; cleanups run LIFO. It's also on the container
(\`container.runUntilShutdown\`) for \`luca run\` scripts.

For *recurring* work, layer \`container.feature('scheduler')\` on top — named tasks on
intervals (\`'30s'\`, \`'5m'\`) or cron (\`'0 9 * * mon-fri'\`, \`'@hourly'\`), where the next run
never starts before the previous one finishes:

\`\`\`ts
export default async function {{camelName}}(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Single-instance guard: exits if another copy is already running, cleans up the pid file on exit
  const proc = container.feature('proc')
  proc.establishLock('tmp/{{kebabName}}.pid')

  const scheduler = container.feature('scheduler')
  scheduler.every('30s', () => doOneUnitOfWork(container), { name: 'worker', immediate: true })

  // Hold the process open; on Ctrl-C every task stops, then onShutdown runs
  await scheduler.run({ onShutdown: () => flushBuffers() })
}
\`\`\`

Inspect \`scheduler.tasks\` for run counts, errors, and next-run times. For a bare loop
without the managed layer, the primitives live on utils: \`container.utils.every(ms, fn)\`
(non-overlapping poll loop, returns \`stop()\`), \`container.utils.sleep(ms)\`, and
\`container.utils.backoff(fn, { attempts, delay })\` for retrying flaky calls.

## State Shared Between Invocations

Every \`luca\` command is a separate process — a daemon and the sibling commands that
inspect or control it (\`--stats\`, \`stop\`, \`status\`) share no memory. Give that shared
state a named store instead of inventing a dotfile:

\`\`\`ts
const stats = container.store('{{kebabName}}-stats', {
  schema: z.object({ processed: z.number().default(0), lastRunAt: z.string().optional() }),
})

// update() = lock → read → mutate → validate → atomic write.
// Concurrent invocations can never overwrite each other's writes.
await stats.update(s => { s.processed++; s.lastRunAt = new Date().toISOString() })

// A sibling process just reads — always fresh from disk
const { processed } = await stats.read()
\`\`\`

The file lives at \`.luca/store/{{kebabName}}-stats.json\` — plain JSON you can \`cat\`.
Full API and the which-store decision guide: \`luca describe store\`.

## Conventions

- **File location**: \`commands/{{kebabName}}.ts\` in the project root. The \`luca\` CLI discovers these automatically.
- **Naming**: kebab-case for filename. \`luca {{kebabName}}\` maps to \`commands/{{kebabName}}.ts\`.
- **Project helpers are pre-discovered**: \`luca <command>\` discovers the project's \`features/\`, \`clients/\`, and \`servers/\` folders before dispatch — \`container.feature('myProjectFeature')\` just works. Opt out with \`LUCA_COMMAND_DISCOVERY=commands-only\`.
- **Use the container**: Never import \`fs\`, \`path\`, \`child_process\` directly. Use \`container.feature('fs')\`, \`container.paths\`, \`container.feature('proc')\`.
- **Positional args**: Export \`positionals = ['name1', 'name2']\` (trailing \`'...rest'\` collects the remainder). For raw access, use \`options._\` where \`_[0]\` is the command name.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI reports the message cleanly (stack behind \`--verbose\`/\`DEBUG=1\`) and exits non-zero. Or set \`process.exitCode = 1\` for soft failures.
- **Help text**: Use \`.describe()\` on every schema field — it powers \`luca {{kebabName}} --help\`. Export \`examples\` (and \`subcommands\` when you branch on a verb) so \`--help\` teaches real usage, not just flags.
`,
  },
  endpoint: {
    sections: [
      { heading: "Required Exports", code: `export const path = '/api/{{camelName}}'
export const description = '{{description}}'
export const tags = ['{{camelName}}']` },
      { heading: "Handler Functions", code: `export async function get(params: any, ctx: any) {
  const fs = ctx.container.feature('fs')
  // Your logic here
  return { message: 'ok' }
}

export async function post(params: any, ctx: any) {
  // Create something
  return { created: true }
}` },
      { heading: "Validation Schemas", code: `import { z } from 'zod'

export const getSchema = z.object({
  q: z.string().optional().describe('Search query'),
  limit: z.number().default(20).describe('Max results'),
})

export const postSchema = z.object({
  title: z.string().min(1).describe('Item title'),
  body: z.string().min(1).describe('Item content'),
})` },
      { heading: "Rate Limiting", code: `// Global rate limit for all methods
export const rateLimit = { maxRequests: 100, windowSeconds: 60 }

// Per-method rate limit
export const postRateLimit = { maxRequests: 10, windowSeconds: 1 }` },
      { heading: "Delete Handler", code: `// Use a local name, then re-export as \`delete\`
const del = async (params: any, ctx: any) => {
  return { deleted: true }
}
export { del as delete }` },
      { heading: "Complete Example", code: `export const path = '/api/{{camelName}}'
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
  return { message: \`Deleted \${id}\` }
}
export { del as delete }` },
      { heading: "Dynamic Route Example", code: `// endpoints/{{camelName}}/[id].ts
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
  return { message: \`Deleted \${id}\` }
}
export { del as delete }` }
    ],
    full: `export const path = '/api/{{camelName}}'
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
  return { message: \`Deleted \${id}\` }
}
export { del as delete }`,
    tutorial: `# Building an Endpoint

An endpoint is a route handler that \`luca serve\` auto-discovers and mounts on an Express server. Endpoints live in \`endpoints/\` and follow a file-based routing convention — each file becomes an API route with automatic validation, OpenAPI spec generation, and rate limiting.

When to build an endpoint:
- You need a REST API route (GET, POST, PUT, PATCH, DELETE)
- You want Zod validation, OpenAPI docs, and rate limiting for free
- You're building an API that \`luca serve\` manages

## File Location

Endpoints go in \`endpoints/\` at your project root:
- \`endpoints/health.ts\` → \`/health\`
- \`endpoints/posts.ts\` → \`/api/posts\`
- \`endpoints/posts/[id].ts\` → \`/api/posts/:id\` (requires \`path\` export)

Run \`luca serve\` and they're automatically discovered and mounted.

## Imports

Endpoints are lightweight — just exports and handler functions. No imports are required.

If your project has \`luca\` as an npm dependency, you can import \`z\` from \`zod\` and \`EndpointContext\` from \`luca\` for type safety. Otherwise, use \`any\` types — the framework handles validation and context injection for you.

Access framework capabilities through the \`ctx\` parameter:
- \`ctx.container.feature('fs')\` for file operations
- \`ctx.container.feature('yaml')\` for YAML parsing
- \`ctx.container.feature('sqlite')\` for database access

## Required Exports

Every endpoint MUST export a \`path\` string:

\`\`\`ts
export const path = '/api/{{camelName}}'
export const description = '{{description}}'
export const tags = ['{{camelName}}']
\`\`\`

## Handler Functions

Export named functions for each HTTP method you support. Each receives validated parameters and a context object:

\`\`\`ts
export async function get(params: any, ctx: any) {
  const fs = ctx.container.feature('fs')
  // Your logic here
  return { message: 'ok' }
}

export async function post(params: any, ctx: any) {
  // Create something
  return { created: true }
}
\`\`\`

The \`EndpointContext\` gives you:
- \`ctx.container\` — the luca container (access any feature, client, etc.)
- \`ctx.request\` — Express request object
- \`ctx.response\` — Express response object
- \`ctx.query\` — parsed query string
- \`ctx.body\` — parsed request body
- \`ctx.params\` — URL parameters (\`:id\`, etc.)

Return any object — it's automatically JSON-serialized as the response.

## Validation Schemas

zod (v4) is **always available** — the luca runtime seeds it as a virtual module, so \`import { z } from 'zod'\` works in every endpoint file with zero installs, in binary mode and dev mode alike. Export Zod schemas to validate parameters for each method. Name them \`{method}Schema\`:

\`\`\`ts
import { z } from 'zod'

export const getSchema = z.object({
  q: z.string().optional().describe('Search query'),
  limit: z.number().default(20).describe('Max results'),
})

export const postSchema = z.object({
  title: z.string().min(1).describe('Item title'),
  body: z.string().min(1).describe('Item content'),
})
\`\`\`

Invalid requests automatically return 400 with Zod error details. Schemas also feed the auto-generated OpenAPI spec — skipping them costs you both the validation and the free API docs, so don't.

## Rate Limiting

Export rate limit config to protect endpoints:

\`\`\`ts
// Global rate limit for all methods
export const rateLimit = { maxRequests: 100, windowSeconds: 60 }

// Per-method rate limit
export const postRateLimit = { maxRequests: 10, windowSeconds: 1 }
\`\`\`

## Delete Handler

\`delete\` is a reserved word in JS, so you can't use it as a function name directly. Use a named export alias:

\`\`\`ts
// Use a local name, then re-export as \`delete\`
const del = async (params: any, ctx: any) => {
  return { deleted: true }
}
export { del as delete }
\`\`\`

You can also export \`deleteSchema\` and \`deleteRateLimit\` for validation and rate limiting on DELETE.

## Complete Example

A CRUD endpoint for a resource (no external imports needed):

\`\`\`ts
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
  return { message: \`Deleted \${id}\` }
}
export { del as delete }
\`\`\`

## Dynamic Route Example

For routes with URL parameters, create a nested file:

\`\`\`ts
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
  return { message: \`Deleted \${id}\` }
}
export { del as delete }
\`\`\`

## Conventions

- **File = route**: The file path maps to the URL path. \`endpoints/users.ts\` serves \`/api/users\`.
- **Export \`path\`**: Every endpoint must export a \`path\` string. This is the mounted route.
- **Use Zod schemas**: Name them \`getSchema\`, \`postSchema\`, etc. They validate AND document.
- **Use the container**: Access features via \`ctx.container.feature('fs')\`, not Node.js imports.
- **Return objects**: Handler return values are JSON-serialized. Use \`ctx.response\` only for streaming or custom status codes.
- **OpenAPI for free**: Your \`path\`, \`description\`, \`tags\`, and schemas automatically generate an OpenAPI spec at \`/openapi.json\`.
`,
  },
  selector: {
    sections: [
      { heading: "Imports", code: `import { z } from 'zod'
import type { ContainerContext } from 'luca'` },
      { heading: "Args Schema", code: `export const argsSchema = z.object({
  // Add your input arguments here.
  // Example: field: z.string().optional().describe('Specific field to return'),
})` },
      { heading: "Description", code: `export const description = '{{description}}'` },
      { heading: "Caching", code: `export function cacheKey(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  return context.container.git.currentCommitSha
}` },
      { heading: "Caching", code: `export const cacheable = false` },
      { heading: "Handler", code: `export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  // Query and return your data
  return { /* your data */ }
}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const description = '{{description}}'

export const argsSchema = z.object({})

export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Return your data here
  return {}
}` }
    ],
    full: `import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const description = '{{description}}'

export const argsSchema = z.object({})

export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Return your data here
  return {}
}`,
    tutorial: `# Building a Selector

A selector returns data. Where commands perform actions, selectors query and return structured results with built-in caching. Selectors live in a project's \`selectors/\` folder and are automatically discovered.

When to build a selector:
- You need to query project data (package info, file listings, config values)
- The result benefits from caching (keyed by git SHA or custom key)
- You want the data available via \`container.select('name')\` or \`luca select name\`

## Imports

\`\`\`ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'
\`\`\`

## Args Schema

Define the selector's input arguments with Zod.

\`\`\`ts
export const argsSchema = z.object({
  // Add your input arguments here.
  // Example: field: z.string().optional().describe('Specific field to return'),
})
\`\`\`

## Description

Export a description string for discoverability:

\`\`\`ts
export const description = '{{description}}'
\`\`\`

## Caching

Selectors cache by default. The default cache key is \`hashObject({ selectorName, args, gitSha })\` — same args + same commit = cache hit.

To customize the cache key:

\`\`\`ts
export function cacheKey(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  return context.container.git.currentCommitSha
}
\`\`\`

To disable caching:

\`\`\`ts
export const cacheable = false
\`\`\`

## Handler

Export a \`run\` function that returns data. It receives parsed args and the container context.

\`\`\`ts
export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  // Query and return your data
  return { /* your data */ }
}
\`\`\`

## Complete Example

\`\`\`ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const description = '{{description}}'

export const argsSchema = z.object({})

export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Return your data here
  return {}
}
\`\`\`

## Conventions

- **File location**: \`selectors/{{kebabName}}.ts\` in the project root. Discovered automatically.
- **Naming**: kebab-case for filename. \`luca select {{kebabName}}\` maps to \`selectors/{{kebabName}}.ts\`.
- **Use the container**: Never import \`fs\`, \`path\` directly. Use \`container.feature('fs')\`, \`container.paths\`.
- **Return data**: The \`run\` function must return the data. It gets wrapped in \`{ data, cached, cacheKey }\` by the framework.
- **Caching**: On by default. Override \`cacheKey()\` for custom invalidation, or set \`cacheable = false\` to skip.
- **CLI**: \`luca select {{kebabName}}\` runs the selector and prints JSON. Use \`--json\` for data only, \`--no-cache\` to force fresh.
`,
  },
  assistant: {
    sections: [
      { heading: "tools.ts — Tool Functions", code: `import { z } from 'zod'

export const schemas = {
	listTodos: z.object({
		include: z.string().optional().describe('Glob of files to search, e.g. "*.ts"'),
	}).describe('Find TODO/FIXME comments in the project'),
}

export async function listTodos(options: z.infer<typeof schemas.listTodos>) {
	const grep = container.feature('grep')
	const matches = await grep.todos({ include: options.include })
	return matches.map((m) => \`\${m.file}:\${m.line} \${m.content}\`).join('\\n')
}` },
      { heading: "hooks.ts — Lifecycle Event Handlers", code: `export function started() {
	console.log('Assistant started!')
}

export function toolCall(name: string, args: unknown) {
	console.log(\`calling \${name}\`, args)
}

export async function response(text: string) {
	await container.fs.appendFileAsync('assistant.log', text + '\\n')
}` }
    ],
    full: ``,
    tutorial: `# Building an Assistant

An assistant is an AI chat agent defined by a folder of files. Assistants live in a project's \`assistants/\` folder (or \`~/.luca/assistants/\` for user-global assistants) and are automatically discovered — any subdirectory containing a \`CORE.md\` is treated as an assistant definition.

When to build an assistant:
- You want a conversational agent with a custom system prompt
- You want to give a model tools (plain TypeScript functions) it can call
- You want to react to the agent's lifecycle (turns, tool calls, responses) with hooks

Unlike the other scaffold types, an assistant is not a single file. \`luca scaffold assistant <name>\` generates a folder:

\`\`\`
assistants/<name>/
  CORE.md    — system prompt (markdown, optional YAML frontmatter)
  tools.ts   — tool functions the assistant can call
  hooks.ts   — lifecycle event handlers
  voice.yml  — optional voice/TTS config (commented out by default)
\`\`\`

Start chatting with it immediately:

\`\`\`sh
luca scaffold assistant chief-of-staff
luca chat chief-of-staff
\`\`\`

## CORE.md — The System Prompt

\`CORE.md\` is a markdown file that gets injected into the system prompt of every chat completion call. Write it the way you would write instructions for the agent: who it is, what it knows, how it should behave.

Optional YAML frontmatter at the top of \`CORE.md\` is parsed as metadata (\`assistant.meta\`) and can provide default options for the assistant.

\`\`\`md
---
description: Runs my calendar and inbox
---
# Chief of Staff

You manage my schedule. Be terse. Always confirm before creating events.
\`\`\`

## tools.ts — Tool Functions

\`tools.ts\` exports plain functions, plus a \`schemas\` object whose keys match the exported function names and whose values are Zod v4 schemas describing each function's parameters. Every exported function with a matching schema becomes a tool the model can call.

The luca \`container\` is globally available inside \`tools.ts\` — do not import \`fs\`, \`path\`, or other builtins; use container features.

\`\`\`ts
import { z } from 'zod'

export const schemas = {
	listTodos: z.object({
		include: z.string().optional().describe('Glob of files to search, e.g. "*.ts"'),
	}).describe('Find TODO/FIXME comments in the project'),
}

export async function listTodos(options: z.infer<typeof schemas.listTodos>) {
	const grep = container.feature('grep')
	const matches = await grep.todos({ include: options.include })
	return matches.map((m) => \`\${m.file}:\${m.line} \${m.content}\`).join('\\n')
}
\`\`\`

Schema rules:
- Use \`.describe()\` on the schema and every field — descriptions are what the model sees.
- Do NOT use \`z.any()\` or \`z.record(z.any())\` in tool schemas — Zod v4's JSON Schema serializer cannot handle them. Accept a \`z.string()\` of JSON and parse it at runtime instead.

## hooks.ts — Lifecycle Event Handlers

\`hooks.ts\` exports functions whose names match events emitted by the assistant. Each exported function runs (and is awaited) when the matching event fires. The \`container\` global is available here too.

Hookable events include: \`created\`, \`started\`, \`turnStart\`, \`turnEnd\`, \`chunk\`, \`preview\`, \`response\`, \`toolCall\`, \`toolResult\`, and \`toolError\`. Run \`luca describe assistant --events\` for the full list with payloads.

\`\`\`ts
export function started() {
	console.log('Assistant started!')
}

export function toolCall(name: string, args: unknown) {
	console.log(\`calling \${name}\`, args)
}

export async function response(text: string) {
	await container.fs.appendFileAsync('assistant.log', text + '\\n')
}
\`\`\`

## voice.yml — Optional Voice Config

When \`voice.yml\` is present the assistant can become voice-capable via the \`voiceMode\` feature. The scaffolded file ships fully commented out; uncomment a provider (\`elevenlabs\` requires \`ELEVENLABS_API_KEY\`, \`voicebox\` requires a local VoiceBox service) to enable it.

\`\`\`yaml
# provider: elevenlabs
# voiceId: REPLACE_WITH_YOUR_VOICE_ID
\`\`\`

## Conventions

- **Folder location**: \`assistants/<name>/\` in the project root, or \`~/.luca/assistants/<name>/\` to make it available in every project. \`--output <dir>\` overrides the destination.
- **Discovery**: any folder under \`assistants/\` with a \`CORE.md\` is an assistant. \`tools.ts\`, \`hooks.ts\`, and \`voice.yml\` are optional.
- **Run it**: \`luca chat <name>\` starts an interactive session. \`luca chat <name> --use <feature>\` attaches container features to the assistant.
- **Use the container**: \`container\` is a global inside \`tools.ts\` and \`hooks.ts\`. Never import \`fs\`, \`path\`, or \`child_process\` — use \`container.feature('fs')\`, \`container.paths\`, \`container.feature('proc')\`.
- **Describe it**: \`luca describe assistant\` documents the assistant feature's full API, events, and options.
`,
  }
}

export const assistantFiles: Record<string, string> = {
    "CORE.md": `# Luca Assistant Example

You are currently an example / template "Assistant" provided by the Luca framework.  ( You'll probably have no idea what that is, don't worry, it doesn't matter ).

You are what gets scaffolded when a user writes the \`luca scaffold assistant\` command.

In luca, an Assistant is backed by a folder which has a few components:

- CORE.md -- this is a markdown file that will get injected into the system prompt of a chat completion call
- tools.ts -- this file is expected to export functions, and a schemas object whose keys are the names of the functions that get exported, and whose values are zod v4 schemas that describe the parameters
- hooks.ts -- this file is expexted to export functions, whose names match the events emitted by the luca assistant helper

Currently, the user is chatting with you from the \`luca chat\` CLI.  

You should tell them what each of these files is and how to edit them.

It is also important for them to know that the luca \`container\` is globally available for them in the context of the \`tools.ts\` and \`hooks.ts\` files.

`,
    "tools.ts": `import { z } from 'zod'

// The luca container is a global inside tools.ts and hooks.ts — no import
// needed. Declare it so TypeScript tooling doesn't flag it.
declare const container: any

// Every key in \`schemas\` must match an exported function below. The zod
// schema describes that function's options argument to the model.
//
// At runtime these become entries on \`assistant.tools\`, each shaped
// \`{ handler, parameters, description }\` — so call one manually with
// \`assistant.tools.myTool.handler({ ... })\`, not \`assistant.tools.myTool()\`.
//
// Verify your assistant is registered with:
//   luca eval "container.feature('assistantsManager').availableAssistants"
export const schemas = {
	README: z.object({}).describe('CALL THIS README FUNCTION AS EARLY AS POSSIBLE')
}

export function README(options: z.infer<typeof schemas.README>) {
	return 'YO YO'
}
`,
    "hooks.ts": `// Lifecycle hooks — export functions named after assistant events.
// The luca container is available here as a global, same as tools.ts.
declare const container: any

export function started() {
	console.log('Assistant started!')
}
`,
    "voice.yml": `# voice.yml — voice configuration for this assistant.
#
# When present, this assistant becomes voice-capable via the \`voiceMode\` feature.
# Activate by calling \`assistant.use(container.feature('voiceMode', VoiceMode.optionsFromConfig(config)))\`
# where \`config\` is the result of \`VoiceMode.readVoiceConfig(container, assistant)\`.
#
# Uncomment fields below to enable. All fields are optional; sensible defaults apply.

# ── Provider ──────────────────────────────────────────────────────────
# Which TTS backend to use. One of: elevenlabs, voicebox
# provider: elevenlabs

# ── ElevenLabs settings ───────────────────────────────────────────────
# Requires ELEVENLABS_API_KEY in the environment.
#
# voiceId: REPLACE_WITH_YOUR_VOICE_ID
# modelId: eleven_v3
# voiceSettings:
#   stability: 0.35
#   similarityBoost: 0.8
#   style: 0.6
#   speed: 1.0
#   useSpeakerBoost: true
#
# A short tag prepended to each synthesized chunk to steer tone/character.
# conversationModePrefix: '[warm tone]'

# ── VoiceBox settings (alternative to ElevenLabs) ─────────────────────
# Requires a running local VoiceBox.sh service.
#
# voicebox:
#   profileId: my-profile
#   engine: qwen
#   modelSize: 1.7B
#   language: en
#   instruct: null

# ── Chunking ──────────────────────────────────────────────────────────
# Maximum characters per synthesis chunk. Lower = snappier playback start,
# higher = fewer cuts. Default 200.
# maxChunkLength: 200

# ── Canned phrases (optional) ─────────────────────────────────────────
# Pre-recorded phrases by tag. The \`luca voice --generateSounds\` command
# (when available) synthesizes one audio file per phrase and writes a
# manifest the assistant can play during tool chains.
#
# phrases:
#   generic-ack:
#     - On it
#     - Got it
#   thinking:
#     - Let me think
#     - One moment
#   mistake:
#     - Oops
#     - Let me try again
`
}

export const mcpReadme = `# Luca Development Guide

You are working in a **luca project**. The luca container provides all capabilities your code needs. Do not install npm packages or import Node.js builtins directly.

## The Contract

Every capability goes through the container. If you need something that doesn't exist, build it as a feature, client, or server. If it wraps a third-party library, the helper IS the interface — consumer code never imports the library directly.

## Import Rule

All consumer code imports from \`luca\` only:

\`\`\`ts
import { Feature, features, z, FeatureStateSchema, FeatureOptionsSchema } from 'luca'
import { Client, clients, RestClient, ClientStateSchema } from 'luca/client'
import { Server, servers, ServerStateSchema } from 'luca'
import { commands, CommandOptionsSchema } from 'luca'
\`\`\`

Never import from \`fs\`, \`path\`, \`crypto\`, or other Node builtins. Never import third-party packages in consumer code. If a container feature wraps the functionality, use it.

## Zod v4

This project uses **Zod v4** — import \`z\` from \`luca\`, never from \`'zod'\` directly. All option, state, and event schemas use Zod v4 syntax. Key patterns:

\`\`\`ts
// Extending base schemas (options, state, events)
export const MyStateSchema = FeatureStateSchema.extend({
  count: z.number().default(0).describe('Number of items'),
  label: z.string().optional().describe('Display label'),
})

// Events use z.tuple() for listener arguments
export const MyEventsSchema = FeatureEventsSchema.extend({
  itemAdded: z.tuple([z.string().describe('key'), z.number().describe('index')]),
})

// Type inference
export type MyState = z.infer<typeof MyStateSchema>
\`\`\`

Zod v4 differences from v3 that matter:
- \`z.string().check(...)\` replaces some v3 refinement patterns
- \`.toJSONSchema()\` is built-in on any schema — no external library needed
- Error customization uses \`z.string({ error: "message" })\` not \`.refine()\` for simple cases
- \`z.interface()\` exists for recursive/lazy object types
- Do NOT use \`z.nativeEnum()\` — use \`z.enum()\` instead

## Dependencies

If the project has \`node_modules\` and a package manager, helper implementations can import third-party libraries internally. If not (e.g. running via the \`luca\` binary's VM), all code must import only from \`luca\`.

## Discovering Capabilities

The container has registries for features, clients, servers, commands, and endpoints. **Do not guess** what is available — use your MCP tools to discover it:

1. **\`find_capability\`** — Overview of all features, clients, and servers with descriptions. Start here.
2. **\`list_registry\`** — List all names in a specific registry (features, clients, servers, commands, endpoints).
3. **\`describe_helper\`** — Full API docs for a specific helper (methods, options, state, events). Call this before writing code that uses a helper.
4. **\`eval\`** — Once you know what you need, prototype calls in the live sandbox before writing them into files.

## Mini Examples

### Feature with composition

Features access other features via \`this.container.feature(...)\`:

\`\`\`ts
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'
import { Feature, features } from 'luca'
import type { ContainerContext } from 'luca'

export const ConfigStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().default(false).describe('Whether config has been loaded'),
})

export const ConfigOptionsSchema = FeatureOptionsSchema.extend({
  filePath: z.string().default('config.json').describe('Path to config file'),
})

export const ConfigEventsSchema = FeatureEventsSchema.extend({
  configLoaded: z.tuple([z.record(z.unknown()).describe('parsed config')]),
})

export class Config extends Feature<z.infer<typeof ConfigStateSchema>, z.infer<typeof ConfigOptionsSchema>> {
  static override shortcut = 'features.config' as const
  static override stateSchema = ConfigStateSchema
  static override optionsSchema = ConfigOptionsSchema
  static override eventsSchema = ConfigEventsSchema
  static override description = 'Loads and manages project configuration'

  /** Load and parse the config file */
  async load() {
    const fs = this.container.feature('fs')
    const raw = await fs.readFile(this.options.filePath)
    const data = JSON.parse(raw)
    this.state.set('loaded', true)
    this.emit('configLoaded', data)
    return data
  }
}

declare module 'luca' {
  interface AvailableFeatures { config: typeof Config }
}
export default features.register('config', Config)
\`\`\`

### Client with composition

Clients access features and other clients via \`this.container\`:

\`\`\`ts
import { z } from 'zod'
import { Client, clients, ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from 'luca'
import type { ContainerContext } from 'luca'

export const GithubOptionsSchema = ClientOptionsSchema.extend({
  token: z.string().describe('GitHub personal access token'),
  owner: z.string().describe('Repository owner'),
  repo: z.string().describe('Repository name'),
})

export const GithubEventsSchema = ClientEventsSchema.extend({
  issuesFetched: z.tuple([z.number().describe('count')]),
})

export class GithubClient extends Client<z.infer<typeof ClientStateSchema>, z.infer<typeof GithubOptionsSchema>> {
  static override shortcut = 'clients.github' as const
  static override optionsSchema = GithubOptionsSchema
  static override eventsSchema = GithubEventsSchema
  static override description = 'GitHub API client using container REST client'

  /** Fetch open issues */
  async issues() {
    const rest = this.container.client('rest')
    const res = await rest.get(\`https://api.github.com/repos/\${this.options.owner}/\${this.options.repo}/issues\`, {
      headers: { Authorization: \`token \${this.options.token}\` },
    })
    this.emit('issuesFetched', res.data.length)
    return res.data
  }
}

declare module 'luca' {
  interface AvailableClients { github: typeof GithubClient }
}
export default clients.register('github', GithubClient)
\`\`\`

## Workflow

1. **\`find_capability\`** — Search what already exists before writing anything
2. **\`describe_helper\`** — Read the full API docs for the helper you need
3. **\`eval\`** — Prototype and test container API calls in the sandbox
4. **\`scaffold\`** — Generate correct boilerplate when building something new
5. **Write the file** — Using the patterns from the scaffold

## Portability

Code that only imports from \`luca\` can be copied between any luca project. That's the goal. Features, clients, servers, and commands written this way are portable building blocks.
`
