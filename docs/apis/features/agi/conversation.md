# Conversation (features.conversation)

> Stability: `stable`

A self-contained conversation with OpenAI that supports streaming, tool calling, and message state management.

## Usage

```ts
container.feature('conversation', {
  // A unique identifier for the conversation
  id,
  // A human-readable title for the conversation
  title,
  // A unique identifier for threads, an arbitrary grouping mechanism
  thread,
  // Any available OpenAI model
  model,
  // Initial message history to seed the conversation
  history,
  // Tools the model can call during conversation
  tools,
  // Remote MCP servers keyed by server label
  mcpServers,
  // Completion API mode. auto uses the Responses API; set to "chat" for OpenAI-compatible chat-completions endpoints (LM Studio, Ollama, vLLM, etc.)
  api,
  // Model provider preset id (e.g. 'codex', 'claude-code') or inline provider config. Omit for default OpenAI-compatible behavior
  provider,
  // Provider-specific transport options passed to the resolved provider
  providerOptions,
  // Maximum provider/tool turns for non-OpenAI providers (default 8)
  maxTurns,
  // Hard ceiling on native tool-calling turns per ask() (default 150). Hitting it fails the turn with ToolLoopLimitError
  maxToolTurns,
  // Tags for categorizing and searching this conversation
  tags,
  // Arbitrary metadata to attach to this conversation
  metadata,
  // Options for the OpenAI client (e.g. baseURL, apiKey). Point baseURL at any OpenAI-compatible server — local or remote — to override the default connection.
  clientOptions,
  // Maximum number of output tokens per completion (default 512)
  maxTokens,
  // Sampling temperature (0-2). Higher = more random, lower = more deterministic
  temperature,
  // Nucleus sampling cutoff (0-1). Lower = more focused
  topP,
  // Top-K sampling. Only supported by local/Anthropic models
  topK,
  // Frequency penalty (-2 to 2). Positive = discourage repetition
  frequencyPenalty,
  // Presence penalty (-2 to 2). Positive = encourage new topics
  presencePenalty,
  // Stop sequences — generation halts when any of these strings is produced
  stop,
  // Extra keys merged verbatim into the chat-completions request body (e.g. { chat_template_kwargs: { enable_thinking: false } } for llama-server/vLLM). Chat API only
  extraBody,
  // Enable automatic compaction when input tokens approach the context limit
  autoCompact,
  // Fraction of context window at which auto-compact triggers (default 0.8)
  compactThreshold,
  // Override the inferred context window size for this model
  contextWindow,
  // Number of recent messages to preserve after compaction (default 4)
  compactKeepRecent,
  // Maximum input tokens. Accepts a number or a named size: tiny (8k), small (16k), medium (32k), large (64k), xlarge (256k). Defaults to large (64k)
  maxInputTokens,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | A unique identifier for the conversation |
| `title` | `string` | A human-readable title for the conversation |
| `thread` | `string` | A unique identifier for threads, an arbitrary grouping mechanism |
| `model` | `string` | Any available OpenAI model |
| `history` | `array` | Initial message history to seed the conversation |
| `tools` | `object` | Tools the model can call during conversation |
| `mcpServers` | `object` | Remote MCP servers keyed by server label |
| `api` | `string` | Completion API mode. auto uses the Responses API; set to "chat" for OpenAI-compatible chat-completions endpoints (LM Studio, Ollama, vLLM, etc.) |
| `provider` | `any` | Model provider preset id (e.g. 'codex', 'claude-code') or inline provider config. Omit for default OpenAI-compatible behavior |
| `providerOptions` | `object` | Provider-specific transport options passed to the resolved provider |
| `maxTurns` | `number` | Maximum provider/tool turns for non-OpenAI providers (default 8) |
| `maxToolTurns` | `number` | Hard ceiling on native tool-calling turns per ask() (default 150). Hitting it fails the turn with ToolLoopLimitError |
| `tags` | `array` | Tags for categorizing and searching this conversation |
| `metadata` | `object` | Arbitrary metadata to attach to this conversation |
| `clientOptions` | `object` | Options for the OpenAI client (e.g. baseURL, apiKey). Point baseURL at any OpenAI-compatible server — local or remote — to override the default connection. |
| `maxTokens` | `number` | Maximum number of output tokens per completion (default 512) |
| `temperature` | `number` | Sampling temperature (0-2). Higher = more random, lower = more deterministic |
| `topP` | `number` | Nucleus sampling cutoff (0-1). Lower = more focused |
| `topK` | `number` | Top-K sampling. Only supported by local/Anthropic models |
| `frequencyPenalty` | `number` | Frequency penalty (-2 to 2). Positive = discourage repetition |
| `presencePenalty` | `number` | Presence penalty (-2 to 2). Positive = encourage new topics |
| `stop` | `array` | Stop sequences — generation halts when any of these strings is produced |
| `extraBody` | `object` | Extra keys merged verbatim into the chat-completions request body (e.g. { chat_template_kwargs: { enable_thinking: false } } for llama-server/vLLM). Chat API only |
| `autoCompact` | `boolean` | Enable automatic compaction when input tokens approach the context limit |
| `compactThreshold` | `number` | Fraction of context window at which auto-compact triggers (default 0.8) |
| `contextWindow` | `number` | Override the inferred context window size for this model |
| `compactKeepRecent` | `number` | Number of recent messages to preserve after compaction (default 4) |
| `maxInputTokens` | `any` | Maximum input tokens. Accepts a number or a named size: tiny (8k), small (16k), medium (32k), large (64k), xlarge (256k). Defaults to large (64k) |

## Methods

### addTool

Add or replace a single tool by name. Uses the same format as tools passed at construction time.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `tool` | `ConversationTool` | ✓ | Parameter tool |

`ConversationTool` properties:

| Property | Type | Description |
|----------|------|-------------|
| `handler` | `(...args: any[]) => Promise<any>` |  |
| `description` | `string` |  |
| `parameters` | `Record<string, any>` |  |

**Returns:** `this`



### removeTool

Remove a tool by name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `this`



### updateTools

Merge new tools into the conversation, replacing any with the same name. Accepts the same Record<string, ConversationTool> format used at construction time.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tools` | `Record<string, ConversationTool>` | ✓ | Parameter tools |

**Returns:** `this`



### stub

Register a hardcoded stub response that bypasses the API when the user's message matches. Streaming is still simulated — chunk/preview events fire word-by-word.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `matcher` | `string | RegExp` | ✓ | Exact string match, substring, or RegExp tested against user input |
| `response` | `string | (() => string)` | ✓ | The text to stream back, or a zero-arg function that returns it |

**Returns:** `this`

```ts
conversation.stub('hello', 'Hi there!')
conversation.stub(/weather/i, () => 'Sunny and 72°F.')
```



### fork

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `overrides` | `ForkOptions | ForkOptions[]` |  | Parameter overrides |

**Returns:** `Conversation | Conversation[]`



### research

Fan out N questions in parallel using forked conversations, return the results. Each fork is independent and ephemeral — no history is saved.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `questions` | `(string | { question: string; forkOptions?: ForkOptions })[]` | ✓ | Array of questions (strings) or objects with question + per-fork overrides |
| `defaults` | `ForkOptions` |  | Default fork options applied to all forks (individual overrides take precedence) |

**Returns:** `Promise<string[]>`

```ts
const results = await conversation.research([
 "What are the pros of approach A?",
 "What are the pros of approach B?",
], { history: 'none', model: 'gpt-4o-mini' })

// Per-fork overrides
const results = await conversation.research([
 "Quick factual question",
 { question: "Needs recent context", forkOptions: { history: 5 } },
], { history: 'none' })
```



### setModel

Switch the model for every subsequent turn. Safe to call mid-conversation — history is kept, and the next `ask()` uses the new model. Any provider-side continuation handle (an OpenAI Responses `previous_response_id`, a codex/claude-session id) is dropped, because it encodes the *old* routing. The full message history lives locally, so the next turn simply re-sends it.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | `string` | ✓ | The model name to use from here on |

