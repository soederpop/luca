# SemanticSearch (features.semanticSearch)

> Stability: `experimental`

Semantic search feature providing BM25 keyword search, vector similarity search, and hybrid search with Reciprocal Rank Fusion over a SQLite-backed index. Uses bun:sqlite for FTS5 keyword search and BLOB-stored embeddings with JavaScript cosine similarity for vector search. Embedding models default per provider: `openai` → text-embedding-3-small, `local` → embedding-gemma-300M-Q8_0 (the only supported local model). Local embeddings are NOT turnkey until you run `installLocalEmbeddings(cwd)` once — it installs the node-llama-cpp addon and downloads the .gguf weights to ~/.cache/luca/models/.

## Usage

```ts
container.feature('semanticSearch', {
  // Path to the SQLite database file
  dbPath,
  // Embedding model name. Defaults per provider — openai: text-embedding-3-small (also valid: text-embedding-3-large); local: embedding-gemma-300M-Q8_0 (the only supported local model; weights are downloaded by installLocalEmbeddings())
  embeddingModel,
  // Where to generate embeddings. "local" runs embedding-gemma via node-llama-cpp — run installLocalEmbeddings() once to install the addon and download the model weights
  embeddingProvider,
  // How to split documents
  chunkStrategy,
  // Token limit per chunk for fixed strategy
  chunkSize,
  // Overlap ratio for fixed strategy
  chunkOverlap,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `dbPath` | `string` | Path to the SQLite database file |
| `embeddingModel` | `string` | Embedding model name. Defaults per provider — openai: text-embedding-3-small (also valid: text-embedding-3-large); local: embedding-gemma-300M-Q8_0 (the only supported local model; weights are downloaded by installLocalEmbeddings()) |
| `embeddingProvider` | `string` | Where to generate embeddings. "local" runs embedding-gemma via node-llama-cpp — run installLocalEmbeddings() once to install the addon and download the model weights |
| `chunkStrategy` | `string` | How to split documents |
| `chunkSize` | `number` | Token limit per chunk for fixed strategy |
| `chunkOverlap` | `number` | Overlap ratio for fixed strategy |

## Methods

### initDb

**Returns:** `Promise<void>`



### insertDocument

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `doc` | `DocumentInput` | ✓ | Parameter doc |

`DocumentInput` properties:

| Property | Type | Description |
|----------|------|-------------|
| `pathId` | `string` |  |
| `model` | `string` |  |
| `title` | `string` |  |
| `slug` | `string` |  |
| `meta` | `Record<string, any>` |  |
| `content` | `string` |  |
| `sections` | `Array<{ heading: string; headingPath: string; content: string; level: number }>` |  |

**Returns:** `void`



### insertChunk

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `chunk` | `Chunk` | ✓ | Parameter chunk |

`Chunk` properties:

| Property | Type | Description |
|----------|------|-------------|
| `pathId` | `string` |  |
| `section` | `string` |  |
| `headingPath` | `string` |  |
| `seq` | `number` |  |
| `content` | `string` |  |
| `contentHash` | `string` |  |
| `embedding` | `Float32Array` | ✓ | Parameter embedding |

**Returns:** `void`



### removeDocument

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pathId` | `string` | ✓ | Parameter pathId |

**Returns:** `void`



### getStats

**Returns:** `IndexStatus`



### embed

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `texts` | `string[]` | ✓ | Parameter texts |

**Returns:** `Promise<number[][]>`



### ensureModel

**Returns:** `Promise<void>`



### disposeModel

**Returns:** `Promise<void>`



### getDimensions

**Returns:** `number`



### chunkDocument

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `doc` | `DocumentInput` | ✓ | Parameter doc |

`DocumentInput` properties:

| Property | Type | Description |
|----------|------|-------------|
| `pathId` | `string` |  |
| `model` | `string` |  |
| `title` | `string` |  |
| `slug` | `string` |  |
| `meta` | `Record<string, any>` |  |
| `content` | `string` |  |
| `sections` | `Array<{ heading: string; headingPath: string; content: string; level: number }>` |  |
| `strategy` | `'section' | 'fixed' | 'document'` |  | Parameter strategy |

**Returns:** `Chunk[]`



### search

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | Parameter query |
| `options` | `SearchOptions` |  | Parameter options |

`SearchOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `limit` | `number` |  |
| `model` | `string` |  |
| `where` | `Record<string, any>` |  |

**Returns:** `Promise<SearchResult[]>`



### vectorSearch

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | Parameter query |
| `options` | `SearchOptions` |  | Parameter options |

`SearchOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `limit` | `number` |  |
| `model` | `string` |  |
| `where` | `Record<string, any>` |  |

