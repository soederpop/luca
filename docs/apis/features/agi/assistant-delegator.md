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

## Methods

### toTools

Build a consumer-bound bundle; the same feature can safely serve multiple parents.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ only?: string[]; except?: string[] }` |  | Parameter options |

**Returns:** `ToolsBundle`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |