# AutonomousAssistant (features.autoAssistant)

An autonomous assistant that owns a lower-level Assistant instance and gates all tool calls through a permission system. Tools are stacked from feature bundles (fileTools, processManager, etc.) and each tool can be set to 'allow' (runs immediately), 'ask' (blocks until user approves/denies), or 'deny' (always rejected).

## Usage

```ts
container.feature('autoAssistant')
```

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



### start

Initialize the inner assistant, stack tool bundles, and wire up the permission interceptor.

**Returns:** `Promise<this>`



### ask

Ask the autonomous assistant a question. Auto-starts if needed. Tool calls will be gated by the permission system.

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

Event emitted by AutonomousAssistant



### permissionDenied

Event emitted by AutonomousAssistant



### toolBlocked

Event emitted by AutonomousAssistant



### chunk

Event emitted by AutonomousAssistant



### response

Event emitted by AutonomousAssistant



### toolCall

Event emitted by AutonomousAssistant



### toolResult

Event emitted by AutonomousAssistant



### toolError

Event emitted by AutonomousAssistant



### started

Event emitted by AutonomousAssistant



### permissionRequest

Event emitted by AutonomousAssistant



## Examples

**features.autoAssistant**

```ts
const auto = container.feature('autoAssistant', {
 tools: ['fileTools', { feature: 'processManager', except: ['killAllProcesses'] }],
 permissions: {
   readFile: 'allow',
   searchFiles: 'allow',
   writeFile: 'ask',
   editFile: 'ask',
   deleteFile: 'deny',
 },
 defaultPermission: 'ask',
 systemPrompt: 'You are a coding assistant.',
})

auto.on('permissionRequest', ({ id, toolName, args }) => {
 console.log(`Tool "${toolName}" wants to run with`, args)
 // Show UI, then:
 auto.approve(id)  // or auto.deny(id)
})

await auto.ask('Refactor the auth module to use async/await')
```

