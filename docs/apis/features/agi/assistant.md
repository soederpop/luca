# Assistant (features.assistant)

> Stability: `core`

An Assistant is a combination of a system prompt and tool calls that has a conversation with an LLM. You define an assistant by creating a folder with CORE.md (system prompt), tools.ts (tool implementations), and hooks.ts (event handlers).

## Usage

```ts
container.feature('assistant', {
  // Disable assistantDelegator tools and guidance. Automatically enabled for forks and subagents.
  delegationDisabled,
  // The folder containing the assistant definition. Defaults to cwd for runtime-created assistants.
  folder,
  // The folder containing the assistant documentation
  docsFolder,
  // Provide a complete system prompt directly, bypassing CORE.md
  systemPrompt,
  // Text to prepend to the system prompt
  prependPrompt,
  // Text to append to the system prompt
  appendPrompt,
  // Human-readable description of the assistant. Falls back to about.md in the assistant folder.
  about,
  // Override or extend the tools loaded from tools.ts
  tools,
  // Override or extend schemas whose keys match tool names
  schemas,
  // Model provider preset id (e.g. 'codex', 'claude-code') or inline provider config. Omit for default OpenAI-compatible behavior
  provider,
  // Provider-specific transport options passed to the resolved provider
  providerOptions,
  // OpenAI model to use
  model,
  // Maximum number of output tokens per completion
  maxTokens,
  // Ceiling on tool-calling turns per ask(). Default 0 = unlimited; any value <= 0 disables the cap. Set a positive value to fail runaway turns with ToolLoopLimitError
  maxToolTurns,
  // The model's total context window in tokens. Drives auto-compaction; set to your model's real limit so history compacts before the request overflows. Inferred from the model name when omitted.
  contextWindow,
  // Sampling temperature (0-2)
  temperature,
  // Nucleus sampling cutoff (0-1)
  topP,
  // Top-K sampling. Only supported by local/Anthropic models
  topK,
  // Frequency penalty (-2 to 2)
  frequencyPenalty,
  // Presence penalty (-2 to 2)
  presencePenalty,
  // Stop sequences
  stop,
  // Extra keys merged verbatim into the chat-completions request body (e.g. { chat_template_kwargs: { enable_thinking: false } }). Also settable in CORE.md frontmatter. Chat API only
  extraBody,
  // Conversation history persistence mode
  historyMode,
  // Prepend timestamps to user messages so the assistant can perceive time passing between sessions
  injectTimestamps,
  // Strict allowlist of tool name patterns. Only matching tools are available. Supports * glob matching.
  allowTools,
  // Denylist of tool name patterns to exclude. Supports * glob matching.
  forbidTools,
  // Explicit list of tool names to include (exact match). Shorthand for allowTools without glob patterns.
  toolNames,
  // Skill names to preload when the assistant uses the skillsLibrary
  skills,
  // Options for the OpenAI client, passed through to the conversation
  clientOptions,
  // Delegate images to a vision model when the assistant's own model has no vision. true for defaults, or { prompt, model, url, apiKey, batch, batchPrompt, concurrency }
  visionSupport,
  // Free-form assistant-specific settings, untouched by the framework and readable from tools.ts/hooks.ts via assistant.config
  config,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `delegationDisabled` | `boolean` | Disable assistantDelegator tools and guidance. Automatically enabled for forks and subagents. |
| `folder` | `string` | The folder containing the assistant definition. Defaults to cwd for runtime-created assistants. |
| `docsFolder` | `string` | The folder containing the assistant documentation |
| `systemPrompt` | `string` | Provide a complete system prompt directly, bypassing CORE.md |
| `prependPrompt` | `string` | Text to prepend to the system prompt |
| `appendPrompt` | `string` | Text to append to the system prompt |
| `about` | `string` | Human-readable description of the assistant. Falls back to about.md in the assistant folder. |
| `tools` | `object` | Override or extend the tools loaded from tools.ts |
| `schemas` | `object` | Override or extend schemas whose keys match tool names |
| `provider` | `any` | Model provider preset id (e.g. 'codex', 'claude-code') or inline provider config. Omit for default OpenAI-compatible behavior |
| `providerOptions` | `object` | Provider-specific transport options passed to the resolved provider |
| `model` | `string` | OpenAI model to use |
| `maxTokens` | `number` | Maximum number of output tokens per completion |
| `maxToolTurns` | `number` | Ceiling on tool-calling turns per ask(). Default 0 = unlimited; any value <= 0 disables the cap. Set a positive value to fail runaway turns with ToolLoopLimitError |
| `contextWindow` | `number` | The model's total context window in tokens. Drives auto-compaction; set to your model's real limit so history compacts before the request overflows. Inferred from the model name when omitted. |
| `temperature` | `number` | Sampling temperature (0-2) |
| `topP` | `number` | Nucleus sampling cutoff (0-1) |
| `topK` | `number` | Top-K sampling. Only supported by local/Anthropic models |
| `frequencyPenalty` | `number` | Frequency penalty (-2 to 2) |
| `presencePenalty` | `number` | Presence penalty (-2 to 2) |
| `stop` | `array` | Stop sequences |
| `extraBody` | `object` | Extra keys merged verbatim into the chat-completions request body (e.g. { chat_template_kwargs: { enable_thinking: false } }). Also settable in CORE.md frontmatter. Chat API only |
| `historyMode` | `string` | Conversation history persistence mode |
| `injectTimestamps` | `boolean` | Prepend timestamps to user messages so the assistant can perceive time passing between sessions |
| `allowTools` | `array` | Strict allowlist of tool name patterns. Only matching tools are available. Supports * glob matching. |
| `forbidTools` | `array` | Denylist of tool name patterns to exclude. Supports * glob matching. |
| `toolNames` | `array` | Explicit list of tool names to include (exact match). Shorthand for allowTools without glob patterns. |
| `skills` | `array` | Skill names to preload when the assistant uses the skillsLibrary |
| `clientOptions` | `object` | Options for the OpenAI client, passed through to the conversation |
| `visionSupport` | `any` | Delegate images to a vision model when the assistant's own model has no vision. true for defaults, or { prompt, model, url, apiKey, batch, batchPrompt, concurrency } |
| `config` | `object` | Free-form assistant-specific settings, untouched by the framework and readable from tools.ts/hooks.ts via assistant.config |

## Methods

### intercept

Register an interceptor at a given point in the pipeline.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `point` | `K` | ✓ | The interception point |
| `fn` | `InterceptorFn<InterceptorPoints[K]>` | ✓ | Middleware function receiving (ctx, next) |

**Returns:** `this`



### triggerHook

Trigger a named hook and await its completion. The hook function receives `(assistant, ...args)` and its return value is passed back to the caller. This ensures hooks run to completion BEFORE any subsequent logic executes, unlike the old bus-based approach where async hooks were fire-and-forget. Hooks that don't exist are silently skipped (returns undefined).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `hookName` | `string` | ✓ | The hook to trigger (matches an export name from hooks.ts) |
| `args` | `any[]` | ✓ | Arguments passed to the hook after the assistant instance |

**Returns:** `Promise<any>`



### afterInitialize

Called immediately after the assistant is constructed. Synchronously loads the system prompt, tools, and hooks. Hooks are invoked via triggerHook() at each emit site, ensuring async hooks are properly awaited.

**Returns:** `void`



### setModel

Switch the model for every subsequent turn. Safe to call mid-chat — the conversation, its history, and its tools are all preserved.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `model` | `string` | ✓ | The model name to use from here on |

**Returns:** `this`

```ts
assistant.setModel('gpt-5.4')
await assistant.ask('try that again, more carefully')
```



### setProvider

Switch the backend for every subsequent turn — including across transport families (an OpenAI-compatible endpoint to claude-code, say). Safe to call mid-chat: history and tools survive, and an unregistered provider id throws immediately rather than at the next `ask()`. With no explicit `model`, the new provider's own default model takes over.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `provider` | `string | Record<string, any> | null` | ✓ | A registered provider id, an inline provider config, or null for the container default |
| `options` | `SetProviderOptions` |  | Optional `model` and `providerOptions` to apply along with the switch |

**Returns:** `this`

```ts
assistant.setProvider('claude-code', { model: 'sonnet' })
await assistant.ask('pick up where we left off')
```



### clearMessages

Wipe this assistant's transcript, keeping its system prompt — "start over". Delegates to `Conversation#clearMessages`, so provider continuation handles are invalidated and `messagesVersion` bumps. Note this only clears the live conversation. A persisted thread is replayed on the next resume unless it is deleted too.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClearMessagesOptions` |  | Parameter options |

