# AssistantDelegator (features.assistantDelegator)

> Stability: `experimental`

Gives an assistant bounded tools for forks, named specialists, and parallel research. Attach with assistant.use(container.feature('assistantDelegator')). Children never receive these tools or their prompt extension. Limits belong to the parent instance, so a new conversation or reattachment does not replenish the task budget. This governs framework delegation tools; arbitrary code tools remain trusted code.

## Usage

```ts
container.feature('assistantDelegator', {
  // Maximum children running at once per parent assistant.
  maxConcurrent,
  // Lifetime child-task budget per parent. Failures and timeouts also count; reattaching does not reset it.
  maxTasks,
  // Deadline for each child, including startup. Timed-out work is aborted and retains its slot until it settles.
  timeoutMs,
  // Maximum native tool-calling turns per child ask.
  maxToolTurns,
  // Optional exact allowlist of named assistants available for delegation.
  allowedAgents,
  // Maximum combined source-result characters for synthesis. Oversized selections are rejected, never silently truncated.
  maxSynthesisChars,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `maxConcurrent` | `integer` | Maximum children running at once per parent assistant. |
| `maxTasks` | `integer` | Lifetime child-task budget per parent. Failures and timeouts also count; reattaching does not reset it. |
| `timeoutMs` | `integer` | Deadline for each child, including startup. Timed-out work is aborted and retains its slot until it settles. |
| `maxToolTurns` | `integer` | Maximum native tool-calling turns per child ask. |
| `allowedAgents` | `array` | Optional exact allowlist of named assistants available for delegation. |
| `maxSynthesisChars` | `integer` | Maximum combined source-result characters for synthesis. Oversized selections are rejected, never silently truncated. |

## Methods

### getAssistants

Child instances scoped to a particular parent, useful when sharing a feature.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `Map<string, Assistant>`



### listTasks

Read this parent's task snapshots without exposing mutable bookkeeping.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `DelegationTask[]`



### startTask

Start an assignment without blocking; returns a stable ID for waiting, cancellation, or synthesis.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `DelegationTaskOptions` | ✓ | Parameter options |
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `DelegationTask`



### delegate

Delegate and wait for a terminal result. Use startTask for background work.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `DelegationTaskOptions` | ✓ | Parameter options |
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `Promise<DelegationTask>`



### research

Run independent questions in parallel and preserve question order, including failures.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `DelegationResearchOptions` | ✓ | Parameter options |
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `Promise<DelegationTask[]>`



### waitForTask

Wait up to timeoutMs for a task; zero returns its current snapshot. Does not cancel work.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `taskId` | `string` | ✓ | Parameter taskId |
| `timeoutMs` | `any` |  | Parameter timeoutMs |
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `Promise<DelegationTask>`



### followUp

Continue an existing idle child conversation. Follow-ups consume the same task budget as new assignments.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistantId` | `string` | ✓ | Parameter assistantId |
| `task` | `string` | ✓ | Parameter task |
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `Promise<DelegationTask>`



### cancelTask

Request cancellation; a non-cooperative child retains its slot until the underlying work settles.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `taskId` | `string` | ✓ | Parameter taskId |
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `DelegationTask`



### cancelAll

Cancel this parent's outstanding assignments when the coordinator stops or changes direction.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `DelegationTask[]`



### synthesize

Combine finished results in a fresh tool-free child using explicit guidance. Returns a tracked synthesis task with source IDs.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `DelegationSynthesisOptions` | ✓ | Parameter options |
| `parent` | `Assistant` |  | Parameter parent |

**Returns:** `Promise<DelegationTask>`



### toTools

Build a consumer-bound bundle; the same feature can safely serve multiple parents.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ only?: string[]; except?: string[] }` |  | Parameter options |

**Returns:** `ToolsBundle`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `assistants` | `Map<string, Assistant>` | Child instances keyed by assistant ID, including running and finished conversations. Returns a fresh Map; the Assistant values are the live instances. |
| `tasks` | `DelegationTask[]` | Assignment snapshots across this feature's attached parents, in creation order. |

## Events (Zod v4 schema)

### taskCompleted

Event emitted by AssistantDelegator

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Terminal task snapshot, including failures, cancellation, and timeouts |



### taskStarted

Event emitted by AssistantDelegator

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Snapshot of the new DelegationTask |



### taskUpdated

Event emitted by AssistantDelegator

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Snapshot after the child instance becomes available |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |