# LlamaServer (features.llamaServer)

> Stability: `experimental`

Downloads, supervises, and health-checks local `llama-server` processes — luca's local inference substrate. The llama.cpp server binary installs once per machine into `~/.luca/llama-cpp/<tag>/` and serves GGUF models over an OpenAI-compatible HTTP API on localhost. Chat and embedding models run as separate server processes on separate ports, spawned on demand and shared by every luca process on the machine. This is what backs the `local` model provider: a blank assistant with no provider configured and no OPENAI_API_KEY resolves to `local`, which calls `ensureChatServer()` here before the first request.

## Usage

```ts
container.feature('llamaServer', {
  // llama.cpp GitHub release tag to install (defaults to the pinned known-good build)
  releaseTag,
  // Local chat model name (defaults to the pinned default chat model)
  chatModel,
  // Port the chat inference server listens on
  chatPort,
  // Port the embedding server listens on
  embeddingPort,
  // Context size (-c) passed to the chat server
  contextSize,
  // Max time to wait for a spawned server to answer /health (model load can be slow)
  readyTimeoutMs,
  // Idle shutdown: a detached watchdog stops the server after this long with no requests, so it does not hog memory (default 15 minutes; 0 disables)
  idleTimeoutMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `releaseTag` | `string` | llama.cpp GitHub release tag to install (defaults to the pinned known-good build) |
| `chatModel` | `string` | Local chat model name (defaults to the pinned default chat model) |
| `chatPort` | `number` | Port the chat inference server listens on |
| `embeddingPort` | `number` | Port the embedding server listens on |
| `contextSize` | `number` | Context size (-c) passed to the chat server |
| `readyTimeoutMs` | `number` | Max time to wait for a spawned server to answer /health (model load can be slow) |
| `idleTimeoutMs` | `number` | Idle shutdown: a detached watchdog stops the server after this long with no requests, so it does not hog memory (default 15 minutes; 0 disables) |

## Methods

### downloadBinary

Download and extract the pinned llama.cpp release into ~/.luca/llama-cpp/<tag>/. Skips when the binary is already installed. Emits downloadProgress events.

**Returns:** `Promise<string>`

```ts
const path = await container.feature('llamaServer').downloadBinary()
```



### downloadChatModel

Download the configured chat model's GGUF weights into the shared model cache. Streams to a temp file and renames atomically; skips when already present. Emits downloadProgress events (these files are large — the default model is ~3.1GB).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modelName` | `string` |  | Chat model to fetch (default: the configured chatModel) |

**Returns:** `Promise<string>`

```ts
const llama = container.feature('llamaServer')
llama.on('downloadProgress', ({ received, total }) => console.log(received, '/', total))
await llama.downloadChatModel()
```



### ensureChatServer

Ensure a llama-server is healthy on the chat port, spawning one if needed. Reuses a server another luca process already started. Throws with setup guidance when the binary or model weights are missing.

**Returns:** `Promise<string>`



### ensureEmbeddingServer

Ensure a llama-server with --embedding is healthy on the embedding port, spawning one if needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modelPath` | `string` | ✓ | Absolute path to the embedding GGUF to serve |

**Returns:** `Promise<string>`



### stopServer

Stop the server on a port by pid file. No-op when no pid file exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `port` | `number` |  | Port of the server to stop (default: the chat port) |

**Returns:** `boolean`



### status

Install/runtime status snapshot — what's downloaded and what's answering health probes right now.

**Returns:** `Promise<{
		releaseTag: string
		binaryInstalled: boolean
		binaryPath: string | null
		chatModel: string
		chatModelInstalled: boolean
		chatModelPath: string
		chatServer: 'ok' | 'loading' | 'down'
		embeddingServer: 'ok' | 'loading' | 'down'
	}>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `releaseTag` | `string` | The llama.cpp release tag this instance installs and runs. |
| `chatModel` | `string` | The configured local chat model name. |
| `installDir` | `string` | Directory the release archive is extracted into (binary + its shared libraries). |
| `binaryPath` | `string | null` | Absolute path to the llama-server binary, or null when not installed. |
| `binaryInstalled` | `boolean` | Whether the llama-server binary is installed for the pinned release. |
| `chatModelPath` | `string` | Absolute path where the configured chat model's weights live (whether or not downloaded yet). |
| `chatModelInstalled` | `boolean` | Whether the configured chat model's weights are downloaded. |
| `chatReady` | `boolean` | Whether local chat inference is fully installed (binary + chat model weights). |
| `chatBaseURL` | `string` | The OpenAI-compatible base URL of the chat server. |
| `embeddingBaseURL` | `string` | The OpenAI-compatible base URL of the embedding server. |

## Events (Zod v4 schema)

### serverStopped

When a llama-server process is stopped via stopServer()

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `port` | `number` | Port the stopped server was listening on |



### serverStarted

When a llama-server process becomes healthy

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `port` | `number` | Port the server is listening on |
| `modelPath` | `string` | Absolute path of the GGUF the server loaded |
| `embedding` | `boolean` | Whether this is an embedding server |



### downloadProgress

Progress events while downloading the binary or model weights

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `received` | `number` | Bytes received so far |
| `total` | `number` | Total bytes when known, else 0 |
| `target` | `string` | What is being downloaded (binary or model name) |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `chatServerRunning` | `boolean` | Whether the chat server answered its last health probe |
| `embeddingServerRunning` | `boolean` | Whether the embedding server answered its last health probe |

## Examples

**features.llamaServer**

```ts
const llama = container.feature('llamaServer')
if (!llama.binaryInstalled) await llama.downloadBinary()
if (!llama.chatModelInstalled) await llama.downloadChatModel()
const baseURL = await llama.ensureChatServer() // http://127.0.0.1:8143/v1
```



**downloadBinary**

```ts
const path = await container.feature('llamaServer').downloadBinary()
```



**downloadChatModel**

```ts
const llama = container.feature('llamaServer')
llama.on('downloadProgress', ({ received, total }) => console.log(received, '/', total))
await llama.downloadChatModel()
```

