# Task System

## Overview

Tasks are the unit of work in a Crew. They're plain data objects stored in the Crew's observable state — not runtime objects, not Helpers. This keeps them simple, serializable, and introspectable.

## Task Schema

```ts
import { z } from 'zod'

const TaskStatus = z.enum([
  'pending',      // created, not yet assigned
  'assigned',     // assigned to an expert, not yet started
  'in-progress',  // expert is actively working on it
  'completed',    // done, result available
  'failed',       // expert couldn't complete it
  'blocked',      // waiting on dependencies
])

const TaskSchema = z.object({
  id: z.string(),
  description: z.string(),
  status: TaskStatus,
  assignedTo: z.string().optional(),
  dependencies: z.array(z.string()).default([]),
  result: z.any().optional(),
  error: z.string().optional(),
  createdBy: z.string(),            // 'coordinator' or expert name
  priority: z.number().default(0),  // higher = more urgent
  maxAttempts: z.number().default(3),
  attempts: z.number().default(0),
  metadata: z.record(z.any()).default({}),
  createdAt: z.number(),
  completedAt: z.number().optional(),
})
```

## Task Lifecycle

```
                    ┌──────────────────┐
                    │     pending      │
                    └────────┬─────────┘
                             │ assign()
                    ┌────────▼─────────┐
           ┌────── │    assigned       │
           │        └────────┬─────────┘
           │                 │ expert picks it up
           │        ┌────────▼─────────┐
           │        │   in-progress    │ ◄──── retry (attempts < maxAttempts)
           │        └───┬─────────┬────┘            │
           │            │         │                  │
           │     success│         │failure           │
           │    ┌───────▼──┐  ┌──▼──────────┐       │
           │    │ completed │  │   failed    │ ──────┘
           │    └──────────┘  └─────────────┘
           │
    dependencies
    not met  │
           │        ┌──────────────────┐
           └──────► │    blocked       │ ── dependencies met ──► pending
                    └──────────────────┘
```

## Dependency Resolution

Tasks can declare dependencies on other tasks by ID. The Crew manages the dependency graph:

```ts
// Example: research must complete before analysis, analysis before writing
const tasks = [
  { id: 'research',  description: 'Research prediction market data sources', dependencies: [] },
  { id: 'analyze',   description: 'Analyze market patterns from research data', dependencies: ['research'] },
  { id: 'write',     description: 'Write the final report', dependencies: ['analyze'] },
]
```

When a task completes, the Crew checks all `blocked` tasks. Any task whose dependencies are now all `completed` transitions to `pending` and becomes eligible for assignment.

Circular dependencies are detected at creation time and rejected.

## Task Decomposition

The coordinator can decompose a high-level goal into tasks in two ways:

**LLM-driven decomposition:**
The coordinator's Conversation generates a task breakdown. The system prompt includes the goal, available expert capabilities (via introspection), and instructions to produce a structured task list. The Crew parses the LLM output and creates Task objects.

**Expert-initiated decomposition:**
Any expert can propose new subtasks during execution. When an expert realizes its task is too broad, it emits a `proposeTask` event. The Crew (or coordinator) reviews and accepts/rejects the proposed tasks.

## Task Assignment

Assignment strategy depends on the topology:

**Coordinated:** The coordinator LLM decides assignments based on:
- Expert capabilities (from introspection)
- Expert current load (how many in-progress tasks)
- Task requirements (semantic match between task description and expert skills)
- Past performance (if tracked)

**Peer-to-peer:** Experts claim tasks from a shared pool. First to claim gets it. Conflicts resolved by priority or coordinator tiebreak.

**Pipeline:** Assignment is implicit — tasks flow through experts in order.

## Result Propagation

When a task completes, its `result` field is populated. Downstream tasks (those that depend on it) receive the results of their dependencies in their assignment context. The expert working on a downstream task gets the results of all dependency tasks in its conversation context.

```ts
// When assigning 'analyze' task to the analyst expert:
const dependencyResults = task.dependencies.map(depId => ({
  taskId: depId,
  result: crew.state.get('tasks').find(t => t.id === depId).result,
}))
// These get injected into the analyst's conversation as context
```

## Failure Handling

When a task fails:
1. Increment `attempts`
2. If `attempts < maxAttempts`: reset to `pending`, re-eligible for assignment (possibly to a different expert)
3. If `attempts >= maxAttempts`: mark as permanently `failed`, notify coordinator
4. Coordinator decides: decompose differently, assign to different expert, or escalate (ask human / abort crew)

The Crew emits `taskFailed` events so external systems (UI, monitoring, human operators) can intervene.
