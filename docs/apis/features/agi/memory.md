# Memory (features.memory)

> Stability: `stable`

Semantic memory storage and retrieval for AI agents. Provides categorized memory with embedding-based search, metadata filtering, epoch tracking, and assistant tool integration. Built natively on Luca's SQLite and semanticSearch features.

## Usage

```ts
container.feature('memory', {
  // Path to SQLite database file. Defaults to .luca/agent-memory/<hash>.db in home dir
  dbPath,
  // OpenAI embedding model to use
  embeddingModel,
  // Namespace to isolate memory sets (e.g. per-assistant)
  namespace,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `dbPath` | `string` | Path to SQLite database file. Defaults to .luca/agent-memory/<hash>.db in home dir |
| `embeddingModel` | `string` | OpenAI embedding model to use |
| `namespace` | `string` | Namespace to isolate memory sets (e.g. per-assistant) |

## Methods

### initDb

Initialize the SQLite database and create tables. Called automatically on first use, but can be called explicitly.

**Returns:** `void`

```ts
const mem = container.feature('memory')
await mem.initDb()
```



### remember

Tool handler: store a memory, deduplicating by similarity.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category: string; text: string; metadata?: Record<string, any> }` | ✓ | Parameter args |

**Returns:** `void`



### recall

Tool handler: search memories by semantic similarity.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category: string; query: string; n_results?: number }` | ✓ | Parameter args |

**Returns:** `void`



### forgetCategory

Tool handler: wipe all memories in a category.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category: string }` | ✓ | Parameter args |

**Returns:** `void`



### listCategories

Tool handler: list all categories with counts.

**Returns:** `void`



### setupToolsConsumer

When an assistant uses memory, inject system prompt guidance.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



### create

Create a new memory in the given category.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category to store the memory in |
| `text` | `string` | ✓ | The text content of the memory |
| `metadata` | `Record<string, any>` |  | Optional metadata key-value pairs |

**Returns:** `Promise<MemoryRecord>`

```ts
const mem = container.feature('memory')
await mem.create('facts', 'The user lives in Austin', { confidence: 0.9 })
```



### createUnique

Create a memory only if no sufficiently similar memory exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category to store the memory in |
| `text` | `string` | ✓ | The text content of the memory |
| `metadata` | `Record<string, any>` |  | Optional metadata |
| `similarityThreshold` | `any` |  | Minimum cosine similarity to consider a duplicate (0-1, default 0.95) |

**Returns:** `Promise<MemoryRecord | null>`

```ts
const mem = container.feature('memory')
await mem.createUnique('facts', 'User prefers dark mode', {}, 0.9)
```



### get

Get a memory by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category the memory belongs to |
| `id` | `number` | ✓ | The memory ID |

**Returns:** `Promise<MemoryRecord | null>`



### getAll

Get all memories in a category, with optional metadata filtering.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category to query |
| `options` | `{ limit?: number; sortOrder?: 'asc' | 'desc'; filterMetadata?: Record<string, any> }` |  | Query options |

`{ limit?: number; sortOrder?: 'asc' | 'desc'; filterMetadata?: Record<string, any> }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `limit` | `any` | Max results (default 20) |
| `sortOrder` | `any` | 'asc' or 'desc' by created_at (default 'desc') |
| `filterMetadata` | `any` | Filter by metadata key-value pairs |

**Returns:** `Promise<MemoryRecord[]>`



### update

Update a memory's text and/or metadata.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category the memory belongs to |
| `id` | `number` | ✓ | The memory ID |
| `updates` | `{ text?: string; metadata?: Record<string, any> }` | ✓ | Fields to update |

`{ text?: string; metadata?: Record<string, any> }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `text` | `any` | New text content (re-embeds automatically) |
| `metadata` | `any` | Metadata to merge |

**Returns:** `Promise<MemoryRecord | null>`



### delete

Delete a specific memory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category |
| `id` | `number` | ✓ | The memory ID |

**Returns:** `Promise<boolean>`



### wipeCategory

Delete all memories in a category.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category to wipe |

**Returns:** `Promise<number>`



### wipeAll

Delete all memories across all categories in this namespace.

**Returns:** `Promise<number>`



### count

Count memories in a category (or all categories if omitted).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` |  | Optional category to count |

**Returns:** `Promise<number>`



### categories

List all categories that have memories.

**Returns:** `Promise<string[]>`



### search

Search memories by semantic similarity.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category to search in |
| `query` | `string` | ✓ | The search query (will be embedded) |
| `nResults` | `any` |  | Maximum number of results (default 5) |
| `options` | `{ maxDistance?: number; filterMetadata?: Record<string, any> }` |  | Additional search options |

`{ maxDistance?: number; filterMetadata?: Record<string, any> }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `maxDistance` | `any` | Maximum cosine distance threshold (0-2, default none) |
| `filterMetadata` | `any` | Filter by metadata key-value pairs |

**Returns:** `Promise<MemorySearchResult[]>`



### getEpoch

Get the current epoch value.

**Returns:** `number`



### setEpoch

Set the epoch to a specific value.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `value` | `number` | ✓ | The new epoch value |

**Returns:** `void`



### incrementEpoch

Increment the epoch by 1.

**Returns:** `Promise<number>`



### createEvent

Create a timestamped event memory in the 'events' category, automatically tagged with the current epoch.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The event description |
| `metadata` | `Record<string, any>` |  | Optional additional metadata |

**Returns:** `Promise<MemoryRecord>`



### getEvents

Get events, optionally filtered by epoch.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ epoch?: number; limit?: number }` |  | Query options |

`{ epoch?: number; limit?: number }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `epoch` | `any` | Filter to a specific epoch |
| `limit` | `any` | Max results (default 10) |

**Returns:** `Promise<MemoryRecord[]>`



### exportToJson

Export all memories in this namespace to a JSON-serializable object.

**Returns:** `Promise<{ namespace: string; epoch: number; memories: MemoryRecord[] }>`



### importFromJson

Import memories from a JSON export. Optionally replaces all existing memories.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `{ namespace?: string; epoch?: number; memories: Array<{ category: string; document: string; metadata?: Record<string, any> }> }` | ✓ | The exported data object |
| `replace` | `any` |  | If true, wipe existing memories before importing (default true) |

**Returns:** `Promise<number>`



## Events (Zod v4 schema)

### dbInitialized

Emitted when the database is ready



### memoryCreated

Emitted when a memory is created

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `number` |  |
| `category` | `string` |  |
| `document` | `string` |  |



### memoryDeleted

Emitted when a memory is deleted

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `number` |  |
| `category` | `string` |  |



### epochChanged

Emitted when the epoch changes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | New epoch value |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `dbReady` | `boolean` | Whether the SQLite database is initialized |
| `totalMemories` | `number` | Total memories across all categories |
| `epoch` | `number` | Current epoch for event grouping |

## Examples

**features.memory**

```ts
const mem = container.feature('memory')
await mem.create('user-prefs', 'Prefers dark mode', { source: 'onboarding' })
const results = await mem.search('user-prefs', 'UI preferences')
```



**initDb**

```ts
const mem = container.feature('memory')
await mem.initDb()
```



**create**

```ts
const mem = container.feature('memory')
await mem.create('facts', 'The user lives in Austin', { confidence: 0.9 })
```



**createUnique**

```ts
const mem = container.feature('memory')
await mem.createUnique('facts', 'User prefers dark mode', {}, 0.9)
```