**Returns:** `this`

```ts
conversation.setModel('gpt-5.4')
await conversation.ask('now try that again with more care')
```



### setProvider

Switch the backend for every subsequent turn. Safe to call mid-conversation: history is kept, tools stay registered, and the next `ask()` is routed through the new provider — including a switch between the native OpenAI loops and the generic transport loop (codex, claude-code). An unregistered provider id throws here rather than at the next `ask()`, and the previous routing is left intact when it does. With no explicit `model`, the new provider's own default model takes over — a model name from the old provider is rarely valid on the new one.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `provider` | `string | Record<string, any> | null` | ✓ | A registered provider id, an inline provider config, or null to fall back to the container default |
| `options` | `SetProviderOptions` |  | Optional `model` and `providerOptions` to apply along with the switch |

`SetProviderOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Model to use on the new provider. Omit to let the provider's own default model take over. |
| `providerOptions` | `Record<string, any>` | Provider-specific transport options, replacing any currently configured. |

**Returns:** `this`

```ts
conversation.setProvider('claude-code', { model: 'sonnet' })
conversation.setProvider(null) // back to the container's default provider
```



### abort

Abort the current ask() call. Cancels the in-flight network request and any pending tool executions. The ask() promise will reject with a ConversationAbortError whose `partial` property contains any text accumulated before the abort.

**Returns:** `void`



### estimateTokens

Estimate the input token count for the current messages array using the js-tiktoken tokenizer. Updates state.

**Returns:** `number`



### summarize

Generate a summary of the conversation so far using the LLM. Read-only — does not modify messages.

**Returns:** `Promise<string>`



### compact

Compact the conversation by summarizing old messages and replacing them with a summary message. Keeps the system message (if any) and the most recent N messages.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ keepRecent?: number }` |  | Parameter options |

**Returns:** `Promise<{ summary: string; removedCount: number; estimatedTokens: number }>`



### clearMessages

Wipe the transcript without changing the conversation's identity — "start this discussion over". The leading system/developer messages are kept by default because they are the assistant's identity, not transcript. Always invalidates provider continuation handles: a cleared conversation that still sent `previous_response_id` would silently resume the transcript the caller just deleted. Prefer this to mutating `conversation.messages` — that array is a live projection, and splicing it leaves the continuation handles pointing at history that is gone.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClearMessagesOptions` |  | `keepSystemPrompt` (default true) keeps the leading system/developer messages |

`ClearMessagesOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `keepSystemPrompt` | `boolean` | Keep the leading system/developer messages — the assistant's identity, not its transcript. Defaults to true. Pass false to empty the list. |

**Returns:** `MessageEdit`

```ts
const edit = conversation.clearMessages()
// => { changed: 6, messageCount: 1, continuationInvalidated: true, version: 8 }
```



### replaceMessage

Rewrite one message that is already in the history — the supported way to redact it. Use it to strip attachment pixels, secrets, or anything else that was fine to send to the model but must not stay in the transcript. The replacement is deep-copied into a new array, so forks and saved snapshots taken before the call keep the original message. Continuation handles are dropped only when the rewritten message is inside the prefix the provider has already seen. Editing a message the provider has never been shown leaves a live chain intact.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | `MessageSelector` | ✓ | Index of the message (negative counts from the end) or a predicate |
| `replacement` | `Message | ((message: Message, index: number) => Message)` | ✓ | The new message, or a function receiving the current one |

**Returns:** `MessageEdit`

```ts
// Redact the pixels from the most recent user message, keep its text
conversation.replaceMessage(
 message => message.role === 'user',
 message => ({ ...message, content: textPartsOf(message) }),
)
```



### ask

Send a message and get a streamed response. Automatically handles tool calls by invoking the registered handlers and feeding results back to the model until a final text response is produced.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `string | ContentPart[]` | ✓ | The user message, either a string or array of content parts (text + images) |
| `options` | `AskOptions` |  | Parameter options |

`AskOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `maxTokens` | `number` |  |
| `instructions` | `string` | Additional instructions for this call only. They are sent to the model without being appended to the persisted conversation history. |
| `schema` | `z.ZodType` | When provided, enables OpenAI Structured Outputs. The model is constrained to return JSON matching this Zod schema. The return value of ask() will be the parsed object instead of a raw string. |

**Returns:** `Promise<string>`

```ts
const reply = await conversation.ask("What's the weather in SF?")
// With image:
const reply = await conversation.ask([
 { type: 'text', text: 'What is in this diagram?' },
 { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
])
```



### retryFailedTurn

Retry the turn recorded in `state.failedTurn`. The surviving user message is re-run against the provider without being duplicated in history, and the failed turn's partial output — already rolled back when the failure was recorded — is never replayed as context. Queued behind any in-flight ask() like every turn. On success the failed record clears; another failure records a fresh one (new id, same input).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `AskOptions & { expectId?: string }` |  | AskOptions plus `expectId`: when set, the retry only runs |

**Returns:** `Promise<string>`

```ts
try { await conversation.ask('do the thing') }
catch { await conversation.retryFailedTurn() }
```



### save

Persist this conversation to disk via conversationHistory. Creates a new record if this conversation hasn't been saved before, or updates the existing one.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }` |  | Optional overrides for title, tags, thread, or metadata |

**Returns:** `void`



### serializeToolResult

Serialize a tool handler's return value for the tool-role message, extracting any images it carries so they reach the model as real image input. The convention: a tool that wants the model to SEE something returns an object with an `images` array of strings — file paths, data: URLs, or http(s) URLs: ```ts // in an assistant tool handler const shot = await container.feature('screenCapture').captureScreen() return { path: shot, images: [shot] } ``` Tool-role messages are text-only in the chat-completions wire format, so the images can't ride in the tool message itself. They're queued and injected as a user message (image_url parts) right after this turn's tool results, before the model's next turn, labeled with the tool's name. When `imageDelegate` is set (the Assistant's visionSupport), the parts pass through it first so text-only models get descriptions instead. File paths are inlined as base64 data URLs (png/jpg/gif/webp by extension). A path that can't be read is skipped, with the failure noted in the serialized result so the model knows the image is missing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolName` | `string` | ✓ | The tool whose output is being serialized |
| `output` | `any` | ✓ | The raw return value from the tool handler |

**Returns:** `string`



### pushMessage

Append a message to the conversation state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `Message` | ✓ | The message to append |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `tools` | `Record<string, ConversationTool>` | Returns the registered tools available for the model to call. |
| `availableTools` | `any` |  |
| `mcpServers` | `Record<string, ConversationMCPServer>` | Returns configured remote MCP servers keyed by server label. |
| `messages` | `Message[]` | Returns the full message history of the conversation. |
| `model` | `string` | Returns the OpenAI model name being used for completions. |
| `routing` | `ConversationRouting` | Where the next turn will go: the provider, the model, the OpenAI dialect, and which turn loop runs. Everything here is derived live, so it reflects any mid-conversation `setModel()` / `setProvider()` call. |
| `apiMode` | `'responses' | 'chat'` | Returns the active completion API mode after resolving auto behavior. |
| `isStreaming` | `boolean` | Whether a streaming response is currently in progress. |
| `contextWindow` | `number` | The context window size for the current model (from options override or auto-detected). |
| `isNearContextLimit` | `boolean` | Whether the conversation is approaching the context limit. |
| `maxToolTurns` | `number` | The native tool-loop ceiling. Default 150: measured across 358 real tool-using turns, p99 depth was 24 and the deepest legitimate run (a researcher deep-dive) reached 50. The original 75 ceiling was doubled so long agentic sessions never trip it, while a genuine runaway still stops within one conversation. |
| `openai` | `any` | Returns the OpenAI client instance from the container. |
| `history` | `ConversationHistory` | Returns the conversationHistory feature for persistence. |

## Events (Zod v4 schema)

### routingChanged

Fired when setModel() or setProvider() changes which backend or model the next turn uses

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `previous` | `any` | The routing in effect before the change |
| `current` | `any` | The routing the next turn will use |



### summarizeStart

Fired before generating a conversation summary



### summarizeEnd

Fired after the summary is generated

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The generated summary text |



### compactStart

Fired before compacting the conversation history

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `messageCount` | `number` |  |
| `keepRecent` | `number` |  |



### compactEnd

Fired after compaction completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `summary` | `string` |  |
| `removedCount` | `number` |  |
| `estimatedTokens` | `number` |  |
| `compactionCount` | `number` |  |



### messagesCleared

Fired after clearMessages() rewrites the message list

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `changed` | `number` | How many messages were removed |
| `messageCount` | `number` | Messages remaining after the clear |
| `continuationInvalidated` | `boolean` | Whether a provider continuation handle was dropped |
| `version` | `number` | messagesVersion after the clear |



### messageReplaced

Fired after replaceMessage() rewrites one message

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `index` | `number` | Index of the replaced message, or -1 when nothing matched |
| `changed` | `number` | 1 when a message was rewritten, 0 when the selector matched nothing |
| `messageCount` | `number` | Messages in the conversation after the replacement |
| `continuationInvalidated` | `boolean` | Whether a provider continuation handle was dropped |
| `version` | `number` | messagesVersion after the replacement |



### autoCompactTriggered

Fired when auto-compact kicks in because tokens exceeded the threshold

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `estimated` | `number` |  |
| `limit` | `number` |  |
| `contextWindow` | `number` |  |



### userMessage

Fired when a user message is added to the conversation

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The user message content (string or ContentPart[]) |



### aborted

Fired when the conversation is aborted mid-response

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Partial text accumulated before the abort |



### turnFailed

Fired when a turn fails: partial output has been rolled back, the input survives, and the record is retryable via retryFailedTurn()

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Retry identity for the failure |
| `userMessageIndex` | `number` | Index of the surviving user message |
| `error` | `object` | What went wrong |
| `at` | `string` | ISO timestamp of the failure |
| `retryable` | `boolean` |  |



### turnStart

Fired at the start of each completion turn

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `turn` | `number` |  |
| `isFollowUp` | `boolean` |  |



### chunk

Fired for each streaming text delta

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Text delta from the stream |



### preview

Fired after each chunk with the full accumulated text

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Accumulated text so far |



### reasoning

Fired for each reasoning delta a thinking model streams before its answer. Never part of the response text or message history. What arrives is provider-shaped: local models stream raw thinking (reasoning_content or inline <think> tags), the OpenAI Responses API streams reasoning summaries only

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Reasoning/thinking text delta from the stream |



### rawEvent

Fired for every raw event from the Responses API stream

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Raw stream event from the API |



### turnEnd

Fired at the end of each completion turn

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `turn` | `number` |  |
| `hasToolCalls` | `boolean` |  |



### toolCallsStart

Fired when the model begins a batch of tool calls

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Array of tool call objects from the model |



### toolCallsEnd

Fired after all tool calls in a turn have been executed



### response

Fired when the final text response is produced

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Final accumulated response text |



### toolImages

Fired when a tool result carries images that will be injected as a user message before the next model turn

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `number` | Number of image parts queued |



### toolError

Fired when a tool handler throws or the tool is unknown

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Error object or message |



### toolCall

Fired before invoking a single tool handler

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Parsed arguments object |



### toolResult

Fired after a tool handler returns successfully

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `string` | Serialized result |



### mcpEvent

Fired for MCP-related events from the Responses API

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | MCP-related stream event |



### responseCompleted

Fired when the Responses API stream completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The completed OpenAI Response object |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `id` | `string` | Unique identifier for this conversation instance |
| `thread` | `string` | Thread identifier for grouping conversations |
| `model` | `string` | The OpenAI model being used |
| `messages` | `array` | Full message history of the conversation |
| `streaming` | `boolean` | Whether a streaming response is currently in progress |
| `lastResponse` | `string` | The last assistant response text |
| `toolCalls` | `number` | Total number of tool calls made in this conversation |
| `api` | `string` | Which completion API is active for this conversation |
| `lastResponseId` | `any` | Most recent OpenAI Responses API response ID for continuing conversation state |
| `lastResponseMessageCount` | `any` | Local message count represented by lastResponseId, used to detect stale continuation chains |
| `lastProviderData` | `any` | Provider-specific continuation data from the most recent response (e.g. codex/claude-session ids for resume) |
| `tokenUsage` | `object` | Cumulative token usage statistics including detail breakdowns from the API |
| `cost` | `object` | Running cost estimate based on cumulative token usage and model pricing |
| `estimatedInputTokens` | `number` | Estimated input token count for the current messages array |
| `compactionCount` | `number` | Number of times compact() has been called |
| `contextWindow` | `number` | The context window size for the current model |
| `tools` | `object` | Active tools map including any runtime overrides |
| `callMaxTokens` | `any` | Per-call max tokens override, cleared after each ask() |
| `messagesVersion` | `number` | Increments on every change to the message list — lets observers detect out-of-band edits (clear, replace, compact) without diffing the array |
| `failedTurn` | `any` | The most recent failed turn: its retry identity, the surviving input, and the error. Null when the last turn succeeded. The failed turn's input stays in history; its partial output is rolled back and never replayed as context |
| `temperature` | `any` | Sampling temperature (0-2). Null means use model default |
| `topP` | `any` | Nucleus sampling cutoff (0-1). Null means use model default |
| `topK` | `any` | Top-K sampling. Null means use model default |
| `frequencyPenalty` | `any` | Frequency penalty (-2 to 2). Null means use model default |
| `presencePenalty` | `any` | Presence penalty (-2 to 2). Null means use model default |
| `stop` | `any` | Stop sequences. Null means none |
| `maxTokens` | `any` | Maximum output tokens per completion. Null means use model default |
| `extraBody` | `any` | Extra keys merged verbatim into the chat-completions request body (e.g. chat_template_kwargs). Null means none |

## Examples

**features.conversation**

```ts
const conversation = container.feature('conversation', {
 model: 'gpt-4.1',
 tools: myToolMap,
 history: [{ role: 'system', content: 'You are a helpful assistant.' }]
})
const reply = await conversation.ask('What is the meaning of life?')
```



**stub**

```ts
conversation.stub('hello', 'Hi there!')
conversation.stub(/weather/i, () => 'Sunny and 72°F.')
```



**research**

```ts
const results = await conversation.research([
 "What are the pros of approach A?",
 "What are the pros of approach B?",
], { history: 'none', model: 'gpt-4o-mini' })

// Per-fork overrides
const results = await conversation.research([
 "Quick factual question",
 { question: "Needs recent context", forkOptions: { history: 5 } },
], { history: 'none' })
```



**setModel**

```ts
conversation.setModel('gpt-5.4')
await conversation.ask('now try that again with more care')
```



**setProvider**

```ts
conversation.setProvider('claude-code', { model: 'sonnet' })
conversation.setProvider(null) // back to the container's default provider
```



**clearMessages**

```ts
const edit = conversation.clearMessages()
// => { changed: 6, messageCount: 1, continuationInvalidated: true, version: 8 }
```



**replaceMessage**

```ts
// Redact the pixels from the most recent user message, keep its text
conversation.replaceMessage(
 message => message.role === 'user',
 message => ({ ...message, content: textPartsOf(message) }),
)
```



**ask**

```ts
const reply = await conversation.ask("What's the weather in SF?")
// With image:
const reply = await conversation.ask([
 { type: 'text', text: 'What is in this diagram?' },
 { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
])
```



**retryFailedTurn**

```ts
try { await conversation.ask('do the thing') }
catch { await conversation.retryFailedTurn() }
```



**routing**

```ts
conversation.routing
// => { provider: 'claude-code', model: 'sonnet', apiMode: 'chat', transport: 'generic' }
```

