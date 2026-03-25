# FileTools (features.fileTools)

Curated file-system and code-search tools for AI assistants. Wraps the container's `fs` and `grep` features into a focused tool surface modeled on the tools that coding assistants (Claude Code, Cursor, etc.) rely on: read, write, edit, list, search, find, stat, mkdir, move, copy, delete. Usage: ```typescript const fileTools = container.feature('fileTools') assistant.use(fileTools) // or selectively: assistant.use(fileTools.toTools({ only: ['readFile', 'searchFiles', 'listDirectory'] })) ```

## Usage

```ts
container.feature('fileTools')
```

## Methods

### readFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ path: string; offset?: number; limit?: number }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### writeFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ path: string; content: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### editFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ path: string; oldString: string; newString: string; replaceAll?: boolean }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### listDirectory

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ path?: string; recursive?: boolean; include?: string; exclude?: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### searchFiles

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ pattern: string; path?: string; include?: string; exclude?: string; ignoreCase?: boolean; maxResults?: number }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### findFiles

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ pattern: string; path?: string; exclude?: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### fileInfo

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ path: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### createDirectory

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ path: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### moveFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ source: string; destination: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### copyFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ source: string; destination: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### deleteFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ path: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### setupToolsConsumer

When an assistant uses fileTools, inject system prompt guidance about how to use the tools effectively.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |