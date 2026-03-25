# DocsReader (features.docsReader)

The DocsReader feature is an AI Assisted wrapper around a ContentDB feature. You can ask it questions about the content, and it will use the ContentDB to find the answers from the documents.

## Usage

```ts
container.feature('docsReader', {
  // Either the contentDb instance or the path to the contentDb you want to load
  contentDb,
  // The model to use for the conversation
  model,
  // Whether to use a local model for the conversation
  local,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `contentDb` | `any` | Either the contentDb instance or the path to the contentDb you want to load |
| `model` | `string` | The model to use for the conversation |
| `local` | `boolean` | Whether to use a local model for the conversation |

## Methods

### calculateCacheKeyForQuestion

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string` | ✓ | Parameter question |

**Returns:** `void`



### ask

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string` | ✓ | Parameter question |

**Returns:** `void`



### askCached

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string` | ✓ | Parameter question |

**Returns:** `void`



### start

Start the docs reader by loading the contentDb and wiring its tools into an assistant.

**Returns:** `Promise<DocsReader>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `isStarted` | `boolean` | Whether the docs reader has been started. |
| `answerCache` | `any` |  |
| `contentDb` | `ContentDb` |  |

## Events (Zod v4 schema)

### started

Event emitted by DocsReader



### loaded

Fired after the docs reader has been started



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `started` | `boolean` | Whether the docs reader has been started |