# AGI Features - Theoretical Use Cases

Use cases for the features in `src/agi/features/` — ClaudeCode, Conversation, Expert, Identity, ContainerChat, HelperChat, Snippets, and the Planner stub.

---

## Self-Healing / Self-Modifying Systems

### 1. Auto-Bug-Fix Pipeline
A running Luca container detects an error (via event bus), fires up a `ClaudeCode` session with context about the error, and Claude CLI fixes the code in-place. The container reloads the affected feature. Zero human intervention.

### 2. Runtime Feature Generation
An `Expert` with a coding identity receives a high-level request ("I need a Stripe client"), uses `ContainerChat` to understand what's already available, generates the boilerplate via `ClaudeCode`, and the container hot-loads it. The system literally grows new capabilities on demand.

### 3. Adaptive Retry Logic
When a `Client` fails repeatedly, a `Conversation` instance analyzes the error patterns, generates a patched version of the client code via `Snippets`, and proposes or applies the fix. The system evolves its own resilience.

---

## Multi-Agent Collaboration

### 4. Expert Panel / Debate
Spin up multiple `Expert` instances with different identities (e.g., "Security Auditor", "Performance Engineer", "UX Designer"). Route a question to all of them, collect responses, and have a final `Conversation` synthesize the best answer. Cheap ensemble reasoning.

### 5. Agent-to-Agent Delegation
An `Expert` working on a complex task uses `ClaudeCode` as a sub-agent for heavy lifting (file edits, test runs) while the Expert handles the conversational/planning layer. The Expert is the brain; ClaudeCode is the hands.

### 6. Cross-Container Communication
Per the CLAUDE.md vision: two Luca containers on different machines, each with their own `Expert`, communicating over the event bus. One container specializes in frontend, the other in backend. They negotiate API contracts between them.

---

## Developer Productivity / REPL

### 7. "Ask My Codebase" Interface
`ContainerChat` already introspects features. Extend this: a developer in the REPL types `container.chat.ask("how do I add auth to the API server?")` and gets a contextual answer that references actual features, clients, and servers registered in their running container.

### 8. Living Documentation
`HelperChat` instances for every registered helper, auto-generating documentation from introspection. Run it on a schedule or on-demand. The docs are always current because they're derived from the running code, not static markdown.

### 9. Snippet Library as Institutional Memory
Teams use `Snippets` to capture patterns, solutions, and idioms. An `Expert` can `searchSnippets` before writing new code, ensuring consistency and avoiding reinvention. Over time, the snippet library becomes the team's collective knowledge.

---

## Autonomous Operations / DevOps

### 10. Self-Deploying Applications
A `ClaudeCode` session runs deployment scripts, monitors the output via NDJSON events, and if something fails, another session is spawned to diagnose and fix the deployment. The `Identity` feature maintains memory of past deployment issues.

### 11. Incident Response Agent
An `Expert` with an "SRE" identity monitors server health. When alerts fire, it uses `ClaudeCode` to investigate logs, `Conversation` to reason about root cause, and `Snippets` to find known remediation patterns. It remembers past incidents via `Identity.remember()`.

### 12. Infrastructure as Conversation
Instead of writing Terraform or Dockerfiles, describe what you want to an `Expert`. It generates the infrastructure code, validates it via `ClaudeCode`, and stores the patterns in `Snippets` for reuse.

---

## Learning / Education

### 13. Personalized Coding Tutor
An `Expert` with a "Teacher" identity uses `HelperChat` to explain any part of the Luca framework to a student. It remembers (via `Identity`) what the student has already learned, adapting its explanations over time.

### 14. Interactive Architecture Explorer
A new developer joins a project. They use `ContainerChat` to explore the full dependency graph, ask "what events does the auth feature emit?", and get live answers from introspection rather than stale docs.

---

## The Meta Use Case

### 15. The Planner
The natural next step for the empty `planner.ts` stub: a feature that takes a high-level goal, uses `ContainerChat` to understand current capabilities, identifies gaps, spins up `ClaudeCode` sessions to fill those gaps, coordinates via `Conversation`, and stores learnings in `Identity`. An orchestrator that turns "I want X" into a self-executing plan across all the other features.

---

## Common Thread

These features form a **cognitive stack**:
- `Identity` is memory
- `Conversation` is reasoning
- `ClaudeCode` is action
- `Snippets` is knowledge
- `ContainerChat` / `HelperChat` are self-awareness
- `Expert` ties them together into an agent

That's a surprisingly complete architecture for autonomous software agents.
