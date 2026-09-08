# OpenAPI (features.openapi)

> Stability: `stable`

Load and inspect OpenAPI specs, convert endpoints to OpenAI tool/function definitions

## Usage

```ts
container.feature('openapi')
```

## Methods

### load

Fetches and parses the OpenAPI spec from the configured URL. Populates `endpoints`, updates state with spec metadata.

**Returns:** `Promise<this>`



### endpoint

Get a single endpoint by its friendly name or operationId.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The friendly name or operationId to look up |

**Returns:** `EndpointInfo | undefined`



### toOpenAITools

Convert all endpoints into OpenAI-compatible tool definitions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filter` | `(ep: EndpointInfo) => boolean` |  | Optional predicate to select which endpoints to include |

**Returns:** `OpenAIToolDef[]`



### toTool

Convert a single endpoint (by name) to an OpenAI-compatible tool definition.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The endpoint friendly name or operationId |

**Returns:** `OpenAIToolDef | undefined`



### toFunctions

Convert all endpoints into OpenAI-compatible function definitions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filter` | `(ep: EndpointInfo) => boolean` |  | Optional predicate to select which endpoints to include |

**Returns:** `OpenAIFunctionDef[]`



### toFunction

Convert a single endpoint (by name) to an OpenAI function definition.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The endpoint friendly name or operationId |

**Returns:** `OpenAIFunctionDef | undefined`



### call

Execute an endpoint against the live API. Splits the flat args object back into path, query, and header parameters (mirroring how `toOpenAITools` flattened them) and sends whatever remains as the JSON request body. Loads the spec first if it hasn't been loaded.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The endpoint friendly name or operationId |
| `args` | `Record<string, any>` |  | Flat argument object matching the tool schema |

**Returns:** `Promise<any>`

```ts
const pet = await api.call('getPetById', { petId: 42 })
```



### toTools

Expose every endpoint as an assistant tool, satisfying the standard `toTools()` contract so `assistant.use(container.feature('openapi', { url }))` just works. Each handler executes the live HTTP call via `call()`. If the spec hasn't loaded yet this returns no tools — `setupToolsConsumer` defers loading and registers the real tools before the assistant starts.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ only?: string[], except?: string[] }` |  | Parameter options |

**Returns:** `ReturnType<Helper['toTools']>`



### setupToolsConsumer

When an assistant consumes this feature before the spec is loaded, queue an async plugin that loads the spec and registers the real tools — assistants await these before starting. Once loaded, adds a system prompt extension describing the API.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



### toSystemPrompt

Build a system prompt brief for this API from the spec's info block: title, summary (OpenAPI 3.1), and description. This is what `assistant.use(api)` injects so the model knows what the API is, not just what its tools are.

**Returns:** `string`



### toJSON

Return a compact JSON summary of all endpoints, useful for logging or REPL inspection.

**Returns:** `{ title: string, version: string, serverUrl: string, endpointCount: number, endpoints: object[]`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `serverUrl` | `string` | The base server URL derived from options, normalizing the openapi.json suffix |
| `specUrl` | `string` | The URL that will be fetched for the spec document |
| `spec` | `any` | The raw spec object. Null before load() is called. |
| `info` | `{ title?: string; version?: string; description?: string; summary?: string }` | The spec's info block with any options.info overrides applied |
| `endpoints` | `EndpointInfo[]` | All parsed endpoints as an array |
| `endpointNames` | `string[]` | All endpoint friendly names |
| `endpointsByTag` | `Record<string, EndpointInfo[]>` | Map of endpoints grouped by tag |

## Events (Zod v4 schema)

### started

Event emitted by OpenAPI



### loaded

Fired after the spec is fetched and parsed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The parsed OpenAPI spec object |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `loaded` | `boolean` | Whether the OpenAPI spec has been fetched and parsed |
| `title` | `string` | The API title from the spec info block |
| `version` | `string` | The API version from the spec info block |
| `endpointCount` | `number` | Number of parsed endpoints in the spec |

## Examples

**features.openapi**

```ts
const api = container.feature('openapi', { url: 'https://petstore.swagger.io/v2' })
await api.load()

// Authenticated APIs: default headers ride on every request (spec fetch included),
// and beforeRequest can rewrite the url/init just before fetch executes
container.feature('openapi', {
 url: 'https://api.example.com',
 headers: { Authorization: `Bearer ${token}` },
 beforeRequest: ({ init }) => { (init.headers as any)['X-Trace-Id'] = crypto.randomUUID() },
})

// Inspect all endpoints
api.endpoints

// Get a single endpoint by its friendly name
api.endpoint('getPetById')

// Convert to OpenAI tool definitions
api.toOpenAITools()

// Convert a single endpoint to a function definition
api.toFunction('getPetById')

// Call an endpoint directly
await api.call('getPetById', { petId: 42 })

// Give an assistant the whole API as callable tools — the spec is loaded
// and the tools registered before the assistant starts
assistant.use(container.feature('openapi', { url: 'https://petstore.swagger.io/v2' }))
```



**call**

```ts
const pet = await api.call('getPetById', { petId: 42 })
```

