# Needle (features.needle)

> Stability: `experimental`

Downloads and supervises local `needle` servers — Cactus Compute's tiny (35MB weights, <1MB engine, ~75MB resident) foundation model for tool calling, structured extraction, and routing. Apache-2.0, fully offline. Unlike a chat model, needle maps (query, tool list) → one JSON function call with a calibrated confidence. A server is bound to its tool set at startup, so this feature runs one detached server per tool set, on a port derived from the tool set's hash, shared by every luca process. Servers hold ~75MB and load in seconds; there is no idle watchdog — call `stopAll()` or `agent.stop()` when done. The engine binary and weights auto-download from Hugging Face on first use (~36MB total). **Gotcha:** needle always dispatches *some* call, even for off-topic queries ("tell me a joke" happily picks get_weather at 0.98 confidence). Include an explicit no-op/fallback tool in the set, or gate on `result.confidence`, when queries may fall outside the tool set.

## Usage

```ts
container.feature('needle', {
  // Hugging Face revision of Cactus-Compute/needle3 to install (pin a commit hash for reproducible installs)
  revision,
  // First port of the range needle servers are spawned on (one server per tool set)
  basePort,
  // How many ports starting at basePort a tool set may hash into
  portRange,
  // Ladder depth (2..full) — fewer layers trade accuracy for speed on constrained devices
  depth,
  // Worker threads for the inference engine (default: the device's fast cores, at most 4)
  threads,
  // Response token limit passed to the server (--max)
  maxTokens,
  // Max time to wait for a spawned server to answer HTTP (the model is tiny — loads in seconds)
  readyTimeoutMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `revision` | `string` | Hugging Face revision of Cactus-Compute/needle3 to install (pin a commit hash for reproducible installs) |
| `basePort` | `number` | First port of the range needle servers are spawned on (one server per tool set) |
| `portRange` | `number` | How many ports starting at basePort a tool set may hash into |
| `depth` | `number` | Ladder depth (2..full) — fewer layers trade accuracy for speed on constrained devices |
| `threads` | `number` | Worker threads for the inference engine (default: the device's fast cores, at most 4) |
| `maxTokens` | `number` | Response token limit passed to the server (--max) |
| `readyTimeoutMs` | `number` | Max time to wait for a spawned server to answer HTTP (the model is tiny — loads in seconds) |

## Methods

### downloadBinary

Download the platform engine binary from Hugging Face (~1MB). Skips when already installed. Emits downloadProgress events.

**Returns:** `Promise<string>`



### downloadWeights

Download the needle3.cact weights (~35MB) into the shared model cache. Skips when already present. Emits downloadProgress events.

**Returns:** `Promise<string>`



### install

Ensure both the engine binary and weights are installed, downloading whatever is missing (~36MB total, one time).

**Returns:** `Promise<{ binaryPath: string; weightsPath: string }>`



### agent

Get an agent for a tool set: ensures a detached needle server bound to these tools is healthy (spawning and auto-installing if needed) and returns a handle to it. Servers are shared across luca processes — a second call with the same tools reuses the running server.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tools` | `NeedleTool[]` | ✓ | The functions needle may call. `parameters` accepts a zod |

`NeedleTool[]` properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` |  |
| `description` | `string` |  |
| `parameters` | `object` |  |
| `opts` | `{ system?: string }` |  | Parameter opts |

`{ system?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `system` | `any` | Session facts like date, locale, or device |

**Returns:** `Promise<NeedleAgent>`

```ts
const agent = await container.feature('needle').agent([
 { name: 'set_timer', description: 'Set a countdown timer.',
   parameters: z.object({ minutes: z.number().describe('Timer length in minutes') }) },
])
const { function_calls, confidence } = await agent.complete('set a timer for 12 minutes')
```



### extract

Extract typed data from unstructured text: sugar over a single-tool agent whose parameters are your schema. Returns the extracted arguments (validated when the schema is zod) plus needle's confidence.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The unstructured input (an email, an invoice, a form blob) |
| `schema` | `object` | ✓ | A zod object schema or JSON Schema describing the fields to pull out |
| `opts` | `{ system?: string }` |  | Parameter opts |

**Returns:** `Promise<{ data: T; confidence: number; result: NeedleResult }>`

```ts
const { data, confidence } = await container.feature('needle').extract(
 'Invoice #4821 from Acme Corp, total $1,204.50 due March 3',
 z.object({
   invoiceNumber: z.string().describe('The invoice number'),
   vendor: z.string().describe('Who issued the invoice'),
   total: z.number().describe('Total amount due'),
 }),
)
```



### stopServer

Stop the needle server on a port via its pid file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `port` | `number` | ✓ | Parameter port |

**Returns:** `boolean`



### stopAll

Stop every needle server this machine has pid files for.

**Returns:** `number`



### status

Install/runtime status snapshot — what's downloaded and which servers are answering right now.

**Returns:** `Promise<{
		binaryInstalled: boolean
		binaryPath: string
		weightsInstalled: boolean
		weightsPath: string
		servers: Array<{ port: number; toolsHash: string; healthy: boolean }>
	}>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `installDir` | `string` | Directory the engine binary installs into. |
| `binaryPath` | `string` | Absolute path to the needle engine binary (whether or not installed yet). |
| `binaryInstalled` | `boolean` | Whether the engine binary is installed. |
| `weightsPath` | `string` | Absolute path where the needle3.cact weights live (whether or not downloaded yet). |
| `weightsInstalled` | `boolean` | Whether the model weights are downloaded. |
| `ready` | `boolean` | Whether needle is fully installed (engine binary + weights). |

## Events (Zod v4 schema)

### serverStopped

When a needle server process is stopped

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `port` | `number` | Port the stopped server was listening on |



### serverStarted

When a needle server process becomes healthy

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `port` | `number` | Port the server is listening on |
| `toolsHash` | `string` | Hash of the tool set this server was started with |



### downloadProgress

Progress events while downloading the engine binary or model weights

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `received` | `number` | Bytes received so far |
| `total` | `number` | Total bytes when known, else 0 |
| `target` | `string` | What is being downloaded (binary or weights) |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `runningPorts` | `array` | Ports this feature instance has confirmed a healthy needle server on |

## Examples

**features.needle**

```ts
const needle = container.feature('needle')
const agent = await needle.agent([
 { name: 'get_weather', description: 'Get the current weather for a city.',
   parameters: z.object({ city: z.string().describe('The city name') }) },
])
const result = await agent.complete("what's it like in Lagos right now?")
// result.function_calls => [{ name: 'get_weather', arguments: { city: 'Lagos' } }]
```



**agent**

```ts
const agent = await container.feature('needle').agent([
 { name: 'set_timer', description: 'Set a countdown timer.',
   parameters: z.object({ minutes: z.number().describe('Timer length in minutes') }) },
])
const { function_calls, confidence } = await agent.complete('set a timer for 12 minutes')
```



**extract**

```ts
const { data, confidence } = await container.feature('needle').extract(
 'Invoice #4821 from Acme Corp, total $1,204.50 due March 3',
 z.object({
   invoiceNumber: z.string().describe('The invoice number'),
   vendor: z.string().describe('Who issued the invoice'),
   total: z.number().describe('Total amount due'),
 }),
)
```

