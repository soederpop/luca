# Assistant delegation

`assistantDelegator` opts an assistant into bounded delegation. It adds tool descriptions that explain when to fork, select a specialist, or research questions in parallel, plus a system prompt extension about task scope, evidence, shared writes, and authorization.

```typescript
import container from 'luca/agi'

const assistant = container.feature('assistant', {
  systemPrompt: 'Help investigate and improve this project.',
})

const delegator = container.feature('assistantDelegator', {
  maxConcurrent: 3,
  maxTasks: 12,
  timeoutMs: 120_000,
  maxToolTurns: 15,
  // Optional: restrict named specialists discovered by assistantsManager.
  // allowedAgents: ['researcher', 'reviewer'],
})
assistant.use(delegator)
```

The assistant receives tools for the full coordination cycle:

- `delegateTask({ task, agent?, history? })` runs one assignment and returns a task record with `id`, `assistantId`, status, timestamps, result, and any error. Omitting `agent` forks the current assistant. A named agent uses `assistant.subagent()` and retains that specialist's conversation between assignments. `history` applies to forks only.
- `researchTasks({ questions, context?, history? })` runs independent questions on parallel forks and returns results in question order. Individual failures do not discard successful answers.
- `listDelegationAgents({})` lists permitted specialist names from `assistantsManager`.
- `delegationStatus({})` reports active children, available slots, tasks used, and the remaining task budget.
- `startDelegation({ task, agent?, history? })` starts background work and immediately returns a task ID.
- `listDelegationTasks({})` returns task snapshots with results and provenance.
- `waitForDelegation({ taskId, timeoutMs? })` waits up to 10 seconds by default, or at most 60 seconds. A wait timeout returns current status without cancelling the task; zero is an immediate status read.
- `followUpDelegation({ assistantId, task })` continues an idle child's existing conversation and returns a new task record.
- `cancelDelegation({ taskId })` cancels an obsolete assignment. Terminal tasks are unchanged.
- `synthesizeDelegations({ guidance, taskIds? })` produces a guided synthesis from selected finished results in a fresh child with no tools. Without IDs it selects all finished non-synthesis tasks for this parent. It requires at least one successful source and includes errors from failed sources.

Application code has the same capabilities, plus direct access to the child instances:

```typescript
const findings = await delegator.research({
  questions: [
    'Identify the main reliability risks. Cite concrete evidence.',
    'Identify performance bottlenecks. Cite concrete evidence.',
  ],
  context: 'Analyze the current implementation; make no changes.',
})

// A fresh Map keyed by assistant ID; values are live Assistant instances.
const children = delegator.assistants
const researcher = children.get(findings[0].assistantId)
// Inspect its conversation, usage, tools, state, or subscribe to its events.
const transcript = researcher.conversation.messages

const clarification = await delegator.followUp(
  researcher.uuid,
  'Which reliability risk should we address first, and why?',
)

const synthesis = await delegator.synthesize({
  guidance: 'Write a prioritized engineering plan. Reconcile disagreements, distinguish evidence from inference, and explain what remains unverified.',
  taskIds: [...findings.map(task => task.id), clarification.id],
})
console.log(synthesis.result)
console.log(synthesis.sourceTaskIds)
```

`delegator.tasks` returns task snapshots. Each task has a unique ID, parent ID, kind (`delegation`, `followUp`, or `synthesis`), status (`running`, `completed`, `failed`, `timedOut`, or `cancelled`), timestamps, and its child ID once startup completes. Multiple follow-ups may refer to the same child; each assignment keeps its own result. `assistants` includes both running and finished children created through the delegator. Changing the returned Map or task snapshots does not change the delegator's records. The assistant instances themselves are live; use the delegator's methods for scheduled work to preserve accounting and concurrency checks.

For background coordination and UI integration:

```typescript
delegator.on('taskStarted', task => console.log('Started', task.id))
delegator.on('taskUpdated', task => {
  // The child instance is now available.
  const child = delegator.assistants.get(task.assistantId)
  child.on('chunk', text => process.stdout.write(text))
})
delegator.on('taskCompleted', task => console.log(task.status, task.id))

const task = delegator.startTask({ task: 'Inspect test coverage; make no changes.' })
const snapshot = await delegator.waitForTask(task.id, 10_000)
if (snapshot.status === 'running') {
  // Continue coordinator work, wait again later, or cancel obsolete work.
  delegator.cancelTask(task.id)
}
// On application shutdown or a change of plan:
delegator.cancelAll()
```

`taskCompleted` covers every terminal status, including errors and cancellations. Cancellation and timeout mark the task terminal immediately and request abort. A late result cannot overwrite that status, and the underlying work retains its slot until it actually settles. Named calls and ID-based follow-ups cannot overlap on the same child.

Forks use `history: 'none'` by default. Use a number for recent exchanges or `'full'` when necessary. A research batch must fit the currently available slots and remaining task budget; oversized batches are rejected before any child starts. Blank tasks and duplicate questions are rejected as well. `delegate`, `research`, `followUp`, and `synthesize` wait for terminal results; `startTask` returns immediately. Application code can still use the lower-level `assistant.createResearchJob()` API for custom workflows.

Synthesis consumes one task and one concurrency slot, just like a follow-up. Reserve budget for these steps. It receives immutable snapshots of the selected results, including task IDs, failures, and uncertainties, rather than re-running research or altering the parent's conversation. The guidance prompt tells it how to combine those sources; source text is explicitly treated as untrusted evidence. Select a coherent set of task IDs when the coordinator handles multiple projects. Combined source records default to a 100,000-character ceiling (`maxSynthesisChars`); oversized inputs are rejected rather than silently truncated. Task records and child instances live in memory for the parent instance's lifetime.

Limits are shared across delegator feature instances attached to the same parent. Reloading, reattaching, or changing conversation threads does not reset the lifetime task budget. Create a new parent assistant for a fresh budget. The first attachment sets the limits; reattaching cannot increase them. Failed and timed-out assignments consume budget. A timeout requests cancellation; work that ignores cancellation keeps its concurrency slot until it settles. Cached named specialists cannot run two delegated assignments at once.

Every assistant fork and named subagent has delegation disabled, even when created directly through the existing assistant APIs. Delegation tools and the prompt extension are excluded from children, and reloading or calling `.use()` again cannot restore them. The existing programmatic fork and research APIs remain available for application-authored workflows. This is a guard on the supplied delegation tools, not a sandbox for arbitrary code execution or custom tools.

Children share the container, workspace, and external services. Delegation does not provide filesystem isolation, grant new authorization, guarantee sources, or add web access. The parent must coordinate writes and verify the returned findings.

For a restricted tool surface, a filtered bundle also carries setup and guidance:

```typescript
assistant.use(container.feature('assistantDelegator').toTools({
  only: ['delegateTask', 'delegationStatus'],
}))
```

Create a fresh bundle for each assistant. A feature instance itself can be reused with multiple assistants; each gets independent bindings and its own budget.

With multiple attached parents, `assistants` and `tasks` aggregate their records for application code. Use `getAssistants(parent)` and `listTasks(parent)` for scoped access; pass the parent as the last argument to operational methods, such as `delegate(options, parent)` or `synthesize(options, parent)`. Omitting it is an error when more than one parent is attached. Model-facing tools always remain scoped to the parent that received them, and cannot read or operate on another parent's children.
