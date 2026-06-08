# Model Provider Abstraction Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Add a Hermes-inspired model provider abstraction to Luca so conversations can run against OpenAI-compatible APIs, Codex/ChatGPT auth, Anthropic, local endpoints, and interactive Claude Code sessions without hard-coding the OpenAI client into the conversation loop.

**Architecture:** Add a `modelProviders` feature that owns provider profiles, credential/session resolution, and transport selection. Add a new `conversationv2` feature beside the existing `conversation` feature; it should consume normalized model events from `modelProviders` instead of calling `container.client('openai')` directly. Existing `conversation` remains stable while v2 proves the provider-native architecture.

**Tech Stack:** Luca AGI features, Bun test runner, existing OpenAI client, existing `claudeCode` and `ClaudeSessionController` features, tmux-backed Claude Code interactive sessions, provider-specific transports.

---

## Research Summary

Hermes separates model execution into four concepts that map cleanly to Luca:

1. Provider profile / registry
   - provider id, label, auth type, base URL, env vars, default model, and `apiMode`
   - examples: `openai`, `anthropic`, `openai-codex`, `lmstudio`, external-process providers

2. Credential/session resolution
   - OpenAI-compatible providers resolve API key + base URL
   - Codex/ChatGPT providers resolve an existing auth store and refresh token when needed
   - external-process providers resolve a command/args pair rather than an API key
   - Luca should extend this with a `ClaudeSessionController` provider that advances a live interactive Claude Code tmux session

3. Transport layer
   - keyed by `apiMode`
   - converts Luca-normalized messages/tools into provider requests
   - converts provider output back into normalized Luca events/responses

4. Normalized response/event shape
   - text chunks
   - tool calls
   - usage
   - finish reason
   - provider metadata

Luca's existing `conversation` feature is OpenAI-shaped:

- message types come from OpenAI Chat Completions
- `openai` getter always calls `container.client('openai', ...)`
- responses mode calls `this.openai.raw.responses.create(...)`
- chat mode calls `this.openai.raw.chat.completions.create(...)`
- options expose `api: 'auto' | 'responses' | 'chat'`

This is fine for OpenAI-compatible APIs, but it is the wrong seam for Anthropic-native APIs, Codex auth reuse, and Claude Code interactive sessions.

---

## Important Existing Luca Class: `ClaudeSessionController`

A Luca per-session Claude Code controller already exists at:

- `src/agi/features/claude-session-controller.ts`
- tests: `test/claude-session-controller.test.ts`

It is a per-session controller class used under the hood, not the public provider API. It intentionally avoids `claude -p`. It launches plain interactive Claude Code in tmux, sends input through tmux, captures the terminal pane, detects prompts/choices, and reloads the matching Claude Code JSONL session history through the existing `claudeCode` feature.

Important API surface for the transport implementation:

```ts
const controller = new ClaudeSessionController({
  container,
  id: 'main',
  cwd: container.paths.cwd,
})
await controller.start()
const snapshot = await controller.ask('Inspect this repo')
if (snapshot.choices[0]) await controller.chooseOption(0)
const refreshed = await controller.refresh()
```

Snapshot shape includes:

```ts
interface ClaudeControllerSnapshot {
  id: string
  tmuxSession: string
  cwd: string
  sessionId?: string
  sessionFile?: string
  pane: string
  currentCommand: string
  awaitingInput: boolean
  choices: ClaudeControllerChoice[]
  history: any[]
  updatedAt: string
}
```

This changes the Claude Code provider design:

- Do not consider ACP for Claude Code in this design.
- Do not rely on `claude -p` because it has unwanted extra usage behavior.
- Add a provider transport that uses `ClaudeSessionController` as an interactive session backend.
- Use Claude Code session JSON data as the durable response source when possible.
- Use tmux pane capture as a fallback/visibility layer and for prompt/permission choices.

`ClaudeSessionController` is the only Claude Code provider path in scope for this plan.

---

## Proposed Public API

### `modelProviders` feature

```ts
const providers = container.feature('modelProviders')

const provider = await providers.resolve({
  provider: 'openai-codex',
  model: 'gpt-5',
})

const stream = provider.transport.stream({
  model: provider.model,
  messages,
  tools,
}, provider)
```

### User-friendly provider input

The top-level API should optimize for the common path: users should usually pass a string provider preset plus a model, and only drop to an object when they need a custom endpoint.

Provider input should accept these forms:

```ts
type ModelProviderInput =
  | string
  | ModelProviderProfile
  | {
      id?: string
      preset?: string
      baseURL: string
      model?: string
      apiKey?: string
      apiKeyEnv?: string
      headers?: Record<string, string>
      auth?: 'apiKey' | 'none'
      apiMode?: ModelProviderApiMode
    }
```

Rules:

- `provider: 'openai'` means OpenAI Responses API with `OPENAI_API_KEY`.
- `provider: 'openai-chat'` means OpenAI Chat Completions API with `OPENAI_API_KEY`.
- `provider: 'openai-compatible'` means caller must provide `baseURL`, unless config/env supplies it.
- `provider: 'lmstudio'` is just an OpenAI-compatible preset for `http://localhost:1234/v1` with no auth.
- `provider: 'ollama'` is just an OpenAI-compatible preset for `http://localhost:11434/v1` with no auth.
- `provider: 'custom'` or provider object means OpenAI-compatible by default unless `apiMode` is supplied.
- `provider: 'claude-code'` means interactive Claude Code. Internally the transport uses `ClaudeSessionController`; callers should not need to know that implementation detail.

### `conversationv2` feature

The easiest API should look like v1:

```ts
const conversation = container.feature('conversationv2', {
  provider: 'openai-codex',
  model: 'gpt-5',
})

await conversation.ask('hello')
```

Claude Code interactive provider:

```ts
const conversation = container.feature('conversationv2', {
  provider: 'claude-code',
  model: 'claude-code',
  providerOptions: {
    id: 'main',
    cwd: container.paths.cwd,
  },
})

await conversation.ask('Inspect this repo and summarize the test strategy')
```

Local presets:

```ts
await container.feature('conversationv2', {
  provider: 'lmstudio',
  model: 'qwen/qwen3-coder-30b',
}).ask('local LM Studio test')

await container.feature('conversationv2', {
  provider: 'ollama',
  model: 'llama3.2',
}).ask('local Ollama test')
```

Custom OpenAI-compatible endpoint, short form:

```ts
const conversation = container.feature('conversationv2', {
  provider: {
    baseURL: 'https://example.com/v1',
    apiKeyEnv: 'MY_PROVIDER_API_KEY',
  },
  model: 'some-model',
})
```

Custom OpenAI-compatible endpoint, no auth:

```ts
const conversation = container.feature('conversationv2', {
  provider: {
    baseURL: 'http://localhost:8000/v1',
    auth: 'none',
  },
  model: 'local-model',
})
```

### Assistant v2 flag

`Assistant` should keep the existing behavior by default and opt into `conversationv2` with one boolean flag:

```ts
const assistant = container.feature('assistant', {
  folder: 'assistants/reviewer',
  v2: true,
  provider: 'claude-code',
  model: 'claude-code',
})
```

Existing assistants remain v1:

```ts
const assistant = container.feature('assistant', {
  folder: 'assistants/reviewer',
  model: 'gpt-5.4',
})
```

For local/custom endpoints:

```ts
const assistant = container.feature('assistant', {
  folder: 'assistants/local-helper',
  v2: true,
  provider: 'ollama',
  model: 'llama3.2',
})

const assistant = container.feature('assistant', {
  folder: 'assistants/custom-helper',
  v2: true,
  provider: {
    baseURL: 'http://localhost:8000/v1',
    auth: 'none',
  },
  model: 'my-model',
})
```

Assistant should pass through the same common options to either backend:

- `model`
- `tools`
- `maxTokens`
- `temperature`
- `topP`
- `topK`
- `frequencyPenalty`
- `presencePenalty`
- `stop`
- `clientOptions` for v1 only
- `provider` / `providerOptions` for v2 only

Implementation shape inside `Assistant.conversation`:

```ts
const featureName = this.effectiveOptions.v2 ? 'conversationv2' : 'conversation'
conv = this.container.feature(featureName, {
  model: this.effectiveOptions.model || (this.effectiveOptions.v2 ? undefined : 'gpt-5.4'),
  tools: this.tools,
  history: [{ role: 'system', content: this.effectiveSystemPrompt }],
  ...(this.effectiveOptions.v2
    ? {
        provider: this.effectiveOptions.provider,
        providerOptions: this.effectiveOptions.providerOptions,
      }
    : {
        local: !!this.effectiveOptions.local,
        api: 'chat',
        clientOptions: this.effectiveOptions.clientOptions,
      }),
})
```

---
## Core Types