**Returns:** `MessageEdit`

```ts
assistant.clearMessages()
```



### replaceMessage

Rewrite one message already in this assistant's history — the supported way to redact it. Delegates to `Conversation#replaceMessage`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | `MessageSelector` | ✓ | Parameter selector |
| `replacement` | `Message | ((message: Message, index: number) => Message)` | ✓ | Parameter replacement |

**Returns:** `MessageEdit`

```ts
assistant.replaceMessage(-1, message => ({ ...message, content: '[redacted]' }))
```



### retryFailedTurn

Retry the recorded failed turn. Delegates to `Conversation#retryFailedTurn`: the surviving user input is re-run without duplication, and the failure's partial output is never replayed as context.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `AskOptions & { expectId?: string }` |  | Parameter options |

**Returns:** `Promise<string>`

```ts
if (assistant.failedTurn) await assistant.retryFailedTurn({ expectId: assistant.failedTurn.id })
```



### disableDelegation

Permanently remove delegation capabilities from a child, including after reload.

**Returns:** `this`



### addSystemPromptExtension

Add or update a named system prompt extension. The value is appended to the base system prompt when passed to the conversation.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | A unique identifier for this extension |
| `value` | `string` | ✓ | The text to append |

**Returns:** `this`



### removeSystemPromptExtension

