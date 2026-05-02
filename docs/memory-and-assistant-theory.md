# Memory and Assistant Theory

Luca's memory system should preserve Luca's core product philosophy: Luca is like Legos.

The building blocks should be intentional, composable, and useful on their own. Composition should be encouraged. The generic memory feature should not bake in one assistant shape, one storage model, or one theory of what an assistant is.

Hermes has excellent ultimate behavior, especially around curated long-term memory, bounded prompt injection, and explicit add/replace/remove semantics. But Hermes' behavior should be treated as one strong composition, not as the definition of memory itself.

Not every assistant with memory is a `chiefOfStaff` assistant.

## The central distinction

Do not make `memory` mean "Hermes memory."

Make Luca expose memory as composable building blocks, then provide Hermes-like behavior as an optional preset/composition.

The generic feature should be small, neutral, and lower-level. Opinionated behavior should live in adapters, profiles, policies, toolsets, and presets that assistants can opt into.

A rough shape:

```text
memory
  ├─ stores
  │   ├─ entryStore        plain bounded entries
  │   ├─ documentStore     markdown/contentDb-backed docs
  │   ├─ vectorStore       semantic search / embeddings
  │   ├─ sessionStore      conversation history
  │   └─ todoStore         checklist/task-ish memory
  │
  ├─ policies
  │   ├─ bounded           char/token budgets
  │   ├─ curated           add/replace/remove only
  │   ├─ semantic          embed + recall
  │   ├─ ephemeral         session-only
  │   ├─ injected          appears in prompt
  │   ├─ searchable        retrieved on demand
  │   └─ securePrompt      injection scan, delimiter escaping
  │
  ├─ renderers
  │   ├─ promptBlock
  │   ├─ contextBlock
  │   ├─ markdown
  │   ├─ json
  │   └─ summary
  │
  ├─ tools
  │   ├─ memory
  │   ├─ remember
  │   ├─ recall
  │   ├─ searchMemory
  │   ├─ updateMemory
  │   └─ listMemory
  │
  └─ presets
      ├─ hermesCurated
      ├─ chiefOfStaff
      ├─ semanticNotebook
      ├─ projectArchivist
      ├─ characterMemory
      └─ sessionRecall
```

The important move is to separate:

- storage
- retrieval
- prompt injection
- rendering
- write policy
- assistant lifecycle integration
- tool interface

Those are different concerns. Hermes combines a specific set of these concerns very well. Luca should let assistants compose them deliberately.

## Memory is a pipeline

Memory is not one behavior. Memory is a pipeline:

```text
observe → decide → store → retrieve → render → inject/use
```

Different assistants need different pipelines.

Hermes is one very good pipeline:

```text
manual/agent decision
→ bounded markdown entry stores
→ frozen prompt render
→ add/replace/remove tool
→ session_search for archive
```

A `chiefOfStaff` assistant is a richer pipeline:

```text
curated identity memory
+ user profile
+ operational todos
+ contentbase artifacts
+ project/status selectors
+ archive/session recall
+ docs-scoped writing
```

A research assistant may need searchable documents but no always-injected identity memory.

A coding assistant may need project conventions, previous debugging history, and procedural skills.

A roleplay assistant may need relationship continuity and episodic recall.

A customer support assistant may need customer profile, case history, and policy documents.

These are all memory, but they should not all inherit the same opinionated behavior.

## Memory modes

Luca should document a small vocabulary of memory modes. These are conceptual categories, not necessarily separate features.

### 1. Core memory

Always injected. Small. Curated. High signal. High stakes.

Examples:

- user profile
- assistant identity
- hard operating constraints
- project conventions
- durable preferences

Hermes' `MEMORY` and `USER` blocks are core memory.

### 2. Working memory

Session-local or short-lived. Useful during the current task, plan, or conversation.

Examples:

- current objective
- active plan
- current TODO checklist
- intermediate findings
- temporary state

Working memory may be summarized, replaced, or dropped.

### 3. Episodic memory

Past events and interactions. Usually searched on demand rather than always injected.

Examples:

- previous conversations
- status reports
- completed tasks
- historical decisions
- "what did we do last time?" recall

