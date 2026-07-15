# AssistantsManager (features.assistantsManager)

> Stability: `core`

Discovers and manages assistant definitions by looking for subdirectories in two locations: ~/.luca/assistants/ and cwd/assistants/. Each subdirectory containing a CORE.md is treated as an assistant definition. Use `discover()` to scan for available assistants, `list()` to enumerate them, and `create(name)` to instantiate one as a running Assistant feature.

## Usage

```ts
container.feature('assistantsManager')
```

## Methods

### intercept

Registers a pipeline interceptor that is applied to every assistant created by this manager. Interceptors are applied at the given interception point on each assistant at creation time. This mirrors the per-assistant `assistant.intercept(point, fn)` API, but scopes it globally across all assistants managed here — useful for cross-cutting concerns like logging, tracing, or policy enforcement.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `point` | `K` | ✓ | The interception point (beforeAsk, beforeTurn, beforeToolCall, afterToolCall, beforeResponse) |
| `fn` | `InterceptorFn<InterceptorPoints[K]>` | ✓ | Middleware function receiving (ctx, next) |

**Returns:** `this`

```ts
manager.intercept('beforeAsk', async (ctx, next) => {
 console.log(`[${ctx.assistant.name}] asking: ${ctx.message}`)
 await next()
})
```



### addDiscoveryFolder

Registers an additional folder to scan during assistant discovery and immediately triggers a new discovery pass.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `folderPath` | `string` | ✓ | Absolute path to a folder containing assistant subdirectories |

**Returns:** `Promise<this>`

```ts
await manager.addDiscoveryFolder('/path/to/more/assistants')
console.log(manager.available) // includes assistants from the new folder
```



### discover

Discovers assistants by listing subdirectories in ~/.luca/assistants/, cwd/assistants/, and any folders added via `addDiscoveryFolder()`. Each subdirectory containing a CORE.md is an assistant. Earlier locations take precedence when the same name appears in multiple folders.

**Returns:** `Promise<this>`



### downloadLucaCoreAssistants

Downloads the core assistants that ship with luca from GitHub into ~/.luca/assistants.

**Returns:** `Promise<{ files: string[]`

```ts
const manager = container.feature('assistantsManager')
await manager.downloadLucaCoreAssistants()
await manager.discover()
console.log(manager.available)
```



### list

Returns all discovered assistant entries as an array.

**Returns:** `AssistantEntry[]`



### get

Looks up a single assistant entry by name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The assistant name (e.g. 'chief-of-staff') |

**Returns:** `AssistantEntry | undefined`



### register

Registers a factory function that creates an assistant at runtime. Registered factories take precedence over discovered entries when calling `create()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | The assistant identifier |
| `factory` | `(options: Record<string, any>) => Assistant` | ✓ | Factory function that receives create options and returns an Assistant |

**Returns:** `this`

```ts
manager.register('custom-bot', (options) => {
 return container.feature('assistant', {
   systemPrompt: 'You are a custom bot.',
   ...options,
 })
})
const bot = manager.create('custom-bot')
```



### create

Creates and returns a new Assistant feature instance for the given name. Checks runtime-registered factories first, then falls back to discovered entries. The assistant is configured with the discovered folder path. Any additional options are merged in.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The assistant name (must match a registered factory or discovered entry) |
| `options` | `Record<string, any>` |  | Additional options to pass to the Assistant constructor |

**Returns:** `Assistant`

```ts
const assistant = manager.create('chief-of-staff', { model: 'gpt-4.1' })
```



### reload

Reload tools, hooks, and system prompt from disk for active assistants. When called with a name, reloads only that assistant. When called without arguments, reloads all active instances.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` |  | Optional assistant name to reload. Omit to reload all. |

**Returns:** `{ reloaded: string[] }`

```ts
manager.reload('researcher')       // reload one
manager.reload()                    // reload all active
```



### threadPrefixFor

Build the thread prefix for a given assistant name, matching the convention used by the Assistant class: `name:cwdHash:`. This allows history lookups without an active instance.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistantId` | `string` | ✓ | The assistant name |

**Returns:** `string`



### loadAssistantHistory

Load conversation history for an assistant. Works whether or not the assistant is currently instantiated — uses the thread prefix convention to query the conversationHistory feature directly.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistantId` | `string` | ✓ | The assistant name (e.g. 'researcher') |
| `options` | `{ limit?: number; includeMessages?: boolean; thread?: string }` |  | Query options |