Remove a named system prompt extension.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `key` | `string` | ✓ | The identifier of the extension to remove |

**Returns:** `this`



### toolFilterDecision

Resolve whether one tool survives the assistant's current filters.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `ToolFilterDecision`



### use

Apply a setup function or a Helper instance to this assistant. When passed a function, it receives the assistant and can configure tools, hooks, event listeners, etc. When passed a Helper instance that exposes tools via toTools(), those tools are automatically added to this assistant.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fnOrHelper` | `((assistant: this) => void | Promise<void>) | { toTools: () => ToolsBundle } | ToolsBundle` | ✓ | Setup function or Helper instance |

**Returns:** `this`

```ts
assistant
 .use(setupLogging)
 .use(container.feature('git'))
```



### addTool

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `nameOrHandler` | `string | ((...args: any[]) => any)` | ✓ | Parameter nameOrHandler |
| `handlerOrSchema` | `((...args: any[]) => any) | z.ZodType` |  | Parameter handlerOrSchema |
| `maybeSchema` | `z.ZodType` |  | Parameter maybeSchema |

**Returns:** `this`



### removeTool

Remove a tool by name or handler function reference.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `nameOrHandler` | `string | ((...args: any[]) => any)` | ✓ | The tool name string, or the handler function to match |

**Returns:** `this`



### simulateToolCallWithResult

Simulate a tool call and its result by appending the appropriate messages to the conversation history. Useful for injecting context that looks like the assistant performed a tool call.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolCallName` | `string` | ✓ | The name of the tool |
| `args` | `Record<string, any>` | ✓ | The arguments that were "passed" to the tool |
| `result` | `any` | ✓ | The result the tool "returned" |

**Returns:** `this`



### simulateQuestionAndResponse

