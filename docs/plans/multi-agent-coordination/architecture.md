# Architecture: The Coordination Layer

## New Abstractions

### 1. `Crew` (extends Feature)

A Crew is a group of Experts working toward a shared goal. It's the Luca equivalent of CAMEL's "Society" or "Workforce" — but built on our container/feature primitives.

```ts
const crew = container.feature('crew', {
  name: 'research-team',
  topology: 'coordinated',     // or 'peer-to-peer', 'pipeline', 'debate'
  experts: ['researcher', 'analyst', 'writer'],
  goal: 'Produce a market analysis report on prediction markets',
  maxRounds: 50,               // termination: max conversation rounds across all agents
  terminateWhen: 'goal-met',   // or 'consensus', 'max-rounds', 'coordinator-decides'
})

await crew.start()
// crew orchestrates experts, decomposes tasks, monitors progress
// crew.state tracks overall mission status, task breakdown, agent assignments
```

**Why a Feature?** Because it gets all the Luca primitives for free — observable state, event bus, container attachment, factory caching, introspection. Two different Crews can coexist on the same container. External code (UI, Oracle, other Crews) can observe a Crew's progress via state changes and events.

**State shape:**
```ts
{
  status: 'idle' | 'planning' | 'executing' | 'reviewing' | 'completed' | 'failed',
  goal: string,
  tasks: Task[],
  assignments: Record<taskId, expertName>,
  round: number,
  results: Record<taskId, TaskResult>,
  transcript: Message[],   // full multi-agent conversation log
}
```

**Events:**
- `taskCreated`, `taskAssigned`, `taskCompleted`, `taskFailed`
- `roundStarted`, `roundCompleted`
- `agentMessage` (any agent speaks)
- `goalMet`, `terminated`

### 2. `Task` (plain object / Zod schema, not a Helper)

Tasks are data, not runtime objects. They live in the Crew's state.

```ts
interface Task {
  id: string
  description: string
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'failed' | 'blocked'
  assignedTo?: string           // expert name
  dependencies?: string[]       // task IDs that must complete first
  result?: any
  createdBy: 'coordinator' | string  // who created this task
  priority: number
  maxAttempts: number
  attempts: number
}
```

Tasks are NOT a separate Feature or Helper — they're just typed objects managed by the Crew's state. This keeps things simple. If we need a standalone task system later, we can extract it.

### 3. `Protocol` (convention, not a class)

A Protocol defines how agents in a Crew communicate. It's a set of rules encoded in each Expert's system prompt and enforced by the Crew.

Examples:
- **Coordinated**: one Expert acts as coordinator, others are workers. Coordinator decomposes, assigns, reviews.
- **Peer-to-peer**: all Experts are equals. They take turns, can propose tasks, challenge each other's work.
- **Pipeline**: output of Expert A feeds into Expert B feeds into Expert C. Linear workflow.
- **Debate**: Experts argue opposing positions. A judge Expert (or the coordinator) synthesizes a conclusion.

Protocols are implemented as system prompt templates + Crew-level logic for turn management and message routing.

## How It Plugs Into Existing Luca

```
Container
├── features
│   ├── expert('researcher')     ← already exists
│   ├── expert('analyst')        ← already exists
│   ├── expert('writer')         ← already exists
│   ├── crew('research-team')    ← NEW: coordinates the above experts
│   └── ... other features
├── clients
│   └── openai                   ← already exists, shared by all experts
├── servers
│   ├── express                  ← could serve a crew dashboard
│   └── websocket                ← could broadcast crew events to a UI
└── state                        ← container-level state, crews add their state here too
```

The Crew feature has a reference to the container, so it can:
- Spin up Expert instances via `container.feature('expert', { ... })`
- Watch Expert state changes via `expert.state.observe()`
- Route messages between Experts via their Conversation features
- Use the container's OpenAI client for its own reasoning (coordinator LLM calls)
- Expose its progress via its own state + events

## The Coordinator Pattern

In `coordinated` topology, the Crew itself acts as the coordinator. It has its own Conversation (backed by the container's OpenAI client) that handles:

1. **Task decomposition**: given the goal, break it into subtasks
2. **Assignment**: given available experts (discovered via introspection), assign subtasks to the best expert
3. **Monitoring**: watch expert state, intervene if stuck or failed
4. **Aggregation**: collect results, synthesize final output
5. **Termination**: decide when the goal is met

The coordinator's system prompt includes:
- The goal
- The list of available experts with their capabilities (from `expert.introspectAsText()`)
- The current task board (from crew state)
- Rules about delegation, review, and termination

This is where Luca's introspection pays off massively. The coordinator doesn't need hardcoded knowledge of what each expert can do — it discovers capabilities at runtime. Add a new expert to the crew, the coordinator automatically knows what it can do.

## Cross-Process Coordination

Everything above works in a single process. For multi-process coordination:

**Option A: IPC Socket relay**
The Crew listens on an IPC socket. Remote Experts connect as clients. Messages are relayed through the socket with the same event structure. The Crew doesn't care whether an Expert is local (in-process via Bus) or remote (via IPC) — the message interface is the same.

**Option B: WebSocket relay**
Same pattern but over the network. A Crew on machine A can coordinate Experts on machines B and C.

**Option C: MCP bridge**
Each Expert exposes its skills as MCP tools. The Crew's coordinator can invoke remote experts through MCP. This is particularly interesting because it means a Claude Code session could participate as an Expert in a Crew.

The transport abstraction should be built into the Crew feature so the topology is transport-agnostic. A `RemoteExpert` adapter wraps IPC/WS/MCP connections and presents the same interface as a local Expert.
