---
name: Using the luca framework
description: The luca framework, when you see a project with docs/ commands/ features/ luca.cli.ts endpoints/ folders, or luca is in the package.json, or the user is asking you to develop a new Luca feature, use this skill to learn about the APIs and how to learn the framework at runtime.  The luca cli bundles all of the documentation in a searchable, progressively learnable interface designed for students and AI assistants alike
---
# Luca: Learning the Container

The Luca framework `luca` ships a `luca` binary — a bun-based CLI for a dependency injection container. This project is based on it if this skill is present. Project helper folders (`commands/`, `endpoints/`, `features/`, `clients/`, `servers/`) are discovered at runtime — but not all of them automatically. See "How Auto-Discovery Works" below before assuming a folder is picked up.

The `luca` cli loads typescript modules in through its VM which injects a `container` global that is a singleton object from which you can learn about, and access all different kinds of utils and Helpers (features, clients, servers, commands, and compositions thereof)

There are three things to learn, in this order:

1. **Discover** what the container can do — `luca describe`
2. **Build** new helpers when your project needs them — `luca scaffold`
3. **Prototype** and debug with live code — `luca eval`
4. **Write Runnable Markdown** a great usecase is `luca run markdown.md` where the markdown codeblocks are executed inside the Luca VM.
---

## Phase 1: Discover with `luca describe`

This is your primary tool. The `luca` binary is a compiled artifact that bundles all introspection data — it is the authority on what the container provides. Run `luca describe` first — it outputs full documentation for any part of the container: methods, options, events, state, examples. Reading source can be helpful for additional context if it exists in the project, but the source for built-in helpers may not be present — the binary is always the ground truth.

### See what's available

```shell
luca describe features     # index of all available features, grouped by category
luca describe clients      # index of all available clients
luca describe servers      # index of all available servers
```

### Search by meaning when you don't know the name

When you know what you want to *do* but not what it's called, ask in plain language — it searches every helper, example, and tutorial and returns ranked pointers:

```shell
luca describe --query "how do I build a rest server?"
luca describe --query "watch files for changes"
luca describe --query "run a command over ssh" --json   # machine-readable results
```

Each result tells you the follow-up move (`luca describe <name>`, or a references/ doc to read). Keyword search always works; for semantic ranking build the index once with `luca describe --calculate-embeddings` (needs `luca setup --local-embeddings`). There's also a flat lookup table of every helper in `references/helper-index.md`.

You can even learn about features in the browser container, or a specific platform (server, node are the same, browser,web are the same)

```shell
luca describe features --platform=web 
luca describe features --platform=server
```

### Learn about specific helpers

```shell
luca describe fs           # full docs for the fs feature
luca describe git          # full docs for git
luca describe rest         # full docs for the rest client
luca describe express      # full docs for the express server
luca describe git fs proc  # multiple helpers in one shot
```

### Drill into a specific method or getter

Use dot notation to get docs for a single method or getter on any helper:

```shell
luca describe ui.banner            # docs for the banner() method on ui
luca describe fs.readFile          # docs for readFile() on fs
luca describe ui.colors            # docs for the colors getter on ui
luca describe git.branch           # docs for the branch getter on git
```

This shows the description, parameters, return type, and examples for just that member. If the member doesn't exist, it lists all available methods and getters on the helper.

### Get targeted documentation

You can filter to only the sections you need:

```shell
luca describe fs --methods          # just the methods
luca describe git --events          # just the events it emits
luca describe express --options     # just the constructor options
luca describe fs git --examples     # just examples for both
luca describe fs --usage --methods  # combine sections
```

### Get approximate TypeScript types

Need to know the shape of a helper for type-safe code? Use `--ts`:

```shell
luca describe fs --ts              # approximate TS interface for fs
luca describe conversation --ts    # see the conversation feature's type surface
luca describe rest --ts            # client type shape
```

This outputs a ~95% accurate TypeScript representation based on runtime introspection. If a type looks wrong or a method signature seems off, verify with `luca eval` against the live instance.

### Describe the container itself

```shell
luca describe              # overview of the container
luca describe self         # same thing
```

### Learn how to run a CLI command → `--help`, not `describe`