Create Luca-owned model types. Do not use OpenAI SDK types as the internal representation for v2.

```ts
type ModelProviderId =
  | 'openai'
  | 'openai-compatible'
  | 'openai-codex'
  | 'anthropic'
  | 'claude-code'
  | 'lmstudio'
  | 'ollama'
  | string

type ModelProviderApiMode =
  | 'openai-chat-completions'
  | 'openai-responses'
  | 'anthropic-messages'
  | 'claude-session'
  | string

interface ModelProviderProfile {
  id: string
  label?: string
  apiMode: ModelProviderApiMode
  auth: 'apiKey' | 'codex' | 'claudeSessionController' | 'none'
  baseURL?: string
  baseURLEnv?: string
  apiKeyEnv?: string
  defaultModel?: string
  models?: string[]
  headers?: Record<string, string>
  metadata?: Record<string, any>
}

interface ResolvedModelProvider {
  id: string
  profile: ModelProviderProfile
  apiMode: ModelProviderApiMode
  model: string
  baseURL?: string
  apiKey?: string
  headers?: Record<string, string>
  command?: string
  args?: string[]
  source?: string
  providerOptions?: Record<string, any>
  transport: ModelTransport
}

interface ModelTransport {
  apiMode: string
  stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelEvent>
  complete?(request: ModelRequest, provider: ResolvedModelProvider): Promise<ModelResponse>
}
```

Normalized request:

```ts
interface ModelRequest {
  model: string
  messages: ModelMessage[]
  tools?: ModelTool[]
  toolChoice?: 'auto' | 'none' | string
  maxTokens?: number
  temperature?: number
  topP?: number
  stop?: string | string[]
  responseFormat?: any
  signal?: AbortSignal
  metadata?: Record<string, any>
}
```

Normalized messages:

```ts
type ModelRole = 'system' | 'developer' | 'user' | 'assistant' | 'tool'

interface ModelMessage {
  role: ModelRole
  content?: string | ModelContentPart[]
  toolCalls?: ModelToolCall[]
  toolCallId?: string
  providerData?: Record<string, any>
}

type ModelContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string; detail?: 'auto' | 'low' | 'high' }
  | { type: 'audio'; data: string; format: string }
  | { type: 'file'; data: string; filename?: string }
```

Normalized events:

```ts
type ModelEvent =
  | { type: 'start'; provider: string; model: string }
  | { type: 'chunk'; text: string }
  | { type: 'toolCallDelta'; index: number; id?: string; name?: string; arguments?: string }
  | { type: 'toolCall'; toolCall: ModelToolCall }
  | { type: 'usage'; usage: ModelUsage }
  | { type: 'response'; response: ModelResponse }
  | { type: 'raw'; event: any }
  | { type: 'error'; error: Error }
```

Normalized response:

```ts
interface ModelResponse {
  id?: string
  content: string
  toolCalls: ModelToolCall[]
  usage?: ModelUsage
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter' | string
  providerData?: Record<string, any>
}

interface ModelToolCall {
  id: string
  name: string
  arguments: string | Record<string, any>
  providerData?: Record<string, any>
}

interface ModelUsage {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedTokens?: number
  reasoningTokens?: number
}
```

---

## Built-in Provider Profiles

Start with these profiles. `lmstudio` and `ollama` are not special backends; they are user-friendly presets over the generic OpenAI-compatible chat-completions transport.

```ts
const BUILTIN_PROVIDER_PROFILES: ModelProviderProfile[] = [
  {
    id: 'openai',
    apiMode: 'openai-responses',
    auth: 'apiKey',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5',
  },
  {
    id: 'openai-chat',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
    apiKeyEnv: 'OPENAI_API_KEY',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-5',
  },
  {
    id: 'openai-compatible',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
    defaultModel: 'local-model',
  },
  {
    id: 'lmstudio',
    apiMode: 'openai-chat-completions',
    auth: 'none',
    baseURL: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
  },
  {
    id: 'ollama',
    apiMode: 'openai-chat-completions',
    auth: 'none',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
  },
  {
    id: 'openai-codex',
    apiMode: 'openai-responses',
    auth: 'codex',
    defaultModel: 'gpt-5',
  },
  {
    id: 'anthropic',
    apiMode: 'anthropic-messages',
    auth: 'apiKey',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    baseURL: 'https://api.anthropic.com',
    defaultModel: 'claude-sonnet-4-5',
  },
  {
    id: 'claude-code',
    apiMode: 'claude-session',
    auth: 'claudeSessionController',
    defaultModel: 'claude-code',
  },
]
```

