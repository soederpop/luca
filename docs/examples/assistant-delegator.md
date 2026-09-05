# Assistant delegation

`assistantDelegator` opts an assistant into bounded delegation. It adds tool descriptions that explain when to fork, select a specialist, or research questions in parallel, plus a system prompt extension about task scope, evidence, shared writes, and authorization.

```typescript
import container from 'luca/agi'

const assistant = container.feature('assistant', {
  systemPrompt: 'Help investigate and improve this project.',
})

assistant.use(container.feature('assistantDelegator', {
  maxConcurrent: 3,
  maxTasks: 12,
  timeoutMs: 120_000,
  maxToolTurns: 15,
  // Optional: restrict named specialists discovered by assistantsManager.
  // allowedAgents: ['researcher', 'reviewer'],
}))
```

The assistant receives four tools:

- `delegateTask({ task, agent?, history? })` runs one assignment and returns `{ task, status, result?, error? }`. Omitting `agent` forks the current assistant. A named agent uses `assistant.subagent()` and retains that specialist's conversation between assignments. `history` applies to forks only.
- `researchTasks({ questions, context?, history? })` runs independent questions on parallel forks and returns results in question order. Individual failures do not discard successful answers.
- `listDelegationAgents({})` lists permitted specialist names from `assistantsManager`.
- `delegationStatus({})` reports active children, available slots, tasks used, and the remaining task budget.

Forks use `history: 'none'` by default. Use a number for recent exchanges or `'full'` when necessary. A research batch must fit the currently available slots and remaining task budget; oversized batches are rejected before any child starts. Blank tasks and duplicate questions are rejected as well. These tools wait for their results; application code can still use `assistant.createResearchJob()` when it needs an observable background job.

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
