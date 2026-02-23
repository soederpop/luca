# features.contentDb

Provides access to a Contentbase Collection for a folder of structured markdown files. Models are defined in the collection's models.ts file and auto-discovered on load. This feature is a thin wrapper that manages the collection lifecycle and provides convenience accessors for models and documents.

## Methods

### query

Query documents belonging to a specific model definition.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `model` | `T` | ✓ | The model definition to query against |

**Returns:** `void`

```ts
const contentDb = container.feature('contentDb', { rootPath: './docs' })
await contentDb.load()
const articles = await contentDb.query(contentDb.models.Article).fetchAll()
```



### parseMarkdownAtPath

Parse a markdown file at the given path without loading the full collection.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `path` | `string` | ✓ | Absolute or relative path to the markdown file |

**Returns:** `void`

```ts
const doc = contentDb.parseMarkdownAtPath('./docs/getting-started.md')
console.log(doc.frontmatter, doc.content)
```



### load

Load the collection, discovering models from models.ts and parsing all documents.

**Returns:** `Promise<ContentDb>`

```ts
const contentDb = container.feature('contentDb', { rootPath: './docs' })
await contentDb.load()
console.log(contentDb.isLoaded) // true
```



## Getters

| Property | Type | Description |

|----------|------|-------------|

| `isLoaded` | `any` | Whether the content database has been loaded. |

| `collection` | `any` | Returns the lazily-initialized Collection instance for the configured rootPath. |

| `collectionPath` | `any` | Returns the absolute resolved path to the collection root directory. |

| `models` | `Record<string, ModelDefinition>` | Returns an object mapping model names to their model definitions, sourced from the collection. |

| `modelNames` | `string[]` | Returns an array of all registered model names from the collection. |

## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `loaded` | `boolean` | Whether the content collection has been loaded and parsed |

| `tableOfContents` | `string` | Generated table of contents string for the collection |

| `modelSummary` | `string` | Summary of all discovered content models and their document counts |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `enable` | `boolean` | Whether to automatically enable the feature on creation |

| `rootPath` | `string` | Root directory path containing the structured markdown collection |

## Examples

**features.contentDb**

```ts
const contentDb = container.feature('contentDb', { rootPath: './docs' })
await contentDb.load()
console.log(contentDb.modelNames) // ['Article', 'Page', ...]
```



**query**

```ts
const contentDb = container.feature('contentDb', { rootPath: './docs' })
await contentDb.load()
const articles = await contentDb.query(contentDb.models.Article).fetchAll()
```



**parseMarkdownAtPath**

```ts
const doc = contentDb.parseMarkdownAtPath('./docs/getting-started.md')
console.log(doc.frontmatter, doc.content)
```



**load**

```ts
const contentDb = container.feature('contentDb', { rootPath: './docs' })
await contentDb.load()
console.log(contentDb.isLoaded) // true
```