---

## Provider Resolution Rules

`modelProviders.resolve()` should use this precedence:

1. explicit options on the call
2. provider profile config
3. environment variables
4. built-in provider defaults
5. provider-specific credential/session resolver

For API-key providers:

```ts
apiKey =
  explicit.apiKey ??
  env[profile.apiKeyEnv] ??
  config.providers[id]?.apiKey
```

For base URL:

```ts
baseURL =
  explicit.baseURL ??
  env[profile.baseURLEnv] ??
  config.providers[id]?.baseURL ??
  profile.baseURL
```

For Codex:

```ts
const creds = await this.resolveCodexCredentials()
return {
  id: 'openai-codex',
  apiMode: 'openai-responses',
  baseURL: creds.baseURL,
  apiKey: creds.accessToken,
  source: creds.source,
}
```

For Claude Code session:

```ts
return {
  id: 'claude-code',
  apiMode: 'claude-session',
  model: options.model ?? 'claude-code',
  source: 'claude-code',
  providerOptions: {
    id: options.providerOptions?.id ?? 'main',
    cwd: options.providerOptions?.cwd ?? this.container.paths.cwd,
    reuse: options.providerOptions?.reuse ?? true,
  },
}
```


---

## Claude Code Session Transport Design

The public provider is `claude-code`; internally it should use a Claude session transport backed by `ClaudeSessionController`. This transport is deliberately different from HTTP transports.

Responsibilities:

1. Create/start a `new ClaudeSessionController({ container, ...providerOptions })` or equivalent factory once one exists.
2. Convert the current conversation request into one user prompt.
3. Send that prompt with `controller.ask(prompt, { wait: true })`.
4. Refresh the snapshot.
5. Derive the assistant response from session JSON history when possible.
6. Fall back to tmux pane parsing only when JSON history does not expose a clean assistant turn.
7. Emit normalized model events.

Initial implementation can be non-streaming internally but expose an async iterator that yields:

```ts
{ type: 'start', provider: 'claude-code', model }
{ type: 'chunk', text: assistantText }
{ type: 'response', response: { content: assistantText, toolCalls: [], providerData: { snapshot } } }
```

Later implementation can stream by polling `refresh()` and diffing the JSONL history or pane text.

Tool calling should initially be disabled or treated as provider-native Claude Code behavior, not Luca tool calls. Claude Code can use its own tools inside the interactive session. A future version can bridge Luca tools by detecting tool-use-like output, but do not force that in the first slice.

Important caveat:

Claude Code is an agent/session provider, not a pure completion API. It may mutate files, ask permission questions, run commands, and maintain its own session state. `conversationv2` should expose that in `providerData` and should not pretend it is a deterministic stateless chat model.

---

## ConversationV2 Loop Design

`conversationv2` should own history, events, tool execution, persistence, compacting, and user-facing API.

Provider transports should own provider quirks.

Generic loop:

```ts
while (true) {
  const stream = provider.transport.stream({
    model,
    messages,
    tools,
    maxTokens,
    temperature,
    topP,
    stop,
    signal,
  }, provider)

  for await (const event of stream) {
    if (event.type === 'chunk') emitChunk(event.text)
    if (event.type === 'toolCall') collectToolCall(event.toolCall)
    if (event.type === 'usage') applyUsage(event.usage)
    if (event.type === 'response') finalResponse = event.response
  }

  if (toolCalls.length === 0) {
    pushAssistantMessage(finalResponse.content)
    return finalResponse.content
  }

  pushAssistantMessageWithToolCalls(toolCalls)
  executeTools()
  pushToolResults()
}
```

Existing v1 loops that can be harvested:

- `runChatCompletionLoop()` in `src/agi/features/conversation.ts`
- `runResponsesLoop()` in `src/agi/features/conversation.ts`

The goal is to move provider-specific details into transports and leave `conversationv2` with one normalized loop.

---

## Implementation Tasks

### Task 1: Add shared model provider types

**Objective:** Create Luca-owned normalized provider, request, response, message, and event types.

**Files:**
- Create: `src/agi/lib/model-provider/types.ts`

**Steps:**
1. Add the core interfaces from the "Core Types" section.
2. Export all types from the file.
3. Run: `bun test test/claude-session-controller.test.ts`
4. Expected: existing tests still pass.

