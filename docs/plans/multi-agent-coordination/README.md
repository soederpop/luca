# Multi-Agent Coordination for Luca

## The Pitch

CAMEL (NeurIPS 2023) proved that two or more LLM agents with distinct roles can autonomously collaborate through structured dialogue to solve tasks — without a human steering every turn. Their core insight: assign roles via "inception prompting", let agents talk to each other, and step back.

Luca already has 80% of the building blocks. The Expert system gives us identity-driven agents with skills, memory, and conversations. The Bus + IPC + WebSocket + MCP layers give us communication. The introspection system means agents can *discover each other's capabilities at runtime*. The Oracle proves agents can self-modify by generating and executing code.

What's missing is the **coordination layer** — the patterns and abstractions that let multiple Experts work together on a shared goal without stepping on each other, looping forever, or losing track of the mission.

This plan fills that gap by taking what CAMEL proved works, throwing out what doesn't apply (we're not a Python research framework), and building it native to Luca's container architecture.

## What We're Taking From CAMEL

| CAMEL Concept | Luca Translation | Status |
|---|---|---|
| Role-playing agents | Expert with Identity + Skills | Already built |
| Inception prompting (role guardrails) | System prompt conventions for multi-agent | Need to formalize |
| Structured message protocol | Bus events + typed message envelopes | Partially built |
| Task Specifier (vague → concrete) | A skill or pre-conversation step on an Expert | Needs building |
| Workforce coordinator | New `Coordinator` feature | Needs building |
| Task lifecycle (pending/active/done/failed) | New `Task` abstraction | Needs building |
| Termination conditions | Conversation-level + coordinator-level checks | Needs building |
| Memory across sessions | Expert memories.json exists, needs cross-agent memory | Partially built |

## What We're NOT Taking From CAMEL

- **Python-centric design** — we're JS/TS, runtime-first, not notebook-first
- **Hub-and-spoke only topology** — CAMEL's Workforce module funnels everything through a single coordinator. We want to support peer-to-peer too
- **Rigid User/Assistant role split** — CAMEL locks agents into "one instructs, one executes." We want flexible role dynamics where any agent can propose, challenge, or delegate
- **No real negotiation** — CAMEL agents don't argue or deliberate. We want agents that can disagree, present alternatives, and reach consensus

## What Luca Has That CAMEL Doesn't

- **Runtime introspection**: any agent can call `introspect()` on any other agent and learn its full API surface, state shape, available skills, and current status. CAMEL agents are black boxes to each other.
- **Self-modification via Oracle**: agents can write and execute code that creates new agents, modifies the container, starts servers. CAMEL agents can only call predefined tools.
- **Transport-agnostic communication**: IPC sockets for local, WebSockets for network, MCP for LLM-native tool exposure, Bus for in-process. CAMEL only has in-process message passing.
- **Observable state**: every Helper's state is reactive. Any agent can watch any other agent's state changes in real-time without polling. CAMEL has no equivalent.
- **Container composition**: the `.use()` pattern means you can compose different agent configurations declaratively. CAMEL requires imperative setup for each agent.

---

See the implementation documents in this folder:

1. [architecture.md](./architecture.md) — The coordination layer design
2. [task-system.md](./task-system.md) — Task lifecycle and dependency management
3. [topologies.md](./topologies.md) — Communication patterns between agents
4. [build-phases.md](./build-phases.md) — What to build and in what order