Simulate a user question and assistant response by appending both messages to the conversation history.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string` | ✓ | The user's question |
| `response` | `string` | ✓ | The assistant's response |

**Returns:** `this`



### setting

Read one value out of {@link config} by dot path, with an optional fallback. Use this in tools.ts/hooks.ts so a missing config block doesn't throw on nested access.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Dot path into the merged config (e.g. 'gws.profile') |
| `fallback` | `T` |  | Returned when the path is absent or undefined |

**Returns:** `T`

```ts
const profile = me.setting('gwsProfile', 'default')
const budget = me.setting('limits.maxDownloads', 25)
```



### loadSystemPrompt

Load the system prompt from CORE.md, applying any prepend/append options. YAML frontmatter (between --- fences) is stripped from the prompt and stored in `_meta`.

**Returns:** `string`



### loadTools

Load tools from tools.ts using the container's VM feature, injecting the container and assistant as globals. Merges with any tools provided in the constructor options. Runs synchronously via vm.loadModule.

**Returns:** `Record<string, ConversationTool>`



### loadHooks

Load event hooks from hooks.ts. Each exported function name should match an event the assistant emits. When that event fires, the corresponding hook function is called. Runs synchronously via vm.loadModule.

**Returns:** `Record<string, (...args: any[]) => any>`



### resumeThread

Override thread for resume. Call before start().

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | ✓ | The thread ID to resume |

**Returns:** `this`



### abort

Abort the in-flight turn, if any. The pending `ask()` rejects with a `ConversationAbortError` whose `.partial` property carries the text streamed before the abort. Safe to call when nothing is running (no-op), and it never creates a conversation just to abort one.

**Returns:** `this`

```ts
assistant.abort()
```



### switchThread

Switch to another saved thread mid-session. Unlike `resumeThread()`, which only records an override for the next `start()`, this loads the thread's history into the live conversation immediately — the message list, response chain, token usage, and cost are all replaced. A thread id with no saved record starts that thread fresh.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | ✓ | The thread ID to switch to |

**Returns:** `Promise<this>`

```ts
await assistant.switchThread('researcher:1a2b3c4d:2026-08-01')
```



### listHistory

List saved conversations for this assistant+project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ limit?: number }` |  | Optional limit |

**Returns:** `Promise<ConversationMeta[]>`



### clearHistory

Delete all history for this assistant+project.

**Returns:** `Promise<number>`



### resolveConfiguredUse

Materialize the `export const use = [...]` entries loaded from tools.ts. Safe to call before start(); entries are consumed once while configuredUse remains available for runtime introspection.

**Returns:** `this`



### reload

Reload tools, hooks, and system prompt from disk. Useful during development or when tool/hook files have been modified and you want the assistant to pick up changes without restarting.

**Returns:** `this`



### start

Start the assistant by creating the conversation and wiring up events. The system prompt, tools, and hooks are already loaded synchronously during initialization.

**Returns:** `Promise<this>`



### describeImages

Replace image parts in a content array with text descriptions produced by the configured vision model. Used by ask() when visionSupport is enabled; also callable directly, and `overrides` lets a single call opt into batch mode without reconfiguring the assistant. Two modes: - default: one vision call per image, run `concurrency` at a time. Each image is described in isolation, so the model cannot compare them. - batch: ONE call containing every image, described as an ordered sequence. Use this for video frames or before/after pairs — it is the only mode that can report what changed between images. All image parts collapse into a single text part where the first image was, so the returned array is shorter than the input.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parts` | `ContentPart[]` | ✓ | Content parts possibly containing image_url entries |
| `overrides` | `Partial<Pick<VisionSupportConfig, 'batch' | 'prompt' | 'batchPrompt' | 'concurrency'>>` |  | Per-call overrides for batch, prompt, batchPrompt, concurrency |

**Returns:** `Promise<ContentPart[]>`

```ts
// Describe video frames as one sequence, so motion survives the hand-off
const described = await assistant.describeImages(frames, { batch: true })
```



### ask

Ask the assistant a question. It will use its tools to produce a streamed response. The assistant auto-starts if needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string | ContentPart[]` | ✓ | The question to ask |
| `options` | `AskOptions` |  | Parameter options |

**Returns:** `Promise<string>`

```ts
const answer = await assistant.ask('What capabilities do you have?')
```



### save

Save the conversation to disk via conversationHistory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }` |  | Optional overrides for title, tags, thread, or metadata |

**Returns:** `void`



### fork

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `AssistantForkOptions | AssistantForkOptions[]` |  | Parameter options |

**Returns:** `Promise<Assistant | Assistant[]>`



### createResearchJob

Create a non-blocking research job that fans out questions across forked assistants. The forks fire immediately and the returned entity tracks progress via observable state and events. Each fork preserves the full assistant identity (interceptors, tools, hooks).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | Shared context/framing prompt prepended to each fork's system prompt |
| `questions` | `(string | { question: string; forkOptions?: AssistantForkOptions })[]` | ✓ | Array of questions (strings) or objects with question + per-fork overrides |
| `defaults` | `AssistantForkOptions` |  | Default fork options applied to all forks |

**Returns:** `Promise<ResearchJob>`

```ts
// Fire and forget — check later
const job = await assistant.createResearchJob(
 "Analyze this codebase for security issues",
 ["Look for SQL injection", "Look for XSS", "Look for auth bypass"],
 { history: 'none', model: 'gpt-4o-mini' }
)

