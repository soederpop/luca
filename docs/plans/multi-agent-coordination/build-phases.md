# Build Phases

## Phase 1: Task Abstraction + Single-Process Coordinated Crew

**Goal:** Get two Experts collaborating on a shared goal within one process, managed by a Crew with coordinator logic.

**Build:**
- [ ] `Task` Zod schema and utility functions (create, transition, dependency resolution)
- [ ] `Crew` Feature class with:
  - Observable state (goal, tasks, assignments, status, transcript)
  - Events (taskCreated, taskAssigned, taskCompleted, agentMessage, goalMet, etc.)
  - Coordinator Conversation (uses container's OpenAI client)
  - Basic `start()` flow: decompose goal → assign tasks → monitor → aggregate
- [ ] `Protocol` interface + `CoordinatedProtocol` implementation
  - System prompt generation for coordinator role
  - Turn management (coordinator first, then workers)
  - Message routing (all through coordinator)
  - Termination checking (coordinator decides or max rounds)
- [ ] System prompt conventions for multi-agent (anti-role-flip, anti-loop guardrails inspired by CAMEL's inception prompting)
- [ ] Wire up Expert event listening so Crew can observe expert progress

**Demo:**
A `researcher` Expert and a `writer` Expert collaborate to produce a document. The Crew decomposes "write a technical brief on X" into research tasks and writing tasks, assigns them, and produces a final output.

**Acceptance:**
- Crew successfully decomposes a goal into 2+ tasks
- Tasks assigned to appropriate experts based on introspected capabilities
- Experts execute tasks and report results
- Crew aggregates results into a final output
- The whole thing terminates cleanly (no infinite loops)

---

## Phase 2: Peer-to-Peer + Pipeline Topologies

**Goal:** Support non-hierarchical coordination patterns.

**Build:**
- [ ] `PeerToPeerProtocol` implementation
  - Round-robin turn management
  - Broadcast message routing
  - Consensus-based termination
- [ ] `PipelineProtocol` implementation
  - Sequential turn management
  - Forward-only message routing (with optional reject/backtrack)
  - Completion-of-last-stage termination
- [ ] Crew refactored to be topology-agnostic (delegates to Protocol for all coordination decisions)
- [ ] Expert-initiated task proposals (experts can suggest new subtasks to the Crew)

**Demo:**
- Peer-to-peer: three Experts brainstorm and iterate on a design document
- Pipeline: data collector → data processor → report generator

**Acceptance:**
- Both topologies work without modifying Expert code
- Switching topology is a single option on the Crew
- Experts can propose subtasks in peer-to-peer mode

---

## Phase 3: Debate Topology + Cross-Expert Memory

**Goal:** Adversarial collaboration and shared knowledge.

**Build:**
- [ ] `DebateProtocol` implementation
  - Position assignment via system prompts
  - Alternating turns between debaters
  - Judge evaluation and decision rendering
- [ ] Shared memory layer
  - A `CrewMemory` that all experts in a Crew can read/write
  - Backed by the Crew's state (so it's observable and introspectable)
  - Experts can publish findings, read other experts' findings
  - Distinct from individual Expert memories (which remain private)

**Demo:**
Two Experts debate whether to use WebSockets vs SSE for a real-time feature. A judge Expert evaluates arguments and picks a winner with rationale.

**Acceptance:**
- Debate produces structured arguments from both sides
- Judge renders a decision with clear reasoning
- Shared memory allows experts to build on each other's research

---

## Phase 4: Cross-Process Coordination

**Goal:** Crews that span multiple processes or machines.

**Build:**
- [ ] `RemoteExpert` adapter
  - Wraps IPC Socket, WebSocket, or MCP connections
  - Presents the same interface as a local Expert to the Crew
  - Handles serialization/deserialization of messages and state
- [ ] Discovery protocol
  - Experts announce themselves on connection (identity, capabilities via introspect)
  - Crew maintains a registry of available remote experts
- [ ] Crew transport abstraction
  - Message routing works identically for local and remote experts
  - Crew doesn't need to know or care about the transport layer
- [ ] MCP bridge
  - Expert skills exposed as MCP tools
  - A Claude Code session could join a Crew as an Expert

**Demo:**
A Crew running in process A coordinates with an Expert in process B (via IPC) and an Expert exposed as an MCP server.

**Acceptance:**
- Remote experts participate in Crews transparently
- Transport failures handled gracefully (retry, reassign task)
- MCP-based expert works with Claude Code or any MCP client

---

## Phase 5: Swarm Topology + Self-Organizing Crews

**Goal:** Dynamic agent spawning and autonomous team composition.

**Build:**
- [ ] `SwarmProtocol` implementation
  - Experts can request new expert spawning
  - Dynamic system prompt generation for spawned experts
  - Resource limits (max agents, max total tokens)
  - Automatic deactivation of idle experts
- [ ] Self-organizing mode
  - Given a goal, the Crew decides what experts it needs
  - Generates Expert identities + system prompts dynamically
  - Uses the `scripts/scaffold` pattern or runtime Expert creation
- [ ] Crew-to-Crew coordination
  - A Crew can delegate a sub-goal to another Crew
  - Nested Crews with result propagation back to parent

**Demo:**
Give a Crew a broad research goal. It spawns specialized experts as needed, each expert spawns sub-experts for deep dives, results bubble up through the hierarchy.

**Acceptance:**
- Crew dynamically creates experts based on discovered needs
- Resource limits prevent runaway spawning
- Results from spawned experts integrate into parent Crew's output
- Nested Crews work with clear parent-child relationships

---

## Phase 6: Dashboard + Observability

**Goal:** Watch it all happen in real-time.

**Build:**
- [ ] Express server endpoint that serves a Crew dashboard
- [ ] WebSocket broadcast of all Crew events
- [ ] UI showing:
  - Task board (kanban-style: pending → assigned → in-progress → completed)
  - Agent status cards (identity, current task, token usage)
  - Conversation transcript (who said what to whom)
  - Topology visualization (which agents are connected, message flow)
  - Timeline view (when tasks were created, assigned, completed)
- [ ] Oracle integration: observe and interact with running Crews from the REPL

**Acceptance:**
- Real-time visibility into a running Crew
- Can see task flow, agent conversations, and overall progress
- Oracle can query Crew state and intervene manually