---

### Task 2: Create `modelProviders` feature skeleton

**Objective:** Add a feature that can register provider profiles and transports.

**Files:**
- Create: `src/agi/features/model-providers.ts`
- Modify: AGI container registration/import files as required by Luca feature registration conventions
- Test: `test/model-providers.test.ts`

**Test cases:**
- feature is registered in `AGIContainer`
- built-in profiles include `openai`, `lmstudio`, `openai-codex`, `anthropic`, and `claude-code`
- unknown provider throws a clear error

**Run:**

```sh
bun test test/model-providers.test.ts
```

---

### Task 3: Implement provider profile resolution

**Objective:** Resolve model, base URL, API key, and source for API-key and no-auth providers.

**Files:**
- Modify: `src/agi/features/model-providers.ts`
- Test: `test/model-providers.test.ts`

**Test cases:**
- `lmstudio` resolves with no API key and localhost base URL
- explicit base URL overrides built-in base URL
- explicit model overrides default model
- env API key is read for API-key providers
- secret values are never emitted in errors or snapshots

**Run:**

```sh
bun test test/model-providers.test.ts
```

---

### Task 4: Add fake transport support for tests

**Objective:** Prove the transport registry shape before implementing real providers.

**Files:**
- Modify: `src/agi/features/model-providers.ts`
- Test: `test/model-providers.test.ts`

**Test cases:**
- register a fake transport by `apiMode`
- resolve a fake provider using that transport
- stream emits normalized events

---

### Task 5: Add `conversationv2` skeleton with fake provider support

**Objective:** Add a provider-independent conversation feature that can call a fake transport.

**Files:**
- Create: `src/agi/features/conversation-v2.ts`
- Modify: AGI container registration/import files as required
- Test: `test/conversation-v2.test.ts`

**Test cases:**
- feature is registered in `AGIContainer`
- `ask()` pushes a user message
- fake transport chunk is emitted as `chunk`
- final response is pushed as assistant message

**Run:**

```sh
bun test test/conversation-v2.test.ts
```

---

### Task 6: Add OpenAI chat-completions transport

**Objective:** Port the existing OpenAI chat-completions request/stream normalization into a transport.

**Files:**
- Create: `src/agi/lib/model-provider/transports/openai-chat-completions.ts`
- Modify: `src/agi/features/model-providers.ts`
- Test: `test/model-provider-openai-chat.test.ts`

**Source to harvest:**
- `src/agi/features/conversation.ts`, especially `runChatCompletionLoop()`

**Test cases:**
- converts normalized messages to OpenAI chat messages
- converts normalized tools to OpenAI tools
- accumulates streamed tool call deltas
- maps usage into `ModelUsage`

---

### Task 7: Wire `conversationv2` to OpenAI chat transport

**Objective:** Make `conversationv2` work with `provider: 'openai-chat'`, `provider: 'openai-compatible'`, `provider: 'lmstudio'`, and `provider: 'ollama'`.

**Files:**
- Modify: `src/agi/features/conversation-v2.ts`
- Test: `test/conversation-v2.test.ts`

**Test cases:**
- fake OpenAI stream returns text
- fake OpenAI stream requests a tool call
- conversation executes tool and loops
- token usage is applied

---

### Task 8: Add OpenAI responses transport

**Objective:** Port existing Responses API support into a transport.

**Files:**
- Create: `src/agi/lib/model-provider/transports/openai-responses.ts`
- Modify: `src/agi/features/model-providers.ts`
- Test: `test/model-provider-openai-responses.test.ts`

**Source to harvest:**
- `src/agi/features/conversation.ts`, especially `runResponsesLoop()` and `messagesToResponsesInput()`

**Test cases:**
- converts normalized messages to Responses API input
- supports previous response id when available
- maps response output function calls to `ModelToolCall`
- maps usage fields into `ModelUsage`

---

### Task 9: Add `openai-codex` credential resolver

**Objective:** Allow Luca to reuse Codex/ChatGPT auth for an OpenAI Responses-compatible provider.

**Files:**
- Modify: `src/agi/features/model-providers.ts`
- Possibly create: `src/agi/lib/model-provider/auth/codex.ts`
- Test: `test/model-provider-codex.test.ts`

**Design notes:**
- Do not log token values.
- Return redacted/safe metadata only.
- Keep implementation narrow: resolve base URL and bearer token for transport use.
- If token refresh is non-trivial, first implementation may shell out to a known auth helper or clearly report missing auth support.