// Check progress
job.state.get('completed') // 2 of 3
job.state.get('results')   // [answer1, answer2, null]

// React to events
job.on('forkCompleted', (index, result) => console.log(`Fork ${index} done`))

// Or just wait
await job.waitFor('completed')
```



### research

Fan out N questions in parallel using forked assistants, return the results. Sugar over createResearchJob — blocks until all forks complete.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `questions` | `(string | { question: string; forkOptions?: AssistantForkOptions })[]` | ✓ | Array of questions (strings) or objects with question + per-fork overrides |
| `defaults` | `AssistantForkOptions & { prompt?: string }` |  | Default fork options applied to all forks |

**Returns:** `Promise<(string | null)[]>`

```ts
const results = await assistant.research([
 "What are best practices for X?",
 "What are common pitfalls of X?",
], { history: 'none', model: 'gpt-4o-mini' })
```



### subagent

Get or create a subagent assistant. Uses the assistantsManager to discover and create the assistant, then caches the instance for reuse across tool calls.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | The assistant name (e.g. 'codingAssistant') |
| `options` | `Record<string, any>` |  | Additional options to pass to the assistant constructor |

**Returns:** `Promise<Assistant>`

```ts
const researcher = await assistant.subagent('codingAssistant')
const answer = await researcher.ask('Find all usages of container.feature("fs")')
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `name` | `any` |  |
| `resolvedFolder` | `string` | The absolute resolved path to the assistant folder. |
| `corePromptPath` | `string` | The path to CORE.md which provides the system prompt. |
| `toolsModulePath` | `string` | The path to tools.ts which provides tool implementations and schemas. |
| `hooksModulePath` | `string` | The path to hooks.ts which provides event handler functions. |
| `aboutPath` | `string` | The path to the about file which provides the human-readable assistant description. Prefers ABOUT.md (the casing used by discovery and scaffolds), falling back to about.md for older assistant folders. |
| `about` | `string | undefined` | Human-readable description of the assistant. Returns the `about` option when provided, otherwise reads about.md from the assistant folder. Undefined when neither is available. |
| `hasVoice` | `boolean` | Whether this assistant has a voice.yml configuration file. |
| `voiceConfig` | `Record<string, any> | undefined` | Parsed voice configuration from voice.yml, or undefined if not present. |
| `resolvedDocsFolder` | `any` |  |
| `contentDb` | `ContentDb` | Returns an instance of a ContentDb feature for the resolved docs folder |
| `conversation` | `Conversation` |  |
| `routing` | `ConversationRouting` | Where the assistant's next turn will go: provider, model, OpenAI dialect, and turn loop. Derived live from the underlying conversation. |
| `availableTools` | `any` |  |
| `messages` | `any` |  |
| `failedTurn` | `FailedTurnRecord | null` | The most recent failed turn, or null when the last turn succeeded. See `Conversation` state `failedTurn` for the contract. |
| `isStarted` | `boolean` | Whether the assistant has been started and is ready to receive questions. |
| `isFork` | `boolean` | Whether this assistant was created via fork(). |
| `forkDepth` | `number` | How many levels deep this fork is. 0 = original, 1 = direct fork, 2 = fork of a fork, etc. |
| `delegationDisabled` | `boolean` | Whether this assistant is barred from consuming delegation tools. |
| `systemPrompt` | `string` | The current system prompt text. |
| `systemPromptExtensions` | `Record<string, string>` | The named extensions appended to the system prompt. |
| `effectiveSystemPrompt` | `string` | The system prompt with all extensions appended. This is the value passed to the conversation. |
| `tools` | `Record<string, ConversationTool>` | The tools registered with this assistant. |
| `allTools` | `Record<string, ConversationTool>` | Every known tool before allow/forbid/toolNames filters are applied. |
| `schemas` | `Record<string, z.ZodType>` | Live Zod schemas keyed by tool name. |
| `toolSources` | `Record<string, string>` | Provenance for every live tool: feature id, tools.ts, or runtime. |
| `configuredUse` | `any[]` | Resolved entries exported by tools.ts as `use`, retained after startup. |
| `meta` | `Record<string, any>` | Parsed YAML frontmatter from CORE.md, or empty object if none. |
| `effectiveOptions` | `AssistantOptions & Record<string, any>` | Merged options where CORE.md frontmatter provides defaults and constructor options take precedence. Prefer this over `this.options` anywhere model parameters or runtime config is consumed. |
| `config` | `Record<string, any>` | Assistant-specific settings the framework never interprets — the supported home for arbitrary configuration. Every other option is schema-validated, so unknown top-level keys are silently stripped; keys nested under `config` survive untouched. Three layers deep-merge, weakest first: a `config:` block in the assistant's own CORE.md frontmatter, then the workspace's `assistants/options.yml` (`defaults.config` then `<name>.config`), then `config` passed to `create()`. The options.yml layer is what lets a project configure assistants it does not own — ones contributed by a plugin, or discovered from `~/.luca/assistants`. |
| `paths` | `any` | Provides a helper for creating paths off of the assistant's base folder |
| `assistantName` | `string` | The assistant name derived from the folder basename. |
| `cwdHash` | `string` | An 8-char hash of the container cwd for per-project thread isolation. |
| `threadPrefix` | `string` | The thread prefix for this assistant+project combination. |
| `conversationHistory` | `ConversationHistory` | The conversationHistory feature instance. |
| `currentThreadId` | `string | undefined` | The active thread ID (undefined in lifecycle mode). |
| `visionSupport` | `VisionSupportConfig | undefined` | Resolved vision delegation config, or undefined when visionSupport is not enabled. Merges the option (constructor or CORE.md frontmatter) with env-var defaults: LUCA_VISION_SUPPORT_MODEL, LUCA_VISION_SUPPORT_URL, LUCA_VISION_SUPPORT_API_KEY, falling back to OPENAI_BASE_URL / OPENAI_API_KEY and the 'gpt-5.2' model. |
| `availableSubagents` | `string[]` | Names of assistants available as subagents, discovered via the assistantsManager. |

## Events (Zod v4 schema)

### hookFired

Emitted when a hook function is called

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Hook/event name |



### created

Emitted immediately after the assistant loads its prompt, tools, and hooks.



### systemPromptExtensionsChanged

Emitted when system prompt extensions are added or removed



### toolsChanged

Event emitted by Assistant



### reloaded

Emitted after tools, hooks, and system prompt are reloaded from disk



### turnStart

Emitted when a new completion turn begins. isFollowUp is true when resuming after tool calls

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `turn` | `number` |  |
| `isFollowUp` | `boolean` |  |



### turnEnd

Emitted when a completion turn ends. hasToolCalls indicates whether tool calls will follow

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `turn` | `number` |  |
| `hasToolCalls` | `boolean` |  |



### chunk

Emitted as tokens stream in

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | A chunk of streamed text |



### reasoning

Emitted as a thinking model streams its reasoning, before and between answer chunks. Never included in the response text or message history; availability and shape depend on the provider (raw thinking from local models, summaries from the OpenAI Responses API, nothing from codex/claude-code sessions)

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | A delta of reasoning/thinking text |



### preview

Emitted with the full response text accumulated across all turns

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The accumulated response so far |



### response

Emitted when a complete response is produced (accumulated across all turns)

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The final response text |



### rawEvent

Emitted for each raw streaming event from the underlying conversation transport

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | A raw streaming event from the active model API |



### mcpEvent

Emitted for MCP-specific streaming and output-item events when using Responses API MCP tools

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | A raw MCP-related streaming event |



### toolCall

Emitted when a tool is called

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Tool arguments |



### toolResult

Emitted when a tool returns a result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Result value |



### toolError

Emitted when a tool call fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Error |



### started

Emitted when the assistant has been initialized



