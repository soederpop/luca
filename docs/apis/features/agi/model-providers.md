# ModelProviders (features.modelProviders)

> Stability: `core`

Resolve model provider profiles and route requests to provider transports.

## Usage

```ts
container.feature('modelProviders', {
  // Read model-providers.yml / assistants/options.yml at construction (default true). Pass false for a hermetic instance that sees only the built-in profiles — tests must, or the developer's own machine config changes what they assert
  useConfigFiles,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `useConfigFiles` | `boolean` | Read model-providers.yml / assistants/options.yml at construction (default true). Pass false for a hermetic instance that sees only the built-in profiles — tests must, or the developer's own machine config changes what they assert |

## Methods

### loadConfigFiles

Read every config source and register the providers it declares. Runs once in the constructor; call it again to pick up edits in a long-running process. Missing files are skipped; a file that fails to parse is reported with `console.warn` and skipped so a typo can't break startup. `hosts:` maps from all sources are pooled before any entry is registered, so `~/.luca/model-providers.yml` can name the machines and `assistants/options.yml` can just say `mybox: chief/model`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sources` | `ModelProviderConfigSource[]` |  | Override the files to read. Defaults to `configSources`. |

`ModelProviderConfigSource[]` properties:

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Absolute path to the YAML file. Missing files are skipped silently. |
| `key` | `string` | Top-level key holding the providers map. When omitted the whole document is the map, unless it has a `providers:` key, which is then used instead. |

**Returns:** `string[]`

```ts
const ids = container.feature('modelProviders').loadConfigFiles()
```



### registerFromConfig

Register the entries of one `providers:` map (the YAML shape documented on the class) without touching the filesystem. Useful for tests and for plugins that keep provider config somewhere else.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `section` | `Record<string, any>` | ✓ | Map of provider id → shorthand string or profile object. |
| `options` | `{ hosts?: Record<string, string>; source?: string }` |  | Parameter options |

`{ hosts?: Record<string, string>; source?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `hosts` | `any` | Named base URLs; merged over the section's own `hosts:`. |
| `source` | `any` | Label used in warnings, typically the file path. |

**Returns:** `string[]`

```ts
mp.registerFromConfig({ hosts: { chief: 'http://chief:1234/v1' }, qwen36: 'chief', writer: 'chief/gemma4' })
```



### registerProfile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `profile` | `ModelProviderProfile` | ✓ | Parameter profile |

`ModelProviderProfile` properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` |  |
| `label` | `string` |  |
| `apiMode` | `ModelProviderApiMode` |  |
| `auth` | `ModelProviderAuth` |  |
| `baseURL` | `string` |  |
| `apiKey` | `string` |  |
| `apiKeyEnv` | `string` |  |
| `defaultModel` | `string` |  |
| `headers` | `Record<string, string>` |  |
| `providerOptions` | `Record<string, any>` |  |
| `capabilities` | `Record<string, any>` |  |

**Returns:** `void`



### registerLocal

Register a self-hosted, OpenAI-compatible endpoint with sensible defaults — the common case for local LLM servers (LM Studio, Ollama, vLLM, llama.cpp, a LAN GPU box). Defaults to the `openai-chat-completions` dialect and no auth, since most local servers ignore the API key. You just provide a `baseURL` and a default `model`. Pass `apiKey` or `apiKeyEnv` when a server does require a bearer token — `auth` flips to `'apiKey'` automatically. Override `apiMode`, `label`, or `headers` through the same options object for anything unusual.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | Parameter id |
| `baseURL` | `string` | ✓ | Parameter baseURL |
| `model` | `string` | ✓ | Parameter model |
| `options` | `LocalProviderOptions` |  | Parameter options |

`LocalProviderOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `label` | `string` | Human-friendly label. Defaults to the profile id. |
| `apiKey` | `string` | API key value. When set (or apiKeyEnv is), auth defaults to 'apiKey'. |
| `apiKeyEnv` | `string` | Env var name to read the API key from at resolve() time. |
| `headers` | `Record<string, string>` | Extra request headers to send to the endpoint. |
| `apiMode` | `ModelProviderApiMode` | Override the wire dialect. Defaults to 'openai-chat-completions'. |
| `auth` | `ModelProviderAuth` | Force auth mode. Defaults to 'apiKey' when a key is supplied, else 'none'. |

**Returns:** `void`

```ts
// In luca.cli.ts main(container), seed once at startup:
const mp = container.feature('modelProviders')
mp.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')
mp.registerLocal('dgx', 'http://192.168.1.50:8000/v1', 'llama-3.3-70b')
// Then an assistant's CORE.md frontmatter: `provider: chief`
```

```ts
// A server that does want a key, read from the environment:
mp.registerLocal('secure-box', 'http://10.0.0.5:8000/v1', 'mixtral', {
 apiKeyEnv: 'BOX_API_KEY',
})
```



### registerTransport

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `apiMode` | `ModelProviderApiMode` | ✓ | Parameter apiMode |
| `transport` | `ModelTransport` | ✓ | Parameter transport |

`ModelTransport` properties:

| Property | Type | Description |
|----------|------|-------------|
| `apiMode` | `ModelProviderApiMode` |  |

**Returns:** `void`



### hasProfile

Returns true when a provider profile with this id is registered.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | Parameter id |

**Returns:** `boolean`



### hasTransport

Returns true when a transport is registered for this API mode.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `apiMode` | `ModelProviderApiMode` | ✓ | Parameter apiMode |

**Returns:** `boolean`



### getTransport

The transport registered for this API mode, if any.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `apiMode` | `ModelProviderApiMode` | ✓ | Parameter apiMode |

**Returns:** `ModelTransport | undefined`



### get

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | Parameter id |

**Returns:** `ModelProviderProfile | undefined`



### list

**Returns:** `ModelProviderProfile[]`



### summary

REPL-friendly provider overview that never exposes raw API keys.

**Returns:** `ModelProviderSummary[]`



### describeProvider

Describe one provider or, when no id is supplied, all providers. This is intentionally concise and safe for REPL output.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` |  | Parameter id |

**Returns:** `ModelProviderSummary | ModelProviderSummary[]`



### setDefaultModel

Set a provider's default model.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `providerId` | `string` | ✓ | Parameter providerId |
| `model` | `string` | ✓ | Parameter model |

**Returns:** `void`



### setBaseURL

Set a provider's base URL.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `providerId` | `string` | ✓ | Parameter providerId |
| `baseURL` | `string` | ✓ | Parameter baseURL |

**Returns:** `void`



### removeProfile

Remove a registered provider profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | Parameter id |

**Returns:** `boolean`



### setDefault

Pin the default provider explicitly, overriding the automatic selection. Pass a registered profile id; clear with `setDefault(undefined)`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string | undefined` | ✓ | Parameter id |

**Returns:** `void`

```ts
container.feature('modelProviders').setDefault('anthropic')
```



### resolveDefaultId

The provider a blank assistant/conversation uses when no `provider` option is configured, or undefined when nothing usable is available. Selection order, designed around a brand-new user of the framework: 1. An explicit `setDefault(id)` or the LUCA_DEFAULT_PROVIDER env var 2. `openai` when OPENAI_API_KEY is set 3. `local` when the llama-server binary and a chat model are installed (`luca setup`) 4. `anthropic` when ANTHROPIC_API_KEY is set 5. The first user-registered custom profile whose auth is satisfied

**Returns:** `string | undefined`



### requireDefaultId

Like resolveDefaultId(), but throws an actionable error when no provider is available — a brand-new user with no API key and no local model gets told exactly how to fix it instead of a downstream auth failure.

**Returns:** `string`



### discover

Scan for live OpenAI-compatible LLM servers by probing `GET /v1/models` on well-known ports (LM Studio 1234, Ollama 11434, llama.cpp 8080, vLLM 8000, and friends — see KNOWN_LLM_PORTS). Probes localhost by default, plus any extra `hosts` you pass, plus every online tailscale peer when the `tailscale` CLI is installed and running. Everything fails gracefully: a host that isn't listening, times out, or answers with something that isn't a models list is simply omitted, and a missing tailscale is skipped silently — discover() never throws for an unreachable target. Results (including empty scans) are cached in state for the latest scan options for this feature instance. Repeat calls reuse them; pass `refresh: true` to rescan. Changed hosts, ports, timeout, tailscale settings, or probe function trigger a new scan. Concurrent identical scans are shared. Read discoveredServers, discoveredModels, hasDiscovered, and discoveredAt synchronously after awaiting discovery. Pass `register: true` to turn each hit into a provider profile (via registerLocal) so assistants can use it immediately; servers whose baseURL already matches a registered profile are reported with that profileId instead of creating a duplicate.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ModelProviderDiscoverOptions` |  | Parameter options |

`ModelProviderDiscoverOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `ports` | `number[]` | Ports to probe on every host. Defaults to KNOWN_LLM_PORTS. |
| `hosts` | `string[]` | Extra hosts to probe in addition to localhost (IPs or hostnames). |
| `localhost` | `boolean` | Probe localhost. Default true. |
| `tailscale` | `boolean` | Look for online tailscale peers and probe them too. Default true; silently skipped when tailscale isn't installed or running. |
| `timeoutMs` | `number` | Per-probe timeout in milliseconds. Default 1500. |
| `register` | `boolean` | Register each discovered server as a provider profile (via registerLocal) unless one with the same baseURL already exists. Default false. |
| `refresh` | `boolean` | Bypass cached results and scan again. Concurrent scans with the same options are shared. |
| `probe` | `(url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<any> }>` | Injectable fetch used for probes — for tests. Defaults to global fetch. |

**Returns:** `Promise<DiscoveredModelServer[]>`

```ts
// What's running on this machine?
const found = await container.feature('modelProviders').discover()
// [{ baseURL: 'http://127.0.0.1:1234/v1', hint: 'LM Studio', models: ['qwen2.5-32b'], ... }]
```

```ts
// Sweep the tailnet and register everything found as usable providers
const servers = await container.feature('modelProviders').discover({ register: true })
for (const s of servers) console.log(s.profileId, s.baseURL, s.models)
```



### suggestConfig

Shape discovery results as a config-file document — a `hosts:` map plus `id: host/model` shorthand entries — which is exactly the format `loadConfigFiles()` reads. The building block behind `luca setup --providers`. Host names are `local` for loopback servers and the tailscale hostname (or bare host) otherwise. Provider ids are `<host>-<port>`, matching what `discover({ register: true })` registers. Use the options to merge into an existing file without clobbering what's already declared there: - `hosts` — host names already present. A server whose baseURL is already named reuses that name; a name taken by a *different* URL gets the port appended so nothing is overwritten. - `existingProviderIds` — ids already present. A collision gets a `-2`, `-3`, … suffix instead of replacing the user's entry. - `models` — per-baseURL default model override, keyed by `server.baseURL`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `servers` | `DiscoveredModelServer[]` | ✓ | Parameter servers |

`DiscoveredModelServer[]` properties:

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | OpenAI-compatible base URL, e.g. http://127.0.0.1:1234/v1 |
| `host` | `string` | Host or IP the server was reached at. |
| `port` | `number` |  |
| `source` | `'localhost' | 'tailscale'` | Where the host came from: the local machine or a tailscale peer. |
| `hostname` | `string` | Tailscale node hostname, when the host is a tailscale peer. |
| `hint` | `string` | Best guess at which server usually listens on this port. |
| `models` | `string[]` | Model ids reported by GET /v1/models. |
| `latencyMs` | `number` | Round-trip time of the /v1/models probe. |
| `profileId` | `string` | Provider profile id serving this baseURL — an existing profile that matched, or the one created by `register: true`. |
| `options` | `{
      hosts?: Record<string, string>
      existingProviderIds?: string[]
      models?: Record<string, string>
    }` |  | Parameter options |

**Returns:** `ModelProviderConfigSuggestion`

```ts
const found = await container.feature('modelProviders').discover()
const config = container.feature('modelProviders').suggestConfig(found)
// { hosts: { local: 'http://127.0.0.1:1234/v1' }, providers: { 'local-1234': 'local/qwen3' } }
```



### resolve

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ModelProviderResolveOptions` |  | Parameter options |

`ModelProviderResolveOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `ModelProviderInput` |  |
| `model` | `string` |  |
| `providerOptions` | `Record<string, any>` |  |

**Returns:** `Promise<ResolvedModelProvider>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `discoveredServers` | `DiscoveredModelServer[]` | Servers from the last completed discovery, cloned for safe synchronous access. Empty before discovery. |
| `discoveredModels` | `string[]` | Unique model ids advertised by the last discovered servers. Empty before discovery. |
| `hasDiscovered` | `boolean` | Whether discovery has completed, including a scan that found no servers. |
| `discoveredAt` | `number | undefined` | Time of the last completed scan in milliseconds since epoch, or undefined before discovery. |
| `configSources` | `ModelProviderConfigSource[]` | Files consulted by `loadConfigFiles()`, in load order — a later file wins on the same provider id, so project config overrides machine config. 1. `<LUCA_HOME>/model-providers.yml` (default `~/.luca/model-providers.yml`) 2. `<cwd>/assistants/options.yml`, `providers:` section only |
| `configuredProviderIds` | `string[]` | Profile ids registered from YAML config files, in registration order. Empty when no file declared any. |
| `loadedConfigSources` | `string[]` | Config files that existed and parsed on the last `loadConfigFiles()`. |
| `available` | `string[]` | Provider profile ids available for `provider: "..."` lookups. |
| `profileIds` | `string[]` | Provider profile ids available for `provider: "..."` lookups. |
| `profiles` | `Record<string, ModelProviderProfile>` | Registered profiles keyed by provider id. Returned profiles are cloned. |
| `transportsAvailable` | `string[]` | API modes with registered transports. |
| `apiModes` | `string[]` | API modes referenced by profiles or directly registered as transports. |
| `defaults` | `Record<string, string | undefined>` | Default model by provider id. |
| `localChatReady` | `boolean` | Whether the local llama-server stack (binary + chat model weights) is installed on this machine. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `discoveredServers` | `array` | Servers from the most recently completed discovery |
| `discoveryKey` | `string` | Scan options identifying the cached discovery |
| `discoveredAt` | `number` | Time of the cached scan in milliseconds since epoch |
| `configuredProviderIds` | `array` | Profile ids registered from YAML config files, in registration order |
| `loadedConfigSources` | `array` | Config files that existed and were parsed on the last loadConfigFiles() |

## Examples

**features.modelProviders**

```ts
// Which config files were found, and what they registered:
const mp = container.feature('modelProviders')
mp.loadedConfigSources   // ['/Users/me/.luca/model-providers.yml']
mp.configuredProviderIds // ['qwen36', 'gemma4', 'deepseek-v4', 'secure-box', 'kokoro']
```

```ts
// Re-read the files after editing them in a long-running process:
container.feature('modelProviders').loadConfigFiles()
```



**loadConfigFiles**

```ts
const ids = container.feature('modelProviders').loadConfigFiles()
```



**registerFromConfig**

```ts
mp.registerFromConfig({ hosts: { chief: 'http://chief:1234/v1' }, qwen36: 'chief', writer: 'chief/gemma4' })
```



**registerLocal**

```ts
// In luca.cli.ts main(container), seed once at startup:
const mp = container.feature('modelProviders')
mp.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')
mp.registerLocal('dgx', 'http://192.168.1.50:8000/v1', 'llama-3.3-70b')
// Then an assistant's CORE.md frontmatter: `provider: chief`
```

```ts
// A server that does want a key, read from the environment:
mp.registerLocal('secure-box', 'http://10.0.0.5:8000/v1', 'mixtral', {
 apiKeyEnv: 'BOX_API_KEY',
})
```



**setDefault**

```ts
container.feature('modelProviders').setDefault('anthropic')
```



**discover**

```ts
// What's running on this machine?
const found = await container.feature('modelProviders').discover()
// [{ baseURL: 'http://127.0.0.1:1234/v1', hint: 'LM Studio', models: ['qwen2.5-32b'], ... }]
```

```ts
// Sweep the tailnet and register everything found as usable providers
const servers = await container.feature('modelProviders').discover({ register: true })
for (const s of servers) console.log(s.profileId, s.baseURL, s.models)
```



**suggestConfig**

```ts
const found = await container.feature('modelProviders').discover()
const config = container.feature('modelProviders').suggestConfig(found)
// { hosts: { local: 'http://127.0.0.1:1234/v1' }, providers: { 'local-1234': 'local/qwen3' } }
```

