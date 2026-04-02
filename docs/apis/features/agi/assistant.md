# Assistant (features.assistant)

An Assistant is a combination of a system prompt and tool calls that has a conversation with an LLM. You define an assistant by creating a folder with CORE.md (system prompt), tools.ts (tool implementations), and hooks.ts (event handlers).

## Usage

```ts
container.feature('assistant', {
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
  // Override or extend the tools loaded from tools.ts
  tools,
  // Override or extend schemas whose keys match tool names
  schemas,
  // OpenAI model to use
  model,
  // Maximum number of output tokens per completion
  maxTokens,
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
  // Whether to use our local models for this
  local,
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
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `folder` | `string` | The folder containing the assistant definition. Defaults to cwd for runtime-created assistants. |
| `docsFolder` | `string` | The folder containing the assistant documentation |
| `systemPrompt` | `string` | Provide a complete system prompt directly, bypassing CORE.md |
| `prependPrompt` | `string` | Text to prepend to the system prompt |
| `appendPrompt` | `string` | Text to append to the system prompt |
| `tools` | `object` | Override or extend the tools loaded from tools.ts |
| `schemas` | `object` | Override or extend schemas whose keys match tool names |
| `model` | `string` | OpenAI model to use |
| `maxTokens` | `number` | Maximum number of output tokens per completion |
| `temperature` | `number` | Sampling temperature (0-2) |
| `topP` | `number` | Nucleus sampling cutoff (0-1) |
| `topK` | `number` | Top-K sampling. Only supported by local/Anthropic models |
| `frequencyPenalty` | `number` | Frequency penalty (-2 to 2) |
| `presencePenalty` | `number` | Presence penalty (-2 to 2) |
| `stop` | `array` | Stop sequences |
| `local` | `boolean` | Whether to use our local models for this |
| `historyMode` | `string` | Conversation history persistence mode |
| `injectTimestamps` | `boolean` | Prepend timestamps to user messages so the assistant can perceive time passing between sessions |
| `allowTools` | `array` | Strict allowlist of tool name patterns. Only matching tools are available. Supports * glob matching. |
| `forbidTools` | `array` | Denylist of tool name patterns to exclude. Supports * glob matching. |
| `toolNames` | `array` | Explicit list of tool names to include (exact match). Shorthand for allowTools without glob patterns. |

## Methods

### intercept

Register an interceptor at a given point in the pipeline.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `point` | `K` | ✓ | The interception point |
| `fn` | `InterceptorFn<InterceptorPoints[K]>` | ✓ | Middleware function receiving (ctx, next) |

**Returns:** `this`



### afterInitialize

Called immediately after the assistant is constructed. Synchronously loads the system prompt, tools, and hooks, then binds hooks as event listeners so every emitted event automatically invokes its corresponding hook.

**Returns:** `void`



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



### use

Apply a setup function or a Helper instance to this assistant. When passed a function, it receives the assistant and can configure tools, hooks, event listeners, etc. When passed a Helper instance that exposes tools via toTools(), those tools are automatically added to this assistant.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fnOrHelper` | `((assistant: this) => void | Promise<void>) | { toTools: () => { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> } } | { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> }` | ✓ | Setup function or Helper instance |

**Returns:** `this`

```ts
assistant
 .use(setupLogging)
 .use(container.feature('git'))
```



### addTool

Add a tool to this assistant. The tool name is derived from the handler's function name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `handler` | `(...args: any[]) => any` | ✓ | A named function that implements the tool |
| `schema` | `z.ZodType` |  | Optional Zod schema describing the tool's parameters |

**Returns:** `this`

```ts
assistant.addTool(function getWeather(args) {
 return { temp: 72 }
}, z.object({ city: z.string() }).describe('Get weather for a city'))
```



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



### reload

Reload tools, hooks, and system prompt from disk. Useful during development or when tool/hook files have been modified and you want the assistant to pick up changes without restarting.

**Returns:** `this`



### start

Start the assistant by creating the conversation and wiring up events. The system prompt, tools, and hooks are already loaded synchronously during initialization.

**Returns:** `Promise<this>`



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
| `hasVoice` | `boolean` | Whether this assistant has a voice.yaml configuration file. |
| `voiceConfig` | `Record<string, any> | undefined` | Parsed voice configuration from voice.yaml, or undefined if not present. |
| `resolvedDocsFolder` | `any` |  |
| `contentDb` | `ContentDb` | Returns an instance of a ContentDb feature for the resolved docs folder |
| `conversation` | `Conversation` |  |
| `availableTools` | `any` |  |
| `messages` | `any` |  |
| `isStarted` | `boolean` | Whether the assistant has been started and is ready to receive questions. |
| `systemPrompt` | `string` | The current system prompt text. |
| `systemPromptExtensions` | `Record<string, string>` | The named extensions appended to the system prompt. |
| `effectiveSystemPrompt` | `string` | The system prompt with all extensions appended. This is the value passed to the conversation. |
| `tools` | `Record<string, ConversationTool>` | The tools registered with this assistant. |
| `meta` | `Record<string, any>` | Parsed YAML frontmatter from CORE.md, or empty object if none. |
| `effectiveOptions` | `AssistantOptions & Record<string, any>` | Merged options where CORE.md frontmatter provides defaults and constructor options take precedence. Prefer this over `this.options` anywhere model parameters or runtime config is consumed. |
| `paths` | `any` | Provides a helper for creating paths off of the assistant's base folder |
| `assistantName` | `string` | The assistant name derived from the folder basename. |
| `cwdHash` | `string` | An 8-char hash of the container cwd for per-project thread isolation. |
| `threadPrefix` | `string` | The thread prefix for this assistant+project combination. |
| `conversationHistory` | `ConversationHistory` | The conversationHistory feature instance. |
| `currentThreadId` | `string | undefined` | The active thread ID (undefined in lifecycle mode). |
| `availableSubagents` | `string[]` | Names of assistants available as subagents, discovered via the assistantsManager. |

## Events (Zod v4 schema)

### created

Emitted immediately after the assistant loads its prompt, tools, and hooks.



### systemPromptExtensionsChanged

Emitted when system prompt extensions are added or removed



### toolsChanged

Event emitted by Assistant



### hookFired

Emitted when a hook function is called

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Hook/event name |



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

## Examples

**features.assistant**

```ts
const assistant = container.feature('assistant', {
 folder: 'assistants/my-helper'
})
const answer = await assistant.ask('What capabilities do you have?')
```



**use**

```ts
assistant
 .use(setupLogging)
 .use(container.feature('git'))
```



**addTool**

```ts
assistant.addTool(function getWeather(args) {
 return { temp: 72 }
}, z.object({ city: z.string() }).describe('Get weather for a city'))
```



**ask**

```ts
const answer = await assistant.ask('What capabilities do you have?')
```



**subagent**

```ts
const researcher = await assistant.subagent('codingAssistant')
const answer = await researcher.ask('Find all usages of container.feature("fs")')
```

