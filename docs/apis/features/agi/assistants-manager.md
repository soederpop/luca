# AssistantsManager (features.assistantsManager)

Discovers and manages assistant definitions by looking for subdirectories in two locations: ~/.luca/assistants/ and cwd/assistants/. Each subdirectory containing a CORE.md is treated as an assistant definition. Use `discover()` to scan for available assistants, `list()` to enumerate them, and `create(name)` to instantiate one as a running Assistant feature.

## Usage

```ts
container.feature('assistantsManager')
```

## Methods

### discover

Discovers assistants by listing subdirectories in ~/.luca/assistants/ and cwd/assistants/. Each subdirectory containing a CORE.md is an assistant.

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
| `available` | `any` |  |

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

## Examples

**features.assistantsManager**

```ts
const manager = container.feature('assistantsManager')
manager.discover()
console.log(manager.list()) // [{ name: 'chief-of-staff', folder: '...', ... }]
const assistant = manager.create('chief-of-staff')
const answer = await assistant.ask('Hello!')
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

