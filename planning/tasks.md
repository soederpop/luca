# Tasks

What to do next, in priority order. These are the Phase 0 tasks — the minimum to get a living system running.

---

## Immediate (Do Now)

### 1. Create the bootstrapper identity
**Files**: `identities/bootstrapper/SYSTEM-PROMPT.md`, `identities/bootstrapper/memories.json`

The root identity that tells Luca what it is. The system prompt should cover:
- Who/what Luca is (self-programming AGI framework)
- The script-first principle (write TypeScript, execute in VM, read result)
- Awareness of its own architecture (container, features, registries)
- How to introspect itself to discover capabilities
- How to create new features when needed
- Tone and personality

Seed memories:
- Biographical: "I am Luca, a self-programming AGI..."
- Procedural: "To discover my capabilities, call this.introspect()"
- Procedural: "To execute code, use the VM feature"
- Longterm-goal: "Grow my capabilities by writing and registering new features"

### 2. Implement memory persistence in Identity feature
**File**: `src/agi/features/identity.ts`

Currently loads from disk but never writes back. Add:
- `addMemory(type, content)` — append a new memory and save
- `removeMemory(id)` — remove by id and save
- `save()` — write memories.json to disk
- Basic dedup: don't add exact duplicate content

### 3. Create the AGI entrypoint / startup script
**File**: `src/agi/main.ts` or `scripts/start.ts`

A script that:
- Creates the AGIContainer
- Loads the bootstrapper identity
- Runs introspection to populate feature docs
- Starts a conversation loop (stdin/stdout or via Conversation feature)
- This is `bun run start` — the "turn it on" command

Add to package.json scripts: `"start": "bun run src/agi/main.ts"`

### 4. Fix the packageon typo
**File**: `src/node/container.ts:199`

Quick fix: `"packageon"` → `"package.json"`

---

## Next Up (After Immediate)

### 5. Wire introspection into startup
When the AGI boots, it should automatically load its own feature documentation into context. ContainerChat already does this — make sure the startup sequence calls it so Luca can answer "what can I do?" on first message.

### 6. Implement the Coordinator stub
**File**: `src/agi/features/coordinator.ts`

Start simple:
- Accept a goal as natural language
- Use ContainerChat to decompose into subtasks
- Dispatch subtasks to experts
- Collect and merge results

### 7. Add integration tests for core
**Dir**: `tests/`

Priority test targets:
- Container creation and feature registration
- State management (set, get, observe)
- VM code execution
- Introspection data accuracy
- Identity load/save round-trip

### 8. Conversation improvements
**File**: `src/agi/features/conversation.ts`

- Add conversation persistence (save/load chat history)
- Add system prompt injection from identity
- Add memory context injection (relevant memories for current topic)

---

## Backlog

### 9. Dynamic feature creation at runtime
Let Luca write a Feature class as a string, validate it, register it in the VM, and persist to disk. This is the core of "self-programming."

### 10. Expert self-creation
When the coordinator can't find an expert for a task, it should be able to generate a new expert (system prompt + skills + memories).

### 11. Regenerate introspection data
Run `bun run introspect` to make sure generated.ts is current with all features, especially the AGI ones.

### 12. Zod migration — decide and proceed
Either commit to the gradual adapter pattern or shelve it. The current partial state adds confusion without benefit.

### 13. Web research capability
Wire the crawler features into the AGI layer so Luca can search the web, read pages, and synthesize information when asked questions it doesn't know.
