// Auto-generated scaffold and MCP readme content
// Generated at: 2026-04-09T05:21:43.320Z
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
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'` },
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
   * Called after the feature is initialized. Use this for any setup logic
   * instead of overriding the constructor.
   */
  async afterInitialize() {
    // Set up initial state, start background tasks, etc.
  }
}` },
      { heading: "Module Augmentation", code: `declare module '@soederpop/luca' {
  interface AvailableFeatures {
    {{camelName}}: typeof {{PascalName}}
  }
}` },
      { heading: "Registration", code: `// Inside the class:
static { Feature.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'

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

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
  }
}

export default {{PascalName}}` }
    ],
    full: `import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'

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

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
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
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'
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
   * Called after the feature is initialized. Use this for any setup logic
   * instead of overriding the constructor.
   */
  async afterInitialize() {
    // Set up initial state, start background tasks, etc.
  }
}
\`\`\`

**Important**: You almost never need to override the constructor. Use \`afterInitialize()\` for any setup logic — it runs after the feature is fully wired into the container and has access to \`this.container\`, \`this.options\`, \`this.state\`, etc.

## Module Augmentation

This is what gives \`container.feature('yourName')\` TypeScript autocomplete. Without it, the feature works but TypeScript won't know about it.

\`\`\`ts
declare module '@soederpop/luca' {
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
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'

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

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
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
import { Client, RestClient } from '@soederpop/luca/client'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '@soederpop/luca'` },
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
}` },
      { heading: "Module Augmentation", code: `declare module '@soederpop/luca/client' {
  interface AvailableClients {
    {{camelName}}: typeof {{PascalName}}
  }
}` },
      { heading: "Registration", code: `// Inside the class:
static { Client.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
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

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
  }
}

export default {{PascalName}}` }
    ],
    full: `import { z } from 'zod'
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

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
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
import { Client, RestClient } from '@soederpop/luca/client'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '@soederpop/luca'
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
\`\`\`

**Important**: You almost never need to override the constructor. Use \`afterInitialize()\` for setup logic — it runs after the client is fully wired into the container. Set \`baseURL\` via the options schema default instead of constructor manipulation.

## Module Augmentation

\`\`\`ts
declare module '@soederpop/luca/client' {
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

  async afterInitialize() {
    // Setup logic goes here — not in the constructor
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
import { Server } from '@soederpop/luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from '@soederpop/luca'
import type { NodeContainer } from '@soederpop/luca'
import type { ServersInterface } from '@soederpop/luca'` },
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
      { heading: "Module Augmentation", code: `declare module '@soederpop/luca' {
  interface AvailableServers {
    {{camelName}}: typeof {{PascalName}}
  }
}` },
      { heading: "Registration", code: `// Inside the class:
static { Server.register(this, '{{camelName}}') }

// At module level:
export default {{PascalName}}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
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
import { Server } from '@soederpop/luca'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from '@soederpop/luca'
import type { NodeContainer } from '@soederpop/luca'
import type { ServersInterface } from '@soederpop/luca'
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
declare module '@soederpop/luca' {
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
import type { ContainerContext } from '@soederpop/luca'` },
      { heading: "Positional Arguments", code: `// luca {{kebabName}} ./src  =>  options.target === './src'
export const positionals = ['target']` },
      { heading: "Args Schema", code: `export const argsSchema = z.object({
  // Positional: first arg after command name (via positionals array above)
  // target: z.string().optional().describe('The target to operate on'),

  // Flags: passed as --flag on the CLI
  // verbose: z.boolean().default(false).describe('Enable verbose output'),
  // output: z.string().optional().describe('Output file path'),
})` },
      { heading: "Description", code: `export const description = '{{description}}'` },
      { heading: "Handler", code: `export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  // options.target is set from the first positional arg (via positionals export)
  // options.verbose, options.output, etc. come from --flags

  // Your implementation here
}` },
      { heading: "Complete Example", code: `import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = '{{description}}'

// Map positional args to named options: luca {{kebabName}} myTarget => options.target === 'myTarget'
export const positionals = ['target']

export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
})

export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  console.log('{{kebabName}} running...', options.target)
}` },
      { heading: "Container Properties", code: `export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
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
}` }
    ],
    full: `import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = '{{description}}'

// Map positional args to named options: luca {{kebabName}} myTarget => options.target === 'myTarget'
export const positionals = ['target']

export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
})

export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  console.log('{{kebabName}} running...', options.target)
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
import type { ContainerContext } from '@soederpop/luca'
\`\`\`

## Positional Arguments

Export a \`positionals\` array to map CLI positional args into named options fields. The first positional (\`_[0]\`) is always the command name — \`positionals\` maps \`_[1]\`, \`_[2]\`, etc.

\`\`\`ts
// luca {{kebabName}} ./src  =>  options.target === './src'
export const positionals = ['target']
\`\`\`

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

\`\`\`ts
export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  // options.target is set from the first positional arg (via positionals export)
  // options.verbose, options.output, etc. come from --flags

  // Your implementation here
}
\`\`\`

## Complete Example

\`\`\`ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = '{{description}}'

// Map positional args to named options: luca {{kebabName}} myTarget => options.target === 'myTarget'
export const positionals = ['target']

export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
})

export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  const fs = container.feature('fs')

  console.log('{{kebabName}} running...', options.target)
}
\`\`\`

## Container Properties

The \`context.container\` object provides useful properties beyond features:

\`\`\`ts
export default async function {{camelName}}(options: z.infer<typeof argsSchema>, context: ContainerContext) {
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

## Conventions

- **File location**: \`commands/{{kebabName}}.ts\` in the project root. The \`luca\` CLI discovers these automatically.
- **Naming**: kebab-case for filename. \`luca {{kebabName}}\` maps to \`commands/{{kebabName}}.ts\`.
- **Use the container**: Never import \`fs\`, \`path\`, \`child_process\` directly. Use \`container.feature('fs')\`, \`container.paths\`, \`container.feature('proc')\`.
- **Positional args**: Export \`positionals = ['name1', 'name2']\` to map CLI positional args into named options fields. For raw access, use \`container.argv._\` where \`_[0]\` is the command name.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI catches and reports them.
- **Help text**: Use \`.describe()\` on every schema field — it powers \`luca {{kebabName}} --help\`.
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

If your project has \`@soederpop/luca\` as an npm dependency, you can import \`z\` from \`zod\` and \`EndpointContext\` from \`@soederpop/luca\` for type safety. Otherwise, use \`any\` types — the framework handles validation and context injection for you.

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

If \`zod\` is available (via \`@soederpop/luca\` dependency or \`node_modules\`), export Zod schemas to validate parameters for each method. Name them \`{method}Schema\`:

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

Invalid requests automatically return 400 with Zod error details. Schemas also feed the auto-generated OpenAPI spec. If zod is not available, skip schema exports — the endpoint still works, you just lose automatic validation.

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
import type { ContainerContext } from '@soederpop/luca'` },
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
import type { ContainerContext } from '@soederpop/luca'

