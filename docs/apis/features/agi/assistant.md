# features.assistant

No description provided

## Usage

```ts
container.feature('assistant', {
  // The folder containing the assistant definition
  folder,
  // Path to the docs subfolder relative to the assistant folder
  docsPath,
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
})
```

## Options

| Property | Type | Description |

|----------|------|-------------|

| `folder` | `string` | The folder containing the assistant definition |

| `docsPath` | `string` | Path to the docs subfolder relative to the assistant folder |

| `prependPrompt` | `string` | Text to prepend to the system prompt |

| `appendPrompt` | `string` | Text to append to the system prompt |

| `tools` | `object` | Override or extend the tools loaded from tools.ts |

| `schemas` | `object` | Override or extend schemas whose keys match tool names |

| `model` | `string` | OpenAI model to use |

## Methods

### afterInitialize

Called immediately after the assistant is constructed. Synchronously loads the system prompt, tools, and hooks using the VM's runSync, creates the contentDb if a docs/ folder exists, then fires the `created` hook.

**Returns:** `void`



### loadSystemPrompt

Load the system prompt from CORE.md, applying any prepend/append options.

**Returns:** `string`



### loadTools

Load tools from tools.ts using the container's VM feature, injecting the container and assistant as globals. Merges with any tools provided in the constructor options. Runs synchronously via vm.loadModule.

**Returns:** `Record<string, ConversationTool>`



### loadHooks

Load event hooks from hooks.ts. Each exported function name should match an event the assistant emits. When that event fires, the corresponding hook function is called. Runs synchronously via vm.loadModule.

**Returns:** `Record<string, (...args: any[]) => any>`



### initDocsReader

Initialize the DocsReader for the assistant's docs/ folder, using the contentDb created during initialization. This loads documents and sets up the research tools.

**Returns:** `Promise<DocsReader | undefined>`



### start

Start the assistant by loading the docs reader, creating the conversation, and wiring up events. The system prompt, tools, hooks, and contentDb are already loaded synchronously during initialization.

**Returns:** `Promise<this>`



### ask

Ask the assistant a question. It will use its tools and docs to produce a streamed response. The assistant auto-starts if needed.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `question` | `string | ContentPart[]` | ✓ | The question to ask |

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



## Getters

| Property | Type | Description |

|----------|------|-------------|

| `resolvedFolder` | `string` | The absolute resolved path to the assistant folder. |

| `docsFolder` | `string` | The path to the docs subfolder. |

| `corePromptPath` | `string` | The path to CORE.md which provides the system prompt. |

| `toolsModulePath` | `string` | The path to tools.ts which provides tool implementations and schemas. |

| `hooksModulePath` | `string` | The path to hooks.ts which provides event handler functions. |

| `contentDb` | `ContentDb` |  |

| `isStarted` | `boolean` | Whether the assistant has been started and is ready to receive questions. |

| `systemPrompt` | `string` | The current system prompt text. |

| `tools` | `Record<string, ConversationTool>` | The tools registered with this assistant. |

## Events

### created

Emitted immediately after the assistant loads its prompt, tools, and hooks. Use this to register models on the contentDb before start() loads documents.



### turnStart

Emitted when a new completion turn begins. isFollowUp is true when resuming after tool calls

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `object` |  |



### turnEnd

Emitted when a completion turn ends. hasToolCalls indicates whether tool calls will follow

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `object` |  |



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



### hookFired

Emitted when a hook function is called

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `string` | Hook/event name |



### hookError

Event emitted by Assistant



### hookCompleted

Event emitted by Assistant



### answered

Event emitted by Assistant



### stateChange

Event: stateChange

**Event Arguments:**

| Name | Type | Description |

|------|------|-------------|

| `arg0` | `any` | The current state object |



### enabled

Emitted when the feature is enabled



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `started` | `boolean` | Whether the assistant has been initialized |

| `conversationCount` | `number` | Number of ask() calls made |

| `lastResponse` | `string` | The most recent response text |

| `folder` | `string` | The resolved assistant folder path |

## Examples

**features.assistant**

```ts
const assistant = container.feature('assistant', {
 folder: 'assistants/my-helper'
})
const answer = await assistant.ask('What capabilities do you have?')
```



**ask**

```ts
const answer = await assistant.ask('What capabilities do you have?')
```