`luca describe` documents the **programmatic API** of helpers (features, clients, servers) — the methods, getters, and events you call in code. It is the wrong tool for learning how to *invoke a CLI command*. For that, use the command's own `--help`, which renders its arguments, positionals, flags, subcommands, and examples:

```shell
luca                       # list every available command
luca serve --help          # how to run the serve command
luca scaffold --help       # arguments, flags, and examples for scaffold
luca bundle --help         # ...for any command
luca help scaffold         # equivalent to `luca scaffold --help`
```

Rule of thumb: **helper → `luca describe <name>`; command → `luca <command> --help`.** (Describing a command still works, but it shows the command class's internals, not its usage — `describe` will warn you and point you at `--help`.)

**Use `luca describe` liberally for helpers.** It is the fastest, safest way to understand what the container provides. Every feature, client, and server is self-describing — if you know a name, describe will tell you everything about it. Use dot notation (`ui.banner`, `fs.readFile`) when you need docs on just one method or getter. Use `--ts` when you need type information for writing code.

> **NOTE:** The `luca` binary is compiled and bundles all introspection data. `luca describe` reflects what actually ships in the binary — source files for built-in helpers may not exist in your project. Reading source can add context when it's available, but `luca describe` and `luca eval` are always the authority.

---

## Phase 2: Build with `luca scaffold`

When your project needs a new helper, scaffold it. The `scaffold` command generates correct boilerplate — you fill in the logic.

### Check the shipped examples first

Before building anything multi-step, look for a runnable composition pattern in `references/examples/` (index below). **A runnable example beats fifty describes** — run it with `luca run <doc.md>` to confirm it works, then adapt the pattern. In a measured comparison, the fastest solution to a websocket task came from finding and running the shipped ask/reply example; the slowest came from scaffolding a custom client from scratch. Don't scaffold what you don't need: if a built-in client or server already speaks the protocol (websocket, rest), use it directly with your message conventions on top.

### Learn how to build each type

Before creating anything, read the tutorial for that helper type:

```shell
luca scaffold feature --tutorial    # how features work, full guide
luca scaffold command --tutorial    # how commands work
luca scaffold endpoint --tutorial   # how endpoints work
luca scaffold client --tutorial     # how clients work
luca scaffold server --tutorial     # how servers work
```

These tutorials are the authoritative reference for each helper type. They cover imports, schemas, class structure, registration, conventions, and complete examples.

### Generate a helper

```shell
luca scaffold <type> <name> --description "What it does"
```

The workflow after scaffolding:

```shell
luca scaffold command sync-data --description "Pull data from staging"
# edit commands/sync-data.ts — add your logic
luca sync-data --help              # verify it shows up and its args/flags read correctly
```

Every scaffolded helper is picked up automatically — the CLI discovers all project helper folders (`commands/`, `features/`, `clients/`, `servers/`, ...) before dispatching a command, and `luca serve` discovers `endpoints/`. See "How Auto-Discovery Works" below for opt-outs and non-CLI entry points.

### When to use each type

| You need to...                                     | Scaffold a...  | Example                                                        |
|----------------------------------------------------|----------------|----------------------------------------------------------------|
| Add a reusable local capability (caching, crypto)  | **feature**    | `luca scaffold feature disk-cache --description "File-backed key-value cache"` |
| Add a CLI task (build, deploy, generate)           | **command**    | `luca scaffold command deploy --description "Deploy to production"` |
| Talk to an external API or service                 | **client**     | `luca scaffold client github --description "GitHub API wrapper"` |
| Accept incoming connections (HTTP, WS)             | **server**     | `luca scaffold server mqtt --description "MQTT broker"` |
| Add a REST route to `luca serve`                   | **endpoint**   | `luca scaffold endpoint users --description "User management API"` |

### Scaffold options

```shell
luca scaffold command deploy --description "..."    # writes to commands/deploy.ts
luca scaffold endpoint users --print                # print to stdout instead of writing
luca scaffold feature cache --output lib/cache.ts   # override output path
```

---

## Phase 3: Prototype with `luca eval`

Once you know what's available (describe) and how to build things (scaffold), use `luca eval` to test ideas, verify behavior, and debug.

```shell
luca eval "container.features.available"
luca eval "container.feature('proc').exec('ls')"
luca eval "container.feature('fs').readFile('package.json')"
```

The eval command boots a full container with all helpers discovered and registered. Core features are available as top-level shortcuts:

```shell
luca eval "fs.readFile('package.json')"
luca eval "git.branch"
luca eval "proc.exec('ls')"
```

**Reach for eval when you're stuck.** It gives you full control of the container at runtime — you can test method calls, inspect state, verify event behavior, and debug issues that are hard to reason about from docs alone.

**Use eval as a testing tool.** Before wiring up a full command handler or feature, test your logic in eval first. Want to verify how `fs.moveAsync` behaves, or whether a watcher event fires the way you expect? Run it in eval. This is the fastest way to validate container code without the overhead of building the full command around it.

```shell
# Test file operations before building a command around them
luca eval "await fs.moveAsync('inbox/test.json', 'inbox/valid/test.json')"

# First: luca describe fileManager --events  (to learn what events exist)
# Then test the behavior:
luca eval "const fm = container.feature('fileManager'); fm.on('file:change', (e) => console.log(e)); await fm.watch({ paths: ['inbox'] })"
```

### The REPL

For interactive exploration, `luca console` opens a persistent REPL with the container in scope. Useful when you need to try multiple things in sequence.

---

## Key Concepts

### The Container

The container is a singleton that holds everything your application needs. It organizes components into **registries**: features, clients, servers, commands, and endpoints. Use the factory functions to get instances:

```js
const fs = container.feature('fs')
const rest = container.client('rest')
const server = container.server('express')
```

### How Auto-Discovery Works

The CLI discovers **all** project helper folders before dispatching a command — `features/`, `clients/`, `servers/`, `commands/`, `endpoints/`, `selectors/` — so `container.feature('myThing')` works inside any command without extra wiring. `~/.luca/{features,clients,servers,commands}` (user-level helpers) are discovered on every CLI run too.

| Folder | Discovered by | When |
|--------|---------------|------|
| all project helper folders | the CLI itself | every `luca <command>` invocation |
| `endpoints/` | `luca serve` | when the server starts |
| everything | `luca eval` | internally, before evaluating |

Opt-outs via the `LUCA_COMMAND_DISCOVERY` env var: `commands-only` (only discover `commands/`, the pre-auto-discovery behavior), `no-local` (skip the project), `no-home` (skip `~/.luca`), `disable` (skip both).

**Non-CLI entry points** (embedding the container in your own script or service) don't get this for free — discover explicitly:

```js
await container.helpers.discoverAll()                               // everything
await container.helpers.discover('features')                        // one type
await container.helpers.discover('commands', { directory: dir })    // from a custom folder (plugins)
```

### Plugins

Any folder with the standard project layout (`features/`, `commands/`, `endpoints/`, ...) can be loaded as a plugin. Drop (or symlink) it into `~/.luca/plugins/<name>`, then either:

```sh
# .env — the CLI loads these automatically before your luca.cli.ts runs
LUCA_PLUGINS=my-plugin,other-plugin
```

```js
await container.helpers.usePlugin('my-plugin')   // by name (~/.luca/plugins) or path
container.use('my-plugin'); await container.start()  // sync call sites — start() awaits plugin loads
```

If the plugin has a `luca.plugin.ts` (or `plugin.ts`) entry, its `attach(container, { pluginDir })` export runs after discovery — the hook for assets beyond the standard folders (assistants, workflows, contexts).

### State

Every helper and the container itself have observable state:

```js
const feature = container.feature('fs')

feature.state.current              // snapshot of all state
feature.state.get('someKey')       // single value
feature.state.set('key', 'value')  // update

// Watch for changes
feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
})
```

The container has state too: `container.state.current`, `container.state.observe()`.

### Events

Every helper and the container are event emitters — `on`, `once`, `emit`, `waitFor` all work as expected. Use `luca describe <name> --events` to see what a helper emits.

### Utilities

The container provides common utilities at `container.utils` — no external imports needed:

- `container.utils.uuid()` — v4 UUID
- `container.utils.hashObject(obj)` — deterministic hash
- `container.utils.stringUtils` — camelCase, kebabCase, pluralize, etc.
- `container.utils.lodash` — groupBy, keyBy, pick, omit, debounce, etc.
- `container.paths.resolve()` / `container.paths.join()` — path operations

### Programmatic introspection

Everything `luca describe` outputs is also available at runtime in code:

```js
container.features.describe('fs')   // markdown docs (same as the CLI)
feature.introspect()                // structured object: { methods, events, state, options }
container.introspectAsText()           // full container overview as markdown
```

This is useful inside commands and scripts where you need introspection data programmatically.

---

## Server development troubleshooting

- You can use `container.proc.findPidsByPort(3000)` which will return an array of numbers.
- You can use `container.proc.kill(pid)` to kill that process
- You can combine these two functions in `luca eval` if a server you're developing won't start because a previous instance is running (common inside e.g. claude code sessions )
- `luca serve --force` will also replace the running process with the current one
- `luca serve --any-port` will open on any port


## Common Patterns

Recurring shapes that evaluation sessions had to improvise — use these instead of inventing your own:

### State between separate `luca` invocations

Every `luca` command runs in a fresh process with a fresh container — module-level variables and helper registrations do not survive. The blessed handoff is `container.store(name)`: one durable JSON document per name (under `.luca/store/`), schema-validated, with atomic writes. Never hand-roll a state dotfile or keep shared counters in memory.

```js
// process A (e.g. `luca scout`) — update() is a LOCKED read-modify-write:
// concurrent invocations can never overwrite each other's writes
const scout = container.store('scout')
await scout.update(s => { s.port = port; s.pid = process.pid })

// process B (e.g. `luca check`) — read() always re-reads the file
const { port } = await container.store('scout').read()
```

Pass `schema` (zod, with `.default()`s) and a missing file reads as your defaults — no init step. The file at `store.path` is plain JSON: `cat` it, commit it. Full API: `luca describe store`.

**Which store? The decision heuristic:**

| Need | Use |
|------|-----|
| In-process, ephemeral, reactive | `container.state` / feature state |
| Cross-process **state** — counters, manifests, PIDs, process lists, small configs | `container.store(name)` (locked `update()`, atomic writes; losing it would be a bug) |
| Cross-process **cache** — recomputable, may expire | `diskCache` (supports `ttl`; expired = miss; `get()` throws on a miss — guard with `has()`) |
| Queryable, relational, transactional, durable queues | `sqlite` (see `transaction()` and `UPDATE … RETURNING` for atomic job claims) |
| Cross-process pub/sub fan-out | `redis` (`publish`/`subscribe`) |

### Subcommand-style CLIs (`luca note add|list|wipe`)

One command file; map the verb through positionals and validate with an enum:

```ts
export const positionals = ['action', 'text']
export const argsSchema = z.object({
  action: z.enum(['add', 'list', 'wipe']).describe('What to do'),
  text: z.string().optional().describe('Note text (for add)'),
})

// Declarative help metadata: renders a Subcommands: section in --help,
// and `luca note add --help` shows focused help for just that verb.
export const subcommands = {
  add: { args: '<text>', description: 'Save a note', examples: ['luca note add "call the vet"'] },
  list: { description: 'Print all saved notes' },
  wipe: { description: 'Delete all notes' },
}

export const examples = ['luca note add "call the vet"', 'luca note list']
```

### Supervising background workers across invocations

The complete start/status/stop shape: detach the workers so they outlive the CLI, persist their PIDs, and check liveness with signal 0. (`processManager` won't work here — its tracking is in-memory, per-process.)

```js
const proc = container.feature('proc')
const cache = container.feature('diskCache')

// start — detached children survive the parent command exiting
const pids = []
for (let i = 0; i < 3; i++) {
  const worker = proc.spawn('bun', ['worker.ts'], { detached: true })  // stdio defaults to 'ignore' when detached
  worker.unref()  // let the parent event loop exit
  pids.push(worker.pid)
}
await cache.set('fleet', { pids })

// status — a later, separate process finds them again
const { pids: saved } = await cache.get('fleet')
const alive = saved.filter(pid => proc.kill(pid, 0))  // signal 0: liveness check, returns false when gone

// stop
for (const pid of saved) proc.kill(pid)   // SIGTERM; proc.kill(pid, 'SIGKILL') for stragglers
await cache.rm('fleet')
```

### Client commands must exit explicitly

A command that connects as a websocket/IPC client can keep the event loop alive after its work is done and hang forever. Disconnect and exit:

```js
const answer = await client.ask({ type: 'time' })
console.log(answer)
await client.disconnect?.()
process.exit(0)
```

### Secrets across invocations

`vault.secret()` mints a **new random key each process** — encrypt in one command, and the next command can't decrypt unless you persist the key and pass it back: `container.feature('vault', { secret: savedKey })`. (`vault.secretText` is also lazy — undefined until `secret()`/`encrypt()`/`decrypt()` has run once.)

### Reactive browser UIs (no build step)

You can build a full reactive front-end with **no bundler, no `npm install`, no build step** — put `public/index.html`, run `luca serve` (it serves `public/` static + `endpoints/` as a same-origin API, so no CORS). The pattern that scales, framework-agnostic at its core:

- **Import from esm.sh** — React (`https://esm.sh/react@18.3.1`), the web container (`https://esm.sh/luca/web`), anything. Use `React.createElement` (alias `e`) instead of JSX so there's nothing to compile.
- **A Luca feature *is* your store** — it already has `this.state.get/set` and `emit/on/off`. Mutate state, then `this.emit('changed')`. No Redux/Context needed.
- **The view subscribes to `changed`** — a ~6-line `useFeatureVersion([feature])` hook (`f.on('changed', forceRerender)`) re-renders React on every change. Plain DOM works too: a `render()` on `changed`. The store never references the view.
- **Layer as Api → Store → App** for anything real: Api does `fetch`/ws/SSE, Store holds state and emits, App orchestrates and exposes `snapshot()` (one atomic read for the view). Features compose via `this.container.feature('...')`.
- **Backend half:** `endpoints/*.ts` return JSON; the browser's web container reaches them with `container.client('rest', { baseURL: '/api' })`. Node-only work (`fs`, `sqlite`, `git`) lives behind endpoints — the web container doesn't have it.

Footguns: pin esm.sh versions; react-dom must resolve the *same* React (`?deps=react@VERSION` or an import map); `emit('changed')` after **every** mutation. Full walkthrough: `references/tutorials/22-reactive-frontend.md`.

To let a **server-side assistant drive** such a UI (call its actions as tools, live), the app's methods are exposed as `static tools` and reached over the `containerLink` WebSocket bridge (host `eval`s into the browser, `await`s the result) — same tool-provider pattern as any feature, plus one transport hop. See `references/tutorials/23-assistant-driven-ui.md`.

### Modeling state in markdown (frontmatter vs. body)

When designing a `contentDb` model (`docs/models.ts`), sort every field into one of two drawers — getting this right is what keeps the markdown worth reading:

- **Frontmatter = the index card.** Only what the *system* filters/sorts/joins on: `status` enums, tags, foreign-key slugs, timestamps, machine-written scalars (`lastRanAt`, `costUsd`), small flags. Scalars and short arrays — labels, not content.
- **Body sections = the substance.** Anything a human writes in sentences, lists, or code. A `section('Heading', { extract, schema })` makes a heading's prose a typed, validated, queryable field (`instance.sections.motivation`) — and a `computed` can turn a readable list into structured data (e.g. an execution DAG from a bulleted list of links). You get human-editable *and* machine-structured from one source.

Litmus test: *would you write it in a sentence? → body. Is it a label you filter on? → frontmatter.* If you're reaching for YAML `|` multi-line strings or nesting objects three deep, that's body content in the wrong drawer — it defeats the purpose of using markdown. Read is split too: `db.query(Model).where('meta.status', …)` on the cheap indexed drawer; `contentDb.getDocument(id, { include: ['Findings'] })` to pull one section. Write: `doc.replaceSectionContent(heading, md)` then `doc.save()` (whole-file atomic — no per-section save). Full walkthrough: `references/tutorials/24-state-in-markdown.md`.

## Framework Index

A table of contents for the container. **Run `luca describe <name>` for full docs on any item.** Use `luca describe <name> --ts` when you need type information. Source may not exist locally for built-in helpers — the compiled binary is the authority. For a flat, per-helper lookup table (name, category, stability, one-liner) see `references/helper-index.md`; to search by meaning use `luca describe --query "..."`.

<!-- BEGIN:GENERATED helper-tables (luca build-bootstrap regenerates this block from introspection — do not edit by hand) -->
### Features by Category

| Category | Features | What they do |
|----------|----------|--------------|
| **File System & Code** | `fileManager`, `fs`, `grep` | Read/write files, search code, watch for changes |
| **Process & Shell** | `proc`, `processManager`, `scheduler`, `secureShell`, `tmux` | Run commands, manage long-running processes, SSH |
| **AI Assistants** | `assistant`, `assistantsManager`, `autoAssistant`, `codingTools`, `conversation`, `conversationHistory`, `fileTools`, `mcpBridge`, `memory`, `modelProviders`, `openapi`, `telnyxAssistantConnector`, `voiceMode` | Build AI assistants, manage conversations, tool calling |
| **AI Agent Wrappers** | `claudeCode`, `claudeController`, `lucaCoder`, `openaiCodex` | Spawn and manage external AI agent CLIs as subprocesses |
| **Data & Storage** | `contentDb`, `diskCache`, `postgres`, `redis`, `sqlite`, `store` | Cross-process state, databases, caching, document management |
| **Networking** | `dns`, `ipcSocket`, `networking` | HTTP clients and servers, sockets, DNS, network utilities |
| **Google Workspace** | `googleAuth`, `googleCalendar`, `googleDocs`, `googleDrive`, `googleMail`, `googleSheets` | OAuth and Google service wrappers |
| **Dev Tools** | `docker`, `git`, `packageFinder`, `python`, `transpiler`, `vm` | Version control, containers, bundling, sandboxed execution |
| **Content & NLP** | `docsReader`, `jsonTree`, `nlp`, `semanticSearch`, `skillsLibrary`, `yamlTree` | Document Q&A, text analysis, semantic search, structured file ingestion |
| **UI & Output** | `ink`, `ui`, `yaml` | Terminal UI, colors, ascii art, structured data display |
| **Media & Browser** | `browserUse`, `cipherSocial`, `downloader`, `opener`, `telegram`, `tts` | Browser automation, text-to-speech, downloads, messaging |
| **System** | `containerLink`, `helpers`, `introspectionScanner`, `os`, `repl`, `runpod`, `socketRepl`, `vault` | OS info, secrets, runtime introspection, remote container linking |

### Clients

| Client | Purpose |
|--------|---------|
| `elevenlabs` | ElevenLabs client — text-to-speech synthesis via the ElevenLabs REST API. |
| `graph` | GraphQL client that wraps RestClient with convenience methods for executing queries and mutations. |
| `openai` | OpenAI client — wraps the OpenAI SDK for chat completions, responses API, embeddings, and image generation. |
| `rest` | HTTP REST client built on top of axios. |
| `socketio` | Socket.IO client that bridges socket.io-client events to Luca's Helper event bus. |
| `voicebox` | VoiceBox client — local TTS synthesis via VoiceBox.sh REST API (Qwen3-TTS). |
| `websocket` | WebSocket client that bridges raw WebSocket events to Luca's Helper event bus, providing a clean interface for sending/receiving messages, tracking connection state (`state.connected`, `state.reconnectAttempts`), and optional auto-reconnection with exponential backoff (base `reconnectInterval`, doubled per attempt, capped at 30s, up to `maxReconnectAttempts`). |

### Servers

| Server | Purpose |
|--------|---------|
| `express` | Express.js HTTP server with automatic endpoint mounting, CORS, and SPA history fallback. |
| `llmProxy` | Runs a [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start) in a docker container, exposing every configured backend — local GPU boxes running OpenAI-compatible servers, LM Studio, paid APIs like OpenAI and Anthropic — behind a single OpenAI-compatible endpoint on `http://localhost:<port>/v1`. |
| `mcp` | MCP (Model Context Protocol) server for exposing tools, resources, and prompts to AI clients like Claude Code. |
| `websocket` | WebSocket server built on the `ws` library with optional JSON message framing. |
<!-- END:GENERATED helper-tables -->

`fileTools` composes lower-level features (`fs`, `grep`) into an assistant-ready tool surface — a good example of how features can define tools for assistants (see `references/examples/feature-as-tool-provider.md`).

### Type Discovery

`luca describe <name> --ts` outputs an approximate TypeScript representation of any helper as it exists at runtime — ~95% accurate. This is your go-to for writing type-safe code against the container. The binary compiles in the introspection data, so `--ts` reflects what actually exists at runtime even when source isn't available. Reading source can provide additional context when it's there.

```shell
luca describe fs --ts              # approximate TS interface for the fs feature
luca describe conversation --ts    # conversation feature type surface
luca describe express --ts         # express server type shape
```

If a method signature or return type looks wrong, verify with `luca eval`:

```shell
luca eval "typeof container.feature('fs').readFile"
luca eval "container.feature('fs').readFile('package.json')"
```

### Bundled Examples and Tutorials

The skill directory includes reference material:

- **`references/examples/`** — runnable composition patterns that combine multiple helpers. Every one executes via `luca run <doc.md>` and carries `lastTested`/`lastTestPassed` frontmatter from the test harness. For single-feature usage, use `luca describe <name>` instead — every helper's docs include per-method examples.
- **`references/tutorials/`** — longer-form guides covering the container, helpers, commands, endpoints, state/events, assistants, and more

Match your task to the catalog:

| You're building... | Run/read |
|---|---|
| A custom feature (schemas, state, events, discovery) | `custom-feature-authoring.md`, `testing-a-composed-feature.md` |
| A feature that gives an assistant tools | `feature-as-tool-provider.md`, `assistant-with-process-manager.md` |
| An HTTP API + client | `full-stack-slice.md`, `server-rest-roundtrip.md` |
| A reactive browser UI / dashboard (no build step) | `references/tutorials/22-reactive-frontend.md` (feature-as-store, React via esm.sh) |
| An assistant that drives a browser UI (calls its actions as tools) | `references/tutorials/23-assistant-driven-ui.md` (`containerLink` + `static tools`) |
| WebSocket messaging / request-reply | `server-client-roundtrip-ws.md`, `websocket-ask-and-reply-example.md` |
| An HTTP API + a WebSocket sidecar (live push from REST) | `references/tutorials/25-express-websocket-sidecar.md` (`luca serve --setup`) |
| Event-driven fan-out (in-process → ws → redis) | `event-bus-fanout.md` |
| A data pipeline or job queue | `data-pipeline-fs-grep-sqlite.md`, `sqlite-job-queue.md` |
| Cross-process state (which store?) | `cross-process-state-handoff.md` |
| A daemon, poll loop, or scheduled task | `daemon-command.md` |
| Search over documents | `semantic-search-content-db.md` |
| Designing a markdown doc model (what goes in frontmatter vs. body) | `references/tutorials/24-state-in-markdown.md` (the two-drawer rule) |
| Understanding how your code executes (VM, virtual modules, globals, entry points) | `references/tutorials/26-the-vm.md` (the execution contract) |
| Plugin systems / dynamic registries | `meta-discovery.md` |
| Lightweight stateful objects with tools | `entity.md` |
| Structured JSON output from a model | `structured-output-with-assistants.md` |
| Orchestrating Claude Code sessions | `claude-controller-personas.md` |
| Understanding how errors behave (returned vs thrown) | `error-handling-conventions.md` |

These complement `luca describe` — describe gives you the API surface and per-method examples, the example docs show multi-helper patterns in action, and tutorials walk through building things end to end.

**Tip:** Runnable markdown is a great artifact to produce when building with luca. `luca run doc.md` executes code blocks inside the Luca VM — useful for both testing and documentation. When prototyping a feature or writing a how-to, consider writing it as a markdown file that can be run.

### Container Primitives

| Primitive | Access | Purpose |
|-----------|--------|---------|
| State | `container.state`, `helper.state` | Observable key-value state on every object |
| Events | `container.on()`, `helper.on()` | Event bus on every object |
| Paths | `container.paths` | `resolve()`, `join()`, `cwd` |
| Utils | `container.utils` | `uuid()`, `lodash`, `stringUtils`, `hashObject()` |
| Registries | `container.features`, `.clients`, `.servers` | Discovery and metadata for all helpers |