export const description = '{{description}}'

export const argsSchema = z.object({})

export async function run(args: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // Return your data here
  return {}
}` }
    ],
    full: `import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

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
import type { ContainerContext } from '@soederpop/luca'
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
import type { ContainerContext } from '@soederpop/luca'

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

export const schemas = {
	README: z.object({}).describe('CALL THIS README FUNCTION AS EARLY AS POSSIBLE')
}

export function README(options: z.infer<typeof schemas.README>) {
	return 'YO YO'
}

`,
    "hooks.ts": `export function started() {
	console.log('Assistant started!')
}
`
}

export const mcpReadme = `# Luca Development Guide

You are working in a **luca project**. The luca container provides all capabilities your code needs. Do not install npm packages or import Node.js builtins directly.

## The Contract

Every capability goes through the container. If you need something that doesn't exist, build it as a feature, client, or server. If it wraps a third-party library, the helper IS the interface — consumer code never imports the library directly.

## Import Rule

All consumer code imports from \`@soederpop/luca\` only:

\`\`\`ts
import { Feature, features, z, FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Client, clients, RestClient, ClientStateSchema } from '@soederpop/luca/client'
import { Server, servers, ServerStateSchema } from '@soederpop/luca'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
\`\`\`

Never import from \`fs\`, \`path\`, \`crypto\`, or other Node builtins. Never import third-party packages in consumer code. If a container feature wraps the functionality, use it.

## Zod v4

This project uses **Zod v4** — import \`z\` from \`@soederpop/luca\`, never from \`'zod'\` directly. All option, state, and event schemas use Zod v4 syntax. Key patterns:

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

If the project has \`node_modules\` and a package manager, helper implementations can import third-party libraries internally. If not (e.g. running via the \`luca\` binary's VM), all code must import only from \`@soederpop/luca\`.

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
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

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

declare module '@soederpop/luca' {
  interface AvailableFeatures { config: typeof Config }
}
export default features.register('config', Config)
\`\`\`

### Client with composition

Clients access features and other clients via \`this.container\`:

\`\`\`ts
import { z } from 'zod'
import { Client, clients, ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

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

declare module '@soederpop/luca' {
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

Code that only imports from \`@soederpop/luca\` can be copied between any luca project. That's the goal. Features, clients, servers, and commands written this way are portable building blocks.
`
