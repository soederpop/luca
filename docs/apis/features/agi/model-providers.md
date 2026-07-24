# ModelProviders (features.modelProviders)

> Stability: `core`

Resolve model provider profiles and route requests to provider transports.

## Usage

```ts
container.feature('modelProviders')
```

## Methods

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



### describe

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

## Examples

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

