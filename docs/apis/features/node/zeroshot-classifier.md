# ZeroshotClassifier (features.zeroshotClassifier)

> Stability: `experimental`

Zero-shot text classifier backed by a local llama-server. Configure it with a system prompt and a set of options; run() returns a probability for every option in a single forward pass. How it works: the options are presented as a lettered list, a GBNF grammar forces the model to answer with exactly one letter token, and the logprobs of that single position are read as the probability distribution over all options — no sampling noise, no output parsing, one token generated. By default the classifier runs its own llama-server (port 8145, Qwen3-4B Instruct) so it never fights the default chat server over which model a port serves; weights download on first ensureReady(). Set baseURL/apiKey/ model to classify against any OpenAI-compatible endpoint instead (OpenAI, vLLM, LM Studio, ollama — anything that returns top_logprobs; the Anthropic API does not), or provider to resolve one from modelProviders profiles on an AGI container. Remote endpoints skip the GBNF grammar (a llama.cpp extension) and rely on the prompt — the probabilities are read from the letter entries of top_logprobs either way.

## Usage

```ts
container.feature('zeroshotClassifier', {
  // System prompt that frames the classification task
  systemPrompt,
  // The options to classify into (max 20). Strings or { label, description } objects
  availableOptions,
  // Model to classify with. Local mode: a CHAT_MODEL_SOURCES name or absolute GGUF path (default Qwen3-4B-Instruct-2507-Q4_K_M). Remote mode (baseURL set): the model name the endpoint expects — required
  model,
  // OpenAI-compatible /v1 base URL to classify against instead of a self-managed local llama-server (falls back to the LUCA_CLASSIFIER_BASE_URL env var). The endpoint must support top_logprobs — the Anthropic API does not
  baseURL,
  // API key for the remote baseURL (falls back to the LUCA_CLASSIFIER_API_KEY env var)
  apiKey,
  // A modelProviders profile id to resolve baseURL/apiKey/model from (AGI containers only). Ignored when baseURL is set
  provider,
  // Port the classifier llama-server listens on (separate from the default chat server so models never collide)
  port,
  // Context size (-c) passed to the classifier server
  contextSize,
  // Max time to wait for a spawned server to answer /health
  readyTimeoutMs,
  // Idle shutdown window for the classifier server (0 disables)
  idleTimeoutMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `systemPrompt` | `string` | System prompt that frames the classification task |
| `availableOptions` | `array` | The options to classify into (max 20). Strings or { label, description } objects |
| `model` | `string` | Model to classify with. Local mode: a CHAT_MODEL_SOURCES name or absolute GGUF path (default Qwen3-4B-Instruct-2507-Q4_K_M). Remote mode (baseURL set): the model name the endpoint expects — required |
| `baseURL` | `string` | OpenAI-compatible /v1 base URL to classify against instead of a self-managed local llama-server (falls back to the LUCA_CLASSIFIER_BASE_URL env var). The endpoint must support top_logprobs — the Anthropic API does not |
| `apiKey` | `string` | API key for the remote baseURL (falls back to the LUCA_CLASSIFIER_API_KEY env var) |
| `provider` | `string` | A modelProviders profile id to resolve baseURL/apiKey/model from (AGI containers only). Ignored when baseURL is set |
| `port` | `number` | Port the classifier llama-server listens on (separate from the default chat server so models never collide) |
| `contextSize` | `number` | Context size (-c) passed to the classifier server |
| `readyTimeoutMs` | `number` | Max time to wait for a spawned server to answer /health |
| `idleTimeoutMs` | `number` | Idle shutdown window for the classifier server (0 disables) |

## Methods

### ensureReady

Download the classifier model's weights if missing (delegates to the llamaServer feature's downloader) and ensure the server is healthy.

**Returns:** `Promise<string>`

```ts
await container.feature('zeroshotClassifier').ensureReady()
```



### run

Classify an input against the configured options.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `string` | ✓ | The text to classify |

**Returns:** `Promise<Record<string, number>>`

```ts
const probabilities = await classifier.run('this app crashes on launch')
// { refund_request: 0.04, bug_report: 0.95, other: 0.01 }
```



### classify

Classify an input and return the winning label alongside the full distribution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `string` | ✓ | The text to classify |

**Returns:** `Promise<ClassificationResult>`

```ts
const { label, probability } = await classifier.classify('where is my refund??')
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `availableOptions` | `Array<{ label: string; description?: string }>` | The configured options, normalized to { label, description? }. |
| `model` | `string` | The configured model: the explicit option, else the pinned local default. |
| `modelPath` | `string` | Absolute path of the classifier model's GGUF weights (local mode only). |
| `remoteBaseURL` | `string | undefined` | The remote base URL in effect, or undefined when running the local server. |
| `isRemote` | `boolean` | Whether classifications go to a remote endpoint instead of the self-managed local server. |
| `baseURL` | `string` | The OpenAI-compatible base URL of the classifier server. |

## Events (Zod v4 schema)

### classified

After every successful run()

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `input` | `string` | The classified input text |
| `probabilities` | `object` | Probability per option label, summing to 1 |
| `label` | `string` | The winning option label |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `serverRunning` | `boolean` | Whether the classifier server answered its last health probe |

## Examples

**features.zeroshotClassifier**

```ts
const classifier = container.feature('zeroshotClassifier', {
 systemPrompt: 'Classify the customer message.',
 availableOptions: [
   { label: 'refund_request', description: 'wants money back' },
   { label: 'bug_report', description: 'something is broken' },
   'other',
 ],
})
const probabilities = await classifier.run('my order arrived broken, please send my money back')
// { refund_request: 0.93, bug_report: 0.06, other: 0.01 }
```



**ensureReady**

```ts
await container.feature('zeroshotClassifier').ensureReady()
```



**run**

```ts
const probabilities = await classifier.run('this app crashes on launch')
// { refund_request: 0.04, bug_report: 0.95, other: 0.01 }
```



**classify**

```ts
const { label, probability } = await classifier.classify('where is my refund??')
```