### visionDescription

Emitted when visionSupport delegates an image to the vision model and receives a description. In batch mode it fires once with batch: true and count set to the number of images described together

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `index` | `number` |  |
| `description` | `string` |  |
| `model` | `string` |  |
| `batch` | `boolean` |  |
| `count` | `number` |  |



### answered

Event emitted by Assistant



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `started` | `boolean` | Whether the assistant has been initialized |
| `conversationCount` | `number` | Number of ask() calls made |
| `lastResponse` | `string` | The most recent response text |
| `folder` | `string` | The resolved assistant folder path |
| `docsFolder` | `string` | The resolved docs folder |
| `conversationId` | `string` | The active conversation persistence ID |
| `threadId` | `string` | The active thread ID |
| `systemPrompt` | `string` | The loaded system prompt text |
| `systemPromptExtensions` | `object` | Named extensions appended to the system prompt |
| `meta` | `object` | Parsed YAML frontmatter from CORE.md |
| `tools` | `object` | Registered tool implementations |
| `hooks` | `object` | Loaded event hook functions |
| `resumeThreadId` | `string` | Thread ID override for resume |
| `pendingPlugins` | `array` | Pending async plugin promises |
| `conversation` | `any` | The active Conversation feature instance |
| `subagents` | `object` | Cached subagent instances |
| `forkDepth` | `number` | How many times this assistant has been forked from an ancestor. 0 = original. |

## Examples

**features.assistant**

```ts
const assistant = container.feature('assistant', {
 folder: 'assistants/my-helper'
})
const answer = await assistant.ask('What capabilities do you have?')
```



**setModel**

```ts
assistant.setModel('gpt-5.4')
await assistant.ask('try that again, more carefully')
```



**setProvider**

```ts
assistant.setProvider('claude-code', { model: 'sonnet' })
await assistant.ask('pick up where we left off')
```



**clearMessages**

```ts
assistant.clearMessages()
```



**replaceMessage**

```ts
assistant.replaceMessage(-1, message => ({ ...message, content: '[redacted]' }))
```



**retryFailedTurn**

```ts
if (assistant.failedTurn) await assistant.retryFailedTurn({ expectId: assistant.failedTurn.id })
```



**use**

```ts
assistant
 .use(setupLogging)
 .use(container.feature('git'))
```



**setting**

```ts
const profile = me.setting('gwsProfile', 'default')
const budget = me.setting('limits.maxDownloads', 25)
```



**abort**

```ts
assistant.abort()
```



**switchThread**

```ts
await assistant.switchThread('researcher:1a2b3c4d:2026-08-01')
```



**describeImages**

```ts
// Describe video frames as one sequence, so motion survives the hand-off
const described = await assistant.describeImages(frames, { batch: true })
```



**ask**

```ts
const answer = await assistant.ask('What capabilities do you have?')
```



**createResearchJob**

```ts
// Fire and forget — check later
const job = await assistant.createResearchJob(
 "Analyze this codebase for security issues",
 ["Look for SQL injection", "Look for XSS", "Look for auth bypass"],
 { history: 'none', model: 'gpt-4o-mini' }
)

// Check progress
job.state.get('completed') // 2 of 3
job.state.get('results')   // [answer1, answer2, null]

// React to events
job.on('forkCompleted', (index, result) => console.log(`Fork ${index} done`))

// Or just wait
await job.waitFor('completed')
```



**research**

```ts
const results = await assistant.research([
 "What are best practices for X?",
 "What are common pitfalls of X?",
], { history: 'none', model: 'gpt-4o-mini' })
```



**subagent**

```ts
const researcher = await assistant.subagent('codingAssistant')
const answer = await researcher.ask('Find all usages of container.feature("fs")')
```



**routing**

```ts
assistant.routing
// => { provider: 'local', model: 'qwen3-coder', apiMode: 'chat', transport: 'openai' }
```



**config**

```yaml
# <workspace>/assistants/options.yml — configures a plugin's assistant
googleWorkspace:
 config:
   gwsProfile: northchief
```

```ts
// assistants/googleWorkspace/tools.ts
export const use = [container.feature('gws', { profile: me.config.gwsProfile })]
```