Hermes' `session_search` is a good example of episodic recall.

### 4. Knowledge memory

Reference material, documents, facts, and artifacts.

Examples:

- project docs
- research reports
- policies
- design docs
- meeting notes
- corpus documents

This fits naturally with `contentDb`, file-backed documents, and semantic search.

### 5. Procedural memory

Reusable workflows and skills.

Examples:

- skills
- playbooks
- command recipes
- debugging procedures
- assistant operating procedures

This should often be represented as skills or structured docs rather than generic "facts."

## Generic memory should be boring

The generic `memory` feature should not automatically:

- inject `MEMORY` and `USER` blocks
- force `memory`/`user` targets
- enforce Hermes-specific save/skip policy
- store in a fixed global `~/.luca/memories` directory
- assume every assistant has a user profile
- assume every memory is prompt-safe
- assume every memory should be semantic
- assume every assistant wants `remember` and `recall` tools

Those are preset/policy choices.

The default `container.feature('memory')` should be a toolkit. It should expose neutral primitives for creating stores, rendering memory, attaching memory to assistant lifecycles, and generating tools.

A minimal generic API might look like:

```ts
const memory = container.feature('memory', { namespace: 'default' })

await memory.add('some-store', entry)
await memory.search('some-store', query)
await memory.render('some-store', renderer)
assistant.use(memory.attach(...))
```

No prompt injection should happen unless an assistant explicitly attaches an injection layer.

No tools should appear unless the assistant explicitly uses a toolset.

## Core primitive: MemoryStore

A `MemoryStore` is storage only. It should not imply how memory is injected, searched, or exposed as tools.

```ts
interface MemoryStore<T = any> {
  id: string
  kind: string

  read(query?: any): Promise<T>
  write(entry: T, options?: any): Promise<any>
  update(ref: any, patch: any): Promise<any>
  delete(ref: any): Promise<any>

  list?(options?: any): Promise<T[]>
  search?(query: string, options?: any): Promise<any[]>
  stats?(): Promise<MemoryStoreStats>
}
```

Potential store implementations:

```text
EntryMemoryStore          bounded delimiter-separated entries
MarkdownMemoryStore       one markdown file
ContentDbMemoryStore      structured docs folder / contentDb-backed memory
SemanticMemoryStore       vector/FTS index
ConversationMemoryStore   conversation-history-backed episodic memory
TodoMemoryStore           checklist-focused operational memory
```

The existing Luca vector/category memory can become a `SemanticMemoryStore` rather than the generic definition of memory.

## Core primitive: MemoryPolicy

A `MemoryPolicy` decides what is allowed, preferred, transformed, or rejected.

```ts
interface MemoryPolicy {
  beforeWrite?(ctx): Promise<void | MemoryPolicyResult>
  afterWrite?(ctx): Promise<void>
  beforeInject?(ctx): Promise<string>
  shouldSave?(ctx): boolean | Promise<boolean>
}
```

Useful policies:

```text
boundedChars(limit)
dedupeExact()
dedupeSemantic(threshold)
promptInjectionScan()
requireUserApproval()
noTaskProgress()
stableFactsOnly()
projectScoped()
assistantScoped()
```

Hermes-like discipline belongs here as composable policy, not as a hardcoded assumption in the generic memory feature.

## Core primitive: MemoryRenderer

A `MemoryRenderer` turns stored memory into prompt/context/tool output.

```ts
interface MemoryRenderer {
  render(store: MemoryStore, options?: any): Promise<string>
}
```

Potential renderers:

```text
hermesPromptBlock
markdownSections
jsonSummary
memoryContextFence
todoList
```

Hermes-style prompt rendering should be a renderer. It should not be the memory system itself.

## Core primitive: MemoryToolset

Tool surfaces should be composable too.

Examples:

```ts
memory.tools('curated', {
  stores: { memory, user },
  actions: ['add', 'replace', 'remove'],
})
```

Possible toolsets:

```text
curatedTools
  memory(action, target, content, old_text)

semanticTools
  remember(category, text, metadata)
  recall(category, query)

documentTools
  readMemoryDoc(id)
  writeMemoryDoc(id, content)
  searchMemoryDocs(query)

todoTools
  listTodos()
  addTodo()
  completeTodo()

sessionSearchTools
  sessionSearch(query?)
```

This avoids forcing every assistant to use Hermes' exact tool API.

## Core primitive: MemoryAttachment

A `MemoryAttachment` integrates memory into the assistant lifecycle.

It should define how memory participates in:

- system prompt formatting
- frozen prompt snapshots
- pre-turn retrieval
- post-turn sync
- session end summarization
- tool registration

Conceptually:

```ts
assistant.use(memory.attach({
  prompt: [
    memory.inject(storeA, rendererA),
    memory.inject(storeB, rendererB),
  ],
  prefetch: [
    memory.prefetch(semanticArchive, { topK: 5 }),
  ],
  sync: [
    memory.syncTurns(conversationStore),
  ],
  tools: [
    memory.tools('curated', ...),
    memory.tools('semantic', ...),
  ],
}))
```

This is probably the most Luca-ish piece: memory is a set of layers attached to an assistant.

## Possible Luca-feeling API

A fluent builder might feel natural:

```ts
const memory = container.feature('memory')

const profile = memory.entries('user', {
  path: 'docs/memories/USER.md',
  limit: 1375,
})

const notes = memory.entries('self', {
  path: 'docs/memories/SELF.md',
  limit: 2200,
})

assistant.use(
  memory.layer('curated-profile')
    .store('user', profile)
    .store('memory', notes)
    .policy(memory.policies.promptSafe())
    .policy(memory.policies.bounded())
    .inject(memory.renderers.hermesBlock())
    .tools(memory.toolsets.curated())
)
```

A config-oriented API would be useful for presets and simple assistants:

```ts
assistant.use(memory.compose({
  stores: {
    user: memory.entries({ path: 'docs/memories/USER.md', limit: 1375 }),
    self: memory.entries({ path: 'docs/memories/SELF.md', limit: 2200 }),
  },
  inject: 'frozen',
  renderer: 'hermes',
  tools: 'curated',
  policies: ['promptSafe', 'dedupeExact', 'bounded'],
}))
```

Both forms can coexist:

- fluent builder for Luca's Lego feel
- object config for recipes and presets

## Presets are recipes

Hermes behavior should be a preset:

```ts
assistant.use(memory.presets.hermes({
  namespace: 'chiefOfStaff',
  baseDir: 'docs/memories',
  targets: {
    memory: 'SELF.md',
    user: 'USER.md',
  },
}))
```

That preset expands to something like:

```ts
memory.compose({
  stores: {
    memory: memory.entries({
      path: 'docs/memories/SELF.md',
      limit: 2200,
      delimiter: '\n§\n',
    }),
    user: memory.entries({
      path: 'docs/memories/USER.md',
      limit: 1375,
      delimiter: '\n§\n',
    }),
  },
  inject: {
    mode: 'frozen',
    renderer: 'hermesPromptBlock',
  },
  tools: {
    type: 'curated',
    name: 'memory',
    actions: ['add', 'replace', 'remove'],
  },
  policies: [
    'dedupeExact',
    'boundedChars',
    'promptInjectionScan',
  ],
})
```

The same system can also support a semantic notebook preset:

```ts
assistant.use(memory.presets.semanticNotebook({
  namespace: 'researcher',
  dbPath: '.luca/memory/researcher.sqlite',
  inject: false,
}))
```

No Hermes-style prompt injection required.

## How `chiefOfStaff` should compose memory

The `chiefOfStaff` assistant should not define the generic memory system. It should demonstrate a rich composition.

Conceptually:

```ts
export const use = [
  container.feature('communications', { gwsProfile: 'chief' }),

  container.feature('skillsLibrary', { ... }),

  container.feature('memory').presets.chiefOfStaff({
    self: 'docs/memories/SELF.md',
    user: 'docs/memories/USER.md',
    todos: 'docs/memories/TODO.md',
    docs: container.docs,
    archiveRoot: 'docs/memory',
  }),

  container.docs,
]
```

That preset could provide:

