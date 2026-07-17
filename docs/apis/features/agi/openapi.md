# OpenAPI (features.openapi)

> Stability: `stable`

Load and inspect OpenAPI specs, convert endpoints to OpenAI tool/function definitions

## Usage

```ts
container.feature('openapi', {
  // URL to the OpenAPI/Swagger spec or the API server base URL
  url,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` | URL to the OpenAPI/Swagger spec or the API server base URL |

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



### toJSON

Return a compact JSON summary of all endpoints, useful for logging or REPL inspection.

**Returns:** `{ title: string, version: string, serverUrl: string, endpointCount: number, endpoints: object[]`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `serverUrl` | `string` | The base server URL derived from options, normalizing the openapi.json suffix |
| `specUrl` | `string` | The URL that will be fetched for the spec document |
| `spec` | `any` | The raw spec object. Null before load() is called. |
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

// Inspect all endpoints
api.endpoints

// Get a single endpoint by its friendly name
api.endpoint('getPetById')

// Convert to OpenAI tool definitions
api.toOpenAITools()

// Convert a single endpoint to a function definition
api.toFunction('getPetById')
```

