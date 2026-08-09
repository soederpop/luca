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



### setOptionOverrides

Stores workspace-level option overrides applied to every assistant this manager creates. The map is keyed by assistant short name, with a reserved `defaults` key merged into every assistant. Overrides sit between an assistant's own CORE.md frontmatter (weaker) and explicit `create()` options (stronger).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `map` | `Record<string, any>` | ✓ | e.g. `{ defaults: { model: 'x' }, chiefOfStaff: { temperature: 0.5 } }` |

**Returns:** `this`

```ts
manager.setOptionOverrides({ defaults: { providerOptions: { cwd } }, chiefOfStaff: { model: 'qwen3-coder' } })
```



### overridesFor

Resolves the effective option overrides for an assistant name by deep-merging the `defaults` entry with the per-assistant entry. Accepts either the short name or the `assistants/`-prefixed full name. Returns `{}` when none are set.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The assistant name |

**Returns:** `Record<string, any>`



### isDisabled

Whether an assistant is disabled in this workspace. Disabled assistants are hidden from `available`, `list()`, the `luca chat` picker, and an assistant's `availableSubagents` — but `get()` and `create()` still work, so naming one explicitly (`luca chat googleWorkspace`) runs it. Disabling is curation, not an access lock. Three sources, any of which disables: a runtime `disableAssistant()` call, a per-assistant `disabled: true` in `assistants/options.yml`, or the assistant's name appearing in a top-level `disabled:` list in that same file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The assistant name, with or without an `assistants/` prefix |

**Returns:** `boolean`

```ts
const manager = container.feature('assistantsManager')
manager.disableAssistant('googleWorkspace')
console.log(manager.isDisabled('googleWorkspace')) // true
```



### disableAssistant

Hides an assistant from every listing surface. Use this from a plugin or `luca.cli.ts` when the assistant's dependencies aren't present in the host workspace — e.g. a googleWorkspace assistant in a project without gws. Named `disableAssistant` rather than `disable` because `Feature.enable()` is the base-class lifecycle method — this pair is about assistants, not about this feature's own enabled state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The assistant name |

**Returns:** `this`

```ts
const manager = container.feature('assistantsManager')
if (!container.features.available.includes('gws')) manager.disableAssistant('googleWorkspace')
```



### enableAssistant

Undoes a runtime `disableAssistant()`. Note this only clears the runtime flag — an assistant disabled by `assistants/options.yml` stays hidden, since that file is the workspace owner's declaration.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The assistant name |

**Returns:** `this`

```ts
const manager = container.feature('assistantsManager')
manager.disableAssistant('googleWorkspace').enableAssistant('googleWorkspace')
console.log(manager.isDisabled('googleWorkspace')) // false
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

Returns all discovered assistant entries as an array, excluding disabled ones.

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
| `disabledAssistants` | `string[]` | The effective set of disabled assistant names — runtime `disableAssistant()` calls plus everything `assistants/options.yml` turns off. Only reports names the manager actually knows about. |
| `availableAssistants` | `string[]` | Alias for `available`. Excludes disabled assistants. |
| `available` | `string[]` | Names of all available assistants — the union of discovered entries and runtime-registered factories, deduplicated, with disabled assistants removed. Use `entries` / `factories` for the unfiltered source. |

## Events (Zod v4 schema)

### assistantDisabled

Emitted when an assistant is hidden or restored via disableAssistant()/enableAssistant()

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The assistant name |
| `arg1` | `boolean` | True when the assistant was disabled, false when re-enabled |



### discovered

Emitted when assistant discovery scan completes



### workspaceOptionsLoaded

Emitted when assistants/options.yml is parsed into option overrides

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Absolute path to the options.yml file that was loaded |



### workspaceHooksLoaded

Emitted when assistants/hooks.ts is imported

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Absolute path to the hooks.ts file that was loaded |



### unusedOverrides

Emitted after discovery when workspace options reference unknown assistants

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `array` | Override keys that do not match any known assistant name |



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
| `optionOverrides` | `object` | Workspace-level option overrides keyed by assistant name, plus a reserved `defaults` key applied to all |
| `disabled` | `array` | Assistant names disabled at runtime via disableAssistant(), hidden from available/list() |
| `workspaceOptionsPath` | `any` | Absolute path to the loaded assistants/options.yml, or null if none |
| `workspaceHooksPath` | `any` | Absolute path to the loaded assistants/hooks.ts, or null if none |

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



**setOptionOverrides**

```ts
manager.setOptionOverrides({ defaults: { providerOptions: { cwd } }, chiefOfStaff: { model: 'qwen3-coder' } })
```



**isDisabled**

```ts
const manager = container.feature('assistantsManager')
manager.disableAssistant('googleWorkspace')
console.log(manager.isDisabled('googleWorkspace')) // true
```



**disableAssistant**

```ts
const manager = container.feature('assistantsManager')
if (!container.features.available.includes('gws')) manager.disableAssistant('googleWorkspace')
```



**enableAssistant**

```ts
const manager = container.feature('assistantsManager')
manager.disableAssistant('googleWorkspace').enableAssistant('googleWorkspace')
console.log(manager.isDisabled('googleWorkspace')) // false
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