Prompt injection:

- `SELF.md`
- `USER.md`
- maybe a compact `TODO.md` summary

Tools:

- `memory` add/replace/remove for SELF/USER
- `listTodos`
- `updateTodo`
- `sessionSearch`
- `archiveMemory`

Policies:

- docs-only writes
- contentbase validation
- no spark before interview complete
- stable-facts-only for curated memory
- operational state separated from identity memory

But that is Chief's recipe, not generic memory.

## Example assistant compositions

### Customer support assistant

```ts
assistant.use(memory.compose({
  stores: {
    customer: memory.entries({ path: '.luca/customers/{userId}.md', limit: 1000 }),
    cases: memory.documents({ rootPath: 'docs/support-cases' }),
  },
  inject: ['customer'],
  prefetch: ['cases'],
  tools: ['curated', 'caseSearch'],
}))
```

### Coding assistant

```ts
assistant.use(memory.compose({
  stores: {
    conventions: memory.entries({ path: '.luca/memory/project.md', limit: 2000 }),
    sessions: memory.conversations(),
  },
  inject: ['conventions'],
  prefetch: ['sessions'],
  tools: ['curated', 'sessionSearch'],
}))
```

### Roleplay companion

```ts
assistant.use(memory.compose({
  stores: {
    relationship: memory.entries({ limit: 1500 }),
    episodes: memory.vector({ dbPath: '.luca/memory/episodes.sqlite' }),
  },
  inject: ['relationship'],
  prefetch: ['episodes'],
  tools: ['rememberMoment', 'recallMoment'],
}))
```

### Research assistant

```ts
assistant.use(memory.compose({
  stores: {
    notebook: memory.documents({ rootPath: 'docs/research-notes' }),
    search: memory.semantic({ rootPath: 'docs/research-notes' }),
  },
  inject: false,
  tools: ['notebook', 'semanticSearch'],
}))
```

Same building blocks. Different composition.

## Suggested source layout

A clean source layout could look like:

```text
src/agi/features/memory.ts

src/agi/memory/
  stores/
    entry-store.ts
    markdown-store.ts
    content-db-store.ts
    semantic-store.ts
    conversation-store.ts
    todo-store.ts

  policies/
    bounded-chars.ts
    dedupe-exact.ts
    prompt-injection-scan.ts
    stable-facts-only.ts

  renderers/
    hermes-block.ts
    memory-context.ts
    markdown.ts
    json.ts

  toolsets/
    curated.ts
    semantic.ts
    session-search.ts
    todo.ts

  presets/
    hermes.ts
    chief-of-staff.ts
    semantic-notebook.ts

  manager.ts
  types.ts
```

This does not all need to be built at once. The important part is preserving these boundaries.

## Implementation path

### Phase 1: Hermes behavior as a preset

Add:

```ts
memory.presets.hermesCurated(...)
```

Internally it should provide:

- file-backed entry stores
- char limits
- frozen prompt injection
- `memory` tool with add/replace/remove
- exact dedupe
- prompt safety checks

Use this in `chiefOfStaff` instead of relying on one-off hooks and generic category memory.

### Phase 2: adapt current vector memory into a semantic store

Keep the existing SQLite/embedding/category machinery, but rename the concept around it.

`remember`/`recall` become a semantic memory toolset.

The vector store should be useful for archival recall/search. It should not be the primary always-in-context memory model.

### Phase 3: add memory lifecycle manager

Introduce a manager that can attach memory layers to assistants:

- prompt injection
- frozen prompt snapshots
- pre-turn prefetch
- post-turn sync
- session-end summarization
- tool registration

This should align with the existing assistant hook point around `formatSystemPrompt`.

### Phase 4: Chief preset

Compose:

- Hermes-like SELF/USER stores
- TODO operational store
- contentDb docs
- status summary selector/tool
- session/archive search
- docs-scoped write policies

Chief becomes the reference advanced composition, not the default behavior.

## Design rule

The generic memory feature should provide Legos, not a house.

Hermes is a very good house.

`chiefOfStaff` is a larger office building.

Luca should ship the bricks, the connectors, and a few excellent example builds.