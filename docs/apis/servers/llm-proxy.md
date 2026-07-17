# LlmProxyServer (servers.llmProxy)

> Stability: `experimental`

Runs a [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start) in a docker container, exposing every configured backend — local GPU boxes running OpenAI-compatible servers, LM Studio, paid APIs like OpenAI and Anthropic — behind a single OpenAI-compatible endpoint on `http://localhost:<port>/v1`. `start()` generates a LiteLLM `config.yaml` from the `models` option into a tmp directory, injects API keys through a 0600 env file (keys are referenced in the config as `os.environ/...` and never written into it), and runs the LiteLLM image with the config volume-mounted and the port published. It then polls `/health/liveliness` until the proxy is up. `stop()` stops and removes the container and deletes the env file. **Host networking:** the proxy runs inside a container, so a backend on the host (e.g. LM Studio at `http://localhost:1234/v1`) is not reachable as `localhost`. Any localhost `apiBase` is rewritten automatically to the host gateway (`host.docker.internal` by default; override with `hostGatewayOverride`, e.g. `192.168.64.1` for Apple's container runtime). Requires the docker CLI. Restarting always removes any stale `luca-llm-proxy-<port>` container first, so the running config deterministically matches the options you passed.

## Usage

```ts
container.server('llmProxy', {
  // Port number to listen on
  port,
  // Hostname or IP address to bind to
  host,
  // LiteLLM docker image to run. Defaults to ghcr.io/berriai/litellm:main-stable
  image,
  // LiteLLM master key clients must present as a Bearer token. Injected via the env file as LITELLM_MASTER_KEY and referenced as os.environ/LITELLM_MASTER_KEY in the config — never written to disk in plaintext config
  masterKey,
  // The model routing table: each entry maps a client-facing model name to a backend (local OpenAI-compatible endpoint or paid API)
  models,
  // Passthrough for the litellm_settings section of the generated config (e.g. { drop_params: "true" })
  litellmSettings,
  // Override the container name. Defaults to luca-llm-proxy-<port>, which lets start() reclaim stale containers deterministically
  containerName,
  // Hostname/IP containers use to reach the host machine. Defaults to host.docker.internal (Docker Desktop). Set this when using a runtime with a different host gateway (e.g. 192.168.64.1 for Apple container)
  hostGatewayOverride,
  // How long start() waits for the proxy /health/liveliness endpoint before failing (default 60000)
  healthCheckTimeoutMs,
  // Directory the generated config.yaml and env file are written to. Defaults to <os.tmpdir>/luca-llm-proxy/<containerName>
  configDir,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Port number to listen on |
| `host` | `string` | Hostname or IP address to bind to |
| `image` | `string` | LiteLLM docker image to run. Defaults to ghcr.io/berriai/litellm:main-stable |
| `masterKey` | `string` | LiteLLM master key clients must present as a Bearer token. Injected via the env file as LITELLM_MASTER_KEY and referenced as os.environ/LITELLM_MASTER_KEY in the config — never written to disk in plaintext config |
| `models` | `array` | The model routing table: each entry maps a client-facing model name to a backend (local OpenAI-compatible endpoint or paid API) |
| `litellmSettings` | `object` | Passthrough for the litellm_settings section of the generated config (e.g. { drop_params: "true" }) |
| `containerName` | `string` | Override the container name. Defaults to luca-llm-proxy-<port>, which lets start() reclaim stale containers deterministically |
| `hostGatewayOverride` | `string` | Hostname/IP containers use to reach the host machine. Defaults to host.docker.internal (Docker Desktop). Set this when using a runtime with a different host gateway (e.g. 192.168.64.1 for Apple container) |
| `healthCheckTimeoutMs` | `number` | How long start() waits for the proxy /health/liveliness endpoint before failing (default 60000) |
| `configDir` | `string` | Directory the generated config.yaml and env file are written to. Defaults to <os.tmpdir>/luca-llm-proxy/<containerName> |

## Methods

### rewriteApiBase

Rewrite a localhost/127.0.0.1/0.0.0.0 apiBase to the host gateway, since inside the container localhost refers to the container itself, not the machine running backends like LM Studio.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `apiBase` | `string` | ✓ | Parameter apiBase |

**Returns:** `string`



### writeConfig

Generate the LiteLLM config.yaml and the 0600 env file holding the actual API key values. The config references keys as os.environ/LUCA_LLM_KEY_<n> so secrets never appear in the YAML.

**Returns:** `Promise<string>`



### checkHealth

Check the proxy's /health/liveliness endpoint.

**Returns:** `Promise<boolean>`



### start

Start the LiteLLM proxy container. Verifies a container runtime is available, reclaims any stale container with the same name, writes the config + env file, runs the image with the port published and config mounted, then polls /health/liveliness until healthy or `healthCheckTimeoutMs` elapses (failing with the container's recent log output embedded in the error).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `StartOptions` |  | Parameter options |

**Returns:** `Promise<this>`



### stop

Stop and remove the LiteLLM container and delete the env file holding injected secrets. Tolerates the container already being gone.

**Returns:** `Promise<this>`



### logs

Fetch logs from the LiteLLM container.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ follow?: boolean; tail?: number; since?: string; timestamps?: boolean }` |  | Passed through to docker getLogs (follow, tail, since, timestamps) |

**Returns:** `Promise<string>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `docker` | `any` | The docker feature used to run and manage the LiteLLM container. |
| `yaml` | `any` |  |
| `fs` | `any` |  |
| `os` | `any` |  |
| `baseURL` | `string` | The OpenAI-compatible base URL of the running proxy, e.g. http://localhost:4000 |
| `port` | `number` | The port the proxy publishes on the host. Defaults to 4000. |
| `image` | `string` | LiteLLM docker image, ghcr.io/berriai/litellm:main-stable by default. |
| `containerName` | `string` | Deterministic container name so restarts can reclaim stale containers. |
| `hostGateway` | `string` | Hostname containers use to reach the host machine. |
| `configDir` | `string` | Directory the generated config.yaml and env file live in. |
| `envFilePath` | `string` | Path of the env file holding the injected secrets. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | The port the server is bound to |
| `listening` | `boolean` | Whether the server is actively listening for connections |
| `configured` | `boolean` | Whether the server has been configured |
| `stopped` | `boolean` | Whether the server has been stopped |
| `containerId` | `string` | ID of the running LiteLLM container |
| `containerName` | `string` | Name of the LiteLLM container (deterministic, luca-llm-proxy-<port> by default) |
| `configPath` | `string` | Absolute path of the generated LiteLLM config.yaml |
| `healthy` | `boolean` | Whether the last health check against /health/liveliness passed |

## Examples

**servers.llmProxy**

```ts
// (no-run) requires docker and live backends
const proxy = container.server('llmProxy', {
 port: 4000,
 masterKey: 'sk-luca-dev',
 models: [
   // LM Studio on this machine — localhost is rewritten to the host gateway
   { modelName: 'local-qwen', provider: 'openai', model: 'qwen2.5-32b', apiBase: 'http://localhost:1234/v1', apiKey: 'lm-studio' },
   // A DGX box on the LAN serving an OpenAI-compatible endpoint
   { modelName: 'dgx-llama', provider: 'openai', model: 'llama-3.3-70b', apiBase: 'http://192.168.1.50:8000/v1', apiKey: 'none' },
   // A paid API
   { modelName: 'claude', provider: 'anthropic', model: 'claude-sonnet-5', apiKey: process.env.ANTHROPIC_API_KEY },
 ],
})
await proxy.start()

// one OpenAI-compatible endpoint for everything
const client = container.client('rest', { baseURL: proxy.baseURL })
const models = await client.get('/v1/models', { headers: { Authorization: 'Bearer sk-luca-dev' } })

await proxy.stop()
```

