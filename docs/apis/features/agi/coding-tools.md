# CodingTools (features.codingTools)

> Stability: `stable`

Shell primitives for AI coding assistants: rg, ls, cat, sed, awk. Wraps standard Unix tools into the assistant tool surface with LLM-optimized descriptions and system prompt guidance. These are the raw, flexible tools for reading, searching, and exploring code. Compose with other features (fileTools, processManager, skillsLibrary) in assistant hooks for a complete coding tool surface. Usage: ```typescript assistant.use(container.feature('codingTools')) ```

## Usage

```ts
container.feature('codingTools')
```

## Methods

### rg

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ args: string; cwd?: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### ls

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ args?: string; cwd?: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### cat

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ args: string; cwd?: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### sed

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ args: string; cwd?: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### awk

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ args: string; cwd?: string }` | ✓ | Parameter args |

**Returns:** `Promise<string>`



### setupToolsConsumer

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |