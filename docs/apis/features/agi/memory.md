# Memory (features.memory)

> Stability: `stable`

Semantic memory storage and retrieval for AI agents. Provides categorized memory with embedding-based search, metadata filtering, epoch tracking, and assistant tool integration. Built natively on Luca's SQLite and semanticSearch features.

## Usage

```ts
container.feature('memory', {
  // Path to SQLite database file. Defaults to .luca/agent-memory/<hash>.db in home dir
  dbPath,
  // Embedding model to use. When omitted, defaults to text-embedding-3-large for the openai provider, or the provider default for local. Note: changing this for an existing memory database mixes vector dimensions and breaks similarity search — wipe and re-index to switch models
  embeddingModel,
  // Where to generate embeddings. "local" serves embedding-gemma via a resident llama-server (fully offline, run `luca setup --local-embeddings` once); "openai" hits an OpenAI-compatible endpoint. When omitted: "openai" if an api key or embedding endpoint is configured, otherwise "local" — so a keyless machine falls back to local embeddings instead of failing
  embeddingProvider,
  // Override the OpenAI-compatible base URL for embeddings (Ollama, vLLM, LiteLLM, etc.). Falls back to the OPENAI_BASE_URL env var. Only used when embeddingProvider is "openai"
  embeddingBaseURL,
  // API key for the embedding endpoint. Falls back to the OPENAI_API_KEY env var. Only used when embeddingProvider is "openai"
  embeddingApiKey,
  // Model provider preset id (e.g. a modelProviders preset like 'claude-code' or a registered local model) or inline provider config for the consolidation judge. consolidate() uses it when no judge or provider is passed to the call. Chat/judging only — embeddings are controlled by embeddingProvider
  provider,
  // Model for the consolidation judge conversation. Usually unnecessary when provider is set (the preset carries its own model)
  model,
  // Default decay horizon for consolidate(): never-used, never-confirmed episodic memories go dormant after this many unreviewed epochs (default 3; 0 disables decay)
  dormantAfterEpochs,
  // Namespace to isolate memory sets (e.g. per-assistant)
  namespace,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `dbPath` | `string` | Path to SQLite database file. Defaults to .luca/agent-memory/<hash>.db in home dir |
| `embeddingModel` | `string` | Embedding model to use. When omitted, defaults to text-embedding-3-large for the openai provider, or the provider default for local. Note: changing this for an existing memory database mixes vector dimensions and breaks similarity search — wipe and re-index to switch models |
| `embeddingProvider` | `string` | Where to generate embeddings. "local" serves embedding-gemma via a resident llama-server (fully offline, run `luca setup --local-embeddings` once); "openai" hits an OpenAI-compatible endpoint. When omitted: "openai" if an api key or embedding endpoint is configured, otherwise "local" — so a keyless machine falls back to local embeddings instead of failing |
| `embeddingBaseURL` | `string` | Override the OpenAI-compatible base URL for embeddings (Ollama, vLLM, LiteLLM, etc.). Falls back to the OPENAI_BASE_URL env var. Only used when embeddingProvider is "openai" |
| `embeddingApiKey` | `string` | API key for the embedding endpoint. Falls back to the OPENAI_API_KEY env var. Only used when embeddingProvider is "openai" |
| `provider` | `any` | Model provider preset id (e.g. a modelProviders preset like 'claude-code' or a registered local model) or inline provider config for the consolidation judge. consolidate() uses it when no judge or provider is passed to the call. Chat/judging only — embeddings are controlled by embeddingProvider |
| `model` | `string` | Model for the consolidation judge conversation. Usually unnecessary when provider is set (the preset carries its own model) |
| `dormantAfterEpochs` | `number` | Default decay horizon for consolidate(): never-used, never-confirmed episodic memories go dormant after this many unreviewed epochs (default 3; 0 disables decay) |
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

Tool handler: store a memory with declared intent — observe, correct by id, or confirm by id.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category: string; text: string; intent?: 'observation' | 'correction' | 'confirmation'; regarding?: number; metadata?: Record<string, any> }` | ✓ | Parameter args |

**Returns:** `void`



### recall

Tool handler: search memories by semantic similarity.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category: string; query: string; n_results?: number }` | ✓ | Parameter args |

**Returns:** `void`



### forget

Tool handler: retract one memory by id.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category: string; id: number; reason?: string }` | ✓ | Parameter args |

**Returns:** `void`



### forgetCategory

Tool handler: wipe all memories in a category.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category: string }` | ✓ | Parameter args |

**Returns:** `void`



### consolidateMemory

Tool handler: run a consolidation pass (the assistant gardening its own memory).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ category?: string; dryRun?: boolean }` |  | Parameter args |

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



### observe

Append a raw observation to the episodic layer — no dedup, no judgment. This is the cheap write path: repeated observations are welcome (they become confirmation strength during consolidate()), and nothing is ever silently dropped. Consolidation later distills these into beliefs.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category to store the observation in |
| `text` | `string` | ✓ | What was observed |
| `metadata` | `Record<string, any>` |  | Optional metadata (e.g. provenance) |

**Returns:** `Promise<MemoryRecord>`

```ts
const mem = container.feature('memory')
await mem.observe('facts', 'User said they moved to Denver', { source: 'chat' })
```



### revise

Replace a memory with a corrected statement. The old row is kept but marked superseded (and excluded from search); the new row records what it replaced. This is the honest alternative to deleting or overwriting — the history of what was believed remains auditable.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category the memory belongs to |
| `id` | `number` | ✓ | The id of the memory being corrected |
| `newText` | `string` | ✓ | The corrected statement |
| `metadata` | `Record<string, any>` |  | Optional metadata for the new row |

**Returns:** `Promise<MemoryRecord | null>`

```ts
const mem = container.feature('memory')
await mem.revise('facts', 42, 'User now prefers claude-code over codex')
```



### retract

Mark a memory as retracted — no longer believed, but kept for audit. Retracted rows are excluded from search results.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category the memory belongs to |
| `id` | `number` | ✓ | The memory id |

**Returns:** `Promise<boolean>`



### confirm

Strengthen an existing memory: the same thing was observed again. Increments confirmations instead of writing a duplicate row — repeated observation is evidence, and this is how it accrues.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `category` | `string` | ✓ | The category the memory belongs to |
| `id` | `number` | ✓ | The memory id |

**Returns:** `Promise<MemoryRecord | null>`



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
| `options` | `{ maxDistance?: number; filterMetadata?: Record<string, any>; includeInactive?: boolean; trackUsage?: boolean }` |  | Additional search options |

`{ maxDistance?: number; filterMetadata?: Record<string, any>; includeInactive?: boolean; trackUsage?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `maxDistance` | `any` | Maximum cosine distance threshold (0-2, default none) |
| `filterMetadata` | `any` | Filter by metadata key-value pairs |
| `includeInactive` | `any` | Also return superseded/retracted/dormant/consolidated rows (default false) |
| `trackUsage` | `any` | Bump usage_count/last_used_at on the returned rows (default true). Internal comparisons pass false so bookkeeping reads don't count as recalls |

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



### consolidate

Run a consolidation pass over this namespace — the memory's sleep cycle. Embedding similarity is used only to propose clusters of rows that are about the same thing; an LLM judge (created at runtime, or injected via options.judge) then decides what each cluster means: duplicates merge into one belief with summed confirmations, contradictions resolve by superseding the outdated row, patterns across observations become generalized beliefs, and everything else is left alone. Old, never-used episodic rows decay to dormant. Nothing is ever deleted — every outcome is a status change with an audit trail (superseded_by, derived_from), so a wrong judgment is always reversible. Finishing a pass increments the epoch, so epoch counts sleep cycles and reviewed_epoch records when each row was last considered.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `MemoryConsolidateOptions` |  | Pass configuration |

`MemoryConsolidateOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `categories` | `string[]` | Restrict the pass to these categories (default: all categories in the namespace). |
| `clusterThreshold` | `number` | Cosine similarity at or above which two rows join the same cluster for review (default 0.7 — loose on purpose, so corrections land next to the beliefs they contradict). |
| `dormantAfterEpochs` | `number` | Move never-used, never-confirmed episodic rows to 'dormant' when they haven't been reviewed for this many epochs (default 3). Set to 0 to disable decay. |
| `dryRun` | `boolean` | Report what would happen without changing anything. The epoch is not advanced. |
| `judge` | `(prompt: string) => Promise<string>` | Override the LLM judge. Receives the cluster prompt, must return the model's raw text reply. Defaults to a conversation created at runtime. |
| `model` | `string` | Model for the default judge conversation. |
| `provider` | `any` | Provider preset or config for the default judge conversation (e.g. 'claude-code'). |

**Returns:** `Promise<MemoryConsolidateReport>`

```ts
const mem = container.feature('memory', { namespace: 'my-assistant' })
const report = await mem.consolidate({ provider: 'claude-code' })
console.log(`epoch ${report.epoch}: merged ${report.merged}, superseded ${report.superseded}`)
```



### reembedAll

Re-embed every memory in this namespace with the currently configured embedding model. Use this after changing embeddingModel or embeddingProvider — search compares vectors directly, so a database holding two different dimensionalities cannot be searched.

**Returns:** `Promise<number>`

```ts
const mem = container.feature('memory', { embeddingProvider: 'local' })
await mem.reembedAll()
```



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



**observe**

```ts
const mem = container.feature('memory')
await mem.observe('facts', 'User said they moved to Denver', { source: 'chat' })
```



**revise**

```ts
const mem = container.feature('memory')
await mem.revise('facts', 42, 'User now prefers claude-code over codex')
```



**createUnique**

```ts
const mem = container.feature('memory')
await mem.createUnique('facts', 'User prefers dark mode', {}, 0.9)
```



**consolidate**

```ts
const mem = container.feature('memory', { namespace: 'my-assistant' })
const report = await mem.consolidate({ provider: 'claude-code' })
console.log(`epoch ${report.epoch}: merged ${report.merged}, superseded ${report.superseded}`)
```



**reembedAll**

```ts
const mem = container.feature('memory', { embeddingProvider: 'local' })
await mem.reembedAll()
```