`{ limit?: number; includeMessages?: boolean; thread?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `limit` | `any` | Maximum number of records to return |
| `includeMessages` | `any` | Load full records with messages (default: false, returns metadata only) |
| `thread` | `any` | Load a specific thread ID instead of all threads for this assistant |

**Returns:** `Promise<ConversationMeta[] | ConversationRecord[]>`

```ts
// List recent sessions (metadata only)
const sessions = await manager.loadAssistantHistory('researcher', { limit: 5 })

// Load full records with messages
const full = await manager.loadAssistantHistory('researcher', { includeMessages: true, limit: 3 })

// Load a specific thread
const thread = await manager.loadAssistantHistory('researcher', { thread: 'researcher:abc12345:2026-04-12' })
```



### getInstance

Returns a previously created assistant instance by name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The assistant name |

**Returns:** `Assistant | undefined`



### toSummary

Generates a markdown summary of all discovered assistants, listing their names and which definition files are present.

**Returns:** `string`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `entries` | `Record<string, AssistantEntry>` | Discovered assistant entries keyed by name. |
| `instances` | `Record<string, Assistant>` | Active assistant instances keyed by name. |
| `factories` | `Record<string, (options: Record<string, any>) => Assistant>` | Registered factory functions keyed by name. |
| `availableAssistants` | `string[]` | Alias for `available`. |
| `available` | `string[]` | Names of all available assistants — the union of discovered entries and runtime-registered factories, deduplicated. |

## Events (Zod v4 schema)

### discovered

Emitted when assistant discovery scan completes



### assistantRegistered

Emitted when an assistant factory is registered at runtime

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The assistant id |



### assistantCreated

Emitted when a new assistant instance is created

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The assistant name |
| `arg1` | `any` | The assistant instance |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `discovered` | `boolean` | Whether discovery has been run |
| `assistantCount` | `number` | Number of discovered assistant definitions |
| `activeCount` | `number` | Number of currently instantiated assistants |
| `entries` | `object` | Discovered assistant entries keyed by name |
| `instances` | `object` | Active assistant instances keyed by name |
| `factories` | `object` | Registered factory functions keyed by name |
| `extraFolders` | `array` | Additional folders to scan during discovery |

## Examples

**features.assistantsManager**

```ts
const manager = container.feature('assistantsManager')
manager.discover()
console.log(manager.list()) // [{ name: 'chief-of-staff', folder: '...', ... }]
const assistant = manager.create('chief-of-staff')
const answer = await assistant.ask('Hello!')
```



**intercept**

```ts
manager.intercept('beforeAsk', async (ctx, next) => {
 console.log(`[${ctx.assistant.name}] asking: ${ctx.message}`)
 await next()
})
```



**addDiscoveryFolder**

```ts
await manager.addDiscoveryFolder('/path/to/more/assistants')
console.log(manager.available) // includes assistants from the new folder
```



**downloadLucaCoreAssistants**

```ts
const manager = container.feature('assistantsManager')
await manager.downloadLucaCoreAssistants()
await manager.discover()
console.log(manager.available)
```



**register**

```ts
manager.register('custom-bot', (options) => {
 return container.feature('assistant', {
   systemPrompt: 'You are a custom bot.',
   ...options,
 })
})
const bot = manager.create('custom-bot')
```



**create**

```ts
const assistant = manager.create('chief-of-staff', { model: 'gpt-4.1' })
```



**reload**

```ts
manager.reload('researcher')       // reload one
manager.reload()                    // reload all active
```



**loadAssistantHistory**

```ts
// List recent sessions (metadata only)
const sessions = await manager.loadAssistantHistory('researcher', { limit: 5 })

// Load full records with messages
const full = await manager.loadAssistantHistory('researcher', { includeMessages: true, limit: 3 })

// Load a specific thread
const thread = await manager.loadAssistantHistory('researcher', { thread: 'researcher:abc12345:2026-04-12' })
```