---

### Task 10: Add Claude Code session transport

**Objective:** Make `conversationv2` able to advance an interactive Claude Code session through the existing `ClaudeSessionController` class.

**Files:**
- Create: `src/agi/lib/model-provider/transports/claude-code-session.ts`
- Modify: `src/agi/features/model-providers.ts`
- Test: `test/model-provider-claude-code-session.test.ts`

**Test strategy:**
- Unit-test with a mocked/stubbed `ClaudeSessionController` instance.
- Do not require real tmux or real Claude Code in unit tests.

**Test cases:**
- starts or reuses a controller with provided `id` and `cwd`
- sends latest user prompt through `controller.ask()`
- reads assistant response from returned snapshot/session history
- emits normalized `start`, `chunk`, and `response` events
- includes snapshot/session metadata in `providerData`

**Initial behavior:**
- no Luca tool-call bridging
- Claude Code's own tools remain inside Claude Code
- permission choices are exposed through provider metadata; later work can add automatic policy hooks

---

### Task 11: Add Anthropic messages transport

**Objective:** Support native Anthropic Messages API without pretending it is OpenAI.

**Files:**
- Create: `src/agi/lib/model-provider/transports/anthropic-messages.ts`
- Modify: `src/agi/features/model-providers.ts`
- Test: `test/model-provider-anthropic.test.ts`

**Test cases:**
- converts normalized messages to Anthropic messages/system prompt
- converts normalized tools to Anthropic tools
- converts content blocks and `tool_use` blocks to normalized events
- maps usage and stop reasons

---

---

### Task 12: Add Assistant `v2` backend switch

**Objective:** Let existing Assistant users opt into `conversationv2` with `v2: true` while preserving the current `conversation` backend by default.

**Files:**
- Modify: `src/agi/features/assistant.ts`
- Test: `test/assistant-v2.test.ts`

**Option additions:**

```ts
v2: z.boolean().default(false).describe('Use conversationv2/modelProviders backend')
provider: z.any().optional().describe('conversationv2 provider preset or profile')
providerOptions: z.record(z.string(), z.any()).optional().describe('Provider-specific options for conversationv2')
```

**Test cases:**
- assistant without `v2` still creates `container.feature('conversation', ...)`
- assistant with `v2: true` creates `container.feature('conversationv2', ...)`
- v2 assistant passes `provider`, `providerOptions`, model, tools, sampling options, and system prompt history
- v1 assistant still passes `clientOptions`, `local`, and `api: 'chat'`
- `messages`, `ask()`, tool filters, and system prompt extension sync continue to work through the shared conversation-shaped interface

**Compatibility rule:**
`Assistant.conversation` can be typed as a shared minimal interface or `Conversation | ConversationV2`; do not require callers to care which backend is active.

---

## Registration Checklist

For each new feature, complete Luca's feature checklist:

1. Feature file exports the class and registers it.
2. Add side-effect import in the appropriate AGI container file.
3. Add type import + re-export.
4. Add feature type mapping/module augmentation.
5. Add tests under `test/*.test.ts`.

Run:

```sh
bun test test/model-providers.test.ts test/conversation-v2.test.ts test/assistant-v2.test.ts test/claude-session-controller.test.ts
```

Then run the broader unit suite:

```sh
bun test
```

---

## Non-goals For First Slice

- Do not rewrite existing `conversation` immediately.
- Do not force every provider through OpenAI SDK shapes.
- Do not bridge Luca tools into Claude Code session in the first slice.
- Do not require real Claude Code/tmux for unit tests.
- Do not expose raw API keys or tokens in state, errors, docs, or snapshots.
- Do not include ACP in this plan; Claude Code integration is through `ClaudeSessionController` under the hood only; public API remains `provider: 'claude-code'`.

---

## Main Design Principle

Make `modelProviders` answer:

- Who are we talking to?
- How do we authenticate or attach to a session?
- Which transport/protocol do we use?
- What default model/options apply?

Make transports answer:

- How do Luca messages/tools become provider requests?
- How does provider output become Luca events/tool calls/usage?

Make `conversationv2` answer:

- How do we maintain history?
- How do we stream text?
- How do we execute Luca tools when the provider supports normalized tool calls?
- How do we compact/save/fork/research/etc.?

This gives Luca Hermes-style provider flexibility while staying Luca-native and taking advantage of the new tmux/session-file based `ClaudeSessionController` feature.
