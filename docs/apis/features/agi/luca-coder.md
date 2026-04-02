# LucaCoder (features.lucaCoder)

A coding assistant that owns a lower-level Assistant instance and gates all tool calls through a permission system. Comes with built-in Bash tool (via proc.execAndCapture) and auto-loads the luca-framework skill when found in .claude/skills paths. Tools are stacked from feature bundles (fileTools, etc.) and each tool can be set to 'allow' (runs immediately), 'ask' (blocks until user approves/denies), or 'deny' (always rejected).

## Usage

```ts
container.feature('lucaCoder', {
  // Tool bundles to register on the inner assistant
  tools,
  // Permission level per tool name
  permissions,
  // Default permission level for unconfigured tools
  defaultPermission,
  // System prompt for the inner assistant
  systemPrompt,
  // OpenAI model override
  model,
  // Maximum number of output tokens per completion
  maxTokens,
  // Use a local API server for the inner assistant
  local,
  // Conversation history persistence mode
  historyMode,
  // Assistant folder for disk-based definitions
  folder,
  // Skill names to auto-load into the system prompt
  skills,
  // Auto-load luca-framework skill if found in .claude/skills path
  autoLoadLucaSkill,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `tools` | `array` | Tool bundles to register on the inner assistant |
| `permissions` | `object` | Permission level per tool name |
| `defaultPermission` | `string` | Default permission level for unconfigured tools |
| `systemPrompt` | `string` | System prompt for the inner assistant |
| `model` | `string` | OpenAI model override |
| `maxTokens` | `number` | Maximum number of output tokens per completion |
| `local` | `boolean` | Use a local API server for the inner assistant |
| `historyMode` | `string` | Conversation history persistence mode |
| `folder` | `string` | Assistant folder for disk-based definitions |
| `skills` | `array` | Skill names to auto-load into the system prompt |
| `autoLoadLucaSkill` | `boolean` | Auto-load luca-framework skill if found in .claude/skills path |

## Methods

### getPermission

Get the effective permission level for a tool.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolName` | `string` | ✓ | Parameter toolName |

**Returns:** `PermissionLevel`



### setPermission

Set permission level for one or more tools.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolName` | `string | string[]` | ✓ | Parameter toolName |
| `level` | `PermissionLevel` | ✓ | Parameter level |

**Returns:** `this`



### setDefaultPermission

Set the default permission level for unconfigured tools.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `level` | `PermissionLevel` | ✓ | Parameter level |

**Returns:** `this`



### permitTool

Allow a tool (or tools) to run without approval.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolNames` | `string[]` | ✓ | Parameter toolNames |

**Returns:** `this`



### gateTool

Require approval before a tool (or tools) can run.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolNames` | `string[]` | ✓ | Parameter toolNames |

**Returns:** `this`



### blockTool

Block a tool (or tools) from ever running.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `toolNames` | `string[]` | ✓ | Parameter toolNames |

**Returns:** `this`



### approve

Approve a pending tool call by ID. The tool will execute.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | Parameter id |

**Returns:** `this`



### deny

Deny a pending tool call by ID. The tool call will be skipped.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | Parameter id |

**Returns:** `this`



### approveAll

Approve all pending tool calls.

**Returns:** `this`



### denyAll

Deny all pending tool calls.

**Returns:** `this`



### bash

Execute a shell command string and return its output. Uses proc.execAndCapture under the hood — runs `sh -c <command>`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `{ command, cwd, timeout }` | `{ command: string; cwd?: string; timeout?: number }` | ✓ | Parameter { command, cwd, timeout } |

**Returns:** `Promise<{
		exitCode: number
		stdout: string
		stderr: string
		success: boolean
	}>`



### start

Initialize the inner assistant, register the bash tool, stack tool bundles, auto-load skills, and wire up the permission interceptor.

**Returns:** `Promise<this>`



### ask

Ask the coder a question. Auto-starts if needed. Tool calls will be gated by the permission system.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string` | ✓ | Parameter question |
| `options` | `Record<string, any>` |  | Parameter options |

**Returns:** `Promise<string>`



### use

Add a tool bundle after initialization. Useful for dynamically extending the assistant's capabilities.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `spec` | `ToolBundleSpec` | ✓ | Parameter spec |

**Returns:** `this`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `assistant` | `Assistant` | The inner assistant. Throws if not started. |
| `permissions` | `Record<string, PermissionLevel>` | Current permission map from state. |
| `pendingApprovals` | `PendingApproval[]` | Current pending approvals. |
| `isStarted` | `boolean` | Whether the assistant is started and ready. |
| `tools` | `Record<string, any>` | The tools registered on the inner assistant. |
| `conversation` | `any` | The conversation on the inner assistant (if started). |
| `messages` | `any` | Messages from the inner assistant's conversation. |

## Events (Zod v4 schema)

### permissionGranted

Emitted when a pending tool call is approved

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Approval ID |



### permissionDenied

Emitted when a pending tool call is denied

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Approval ID |



### toolBlocked

Emitted when a tool call is blocked by deny policy

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `string` | Reason |



### chunk

Forwarded: streamed token chunk from the inner assistant

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | A chunk of streamed text |



### response

Forwarded: complete response from the inner assistant

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The final response text |



### toolCall

Forwarded: a tool was called

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Tool arguments |



### toolResult

Forwarded: a tool returned a result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Result value |



### toolError

Forwarded: a tool call failed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Error |



### started

Emitted when the luca coder has been initialized



### permissionRequest

Emitted when a tool call requires user approval

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` | Unique approval ID |
| `toolName` | `string` | The tool requesting permission |
| `args` | `object` | The arguments the tool was called with |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `started` | `boolean` | Whether the assistant has been initialized |
| `permissions` | `object` | Permission level per tool name |
| `defaultPermission` | `string` | Permission level for tools not explicitly configured |
| `pendingApprovals` | `array` | Tool calls currently awaiting user approval |
| `approvalHistory` | `array` | Recent approval decisions |
| `loadedSkills` | `array` | Names of skills auto-loaded into context |

## Examples

**features.lucaCoder**

```ts
const coder = container.feature('lucaCoder', {
 tools: ['fileTools'],
 permissions: {
   readFile: 'allow',
   searchFiles: 'allow',
   writeFile: 'ask',
   bash: 'ask',
 },
 defaultPermission: 'ask',
 systemPrompt: 'You are a coding assistant.',
})

coder.on('permissionRequest', ({ id, toolName, args }) => {
 console.log(`Tool "${toolName}" wants to run with`, args)
 coder.approve(id)  // or coder.deny(id)
})

await coder.ask('Refactor the auth module to use async/await')
```

