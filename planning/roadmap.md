# Luca Roadmap

## Current State

The core framework is solid: Container architecture, 26 node features, introspection system, MCP server, VM execution, and individual AGI features (Conversation, ClaudeCode, Expert, Identity) all work. What's missing is the glue that turns these parts into a living system.

## Phase 0 — Root Process (Current)

**Goal**: A running AGI container that boots with a root identity, can converse, execute code against its own features, and persist what it learns.

### 0.1 Root Identity Bootstrap
- Create `identities/bootstrapper/` with system prompt and seed memories
- The bootstrapper is Luca's starting self — it knows the architecture, the script-first principle, and its own capabilities
- Seed memories: biographical (what am I), procedural (how to use features), longterm-goals (grow, learn, build)

### 0.2 Memory Persistence
- Identity feature currently loads but never saves
- Add `saveMemory()` and `deleteMemory()` to Identity
- Write memories.json back to disk on change
- Add memory deduplication and pruning (prevent unbounded growth)

### 0.3 Startup Entrypoint
- Create a `src/agi/main.ts` (or similar) that boots the AGIContainer with the bootstrapper identity
- Wire up a REPL or conversation loop so you can talk to it
- This is the "turn it on" moment

### 0.4 Self-Introspection Loop
- On boot, Luca introspects its own features and loads the docs
- ContainerChat already does this — wire it into the startup sequence
- Luca should be able to answer "what can you do?" from its own introspection data

---

## Phase 1 — Self-Programming

**Goal**: Luca can write, register, and use new Features at runtime without a restart.

### 1.1 Dynamic Feature Registration
- VM already executes TypeScript — extend it to `features.register()` at runtime
- Hot-load a feature from a code string, register it, make it available
- Persist new features to disk so they survive restarts

### 1.2 Code Generation Pipeline
- ContainerChat generates snippets — extend to generate full Feature classes
- Validate generated features against the Feature pattern (state, options, JSDoc, registration)
- Test in VM before registering

### 1.3 Feature Catalog
- Track which features were human-authored vs self-authored
- Version history for self-authored features
- Rollback capability

---

## Phase 2 — Multi-Agent Coordination

**Goal**: Multiple expert agents working together, coordinated by the root process.

### 2.1 Coordinator Feature
- `coordinator.ts` is currently an empty stub — implement it
- Task decomposition: break a goal into subtasks, assign to experts
- Result aggregation: collect expert outputs, synthesize

### 2.2 Expert Communication
- Experts need to talk to each other, not just to the coordinator
- Shared context/memory between experts on a task
- IPC between expert processes (ipcSocket feature exists)

### 2.3 Expert Self-Creation
- When no existing expert fits a task, create a new one
- Generate system prompt, seed memories, and skills for the new expert
- Register it in the experts/ folder

---

## Phase 3 — External World

**Goal**: Luca can interact with the outside world — web, APIs, services.

### 3.1 Web Interaction
- Crawler features exist (puppeteer, cheerio) — wire into AGI layer
- Let Luca browse, read, and extract information from the web
- Research capability: given a question, search and synthesize

### 3.2 API Integration Framework
- RestClient base exists — build a pattern for self-configuring API clients
- Given API docs, generate a typed client
- OAuth/auth flow management

### 3.3 Service Deployment
- Docker feature exists — use it to deploy services Luca builds
- RunPod for GPU workloads
- Self-hosted endpoints

---

## Phase 4 — Persistence and Long-Term Growth

**Goal**: Luca maintains state across sessions and grows over time.

### 4.1 Structured Knowledge Base
- Beyond flat memories.json — graph or indexed storage
- Semantic search over memories
- Episodic memory (what happened, when, what was learned)

### 4.2 Goal Management
- Track longterm and shortterm goals
- Break goals into actionable plans
- Self-evaluate progress

### 4.3 Learning from Interaction
- Extract procedural knowledge from conversations
- Pattern recognition: "I keep doing X, I should automate it"
- Capability self-assessment

---

## Non-Phase Work (Ongoing)

### Testing
- Zero test coverage currently — need at least integration tests for core features
- Test the container lifecycle, feature registration, state management
- Test introspection output

### Bug Fixes
- `src/node/container.ts:199` — typo "packageon" should be "package.json"

### Zod Migration
- Foundation laid but stalled on type complexity
- Gradual adapter pattern recommended over full rewrite
- Not blocking — revisit when stabilized