**Returns:** `Promise<SearchResult[]>`



### hybridSearch

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | Parameter query |
| `options` | `HybridSearchOptions` |  | Parameter options |

`HybridSearchOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `ftsWeight` | `number` |  |
| `vecWeight` | `number` |  |

**Returns:** `Promise<SearchResult[]>`



### deepSearch

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `_query` | `string` | ✓ | Parameter _query |
| `_options` | `SearchOptions` |  | Parameter _options |

`SearchOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `limit` | `number` |  |
| `model` | `string` |  |
| `where` | `Record<string, any>` |  |

**Returns:** `Promise<SearchResult[]>`



### indexDocuments

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `docs` | `DocumentInput[]` | ✓ | Parameter docs |

`DocumentInput[]` properties:

| Property | Type | Description |
|----------|------|-------------|
| `pathId` | `string` |  |
| `model` | `string` |  |
| `title` | `string` |  |
| `slug` | `string` |  |
| `meta` | `Record<string, any>` |  |
| `content` | `string` |  |
| `sections` | `Array<{ heading: string; headingPath: string; content: string; level: number }>` |  |

**Returns:** `Promise<void>`



### reindex

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pathIds` | `string[]` |  | Parameter pathIds |

**Returns:** `Promise<void>`



### removeStale

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `currentPathIds` | `string[]` | ✓ | Parameter currentPathIds |

**Returns:** `void`



### needsReindex

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `doc` | `DocumentInput` | ✓ | Parameter doc |

`DocumentInput` properties:

| Property | Type | Description |
|----------|------|-------------|
| `pathId` | `string` |  |
| `model` | `string` |  |
| `title` | `string` |  |
| `slug` | `string` |  |
| `meta` | `Record<string, any>` |  |
| `content` | `string` |  |
| `sections` | `Array<{ heading: string; headingPath: string; content: string; level: number }>` |  |

**Returns:** `boolean`



### status

**Returns:** `IndexStatus`



### downloadModelWeights

Download the .gguf weights for a supported local embedding model into ~/.cache/luca/models/. Skips the download when the weights already exist. Downloads to a temp file first, then renames atomically.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modelName` | `string` |  | Local model to fetch (default: the resolved embeddingModel) |

**Returns:** `Promise<string>`

```ts
const search = container.feature('semanticSearch', { embeddingProvider: 'local' })
await search.downloadModelWeights() // fetches embedding-gemma-300M-Q8_0 if missing
```



### installLocalEmbeddings

Install node-llama-cpp into the per-machine `~/.luca/node_modules` for local embedding support, then download the embedding model weights so local embeddings work turnkey. Runs once per machine, never touches the project. Same as `luca setup --local-embeddings`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `_cwd` | `string` |  | unused, accepted for backward compatibility (older versions installed into the project's node_modules) |

**Returns:** `Promise<void>`



### close

**Returns:** `Promise<void>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `embeddingModel` | `string` | The embedding model in effect, resolved per provider when no explicit embeddingModel option was given (openai → text-embedding-3-small, local → embedding-gemma-300M-Q8_0). |
| `db` | `Database` |  |
| `dimensions` | `number` |  |

## Events (Zod v4 schema)

### dbReady

When the SQLite database is initialized and ready



### modelLoaded

When the local embedding model is loaded into memory



### modelDisposed

When the local embedding model is disposed from memory



### indexed

When documents are indexed with embeddings

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `documents` | `number` | Number of documents indexed |
| `chunks` | `number` | Number of chunks created |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `indexed` | `number` | Count of indexed documents |
| `embedded` | `number` | Count of documents with embeddings |
| `lastIndexedAt` | `any` | ISO timestamp of last indexing |
| `dbReady` | `boolean` | Whether SQLite is initialized |

## Examples

**features.semanticSearch**

```ts
// Offline/local embeddings — one-time setup, then fully local
const search = container.feature('semanticSearch', {
 dbPath: '.contentbase/search.sqlite',
 embeddingProvider: 'local',
})
await search.installLocalEmbeddings(process.cwd()) // installs addon + downloads weights
await search.initDb()
await search.indexDocuments(docs)
const results = await search.hybridSearch('how does authentication work')
```



**downloadModelWeights**

```ts
const search = container.feature('semanticSearch', { embeddingProvider: 'local' })
await search.downloadModelWeights() // fetches embedding-gemma-300M-Q8_0 if missing
```

