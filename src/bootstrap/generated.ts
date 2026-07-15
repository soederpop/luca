// Auto-generated bootstrap content
// Source: docs/bootstrap/*.md, docs/bootstrap/templates/*, docs/examples/*.md, docs/tutorials/*.md,
// plus reference docs generated from live introspection data.
//
// Do not edit manually. Run: luca build-bootstrap

export const bootstrapFiles: Record<string, string> = {
  "SKILL": `---
name: Using the luca framework
description: The luca framework, when you see a project with docs/ commands/ features/ luca.cli.ts endpoints/ folders, or luca is in the package.json, or the user is asking you to develop a new Luca feature, use this skill to learn about the APIs and how to learn the framework at runtime.  The luca cli bundles all of the documentation in a searchable, progressively learnable interface designed for students and AI assistants alike
---
# Luca: Learning the Container

The Luca framework \`luca\` ships a \`luca\` binary — a bun-based CLI for a dependency injection container. This project is based on it if this skill is present. Project helper folders (\`commands/\`, \`endpoints/\`, \`features/\`, \`clients/\`, \`servers/\`) are discovered at runtime — but not all of them automatically. See "How Auto-Discovery Works" below before assuming a folder is picked up.

The \`luca\` cli loads typescript modules in through its VM which injects a \`container\` global that is a singleton object from which you can learn about, and access all different kinds of utils and Helpers (features, clients, servers, commands, and compositions thereof)

There are three things to learn, in this order:

1. **Discover** what the container can do — \`luca describe\`
2. **Build** new helpers when your project needs them — \`luca scaffold\`
3. **Prototype** and debug with live code — \`luca eval\`
4. **Write Runnable Markdown** a great usecase is \`luca run markdown.md\` where the markdown codeblocks are executed inside the Luca VM.
---

## Phase 1: Discover with \`luca describe\`

This is your primary tool. The \`luca\` binary is a compiled artifact that bundles all introspection data — it is the authority on what the container provides. Run \`luca describe\` first — it outputs full documentation for any part of the container: methods, options, events, state, examples. Reading source can be helpful for additional context if it exists in the project, but the source for built-in helpers may not be present — the binary is always the ground truth.

### See what's available

\`\`\`shell
luca describe features     # index of all available features, grouped by category
luca describe clients      # index of all available clients
luca describe servers      # index of all available servers
\`\`\`

### Search by meaning when you don't know the name

When you know what you want to *do* but not what it's called, ask in plain language — it searches every helper, example, and tutorial and returns ranked pointers:

\`\`\`shell
luca describe --query "how do I build a rest server?"
luca describe --query "watch files for changes"
luca describe --query "run a command over ssh" --json   # machine-readable results
\`\`\`

Each result tells you the follow-up move (\`luca describe <name>\`, or a references/ doc to read). Keyword search always works; for semantic ranking build the index once with \`luca describe --calculate-embeddings\` (needs \`luca setup --local-embeddings\`). There's also a flat lookup table of every helper in \`references/helper-index.md\`.

You can even learn about features in the browser container, or a specific platform (server, node are the same, browser,web are the same)

\`\`\`shell
luca describe features --platform=web 
luca describe features --platform=server
\`\`\`

### Learn about specific helpers

\`\`\`shell
luca describe fs           # full docs for the fs feature
luca describe git          # full docs for git
luca describe rest         # full docs for the rest client
luca describe express      # full docs for the express server
luca describe git fs proc  # multiple helpers in one shot
\`\`\`

### Drill into a specific method or getter

Use dot notation to get docs for a single method or getter on any helper:

\`\`\`shell
luca describe ui.banner            # docs for the banner() method on ui
luca describe fs.readFile          # docs for readFile() on fs
luca describe ui.colors            # docs for the colors getter on ui
luca describe git.branch           # docs for the branch getter on git
\`\`\`

This shows the description, parameters, return type, and examples for just that member. If the member doesn't exist, it lists all available methods and getters on the helper.

### Get targeted documentation

You can filter to only the sections you need:

\`\`\`shell
luca describe fs --methods          # just the methods
luca describe git --events          # just the events it emits
luca describe express --options     # just the constructor options
luca describe fs git --examples     # just examples for both
luca describe fs --usage --methods  # combine sections
\`\`\`

### Get approximate TypeScript types

Need to know the shape of a helper for type-safe code? Use \`--ts\`:

\`\`\`shell
luca describe fs --ts              # approximate TS interface for fs
luca describe conversation --ts    # see the conversation feature's type surface
luca describe rest --ts            # client type shape
\`\`\`

This outputs a ~95% accurate TypeScript representation based on runtime introspection. If a type looks wrong or a method signature seems off, verify with \`luca eval\` against the live instance.

### Describe the container itself

\`\`\`shell
luca describe              # overview of the container
luca describe self         # same thing
\`\`\`

### Learn how to run a CLI command → \`--help\`, not \`describe\`

\`luca describe\` documents the **programmatic API** of helpers (features, clients, servers) — the methods, getters, and events you call in code. It is the wrong tool for learning how to *invoke a CLI command*. For that, use the command's own \`--help\`, which renders its arguments, positionals, flags, subcommands, and examples:

\`\`\`shell
luca                       # list every available command
luca serve --help          # how to run the serve command
luca scaffold --help       # arguments, flags, and examples for scaffold
luca bundle --help         # ...for any command
luca help scaffold         # equivalent to \`luca scaffold --help\`
\`\`\`

Rule of thumb: **helper → \`luca describe <name>\`; command → \`luca <command> --help\`.** (Describing a command still works, but it shows the command class's internals, not its usage — \`describe\` will warn you and point you at \`--help\`.)

**Use \`luca describe\` liberally for helpers.** It is the fastest, safest way to understand what the container provides. Every feature, client, and server is self-describing — if you know a name, describe will tell you everything about it. Use dot notation (\`ui.banner\`, \`fs.readFile\`) when you need docs on just one method or getter. Use \`--ts\` when you need type information for writing code.

> **NOTE:** The \`luca\` binary is compiled and bundles all introspection data. \`luca describe\` reflects what actually ships in the binary — source files for built-in helpers may not exist in your project. Reading source can add context when it's available, but \`luca describe\` and \`luca eval\` are always the authority.

---

## Phase 2: Build with \`luca scaffold\`

When your project needs a new helper, scaffold it. The \`scaffold\` command generates correct boilerplate — you fill in the logic.

### Check the shipped examples first

Before building anything multi-step, look for a runnable composition pattern in \`references/examples/\` (index below). **A runnable example beats fifty describes** — run it with \`luca run <doc.md>\` to confirm it works, then adapt the pattern. In a measured comparison, the fastest solution to a websocket task came from finding and running the shipped ask/reply example; the slowest came from scaffolding a custom client from scratch. Don't scaffold what you don't need: if a built-in client or server already speaks the protocol (websocket, rest), use it directly with your message conventions on top.

### Learn how to build each type

Before creating anything, read the tutorial for that helper type:

\`\`\`shell
luca scaffold feature --tutorial    # how features work, full guide
luca scaffold command --tutorial    # how commands work
luca scaffold endpoint --tutorial   # how endpoints work
luca scaffold client --tutorial     # how clients work
luca scaffold server --tutorial     # how servers work
\`\`\`

These tutorials are the authoritative reference for each helper type. They cover imports, schemas, class structure, registration, conventions, and complete examples.

### Generate a helper

\`\`\`shell
luca scaffold <type> <name> --description "What it does"
\`\`\`

The workflow after scaffolding:

\`\`\`shell
luca scaffold command sync-data --description "Pull data from staging"
# edit commands/sync-data.ts — add your logic
luca sync-data --help              # verify it shows up and its args/flags read correctly
\`\`\`

Every scaffolded helper is picked up automatically — the CLI discovers all project helper folders (\`commands/\`, \`features/\`, \`clients/\`, \`servers/\`, ...) before dispatching a command, and \`luca serve\` discovers \`endpoints/\`. See "How Auto-Discovery Works" below for opt-outs and non-CLI entry points.

### When to use each type

| You need to...                                     | Scaffold a...  | Example                                                        |
|----------------------------------------------------|----------------|----------------------------------------------------------------|
| Add a reusable local capability (caching, crypto)  | **feature**    | \`luca scaffold feature disk-cache --description "File-backed key-value cache"\` |
| Add a CLI task (build, deploy, generate)           | **command**    | \`luca scaffold command deploy --description "Deploy to production"\` |
| Talk to an external API or service                 | **client**     | \`luca scaffold client github --description "GitHub API wrapper"\` |
| Accept incoming connections (HTTP, WS)             | **server**     | \`luca scaffold server mqtt --description "MQTT broker"\` |
| Add a REST route to \`luca serve\`                   | **endpoint**   | \`luca scaffold endpoint users --description "User management API"\` |

### Scaffold options

\`\`\`shell
luca scaffold command deploy --description "..."    # writes to commands/deploy.ts
luca scaffold endpoint users --print                # print to stdout instead of writing
luca scaffold feature cache --output lib/cache.ts   # override output path
\`\`\`

---

## Phase 3: Prototype with \`luca eval\`

Once you know what's available (describe) and how to build things (scaffold), use \`luca eval\` to test ideas, verify behavior, and debug.

\`\`\`shell
luca eval "container.features.available"
luca eval "container.feature('proc').exec('ls')"
luca eval "container.feature('fs').readFile('package.json')"
\`\`\`

The eval command boots a full container with all helpers discovered and registered. Core features are available as top-level shortcuts:

\`\`\`shell
luca eval "fs.readFile('package.json')"
luca eval "git.branch"
luca eval "proc.exec('ls')"
\`\`\`

**Reach for eval when you're stuck.** It gives you full control of the container at runtime — you can test method calls, inspect state, verify event behavior, and debug issues that are hard to reason about from docs alone.

**Use eval as a testing tool.** Before wiring up a full command handler or feature, test your logic in eval first. Want to verify how \`fs.moveAsync\` behaves, or whether a watcher event fires the way you expect? Run it in eval. This is the fastest way to validate container code without the overhead of building the full command around it.

\`\`\`shell
# Test file operations before building a command around them
luca eval "await fs.moveAsync('inbox/test.json', 'inbox/valid/test.json')"

# First: luca describe fileManager --events  (to learn what events exist)
# Then test the behavior:
luca eval "const fm = container.feature('fileManager'); fm.on('file:change', (e) => console.log(e)); await fm.watch({ paths: ['inbox'] })"
\`\`\`

### The REPL

For interactive exploration, \`luca console\` opens a persistent REPL with the container in scope. Useful when you need to try multiple things in sequence.

---

## Key Concepts

### The Container

The container is a singleton that holds everything your application needs. It organizes components into **registries**: features, clients, servers, commands, and endpoints. Use the factory functions to get instances:

\`\`\`js
const fs = container.feature('fs')
const rest = container.client('rest')
const server = container.server('express')
\`\`\`

### How Auto-Discovery Works

The CLI discovers **all** project helper folders before dispatching a command — \`features/\`, \`clients/\`, \`servers/\`, \`commands/\`, \`endpoints/\`, \`selectors/\` — so \`container.feature('myThing')\` works inside any command without extra wiring. \`~/.luca/{features,clients,servers,commands}\` (user-level helpers) are discovered on every CLI run too.

| Folder | Discovered by | When |
|--------|---------------|------|
| all project helper folders | the CLI itself | every \`luca <command>\` invocation |
| \`endpoints/\` | \`luca serve\` | when the server starts |
| everything | \`luca eval\` | internally, before evaluating |

Opt-outs via the \`LUCA_COMMAND_DISCOVERY\` env var: \`commands-only\` (only discover \`commands/\`, the pre-auto-discovery behavior), \`no-local\` (skip the project), \`no-home\` (skip \`~/.luca\`), \`disable\` (skip both).

**Non-CLI entry points** (embedding the container in your own script or service) don't get this for free — discover explicitly:

\`\`\`js
await container.helpers.discoverAll()                               // everything
await container.helpers.discover('features')                        // one type
await container.helpers.discover('commands', { directory: dir })    // from a custom folder (plugins)
\`\`\`

### Plugins

Any folder with the standard project layout (\`features/\`, \`commands/\`, \`endpoints/\`, ...) can be loaded as a plugin. Drop (or symlink) it into \`~/.luca/plugins/<name>\`, then either:

\`\`\`sh
# .env — the CLI loads these automatically before your luca.cli.ts runs
LUCA_PLUGINS=my-plugin,other-plugin
\`\`\`

\`\`\`js
await container.helpers.usePlugin('my-plugin')   // by name (~/.luca/plugins) or path
container.use('my-plugin'); await container.start()  // sync call sites — start() awaits plugin loads
\`\`\`

If the plugin has a \`luca.plugin.ts\` (or \`plugin.ts\`) entry, its \`attach(container, { pluginDir })\` export runs after discovery — the hook for assets beyond the standard folders (assistants, workflows, contexts).

### State

Every helper and the container itself have observable state:

\`\`\`js
const feature = container.feature('fs')

feature.state.current              // snapshot of all state
feature.state.get('someKey')       // single value
feature.state.set('key', 'value')  // update

// Watch for changes
feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
})
\`\`\`

The container has state too: \`container.state.current\`, \`container.state.observe()\`.

### Events

Every helper and the container are event emitters — \`on\`, \`once\`, \`emit\`, \`waitFor\` all work as expected. Use \`luca describe <name> --events\` to see what a helper emits.

### Utilities

The container provides common utilities at \`container.utils\` — no external imports needed:

- \`container.utils.uuid()\` — v4 UUID
- \`container.utils.hashObject(obj)\` — deterministic hash
- \`container.utils.stringUtils\` — camelCase, kebabCase, pluralize, etc.
- \`container.utils.lodash\` — groupBy, keyBy, pick, omit, debounce, etc.
- \`container.paths.resolve()\` / \`container.paths.join()\` — path operations

### Programmatic introspection

Everything \`luca describe\` outputs is also available at runtime in code:

\`\`\`js
container.features.describe('fs')   // markdown docs (same as the CLI)
feature.introspect()                // structured object: { methods, events, state, options }
container.introspectAsText()           // full container overview as markdown
\`\`\`

This is useful inside commands and scripts where you need introspection data programmatically.

---

## Server development troubleshooting

- You can use \`container.proc.findPidsByPort(3000)\` which will return an array of numbers.
- You can use \`container.proc.kill(pid)\` to kill that process
- You can combine these two functions in \`luca eval\` if a server you're developing won't start because a previous instance is running (common inside e.g. claude code sessions )
- \`luca serve --force\` will also replace the running process with the current one
- \`luca serve --any-port\` will open on any port


## Common Patterns

Recurring shapes that evaluation sessions had to improvise — use these instead of inventing your own:

### State between separate \`luca\` invocations

Every \`luca\` command runs in a fresh process with a fresh container — module-level variables and helper registrations do not survive. The blessed handoff is \`container.store(name)\`: one durable JSON document per name (under \`.luca/store/\`), schema-validated, with atomic writes. Never hand-roll a state dotfile or keep shared counters in memory.

\`\`\`js
// process A (e.g. \`luca scout\`) — update() is a LOCKED read-modify-write:
// concurrent invocations can never overwrite each other's writes
const scout = container.store('scout')
await scout.update(s => { s.port = port; s.pid = process.pid })

// process B (e.g. \`luca check\`) — read() always re-reads the file
const { port } = await container.store('scout').read()
\`\`\`

Pass \`schema\` (zod, with \`.default()\`s) and a missing file reads as your defaults — no init step. The file at \`store.path\` is plain JSON: \`cat\` it, commit it. Full API: \`luca describe store\`.

**Which store? The decision heuristic:**

| Need | Use |
|------|-----|
| In-process, ephemeral, reactive | \`container.state\` / feature state |
| Cross-process **state** — counters, manifests, PIDs, process lists, small configs | \`container.store(name)\` (locked \`update()\`, atomic writes; losing it would be a bug) |
| Cross-process **cache** — recomputable, may expire | \`diskCache\` (supports \`ttl\`; expired = miss; \`get()\` throws on a miss — guard with \`has()\`) |
| Queryable, relational, transactional, durable queues | \`sqlite\` (see \`transaction()\` and \`UPDATE … RETURNING\` for atomic job claims) |
| Cross-process pub/sub fan-out | \`redis\` (\`publish\`/\`subscribe\`) |

### Subcommand-style CLIs (\`luca note add|list|wipe\`)

One command file; map the verb through positionals and validate with an enum:

\`\`\`ts
export const positionals = ['action', 'text']
export const argsSchema = z.object({
  action: z.enum(['add', 'list', 'wipe']).describe('What to do'),
  text: z.string().optional().describe('Note text (for add)'),
})

// Declarative help metadata: renders a Subcommands: section in --help,
// and \`luca note add --help\` shows focused help for just that verb.
export const subcommands = {
  add: { args: '<text>', description: 'Save a note', examples: ['luca note add "call the vet"'] },
  list: { description: 'Print all saved notes' },
  wipe: { description: 'Delete all notes' },
}

export const examples = ['luca note add "call the vet"', 'luca note list']
\`\`\`

### Supervising background workers across invocations

The complete start/status/stop shape: detach the workers so they outlive the CLI, persist their PIDs, and check liveness with signal 0. (\`processManager\` won't work here — its tracking is in-memory, per-process.)

\`\`\`js
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
\`\`\`

### Client commands must exit explicitly

A command that connects as a websocket/IPC client can keep the event loop alive after its work is done and hang forever. Disconnect and exit:

\`\`\`js
const answer = await client.ask({ type: 'time' })
console.log(answer)
await client.disconnect?.()
process.exit(0)
\`\`\`

### Secrets across invocations

\`vault.secret()\` mints a **new random key each process** — encrypt in one command, and the next command can't decrypt unless you persist the key and pass it back: \`container.feature('vault', { secret: savedKey })\`. (\`vault.secretText\` is also lazy — undefined until \`secret()\`/\`encrypt()\`/\`decrypt()\` has run once.)

### Reactive browser UIs (no build step)

You can build a full reactive front-end with **no bundler, no \`npm install\`, no build step** — put \`public/index.html\`, run \`luca serve\` (it serves \`public/\` static + \`endpoints/\` as a same-origin API, so no CORS). The pattern that scales, framework-agnostic at its core:

- **Import from esm.sh** — React (\`https://esm.sh/react@18.3.1\`), the web container (\`https://esm.sh/luca/web\`), anything. Use \`React.createElement\` (alias \`e\`) instead of JSX so there's nothing to compile.
- **A Luca feature *is* your store** — it already has \`this.state.get/set\` and \`emit/on/off\`. Mutate state, then \`this.emit('changed')\`. No Redux/Context needed.
- **The view subscribes to \`changed\`** — a ~6-line \`useFeatureVersion([feature])\` hook (\`f.on('changed', forceRerender)\`) re-renders React on every change. Plain DOM works too: a \`render()\` on \`changed\`. The store never references the view.
- **Layer as Api → Store → App** for anything real: Api does \`fetch\`/ws/SSE, Store holds state and emits, App orchestrates and exposes \`snapshot()\` (one atomic read for the view). Features compose via \`this.container.feature('...')\`.
- **Backend half:** \`endpoints/*.ts\` return JSON; the browser's web container reaches them with \`container.client('rest', { baseURL: '/api' })\`. Node-only work (\`fs\`, \`sqlite\`, \`git\`) lives behind endpoints — the web container doesn't have it.

Footguns: pin esm.sh versions; react-dom must resolve the *same* React (\`?deps=react@VERSION\` or an import map); \`emit('changed')\` after **every** mutation. Full walkthrough: \`references/tutorials/22-reactive-frontend.md\`.

To let a **server-side assistant drive** such a UI (call its actions as tools, live), the app's methods are exposed as \`static tools\` and reached over the \`containerLink\` WebSocket bridge (host \`eval\`s into the browser, \`await\`s the result) — same tool-provider pattern as any feature, plus one transport hop. See \`references/tutorials/23-assistant-driven-ui.md\`.

### Modeling state in markdown (frontmatter vs. body)

When designing a \`contentDb\` model (\`docs/models.ts\`), sort every field into one of two drawers — getting this right is what keeps the markdown worth reading:

- **Frontmatter = the index card.** Only what the *system* filters/sorts/joins on: \`status\` enums, tags, foreign-key slugs, timestamps, machine-written scalars (\`lastRanAt\`, \`costUsd\`), small flags. Scalars and short arrays — labels, not content.
- **Body sections = the substance.** Anything a human writes in sentences, lists, or code. A \`section('Heading', { extract, schema })\` makes a heading's prose a typed, validated, queryable field (\`instance.sections.motivation\`) — and a \`computed\` can turn a readable list into structured data (e.g. an execution DAG from a bulleted list of links). You get human-editable *and* machine-structured from one source.

Litmus test: *would you write it in a sentence? → body. Is it a label you filter on? → frontmatter.* If you're reaching for YAML \`|\` multi-line strings or nesting objects three deep, that's body content in the wrong drawer — it defeats the purpose of using markdown. Read is split too: \`db.query(Model).where('meta.status', …)\` on the cheap indexed drawer; \`contentDb.getDocument(id, { include: ['Findings'] })\` to pull one section. Write: \`doc.replaceSectionContent(heading, md)\` then \`doc.save()\` (whole-file atomic — no per-section save). Full walkthrough: \`references/tutorials/24-state-in-markdown.md\`.

## Framework Index

A table of contents for the container. **Run \`luca describe <name>\` for full docs on any item.** Use \`luca describe <name> --ts\` when you need type information. Source may not exist locally for built-in helpers — the compiled binary is the authority. For a flat, per-helper lookup table (name, category, stability, one-liner) see \`references/helper-index.md\`; to search by meaning use \`luca describe --query "..."\`.

<!-- BEGIN:GENERATED helper-tables (luca build-bootstrap regenerates this block from introspection — do not edit by hand) -->
### Features by Category

| Category | Features | What they do |
|----------|----------|--------------|
| **File System & Code** | \`fileManager\`, \`fs\`, \`grep\` | Read/write files, search code, watch for changes |
| **Process & Shell** | \`proc\`, \`processManager\`, \`scheduler\`, \`secureShell\`, \`tmux\` | Run commands, manage long-running processes, SSH |
| **AI Assistants** | \`assistant\`, \`assistantsManager\`, \`codingTools\`, \`conversation\`, \`conversationHistory\`, \`fileTools\`, \`mcpBridge\`, \`memory\`, \`modelProviders\`, \`telnyxAssistantConnector\`, \`voiceMode\` | Build AI assistants, manage conversations, tool calling |
| **AI Agent Wrappers** | \`claudeCode\`, \`claudeController\`, \`lucaCoder\`, \`openaiCodex\` | Spawn and manage external AI agent CLIs as subprocesses |
| **Data & Storage** | \`contentDb\`, \`diskCache\`, \`postgres\`, \`redis\`, \`sqlite\`, \`store\` | Cross-process state, databases, caching, document management |
| **Networking** | \`dns\`, \`ipcSocket\`, \`networking\` | HTTP clients and servers, sockets, DNS, network utilities |
| **Google Workspace** | \`googleAuth\`, \`googleCalendar\`, \`googleDocs\`, \`googleDrive\`, \`googleMail\`, \`googleSheets\` | OAuth and Google service wrappers |
| **Dev Tools** | \`docker\`, \`git\`, \`packageFinder\`, \`python\`, \`transpiler\`, \`vm\` | Version control, containers, bundling, sandboxed execution |
| **Content & NLP** | \`docsReader\`, \`jsonTree\`, \`nlp\`, \`semanticSearch\`, \`skillsLibrary\`, \`yamlTree\` | Document Q&A, text analysis, semantic search, structured file ingestion |
| **UI & Output** | \`ink\`, \`ui\`, \`yaml\` | Terminal UI, colors, ascii art, structured data display |
| **Media & Browser** | \`browserUse\`, \`cipherSocial\`, \`downloader\`, \`opener\`, \`telegram\`, \`tts\` | Browser automation, text-to-speech, downloads, messaging |
| **System** | \`containerLink\`, \`helpers\`, \`introspectionScanner\`, \`os\`, \`repl\`, \`runpod\`, \`socketRepl\`, \`vault\` | OS info, secrets, runtime introspection, remote container linking |

### Clients

| Client | Purpose |
|--------|---------|
| \`elevenlabs\` | ElevenLabs client — text-to-speech synthesis via the ElevenLabs REST API. |
| \`graph\` | GraphQL client that wraps RestClient with convenience methods for executing queries and mutations. |
| \`openai\` | OpenAI client — wraps the OpenAI SDK for chat completions, responses API, embeddings, and image generation. |
| \`rest\` | HTTP REST client built on top of axios. |
| \`socketio\` | Socket.IO client that bridges socket.io-client events to Luca's Helper event bus. |
| \`voicebox\` | VoiceBox client — local TTS synthesis via VoiceBox.sh REST API (Qwen3-TTS). |
| \`websocket\` | WebSocket client that bridges raw WebSocket events to Luca's Helper event bus, providing a clean interface for sending/receiving messages, tracking connection state (\`state.connected\`, \`state.reconnectAttempts\`), and optional auto-reconnection with exponential backoff (base \`reconnectInterval\`, doubled per attempt, capped at 30s, up to \`maxReconnectAttempts\`). |

### Servers

| Server | Purpose |
|--------|---------|
| \`express\` | Express.js HTTP server with automatic endpoint mounting, CORS, and SPA history fallback. |
| \`llmProxy\` | Runs a [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start) in a docker container, exposing every configured backend — local GPU boxes running OpenAI-compatible servers, LM Studio, paid APIs like OpenAI and Anthropic — behind a single OpenAI-compatible endpoint on \`http://localhost:<port>/v1\`. |
| \`mcp\` | MCP (Model Context Protocol) server for exposing tools, resources, and prompts to AI clients like Claude Code. |
| \`websocket\` | WebSocket server built on the \`ws\` library with optional JSON message framing. |
<!-- END:GENERATED helper-tables -->

\`fileTools\` composes lower-level features (\`fs\`, \`grep\`) into an assistant-ready tool surface — a good example of how features can define tools for assistants (see \`references/examples/feature-as-tool-provider.md\`).

### Type Discovery

\`luca describe <name> --ts\` outputs an approximate TypeScript representation of any helper as it exists at runtime — ~95% accurate. This is your go-to for writing type-safe code against the container. The binary compiles in the introspection data, so \`--ts\` reflects what actually exists at runtime even when source isn't available. Reading source can provide additional context when it's there.

\`\`\`shell
luca describe fs --ts              # approximate TS interface for the fs feature
luca describe conversation --ts    # conversation feature type surface
luca describe express --ts         # express server type shape
\`\`\`

If a method signature or return type looks wrong, verify with \`luca eval\`:

\`\`\`shell
luca eval "typeof container.feature('fs').readFile"
luca eval "container.feature('fs').readFile('package.json')"
\`\`\`

### Bundled Examples and Tutorials

The skill directory includes reference material:

- **\`references/examples/\`** — runnable composition patterns that combine multiple helpers. Every one executes via \`luca run <doc.md>\` and carries \`lastTested\`/\`lastTestPassed\` frontmatter from the test harness. For single-feature usage, use \`luca describe <name>\` instead — every helper's docs include per-method examples.
- **\`references/tutorials/\`** — longer-form guides covering the container, helpers, commands, endpoints, state/events, assistants, and more

Match your task to the catalog:

| You're building... | Run/read |
|---|---|
| A custom feature (schemas, state, events, discovery) | \`custom-feature-authoring.md\`, \`testing-a-composed-feature.md\` |
| A feature that gives an assistant tools | \`feature-as-tool-provider.md\`, \`assistant-with-process-manager.md\` |
| An HTTP API + client | \`full-stack-slice.md\`, \`server-rest-roundtrip.md\` |
| A reactive browser UI / dashboard (no build step) | \`references/tutorials/22-reactive-frontend.md\` (feature-as-store, React via esm.sh) |
| An assistant that drives a browser UI (calls its actions as tools) | \`references/tutorials/23-assistant-driven-ui.md\` (\`containerLink\` + \`static tools\`) |
| WebSocket messaging / request-reply | \`server-client-roundtrip-ws.md\`, \`websocket-ask-and-reply-example.md\` |
| An HTTP API + a WebSocket sidecar (live push from REST) | \`references/tutorials/25-express-websocket-sidecar.md\` (\`luca serve --setup\`) |
| Event-driven fan-out (in-process → ws → redis) | \`event-bus-fanout.md\` |
| A data pipeline or job queue | \`data-pipeline-fs-grep-sqlite.md\`, \`sqlite-job-queue.md\` |
| Cross-process state (which store?) | \`cross-process-state-handoff.md\` |
| A daemon, poll loop, or scheduled task | \`daemon-command.md\` |
| Search over documents | \`semantic-search-content-db.md\` |
| Designing a markdown doc model (what goes in frontmatter vs. body) | \`references/tutorials/24-state-in-markdown.md\` (the two-drawer rule) |
| Understanding how your code executes (VM, virtual modules, globals, entry points) | \`references/tutorials/26-the-vm.md\` (the execution contract) |
| Plugin systems / dynamic registries | \`meta-discovery.md\` |
| Lightweight stateful objects with tools | \`entity.md\` |
| Structured JSON output from a model | \`structured-output-with-assistants.md\` |
| Orchestrating Claude Code sessions | \`claude-controller-personas.md\` |
| Understanding how errors behave (returned vs thrown) | \`error-handling-conventions.md\` |

These complement \`luca describe\` — describe gives you the API surface and per-method examples, the example docs show multi-helper patterns in action, and tutorials walk through building things end to end.

**Tip:** Runnable markdown is a great artifact to produce when building with luca. \`luca run doc.md\` executes code blocks inside the Luca VM — useful for both testing and documentation. When prototyping a feature or writing a how-to, consider writing it as a markdown file that can be run.

### Container Primitives

| Primitive | Access | Purpose |
|-----------|--------|---------|
| State | \`container.state\`, \`helper.state\` | Observable key-value state on every object |
| Events | \`container.on()\`, \`helper.on()\` | Event bus on every object |
| Paths | \`container.paths\` | \`resolve()\`, \`join()\`, \`cwd\` |
| Utils | \`container.utils\` | \`uuid()\`, \`lodash\`, \`stringUtils\`, \`hashObject()\` |
| Registries | \`container.features\`, \`.clients\`, \`.servers\` | Discovery and metadata for all helpers |
`,
  "CLAUDE": `# Luca Project

This project uses the [Luca framework](https://github.com/soederpop/luca) — Lightweight Universal Conversational Architecture.

For a deep dive into the framework internals, see the [Luca GitHub repository](https://github.com/soederpop/luca).

## Runtime

The runtime is **bun**. Use \`bun run\` for scripts, \`bun test\` for tests.

## The \`luca\` CLI

The \`luca\` binary is available in the path. Key commands:

- \`luca\` — list available commands (built-in + project commands)
- \`luca eval "expression"\` — evaluate JS with the container in scope
- \`luca describe <name>\` — full docs for any feature, client, or server (e.g. \`luca describe fs\`)
- \`luca describe <name>.<member>\` — docs for a specific method or getter (e.g. \`luca describe ui.banner\`, \`luca describe fs.readFile\`)
- \`luca describe features\` — index of all available features (also: \`clients\`, \`servers\`)
- \`luca serve\` — start a local server using \`endpoints/\` folder
- \`luca run script.ts\` — run a script with the container
- \`luca scaffold <type> <name>\` — generate boilerplate for a new helper (run \`luca scaffold\` for full help)

## Container Rules

- **NEVER import from \`fs\`, \`path\`, or other Node builtins.** Use \`container.feature('fs')\` for file operations, \`container.paths\` for path operations.
- The container should provide everything you need. If something is missing, raise the concern rather than pulling in external dependencies.
- Use \`container.utils\` for common utilities (uuid, lodash helpers, string utils).

## Learning the Framework

1. **Discover** — Run \`luca describe features\`, \`luca describe clients\`, \`luca describe servers\` to see what's available. Then \`luca describe <name>\` for full docs on any helper (including per-method examples), or \`luca describe <name>.<member>\` to drill into a specific method or getter. This is your first move, always. (See \`.claude/skills/luca-framework/SKILL.md\` for the full mental model.)
2. **Build** — Check \`.claude/skills/luca-framework/references/examples/\` first: runnable multi-helper composition patterns (\`luca run <doc.md>\` executes one) — a working example beats fifty describes. Then \`luca scaffold <type> --tutorial\` before creating a new helper; it covers the full guide for that type.
3. **Prototype** — Use \`luca eval "expression"\` to test container code before wiring up full handlers. Reach for eval when you're stuck — it gives you full runtime access.
4. **Reference** — The skill file (\`.claude/skills/luca-framework/SKILL.md\`) includes a full Framework Index with every feature, client, and server organized by category, plus a task-to-example routing table. \`references/tutorials/\` holds the long-form guides.

## Project Structure

- \`commands/\` — custom CLI commands, run via \`luca <commandName>\` (auto-discovered)
- \`endpoints/\` — file-based HTTP routes, served via \`luca serve\` (auto-discovered)
- \`features/\`, \`clients/\`, \`servers/\` — custom container helpers, auto-discovered before any \`luca <command>\` dispatch (so commands can use project features directly). Opt out with \`LUCA_COMMAND_DISCOVERY=commands-only\`; for non-CLI entry points (scripts, embedded containers), call \`await container.helpers.discoverAll()\` yourself.
- \`docs/\` — content documents managed by the \`contentDb\` feature (\`container.docs\`). See [contentbase](https://github.com/soederpop/contentbase) for the document model system.
- \`luca.cli.ts\` — optional project-level CLI customization (runs before any command)

## Command Arguments

Command handlers receive \`(options, context)\`. The \`options\` object contains:
- **Named flags** from \`argsSchema\`: \`--verbose\` → \`options.verbose\`
- **Positional args** mapped via \`positionals\` export: \`luca cmd ./src\` → \`options.target\`
- **Raw positionals** in \`options._\`: array where \`_[0]\` is the command name, \`_[1+]\` are positional args. Type the handler's options as \`CommandArgs<typeof argsSchema>\` (from \`'luca'\`) to get \`_\` typed.

To accept positional arguments, export a \`positionals\` array that maps them to named fields in \`argsSchema\`:

\`\`\`ts
export const positionals = ['target']  // luca myCmd ./src => options.target === './src'
export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})
\`\`\`

A trailing \`'...rest'\` positional (or a trailing \`z.array(...)\` field) collects all remaining args as an array: \`positionals = ['action', '...files']\`.

Parsing agrees with the schema — boolean flags never consume a following positional (\`luca cmd --json foo\` keeps \`foo\` positional), and positionals arrive as strings coerced to what the field expects (\`z.string()\` accepts \`8080\`, \`z.number()\` accepts \`'8080'\` — no \`z.union\` workarounds needed).

## Command Help

\`luca <cmd> --help\` is generated from what the command declares — make it teach:
- **\`.describe()\` every argsSchema field** — powers the Options/Flags listing.
- **\`positionals\`** render as an \`Arguments:\` section (described via the matching schema field, or use the object form \`{ name, description, required }\` when there is no schema field).
- **\`export const examples = [...]\`** — strings or \`{ command, description }\` objects, rendered as an \`Examples:\` section.
- **\`export const subcommands = { verb: { args: '<name>', description, examples } }\`** — renders a \`Subcommands:\` section, and \`luca <cmd> <verb> --help\` shows focused help for that verb. Dispatch is still yours: map the verb via \`positionals\` and branch on it in the handler.

## What's Available

The container provides more than you might expect. Before importing anything external, check here:

- **YAML** — \`container.feature('yaml')\` wraps \`js-yaml\`. Use \`.parse(str)\` and \`.stringify(obj)\`.
- **SQLite** — \`container.feature('sqlite')\` for databases. Parameterized queries, tagged templates.
- **Cross-process state** — \`container.store('name', { schema })\` opens a durable JSON document in \`.luca/store/\` shared by all luca processes. \`await store.update(s => { s.count++ })\` is a locked read-modify-write (concurrent commands can't lose each other's writes); \`read()\` always re-reads. \`luca describe store\` for the full guide.
- **REST client** — \`container.client('rest', { baseURL })\`. Methods (\`get\`, \`post\`, etc.) return **parsed JSON directly**, not \`{ data, status, headers }\`. On HTTP errors, the error is returned (not thrown).
- **Content DB** — \`container.docs\` (alias for \`container.feature('contentDb')\`) manages markdown documents with frontmatter. Query with \`docs.query(docs.models.MyModel).fetchAll()\`.
- **Grep** — \`container.feature('grep')\` has \`search()\` and \`todos()\` for finding TODOs/FIXMEs/etc.
- **chalk** — available as \`container.feature('ui').colors\`, not via \`import('chalk')\`.
- **figlet** — available as \`container.feature('ui').asciiArt(text)\`.
- **uuid** — \`container.utils.uuid()\`
- **Scheduler** — \`container.feature('scheduler')\` for named recurring tasks: \`every('5m', fn)\`, \`cron('0 9 * * mon-fri', fn)\`, one-shots via \`at()\`/\`in()\`, and \`run()\` for the daemon lifecycle (holds the process open, stops all tasks on SIGINT/SIGTERM). Inspect \`scheduler.tasks\` for run counts and errors.
- **timing** — \`container.utils.sleep(ms)\`, \`container.utils.backoff(fn, { attempts, delay })\` (retry with exponential backoff), \`container.utils.every(ms, fn)\` (bare poll loop with no overlapping runs; returns \`stop()\`).
- **lodash** — \`container.utils.lodash\`. Exactly these: \`uniq\`, \`uniqBy\`, \`keyBy\`, \`groupBy\`, \`debounce\`, \`throttle\`, \`mapValues\`, \`mapKeys\`, \`pick\`, \`get\`, \`set\`, \`omit\`. Nothing else (no \`sortBy\`, \`orderBy\`, \`chunk\`, …) — use native array methods for the rest.
- **string utils** — \`container.utils.stringUtils\`. Exactly these: \`camelCase\`, \`kebabCase\`, \`upperFirst\`, \`lowerFirst\`, \`pluralize\`, \`singularize\`.

## Known Gotchas

- **For DELETE endpoint handlers, use \`export { del as delete }\`** — \`delete\` is a JS reserved word. Define your function with any name, then re-export it as \`delete\`.
- **Bun globals (\`Bun.spawn\`, \`Bun.serve\`) are unavailable** in command/endpoint handlers. Use Node's \`child_process\` for spawning processes, or use \`container.feature('proc').exec()\`.
- **\`ui.print.*\` writes to stdout** — if your command supports \`--json\`, gate UI output behind \`if (!options.json)\`.
- **\`ui.print.<color>()\` is not a string formatter** — it prints immediately and returns \`undefined\`, so \`\` \`\${ui.print.green('OK')}\` \`\` interpolates \`undefined\`. To compose colored strings, use \`ui.colors.<color>()\`, which returns the styled string. (\`ui.print\` mirrors every chalk color/style name that \`ui.colors\` has — but it always prints.)
- **Checking whether a PID is alive**: \`proc.kill(pid, 0)\` sends nothing and returns \`false\` if the process is gone (it doesn't throw) — the standard liveness check for PIDs persisted from an earlier run.
- **VM contexts start near-empty — and command/endpoint handlers run in that same VM.** JS built-ins (\`Promise\`, \`Date\`, \`Math\`, \`JSON\`) plus \`console\`, timers, \`process\`, \`Buffer\`, \`fetch\`, \`crypto\`, and \`TextEncoder\`/\`TextDecoder\` are provided; when you build your own context with \`container.feature('vm')\`, inject anything beyond that explicitly. zod is always importable (\`import { z } from 'zod'\`) — export schemas unconditionally. In \`luca eval\`, \`z\` and \`require\` are already in scope — prototype schemas directly.
- **Long-running commands** (servers, watchers) end with \`await context.runUntilShutdown(async () => { /* cleanup */ })\` — it holds the process open, wires SIGINT/SIGTERM, runs the cleanup (5s guard, second Ctrl-C exits immediately), and exits 0. Also on the container (\`container.runUntilShutdown\`) for \`luca run\` scripts. For recurring tasks, \`await container.feature('scheduler').run({ onShutdown })\` layers named intervals/cron on the same lifecycle.
- **Shared state between endpoints**: use \`ctx.request.app.locals\` to share data across endpoint files.
- **Database init**: use \`luca.cli.ts\` \`main()\` hook for table creation and seeding — it runs before any command or server starts.
- **Which store for cross-process state?** Every \`luca <command>\` is a separate process — never keep shared state in memory. In-process/ephemeral → \`container.state\`; **cross-process state → \`container.store(name)\`** (durable JSON document; \`update(fn)\` is a locked read-modify-write, so concurrent siblings can't clobber each other — never hand-roll a state dotfile); caches with TTL → \`diskCache\` (entries are losable by contract — not for state); queryable/relational/durable queues → \`sqlite\` (use \`transaction()\` and \`UPDATE … RETURNING\` for atomic job claims); cross-process pub/sub → \`redis\`.
- **Scheduling**: \`container.feature('scheduler')\` is the managed layer (named tasks, cron, run history, daemon \`run()\`); \`container.utils.every(ms, fn)\` / \`sleep(ms)\` / \`backoff(fn, opts)\` are the bare primitives when you don't need names or lifecycle. Neither ever overlaps runs of the same task.
- **\`paths.join()\` prepends \`container.cwd\` even when the first arg is absolute** — use \`paths.resolve(absPath, 'sub')\` when the base is already absolute (e.g. \`os.tmpdir\`); \`resolve\` behaves like Node's.
- **Colors silently disappear when stdout isn't a real TTY** — chalk auto-disables in pipes and sandboxed shells; this is not a bug in your command. Verify with \`FORCE_COLOR=1 luca yourCmd | cat -v\`.
- **\`useInput\` requires a TTY** (\`setRawMode\`) and crashes on piped stdin — guard with \`process.stdin.isTTY\` and fall back to \`process.on('SIGINT', ...)\`.
- **ink/react must be single-instance.** \`import React from 'react'\` and \`import { Text, useInput } from 'ink'\` in commands resolve to the runtime's own copies — use them freely alongside \`ink.components\`/\`ink.hooks\`/\`ink.render\`. Never add react or ink to a local \`node_modules\`: a second React copy breaks every hook ("Invalid hook call", \`isRawModeSupported === undefined\`).
- **\`fileManager.watch\` emits \`file:change\` before its own bookkeeping** — a handler that moves or deletes the file crashes the watcher's internal \`statSync\`; defer mutating work (\`setTimeout(() => processFile(e.path), 100)\`). Watching is recursive by default — filter by directory in your handler.
- **\`docs.models\` showing only \`["Base"]\`** means \`docs/models.ts\` failed to load *silently* — run \`bun docs/models.ts\` to see the real error (often package resolution).
- **Registry names are camelCase, files are kebab-case** (\`cipherSocial\` ↔ \`cipher-social.ts\`). Don't guess short names; when \`luca describe\` fails, its "Available:" list is authoritative.
- **Server options belong in the constructor** — \`container.server('websocket', { port: 8099, json: true })\`, then \`start()\`. If a server "isn't responding," verify the port it *actually* bound before debugging the client.
- **Builds can lie** — \`bun build --compile\` can exit 0 without writing the binary. Check the artifact exists on disk before reporting success.
- **Don't scaffold a custom client when a built-in speaks the protocol** (websocket, rest) — use it directly with your message conventions on top. If you do write one: \`afterInitialize()\` fires but is **not awaited** — do synchronous setup there and put connection work behind an explicit \`connect()\`.

## Extending the Container

Use \`luca scaffold\` to generate new helpers:

\`\`\`sh
luca scaffold command myTask --description "Automate something"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint users --description "User management API"
\`\`\`

Run \`luca scaffold\` with no arguments for full usage and examples.

## Assistants

\`luca scaffold assistant <name>\` creates \`assistants/<name>/\` — an assistant is just that folder:

- \`CORE.md\` — injected into the system prompt
- \`tools.ts\` — exports a \`schemas\` object (zod v4, keys = tool names) plus a matching exported function per key. The luca \`container\` is available as a **global** in tools.ts and hooks.ts (add \`declare const container: any\` for your editor).
- \`hooks.ts\` — exported functions named after assistant lifecycle events

At runtime \`assistant.tools.<name>\` is \`{ handler, parameters, description }\` — call \`assistant.tools.myTool.handler({...})\`, not \`assistant.tools.myTool()\`. Check what's registered with \`container.feature('assistantsManager').availableAssistants\`. Chat interactively with \`luca chat <name>\`.

## Shipping a Binary

\`luca bundle <name>\` compiles the whole project — features, commands, endpoints, and every \`assistants/\` folder with a CORE.md — into a standalone consumer binary at \`dist/<name>-<platform>\`:

\`\`\`sh
luca bundle fortune                          # darwin-arm64 by default
luca bundle fortune --targets darwin-arm64,linux-x64
luca bundle fortune --builtins eval,describe # opt in to luca built-ins
\`\`\`

- **Built-in luca commands are opt-in** via \`--builtins\` (only \`run\` is always included, and bundling assistants implies \`chat\` + \`assistant\`). If you skip \`eval\`/\`describe\`, the binary can't be introspected — you'd have to rebuild.
- **Verify from the binary itself**, not just the dev CLI:
  \`\`\`sh
  ./dist/<name>-<platform> <yourCommand>
  ./dist/<name>-<platform> run scripts/smoke.ts
  ./dist/<name>-<platform> eval "container.feature('assistantsManager').availableAssistants"   # needs --builtins eval
  \`\`\`
- Bundled assistants are embedded in the binary and materialized to \`~/.luca/bundles/<name>/assistants\` on first run — edits to your \`assistants/\` folder don't reach an already-built binary; rebundle.

## Git Strategy

Roll on main. Commit with good messages that explain why, not just what.
`
}

export const bootstrapTemplates: Record<string, string> = {
  "docs-models": `import { defineModel, z } from 'contentbase'

/**
 * Define your content models here. Each model maps to a folder prefix
 * inside the docs/ directory. Documents in those folders follow the
 * model's metadata schema.
 *
 * Access documents at runtime:
 *   const docs = container.docs          // contentDb feature
 *   if (!docs.isLoaded) await docs.load()
 *   const notes = await docs.query(docs.models.Note).fetchAll()
 *
 * See https://github.com/soederpop/contentbase for full documentation.
 */

export const Note = defineModel('Note', {
  prefix: 'notes',
  meta: z.object({
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published']).default('draft'),
  }),
})
`,
  "luca-cli": `/**
 * luca.cli.ts — Project-level CLI customization
 *
 * This file is automatically loaded by the \`luca\` CLI before any command runs.
 * Use it to:
 *
 * - Discover project-level helpers (features, commands, endpoints)
 * - Register custom context variables accessible in \`luca eval\`
 * - Set up project-specific container configuration
 *
 * Exports:
 *   main(container)    — called at CLI startup, before command execution
 *   onStart(container) — called when the container's 'started' event fires
 *
 * Example:
 *   export async function main(container: any) {
 *     await container.helpers.discoverAll()
 *     container.addContext('myFeature', container.feature('myFeature'))
 *   }
 */

export async function main(container: any) {
  // Project helpers (commands/, features/, clients/, servers/, endpoints/) are
  // auto-discovered by the CLI before dispatch — no discoverAll() needed here.
  // (Opt out with LUCA_COMMAND_DISCOVERY=commands-only.)

  // Handle unknown commands gracefully instead of silently failing
  container.onMissingCommand(async ({ phrase }: { phrase: string }) => {
    container.command('help').dispatch()
  })
}
`,
  "docs-readme": `# Docs

This folder contains structured content documents managed by the [contentbase](https://github.com/soederpop/contentbase) system.

## How it works

Documents are markdown files with YAML frontmatter. Each document belongs to a **model** defined in \`docs/models.ts\`. Models specify:
- A **prefix** (subfolder name, e.g. \`notes/\`)
- A **metadata schema** (validated frontmatter fields)

## Accessing documents at runtime

The \`contentDb\` feature (aliased to \`container.docs\`) loads and queries documents:

\`\`\`typescript
const docs = container.docs
if (!docs.isLoaded) await docs.load()

// Query all notes
const notes = await docs.query(docs.models.Note).fetchAll()

// Get a specific document
const doc = docs.collection('notes').document('my-note')
\`\`\`

## Creating a new document

Add a markdown file in the appropriate subfolder:

\`\`\`markdown
---
title: My First Note
tags: [example]
status: draft
---

Content goes here.
\`\`\`

## Learn more

- [Contentbase GitHub](https://github.com/soederpop/contentbase) — full documentation and API reference
- \`luca describe contentDb\` — runtime docs for the contentDb feature
`,
  "example-feature": `import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from 'luca'
import { Feature } from 'luca'
import type { ContainerContext } from 'luca'

declare module 'luca' {
  interface AvailableFeatures {
    example: typeof Example
  }
}

const ExampleStateSchema = FeatureStateSchema.extend({
  greetCount: z.number().default(0).describe('Number of times greet() has been called'),
})
type ExampleState = z.infer<typeof ExampleStateSchema>

const ExampleOptionsSchema = FeatureOptionsSchema.extend({})
type ExampleOptions = z.infer<typeof ExampleOptionsSchema>

/**
 * An example feature demonstrating the luca feature pattern.
 *
 * Discovered automatically by \`container.helpers.discoverAll()\`
 * and available as \`container.feature('example')\`.
 *
 * To learn more: \`luca scaffold feature --tutorial\`
 *
 * @example
 * \`\`\`typescript
 * const example = container.feature('example')
 * example.greet('Luca') // => "Hello, Luca! (greeting #1)"
 * \`\`\`
 */
export class Example extends Feature<ExampleState, ExampleOptions> {
  static override shortcut = 'features.example' as const
  static override stateSchema = ExampleStateSchema
  static override optionsSchema = ExampleOptionsSchema
  static override description = 'An example feature demonstrating the luca feature pattern'
  static { Feature.register(this, 'example') }

  /**
   * A simple method to show the feature works.
   * @param name - Name to greet
   * @returns Greeting string
   */
  greet(name = 'World') {
    const count = (this.state.get('greetCount') || 0) + 1
    this.state.set('greetCount', count)
    return \`Hello, \${name}! (greeting #\${count})\`
  }
}

export default Example
`,
  "about-command": `/**
 * about — Display project information and discovered helpers.
 * Run with: luca about
 *
 * Positional words after the command name are available as options._
 * For example: \`luca about commands\` → options._[1] === 'commands'
 */
import { z } from 'zod'
import type { ContainerContext, NodeContainer } from 'luca'

export const description = 'Display project information and discovered helpers'

export const argsSchema = z.object({})

export default async function about(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  // The runtime container is the full node container — cast for typed access
  const container = context.container as unknown as NodeContainer
  const ui = container.feature('ui')

  // Discover all project-level helpers (commands, features, endpoints, etc.)
  const discovered = await container.helpers.discoverAll()

  const projectName = container.paths.resolve('.').split('/').pop() || 'project'

  ui.print.cyan(\`\\n  \${projectName}\\n\`)
  ui.print('  Powered by luca — Lightweight Universal Conversational Architecture\\n')

  const types = ['features', 'clients', 'servers', 'commands', 'endpoints']

  for (const type of types) {
    const names = discovered[type] || []
    if (names.length > 0) {
      ui.print.green(\`  \${type} (\${names.length})\`)
      for (const name of names) {
        ui.print(\`    • \${name}\`)
      }
    }
  }

  // Assistants register through the assistantsManager rather than discoverAll —
  // this also lists assistants embedded in a bundled consumer binary.
  // (assistantsManager comes from the AGI layer, outside NodeContainer's typed features)
  const assistants = (container.feature as any)('assistantsManager').availableAssistants || []
  if (assistants.length > 0) {
    ui.print.green(\`  assistants (\${assistants.length})\`)
    for (const name of assistants) {
      ui.print(\`    • \${name}\`)
    }
  }

  // In a bundled consumer binary this command runs under that binary's name,
  // and describe/eval are only present when compiled in via --builtins.
  const binaryName = (container as any)._binaryName || 'luca'
  const totalBuiltIn = types.reduce((sum: number, t: string) => sum + ((container as any)[t]?.available?.length || 0), 0)
  const inspector = ['describe', 'eval'].find((cmd) => container.commands.has(cmd))
  const hint = inspector ? \` Run \\\`\${binaryName} \${inspector}\\\` for details.\` : ''
  ui.print.dim(\`\\n  \${totalBuiltIn} built-in helpers available.\${hint}\\n\`)
}
`,
  "health-endpoint": `/**
 * Health check endpoint.
 * Accessible at GET /api/health when you run \`luca serve\`.
 */
export const path = '/api/health'
export const description = 'Health check endpoint'
export const tags = ['health']

export async function get(_params: any, ctx: any) {
  return {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  }
}
`,
  "runme": `# Runnable Markdown

The \`luca\` CLI allows you to run markdown blocks as long as they're tagged with \`ts\` in the language.

\`\`\`ts
const banner = ui.banner('LUCA', {
    font: 'Puffy',
    colors: ['red','white','blue']
})

ui.print(banner)
\`\`\`

What is kind of cool is ( so long as there's no top-level-await in the block ) the context will preserve:

\`\`\`ts
if(typeof banner === 'undefined') {
    ui.print.red('uh oh, something broke.')
}
\`\`\`

You can skip blocks too with the skip tag in the language of the fenced block

\`\`\`ts skip
console.log('Not gonna say anything')
\`\`\`

Did you hear something? No.

Something even cooler is the ability to render React blocks.  This makes luca kind of like a poor man's MDX.  I just define some Blocks in the markdown by creating an h2 \`## Blocks\` section with a fenced codeblock that uses \`tsx\`. The \`ink.components\` and \`ink.React\` globals are injected into the scope.

## Blocks

\`\`\`tsx
const { Box, Text } = ink.components
const React = ink.React

function Greeting({ name, role }) {
  return (
    <Box borderStyle="round" padding={1}>
      <Text color="green" bold>Hello {name}!</Text>
      <Text dimColor> ({role})</Text>
    </Box>
  )
}
\`\`\`

## Rendering React Blocks

Then I can use the Blocks in code.

\`\`\`ts
await render('Greeting', { name: 'Jon', role: 'Humble Servant' })
\`\`\`
`
}

export const bootstrapExamples: Record<string, string> = {
  "meta-discovery.md": `---
title: 'Meta-Discovery: Building a Plugin System'
tags:
  - helpers
  - discovery
  - plugins
  - registry
  - commands
lastTested: '2026-07-05'
lastTestPassed: true
---

# Meta-Discovery: Building a Plugin System

The \`helpers\` feature isn't just how Luca loads your project's \`commands/\` folder — it's a composition point. Call \`discover(type, { directory })\` once per plugin folder and you have a plugin system: each plugin ships its own \`commands/\`, and they all land in the same registry. This is exactly how \`assistantsManager\` loads per-assistant helpers in production.

## Fake up two plugins

Each plugin is just a folder with a \`commands/\` directory inside. One of our plugins ships commands; the other doesn't — which must be fine.

\`\`\`ts
const fs = container.feature('fs')
const base = container.paths.resolve('tmp', 'meta-discovery-plugins')

fs.ensureFolder(container.paths.resolve(base, 'analytics', 'commands'))
fs.writeFile(container.paths.resolve(base, 'analytics', 'commands', 'track.ts'), \`
export const description = 'Track an analytics event'
export default async function track() { return 'tracked!' }
\`)
fs.writeFile(container.paths.resolve(base, 'analytics', 'commands', 'report.ts'), \`
export const description = 'Generate an analytics report'
export default async function report() { return 'reported!' }
\`)

// the billing plugin declares no commands folder at all
fs.ensureFolder(container.paths.resolve(base, 'billing'))

console.log('plugins created under', base)
\`\`\`

## Discover each plugin's commands

\`discover(type, { directory })\` scans any folder — not just the conventional project locations — and registers what it finds. A plugin with no \`commands/\` folder simply yields \`[]\`; it is not an error.

\`\`\`ts
const helpers = container.feature('helpers')

const fromAnalytics = await helpers.discover('commands', {
  directory: container.paths.resolve(base, 'analytics', 'commands'),
})
console.log('analytics plugin registered:', fromAnalytics)

const fromBilling = await helpers.discover('commands', {
  directory: container.paths.resolve(base, 'billing', 'commands'),
})
console.log('billing plugin registered:', fromBilling)
\`\`\`

## Enumerate the registry — with .available, not Object.keys()

Registries are class instances — \`Object.keys(container.commands)\` returns internals like \`["scope", "baseClass"]\`, never the registered names. The accessor you want is \`.available\`.

\`\`\`ts
console.log('Object.keys(container.commands):', Object.keys(container.commands))
console.log('container.commands.available:', container.commands.available.filter(n => ['track', 'report'].includes(n)))
\`\`\`

## Run a discovered command

Everything discovered is a first-class registry member — dispatch it headlessly like any built-in, or from the CLI as \`luca track\`.

\`\`\`ts
const cmd = container.command('track')
const result = await cmd.dispatch({}, 'headless')
console.log('track() →', JSON.stringify(result))
\`\`\`

## Cleanup

\`\`\`ts
await fs.rmdir(base)
console.log('cleaned up')
\`\`\`

## The generalized plugin loader

The loop that turns this into a real plugin system — point it at a folder of plugin folders. Discovery results are cached per directory, so calling it twice is free. (Shown, not executed.)

\`\`\`ts skip
const fs = container.feature('fs')
const helpers = container.feature('helpers')
const pluginsRoot = container.paths.resolve('plugins')

for (const plugin of fs.readdirSync(pluginsRoot)) {
  // each plugin may ship commands/, endpoints/, features/ — all optional
  for (const type of ['commands', 'endpoints', 'features']) {
    const names = await helpers.discover(type, {
      directory: container.paths.resolve(pluginsRoot, plugin, type),
    })
    if (names.length) console.log(\`[\${plugin}] loaded \${type}:\`, names)
  }
}
\`\`\`

For loading a single module file (a plugin manifest, say) use \`helpers.loadModuleExports(absPath)\` instead of a raw dynamic \`import()\` — it works both in dev and inside the compiled \`luca\` binary, where project files must load through the VM.

## Summary

\`helpers.discover(type, { directory })\` per plugin folder = a plugin system with no new machinery: missing folders yield \`[]\`, results cache per directory, and everything lands in the standard registries. Enumerate registries with \`.available\` (never \`Object.keys()\`), and load one-off modules with \`helpers.loadModuleExports()\` so the compiled binary stays happy.
`,
  "data-pipeline-fs-grep-sqlite.md": `---
title: 'Data Pipeline: grep → normalize → SQLite'
tags:
  - pipeline
  - grep
  - sqlite
  - fs
  - data
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Data Pipeline: grep → normalize → SQLite

A recurring shape: scan something with \`grep\`/\`fs\`, normalize the hits in plain JavaScript, load them into SQLite, then answer questions with SQL. The store-choice heuristic that drives it: **the moment you want to ask questions of your data — group it, count it, filter it, join it — put it in \`sqlite\`**. \`diskCache\` is for opaque values you fetch by key; container state is for in-process wiring. Anything *queryable* belongs in a database, and the \`sqlite\` feature makes that a one-liner.

This pipeline scans this repo's \`src/\` tree for code annotations (TODO, FIXME, HACK, XXX), loads them into a temp database, and asks it questions. Run \`luca describe grep\` and \`luca describe sqlite\` for the full API of each helper.

## Extract — scan the codebase with grep

\`grep.todos()\` is a canned search for \`TODO|FIXME|HACK|XXX\` that returns structured \`{ file, line, column, content }\` matches with paths relative to the container cwd. One caveat worth knowing: it matches the words *anywhere on the line* — including inside string literals and generated documentation — not just in comments. We'll deal with that in the normalize step.

\`\`\`ts
// bare assignment (no const) — hits survives into the later blocks
hits = await grep.todos({ path: 'src', include: '*.ts' })
console.log(\`raw hits in src/: \${hits.length}\`)
console.log('first hit:', JSON.stringify(hits[0]))
\`\`\`

(\`grep\`, \`fs\`, and \`os\` are already in scope in these runnable docs — the container injects its context. In your own scripts, \`container.feature('grep')\` gets you the same instance.)

## Transform — normalize the raw matches

Raw grep output is not yet *data*. Each row we load should carry the fields we'll want to query by: which tag, which file, which top-level area of the codebase. This is also where we drop noise — generated build artifacts (\`*generated*.ts\`) mention TODO in prose constantly, and they're not actionable annotations.

\`\`\`ts
const TAG = /\\b(TODO|FIXME|HACK|XXX)\\b/

annotations = hits
  .filter(h => !/generated/.test(h.file))
  .map(h => ({
    tag: h.content.match(TAG)[1],
    file: h.file,
    line: h.line,
    area: h.file.split('/').slice(0, 2).join('/'),
    text: h.content.trim().slice(0, 160),
  }))

if (annotations.length === 0) throw new Error('expected at least one annotation in src/')
console.log(\`normalized: \${annotations.length} annotations (dropped \${hits.length - annotations.length} from generated files)\`)
\`\`\`

## Load — bulk insert into a temp SQLite database

Use a real file in the OS temp dir — \`container.paths.resolve(os.tmpdir, ...)\`, **not** \`paths.join\`, which prepends the cwd even to absolute paths. For the bulk insert, \`db.transaction()\` with a prepared statement is the fast, all-or-nothing idiom: the transaction function must be synchronous, so we use the raw \`db.db\` prepared statement inside it.

\`\`\`ts
dbPath = container.paths.resolve(os.tmpdir, \`annotations-\${Date.now()}.sqlite\`)
db = container.feature('sqlite', { path: dbPath })

db.db.exec(\`
  CREATE TABLE annotations (
    id INTEGER PRIMARY KEY,
    tag TEXT NOT NULL,
    file TEXT NOT NULL,
    line INTEGER NOT NULL,
    area TEXT NOT NULL,
    text TEXT NOT NULL
  )
\`)

db.transaction(() => {
  const insert = db.db.query(\`INSERT INTO annotations (tag, file, line, area, text) VALUES (?, ?, ?, ?, ?)\`)
  for (const a of annotations) insert.run(a.tag, a.file, a.line, a.area, a.text)
})

const [{ n }] = await db.sql\`SELECT COUNT(*) AS n FROM annotations\`
if (n !== annotations.length) throw new Error(\`loaded \${n}, expected \${annotations.length}\`)
console.log(\`loaded \${n} rows into \${dbPath}\`)
\`\`\`

## Query — answer questions with tagged-template SQL

This is the payoff. Questions that would be awkward loops over an array are one \`GROUP BY\` away. \`db.sql\` is a tagged template — every \`\${value}\` becomes a bound \`?\` parameter automatically, so there's no injection risk and no placeholder wiring.

\`\`\`ts
byTag = await db.sql\`
  SELECT tag, COUNT(*) AS count
  FROM annotations
  GROUP BY tag
  ORDER BY count DESC
\`
console.log('annotations by tag:', JSON.stringify(byTag))

const hotspots = await db.sql\`
  SELECT area, COUNT(*) AS count
  FROM annotations
  GROUP BY area
  ORDER BY count DESC
  LIMIT 3
\`
console.log('busiest areas:', JSON.stringify(hotspots))
\`\`\`

Interpolated values are bound, not spliced — filter by whatever the previous step produced:

\`\`\`ts
const topTag = byTag[0].tag

const examples = await db.sql\`
  SELECT file, line, text
  FROM annotations
  WHERE tag = \${topTag}
  ORDER BY file, line
  LIMIT 3
\`
console.log(\`sample \${topTag} annotations:\`)
for (const e of examples) console.log(\`  \${e.file}:\${e.line}  \${e.text.slice(0, 80)}\`)
\`\`\`

## Verify — SQL and JavaScript agree

A pipeline you can't cross-check is a pipeline you can't trust. \`container.utils.lodash.groupBy\` gives us the same aggregation on the in-memory array — the two views of the data must match.

\`\`\`ts
const { groupBy } = container.utils.lodash
const jsCounts = groupBy(annotations, 'tag')

for (const row of byTag) {
  const expected = jsCounts[row.tag].length
  if (row.count !== expected) throw new Error(\`mismatch for \${row.tag}: sql=\${row.count} js=\${expected}\`)
}

const sqlTotal = byTag.reduce((sum, r) => sum + r.count, 0)
if (sqlTotal !== annotations.length) throw new Error('totals diverged')
console.log(\`verified: SQL GROUP BY matches lodash groupBy across \${byTag.length} tags, \${sqlTotal} rows total\`)
\`\`\`

## Clean up

Close the connection and remove the temp database file — a pipeline that leaves artifacts behind isn't finished.

\`\`\`ts
db.close()
await fs.rm(dbPath)
if (fs.exists(dbPath)) throw new Error('db file should have been removed')
console.log('closed connection and removed', dbPath)
\`\`\`

## Summary

The pipeline shape is always the same: **extract** with a scanning helper (\`grep.search\`/\`grep.todos\`, \`fs\`), **transform** with plain JavaScript into rows that carry your query dimensions, **load** with \`db.transaction()\` + a prepared statement, **query** with \`db.sql\` tagged templates. The heuristic to internalize: as soon as "look at the data" means grouping, counting, or filtering, stop reaching for \`Array.prototype\` gymnastics or a KV store — load it into \`sqlite\` and ask in SQL.
`,
  "sqlite-job-queue.md": `---
title: SQLite Job Queue Worker
tags:
  - sqlite
  - queue
  - worker
  - transaction
  - returning
  - wal
lastTested: '2026-07-05'
lastTestPassed: true
---

# SQLite Job Queue Worker

A durable job queue needs exactly two SQLite tricks the docs rarely lead with: \`UPDATE … RETURNING\` to claim a job atomically in one statement, and \`transaction()\` for multi-statement all-or-nothing work. With WAL mode, several worker processes can share one queue file safely.

## Create the queue

\`\`\`ts
const db = container.feature('sqlite', { path: ':memory:' })

// For a real multi-process queue use a file path — and WAL mode, so readers
// never block the writer: db.db.exec('PRAGMA journal_mode = WAL')

db.db.exec(\`
  CREATE TABLE jobs (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'pending',
    payload TEXT NOT NULL,
    claimed_at TEXT,
    finished_at TEXT
  )
\`)
console.log('queue table created')
\`\`\`

## Enqueue some work

\`\`\`ts
await db.execute(\`INSERT INTO jobs (payload) VALUES (?), (?), (?)\`, [
  JSON.stringify({ task: 'send-email', to: 'a@example.com' }),
  JSON.stringify({ task: 'resize-image', file: 'photo.jpg' }),
  JSON.stringify({ task: 'sync-crm' }),
])

const pending = await db.query(\`SELECT COUNT(*) AS n FROM jobs WHERE status = 'pending'\`)
console.log('pending jobs:', pending[0].n)
\`\`\`

## Claim a job atomically with UPDATE … RETURNING

This is the heart of the worker. One statement finds the oldest pending job, marks it running, and hands it back — no read-then-write race, no explicit transaction needed. Two workers running this concurrently can never claim the same job.

\`\`\`ts
const claimed = await db.query(\`
  UPDATE jobs
  SET status = 'running', claimed_at = datetime('now')
  WHERE id = (
    SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1
  )
  RETURNING id, payload
\`)

console.log('claimed job:', claimed[0].id, '→', JSON.parse(claimed[0].payload).task)
\`\`\`

An empty array means the queue is drained — that's the worker's signal to idle.

## Multi-statement work: transaction()

When finishing a job touches more than one row, wrap it in \`transaction()\` — it commits when the function returns, rolls back if it throws. The function must be synchronous (bun:sqlite transactions don't span awaits), so use the raw \`db.db\` prepared statements inside.

\`\`\`ts
const [job] = await db.query(\`SELECT id FROM jobs WHERE status = 'running' LIMIT 1\`)

db.transaction(() => {
  db.db.query(\`UPDATE jobs SET status = 'done', finished_at = datetime('now') WHERE id = ?\`).run(job.id)
  db.db.query(\`INSERT INTO jobs (payload) VALUES (?)\`).run(JSON.stringify({ task: 'send-receipt' }))
})

const counts = await db.query(\`SELECT status, COUNT(*) AS n FROM jobs GROUP BY status ORDER BY status\`)
console.log('queue state:', JSON.stringify(counts))
\`\`\`

If anything inside throws, neither statement lands:

\`\`\`ts
try {
  db.transaction(() => {
    db.db.query(\`UPDATE jobs SET status = 'cancelled' WHERE status = 'pending'\`).run()
    throw new Error('something went wrong mid-job')
  })
} catch (err) {
  console.log('rolled back:', err.message)
}

const counts2 = await db.query(\`
  SELECT
    SUM(status = 'cancelled') AS cancelled,
    SUM(status = 'pending') AS pending
  FROM jobs
\`)
console.log(\`cancelled: \${counts2[0].cancelled}, pending: \${counts2[0].pending} — the UPDATE never landed\`)
\`\`\`

## The worker loop

The complete worker command shape — poll with \`utils.every\`, claim with RETURNING, guard single-instance with \`proc.establishLock\`. (Shown, not executed — it runs forever. See the *Daemon & Poll-Loop Commands* example for the lifecycle details.)

\`\`\`ts skip
export default async function worker(options, context) {
  const { container } = context
  container.feature('proc').establishLock('tmp/worker.pid')

  const db = container.feature('sqlite', { path: 'queue.db' })
  db.db.exec('PRAGMA journal_mode = WAL')

  const stop = container.utils.every(5000, async () => {
    const [job] = await db.query(\`
      UPDATE jobs SET status = 'running', claimed_at = datetime('now')
      WHERE id = (SELECT id FROM jobs WHERE status = 'pending' ORDER BY id LIMIT 1)
      RETURNING id, payload
    \`)
    if (!job) return // queue drained — idle until the next tick

    await processJob(JSON.parse(job.payload))
    await db.execute(\`UPDATE jobs SET status = 'done', finished_at = datetime('now') WHERE id = ?\`, [job.id])
  }, { immediate: true, onError: (err) => console.error('worker tick failed:', err) })

  process.on('SIGINT', () => { stop(); process.exit(0) })
  await new Promise(() => {})
}
\`\`\`

## Summary

\`UPDATE … RETURNING\` claims jobs atomically in one statement — the idiom that makes SQLite a real queue. \`transaction()\` covers multi-statement commits with automatic rollback. Add WAL mode for multi-process access, \`utils.every\` for the poll loop, and \`proc.establishLock\` for single-instance workers.
`,
  "server-client-roundtrip-ws.md": `---
title: 'Server ↔ Client Roundtrip: WebSockets'
tags:
  - websocket
  - servers
  - clients
  - ask
  - reply
  - broadcast
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Server ↔ Client Roundtrip: WebSockets

The websocket server and websocket client are **paired helpers**: \`container.server('websocket')\` speaks the same framing as \`container.client('websocket')\`, so you get JSON messages, connection state, and an \`ask()\`/\`reply()\` request-response protocol without writing any correlation plumbing yourself. This doc runs the whole conversation in one process: plain send/receive, asks in both directions, error replies, timeouts, broadcast to multiple clients, and clean shutdown.

For each helper's full API: \`luca describe servers.websocket\`, \`luca describe clients.websocket\`.

## Create the server and wire handlers

With \`json: true\` the server JSON-parses incoming messages before emitting its \`message\` event (handler signature: \`(data, ws)\`). Any message that arrives with a \`requestId\` gets \`reply()\` and \`replyError()\` helpers attached — that is the server half of the ask protocol.

\`\`\`ts
// bare assignments (no const) so these survive into later blocks
server = container.server('websocket', { json: true })

server.on('message', (data, ws) => {
  if (data.type === 'add') {
    data.reply({ sum: data.data.a + data.data.b })
  } else if (data.type === 'divide') {
    if (data.data.b === 0) data.replyError('division by zero')
    else data.reply({ result: data.data.a / data.data.b })
  }
})
console.log('server created and handlers wired')
\`\`\`

## Start it, connect a client

\`start({ port })\` overrides any constructor port. The client's \`connect()\` resolves once the socket is open, and \`state.connected\` tracks the connection from then on.

\`\`\`ts
port = await networking.findOpenPort(19910)
await server.start({ port })
if (server.state.get('listening') !== true) throw new Error('server did not report listening')

client = container.client('websocket', { baseURL: \`ws://localhost:\${port}\` })
await client.connect()
if (client.state.get('connected') !== true) throw new Error('client did not report connected')
console.log('server listening on', port, '— client connected')
\`\`\`

## Plain send and receive

Fire-and-forget messages flow through each side's \`message\` event. Every helper has \`waitFor(event)\` — a promise for the next emission (it resolves with the first listener argument). Create the promise **before** sending, or you race the delivery.

\`\`\`ts
// client -> server
const arrived = server.waitFor('message')
await client.send({ type: 'ping', at: 42 })
const msg = await arrived
if (msg.type !== 'ping' || msg.at !== 42) throw new Error('server did not receive the ping payload intact')

// server -> client: server.send(ws, data) targets one connection
const pushed = client.waitFor('message')
await server.send([...server.connections][0], { type: 'pong', at: 43 })
const back = await pushed
if (back.type !== 'pong' || back.at !== 43) throw new Error('client did not receive the pong payload intact')

console.log('roundtrip verified: ping', msg.at, '/ pong', back.at)
\`\`\`

## The client asks, the server replies

\`ask(type, data, timeout?)\` sends a message with a generated \`requestId\` and returns a promise for the correlated reply's \`data\`. On the server, \`data.reply(payload)\` answers it. You never touch \`requestId\`/\`replyTo\` yourself.

\`\`\`ts
const sum = await client.ask('add', { a: 3, b: 4 })
if (sum.sum !== 7) throw new Error(\`ask('add') returned \${JSON.stringify(sum)}\`)

const quotient = await client.ask('divide', { a: 10, b: 4 })
if (quotient.result !== 2.5) throw new Error(\`ask('divide') returned \${JSON.stringify(quotient)}\`)

console.log('3 + 4 =', sum.sum, '| 10 / 4 =', quotient.result)
\`\`\`

## Error replies reject the ask

Unlike the rest client (which *returns* errors), \`ask()\` failures **throw**: a \`replyError(message)\` from the server rejects the pending promise with that message.

\`\`\`ts
let caught = null
try {
  await client.ask('divide', { a: 1, b: 0 })
} catch (err) {
  caught = err
}
if (!caught || !caught.message.includes('division by zero')) {
  throw new Error('replyError did not reject the ask with the server message')
}
console.log('error reply rejected the ask:', caught.message)
\`\`\`

## The server asks the client

The protocol is symmetric. A server-initiated ask arrives at the client as a normal \`message\` carrying a \`requestId\`; the client answers by echoing it back as \`replyTo\`. The server addresses a specific socket from its \`connections\` set.

\`\`\`ts
client.on('message', (data) => {
  if (data.requestId && data.type === 'whoAreYou') {
    client.send({ replyTo: data.requestId, data: { name: 'roundtrip-client', version: '1.0' } })
  }
})

const identity = await server.ask([...server.connections][0], 'whoAreYou')
if (identity.name !== 'roundtrip-client') throw new Error('server.ask did not get the client identity')
console.log('client identified itself as', identity.name, identity.version)
\`\`\`

## Timeouts

If nobody replies, \`ask()\` rejects after the timeout (default 10s, configurable as the third argument). Our server has no handler for \`noop\`, so nothing answers.

\`\`\`ts
try {
  await client.ask('noop', {}, 500)
  throw new Error('ask should have timed out')
} catch (err) {
  if (!err.message.includes('timed out')) throw err
  console.log('timed out as expected:', err.message)
}
\`\`\`

## Broadcast to every connected client

\`broadcast(data)\` sends to all connections. One memoization gotcha: helper factories cache per id + options, so \`container.client('websocket', { baseURL })\` with identical options returns the **same instance**. Give the second client a distinguishing option (like \`name\`) to get a genuinely separate socket.

\`\`\`ts
client2 = container.client('websocket', { baseURL: \`ws://localhost:\${port}\`, name: 'second' })
await client2.connect()
if (server.connections.size !== 2) throw new Error(\`expected 2 connections, server sees \${server.connections.size}\`)

const first = client.waitFor('message')
const second = client2.waitFor('message')
await server.broadcast({ type: 'announcement', text: 'hello everyone' })

const [gotFirst, gotSecond] = await Promise.all([first, second])
if (gotFirst.text !== 'hello everyone') throw new Error('client 1 missed the broadcast')
if (gotSecond.text !== 'hello everyone') throw new Error('client 2 missed the broadcast')
console.log('both clients received the broadcast')
\`\`\`

## Disconnect and stop

An open socket keeps the event loop alive — a CLI command that skips this step hangs forever. \`disconnect()\` suppresses auto-reconnect and rejects any in-flight asks; \`stop()\` terminates remaining connections and closes the server.

\`\`\`ts
await client.disconnect()
await client2.disconnect()
if (client.state.get('connected') !== false) throw new Error('client 1 still reports connected')
if (client2.state.get('connected') !== false) throw new Error('client 2 still reports connected')

await server.stop()
if (server.state.get('listening') !== false) throw new Error('server still reports listening')
console.log('clients disconnected, server stopped')
\`\`\`

## Summary

One paired protocol, both directions: \`send()\` for fire-and-forget, \`ask()\`/\`reply()\`/\`replyError()\` for request-response (correlation IDs handled for you), \`broadcast()\` for fan-out, and \`waitFor(event)\` to await deliveries without callback bookkeeping. Asks **throw** on error and timeout — the opposite convention from the rest client, which returns errors as values. And always \`disconnect()\` + \`stop()\` at the end, or the process never exits.
`,
  "entity.md": `---
title: Entity
tags:
  - entity
  - state
  - events
  - tools
  - core
lastTested: '2026-07-05'
lastTestPassed: true
---

# entity

Lightweight, composable objects with observable state, a typed event bus, and an optional tool interface.

## Overview

An entity is a plain object — not a class — created via \`container.entity(id, options?)\`. Same id + options always returns the same underlying state and bus instance. Entities are designed to be extended with methods and getters via \`.extend()\`, and can expose those methods as AI tools via \`.expose()\`.

## Basic Entity with Observable State

Create an entity and read/write state through the observable \`state\` property.

\`\`\`ts
const counter = container.entity<{ count: number }>('counter')
counter.setState({ count: 0 })

counter.state.observe((next) => {
  console.log('count changed to', next.count)
})

counter.setState(s => ({ count: s.count + 1 }))
counter.setState(s => ({ count: s.count + 1 }))
console.log('final count:', counter.state.get('count'))
\`\`\`

\`setState\` accepts either a partial object or a function that receives the current state. Observers fire synchronously after each change.

## Typed Event Bus

Every entity has a built-in event bus. Declare the event map as the third type parameter.

\`\`\`ts
type TimerEvents = {
  tick: [elapsed: number]
  done: []
}

const timer = container.entity<{}, {}, TimerEvents>('timer')

timer.on('tick', (elapsed) => {
  console.log('tick at', elapsed, 'ms')
})

timer.once('done', () => {
  console.log('timer finished')
})

timer.emit('tick', 100)
timer.emit('tick', 200)
timer.emit('done')
\`\`\`

\`once\` auto-detaches after the first fire. \`waitFor\` returns a promise that resolves on the next emit of that event.

## Extending with Methods

Use \`.extend()\` to graft methods and getters onto an entity. All base properties — \`state\`, \`options\`, \`container\`, and the event methods — are available via \`this\`.

\`\`\`ts
const session = container.entity('session', { userId: '42' })
  .extend({
    greet() {
      return \`Hello user \${this.options.userId}\`
    },
    get label() {
      return \`Session \${this.id} (user \${this.options.userId})\`
    },
    bump() {
      const visits = (this.state.get('visits') ?? 0) + 1
      this.setState({ visits })
      this.emit('visited', visits)
      return visits
    },
  })

console.log(session.greet())
console.log(session.label)
console.log('visits:', session.bump())
console.log('visits:', session.bump())
\`\`\`

Extensions are chained via prototype delegation — each layer can see everything below it.

## Exposing Methods as AI Tools

Use \`.expose(methodName, zodSchema)\` to register methods as tools. \`.toTools()\` returns \`{ schemas, handlers }\` compatible with \`assistant.addTools()\`.

\`\`\`ts
const search = container.entity('search', {})
  .extend({
    async lookup({ query }: { query: string }) {
      return \`Results for: \${query}\`
    },
    async summarize({ text, maxWords }: { text: string; maxWords: number }) {
      return text.split(' ').slice(0, maxWords).join(' ')
    },
  })
  .expose('lookup', z.object({
    query: z.string().describe('The search query'),
  }))
  .expose('summarize', z.object({
    text: z.string().describe('Text to summarize'),
    maxWords: z.number().describe('Maximum words in summary'),
  }))

const { schemas, handlers } = search.toTools()
console.log('registered tools:', Object.keys(schemas))

// Pass directly to an assistant
// assistant.addTools(search)
\`\`\`

\`.expose()\` is chainable and returns \`this\`, so you can stack as many as you need.

## Summary

Entities give you observable state, a typed event bus, and prototype-safe method extension — all as a plain object with no class overhead. The \`.expose()\` / \`.toTools()\` interface makes it straightforward to surface entity methods as AI tools.
`,
  "assistant-with-process-manager.md": `---
title: Assistant with ProcessManager Tools
tags:
  - assistant
  - processManager
  - tools
  - runtime
  - use
lastTested: '2026-07-05'
lastTestPassed: true
---

# Assistant with ProcessManager Tools

Create an assistant at runtime, give it processManager tools via \`assistant.use()\`, and let it orchestrate long-running processes — spawning ping and top, checking their output over time, running a quick command in between, then coming back to report.

## Wire the tools (no API key needed)

\`assistant.use(feature)\` registers the feature's tool surface immediately — the tool schemas, bound handlers, and system-prompt extension all exist before any model is involved. That makes the wiring verifiable without credentials:

\`\`\`ts
pm = container.feature('processManager', { enable: true, autoCleanup: true })

assistant = container.feature('assistant', {
  systemPrompt: [
    'You are a process management assistant with tools to spawn, monitor, inspect, and kill background processes.',
    'When asked to check on processes, use getProcessOutput to read their latest output and summarize what you see.',
    'For ping output, parse the lines and calculate the average response time yourself.',
    'For top output, summarize CPU and memory usage from the header lines.',
    'Always be concise — give the data, not a lecture.',
  ].join('\\n'),
  model: 'gpt-4.1-mini',
})

assistant.use(pm)

const tools = Object.keys(assistant.tools)
console.log('Tools registered:', tools.join(', '))
if (tools.length === 0) throw new Error('assistant.use(pm) registered no tools')
\`\`\`

## The conversation demo

Driving the conversation calls the model, so this part needs an \`OPENAI_API_KEY\`:

\`\`\`ts skip
await assistant.start()
const ui = container.feature('ui')

// ── Helper to print assistant responses ──────────────────────────────
const ask = async (label, question) => {
  console.log(ui.colors.dim(\`── \${label} ──\`))
  console.log(ui.colors.yellow('→'), question.split('\\n')[0])
  const response = await assistant.ask(question)
  console.log(ui.markdown(response))
  console.log()
  return response
}

// Step 1: Spawn long-running processes
await ask('SPAWN',
  'Spawn two background processes:\\n' +
  '1. Ping google.com with tag "ping-google" (use: ping -c 20 google.com)\\n' +
  '2. Run top in batch mode with tag "top-monitor" (use: top -l 5 -s 2)\\n' +
  'Confirm both are running.'
)

// Step 2: Wait, then check in on their output
await new Promise(r => setTimeout(r, 4000))
await ask('CHECK-IN #1',
  'Check on both processes. For ping-google, read the stdout and tell me how many replies so far and the average response time. For top-monitor, read the stdout and tell me the current CPU usage summary.'
)

// Step 3: Quick one-shot command while the others keep going
await ask('QUICK COMMAND',
  'Run a quick command: "uptime" — tell me the system load averages.'
)

// Step 4: Second check-in — more data should have accumulated
await new Promise(r => setTimeout(r, 4000))
await ask('CHECK-IN #2',
  'Check on ping-google again. How many replies now vs last time? What is the average response time? Also list all tracked processes and their status.'
)

// Step 5: Kill everything
await ask('CLEANUP',
  'Kill all running processes and confirm they are stopped.'
)
\`\`\`

## Cleanup always works headlessly

The tools the assistant would call are just processManager methods — call them directly to prove the surface is live:

\`\`\`ts
pm.killAll()
const remaining = pm.list().filter(h => h.status === 'running')
console.log('Running after cleanup:', remaining.length)
if (remaining.length !== 0) throw new Error('processes survived killAll')
\`\`\`

## Summary

The runnable part proves the composition: a runtime assistant wired with processManager tools, verified without a model call. The skipped conversation shows what it looks like driven end to end — spawning long-running \`ping\` and \`top\` commands, checking in on their output as it accumulates, running a quick \`uptime\` in between, then cleaning everything up with natural language alone. See [feature-as-tool-provider](./feature-as-tool-provider.md) for how to author your own tool-providing feature.
`,
  "full-stack-slice.md": `---
title: 'A Full-Stack Slice: Endpoints, Express, and the REST Client'
tags:
  - express
  - rest
  - endpoints
  - servers
  - clients
  - composition
  - rateLimit
lastTested: '2026-07-05'
lastTestPassed: true
---

# A Full-Stack Slice: Endpoints, Express, and the REST Client

One vertical slice, all in this process: file-based **endpoint modules** mounted on the **express server**, consumed by the **rest client** — including the two behaviors that surprise everyone: rate limiting declared as an export, and the rest client *returning* errors instead of throwing them.

For each helper's full API: \`luca describe express\`, \`luca describe rest\`, \`luca describe endpoints\`.

## Write an endpoints folder

An endpoint module exports a \`path\` plus HTTP-method functions (\`get\`, \`post\`, ...). Whatever they return is sent as JSON. \`export const rateLimit\` declares throttling — no middleware wiring. This is exactly what \`luca serve\` mounts from your project's \`endpoints/\` folder. Modules without a \`path\` export are skipped.

\`\`\`ts
// bare assignment: survives into later blocks
endpointsDir = container.paths.resolve('tmp', \`full-stack-slice-\${Date.now()}\`, 'endpoints')
fs.ensureFolder(endpointsDir)

fs.writeFile(container.paths.resolve(endpointsDir, 'todos.ts'), \`
export const path = '/todos'

const todos = [
  { id: 1, title: 'write the docs', done: false },
  { id: 2, title: 'ship the docs', done: false },
]

export async function get() {
  return { todos }
}

// handlers receive (params, ctx) — params merges query + body + route params
export async function post(params) {
  const todo = { id: todos.length + 1, title: params.title, done: false }
  todos.push(todo)
  return todo
}
\`)

fs.writeFile(container.paths.resolve(endpointsDir, 'status.ts'), \`
export const path = '/status'
export const rateLimit = { maxRequests: 3, windowSeconds: 60 }

export async function get() {
  return { ok: true, at: new Date().toISOString() }
}
\`)

console.log('endpoint modules written')
\`\`\`

## Mount and start the server

\`useEndpoints(dir)\` mounts every module in the folder at its exported \`path\`. You can also hang plain express routes off \`server.app\` before or after starting.

\`\`\`ts
server = container.server('express')

// a hand-rolled route alongside the endpoint modules
server.app.get('/health', (req, res) => res.json({ healthy: true }))

await server.useEndpoints(endpointsDir)

const port = await networking.findOpenPort(4310)
await server.start({ port })
console.log('listening on', server.port)
\`\`\`

## Consume it with the rest client

The client returns **parsed JSON directly** — no \`{ data, status }\` wrapper to unwrap.

\`\`\`ts
api = container.client('rest', { baseURL: \`http://localhost:\${server.port}\`, json: true })

const health = await api.get('/health')
if (health.healthy !== true) throw new Error('health route broken')

const listing = await api.get('/todos')
if (listing.todos.length !== 2) throw new Error('expected 2 seed todos')

const created = await api.post('/todos', { title: 'celebrate' })
if (created.id !== 3) throw new Error('post did not create todo #3')

console.log('created:', created)
\`\`\`

## Errors are returned, not thrown

This is the framework's most important anti-prior. HTTP error statuses (a 404 here) and connection failures (a dead port) both **resolve** with the error serialized as a plain object — \`instanceof Error\` is \`false\`, and try/catch catches nothing. Inspect the shape.

\`\`\`ts
// a 404 — returned, not thrown
const missing = await api.get('/nope')
if (missing instanceof Error) throw new Error('unexpected: 404 came back as an Error instance')
if (missing?.status !== 404 && missing?.name !== 'AxiosError') {
  throw new Error('expected the 404 to come back as a serialized AxiosError')
}
console.log('404 came back as a value:', missing.name, missing.status ?? missing.code)

// a connection refused — also returned, not thrown. The exact \`code\` string
// depends on the runtime: 'ConnectionRefused' under Bun, 'ECONNREFUSED' under Node.
const deadPort = await networking.findOpenPort(4550)
const down = container.client('rest', { baseURL: \`http://localhost:\${deadPort}\` })
const result = await down.get('/anything')
if (result instanceof Error) throw new Error('unexpected: connection error came back as an Error instance')
if (!result?.code) throw new Error('expected a connection error code in the returned value')
console.log('dead server came back as a value:', result.code)
\`\`\`

So the idiomatic health check is a shape check, not a try/catch:

\`\`\`ts
const check = await api.get('/status')
if (check?.name === 'AxiosError') {
  console.log('server is DOWN:', check.message)
} else {
  console.log('server is UP:', check.ok)
}
\`\`\`

## Rate limiting kicks in

\`status.ts\` declared \`maxRequests: 3\` per minute. We used one above; two more succeed, then the server answers 429 — which the client, of course, *returns*.

\`\`\`ts
await api.get('/status')
await api.get('/status')
const limited = await api.get('/status')

if (limited?.status !== 429) throw new Error(\`expected a 429 after exceeding the rate limit, got \${JSON.stringify(limited).slice(0, 120)}\`)
console.log('rate limit enforced with a 429 on request #4')
\`\`\`

## Shut down

Always stop servers at the end of a script — otherwise the process never exits.

\`\`\`ts
await server.stop()
await fs.rmdir(container.paths.resolve(endpointsDir, '..'))
console.log('server stopped, scratch folder removed')
\`\`\`
`,
  "claude-controller-personas.md": `---
title: Claude Controller Personas
tags:
  - claude
  - claude-code
  - tmux
  - personas
  - agents
lastTested: '2026-07-05'
lastTestPassed: true
---

# Claude Controller Personas

Use \`claudeController\` personas when you want repeatable interactive Claude Code workers with different instructions, allowed directories, tools, MCP servers, and permission behavior.

\`claudeController\` does not use \`claude -p\`. It starts real interactive Claude Code sessions inside tmux and returns \`ClaudeSessionController\` workers. The top-level \`ClaudeController\` only defines personas and spawns/list/stops session workers; each worker owns \`ask()\`, \`respond()\`, \`chooseOption()\`, screen state, and JSONL session lookup.

## Quick Start

\`\`\`ts
// bare assignments so these survive into the later blocks
controller = container.feature('claudeController')
repo = container.cwd

controller.definePersona('reviewer', {
  description: 'Strict Luca-aware code reviewer',
  systemPrompt: \`You are a strict code reviewer for Luca projects.\`,
  appendSystemPrompt: \`Check Luca conventions, tests, API shape, and edge cases.\`,
  addDirs: [repo],
  tools: ['Read', 'Grep', 'Glob', 'Bash'],
  allowedTools: ['Bash(git *)', 'Bash(bun test *)'],
  permissionMode: 'acceptEdits',
})

const reviewerWorker = controller.create({
  id: 'reviewer',
  cwd: repo,
  persona: 'reviewer',
})
console.log('reviewer worker constructed (tmux not started yet)')
\`\`\`

Starting the worker launches a real interactive Claude Code session in tmux — that part is shown, not executed:

\`\`\`ts skip
await reviewerWorker.start()
await reviewerWorker.ask('Review the current diff and tell me what is risky.')
\`\`\`

The persona compiles to normal interactive Claude Code CLI flags before the session starts. For example, the persona above passes flags like \`--system-prompt\`, \`--append-system-prompt\`, \`--add-dir\`, \`--tools\`, \`--allowed-tools\`, and \`--permission-mode\` to \`claude\`.

## Defining Personas

Call \`definePersona(name, persona)\` on the controller. Names are arbitrary strings; use short stable names because they are how later \`create()\`, \`start()\`, or \`startMany()\` calls select a persona.

\`\`\`ts
controller.definePersona('docs', {
  description: 'Documentation writer',
  systemPrompt: \`You write concise docs with runnable TypeScript examples.\`,
  appendSystemPrompt: \`Prefer Luca container APIs over direct node imports.\`,
  addDirs: ['/repo'],
  skillsFolders: ['/repo/.claude/skills'],
  tools: ['Read', 'Grep', 'Glob', 'Edit'],
  permissionMode: 'plan',
})
\`\`\`

You can define personas during container boot, inside a command, or in whatever module owns your orchestration setup.

## Listing Available Personas

Use \`listPersonas()\` to see the personas registered on this controller instance.

\`\`\`ts
const personas = controller.listPersonas()

for (const { name, persona } of personas) {
  console.log(name, persona.description ?? '')
}
\`\`\`

Use \`getPersona(name)\` to inspect one persona:

\`\`\`ts
const reviewer = controller.getPersona('reviewer')
if (!reviewer) throw new Error('reviewer persona is not registered')

console.log(reviewer.systemPrompt)
\`\`\`

Personas live in memory on the controller. If you need persistence, store your persona definitions in your project config and call \`definePersona()\` during startup.

## Starting One Persona

\`create()\` constructs a worker without starting tmux. \`start()\` constructs and starts it immediately.

\`\`\`ts skip
const worker = controller.create({
  id: 'docs-worker',
  cwd: '/repo',
  persona: 'docs',
})

await worker.start()
await worker.ask('Update docs for the new command.')
\`\`\`

Or:

\`\`\`ts skip
await controller.start({
  id: 'docs-worker',
  cwd: '/repo',
  persona: 'docs',
})

const worker = controller.session('docs-worker')
await worker?.ask('Update docs for the new command.')
\`\`\`

## Starting Multiple Personas

Use \`startMany()\` to launch multiple interactive Claude Code sessions with different personas.

\`\`\`ts skip
await controller.startMany([
  { id: 'planner', cwd: repo, persona: 'architect' },
  { id: 'tester', cwd: repo, persona: 'tdd' },
  { id: 'reviewer', cwd: repo, persona: 'reviewer' },
])

await controller.session('planner')?.ask('Plan the refactor.')
await controller.session('tester')?.ask('Write focused tests for the refactor.')
await controller.session('reviewer')?.ask('Review the diff for Luca convention issues.')
\`\`\`

Each session has its own tmux session, cwd, arguments, state snapshot, prompt choices, and input methods.

## Inline Personas

You do not have to register a persona first. Pass a persona object directly in \`create()\` or \`start()\` for one-off sessions.

\`\`\`ts
const spike = controller.create({
  id: 'spike',
  cwd: repo,
  persona: {
    description: 'One-off exploration worker',
    systemPrompt: 'Explore the codebase and report options. Do not edit files.',
    tools: ['Read', 'Grep', 'Glob'],
    permissionMode: 'plan',
  },
})
console.log('inline-persona worker constructed')
\`\`\`

\`\`\`ts skip
await spike.start()
await spike.ask('Find the likely files involved in adding OAuth support.')
\`\`\`

## Overriding Persona Options per Session

Spawn options override scalar persona fields such as \`systemPrompt\`, \`appendSystemPrompt\`, \`permissionMode\`, \`tools\`, \`allowedTools\`, and \`settingsFile\`.

Array-like context fields are combined:

- \`mcpConfig\`: persona entries first, then session entries
- \`addDirs\`: persona entries first, then session entries
- \`skillsFolders\`: appended to the \`--add-dir\` list after regular dirs
- \`args\`: raw extra Claude CLI args appended last

\`\`\`ts
const worker = controller.create({
  id: 'docs-opus',
  persona: 'docs',
  cwd: repo,
  systemPrompt: 'Use the docs persona, but focus on API reference only.',
  addDirs: ['/another/repo'],
  args: ['--model', 'opus'],
})
\`\`\`

This keeps personas reusable while still letting each worker tune model, directories, or instructions for one run.

## Full Persona Example with MCP

\`\`\`ts
controller.definePersona('luca-architect', {
  description: 'Architect for Luca framework changes',
  systemPrompt: \`
You are an architect for the Luca framework.
Think in terms of container features, helpers, commands, and runtime discovery.
Do not use claude -p. You are running as an interactive tmux-backed Claude Code session.
\`,
  appendSystemPrompt: \`
Before proposing implementation details, inspect the runtime surface with luca describe when useful.
Prefer container.paths and container.feature('fs') over direct path/fs imports.
\`,
  addDirs: [
    '/Users/jonathansoeder/@soederpop/projects/luca',
    '/Users/jonathansoeder/@agentic-loop',
  ],
  skillsFolders: [
    '/Users/jonathansoeder/@agentic-loop/.claude/skills',
  ],
  mcpConfig: [
    './.claude/mcp.shared.json',
  ],
  mcpServers: {
    luca: {
      type: 'stdio',
      command: 'bun',
      args: ['run', './mcp/luca-server.ts'],
    },
  },
  strictMcpConfig: true,
  tools: ['Read', 'Grep', 'Glob', 'Bash', 'Edit'],
  allowedTools: [
    'Bash(git status *)',
    'Bash(git diff *)',
    'Bash(bun test *)',
    'Bash(luca describe *)',
    'Bash(luca eval *)',
  ],
  permissionMode: 'acceptEdits',
  settingsFile: './.claude/settings.architect.json',
})
\`\`\`

Then start it:

\`\`\`ts skip
const architect = controller.create({
  id: 'architect',
  cwd: repo,
  persona: 'luca-architect',
})

await architect.start()
await architect.ask('Design a small API for persisted persona profiles.')
\`\`\`

## Persona Options

| Option | Type | CLI output | Notes |
|--------|------|------------|-------|
| \`description\` | \`string\` | none | Human-readable note for \`listPersonas()\` output. |
| \`systemPrompt\` | \`string\` | \`--system-prompt <text>\` | Main system prompt for Claude Code. Session option overrides persona value. |
| \`appendSystemPrompt\` | \`string\` | \`--append-system-prompt <text>\` | Additional system prompt text. Session option overrides persona value. |
| \`mcpConfig\` | \`string[]\` | \`--mcp-config <configs...>\` | Paths to MCP config files. Persona and session arrays are combined. |
| \`mcpServers\` | \`Record<string, any>\` | \`--mcp-config '{"mcpServers": ...}'\` | Inline MCP servers are merged with session servers and passed as an MCP config JSON argument. |
| \`strictMcpConfig\` | \`boolean\` | \`--strict-mcp-config\` | Requires Claude Code to validate MCP config strictly. |
| \`addDirs\` | \`string[]\` | \`--add-dir <dirs...>\` | Additional directories Claude may access. Persona and session arrays are combined. |
| \`skillsFolders\` | \`string[]\` | included in \`--add-dir <dirs...>\` | Directories that contain Claude skills. They are added as allowed dirs for interactive Claude sessions. |
| \`tools\` | \`string[]\` | \`--tools <tools...>\` | Tool names made available to Claude Code. Session option overrides persona value. |
| \`allowedTools\` | \`string[]\` | \`--allowed-tools <tools...>\` | Permission allow-list entries. Session option overrides persona value. |
| \`permissionMode\` | string enum | \`--permission-mode <mode>\` | One of \`default\`, \`acceptEdits\`, \`auto\`, \`bypassPermissions\`, \`plan\`, \`dontAsk\`. |
| \`settingsFile\` | \`string\` | \`--settings <file>\` | Claude Code settings file path. Session option overrides persona value. |

## Start Options Related to Personas

These options are passed to \`create()\`, \`start()\`, or each entry in \`startMany()\`:

| Option | Type | Notes |
|--------|------|-------|
| \`id\` | \`string\` | Worker/session id. Normalized to a compact tmux-safe id. |
| \`cwd\` | \`string\` | Working directory for this Claude Code session. |
| \`persona\` | \`string | ClaudeControllerPersona\` | Registered persona name or inline persona object. |
| \`args\` | \`string[]\` | Raw extra Claude CLI arguments appended after persona-compiled args. |
| \`width\` | \`number\` | tmux pane width. Defaults to controller option. |
| \`height\` | \`number\` | tmux pane height. Defaults to controller option. |
| \`reuse\` | \`boolean\` | Reuse an existing tmux session when supported by the worker. |

The start options also accept every persona option, so you can override or extend persona configuration per session.

## Permission Mode Notes

Common modes:

- \`plan\`: safest for exploration. Claude can plan and ask before edits.
- \`acceptEdits\`: useful for coding workers where you want Claude Code to accept file edits more smoothly.
- \`default\`: normal Claude Code permission behavior.
- \`dontAsk\`, \`auto\`, \`bypassPermissions\`: more permissive modes. Use only when you understand the local Claude Code behavior and trust the working directory.

For unattended or parallel sessions, prefer tight \`allowedTools\` plus a specific \`cwd\` and \`addDirs\` rather than broad permissions.

## Interacting with a Persona Worker

After the worker starts, use the session worker API, not the controller, for input.

\`\`\`ts skip
const worker = controller.session('reviewer')
if (!worker) throw new Error('reviewer session was not started')

await worker.ask('Review the diff.')

const snapshot = await worker.refresh()
if (snapshot.awaitingInput) {
  console.log(snapshot.choices)
  await worker.chooseOption(0)
}
\`\`\`

The controller intentionally does not expose \`ask()\`, \`respond()\`, or \`chooseOption()\` directly. Those methods belong to \`ClaudeSessionController\` because each worker already knows its own tmux session and Claude state.

## Troubleshooting

### Unknown persona

If \`create({ persona: 'reviewer' })\` throws \`Unknown Claude controller persona: reviewer\`, define it first or pass an inline persona object.

\`\`\`ts
if (!controller.getPersona('reviewer')) {
  controller.definePersona('reviewer', { systemPrompt: 'Review code carefully.' })
}
\`\`\`

### Persona did not change a running session

Personas compile into CLI args before a worker starts. Changing a persona after \`worker.start()\` does not rewrite the already-running Claude Code process. Stop and start a new worker to apply the changed persona.

### Claude cannot see files

Make sure \`cwd\`, \`addDirs\`, and \`skillsFolders\` include the directories Claude needs. For multi-repo work, set the worker \`cwd\` to the main repo and put sibling repos in \`addDirs\`.

### MCP server does not load

Check these first:

- \`mcpConfig\` paths are correct relative to the worker \`cwd\`
- inline \`mcpServers\` have the expected \`command\` and \`args\`
- \`strictMcpConfig\` is not rejecting a loose config
- the command works when run manually from the same \`cwd\`

## Minimal Pattern for Project Commands

A project command that spawns named workers can define personas once, list them for the operator, then start selected ones.

\`\`\`ts skip
export default async function run({ container }) {
  const claude = container.feature('claudeController')
  const repo = container.paths.resolve('.')

  claude
    .definePersona('planner', {
      description: 'Plans the change without editing',
      systemPrompt: 'Plan the implementation. Do not edit files.',
      tools: ['Read', 'Grep', 'Glob'],
      permissionMode: 'plan',
    })
    .definePersona('implementer', {
      description: 'Writes code and tests',
      systemPrompt: 'Implement the requested change using Luca conventions.',
      tools: ['Read', 'Grep', 'Glob', 'Edit', 'Bash'],
      allowedTools: ['Bash(bun test *)', 'Bash(luca describe *)'],
      permissionMode: 'acceptEdits',
    })

  console.table(claude.listPersonas().map(({ name, persona }) => ({
    name,
    description: persona.description ?? '',
  })))

  await claude.startMany([
    { id: 'planner', cwd: repo, persona: 'planner' },
    { id: 'implementer', cwd: repo, persona: 'implementer' },
  ])
}
\`\`\`
`,
  "structured-output-with-assistants.md": `---
title: Structured Output with Assistants
tags:
  - assistant
  - conversation
  - structured-output
  - zod
  - openai
lastTested: '2026-07-05'
lastTestPassed: true
---

# Structured Output with Assistants

Get typed, schema-validated JSON responses from OpenAI instead of raw text strings.

## Overview

OpenAI's Structured Outputs feature constrains the model to return JSON that exactly matches a schema you provide. Combined with Zod, this means \`ask()\` can return parsed objects instead of strings — no regex parsing, no "please respond in JSON", no malformed output.

Pass a \`schema\` option to \`ask()\` and the response comes back as a parsed object guaranteed to match your schema.

Every block below calls the OpenAI API, so they are shown rather than executed — set \`OPENAI_API_KEY\` and run them yourself (paste into \`luca eval\`, or remove the \`skip\` annotations and \`luca run\` this doc).

## Basic: Extract Structured Data

The simplest use case — ask a question and get structured data back.

\`\`\`ts skip
const { z } = container
const conversation = container.feature('conversation', {
  model: 'gpt-4.1-mini',
  history: [{ role: 'system', content: 'You are a helpful data extraction assistant.' }]
})

const result = await conversation.ask('The founders of Apple are Steve Jobs, Steve Wozniak, and Ronald Wayne. They started it in 1976 in Los Altos, California.', {
  schema: z.object({
    company: z.string(),
    foundedYear: z.number(),
    location: z.string(),
    founders: z.array(z.string()),
  }).describe('CompanyInfo')
})

console.log('Company:', result.company)
console.log('Founded:', result.foundedYear)
console.log('Location:', result.location)
console.log('Founders:', result.founders)
\`\`\`

The \`.describe()\` on the schema gives OpenAI the schema name — keep it short and descriptive.

## Enums and Categorization

Structured outputs work great for classification tasks where you want the model to pick from a fixed set of values.

\`\`\`ts skip
const { z } = container
const conversation = container.feature('conversation', {
  model: 'gpt-4.1-mini',
  history: [{ role: 'system', content: 'You are a helpful assistant.' }]
})

const sentiment = await conversation.ask('I absolutely love this product, it changed my life!', {
  schema: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    confidence: z.number(),
    reasoning: z.string(),
  }).describe('SentimentAnalysis')
})

console.log('Sentiment:', sentiment.sentiment)
console.log('Confidence:', sentiment.confidence)
console.log('Reasoning:', sentiment.reasoning)
\`\`\`

Because the model is constrained by the schema, \`sentiment\` will always be one of the four allowed values.

## Nested Objects and Arrays

Schemas can be as complex as you need. Here we extract a structured analysis with nested objects.

\`\`\`ts skip
const { z } = container
const conversation = container.feature('conversation', {
  model: 'gpt-4.1-mini',
  history: [{ role: 'system', content: 'You are a technical analyst.' }]
})

const analysis = await conversation.ask(
  'TypeScript 5.5 introduced inferred type predicates, which automatically narrow types in filter callbacks. It also added isolated declarations for faster builds in monorepos, and a new regex syntax checking feature.',
  {
    schema: z.object({
      subject: z.string(),
      version: z.string(),
      features: z.array(z.object({
        name: z.string(),
        category: z.enum(['type-system', 'performance', 'developer-experience', 'syntax', 'other']),
        summary: z.string(),
      })),
      featureCount: z.number(),
    }).describe('ReleaseAnalysis')
  }
)

console.log('Subject:', analysis.subject, analysis.version)
console.log('Features:')
for (const f of analysis.features) {
  console.log(\`  [\${f.category}] \${f.name}: \${f.summary}\`)
}
console.log('Total features:', analysis.featureCount)
\`\`\`

Every level of nesting is validated — the model cannot return a feature without a category or skip required fields.

## With an Assistant

Structured outputs work the same way through the assistant API. The schema passes straight through to the underlying conversation.

\`\`\`ts skip
const { z } = container
const assistant = container.feature('assistant', {
  systemPrompt: 'You are a code review assistant. You analyze code snippets and provide structured feedback.',
  model: 'gpt-4.1-mini',
})

const review = await assistant.ask(
  'Review this: function add(a, b) { return a + b }',
  {
    schema: z.object({
      issues: z.array(z.object({
        severity: z.enum(['info', 'warning', 'error']),
        message: z.string(),
      })),
      suggestion: z.string(),
      score: z.number(),
    }).describe('CodeReview')
  }
)

console.log('Score:', review.score)
console.log('Suggestion:', review.suggestion)
console.log('Issues:')
for (const issue of review.issues) {
  console.log(\`  [\${issue.severity}] \${issue.message}\`)
}
\`\`\`

## Summary

This demo covered extracting structured data, classification with enums, nested schema validation, and using structured outputs through both the conversation and assistant APIs. The key is passing a Zod schema via \`{ schema }\` in the options to \`ask()\` — OpenAI guarantees the response matches, and you get a parsed object back.
`,
  "feature-as-tool-provider.md": `---
title: Features as Tool Providers for Assistants
tags:
  - feature
  - tools
  - assistant
  - composition
  - use
  - setupToolsConsumer
  - toTools
  - authoring
lastTested: '2026-07-05'
lastTestPassed: true
---

# Features as Tool Providers for Assistants

Any feature can expose tools that assistants pick up via \`assistant.use(feature)\`. This is how you compose lower-level container capabilities into an assistant-ready tool surface. The built-in \`fileTools\` feature is the canonical example — it wraps \`fs\` and \`grep\` into a focused set of tools modeled on what coding assistants need.

For the helpers involved: \`luca describe fileTools\`, \`luca describe assistant\`, \`luca describe helpers\`.

## The Pattern

A feature becomes a tool provider by defining three things:

1. **\`static tools\`** — a record mapping tool names to \`{ description, schema }\` entries (Zod schemas with \`.describe()\` on every field)
2. **Matching methods** — instance methods whose names match the keys in \`static tools\`; \`toTools()\` auto-binds each schema to the same-named method
3. **\`setupToolsConsumer()\`** (optional) — a hook that runs when an assistant calls \`use()\`, perfect for injecting system prompt guidance

When an assistant calls \`assistant.use(feature)\`, the framework:
- Calls the feature's \`toTools()\` to collect \`{ schemas, handlers }\` (walking the prototype chain, so subclasses can override parent tools; instance-level \`tool()\` registrations win over all)
- Registers each tool on the assistant via \`addTool()\`
- Calls \`setupToolsConsumer(assistant)\` so the feature can configure the assistant (e.g. add system prompt extensions)

## Anatomy of fileTools

Here's the structure of the built-in \`fileTools\` feature (abridged from the real source — shown, not executed; the runnable version of this pattern is the walkthrough below):

\`\`\`ts skip
import { z } from 'zod'
import { Feature } from 'luca'

export class FileTools extends Feature {
  static override stability = 'stable' as const
  static { Feature.register(this, 'fileTools') }

  // ── 1. Declare tools with Zod schemas ──────────────────────────
  static override tools = {
    readFile: {
      description: 'Read the contents of a file.',
      schema: z.object({
        path: z.string().describe('File path relative to the project root'),
        offset: z.number().optional().describe('Line number to start reading from'),
        limit: z.number().optional().describe('Maximum number of lines to read'),
      }).describe('Read the contents of a file.'),
    },
    searchFiles: {
      description: 'Search file contents for a pattern using ripgrep.',
      schema: z.object({
        pattern: z.string().describe('Search pattern (regex supported)'),
        path: z.string().optional().describe('Directory to search in'),
        include: z.string().optional().describe('Glob pattern to filter files'),
      }).describe('Search file contents for a pattern using ripgrep.'),
    },
    // ... editFile, listDirectory, findFiles, fileInfo, and more
  }

  // ── 2. Implement each tool as an instance method ───────────────
  // Method names must match the keys in static tools exactly.
  // Each receives the parsed args object; composition happens
  // through this.container, never through direct imports.

  async readFile(args: { path: string; offset?: number; limit?: number }) {
    const fs = this.container.feature('fs')
    return await fs.readFileAsync(args.path)
  }

  async searchFiles(args: { pattern: string; path?: string; include?: string }) {
    const grep = this.container.feature('grep')
    const results = await grep.search({ pattern: args.pattern, path: args.path, include: args.include })
    return JSON.stringify(results.map(r => ({ file: r.file, line: r.line, content: r.content })))
  }

  // ── 3. Configure the assistant when it calls use() ─────────────
  override setupToolsConsumer(consumer) {
    // If the consumer is an assistant, inject guidance into its system prompt
    if (typeof consumer.addSystemPromptExtension === 'function') {
      consumer.addSystemPromptExtension('fileTools', [
        '## File Tools',
        '- All file paths are relative to the project root unless they start with /',
        '- Use searchFiles to understand code before modifying it',
        '- Use editFile for surgical changes — prefer it over writeFile',
      ].join('\\n'))
    }
  }
}
\`\`\`

## Using It

Wiring tools onto an assistant needs no API key — \`use()\` registers the tool surface and runs \`setupToolsConsumer\` immediately, before any model is contacted. We can verify the whole handshake live:

\`\`\`ts
fileTools = container.feature('fileTools')

reviewer = container.feature('assistant', {
  systemPrompt: 'You are a coding assistant.',
  model: 'gpt-4.1-mini',
})
reviewer.use(fileTools)

// The assistant now has the full fileTools surface...
const toolNames = Object.keys(reviewer.tools)
console.log('registered tools:', toolNames.join(', '))
for (const expected of ['readFile', 'writeFile', 'editFile', 'searchFiles', 'listDirectory']) {
  if (!toolNames.includes(expected)) throw new Error(\`expected \${expected} to be registered\`)
}

// ...and setupToolsConsumer injected the usage guidance into its system prompt
if (!reviewer.effectiveSystemPrompt.includes('## File Tools')) {
  throw new Error('fileTools guidance missing from the effective system prompt')
}
console.log('tool surface and system prompt extension verified')
\`\`\`

### Selective tool registration

You can expose only a subset of tools — \`toTools({ only })\` returns a \`{ schemas, handlers, setup }\` package that \`use()\` also accepts:

\`\`\`ts
scout = container.feature('assistant', {
  systemPrompt: 'You are a read-only code scout.',
  model: 'gpt-4.1-mini',
})
scout.use(fileTools.toTools({ only: ['readFile', 'searchFiles', 'listDirectory'] }))

const scoutTools = Object.keys(scout.tools)
if (scoutTools.length !== 3) throw new Error(\`expected exactly 3 tools, got \${scoutTools.length}: \${scoutTools}\`)
if (scoutTools.includes('writeFile')) throw new Error('writeFile should have been excluded')
console.log('scout has only:', scoutTools.join(', '))
\`\`\`

## Walkthrough: author your own tool-providing feature

Now the full lifecycle for a feature of your own: write it, register it through discovery, inspect its tool surface, and hand it to an assistant. In a real project this file lives in \`features/\` and is picked up automatically; here we write it to a scratch folder inside the project (so its \`import ... from 'luca'\` resolves) and discover it explicitly — the same pattern as the [custom feature authoring example](./custom-feature-authoring.md).

We build \`diceTools\`: a tiny feature exposing one tool, with matching method and system prompt guidance.

\`\`\`ts
// bare assignments (no const) so these survive into the later blocks
pluginRoot = container.paths.resolve('tmp', \`tool-provider-demo-\${Date.now()}\`)
featureDir = container.paths.resolve(pluginRoot, 'features')

const featureSource = \`
import { z } from 'zod'
import { Feature } from 'luca'

/**
 * Dice-rolling tools for assistants. One static tools entry, one
 * matching method, one setupToolsConsumer hook — the whole pattern.
 */
export class DiceTools extends Feature {
  static override stability = 'experimental' as const
  static { Feature.register(this, 'diceTools') }

  // 1. Declare the tool surface
  static override tools = {
    rollDice: {
      description: 'Roll one or more dice and return the rolls and their total.',
      schema: z.object({
        sides: z.number().default(6).describe('How many sides each die has'),
        count: z.number().default(1).describe('How many dice to roll'),
      }).describe('Roll one or more dice and return the rolls and their total.'),
    },
  }

  // 2. Implement it — the method name matches the static tools key
  async rollDice(args: { sides?: number; count?: number }) {
    const sides = args.sides ?? 6
    const count = args.count ?? 1
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
    return JSON.stringify({ rolls, total: rolls.reduce((a, b) => a + b, 0) })
  }

  // 3. Teach the consumer how to use it
  override setupToolsConsumer(consumer) {
    if (typeof consumer.addSystemPromptExtension === 'function') {
      consumer.addSystemPromptExtension('diceTools', [
        '## Dice Tools',
        'Use rollDice for anything involving chance. Never invent dice results yourself.',
      ].join('\\\\n'))
    }
  }
}

export default DiceTools
\`

fs.ensureFolder(featureDir)
fs.writeFile(container.paths.resolve(featureDir, 'dice-tools.ts'), featureSource)
console.log('feature file written')
\`\`\`

### Register and introspect the tool surface

\`helpers.discover('features', { directory })\` loads the module, which runs its \`static { Feature.register(...) }\` block. After that, \`toTools()\` shows exactly what an assistant would receive — and the handlers are directly callable, which is the fastest way to test tool implementations without a model in the loop.

\`\`\`ts
const discovered = await helpers.discover('features', { directory: featureDir })
console.log('discovered:', discovered)
if (!container.features.available.includes('diceTools')) throw new Error('diceTools did not register')

dice = container.feature('diceTools')
const pkg = dice.toTools()

if (Object.keys(pkg.schemas).join() !== 'rollDice') throw new Error('expected exactly the rollDice schema')
if (typeof pkg.handlers.rollDice !== 'function') throw new Error('rollDice handler was not auto-bound to the method')
if (typeof pkg.setup !== 'function') throw new Error('setupToolsConsumer should be packaged as pkg.setup')

// call the tool handler directly — no assistant, no model
const rolled = JSON.parse(await pkg.handlers.rollDice({ sides: 6, count: 3 }))
console.log('direct tool call:', rolled)
if (rolled.rolls.length !== 3) throw new Error('expected 3 rolls')
if (rolled.total !== rolled.rolls.reduce((a, b) => a + b, 0)) throw new Error('total should match the rolls')
\`\`\`

### Hand it to an assistant

\`\`\`ts
gameMaster = container.feature('assistant', {
  systemPrompt: 'You are a game master for a dice game.',
  model: 'gpt-4.1-mini',
})
gameMaster.use(dice)

if (!Object.keys(gameMaster.tools).includes('rollDice')) throw new Error('rollDice not registered on the assistant')
if (!gameMaster.effectiveSystemPrompt.includes('## Dice Tools')) throw new Error('diceTools guidance missing from system prompt')

// the registered tool carries the schema description through to the model
console.log('rollDice description:', gameMaster.tools.rollDice.description)
console.log('assistant wired with diceTools')
\`\`\`

### Let the model actually call it

Everything above ran without credentials. Actually starting the assistant and asking a question sends the tool schemas to the model, which decides to call \`rollDice\`; the framework routes the call to your method and feeds the result back. That requires an \`OPENAI_API_KEY\` in the environment, so it's shown rather than run:

\`\`\`ts skip
await gameMaster.start()
const answer = await gameMaster.ask('Roll 2d20 for initiative and tell me the total.')
console.log(answer)
// The transcript will include a rollDice tool call with { sides: 20, count: 2 }
// and the model's narration of the real (not hallucinated) result.
\`\`\`

### Clean up

\`\`\`ts
await fs.rmdir(pluginRoot)
console.log('cleaned up', pluginRoot)
\`\`\`

## Why This Pattern Matters

This is how features compose for AI. Instead of the assistant importing \`fs\` and \`grep\` directly:

- The **feature** owns the tool surface — schemas, descriptions, and implementations in one place
- The **assistant** gets a curated interface, not raw container access
- **\`setupToolsConsumer()\`** lets the feature teach the assistant how to use the tools well
- **\`toTools({ only })\`** lets you scope down what the assistant can do

Any feature you build can follow this same pattern. Define \`static tools\`, implement matching methods, optionally override \`setupToolsConsumer()\`, and assistants can \`use()\` it. Other built-ins to study: \`contentDb\` (document exploration tools) and \`codingTools\` — \`luca describe <name>\` shows each one's surface.

## Summary

Features are the natural place to package tools for assistants. The \`static tools\` record declares the schema, instance methods implement the logic (auto-bound by name in \`toTools()\`), and \`setupToolsConsumer()\` wires up assistant-specific configuration like system prompt extensions. This keeps tool definitions, implementations, and assistant guidance co-located in a single feature class — and every piece of the handshake is verifiable without an API key, right up to the final \`ask()\`.
`,
  "event-bus-fanout.md": `---
title: 'Event Bus Fanout: In-Process, Cross-Boundary, Cross-Process'
tags:
  - events
  - bus
  - container
  - websocket
  - redis
  - composition
  - fanout
lastTested: '2026-07-05'
lastTestPassed: true
---

# Event Bus Fanout: In-Process, Cross-Boundary, Cross-Process

The container **is** an event bus: \`container.on\` / \`container.emit\` / \`container.once\` / \`container.off\` / \`container.waitFor\`. Every helper carries its own bus with the same API. Nothing is relayed anywhere automatically — fanout is something you *compose*, and it composes in three widening rings: listeners in the same process, websocket clients outside the process, and redis subscribers on other machines. This doc walks all three.

For the APIs used here: \`luca describe servers.websocket\`, \`luca describe clients.websocket\`, \`luca describe redis\`.

## Ring 1: the container's own bus

Events take any name and any arguments. \`once\` fires a single time, \`off\` unsubscribes, \`waitFor(event)\` returns a promise for the next emission (resolving with the first listener argument). There is also a wildcard: \`container.on('*', (event, ...args) => ...)\` sees **every** event by name — the primitive that makes generic relays possible.

\`\`\`ts
const received = []
const handler = (payload) => received.push(payload)
container.on('fanout:job', handler)
container.emit('fanout:job', { id: 1 })
container.emit('fanout:job', { id: 2 })
if (received.length !== 2 || received[1].id !== 2) throw new Error('on/emit did not deliver both payloads')

container.off('fanout:job', handler)
container.emit('fanout:job', { id: 3 })
if (received.length !== 2) throw new Error('off() did not unsubscribe the listener')

let onceCount = 0
container.once('fanout:once', () => onceCount++)
container.emit('fanout:once')
container.emit('fanout:once')
if (onceCount !== 1) throw new Error('once() fired more than once')

// wildcard: observe every event crossing the container bus
const names = []
const spy = (event) => names.push(event)
container.on('*', spy)
container.emit('fanout:alpha')
container.emit('fanout:beta', 42)
container.off('*', spy)
if (!names.includes('fanout:alpha') || !names.includes('fanout:beta')) {
  throw new Error('wildcard listener missed an event')
}

// waitFor: promise for the next emission
const arrival = container.waitFor('fanout:ready')
setTimeout(() => container.emit('fanout:ready', 'go'), 10)
const signal = await arrival
if (signal !== 'go') throw new Error('waitFor did not resolve with the event argument')

console.log('container bus verified: on/off, once, wildcard, waitFor')
\`\`\`

## Scoped buses relay upward

\`container.bus()\` mints an independent bus — a private channel that does not pollute the container's event space. The wildcard makes relaying to the container a one-liner, with a namespace prefix so the origin stays legible. Buses also keep stats: \`getEventStats(event)\`, \`firedEvents\`, \`history\`.

\`\`\`ts
const jobBus = container.bus()

// generic relay: everything on jobBus resurfaces on the container as jobs:*
jobBus.on('*', (event, ...args) => container.emit(\`jobs:\${event}\`, ...args))

let containerSaw = null
container.on('jobs:completed', (id) => { containerSaw = id })

jobBus.emit('started', 'job-1')
jobBus.emit('completed', 'job-1')

if (containerSaw !== 'job-1') throw new Error('scoped bus event did not relay to the container')
if (jobBus.getEventStats('completed').fireCount !== 1) throw new Error('bus stats did not record the emit')
if (!jobBus.firedEvents.includes('started')) throw new Error('firedEvents missing started')
console.log('scoped bus relayed to container; stats:', jobBus.firedEvents.join(', '))
\`\`\`

## The container narrates its own lifecycle

Two events the framework emits for you: \`helperInitialized\` (after any helper's \`afterInitialize()\` completes) and \`featureEnabled\` (with the feature's shortcut). Helpers do **not** forward their own events to the container — a feature's \`emit()\` stays on that feature's bus — but these lifecycle hooks let you observe helpers coming online and attach relays the moment they do.

\`\`\`ts
const initialized = []
const enabled = []
container.on('helperInitialized', (helper) => initialized.push(helper))
container.on('featureEnabled', (shortcut, feature) => enabled.push(shortcut))

// options are part of the memoization key, so a distinct name mints a fresh instance
const yaml = container.feature('yaml', { name: 'fanout-demo', enable: true })

if (!initialized.includes(yaml)) throw new Error('helperInitialized did not fire for the new feature')
if (!enabled.includes('features.yaml')) throw new Error('featureEnabled did not fire with the shortcut')

// helper events stay on the helper's bus unless you relay them yourself
let relayed = null
yaml.on('enabled', () => {}) // helper-level subscription — same bus API as the container
container.on('fanout:yaml-state', (state) => { relayed = state })
yaml.on('stateChange', (state) => container.emit('fanout:yaml-state', state)) // the relay
yaml.state.set('touched', true)
if (!relayed || relayed.touched !== true) throw new Error('manual helper -> container relay failed')

console.log('lifecycle events observed:', enabled.join(', '))
\`\`\`

## Ring 2: out of the process, over a websocket

To push container events to external consumers, bridge them to the websocket server's \`broadcast()\`. Anything emitted on the container fans out to every connected socket. The subscriber below is a real websocket client — it could just as well be a browser or another machine.

\`\`\`ts
wsPort = await networking.findOpenPort(19930)
wsServer = container.server('websocket', { json: true })

// bridge: container event -> every connected websocket client
container.on('news', (item) => wsServer.broadcast({ event: 'news', item }))

// and the reverse relay: server helper events -> container bus
let connectionsSeen = 0
container.on('fanout:connection', () => { connectionsSeen++ })
wsServer.on('connection', () => container.emit('fanout:connection'))

await wsServer.start({ port: wsPort })

const firstConnection = wsServer.waitFor('connection')
subscriber = container.client('websocket', { baseURL: \`ws://localhost:\${wsPort}\` })
await subscriber.connect()
await firstConnection
if (connectionsSeen !== 1) throw new Error('server connection event did not relay to the container')

const delivery = subscriber.waitFor('message')
container.emit('news', { headline: 'container events can leave the process' })
const received = await delivery

if (received.event !== 'news') throw new Error('websocket subscriber got the wrong envelope')
if (received.item.headline !== 'container events can leave the process') {
  throw new Error('broadcast payload did not survive the trip')
}
console.log('external websocket client received:', received.item.headline)
\`\`\`

## Ring 3: across processes, over redis

The redis feature (\`luca describe redis\`) closes the loop between separate container processes with pub/sub: \`publish(channel, message)\` on one side, \`subscribe(channel, handler?)\` on the other (a dedicated subscriber connection is created lazily, as ioredis requires). Messages are strings — \`JSON.stringify\` your payloads.

**Requirement: a reachable redis server** (default \`redis://localhost:6379\`). No redis was reachable when this doc was tested, so these blocks are marked \`skip\` and not executed. With docker available you can bootstrap one via \`container.feature('redis', { lazyConnect: true }).ensureLocalDocker()\`.

\`\`\`ts skip
// process A — the publisher
const redis = container.feature('redis', { url: 'redis://localhost:6379' })

// bridge: container event -> redis channel
container.on('news', (item) => redis.publish('news', JSON.stringify(item)))
container.emit('news', { headline: 'hello from process A' })
\`\`\`

\`\`\`ts skip
// process B — the subscriber, bridging back onto ITS container bus
const redis = container.feature('redis', { url: 'redis://localhost:6379' })

await redis.subscribe('news', (channel, message) => {
  container.emit('news:remote', JSON.parse(message))
})

const item = await container.waitFor('news:remote')
console.log('received from the other process:', item.headline)

// pub/sub connections keep the process alive — close when done
await redis.close()
\`\`\`

The shape is identical to the websocket ring: pick a transport, listen on the container, forward. The receiving side re-emits onto its own container, so downstream code subscribes to plain container events and never knows the message crossed a process boundary.

## Shut down

\`\`\`ts
await subscriber.disconnect()
await wsServer.stop()
if (wsServer.state.get('listening') !== false) throw new Error('websocket server still listening')
console.log('subscriber disconnected, server stopped')
\`\`\`

## Summary

One mental model, three ranges. In-process: \`container.on\`/\`emit\`, scoped buses from \`container.bus()\`, the \`'*'\` wildcard for generic relays, and lifecycle events (\`helperInitialized\`, \`featureEnabled\`) narrating helper startup. Cross-boundary: a container listener that calls \`wsServer.broadcast()\`. Cross-process: the same listener calling \`redis.publish()\`, with the far side re-emitting into its own container. Helpers never auto-forward their events — every hop is an explicit, one-line relay you compose.
`,
  "daemon-command.md": `---
title: Daemon & Poll-Loop Commands
tags:
  - commands
  - daemon
  - polling
  - scheduling
  - utils
  - proc
  - scheduler
  - cron
lastTested: '2026-07-05'
lastTestPassed: true
---

# Daemon & Poll-Loop Commands

Luca's low-level scheduling primitives live on \`container.utils\`: \`sleep\`, \`backoff\`, and \`every\`. This example covers all three, plus the full lifecycle of a long-running command (keep-alive, SIGINT cleanup, single-instance locking). When you want named tasks, cron expressions, run history, or a one-line daemon lifecycle, reach for the managed layer instead — \`container.feature('scheduler')\` — covered in its own section below.

## sleep — pauses between work

\`utils.sleep(ms)\` resolves after the given delay. It's the building block for polite loops that don't hammer an API.

\`\`\`ts
const started = Date.now()
await container.utils.sleep(150)
console.log(\`slept for ~\${Date.now() - started}ms\`)
\`\`\`

## backoff — retry flaky calls with exponential delay

\`utils.backoff(fn, opts)\` retries an async function until it succeeds or attempts run out. The delay doubles after each failure (tune with \`factor\`, cap with \`maxDelay\`). It returns the function's result, or throws the last error.

\`\`\`ts
let calls = 0

const result = await container.utils.backoff(async () => {
  calls++
  if (calls < 3) throw new Error(\`transient failure #\${calls}\`)
  return \`succeeded on attempt \${calls}\`
}, {
  attempts: 5,
  delay: 50,
  onRetry: (err, attempt) => console.log(\`attempt \${attempt} failed: \${err.message}\`)
})

console.log(result)
\`\`\`

## every — the poll loop

\`utils.every(ms, fn)\` codifies the recursive-\`setTimeout\` idiom: the next run is only scheduled after the previous one finishes, so slow ticks never overlap. It returns a \`stop()\` function.

\`\`\`ts
let ticks = 0

const stop = container.utils.every(100, async () => {
  ticks++
  console.log(\`tick \${ticks}\`)
}, { immediate: true })

// let it run for a few ticks, then stop it
await container.utils.sleep(350)
stop()
console.log(\`stopped after \${ticks} ticks\`)
\`\`\`

Pass \`{ onError: (err) => ... }\` to keep the loop alive through failures — without it, a throwing tick stops the loop and surfaces the error.

## The managed layer: scheduler

\`utils.every\` gives you a bare loop and a \`stop()\` function — nothing else. The \`scheduler\` feature wraps the same non-overlapping-tick idiom in **named tasks** with run history, error tracking, and cron expressions. Every \`scheduler.every()\` / \`cron()\` / \`at()\` / \`in()\` call returns a handle with a live \`info\` snapshot, and \`scheduler.tasks\` lists everything it knows about.

\`\`\`ts
scheduler = container.feature('scheduler')

let schedTicks = 0
const poll = scheduler.every(100, () => { schedTicks++ }, { name: 'demo-poll', immediate: true })

// let it tick a couple of times, then stop it
await container.utils.sleep(350)
poll.stop()

// run history lives on the handle (and in scheduler.tasks)
console.log(poll.info)
if (poll.info.runs < 2) throw new Error(\`expected at least 2 runs, got \${poll.info.runs}\`)
if (poll.info.errors !== 0) throw new Error('demo task should not have errored')
if (poll.info.active !== false) throw new Error('stopped task should be inactive')

const listed = scheduler.tasks.find(t => t.name === 'demo-poll')
if (!listed || listed.runs !== poll.info.runs) throw new Error('scheduler.tasks should list the same snapshot')
console.log(\`demo-poll ran \${poll.info.runs} times, then stopped cleanly\`)
\`\`\`

Intervals accept milliseconds or duration strings (\`'30s'\`, \`'5m'\`, \`'1h30m'\`). Cron tasks use standard 5-field syntax with names and \`@daily\`-style aliases — and \`nextCronDate()\` lets you inspect a schedule without waiting for it:

\`\`\`ts
const digest = scheduler.cron('0 9 * * mon-fri', () => console.log('good morning'), { name: 'digest' })
console.log('digest next fires at', new Date(digest.info.nextRun).toString())
console.log('next Monday 9am:', scheduler.nextCronDate('0 9 * * mon').toString())

// a failing task stays scheduled — errors are recorded, not fatal
const flaky = scheduler.every(100, () => { throw new Error('boom') }, { name: 'flaky', immediate: true })
await container.utils.sleep(150)

// stop everything before the script ends — active tasks hold timers
const stopped = scheduler.stopAll()
console.log(\`stopped \${stopped} tasks\`)
if (flaky.info.errors < 1) throw new Error('expected the flaky task to record its error')
if (flaky.info.active) throw new Error('stopAll should have deactivated flaky')
if (scheduler.state.get('taskCount') !== 0) throw new Error('taskCount should be 0 after stopAll')
\`\`\`

For a daemon command, \`await scheduler.run()\` replaces both the keep-alive promise and the SIGINT handler: it holds the process open, stops all tasks on SIGINT/SIGTERM, awaits your \`onShutdown\` hook, and resolves with the signal name. Run \`luca describe scheduler\` for the full API (\`every\`, \`cron\`, \`at\`, \`in\`, \`stop\`, \`stopAll\`, \`run\`, \`tasks\`, \`nextCronDate\`, events).

## Single-instance locking with proc

\`proc.establishLock(pidPath)\` writes the current PID to a file and **exits the process** if the file already names a live process — so two copies of your daemon never run at once. Stale PID files (dead process) are cleaned up automatically, and cleanup handlers on SIGINT/SIGTERM/exit remove the file on shutdown. It returns \`{ release }\` for manual release.

\`\`\`ts
proc = container.feature('proc')

lockPath = \`tmp/daemon-example-\${Date.now()}.pid\`
const lock = proc.establishLock(lockPath) // paths resolve relative to container.cwd

if (!fs.exists(lockPath)) throw new Error('lock file was not created')
if (fs.readFile(lockPath).trim() !== String(process.pid)) throw new Error('lock file should contain our PID')

lock.release()
if (fs.exists(lockPath)) throw new Error('release() should remove the lock file')
console.log('lock acquired and released cleanly')
\`\`\`

## The full daemon command

Putting it together in a real command file — \`commands/sync-worker.ts\`. Three things make a command long-running: a PID lock so only one instance runs, an \`await new Promise(() => {})\` keep-alive, and a SIGINT handler that cleans up. (Shown, not executed — it runs forever.)

\`\`\`ts skip
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Poll for new work every 30 seconds'

export const argsSchema = z.object({
  interval: z.number().default(30).describe('Poll interval in seconds'),
})

export default async function syncWorker(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // 1. Single-instance guard — exits if another copy is running,
  //    removes the pid file automatically on exit
  const proc = container.feature('proc')
  proc.establishLock('tmp/sync-worker.pid')

  // 2. The poll loop — retries flaky work with backoff inside each tick
  const stop = container.utils.every(options.interval * 1000, async () => {
    await container.utils.backoff(() => doOneSync(container), { attempts: 3, delay: 500 })
  }, { immediate: true, onError: (err) => console.error('tick failed:', err) })

  // 3. Hold the process open; release everything on Ctrl-C
  process.on('SIGINT', () => {
    stop()
    process.exit(0)
  })
  await new Promise(() => {})
}
\`\`\`

## Summary

\`sleep\` for pauses, \`backoff\` for retries, \`every\` for non-overlapping poll loops — all on \`container.utils\`, no imports. A daemon command adds \`proc.establishLock()\` for single-instance safety, \`await new Promise(() => {})\` to stay alive, and a SIGINT handler to clean up — or replaces the last two with a single \`await container.feature('scheduler').run()\`. Run \`luca scaffold command --tutorial\` for the full command-authoring guide.
`,
  "cross-process-state-handoff.md": `---
title: 'Cross-Process State Handoff: store, diskCache, or sqlite'
tags:
  - state
  - store
  - entity
  - diskCache
  - sqlite
  - persistence
  - proc
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Cross-Process State Handoff: store, diskCache, or sqlite

Every script eventually asks: *where does this value live?* The container gives you four stores with four different lifetimes, and picking the wrong one is how you end up serializing a database into a cache key. The heuristic:

- **\`container.state\` / \`container.entity\`** — in-process, observable, dies with the process.
- **\`container.store\`** — cross-process *state*: one durable, schema-validated JSON document per name, with locked read-modify-write updates. The default answer for counters, manifests, process lists, small configs.
- **\`diskCache\`** — cross-process *cache* with optional TTL; entries are losable by contract. Fetch by key, no questions asked.
- **\`sqlite\`** — cross-process *and queryable*; the moment you want to filter, group, or count, it's this one.

This doc exercises all four — including proving the handoffs by reading values back **from a genuinely fresh process**.

## In-process: entities are memoized by id

\`container.entity(id)\` returns the *same* cached object for the same id anywhere in the process — that memoization **is** the in-process handoff. Module A writes state, module B calls \`container.entity('...')\` with the same id and observes it. No exporting singletons, no plumbing. State is observable: observers receive \`(changeType, key, value)\` per mutation — not a state object. (Full API: \`luca describe\`, and see [entity.md](./entity.md).)

\`\`\`ts
// bare assignments — these survive into later blocks
worker = container.entity('handoff:worker')
worker.setState({ progress: 0 })

observed = []
worker.state.observe((changeType, key, value) => {
  if (key === 'progress') observed.push(value)
})

// "another module" asks for the same id — identical instance, same state
const sameWorker = container.entity('handoff:worker')
if (sameWorker !== worker) throw new Error('entity memoization broke — same id must return the same instance')

sameWorker.setState({ progress: 50 })

if (worker.state.get('progress') !== 50) throw new Error('write through one handle must be visible through the other')
if (!observed.includes(50)) throw new Error('observer never saw the update')
console.log('one entity, two handles, observed progress values:', JSON.stringify(observed))
\`\`\`

The catch: all of it evaporates when the process exits. Entities and feature state are wiring, not storage.

## Cross-process state: container.store

Every \`luca <command>\` invocation is a separate process — a server and its \`--stats\` sibling share no memory. \`container.store(name)\` gives that shared state a home: one JSON document, atomic writes, and the method that matters, **\`update()\`** — a locked read-modify-write, so two processes bumping the same counter can never overwrite each other (the classic lost-update bug is impossible by construction, not by discipline).

\`\`\`ts
statsStore = container.store(\`handoff-stats-\${Date.now()}\`, {
  scope: 'tmp',   // demo hygiene — real apps default to 'project': <cwd>/.luca/store/<name>.json
  schema: z.object({ hits: z.number().default(0), misses: z.number().default(0) }),
})

// A missing file reads as the schema's defaults — no init step, no exists-check dance
const empty = await statsStore.read()
if (empty.hits !== 0) throw new Error('schema defaults should apply to a missing file')

// Ten concurrent updates — same-process calls serialize, cross-process calls take a file lock
await Promise.all(Array.from({ length: 10 }, () => statsStore.update(s => { s.hits++ })))

const after = await statsStore.read()
if (after.hits !== 10) throw new Error(\`lost update! expected 10 hits, got \${after.hits}\`)
console.log('10 concurrent updates, 10 recorded hits:', JSON.stringify(after))
\`\`\`

The backing file is ordinary pretty-printed JSON — \`cat\` it, diff it, commit it:

\`\`\`ts
console.log('state lives at:', statsStore.path)
console.log(String(fs.readFile(statsStore.path)))
\`\`\`

### Prove it: a fresh process updates the same store

\`\`\`ts
const devCli2 = container.paths.resolve('src', 'cli', 'cli.ts')
const [cmd2, baseArgs2] = fs.exists(devCli2) ? ['bun', ['run', devCli2, 'eval']] : ['luca', ['eval']]

const storeExpr = \`const s = container.store(\${JSON.stringify(statsStore.name)}, { scope: 'tmp' }); await s.update(d => { d.misses = (d.misses ?? 0) + 1 }); console.log('CHILD_WROTE')\`
const storeChild = await proc.spawnAndCapture(cmd2, [...baseArgs2, storeExpr])

if (storeChild.error !== null) throw new Error(\`child process failed: \${storeChild.stderr.slice(-300)}\`)
const merged = await statsStore.read()
if (merged.misses !== 1 || merged.hits !== 10) throw new Error(\`child write lost or clobbered ours: \${JSON.stringify(merged)}\`)
console.log('fresh process bumped misses without touching our hits:', JSON.stringify(merged))
\`\`\`

Scope note: \`'project'\` (the default) puts files in \`<cwd>/.luca/store/\` — so \`ls .luca/store\` (or \`container.stores.list()\`) answers "what state does this app keep?". \`'machine'\` (\`~/.luca/store/\`) is for state shared across projects. And if you're building a job queue on \`update()\`, you've outgrown it — that's sqlite's job below.

## Cross-process KV: diskCache

\`diskCache\` is a file-backed key-value store (the same cacache engine npm uses). Anything you \`set()\` in one process can be \`get()\` from any other process that opens the same cache path. It has native TTL support: pass \`{ ttl: seconds }\` as the third argument to \`set()\` (or a feature-level \`ttl\` option as a default) — expired entries are evicted on access and behave exactly like cache misses. Remember the miss contract: \`get()\` on a missing *or expired* key **throws**, so guard with \`has()\` (see [error-handling-conventions.md](./error-handling-conventions.md)).

\`\`\`ts
cachePath = container.paths.resolve(os.tmpdir, \`handoff-cache-\${Date.now()}\`)
cache = container.feature('diskCache', { path: cachePath })

token = \`handoff-token-\${Date.now()}\`
await cache.set('handoff:token', token)

// TTL: this entry self-destructs after 1 second
await cache.set('handoff:flash', 'gone-soon', { ttl: 1 })
if (!(await cache.has('handoff:flash'))) throw new Error('ttl entry should exist immediately after set')

await container.utils.sleep(1300)

if (await cache.has('handoff:flash')) throw new Error('ttl entry should have expired and read as a miss')
console.log('ttl entry expired; durable token still cached:', await cache.get('handoff:token'))
\`\`\`

### Prove it: read the key back from a fresh process

The real test of "cross-process" is a process that shares nothing with this one. We spawn \`luca eval\` as a child, point a brand-new container at the same cache path, and read the token back. Note \`spawnAndCapture\` with an **args array** — the expression contains spaces, and \`execAndCapture\` splits its command string naively.

\`\`\`ts
// in the framework repo run through the dev CLI; in your project, \`luca\` is on the PATH
const devCli = container.paths.resolve('src', 'cli', 'cli.ts')
const [cmd, baseArgs] = fs.exists(devCli) ? ['bun', ['run', devCli, 'eval']] : ['luca', ['eval']]

const expr = \`const cache = container.feature('diskCache', { path: \${JSON.stringify(cachePath)} }); console.log('CHILD_READ=' + await cache.get('handoff:token'))\`

const child = await proc.spawnAndCapture(cmd, [...baseArgs, expr])

if (child.error !== null) throw new Error(\`child process failed: \${child.stderr.slice(-300)}\`)
if (!child.stdout.includes(\`CHILD_READ=\${token}\`)) {
  throw new Error(\`fresh process did not read the cached token back; stdout: \${child.stdout.slice(-300)}\`)
}
console.log('fresh process read the token back through diskCache')
\`\`\`

That is the whole handoff pattern: writer sets a key, any later process gets it by key. Scalars, JSON blobs, file contents — as long as access is *by key*, diskCache is the right shelf.

## Cross-process and queryable: sqlite

The moment "read the value" becomes "which ones, how many, grouped by what" — stop stuffing arrays into cache keys and give the data a schema. The \`sqlite\` feature is file-backed too: any process that opens the same path sees the same tables.

\`\`\`ts
dbPath = container.paths.resolve(os.tmpdir, \`handoff-\${Date.now()}.sqlite\`)
db = container.feature('sqlite', { path: dbPath })

await db.execute('CREATE TABLE runs (id INTEGER PRIMARY KEY, status TEXT NOT NULL)')
await db.execute('INSERT INTO runs (status) VALUES (?), (?), (?)', ['done', 'done', 'failed'])

// a question a KV store cannot answer without you re-implementing GROUP BY
const byStatus = await db.sql\`SELECT status, COUNT(*) AS n FROM runs GROUP BY status ORDER BY n DESC\`

if (byStatus[0].status !== 'done' || byStatus[0].n !== 2) throw new Error('GROUP BY answer was wrong')
console.log('run counts by status:', JSON.stringify(byStatus))
\`\`\`

For the full extract → normalize → load → query workflow (bulk inserts inside \`db.transaction()\`, tagged-template parameters, cross-checking SQL against lodash), see [data-pipeline-fs-grep-sqlite.md](./data-pipeline-fs-grep-sqlite.md).

## Clean up

\`\`\`ts
db.close()
await fs.rm(dbPath)
await fs.rmdir(cachePath)
await statsStore.delete()
console.log('removed scratch db, cache dir, and store')
\`\`\`

## The decision heuristic

| The value... | Reach for | Why |
|---|---|---|
| Stays inside this process; other modules should react to it | \`container.state\` / \`container.entity\` | Observable, memoized by id, zero persistence |
| Is *state* other processes read and mutate — counters, manifests, process lists, small configs | \`container.store\` | One durable JSON doc; \`update()\` is a locked read-modify-write, so concurrent commands can't lose writes |
| Is a *cache* — recomputable, fetch-by-key, may expire | \`diskCache\` | KV with native TTL (\`set(key, value, { ttl })\`); remember \`get()\` throws on a miss |
| You will ask questions of it — filter, count, group, join, claim-one-atomically | \`sqlite\` | A file path makes it durable and shared; SQL makes it queryable |

When in doubt: if losing the value is a bug, it's a store; if losing it is a cache miss, it's a cache; if the access pattern is a question, table it; if nobody outside this process cares, keep it in state.
`,
  "testing-a-composed-feature.md": `---
title: Testing a Composed Feature
tags:
  - testing
  - bun
  - features
  - state
  - events
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Testing a Composed Feature

You built a feature that composes other helpers — now prove it works. The test runner is **bun** (\`bun test\`, never vitest), and the patterns below are the ones this framework's own \`test/*.test.ts\` files use: a fresh container per test, state assertions via \`state.get()\`, observer spies, and events awaited as promises.

One honest caveat about this document: \`bun:test\` only exists inside a \`bun test\` run, not inside the container VM that executes these docs. So the real test code appears in **skip blocks** (shown verbatim, not executed), and each one is paired with a **runnable block** that performs the identical assertions with plain conditionals — which means the claims in the skip blocks are still regression-checked every time this doc runs.

## The feature under test

A small but genuinely composed feature: \`tally\` counts lines in files through the \`fs\` feature, tracks observable state, and emits a \`tallied\` event. In a real project this lives at \`features/tally.ts\`; here we write it into a scratch folder inside the project (inside, because its \`import ... from 'luca'\` must resolve against project dependencies) and load it through discovery — the exact mechanism that loads a project's \`features/\` folder.

\`\`\`ts
// bare assignments (no const) so these survive into later blocks
pluginRoot = container.paths.resolve('tmp', \`testing-composed-feature-\${Date.now()}\`)
featureDir = container.paths.resolve(pluginRoot, 'features')

const featureSource = \`
import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'

export const TallyStateSchema = FeatureStateSchema.extend({
  tallies: z.number().default(0).describe('How many tallies have run'),
  lastCount: z.number().optional().describe('Line count from the most recent tally'),
})
export type TallyState = z.infer<typeof TallyStateSchema>

export const TallyOptionsSchema = FeatureOptionsSchema.extend({
  trim: z.boolean().default(true).describe('Ignore trailing newlines when counting'),
})
export type TallyOptions = z.infer<typeof TallyOptionsSchema>

export const TallyEventsSchema = FeatureEventsSchema.extend({
  tallied: z.tuple([
    z.string().describe('The file that was counted'),
    z.number().describe('The line count'),
  ]).describe('Emitted after each completed tally'),
})

/**
 * Counts lines in files by composing the fs feature.
 */
export class Tally extends Feature<TallyState, TallyOptions> {
  static override shortcut = 'features.tally' as const
  static override stability = 'experimental' as const
  static override stateSchema = TallyStateSchema
  static override optionsSchema = TallyOptionsSchema
  static override eventsSchema = TallyEventsSchema
  static { Feature.register(this, 'tally') }

  // initialState is NOT derived from schema defaults — declare it explicitly
  override get initialState(): TallyState {
    return { enabled: false, tallies: 0 }
  }

  async tally(file: string) {
    const fs = this.container.feature('fs')
    if (!fs.exists(file)) throw new Error('tally: no such file: ' + file)

    let text = String(fs.readFile(file))
    if (this.options.trim !== false) text = text.replace(/\\\\n+$/, '')
    const lines = text.split('\\\\n').length

    this.setState({ tallies: (this.state.get('tallies') || 0) + 1, lastCount: lines })
    this.emit('tallied', file, lines)
    return lines
  }
}

export default Tally
\`

fs.ensureFolder(featureDir)
fs.writeFile(container.paths.resolve(featureDir, 'tally.ts'), featureSource)

// a fixture to count: three lines plus a trailing newline
sampleFile = container.paths.resolve(pluginRoot, 'sample.txt')
fs.writeFile(sampleFile, 'alpha\\nbeta\\ngamma\\n')

const discovered = await helpers.discover('features', { directory: featureDir })
if (!container.features.available.includes('tally')) throw new Error('tally did not register via discovery')
console.log('discovered and registered:', discovered)
\`\`\`

## How do I get a fresh container in a test?

The answer the real tests use: **construct one**. \`new NodeContainer()\` per test (or per \`describe\`) gives you isolated helper instances while sharing the module-global registry — registration happens in the feature file's \`static { Feature.register(...) }\` block the moment the module is imported.

\`\`\`ts skip
import { describe, it, expect } from 'bun:test'
import { NodeContainer } from 'luca'   // in the framework repo itself: '../src/node/container'
import './features/tally'              // side-effect import runs Feature.register

describe('tally registration', () => {
  it('is registered once the module is imported', () => {
    const c = new NodeContainer()
    expect(c.features.available).toContain('tally')
  })

  it('memoizes per container: same args return same instance', () => {
    const c = new NodeContainer()
    expect(c.feature('tally').uuid).toBe(c.feature('tally').uuid)
  })

  it('different containers get different instances', () => {
    const a = new NodeContainer().feature('tally')
    const b = new NodeContainer().feature('tally')
    expect(a.uuid).not.toBe(b.uuid)
  })
})
\`\`\`

Two rules fall out of this: **registries are global** (register once, visible from every container), and **instances are per container, memoized by id + options** (so a fresh container is what gives a test a clean slate).

Doc blocks don't have the \`NodeContainer\` class in scope, but \`container.subcontainer({})\` constructs a fresh instance of the same concrete class — so we can verify those exact claims right now:

\`\`\`ts
freshContainer = container.subcontainer({})

if (!freshContainer.features.available.includes('tally')) throw new Error('registry should be shared globally')

const a = container.feature('tally')
const b = container.feature('tally')
if (a.uuid !== b.uuid) throw new Error('same container + same options should memoize to one instance')

const c = freshContainer.feature('tally')
if (c.uuid === a.uuid) throw new Error('a fresh container should get a fresh instance')
console.log('registry shared, instances isolated per container')
\`\`\`

## Asserting behavior and state

The bun:test version — construct, call, assert on the return value and on \`state.get()\`:

\`\`\`ts skip
import { describe, it, expect } from 'bun:test'
import { NodeContainer } from 'luca'
import './features/tally'

describe('tally()', () => {
  it('counts lines and updates state', async () => {
    const c = new NodeContainer()
    const tally = c.feature('tally')

    const lines = await tally.tally('test/fixtures/sample.txt')

    expect(lines).toBe(3)
    expect(tally.state.get('lastCount')).toBe(3)
    expect(tally.state.get('tallies')).toBe(1)
  })

  it('respects options', async () => {
    const c = new NodeContainer()
    const raw = c.feature('tally', { trim: false })
    expect(await raw.tally('test/fixtures/sample.txt')).toBe(4) // trailing newline counts
  })
})
\`\`\`

The same assertions, live — each "test" takes a fresh subcontainer, exactly as each \`it()\` above takes a fresh \`NodeContainer\`:

\`\`\`ts
const tally = container.subcontainer({}).feature('tally')
const lines = await tally.tally(sampleFile)
if (lines !== 3) throw new Error(\`expected 3 lines, got \${lines}\`)
if (tally.state.get('lastCount') !== 3) throw new Error('state.lastCount not updated')
if (tally.state.get('tallies') !== 1) throw new Error('state.tallies should be 1 after one run')

const raw = container.subcontainer({}).feature('tally', { trim: false })
const rawLines = await raw.tally(sampleFile)
if (rawLines !== 4) throw new Error(\`trim:false should count the trailing newline, got \${rawLines}\`)
console.log('behavior and state verified: 3 trimmed, 4 raw')
\`\`\`

## Spying on state observers

In bun tests, \`mock()\` gives you a spy, and the observer contract is \`(changeType, key, value)\` — \`'add'\` for a new key, \`'update'\` for an existing one, \`'delete'\` on removal:

\`\`\`ts skip
import { describe, it, expect, mock } from 'bun:test'
import { NodeContainer } from 'luca'
import './features/tally'

it('notifies state observers', async () => {
  const c = new NodeContainer()
  const tally = c.feature('tally')
  const observer = mock()
  tally.state.observe(observer)

  await tally.tally('test/fixtures/sample.txt')

  expect(observer).toHaveBeenCalledWith('update', 'tallies', 1)   // existed in initialState
  expect(observer).toHaveBeenCalledWith('add', 'lastCount', 3)    // first write of a new key
})
\`\`\`

Without \`mock()\`, a plain array records the same call log:

\`\`\`ts
const t = container.subcontainer({}).feature('tally')
const calls = []
const unsubscribe = t.state.observe((changeType, key, value) => calls.push([changeType, key, value]))

await t.tally(sampleFile)

const saw = (type, key, value) => calls.some(c => c[0] === type && c[1] === key && c[2] === value)
if (!saw('update', 'tallies', 1)) throw new Error('observer missed the tallies update (key existed in initialState)')
if (!saw('add', 'lastCount', 3)) throw new Error('observer missed the lastCount add (new key)')

unsubscribe()
await t.tally(sampleFile)
if (calls.length !== 2) throw new Error('unsubscribe() should stop notifications')
console.log('observer contract verified: (changeType, key, value), unsubscribe works')
\`\`\`

## Awaiting events

Real tests wrap the event in a promise **before** triggering the behavior (the pattern in \`test/websocket-ask.test.ts\`), then await it:

\`\`\`ts skip
import { it, expect } from 'bun:test'
import { NodeContainer } from 'luca'
import './features/tally'

it('emits tallied with the file and count', async () => {
  const c = new NodeContainer()
  const tally = c.feature('tally')

  const event = new Promise((resolve) => {
    tally.once('tallied', (file, count) => resolve({ file, count }))
  })

  await tally.tally('test/fixtures/sample.txt')

  const { file, count } = await event
  expect(file).toContain('sample.txt')
  expect(count).toBe(3)
})
\`\`\`

Every helper also has \`waitFor(event)\` — handy shorthand, with one caveat: it resolves with only the **first** listener argument, so for multi-argument events like \`tallied(file, count)\` use the promise-plus-\`once\` pattern to capture everything.

\`\`\`ts
const t2 = container.subcontainer({}).feature('tally')

// promise-plus-once: captures every event argument
const event = new Promise((resolve) => {
  t2.once('tallied', (file, count) => resolve({ file, count }))
})
await t2.tally(sampleFile)

const { file, count } = await event
if (!file.endsWith('sample.txt')) throw new Error('tallied event missing the file argument')
if (count !== 3) throw new Error('tallied event missing the count argument')

// waitFor: shorthand for the next emission, but only the FIRST argument survives
const firstArgOnly = t2.waitFor('tallied')
await t2.tally(sampleFile)
const viaWaitFor = await firstArgOnly
if (viaWaitFor !== file) throw new Error('waitFor should resolve with the first event argument')

console.log('event awaited: tallied', count, 'lines — waitFor caveat confirmed')
\`\`\`

## Cleaning up long-lived helpers

If a feature under test opens sockets, servers, or watchers, the suite hangs without teardown. The framework's own websocket tests use \`afterAll\`:

\`\`\`ts skip
import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from 'luca'

describe('a feature that starts a server', () => {
  const c = new NodeContainer()
  const server = c.server('websocket', { json: true })

  afterAll(async () => {
    try { await server.stop() } catch {}
  })

  // ...its
})
\`\`\`

Our tally feature holds no resources, so this doc only needs to remove its scratch folder:

\`\`\`ts
await fs.rmdir(pluginRoot)
console.log('cleaned up', pluginRoot)
\`\`\`

## The checklist

- Tests live in \`test/<name>.test.ts\` and run with \`bun test\` (or \`bun test test/tally.test.ts\` for one file). Never vitest.
- Importing anything from \`bun:test\` disables auto-globals — import \`describe\`, \`it\`, \`expect\` explicitly alongside \`mock\` / \`spyOn\` / \`afterAll\`.
- **Fresh container per test**: \`new NodeContainer()\`. Registration is global; instances are memoized per container + options.
- Import the feature module (side-effect registration) or run \`helpers.discover('features', { directory })\` before asking the container for it.
- Assert state with \`state.get()\`; spy on \`state.observe\` knowing the \`(changeType, key, value)\` contract; await events with promise-plus-\`once\` (or \`waitFor\` when one argument is enough).
- Tear down servers and sockets in \`afterAll\` — and keep every test passing; broken tests don't get committed.
`,
  "websocket-ask-and-reply-example.md": `---
title: websocket-ask-and-reply
tags:
  - websocket
  - client
  - server
  - ask
  - reply
  - rpc
lastTested: '2026-07-05'
lastTestPassed: true
---

# websocket-ask-and-reply

Request/response conversations over WebSocket using \`ask()\` and \`reply()\`.

## Overview

The WebSocket client and server both support a request/response protocol on top of the normal fire-and-forget message stream. The client can \`ask()\` the server a question and await the answer. The server can \`ask()\` a connected client the same way. Under the hood it works with correlation IDs — \`requestId\` on the request, \`replyTo\` on the response — but you never have to touch those directly.

## Setup

Declare the shared references that all blocks will use, and wire up the server's message handler. This block is synchronous so the variables persist across subsequent blocks.

\`\`\`ts
var port = 0
var server = container.server('websocket', { json: true })
var client = null

server.on('message', (data, ws) => {
  if (data.type === 'add') {
    data.reply({ sum: data.data.a + data.data.b })
  } else if (data.type === 'divide') {
    if (data.data.b === 0) {
      data.replyError('division by zero')
    } else {
      data.reply({ result: data.data.a / data.data.b })
    }
  }
})
console.log('Server and handlers configured')
\`\`\`

## Start Server and Connect Client

\`\`\`ts
port = await networking.findOpenPort(19900)
await server.start({ port })
console.log('Server listening on port', port)

client = container.client('websocket', { baseURL: \`ws://localhost:\${port}\` })
await client.connect()
console.log('Client connected')
\`\`\`

## Client Asks the Server

\`ask(type, data, timeout?)\` sends a message and returns a promise that resolves with the response payload.

\`\`\`ts
var sum = await client.ask('add', { a: 3, b: 4 })
console.log('3 + 4 =', sum.sum)

var quotient = await client.ask('divide', { a: 10, b: 3 })
console.log('10 / 3 =', quotient.result.toFixed(2))
\`\`\`

## Handling Errors

When the server calls \`replyError(message)\`, the client's \`ask()\` promise rejects with that message.

\`\`\`ts
try {
  await client.ask('divide', { a: 1, b: 0 })
} catch (err) {
  console.log('Caught error:', err.message)
}
\`\`\`

## Server Asks the Client

The server can also ask a connected client. The client handles incoming requests by listening for messages with a \`requestId\` and sending back a \`replyTo\` response.

\`\`\`ts
client.on('message', (data) => {
  if (data.requestId && data.type === 'whoAreYou') {
    client.send({ replyTo: data.requestId, data: { name: 'luca-client', version: '1.0' } })
  }
})

var firstClient = [...server.connections][0]
var identity = await server.ask(firstClient, 'whoAreYou')
console.log('Client identified as:', identity.name, identity.version)
\`\`\`

## Timeouts

If nobody replies, \`ask()\` rejects after the timeout (default 10s, configurable as the third argument).

\`\`\`ts
try {
  await client.ask('noop', {}, 500)
} catch (err) {
  console.log('Timed out as expected:', err.message)
}
\`\`\`

## Regular Messages Still Work

Messages without \`requestId\` flow through the normal \`message\` event as always. The ask/reply protocol is purely additive.

\`\`\`ts
var received = null
server.on('message', (data) => {
  if (data.type === 'ping') received = data
})

await client.send({ type: 'ping', ts: Date.now() })
await new Promise(r => setTimeout(r, 50))
console.log('Regular message received:', received.type, '— no requestId:', received.requestId === undefined)
\`\`\`

## Cleanup

\`\`\`ts
await client.disconnect()
await server.stop()
console.log('Done')
\`\`\`

## Summary

The ask/reply protocol gives you awaitable request/response over WebSocket without leaving the Luca helper API. The client calls \`ask(type, data)\` and gets back a promise. The server's message handler gets \`reply()\` and \`replyError()\` injected on any message that carries a \`requestId\`. The server can also \`ask()\` a specific client. Timeouts, error propagation, and cleanup of pending requests on disconnect are all handled automatically.
`,
  "error-handling-conventions.md": `---
title: Error-Handling Conventions
tags:
  - errors
  - conventions
  - rest
  - diskCache
  - proc
  - registries
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Error-Handling Conventions

The framework's helpers do not all fail the same way — and several fail the *opposite* of how instinct says they should. This doc is the map: each convention below is demonstrated live and asserted, so if a contract ever changes, this doc fails.

The four to internalize:

1. **\`rest\` returns errors** as values — try/catch catches nothing.
2. **\`diskCache.get\` throws on a miss** — it does not return \`undefined\`.
3. **\`proc.exec\` throws on failure; \`proc.execAndCapture\` never throws** — check \`.error\`.
4. **Registries are classes** — \`Object.keys()\` lies; use \`.available\`.

## 1. The rest client returns errors

The full walkthrough (HTTP errors, health-check idiom, rate limits) lives in [full-stack-slice.md](./full-stack-slice.md); here is just the reflex. A request to a dead port **resolves** — the error comes back as a plain serialized object, not a thrown exception, and \`instanceof Error\` is \`false\`. Connection failures carry a \`code\` (the exact string is runtime-dependent: \`'ConnectionRefused'\` under Bun, \`'ECONNREFUSED'\` under Node — never assert the exact string).

\`\`\`ts
const deadPort = await networking.findOpenPort(4720)
const down = container.client('rest', { baseURL: \`http://localhost:\${deadPort}\` })

const result = await down.get('/anything')

if (result instanceof Error) throw new Error('unexpected: rest error came back as an Error instance')
if (!result?.code) throw new Error('expected a connection error code on the returned value')
console.log('dead server resolved to a value with code:', result.code)
\`\`\`

So never write \`try { await api.get(...) } catch { ... }\` and call it handled — inspect the shape of what came back (\`result?.name === 'AxiosError'\`, \`result?.code\`, \`result?.status\`).

## 2. diskCache.get throws on a miss

The mirror image of the rest client: a cache miss **rejects**, it does not resolve to \`undefined\`. The rejection is a \`NotFoundError\` with \`code: 'ENOENT'\`. (Full API: \`luca describe diskCache\`.)

\`\`\`ts
// bare assignment — cacheDir survives into the cleanup block
cacheDir = container.paths.resolve(os.tmpdir, \`error-conventions-cache-\${Date.now()}\`)
cache = container.feature('diskCache', { path: cacheDir })

let caught = null
try {
  await cache.get('never-written')
} catch (err) {
  caught = err
}

if (!caught) throw new Error('diskCache.get on a missing key must throw — it did not')
if (caught.code !== 'ENOENT') throw new Error(\`expected code ENOENT on a cache miss, got \${caught.code}\`)
console.log('cache miss rejected with code:', caught.code)
\`\`\`

The idiomatic guards: \`has()\` before \`get()\`, or \`ensure()\` to seed a default so the read can never miss.

\`\`\`ts
if (await cache.has('never-written')) throw new Error('has() should be false for a missing key')

await cache.ensure('never-written', 'default-value')
const val = await cache.get('never-written')
if (val !== 'default-value') throw new Error('ensure() should have seeded the default')
console.log('guarded read after ensure():', val)
\`\`\`

## 3. proc: exec throws, execAndCapture reports

\`proc.exec(cmd)\` is synchronous, runs through a shell, and returns the **trimmed stdout as a plain string**. On a nonzero exit it **throws**, with the exit code at \`err.status\`.

\`\`\`ts
const banner = proc.exec('echo hello')
if (banner !== 'hello') throw new Error(\`exec should return trimmed stdout, got \${JSON.stringify(banner)}\`)

let execError = null
try {
  proc.exec('exit 3')
} catch (err) {
  execError = err
}
if (!execError) throw new Error('exec on a failing command must throw')
if (execError.status !== 3) throw new Error(\`expected err.status === 3, got \${execError.status}\`)
console.log('exec returned a string on success, threw with status', execError.status, 'on failure')
\`\`\`

\`proc.execAndCapture(cmd)\` is asynchronous and **never throws for a failing command** — it always resolves to a structured \`{ stdout, stderr, exitCode, pid, error }\`. On success \`error\` is \`null\` and \`exitCode\` is \`0\`; on a nonzero exit \`exitCode\` carries the child's real status and \`error\` is set (with the code also at \`error.code\`).

\`\`\`ts
const ok = await proc.execAndCapture('bun --version')
if (typeof ok.stdout !== 'string' || !ok.stdout.trim()) throw new Error('expected captured stdout')
if (ok.error !== null) throw new Error('successful run should have error === null')
if (ok.exitCode !== 0) throw new Error('successful run should have exitCode 0')

const failed = await proc.execAndCapture('bun -e process.exit(3)')
if (failed.exitCode !== 3) throw new Error(\`expected exitCode === 3, got \${failed.exitCode}\`)
if (failed.error == null) throw new Error('nonzero exit should also surface on .error')
if (failed.error.code !== 3) throw new Error(\`expected error.code === 3, got \${failed.error.code}\`)
console.log('execAndCapture failure: exitCode =', failed.exitCode, ', error.code =', failed.error.code)
\`\`\`

One trap to know:

- **The command string is split naively on spaces** — no shell quoting. Any argument containing spaces (paths, \`--format="%h %s"\`) gets mangled. Use \`proc.spawnAndCapture(command, argsArray)\` and pass each argument as its own element.

## 4. Registries are classes — use .available

\`container.features\`, \`container.commands\`, \`container.clients\`, \`container.servers\` are class instances, not plain objects. \`Object.keys()\` on them returns internal fields, **not** helper ids. Enumerate with \`.available\`.

\`\`\`ts
const keys = Object.keys(container.features)
if (keys.includes('fs')) throw new Error('unexpected: Object.keys() now enumerates helper ids — update this doc')
if (!container.features.available.includes('fs')) throw new Error('.available should list the fs feature')

console.log('Object.keys(container.features) =', JSON.stringify(keys), '— useless for enumeration')
console.log('.available lists', container.features.available.length, 'features, including fs')
\`\`\`

## Clean up

\`\`\`ts
await fs.rmdir(cacheDir)
console.log('removed scratch cache dir', cacheDir)
\`\`\`

## The cheat sheet

- **\`rest\` client** — failure is **returned** as a plain object. Detect: \`result?.name === 'AxiosError'\`, \`result?.code\`, \`result?.status\`.
- **\`diskCache.get\`** — a miss **throws** \`NotFoundError\` (\`code: 'ENOENT'\`). Detect: try/catch, or guard with \`has()\` / \`ensure()\`.
- **\`proc.exec\`** — failure **throws**, exit code at \`err.status\`. Detect: try/catch.
- **\`proc.execAndCapture\`** — always **resolves**; failure reports the real \`exitCode\` and sets \`.error\`. Detect: \`result.exitCode === 0\` (or \`result.error === null\`) means success.
- **Registries** — \`Object.keys()\` returns internals. Enumerate with \`.available\`.
`,
  "llm-proxy.md": `---
title: 'One Endpoint For All Your Compute: the llmProxy Server'
tags:
  - llmProxy
  - servers
  - docker
  - litellm
  - openai
  - composition
---

# One Endpoint For All Your Compute: the llmProxy Server

The \`llmProxy\` server runs a [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start) in a docker container and fronts every backend you have — a GPU box on the LAN, LM Studio on this machine, paid APIs — with a single OpenAI-compatible endpoint. Point every client at \`proxy.baseURL\` and pick backends by model name.

For the full API: \`luca describe llmProxy\`. Requires the docker CLI for \`start()\`; config generation below runs without it.

## The model routing table

Each \`models\` entry maps a client-facing \`modelName\` to a backend. Local OpenAI-compatible servers (LM Studio, vLLM, llama.cpp, SGLang) use \`provider: 'openai'\` plus an \`apiBase\`; paid APIs just need their provider and a key.

\`\`\`ts
proxy = container.server('llmProxy', {
  port: 4000,
  masterKey: 'sk-luca-dev',
  models: [
    // LM Studio on this machine
    { modelName: 'local-qwen', provider: 'openai', model: 'qwen2.5-32b', apiBase: 'http://localhost:1234/v1', apiKey: 'lm-studio' },
    // a GPU box on the LAN serving vLLM
    { modelName: 'dgx-llama', provider: 'openai', model: 'llama-3.3-70b', apiBase: 'http://192.168.1.50:8000/v1', apiKey: 'none' },
    // a paid API
    { modelName: 'claude', provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-example' },
  ],
})

console.log(proxy.baseURL)        // http://localhost:4000
console.log(proxy.containerName)  // luca-llm-proxy-4000
\`\`\`

## What gets generated — and the two things that surprise everyone

\`writeConfig()\` (called by \`start()\`) writes the LiteLLM \`config.yaml\` into a tmp dir. Two behaviors to know about:

1. **localhost is rewritten.** The proxy runs *inside* a container, where \`localhost\` is the container itself — so LM Studio at \`http://localhost:1234/v1\` would be unreachable. Any localhost/127.0.0.1/0.0.0.0 \`apiBase\` is rewritten to the host gateway (\`host.docker.internal\` by default, \`hostGatewayOverride\` to change it).
2. **Secrets never touch the YAML.** API keys are written to a \`0600\` env file next to the config and referenced as \`os.environ/...\`. The env file is passed to the container via \`--env-file\` and deleted on \`stop()\`.

\`\`\`ts
configPath = await proxy.writeConfig()
const config = container.feature('yaml').parse(container.feature('fs').readFile(configPath).toString())

console.log(config.model_list[0].litellm_params.api_base)
// http://host.docker.internal:1234/v1  <- localhost, rewritten

console.log(config.model_list[0].litellm_params.api_key)
// os.environ/LUCA_LLM_KEY_0            <- a reference, not the key

console.log(config.general_settings.master_key)
// os.environ/LITELLM_MASTER_KEY
\`\`\`

Clean up the generated files since we're not booting the container in this doc:

\`\`\`ts
await container.feature('fs').rm(container.paths.resolve(configPath, '..'), { recursive: true, force: true })
\`\`\`

## Booting it for real

\`start()\` checks docker availability, force-removes any stale \`luca-llm-proxy-<port>\` container (so the running config always matches your options), runs the image with the port published and config mounted, and polls \`/health/liveliness\` until healthy — failing loudly with the container's log tail if it never comes up.

\`\`\`ts skip
await proxy.start()

// one OpenAI-compatible endpoint for everything
const client = container.client('rest', { baseURL: proxy.baseURL })
const models = await client.get('/v1/models', { headers: { Authorization: 'Bearer sk-luca-dev' } })
console.log(models.data.map(m => m.id))   // ['local-qwen', 'dgx-llama', 'claude']

// chat completions route by model name
const reply = await client.post('/v1/chat/completions', {
  body: { model: 'local-qwen', messages: [{ role: 'user', content: 'hello' }] },
  headers: { Authorization: 'Bearer sk-luca-dev' },
})

// tail the LiteLLM container logs when something misbehaves
console.log(await proxy.logs({ tail: 20 }))

await proxy.stop()  // stops + removes the container, deletes the env file
\`\`\`

## Where this fits

- \`luca describe llmProxy\` — full options/state reference
- \`luca describe docker\` — the feature doing the container lifting underneath
- \`docs/examples/server-rest-roundtrip.md\` — the rest client patterns used against \`proxy.baseURL\`
`,
  "server-rest-roundtrip.md": `---
title: Server + REST Client Roundtrip
tags:
  - express
  - endpoints
  - rest
  - rateLimit
  - server
  - http
lastTested: '2026-07-05'
lastTestPassed: true
---

# Server + REST Client Roundtrip

Start an express server with file-based endpoints, add a raw custom route through the \`create\` hook, call it all with the \`rest\` client — and see how the client reports errors (it **returns** them, it never throws). Also: endpoints get IP-keyed rate limiting for free, no middleware to write.

## Write an endpoint module

Endpoints are plain modules. Exporting \`rateLimit\` turns on built-in sliding-window rate limiting — this one allows 3 requests per minute per IP.

\`\`\`ts
const fs = container.feature('fs')
const dir = container.paths.resolve('tmp', 'roundtrip-endpoints')
fs.ensureFolder(dir)

fs.writeFile(container.paths.resolve(dir, 'status.ts'), \`
export const path = '/status'
export const description = 'Rate-limited status endpoint'
export const rateLimit = { maxRequests: 3, windowSeconds: 60 }

export async function get() {
  return { ok: true, time: new Date().toISOString() }
}
\`)
console.log('endpoint written to', dir)
\`\`\`

## Create the server and client

The \`create: (app, server) => app\` hook runs when the express app is built — the door for raw middleware and routes that don't fit the endpoint-module shape. (Two more doors: \`server.app.use(...)\` after creation, and \`luca serve --setup setup.ts\` from the CLI.)

\`\`\`ts
const server = container.server('express', {
  cors: true,
  create: (app) => {
    app.get('/custom', (req, res) => res.json({ source: 'create hook' }))
    return app
  },
})

const api = container.client('rest', { baseURL: 'http://localhost:43117' })
console.log('server and client created')
\`\`\`

## Mount the endpoints and start listening

\`useEndpoints(dir)\` loads every endpoint module in a folder — the same discovery \`luca serve\` does for your project's \`endpoints/\`.

\`\`\`ts
await server.useEndpoints(dir)
await server.start({ port: 43117 })
console.log('listening:', server.state.get('listening'))
\`\`\`

## Call it with the rest client

Methods return the parsed JSON body directly — no \`{ data, status }\` wrapper.

\`\`\`ts
const status = await api.get('/status')
console.log('GET /status →', status)

const custom = await api.get('/custom')
console.log('GET /custom →', custom)
\`\`\`

## Errors are returned, not thrown

This is the rest client's most important contract — and the easiest to get wrong. HTTP errors (4xx/5xx) AND connection failures (ECONNREFUSED, DNS, timeouts) resolve with the error serialized as JSON. A \`try/catch\` around \`api.get(...)\` catches **nothing**. Inspect the returned shape instead.

Burn through the rate limit to see it live — requests 2 and 3 pass, the 4th comes back as a 429 error object:

\`\`\`ts
for (let i = 2; i <= 4; i++) {
  const result = await api.get('/status')
  if (result?.name === 'AxiosError') {
    console.log(\`request \${i} → BLOCKED (\${result.status ?? result.code}): \${result.message}\`)
  } else {
    console.log(\`request \${i} → ok\`)
  }
}
\`\`\`

Same story for a server that's down — the connection error comes back as a value too (the \`code\` is runtime-flavored: \`ECONNREFUSED\` under node, \`ConnectionRefused\` under bun — check \`result?.name === 'AxiosError'\` when you need a runtime-agnostic test):

\`\`\`ts
const nobody = container.client('rest', { baseURL: 'http://localhost:59999' })
const down = await nobody.get('/anything')
console.log('down server →', down?.code, '|', down?.message)
\`\`\`

## Cleanup

\`\`\`ts
await server.stop()
await fs.rmdir(dir)
console.log('stopped:', server.state.get('stopped'))
\`\`\`

## Summary

Endpoint modules export \`path\` + method handlers, and \`rateLimit\`/\`getRateLimit\` for free per-IP throttling. Raw routes go through the \`create\` hook, \`server.app.use()\`, or \`luca serve --setup\`. The \`rest\` client returns parsed JSON on success and **returns error objects on any failure** — check \`result?.name === 'AxiosError'\` or \`result?.code\`, don't \`try/catch\`.
`,
  "semantic-search-content-db.md": `---
title: 'Searching a Document Collection: contentDb + semanticSearch'
tags:
  - contentDb
  - semanticSearch
  - search
  - bm25
  - embeddings
  - markdown
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Searching a Document Collection: contentDb + semanticSearch

Two features compose into a searchable knowledge base: **contentDb** manages a folder of markdown documents (frontmatter, models, section-aware reads), and **semanticSearch** indexes them into SQLite for retrieval. The honest part up front — search has three tiers with different requirements:

1. **grep** — regex over the files. Always works.
2. **BM25 keyword search** — SQLite FTS5, ranked and snippeted. Works offline with zero credentials.
3. **Vector / hybrid search** — needs embeddings, which means either an \`OPENAI_API_KEY\` or a one-time local model install. It does **not** work out of the box; the setup is shown honestly at the end.

Everything through tier 2 runs live below. For each feature's full API: \`luca describe contentDb\`, \`luca describe semanticSearch\`.

## Write a small corpus

Five themed documents with frontmatter — the shape of any \`docs/\` folder contentDb manages. A collection doesn't require a \`models.ts\`; without one, every document falls under the built-in \`Base\` model.

\`\`\`ts
// bare assignments (no const) so these survive into later blocks
corpusRoot = container.paths.resolve('tmp', \`semantic-search-demo-\${Date.now()}\`)
docsDir = container.paths.resolve(corpusRoot, 'docs')
fs.ensureFolder(docsDir)

const corpus = {
  'caching.md': \`---
title: Caching Guide
area: performance
---

# Caching Guide

Layered caches keep latency low.

## Strategy

Cache at the edge first, then in the application, then at the database.

## Invalidation

Cache invalidation is the hardest problem: prefer short TTLs over clever purging.
\`,
  'authentication.md': \`---
title: Authentication Guide
area: security
---

# Authentication Guide

Sessions and tokens identify users.

## Sessions

Server-side sessions store state; rotate identifiers after privilege changes.

## Tokens

Signed tokens carry claims; keep lifetimes short and refresh them.
\`,
  'deployments.md': \`---
title: Deployment Guide
area: operations
---

# Deployment Guide

Ship through a pipeline, never by hand.

## Rollbacks

Every deploy needs a one-command rollback path.
\`,
  'observability.md': \`---
title: Observability Guide
area: operations
---

# Observability Guide

Logs, metrics, and traces answer different questions.

## Alerting

Alert on symptoms users feel, not on every internal metric.
\`,
  'testing.md': \`---
title: Testing Guide
area: quality
---

# Testing Guide

Fast unit tests gate every change in the pipeline.

## Flakes

A flaky test is worse than no test: quarantine it the day it flakes.
\`,
}

for (const [name, content] of Object.entries(corpus)) {
  fs.writeFile(container.paths.resolve(docsDir, name), content)
}
console.log('corpus written:', Object.keys(corpus).join(', '))
\`\`\`

## Load it with contentDb

Point \`contentDb\` at the folder and \`load()\`. Document ids are file paths without the extension; frontmatter is parsed into \`meta\`; \`read()\` can slice out individual sections so you never load a whole document for one heading.

\`\`\`ts
cdb = container.feature('contentDb', { rootPath: docsDir })
await cdb.load()

console.log('documents:', cdb.available.join(', '))
if (cdb.available.length !== 5) throw new Error(\`expected 5 documents, got \${cdb.available.length}\`)
if (!cdb.modelNames.includes('Base')) throw new Error('collections without models.ts should expose the Base model')

const caching = await cdb.document({ id: 'caching' })
if (caching.title !== 'Caching Guide') throw new Error('frontmatter title not parsed')
if (caching.meta.area !== 'performance') throw new Error('frontmatter meta not parsed')

// section-aware read: just the Invalidation section, not the whole doc
const invalidation = await cdb.read('caching', { include: ['Invalidation'] })
console.log(invalidation)
if (!invalidation.includes('hardest problem')) throw new Error('include filter should return the Invalidation section')
if (invalidation.includes('Cache at the edge')) throw new Error('include filter should drop the Strategy section')
\`\`\`

Tier 1 search is already available — \`cdb.grep(pattern)\` runs the \`grep\` feature scoped to the collection:

\`\`\`ts
const grepHits = await cdb.grep('rollback')
console.log(grepHits.map(h => \`\${h.file}:\${h.line}\`))
if (!grepHits.some(h => h.file.endsWith('deployments.md'))) throw new Error('grep should find rollback in deployments.md')
\`\`\`

## Tier 2: BM25 keyword search — offline, no credentials

The \`semanticSearch\` feature is SQLite-backed: FTS5 for keyword search, BLOB-stored vectors for similarity. The keyword half needs no embeddings at all — \`insertDocument()\` syncs the FTS index directly, so we can compose the two features by feeding contentDb's documents in and get ranked, snippeted search immediately.

\`\`\`ts
ss = container.feature('semanticSearch', {
  dbPath: container.paths.resolve(corpusRoot, 'index', 'search.sqlite'),
})
await ss.initDb()

for (const id of cdb.available) {
  const doc = await cdb.document({ id })
  ss.insertDocument({
    pathId: id,
    title: doc.title,
    meta: doc.meta,
    content: doc.content,
  })
}

const stats = ss.getStats()
console.log(\`indexed \${stats.documentCount} documents, \${stats.embeddingCount} embeddings\`)
if (stats.documentCount !== 5) throw new Error('expected 5 documents in the index')
if (stats.embeddingCount !== 0) throw new Error('keyword indexing should not have created embeddings')
\`\`\`

Queries are ranked by BM25 and come back with highlighted snippets. Metadata from the frontmatter travels along, and \`where\` filters on it:

\`\`\`ts
const ranked = await ss.search('cache invalidation')
console.log(ranked.map(r => \`\${r.score.toFixed(2)} \${r.pathId} — \${r.snippet}\`))
if (ranked[0]?.pathId !== 'caching') throw new Error(\`expected caching to rank first, got \${ranked[0]?.pathId}\`)

// 'pipeline' appears in both deployments and testing — filter by frontmatter
const filtered = await ss.search('pipeline', { where: { area: 'quality' } })
if (filtered.length !== 1 || filtered[0].pathId !== 'testing') {
  throw new Error('where filter should narrow pipeline hits to the quality doc')
}
console.log('metadata filter verified:', filtered[0].pathId)
\`\`\`

## What happens without an embedding index

contentDb has search built in too — \`cdb.search()\`, \`cdb.vectorSearch()\`, \`cdb.hybridSearch()\`, plus a \`semanticSearch\` tool method it exposes to assistants (contentDb is itself a tool provider — see the [tool provider example](./feature-as-tool-provider.md)). These expect an embedding index under \`~/.luca/contentbase/\` for the collection. When there is none, the tool method degrades gracefully to grep and says so:

\`\`\`ts
if (cdb.searchIndexStatus.exists) throw new Error('fresh corpus should have no embedding index yet')

const fallback = await cdb.semanticSearch({ query: 'rollback' })
console.log(fallback.note)
if (!fallback.note || !fallback.note.includes('fell back to text search')) {
  throw new Error('expected the graceful grep fallback with an explanatory note')
}
if (!fallback.results.some(h => h.file.endsWith('deployments.md'))) throw new Error('fallback grep should still find the answer')
\`\`\`

## Tier 3: real embeddings — the honest requirements

Vector and hybrid search find documents by meaning ("how do I undo a bad release" should hit the deployments doc without sharing a keyword). That requires generating embeddings, and there is no credential-free, download-free path:

**Option A — OpenAI (default provider).** Requires \`OPENAI_API_KEY\` in the environment. \`cdb.buildSearchIndex()\` chunks every document by section, embeds the chunks with \`text-embedding-3-small\`, and stores vectors in the collection's index:

\`\`\`ts skip
// requires OPENAI_API_KEY
await cdb.buildSearchIndex({ onProgress: (done, total) => console.log(\`\${done}/\${total}\`) })

// hybrid = BM25 + vector similarity, fused with Reciprocal Rank Fusion
const hits = await cdb.hybridSearch('how do I undo a bad release', { limit: 3 })
console.log(hits.map(h => \`\${h.score.toFixed(3)} \${h.pathId}\`))
// 'deployments' ranks despite zero keyword overlap with "undo a bad release"
\`\`\`

**Option B — local embeddings.** Fully offline *after* a one-time setup that is not free: \`installLocalEmbeddings()\` runs a package-manager install of \`node-llama-cpp\` (a native addon) into your project and downloads the embedding-gemma-300M weights (~300 MB) to \`~/.cache/luca/models/\`. Until that completes, \`embeddingProvider: 'local'\` throws with instructions — it does not silently work:

\`\`\`ts skip
const localSearch = container.feature('semanticSearch', {
  dbPath: '.contentbase/search.sqlite',
  embeddingProvider: 'local',   // embedding-gemma-300M-Q8_0, the only supported local model
})
await localSearch.installLocalEmbeddings(process.cwd()) // installs node-llama-cpp + downloads ~300MB of weights
await localSearch.initDb()
// from here on, indexing and vectorSearch/hybridSearch run with no network at all
\`\`\`

One more constraint worth knowing: the index file is stamped with its provider/model/dimensions (\`search.openai-text-embedding-3-small.sqlite\` vs \`search.local-embedding-gemma-300M-Q8_0.sqlite\`). Switching providers means re-indexing — \`initDb()\` refuses a mismatched database rather than mixing vector spaces.

## Clean up

\`\`\`ts
await ss.close()
await fs.rmdir(corpusRoot)
console.log('index closed, corpus removed')
\`\`\`

## Summary

\`contentDb\` turns a folder of markdown into queryable documents; \`semanticSearch\` turns those documents into a search index. Grep and BM25 keyword search work immediately and offline — compose them by piping \`cdb.document(id)\` into \`ss.insertDocument()\`. Semantic (vector/hybrid) search is a deliberate upgrade with real prerequisites: an OpenAI key, or a one-time \`installLocalEmbeddings()\` that installs a native addon and downloads model weights. When no embedding index exists, contentDb's assistant-facing \`semanticSearch\` tool falls back to grep and tells you so.
`,
  "custom-feature-authoring.md": `---
title: Authoring a Custom Feature
tags:
  - features
  - composition
  - authoring
  - state
  - events
  - discovery
  - conventions
lastTested: '2026-07-05'
lastTestPassed: true
---

# Authoring a Custom Feature

This is the full lifecycle of building your own container feature: write a feature file that **composes existing helpers** (here: \`fs\` + \`grep\`), register it through discovery, then drive it — call methods, observe state, listen to events. Everything a "real" feature in a \`features/\` folder does, executed live.

For the API surface of any helper we lean on here, run \`luca describe fs\`, \`luca describe grep\`, or \`luca describe helpers\`.

## The anatomy

A feature is a class with three Zod schemas and some methods:

- **options** — construction-time configuration (\`container.feature('x', options)\`)
- **state** — observable runtime state; every write notifies observers
- **events** — a typed event bus other code can subscribe to

Framework conventions that matter (the introspection system and \`luca describe\` are built on them):

- Every schema field gets a \`.describe('...')\` — this text becomes the generated docs.
- The class and its public methods get JSDoc with \`@example\` blocks — same reason.
- Setup logic goes in \`afterInitialize()\`, not the constructor.
- Composition happens through \`this.container\` — a feature never imports another feature's module; it asks the container for it.

## Write the feature file

We build \`todoScanner\`: point it at a directory, it greps for annotation markers, keeps observable counts in state, and emits a \`scanned\` event. Note the composition: \`fs\` checks the directory, \`grep\` does the searching.

In a real project this file would live at \`features/todo-scanner.ts\`. Here we write it to a scratch folder inside the project so the example is self-contained — inside the project, because the file's \`import ... from 'luca'\` must resolve against your project's dependencies, exactly as it would for a real \`features/\` folder.

\`\`\`ts
// bare assignments (no const) so these survive into the later blocks
pluginRoot = container.paths.resolve('tmp', \`feature-authoring-demo-\${Date.now()}\`)
featureDir = container.paths.resolve(pluginRoot, 'features')

const featureSource = \`
import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'

export const TodoScannerStateSchema = FeatureStateSchema.extend({
  scanning: z.boolean().default(false).describe('Whether a scan is currently running'),
  lastScanCount: z.number().default(0).describe('Number of annotations found by the most recent scan'),
  lastScannedAt: z.string().optional().describe('ISO timestamp of the most recent scan'),
})
export type TodoScannerState = z.infer<typeof TodoScannerStateSchema>

export const TodoScannerOptionsSchema = FeatureOptionsSchema.extend({
  directory: z.string().optional().describe('Directory to scan (defaults to the container cwd)'),
  markers: z.array(z.string()).default(['TODO', 'FIXME']).describe('Annotation markers to search for'),
})
export type TodoScannerOptions = z.infer<typeof TodoScannerOptionsSchema>

export const TodoScannerEventsSchema = FeatureEventsSchema.extend({
  scanned: z.tuple([
    z.number().describe('Number of annotations found'),
  ]).describe('Emitted after each completed scan'),
})

/**
 * Scans a directory for code annotations (TODO, FIXME, ...) by composing
 * the fs and grep features. Keeps observable counts in state and emits a
 * \\\`scanned\\\` event after every run.
 */
export class TodoScanner extends Feature<TodoScannerState, TodoScannerOptions> {
  static override shortcut = 'features.todoScanner' as const
  static override stability = 'experimental' as const
  static override stateSchema = TodoScannerStateSchema
  static override optionsSchema = TodoScannerOptionsSchema
  static override eventsSchema = TodoScannerEventsSchema
  static { Feature.register(this, 'todoScanner') }

  /**
   * Run a scan and return the matches.
   */
  async scan() {
    const { container } = this
    const dir = this.options.directory || container.cwd

    // Compose: fs guards, grep searches
    const fs = container.feature('fs')
    if (!fs.exists(dir)) throw new Error('todoScanner: directory does not exist: ' + dir)

    this.setState({ scanning: true })

    const grep = container.feature('grep')
    const pattern = (this.options.markers || ['TODO', 'FIXME']).join('|')
    const matches = await grep.search({ pattern, path: dir, include: '*.ts' })

    this.setState({
      scanning: false,
      lastScanCount: matches.length,
      lastScannedAt: new Date().toISOString(),
    })
    this.emit('scanned', matches.length)

    return matches
  }
}

export default TodoScanner
\`

fs.ensureFolder(featureDir)
fs.writeFile(container.paths.resolve(featureDir, 'todo-scanner.ts'), featureSource)
console.log('feature file written to', featureDir)
\`\`\`

(\`fs\`, \`os\`, \`grep\`, and \`helpers\` are already in scope in these runnable docs — the container injects its context. In your own scripts, \`container.feature('fs')\` gets you the same instances.)

## Seed something to find

Give the scanner a codebase with annotations in it.

\`\`\`ts
srcDir = container.paths.resolve(pluginRoot, 'src')
fs.ensureFolder(srcDir)
fs.writeFile(container.paths.resolve(srcDir, 'auth.ts'), [
  'export function login() {',
  '  // TODO: rate-limit repeated failures',
  '  return true',
  '}',
  '// FIXME: logout does not clear the session cache',
  'export function logout() {}',
].join('\\n'))
fs.writeFile(container.paths.resolve(srcDir, 'billing.ts'), [
  '// TODO: support proration',
  'export const invoice = () => 42',
].join('\\n'))
\`\`\`

## Register through discovery

\`helpers.discover(type, { directory })\` is how project \`features/\` folders load — and it works on any folder, which is what makes it a plugin mechanism (see the [meta-discovery example](./meta-discovery.md)). The file's \`static { Feature.register(this, 'todoScanner') }\` block runs when the module loads; after that the registry knows it.

\`\`\`ts
const discovered = await helpers.discover('features', { directory: featureDir })
console.log('discovered:', discovered)

if (!container.features.available.includes('todoScanner')) {
  throw new Error('todoScanner did not register — discovery failed')
}
console.log('todoScanner is registered alongside', container.features.available.length - 1, 'other features')
\`\`\`

Enumerate registries with \`.available\` — they're class instances, so \`Object.keys(container.features)\` will not list helper ids.

## Drive it: options, state, events

Instantiate with options, subscribe to state and events, then call the method. Factories are memoized per id + options, so any later \`container.feature('todoScanner')\` call in this process gets the same instance and the same state.

\`\`\`ts
const scanner = container.feature('todoScanner', { directory: srcDir })

// observable state — observers receive (changeType, key, value) per mutation
const observedCounts = []
scanner.state.observe((changeType, key, value) => {
  if (key === 'lastScanCount') observedCounts.push(value)
})

// typed event bus
let announced = null
scanner.on('scanned', (count) => { announced = count })

const matches = await scanner.scan()

console.log('found', matches.length, 'annotations')
for (const m of matches) console.log(\` \${m.file}:\${m.line} \${m.content.trim()}\`)

// assert the composed behavior actually happened
if (matches.length !== 3) throw new Error(\`expected 3 annotations, got \${matches.length}\`)
if (announced !== 3) throw new Error('scanned event did not fire with the count')
if (scanner.state.get('lastScanCount') !== 3) throw new Error('state.lastScanCount not updated')
if (!observedCounts.includes(3)) throw new Error('state observer never saw the new count')
if (scanner.state.get('scanning') !== false) throw new Error('scanning state did not settle back to false')
console.log('state, events, and composition all verified')
\`\`\`

## Clean up

\`\`\`ts
await fs.rmdir(pluginRoot)
console.log('cleaned up', pluginRoot)
\`\`\`

## The checklist

When you author a feature for a real project (start with \`luca scaffold feature myThing\`):

1. **File** in \`features/<kebab-name>.ts\`, class registered via \`static { Feature.register(this, '<camelName>') }\`, default export the class.
2. **Schemas** extend \`FeatureStateSchema\` / \`FeatureOptionsSchema\` / \`FeatureEventsSchema\`, with \`.describe()\` on every field.
3. **JSDoc + @example** on the class and every public method — \`luca describe <name>\` is generated from them.
4. **Compose through \`this.container\`** — \`this.container.feature('fs')\`, never a direct import of another helper.
5. **Type augmentation** (in-project): add \`declare module 'luca' { interface AvailableFeatures { myThing: typeof MyThing } }\` so \`container.feature('myThing')\` returns your type.
6. Verify with \`luca about\` (discovery) and \`luca describe myThing\` (docs).
`
}

export const bootstrapTutorials: Record<string, string> = {
  "17-tui-blocks.md": `---
title: Building TUI Primitive Blocks
tags: [ink, react, terminal, ui, components, tui, blocks, tutorial]
---

# Building TUI Primitive Blocks

This tutorial teaches you how to build a library of reusable terminal UI primitives using Ink blocks. Each block is a React component you can render inline in any runnable markdown document. We'll build them from simple to complex, covering layout, color, state, and composition patterns along the way.

Run this tutorial to see every block in action:

\`\`\`
luca run docs/tutorials/17-tui-blocks
\`\`\`

## Blocks

\`\`\`tsx
const { Box, Text, Newline, Spacer } = ink.components
const React = ink.React

// ─── Divider ──────────────────────────────────────────
// A horizontal rule with an optional centered label.
function Divider({ label, color, width }) {
  const w = width || 60
  const ch = '─'

  if (!label) {
    return <Text color={color || 'gray'}>{ch.repeat(w)}</Text>
  }

  const pad = \` \${label} \`
  const side = Math.max(0, Math.floor((w - pad.length) / 2))
  const right = Math.max(0, w - side - pad.length)

  return (
    <Text>
      <Text color={color || 'gray'}>{ch.repeat(side)}</Text>
      <Text color={color || 'white'} bold>{pad}</Text>
      <Text color={color || 'gray'}>{ch.repeat(right)}</Text>
    </Text>
  )
}

// ─── Badge ────────────────────────────────────────────
// A compact colored label, like a GitHub status badge.
const BADGE_STYLES = {
  success: { bg: 'green', fg: 'white', icon: '✓' },
  error:   { bg: 'red', fg: 'white', icon: '✗' },
  warning: { bg: 'yellow', fg: 'black', icon: '!' },
  info:    { bg: 'blue', fg: 'white', icon: 'i' },
  neutral: { bg: 'gray', fg: 'white', icon: '·' },
}

function Badge({ type, label }) {
  const style = BADGE_STYLES[type] || BADGE_STYLES.neutral
  return (
    <Text backgroundColor={style.bg} color={style.fg} bold>
      {\` \${style.icon} \${label} \`}
    </Text>
  )
}

// ─── Alert ────────────────────────────────────────────
// A bordered message box for notices, warnings, errors.
const ALERT_STYLES = {
  info:    { border: 'blue', icon: 'ℹ', title: 'Info' },
  success: { border: 'green', icon: '✓', title: 'Success' },
  warning: { border: 'yellow', icon: '⚠', title: 'Warning' },
  error:   { border: 'red', icon: '✗', title: 'Error' },
}

function Alert({ type, message, title }) {
  const style = ALERT_STYLES[type] || ALERT_STYLES.info
  const heading = title || style.title

  return (
    <Box borderStyle="round" borderColor={style.border} paddingX={1} flexDirection="column" width={60}>
      <Text color={style.border} bold>{style.icon}  {heading}</Text>
      <Text>{message}</Text>
    </Box>
  )
}

// ─── KeyValue ─────────────────────────────────────────
// Display a record as aligned key: value pairs.
function KeyValue({ data, keyColor, separator }) {
  const entries = Object.entries(data)
  const maxKey = Math.max(...entries.map(([k]) => k.length))
  const sep = separator || ':'

  return (
    <Box flexDirection="column">
      {entries.map(([key, val], i) => (
        <Box key={i}>
          <Text color={keyColor || 'cyan'} bold>{key.padEnd(maxKey)}</Text>
          <Text dimColor> {sep} </Text>
          <Text>{String(val)}</Text>
        </Box>
      ))}
    </Box>
  )
}

// ─── DataTable ────────────────────────────────────────
// A data table with headers, column widths, and borders.
function DataTable({ headers, rows, borderColor }) {
  const bc = borderColor || 'gray'
  const colWidths = headers.map((h, ci) => {
    const vals = [h.label || h, ...rows.map(r => String(r[ci] ?? ''))]
    return Math.max(...vals.map(v => v.length)) + 2
  })

  const totalWidth = colWidths.reduce((a, b) => a + b, 0) + headers.length + 1
  const hLine = '─'.repeat(totalWidth - 2)

  function Row({ cells, bold: isBold, color }) {
    return (
      <Box>
        <Text color={bc}>│</Text>
        {cells.map((cell, ci) => (
          <Box key={ci}>
            <Text color={color} bold={isBold}>{\` \${String(cell).padEnd(colWidths[ci] - 2)} \`}</Text>
            <Text color={bc}>│</Text>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color={bc}>┌{hLine}┐</Text>
      <Row cells={headers.map(h => h.label || h)} bold={true} color="cyan" />
      <Text color={bc}>├{hLine}┤</Text>
      {rows.map((row, ri) => (
        <Row key={ri} cells={row} color={ri % 2 === 0 ? 'white' : 'gray'} />
      ))}
      <Text color={bc}>└{hLine}┘</Text>
    </Box>
  )
}

// ─── ProgressBar ──────────────────────────────────────
// A visual bar with percentage and optional label.
function ProgressBar({ value, total, label, width, color }) {
  const pct = Math.min(1, Math.max(0, value / (total || 100)))
  const barWidth = (width || 30)
  const filled = Math.round(pct * barWidth)
  const empty = barWidth - filled
  const c = color || 'green'

  return (
    <Box>
      {label && <Text color="white" bold>{label.padEnd(12)} </Text>}
      <Text color={c}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text dimColor> {Math.round(pct * 100)}%</Text>
    </Box>
  )
}

// ─── Tree ─────────────────────────────────────────────
// Render a nested object/array as a tree view.
function TreeNode({ name, children: kids, isLast, prefix }) {
  const connector = isLast ? '└── ' : '├── '
  const childPrefix = prefix + (isLast ? '    ' : '│   ')

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="gray">{prefix}{connector}</Text>
        {kids ? (
          <Text color="yellow" bold>{name}/</Text>
        ) : (
          <Text color="green">{name}</Text>
        )}
      </Text>
      {kids && kids.map((child, i) => (
        <TreeNode
          key={i}
          name={child.name}
          children={child.children}
          isLast={i === kids.length - 1}
          prefix={childPrefix}
        />
      ))}
    </Box>
  )
}

function Tree({ label, items }) {
  return (
    <Box flexDirection="column">
      <Text color="yellow" bold>{label || '.'}</Text>
      {items.map((item, i) => (
        <TreeNode
          key={i}
          name={item.name}
          children={item.children}
          isLast={i === items.length - 1}
          prefix=""
        />
      ))}
    </Box>
  )
}

// ─── Panel ────────────────────────────────────────────
// A titled bordered box that wraps any child content.
function Panel({ title, children, borderColor, width }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor || 'blue'}
      paddingX={1}
      width={width || 60}
    >
      {title && (
        <Box marginBottom={1}>
          <Text color={borderColor || 'blue'} bold>{title}</Text>
        </Box>
      )}
      {children}
    </Box>
  )
}

// ─── Spinner ──────────────────────────────────────────
// An animated spinner that runs until done() is called.
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function Spinner({ message, done }) {
  const [frame, setFrame] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
    // Signal done after a short display so the tutorial keeps moving
    const exit = setTimeout(() => done(), 1500)
    return () => { clearInterval(timer); clearTimeout(exit) }
  }, [])

  return (
    <Box>
      <Text color="cyan">{SPINNER_FRAMES[frame]} </Text>
      <Text>{message || 'Loading...'}</Text>
    </Box>
  )
}
\`\`\`

## 1. Dividers — Simple Separation

The simplest useful primitive: a horizontal line. The \`Divider\` block accepts an optional label that gets centered in the rule, and a color.

A plain divider:

\`\`\`ts
await render('Divider', {})
\`\`\`

With a label:

\`\`\`ts
await render('Divider', { label: 'Section One', color: 'cyan' })
\`\`\`

Wide with a custom color:

\`\`\`ts
await render('Divider', { label: 'Results', color: 'yellow', width: 50 })
\`\`\`

**Pattern:** Use \`Text\` for inline styled strings. The \`color\` prop accepts any named color or hex value. Use \`bold\`, \`dimColor\`, \`italic\`, \`underline\`, \`inverse\`, and \`strikethrough\` for styling.

## 2. Badges — Compact Status Labels

Badges are small colored labels for tagging status or categories. They use \`backgroundColor\` to create the filled look.

\`\`\`ts
await render('Badge', { type: 'success', label: 'PASSING' })
\`\`\`

\`\`\`ts
await render('Badge', { type: 'error', label: 'FAILED' })
\`\`\`

\`\`\`ts
await render('Badge', { type: 'warning', label: 'UNSTABLE' })
\`\`\`

\`\`\`ts
await render('Badge', { type: 'info', label: 'v2.1.0' })
\`\`\`

**Pattern:** Define a styles map keyed by type name. This keeps your component clean and makes it easy to add new variants. \`backgroundColor\` on \`Text\` creates solid filled backgrounds.

## 3. Alerts — Bordered Message Boxes

Alerts combine borders, colors, and icons for eye-catching notices. They use \`Box\` with \`borderStyle\` and \`borderColor\`.

\`\`\`ts
await render('Alert', { type: 'info', message: 'The ink feature provides Box, Text, Spacer, Newline, Static, and Transform components.' })
\`\`\`

\`\`\`ts
await render('Alert', { type: 'success', message: 'All 47 tests passed in 1.2s.' })
\`\`\`

\`\`\`ts
await render('Alert', { type: 'warning', message: 'Disk usage at 89%. Consider cleanup.' })
\`\`\`

\`\`\`ts
await render('Alert', { type: 'error', message: 'Connection refused: ECONNREFUSED 127.0.0.1:5432', title: 'Database Error' })
\`\`\`

**Pattern:** \`Box\` supports border styles: \`single\`, \`double\`, \`round\`, \`bold\`, \`singleDouble\`, \`doubleSingle\`, \`classic\`. Combine \`borderColor\` with \`paddingX\`/\`paddingY\` for clean framing.

## 4. Key-Value — Structured Data Display

\`KeyValue\` renders an object as aligned label-value pairs. Great for config views, server status, and metadata displays.

\`\`\`ts
await render('KeyValue', {
  data: {
    Host: '0.0.0.0',
    Port: 3000,
    Mode: 'development',
    PID: 48291,
    Uptime: '3h 14m',
    Workers: 4,
  },
})
\`\`\`

With a custom key color and separator:

\`\`\`ts
await render('KeyValue', {
  data: { Name: 'luca', Version: '0.8.0', Runtime: 'bun', License: 'MIT' },
  keyColor: 'yellow',
  separator: '→',
})
\`\`\`

**Pattern:** Use \`padEnd\` to align columns. The \`flexDirection="column"\` on \`Box\` stacks rows vertically. Map over \`Object.entries()\` to render dynamic data.

## 5. Data Tables — Rows and Columns

\`DataTable\` is the workhorse for displaying tabular data with headers, computed column widths, and box-drawing borders.

\`\`\`ts
await render('DataTable', {
  headers: ['Feature', 'Status', 'Type'],
  rows: [
    ['fs',       'enabled',  'core'],
    ['git',      'enabled',  'core'],
    ['ink',      'enabled',  'ui'],
    ['esbuild',  'lazy',     'build'],
    ['tts',      'disabled', 'media'],
  ],
})
\`\`\`

Wider dataset:

\`\`\`ts
await render('DataTable', {
  headers: ['Method', 'Path', 'Handler', 'Auth'],
  rows: [
    ['GET',    '/api/health',  'health.ts',  'none'],
    ['GET',    '/api/users',   'users.ts',   'jwt'],
    ['POST',   '/api/users',   'users.ts',   'jwt'],
    ['DELETE', '/api/users/:id', 'users.ts', 'admin'],
  ],
  borderColor: 'cyan',
})
\`\`\`

**Pattern:** Auto-compute column widths from header + data. Use box-drawing characters (\`┌─┐│├┤└─┘\`) for clean borders. Alternating row colors (\`ri % 2\`) improve readability.

## 6. Progress Bars — Visual Metrics

\`ProgressBar\` fills a bar proportionally. Useful for build status, disk usage, test coverage — anywhere you want a quick visual read.

\`\`\`ts
await render('ProgressBar', { label: 'Tests', value: 47, total: 50, color: 'green' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Coverage', value: 72, total: 100, color: 'yellow' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Disk', value: 89, total: 100, color: 'red' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Upload', value: 30, total: 100, color: 'cyan', width: 40 })
\`\`\`

**Pattern:** Use \`█\` and \`░\` (or any unicode pair) for filled/empty. Calculate fill width as \`Math.round(pct * barWidth)\`. Clamp the percentage to avoid overflow.

## 7. Trees — Hierarchical Data

\`Tree\` renders nested structures with box-drawing connectors. Pass an array of \`{ name, children? }\` nodes.

\`\`\`ts
await render('Tree', {
  label: 'my-app',
  items: [
    { name: 'src', children: [
      { name: 'commands', children: [
        { name: 'serve.ts' },
        { name: 'run.ts' },
      ]},
      { name: 'features', children: [
        { name: 'auth.ts' },
        { name: 'cache.ts' },
      ]},
      { name: 'index.ts' },
    ]},
    { name: 'endpoints', children: [
      { name: 'health.ts' },
      { name: 'users.ts' },
    ]},
    { name: 'package.json' },
    { name: 'tsconfig.json' },
  ],
})
\`\`\`

**Pattern:** Recursive components are natural in React. Pass a \`prefix\` string down that builds the indentation. Use \`├──\` for intermediate nodes and \`└──\` for the last child. Color directories differently from files.

## 8. Spinner — Async Animation

The \`Spinner\` block uses \`setInterval\` to cycle through braille frames. Since it stays mounted until \`done()\` is called, use \`renderAsync\`.

\`\`\`ts
await renderAsync('Spinner', { message: 'Compiling project...' })
\`\`\`

\`\`\`ts
await renderAsync('Spinner', { message: 'Fetching remote data...' })
\`\`\`

**Pattern:** \`renderAsync\` keeps the component mounted until the \`done\` callback fires (or the timeout expires). Use \`React.useEffect\` to set up timers and return cleanup functions. The \`done\` prop is injected automatically by the rendering system.

## 9. Composition — Combining Blocks

The real power comes from composing primitives together. Here's a dashboard using multiple blocks rendered in sequence:

\`\`\`ts
await render('Divider', { label: 'System Dashboard', color: 'cyan' })
\`\`\`

\`\`\`ts
await render('KeyValue', {
  data: { Host: 'localhost', Port: 3000, Env: 'development', Runtime: 'bun' },
  keyColor: 'cyan',
})
\`\`\`

\`\`\`ts
await render('Divider', { label: 'Services', color: 'cyan' })
\`\`\`

\`\`\`ts
await render('DataTable', {
  headers: ['Service', 'Status', 'Latency'],
  rows: [
    ['Express', 'running', '2ms'],
    ['WebSocket', 'running', '1ms'],
    ['Redis', 'stopped', '—'],
  ],
  borderColor: 'cyan',
})
\`\`\`

\`\`\`ts
await render('Divider', { label: 'Resources', color: 'cyan' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Memory', value: 64, total: 100, color: 'green' })
await render('ProgressBar', { label: 'CPU', value: 23, total: 100, color: 'green' })
await render('ProgressBar', { label: 'Disk', value: 87, total: 100, color: 'yellow' })
\`\`\`

\`\`\`ts
await render('Divider', {})
\`\`\`

\`\`\`ts
await render('Alert', { type: 'warning', message: 'Redis is not responding. Cache reads will fall through to database.' })
\`\`\`

## Summary

These eight primitives cover most TUI needs:

\`\`\`ts
await render('DataTable', {
  headers: ['Block', 'Use Case'],
  rows: [
    ['Divider',     'Visual separation between sections'],
    ['Badge',       'Compact status or version labels'],
    ['Alert',       'Notices, warnings, errors with borders'],
    ['KeyValue',    'Config, metadata, record display'],
    ['DataTable',   'Tabular data with headers'],
    ['ProgressBar', 'Percentages, quotas, progress'],
    ['Tree',        'File trees, dependency graphs, nested data'],
    ['Spinner',     'Async loading states with animation'],
  ],
  borderColor: 'green',
})
\`\`\`

### Key Patterns

- **Style maps** — Keep variant styles in an object keyed by type name
- **Auto-sizing** — Compute widths from data with \`padEnd\` and \`Math.max\`
- **Box-drawing** — Use unicode box chars for clean borders and connectors
- **Recursion** — React components can call themselves for tree structures
- **Async lifecycle** — Use \`renderAsync\` + \`done()\` for animated or time-based blocks
- **Composition** — Render blocks in sequence to build dashboards from primitives
`,
  "10-creating-features.md": `---
title: Creating Custom Features
tags: [features, custom, extend, zod, state, events, module-augmentation, helper]
---

# Creating Custom Features

You can create your own features to encapsulate domain logic, then register them so they're available through \`container.feature('yourFeature')\` with full type safety.

## Anatomy of a Feature

A feature has:
- **State** -- observable, defined by a Zod schema
- **Options** -- configuration passed at creation, defined by a Zod schema
- **Events** -- typed event bus
- **Methods** -- your domain logic
- **Access to the container** -- via \`this.container\`

## Basic Example

\`\`\`typescript
import { z } from 'zod'
import { Feature, features, FeatureStateSchema, FeatureOptionsSchema } from 'luca'

// Define state schema by extending the base FeatureStateSchema
export const CounterStateSchema = FeatureStateSchema.extend({
  count: z.number().describe('Current count value'),
  lastUpdated: z.string().optional().describe('ISO timestamp of last update'),
})
export type CounterState = z.infer<typeof CounterStateSchema>

// Define options schema by extending the base FeatureOptionsSchema
export const CounterOptionsSchema = FeatureOptionsSchema.extend({
  initialCount: z.number().default(0).describe('Starting count value'),
  step: z.number().default(1).describe('Increment step size'),
})
export type CounterOptions = z.infer<typeof CounterOptionsSchema>

/**
 * A simple counter feature that demonstrates the feature pattern.
 * Tracks a count value with observable state and events.
 */
export class Counter extends Feature<CounterState, CounterOptions> {
  static override stateSchema = CounterStateSchema
  static override optionsSchema = CounterOptionsSchema

  /** Called when the feature is created */
  async initialize() {
    this.state.set('count', this.options.initialCount ?? 0)
  }

  /** Increment the counter by the configured step */
  increment() {
    const current = this.state.get('count') || 0
    const next = current + (this.options.step ?? 1)
    this.state.set('count', next)
    this.state.set('lastUpdated', new Date().toISOString())
    this.emit('incremented', next)
    return next
  }

  /** Decrement the counter by the configured step */
  decrement() {
    const current = this.state.get('count') || 0
    const next = current - (this.options.step ?? 1)
    this.state.set('count', next)
    this.state.set('lastUpdated', new Date().toISOString())
    this.emit('decremented', next)
    return next
  }

  /** Reset the counter to its initial value */
  reset() {
    this.state.set('count', this.options.initialCount ?? 0)
    this.emit('reset')
  }

  /** Get the current count */
  get value(): number {
    return this.state.get('count') || 0
  }
}

// Register the feature
features.register('counter', Counter)

// Module augmentation for type safety
declare module 'luca' {
  interface AvailableFeatures {
    counter: typeof Counter
  }
}
\`\`\`

## Using Your Feature

\`\`\`typescript
import './features/counter' // Side-effect import to register

const counter = container.feature('counter', { initialCount: 10, step: 5 })

counter.on('incremented', (value) => {
  console.log(\`Count is now \${value}\`)
})

counter.increment()  // 15
counter.increment()  // 20
counter.value        // 20
counter.reset()      // Back to 10

// Observe state changes
counter.state.observe((type, key, value) => {
  console.log(\`\${key} \${type}d:\`, value)
})
\`\`\`

## Enabling on the Container

If your feature should be a container-level singleton with a shortcut:

\`\`\`typescript
export class Counter extends Feature<CounterState, CounterOptions> {
  // This creates the container.counter shortcut when enabled
  static override shortcut = 'features.counter' as const
  // ...
}

// Enable it
container.feature('counter', { enable: true })

// Now accessible as:
container.counter.increment()
\`\`\`

## Feature with Container Access

Features can access other features and the full container:

\`\`\`typescript
export class Analytics extends Feature<AnalyticsState, AnalyticsOptions> {
  /** Log an event, writing to disk cache for persistence */
  async logEvent(name: string, data: Record<string, any>) {
    const cache = this.container.feature('diskCache', { path: './.analytics' })
    const timestamp = new Date().toISOString()

    await cache.set(\`event:\${timestamp}\`, { name, data, timestamp })

    this.state.set('totalEvents', (this.state.get('totalEvents') || 0) + 1)
    this.emit('eventLogged', { name, data })
  }

  /** Get recent events from the cache */
  async recentEvents(limit = 10) {
    const fs = this.container.fs
    // ... read from cache directory
  }
}
\`\`\`

## Documenting Your Feature

Document your classes, methods, and getters with JSDoc. This is important because Luca's introspection system extracts these docs and makes them available at runtime:

\`\`\`typescript
/**
 * Manages user sessions with automatic expiration and renewal.
 * Sessions are persisted to disk and can survive process restarts.
 */
export class SessionManager extends Feature<SessionState, SessionOptions> {
  /**
   * Create a new session for the given user.
   * Returns a session token that can be used for authentication.
   */
  async createSession(userId: string): Promise<string> {
    // ...
  }

  /** The number of currently active sessions */
  get activeCount(): number {
    return this.state.get('sessions')?.length || 0
  }
}
\`\`\`

Then anyone (human or AI) can discover your feature:

\`\`\`typescript
container.features.describe('sessionManager')
// Returns the full markdown documentation extracted from your JSDoc

// Quick discovery — list available methods and getters
const session = container.feature('sessionManager')
session.$methods  // => ['createSession', ...]
session.$getters  // => ['activeCount', ...]
\`\`\`

## Best Practices

1. **Use Zod \`.describe()\` on schema fields** -- these descriptions appear in introspection and help documentation
2. **Emit events for significant actions** -- enables reactive patterns and decoupled observers
3. **Use state for observable values** -- don't hide important state in private variables if consumers need to watch it
4. **Access the container, not imports** -- prefer \`this.container.feature('fs')\` over importing fs directly, so the feature works in any container
5. **Document everything** -- JSDoc on the class, methods, and getters feeds the introspection system
`,
  "24-state-in-markdown.md": `---
title: "Modeling State in Markdown: Frontmatter vs. Body"
tags:
  - contentbase
  - contentdb
  - markdown
  - models
  - state
  - design
  - frontmatter
  - sections
---
# Modeling State in Markdown: Frontmatter vs. Body

[Tutorial 11](./11-contentbase.md) shows the mechanics of contentbase — \`defineModel\`, \`meta\`, \`sections\`, querying. This tutorial is about the *judgment call* that decides whether your markdown stays worth writing: **which state goes in the frontmatter, and which goes in the body.**

There's a trap. Once you learn that frontmatter is validated and queryable, it's tempting to treat it as *the database* and the prose as leftover comments — so an \`overview\` becomes a 12-line YAML string, \`success_criteria\` becomes a nested YAML array, and soon opening the file greets you with forty lines of \`key: value\` before the first sentence. At that point you've built a worse database *and* thrown away the one thing markdown was for: a document a human wants to read and edit.

The point of contentbase is the opposite. **The prose is the state. Frontmatter is just the index card taped to the front.**

## The two-drawer rule

Every piece of state you store goes in one of two drawers. Sorting them correctly is the whole skill.

**Frontmatter — the index card.** Only what the *system* filters, sorts, or joins on:
- Lifecycle status (\`status: approved\`)
- Tags and categorical labels
- Foreign-key slugs (\`goal: user-experience\`)
- Timestamps and machine-written scalars (\`lastRanAt\`, \`costUsd\`, \`completedAt\`)
- Small boolean flags (\`running: true\`)

These are **scalars and short arrays** — labels, not content.

**Body — the substance.** Anything a human writes in sentences, lists, or code: the overview, the reasoning, the criteria, the findings, the plan. This is the actual work product.

The litmus test: **would you write this in a sentence? → body. Is it a label the system filters on? → frontmatter.** If you're reaching for \`|\` (YAML multi-line) or nesting objects three deep, you're putting body content in the frontmatter drawer.

## Sections are fields, not comments

The reason you *can* keep substance in the body without losing queryability: a \`section()\` makes a heading's prose a **typed, validated, cached field.**

\`\`\`ts
// docs/models.ts
import { defineModel, section, z } from 'contentbase'
import { toString } from 'mdast-util-to-string'

export const Goal = defineModel('Goal', {
  prefix: 'goals',
  meta: z.object({
    horizon: z.enum(['short', 'medium', 'long']).default('medium')
      .describe('short <3mo, medium 3–6mo, long >6mo'),
  }),
  sections: {
    successCriteria: section('Success Criteria', {
      extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\\n'),
      schema: z.string().min(1).describe('What success looks like'),
    }),
    motivation: section('Motivation', {
      extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\\n'),
      schema: z.string().min(1).describe('Why this goal matters'),
    }),
  },
})
\`\`\`

That \`Goal\` has exactly **one** frontmatter field (\`horizon\` — a label you'd filter on). "Success Criteria" and "Motivation" are the content, and they're still first-class: \`goal.sections.motivation\` returns the validated prose, \`goal.validate()\` fails if the section is empty (\`z.string().min(1)\`), and you never had to cram a paragraph into YAML. The file reads like a goal document a person wrote — because it is one.

## The payoff frontmatter can't match: prose that's also structured

Here's what makes sections better than "just parse the frontmatter" — a section can be *read by a human as prose and by the machine as structured data at the same time.*

The agentic-loop's \`Project\` model has a section called **Execution** that authors write as an ordinary bulleted list of links to plans:

\`\`\`markdown
## Execution

- [Connect and poll](plans/drive-connect)
- [Detect change](plans/change-detection), [Dedupe events](plans/dedupe)
- [Operator inspection](plans/inspect)
\`\`\`

A \`computed\` property turns that readable list into a dependency graph — each list item is a step, commas within an item mean "run in parallel":

\`\`\`ts
computed: {
  executionOrder: (self) =>
    self.document.querySection('Execution')
      .selectAll('listItem')
      .map((item) => new AstQuery({ type: 'root', children: [item] })
        .selectAll('link').map((l) => l.url))
      .filter((group) => group.length > 0),
},
\`\`\`

The human edits a to-do list; the machine reads a parallel/sequential DAG. Encode that same information in frontmatter and you'd have an unreadable nested YAML array that no one wants to maintain — and you'd *still* have to write prose explaining it. The section gives you both, with one source of truth.

The same trick powers scheduled work: the agentic-loop's \`Play\` and \`Task\` models extract a run-condition from \`code[lang=ts]\` blocks under a **Conditions** heading — executable logic living in the body, not a frontmatter string.

## What it looks like in practice

A real, completed project document from the agentic-loop:

\`\`\`markdown
---
status: completed
goal: user-experience-improvements
---

# Shared File Service

## Overview

Build a new core service that watches shared file systems for changes and
turns those changes into structured events the Agentic Loop can react to.
...

## Success Criteria

- The loop can watch one or more configured Google Drive folders...
...

## Motivation

Important work often shows up in shared folders before it shows up in chat...
\`\`\`

Two lines of frontmatter — a lifecycle \`status\` and a \`goal\` foreign key. Everything of substance is prose under headings. This is a document a person wrote and can read. It is *also* a queryable record with a status the pipeline routes on and a relationship to a goal. Both, with no tax on either.

## Reading and writing state that lives in the body

Because state is split across two drawers, you read from each the way it's meant to be read.

**Query on the cheap, indexed drawer:**

\`\`\`ts
const db = container.feature('contentDb', { rootPath: './docs' })
await db.load()

// filter/sort/join happen on frontmatter — fast, no body parsing
const ready = await db.query(Project).where('meta.status', 'approved').fetchAll()
\`\`\`

**Pull only the section you need** (don't load a whole 500-line doc to read one heading) — the \`contentDb\` feature reads by heading:

\`\`\`ts
// just the Findings section, skip the rest
const findings = await db.getDocument('reports/q3-research', { include: ['Findings'] })
\`\`\`

**Write to the body, save the document.** Editing a section is first-class; persistence is per-*document* (the file is the atomic unit — there's no section-level save):

\`\`\`ts
const report = await db.query(Report).find('q3-research')

// replaceSectionContent is immutable by default → returns a new Document.
// (pass { mutate: true } to edit in place instead.)
const updated = report.document
  .replaceSectionContent('Findings', '- Source A confirms X\\n- Source B contradicts Y')

await updated.save()   // rewrites frontmatter + body together, atomically
\`\`\`

Related section writers: \`appendToSection(heading, md)\`, \`removeSection(heading)\`, \`insertAfter(node, md)\`. A tiny wrapper covers the common edit-and-persist case:

\`\`\`ts
async function updateSection(doc, heading, md) {
  const next = doc.replaceSectionContent(heading, md)
  await next.save()
  return next
}
\`\`\`

This is exactly how the agentic-loop's pipeline runs: **cheap \`status\` flips in frontmatter route the work** (\`spark → exploring → ready → promoted\`), while **agents accrete substance into the body sections** (research into "Findings", conclusions into "Synthesis"). The index card moves an item through the workflow; the prose is where the value accumulates.

## When frontmatter *is* the right drawer

Don't over-correct into "everything is prose." Some state genuinely belongs on the index card, and forcing it into the body is just as wrong:

- **Lifecycle / status enums** — the pipeline filters on these constantly; they must be a fast, indexed scalar.
- **Tags and foreign-key slugs** — labels and joins, not sentences.
- **Machine-written bookkeeping** — \`lastRanAt\`, \`costUsd\`, \`turns\`, \`completedAt\`, \`running\`. An agent stamps a timestamp, not a paragraph. These are the clearest frontmatter citizens: no human writes them, no human reads them as prose.
- **Small flags** that gate behavior (\`repeatable\`, \`running\`).

The rule isn't "no frontmatter." It's **labels up top, substance in the body.**

## Anti-patterns — the "defeats the purpose" list

You've put state in the wrong drawer when you see:

- **Multi-line prose as a YAML string** (\`overview: |\` followed by three paragraphs). That's a section wearing a frontmatter costume — and it's unreadable, awkward to diff, and fragile around special characters.
- **Nested YAML objects that are really sections** (\`scope: { in: [...], out: [...] }\`). Write "## Scope" with "### In / ### Out" and extract it.
- **Duplicating a heading's content into frontmatter "so it's easy to parse."** It's already parseable — that's what \`section()\` is for — and now you have two copies that drift.
- **The H1 below the fold.** If opening the file shows thirty lines of \`key: value\` before any prose, you built a worse database and discarded the readability you chose markdown for.

Every one of these trades away the thing that made markdown the right choice. Keep the frontmatter to the index card, let the document be a document, and you get the database for free.

## What's Next

- [Contentbase — Markdown as a Database](./11-contentbase.md) — the model/query/section API this builds on
- [Semantic search over a content collection](../examples/semantic-search-content-db.md) — searching the body, not just the labels
- \`luca describe contentDb\` — the feature's read/query/section tools
`,
  "13-introspection.md": `---
title: Introspection and Discovery
tags: [introspection, runtime, discovery, documentation, describe, inspect]
---

# Introspection and Discovery

One of Luca's defining features is that everything is discoverable at runtime. You don't need to read documentation to learn what's available -- you can ask the system itself.

## Why Introspection Matters

Introspection serves two audiences:

1. **Developers** -- discover APIs while coding, without leaving the REPL or editor
2. **AI Agents** -- learn the full API surface dynamically, enabling them to use features they weren't explicitly trained on

## Container-Level Introspection

\`\`\`typescript
// Structured data about the entire container
const info = container.introspect()
// Returns: registries, enabled features, state schema, available helpers

// Human-readable markdown
const docs = container.introspectAsText()
\`\`\`

## Registry-Level Discovery

\`\`\`typescript
// What's available?
container.features.available
// => ['fs', 'git', 'proc', 'vm', 'ui', 'diskCache', 'contentDb', ...]

// Describe one
container.features.describe('diskCache')
// => Markdown documentation for diskCache feature

// Describe everything
container.features.describeAll()
// => Full documentation for all registered features

// Structured introspection data
container.features.introspect('fs')
// => { methods, getters, state, options, events, ... }
\`\`\`

Same API for all registries:

\`\`\`typescript
container.servers.available
container.servers.describe('express')

container.clients.available
container.clients.describe('rest')

container.commands.available
container.commands.describe('serve')
\`\`\`

## Helper-Level Introspection

Every helper instance can describe itself:

\`\`\`typescript
const fs = container.feature('fs')

// Structured data
const info = fs.introspect()
// => { className, methods: [...], getters: [...], state: {...}, events: [...] }

// Human-readable markdown
const docs = fs.introspectAsText()
\`\`\`

### Quick Discovery with $getters and $methods

Every helper exposes \`$getters\` and \`$methods\` — string arrays listing what's available on the instance. Useful for quick exploration without parsing the full introspection object:

\`\`\`typescript
const fs = container.feature('fs')
fs.$methods  // => ['readFile', 'writeFile', 'walk', 'readdir', ...]
fs.$getters  // => ['cwd', 'sep', ...]
\`\`\`

### What's in the Introspection Data?

- **Class name** and description (from JSDoc)
- **Methods** -- name, description, parameters, return type
- **Getters** -- name, description, type
- **State schema** -- all observable state fields with descriptions
- **Options schema** -- all configuration options with descriptions and defaults
- **Events** -- known event names with descriptions

## How It Works

Introspection comes from two sources:

1. **Build-time extraction** -- Luca's build step parses JSDoc comments, method signatures, and getter types from source code using AST analysis. Run \`bun run build:introspection\` to update this.

2. **Runtime Zod schemas** -- State, options, and events schemas provide descriptions, types, and defaults at runtime via Zod's \`.describe()\` method.

## Practical Example: Dynamic Tool Generation

An AI agent can use introspection to generate tool definitions for any feature:

\`\`\`typescript
// Agent discovers available features
const available = container.features.available

// Agent learns about a specific feature
const fsInfo = container.features.introspect('fs')

// fsInfo.methods tells the agent:
// - readFile(path: string): string
// - writeFile(path: string, content: string): Promise<string>
// - walk(basePath: string, options?: WalkOptions): { files: string[], directories: string[] }
// etc.

// The agent can now use these methods without prior training on the fs feature
\`\`\`

## Using Introspection in Your Features

Make your custom features introspectable by:

1. Writing JSDoc on the class, methods, and getters
2. Using Zod \`.describe()\` on schema fields
3. Running \`bun run build:introspection\` after changes

\`\`\`typescript
/**
 * Manages a pool of database connections with automatic health checking.
 * Connections are recycled when they become stale or unhealthy.
 */
export class ConnectionPool extends Feature<PoolState, PoolOptions> {
  /**
   * Acquire a connection from the pool.
   * Blocks until a connection is available or the timeout is reached.
   */
  async acquire(timeout?: number): Promise<Connection> {
    // ...
  }

  /** The number of idle connections currently in the pool */
  get idleCount(): number {
    // ...
  }

  /** The number of active connections currently checked out */
  get activeCount(): number {
    // ...
  }
}
\`\`\`

Now \`container.features.describe('connectionPool')\` returns rich documentation, and \`container.features.introspect('connectionPool')\` returns structured data -- all extracted from what you already wrote.
`,
  "01-getting-started.md": `---
title: Getting Started with Luca
tags: [setup, quickstart, project, init, install, bundle]
---

# Getting Started with Luca

Luca ships as a single binary. You install one file, and that file is the framework, the runtime, and the build tool. No \`npm install\`, no \`node_modules\`, no supply chain exposure.

This tutorial takes you from nothing to a shipped binary of your own.

## 1. Install the Binary

\`\`\`sh
curl -fsSL https://luca-js.soederpop.com/install.sh | bash
\`\`\`

Detects your platform, downloads the binary, puts \`luca\` in your path. Or grab a release directly from [GitHub Releases](https://github.com/soederpop/luca/releases/latest) — binaries are available for macOS (Apple Silicon and Intel), Linux (x64 and ARM64), and Windows (x64).

Verify it works:

\`\`\`sh
luca --version
luca describe features
\`\`\`

That second command is the important one — it prints docs for every feature the runtime carries: file system, git, process management, SQLite, HTTP servers, AI assistants, and more. You'll never need to memorize this list; the binary can always tell you what it can do. (See [Bootstrap: Learning the Container at Runtime](./00-bootstrap.md) for the full discovery pattern.)

## 2. Create a Project

\`\`\`sh
luca bootstrap my-app
cd my-app
\`\`\`

This scaffolds a project with \`commands/\`, \`endpoints/\`, \`features/\`, \`docs/\`, and AI assistant configuration — everything wired up and ready to extend:

\`\`\`
my-app/
├── commands/           # Project-local CLI commands (auto-discovered by \`luca\`)
├── endpoints/          # File-based HTTP routes (auto-discovered by \`luca serve\`)
├── features/           # Custom container features
├── assistants/         # AI assistants (file-based convention)
├── docs/               # Content documents queryable via container.docs
└── public/             # Static files served by \`luca serve\`
\`\`\`

There's no \`package.json\` required and nothing to install. The binary discovers these folders by convention and runs them through its own runtime.

## 3. Add Your Own Pieces

Generate boilerplate with \`luca scaffold\`:

\`\`\`sh
luca scaffold command seed --description "Seed the database"
luca scaffold endpoint health --description "Health check endpoint"
luca scaffold feature myCache --description "Custom caching layer"
\`\`\`

A command handler receives the container with everything on it:

\`\`\`typescript
// commands/seed.ts
export default async function seed(options, context) {
  const { container } = context
  const fs = container.feature('fs')
  const ui = container.feature('ui')

  ui.print.success(\`Seeded \${options.count} records\`)
}
\`\`\`

An endpoint gets the container via context too:

\`\`\`typescript
// endpoints/health.ts
export const path = '/health'

export async function get(_params, ctx) {
  const { container } = ctx
  return { status: 'ok', uptime: process.uptime() }
}
\`\`\`

No imports beyond what the container gives you. File I/O, HTTP clients, databases, YAML, git — it's all on the container, typed and documented. Run \`luca describe fs\` (or any helper name) whenever you want the full API.

## 4. Run It

\`\`\`sh
# run your CLI command
luca seed --count 10

# start the API server — auto-discovers endpoints/, serves public/,
# generates an OpenAPI spec at /openapi.json
luca serve

# run a one-off script with the container in scope
luca run scripts/migrate.ts
\`\`\`

Your commands show up alongside the built-ins when you run \`luca\` with no arguments.

## 5. Ship It

This is the payoff. Compile your project — your commands, endpoints, features, and assistants — into its own standalone binary:

\`\`\`sh
luca bundle my-app
\`\`\`

The output is a self-contained executable. No node, no bun, no npm on the target machine. Your users download one file and run it; your custom commands show up in \`my-app --help\`.

Single binary in, single binary out.

## Using Luca Inside an Existing App?

If you want the container as a library inside an existing TypeScript/Bun project — \`bun add luca\`, import the container, keep your own build — see [Embedding Luca in an Existing Project](./21-embedding-luca.md).

## What's Next

- [Bootstrap: Learning the Container at Runtime](./00-bootstrap.md) -- the discovery pattern: \`luca describe\`, \`luca eval\`, the REPL
- [The Container](./02-container.md) -- deep dive into the container
- [Scripts and Markdown Notebooks](./03-scripts.md) -- run scripts and executable markdown
- [Using Features](./04-features-overview.md) -- explore built-in features
- [Writing Endpoints](./07-endpoints.md) -- build your API routes
- [Writing Commands](./08-commands.md) -- add CLI commands to your project
- [Assistants](./12-assistants.md) -- build an AI operator into your project
`,
  "07-endpoints.md": `---
title: Writing Endpoints
tags: [endpoints, routes, api, express, openapi, rest, http, server]
---

# Writing Endpoints

Endpoints are file-based HTTP routes. Each file in your \`endpoints/\` directory becomes an API route. Luca auto-discovers them when you run \`luca serve\`.

## Basic Endpoint

\`\`\`typescript
// endpoints/health.ts
export const path = '/health'
export const description = 'Health check endpoint'

export async function get() {
  return { status: 'ok', uptime: process.uptime() }
}
\`\`\`

That's it. \`luca serve\` will mount \`GET /health\` and include it in the auto-generated OpenAPI spec.

## Request Validation with Zod

Define schemas for your handlers. Parameters are validated automatically:

\`\`\`typescript
// endpoints/users.ts
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/users'
export const description = 'User management'
export const tags = ['users']

// GET /api/users?role=admin&limit=10
export const getSchema = z.object({
  role: z.string().optional().describe('Filter by role'),
  limit: z.number().default(50).describe('Max results'),
})

export async function get(params: z.infer<typeof getSchema>, ctx: EndpointContext) {
  // params.role and params.limit are validated and typed
  return { users: [], total: 0 }
}

// POST /api/users
export const postSchema = z.object({
  name: z.string().describe('Full name'),
  email: z.string().email().describe('Email address'),
  role: z.enum(['user', 'admin']).default('user').describe('User role'),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  // params are validated
  return { user: { id: '1', ...params }, message: 'User created' }
}
\`\`\`

## URL Parameters

Use \`:param\` in the path or bracket-based file naming:

\`\`\`typescript
// endpoints/users/[id].ts
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/users/:id'
export const description = 'Get, update, or delete a specific user'
export const tags = ['users']

export async function get(_params: any, ctx: EndpointContext) {
  const { id } = ctx.params  // From the URL
  return { user: { id, name: 'Example' } }
}

export const putSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
})

export async function put(params: z.infer<typeof putSchema>, ctx: EndpointContext) {
  const { id } = ctx.params
  return { user: { id, ...params }, message: 'Updated' }
}

// Use \`destroy\` for DELETE — it's a reserved word in JS
export async function destroy(_params: any, ctx: EndpointContext) {
  const { id } = ctx.params
  return { message: \`User \${id} deleted\` }
}
\`\`\`

## The EndpointContext

Every handler receives \`(params, ctx)\`. The context gives you access to:

\`\`\`typescript
export async function post(params: any, ctx: EndpointContext) {
  const {
    container,   // The Luca container -- access any feature from here
    request,     // Express request object
    response,    // Express response object
    query,       // Parsed query string
    body,        // Parsed request body
    params: urlParams,  // URL parameters (:id, etc.)
  } = ctx

  // Use container features
  const data = container.fs.readJson('./data/config.json')

  return { success: true }
}
\`\`\`

## Supported HTTP Methods

Export any of these handler functions:

- \`get\` -- GET requests
- \`post\` -- POST requests
- \`put\` -- PUT requests
- \`patch\` -- PATCH requests
- \`destroy\` -- DELETE requests (preferred — avoids the \`delete\` reserved word)
- \`delete\` -- DELETE requests (also works via \`export { del as delete }\`)

Each can have a corresponding schema export: \`getSchema\`, \`postSchema\`, \`putSchema\`, \`patchSchema\`, \`destroySchema\` / \`deleteSchema\`.

## What Gets Exported

| Export | Required | Description |
|--------|----------|-------------|
| \`path\` | Yes | The route path (e.g. \`/api/users\`, \`/api/users/:id\`) |
| \`description\` | No | Human-readable description (used in OpenAPI spec) |
| \`tags\` | No | Array of tags for OpenAPI grouping |
| \`get\`, \`post\`, \`put\`, \`patch\`, \`destroy\` | At least one | Handler functions (\`destroy\` maps to DELETE) |
| \`getSchema\`, \`postSchema\`, \`destroySchema\`, etc. | No | Zod schemas for request validation |

## Starting the Server

\`\`\`bash
# Default: looks for endpoints/ or src/endpoints/, serves on port 3000
luca serve

# Custom port and directories
luca serve --port 4000 --endpointsDir src/routes --staticDir public
\`\`\`

The server automatically:
- Discovers and mounts all endpoint files
- Generates an OpenAPI spec at \`/openapi.json\`
- Serves static files from \`public/\` if it exists
- Enables CORS by default
- Prints all mounted routes to the console

## Programmatic Server Setup

You can also set up the server in a script:

\`\`\`typescript
import container from 'luca'

const server = container.server('express', { port: 3000, cors: true })

await server.useEndpoints('./endpoints')

server.serveOpenAPISpec({
  title: 'My API',
  version: '1.0.0',
  description: 'My awesome API',
})

await server.start()
console.log('Server running on http://localhost:3000')
\`\`\`

## Streaming Responses

For endpoints that need to stream (e.g. AI responses), you can write directly to the response:

\`\`\`typescript
export const path = '/api/stream'

export async function post(params: any, ctx: EndpointContext) {
  const { response } = ctx

  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache')

  for (const chunk of data) {
    response.write(\`data: \${JSON.stringify(chunk)}\\n\\n\`)
  }

  response.end()
}
\`\`\`
`,
  "19-python-sessions.md": `---
title: Working with Python Projects
tags: [python, sessions, persistent, bridge, codebase, interop, data-science]
---

# Working with Python Projects

Luca's \`python\` feature has two modes: **stateless** execution (fire-and-forget, one process per call) and **persistent sessions** (a long-lived Python process that maintains state across calls). This tutorial focuses on sessions — the mode that lets you actually work inside a Python codebase.

## When to Use Sessions

Stateless \`execute()\` is fine for one-off scripts. But if you need any of these, you want a session:

- **Imports that persist** — load \`pandas\` once, use it across many calls
- **State that builds up** — query a database, filter results, then export
- **Working inside a real project** — import your own modules, call your own functions
- **Expensive setup** — ML model loading, database connections, API client initialization

## Quick Start

\`\`\`ts skip
const python = container.feature('python', { dir: '/path/to/my-python-project' })
await python.enable()
await python.startSession()

// Everything below runs in the same Python process.
// Variables, imports, and state persist across calls.

await python.run('import pandas as pd')
await python.run('df = pd.read_csv("data/sales.csv")')

const result = await python.run('print(df.shape)')
console.log(result.stdout) // '(1000, 12)\\n'

const total = await python.eval('df["revenue"].sum()')
console.log('Total revenue:', total)

await python.stopSession()
\`\`\`

## Project Directory

The \`dir\` option tells Luca where the Python project lives. This determines:

1. **sys.path** — the bridge adds the project root (and \`src/\`, \`lib/\` if they exist) so your imports work
2. **Environment detection** — Luca looks for \`uv.lock\`, \`pyproject.toml\`, \`venv/\`, etc. in this directory
3. **Working directory** — the bridge process runs with \`cwd\` set to this path

\`\`\`ts skip
// Explicit project directory
const python = container.feature('python', { dir: '/Users/me/projects/my-api' })

// Or defaults to wherever luca was invoked from
const python = container.feature('python')
\`\`\`

If your project uses a \`src/\` layout (common in modern Python), the bridge automatically adds it to \`sys.path\`:

\`\`\`
my-project/
  src/
    myapp/
      __init__.py
      models.py
  pyproject.toml
\`\`\`

\`\`\`ts skip
await python.startSession()
// This works because src/ was added to sys.path
await python.importModule('myapp.models', 'models')
\`\`\`

## Session Lifecycle

### Starting

\`startSession()\` spawns a Python bridge process that talks to Luca over stdin/stdout using a JSON-line protocol. The bridge sets up \`sys.path\` and signals when it's ready.

\`\`\`ts skip
await python.enable()
await python.startSession()

console.log(python.state.get('sessionActive')) // true
console.log(python.state.get('sessionId'))     // uuid
\`\`\`

### Stopping

\`stopSession()\` kills the bridge process and cleans up. Any pending requests are rejected.

\`\`\`ts skip
await python.stopSession()
console.log(python.state.get('sessionActive')) // false
\`\`\`

### Crash Recovery

If the Python process dies unexpectedly (segfault, killed externally), the feature:
- Sets \`sessionActive\` to \`false\`
- Rejects all pending requests
- Emits a \`sessionError\` event

\`\`\`ts skip
python.on('sessionError', ({ error, sessionId }) => {
  console.error('Python session error:', error)
  // You could restart: await python.startSession()
})
\`\`\`

## The Session API

### run(code, variables?)

Execute Python code in the persistent namespace. This is the workhorse method.

\`\`\`ts skip
// Simple execution
const result = await python.run('print("hello")')
// result.ok === true
// result.stdout === 'hello\\n'

// With variable injection
const result = await python.run('print(f"Processing {count} items")', { count: 42 })

// Errors don't crash the session
const bad = await python.run('raise ValueError("oops")')
// bad.ok === false
// bad.error === 'oops'
// bad.traceback === 'Traceback (most recent call last):\\n...'

// Session still alive after error
const good = await python.run('print("still here")')
// good.ok === true
\`\`\`

### eval(expression)

Evaluate a Python expression and return its value to JavaScript.

\`\`\`ts skip
await python.run('x = [1, 2, 3]')
const length = await python.eval('len(x)')      // 3
const doubled = await python.eval('[i*2 for i in x]') // [2, 4, 6]
\`\`\`

Values are JSON-serialized. Complex types that can't be serialized come back as their \`repr()\` string.

### importModule(name, alias?)

Import a module into the session namespace. The alias defaults to the last segment of the module path.

\`\`\`ts skip
await python.importModule('json')                    // import json
await python.importModule('myapp.models', 'models')  // import myapp.models as models
await python.importModule('os.path')                 // import os.path (available as "path")
\`\`\`

### call(funcPath, args?, kwargs?)

Call a function by its dotted path in the namespace.

\`\`\`ts skip
await python.importModule('json')
const encoded = await python.call('json.dumps', [{ a: 1 }], { indent: 2 })
// '{\\n  "a": 1\\n}'

// Works with your own functions too
await python.run('def add(a, b): return a + b')
const sum = await python.call('add', [3, 4]) // 7
\`\`\`

### getLocals()

Inspect everything in the session namespace.

\`\`\`ts skip
await python.run('x = 42')
await python.importModule('json')
const locals = await python.getLocals()
// { x: 42, json: '<module ...>' }
\`\`\`

### resetSession()

Clear all variables and imports without restarting the process.

\`\`\`ts skip
await python.run('big_model = load_model()')
await python.resetSession()
// big_model is gone, but the session process is still running
\`\`\`

## Real-World Patterns

### Data Analysis Pipeline

\`\`\`ts skip
const python = container.feature('python', { dir: '/path/to/analytics' })
await python.enable()
await python.startSession()

// Setup
await python.run('import pandas as pd')
await python.run('import matplotlib')
await python.run('matplotlib.use("Agg")')  // headless
await python.run('import matplotlib.pyplot as plt')

// Load and analyze
await python.run('df = pd.read_csv("data/events.csv")')
const shape = await python.eval('list(df.shape)')
console.log(\`Loaded \${shape[0]} rows, \${shape[1]} columns\`)

const columns = await python.eval('list(df.columns)')
console.log('Columns:', columns)

// Filter and aggregate
await python.run(\`
filtered = df[df["status"] == "completed"]
summary = filtered.groupby("category")["amount"].agg(["sum", "mean", "count"])
\`)

const summary = await python.eval('summary.to_dict()')
console.log('Summary:', summary)

// Generate a chart
await python.run(\`
fig, ax = plt.subplots(figsize=(10, 6))
summary["sum"].plot(kind="bar", ax=ax)
ax.set_title("Revenue by Category")
fig.savefig("output/revenue.png", dpi=150, bbox_inches="tight")
plt.close(fig)
\`)

await python.stopSession()
\`\`\`

### Working with a Django Project

\`\`\`ts skip
const python = container.feature('python', { dir: '/path/to/django-project' })
await python.enable()
await python.startSession()

// Django requires this before you can import models
await python.run(\`
import os
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "myproject.settings")

import django
django.setup()
\`)

// Now you can work with the ORM
await python.run('from myapp.models import User, Order')

const userCount = await python.eval('User.objects.count()')
console.log(\`\${userCount} users in database\`)

const recentOrders = await python.eval(\`
list(Order.objects.filter(status="pending").values("id", "total", "created_at")[:10])
\`)
console.log('Recent pending orders:', recentOrders)

await python.stopSession()
\`\`\`

### ML Model Interaction

\`\`\`ts skip
const python = container.feature('python', { dir: '/path/to/ml-project' })
await python.enable()
await python.startSession()

// Expensive setup — only happens once
await python.run(\`
from transformers import pipeline
classifier = pipeline("sentiment-analysis")
print("Model loaded")
\`)

// Now you can call it cheaply many times
async function classify(text: string) {
  return python.call('classifier', [text])
}

const results = await Promise.all([
  classify('I love this product!'),
  classify('Terrible experience.'),
  classify('It was okay, nothing special.'),
])

console.log(results)
// [
//   [{ label: 'POSITIVE', score: 0.9998 }],
//   [{ label: 'NEGATIVE', score: 0.9994 }],
//   [{ label: 'NEGATIVE', score: 0.7231 }],
// ]

await python.stopSession()
\`\`\`

### Luca Command That Uses Python

\`\`\`ts skip
// commands/analyze.ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'
import { CommandOptionsSchema } from 'luca/schemas'

export const positionals = ['target']
export const argsSchema = CommandOptionsSchema.extend({
  target: z.string().describe('Path to CSV file to analyze'),
})

async function handler(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any
  const python = container.feature('python')
  await python.enable()
  await python.startSession()

  try {
    await python.run('import pandas as pd')
    await python.run(\`df = pd.read_csv("\${options.target}")\`)

    const shape = await python.eval('list(df.shape)')
    const dtypes = await python.eval('dict(df.dtypes.astype(str))')
    const nulls = await python.eval('dict(df.isnull().sum())')

    console.log(\`Rows: \${shape[0]}, Columns: \${shape[1]}\`)
    console.log('Column types:', dtypes)
    console.log('Null counts:', nulls)
  } finally {
    await python.stopSession()
  }
}

export default {
  description: 'Analyze a CSV file using pandas',
  argsSchema,
  handler,
}
\`\`\`

\`\`\`bash
luca analyze data/sales.csv
\`\`\`

## Stateless vs. Session: Choosing the Right Mode

| | \`execute()\` (stateless) | \`run()\` (session) |
|---|---|---|
| Process | Fresh per call | Shared, long-lived |
| State | None — each call starts clean | Persists across calls |
| Imports | Re-imported every time | Imported once, reused |
| Startup cost | ~50-200ms per call | ~200ms once, then ~1ms per call |
| Use case | One-off scripts, simple eval | Real projects, data pipelines, REPL-like |
| Error isolation | Perfect — crash is contained | Errors caught, session survives |

Both modes use the same environment detection (uv, conda, venv, system) and respect the same \`dir\` and \`pythonPath\` options.

## Environment Detection

The feature detects Python environments in this order:

1. **Explicit** — \`pythonPath\` option overrides everything
2. **uv** — \`uv.lock\` or \`pyproject.toml\` present, \`uv run python\` works
3. **conda** — \`environment.yml\` or \`conda.yml\` present
4. **venv** — \`venv/\` or \`.venv/\` directory with a Python binary inside
5. **system** — falls back to \`python3\` or \`python\` on PATH

\`\`\`ts skip
const python = container.feature('python', { dir: '/path/to/project' })
await python.enable()
console.log(python.environmentType) // 'uv' | 'conda' | 'venv' | 'system'
console.log(python.pythonPath)      // e.g. '/Users/me/.local/bin/uv run python'
\`\`\`

## Events

The session emits events you can listen to for monitoring and debugging:

\`\`\`ts skip
python.on('sessionStarted', ({ sessionId }) => {
  console.log('Session started:', sessionId)
})

python.on('sessionStopped', ({ sessionId }) => {
  console.log('Session stopped:', sessionId)
})

python.on('sessionError', ({ error, sessionId }) => {
  console.error('Session error:', error)
})
\`\`\`

## What's Next

- [Creating Features](./10-creating-features.md) — build your own feature that wraps a Python service
- [Commands](./08-commands.md) — create CLI commands that leverage Python
- [Servers and Endpoints](./06-servers.md) — expose Python-powered analysis via HTTP
`,
  "18-semantic-search.md": `---
title: Semantic Search
tags: [semantic-search, embeddings, vector-search, bm25, hybrid-search, sqlite, contentdb]
---

# Semantic Search

Luca's \`semanticSearch\` feature provides BM25 keyword search, vector similarity search, and hybrid search with Reciprocal Rank Fusion -- all backed by SQLite. It chunks documents intelligently, generates embeddings via OpenAI or a local GGUF model, and stores everything in a single \`.sqlite\` file.

## Quick Start with ContentDb

The fastest way to use semantic search is through the \`contentDb\` feature, which handles indexing and querying automatically:

\`\`\`typescript
import container from 'luca'

const db = container.feature('contentDb', { rootPath: './docs' })
await db.load()

// Build the search index (generates embeddings for all documents)
await db.buildSearchIndex({
  onProgress: (indexed, total) => console.log(\`\${indexed}/\${total}\`)
})

// Search your documents
const results = await db.hybridSearch('how does authentication work')
for (const r of results) {
  console.log(\`\${r.title} (score: \${r.score.toFixed(3)})\`)
  console.log(\`  \${r.snippet}\`)
}
\`\`\`

ContentDb provides three search methods that delegate to the underlying semanticSearch feature:

\`\`\`typescript
// BM25 keyword search -- best for exact term matching
await db.search('OAuth2 token refresh')

// Vector similarity search -- finds conceptually related documents
await db.vectorSearch('how do users log in')

// Hybrid search -- combines both via Reciprocal Rank Fusion (recommended)
await db.hybridSearch('authentication flow', { limit: 5 })
\`\`\`

## Using SemanticSearch Directly

For more control, use the \`semanticSearch\` feature directly:

\`\`\`typescript
import container from 'luca'
import { SemanticSearch } from 'luca/node/features/semantic-search'

// Attach the feature to the container
SemanticSearch.attach(container)

const search = container.feature('semanticSearch', {
  dbPath: '.contentbase/search.sqlite',
  embeddingProvider: 'openai',        // or 'local'
  embeddingModel: 'text-embedding-3-small',
  chunkStrategy: 'section',           // 'section' | 'fixed' | 'document'
  chunkSize: 900,
})

await search.initDb()
\`\`\`

## Indexing Documents

Documents are represented as \`DocumentInput\` objects with optional section metadata:

\`\`\`typescript
await search.indexDocuments([
  {
    pathId: 'guides/auth',
    model: 'Guide',
    title: 'Authentication Guide',
    meta: { status: 'published', category: 'security' },
    content: 'Full document content here...',
    sections: [
      {
        heading: 'OAuth2 Flow',
        headingPath: 'Authentication Guide > OAuth2 Flow',
        content: 'OAuth2 uses authorization codes and tokens...',
        level: 2,
      },
      {
        heading: 'Session Management',
        headingPath: 'Authentication Guide > Session Management',
        content: 'Sessions are stored server-side with a cookie...',
        level: 2,
      },
    ],
  },
  {
    pathId: 'guides/deployment',
    title: 'Deployment Guide',
    content: 'How to deploy your application...',
  },
])
\`\`\`

The \`indexDocuments\` method:
1. Stores documents in SQLite with FTS5 full-text indexing
2. Chunks each document based on the configured strategy
3. Generates embeddings for every chunk
4. Stores embeddings as BLOBs alongside the chunk text

## Chunking Strategies

The feature splits documents into chunks before embedding. Choose a strategy based on your content:

### Section (default)

Splits at heading boundaries (\`## H2\`, \`### H3\`). Each section becomes a chunk, prefixed with the heading path for context. Falls back to fixed chunking if the document has no sections.

\`\`\`typescript
const search = container.feature('semanticSearch', {
  chunkStrategy: 'section',
  chunkSize: 900,  // max tokens per chunk (sections exceeding this are split at paragraphs)
})
\`\`\`

Best for: structured documents with clear heading hierarchies.

### Fixed

Splits by word count with configurable overlap between chunks:

\`\`\`typescript
const search = container.feature('semanticSearch', {
  chunkStrategy: 'fixed',
  chunkSize: 900,
  chunkOverlap: 0.15,  // 15% overlap between adjacent chunks
})
\`\`\`

Best for: unstructured prose, logs, or transcripts.

### Document

One chunk per document -- no splitting:

\`\`\`typescript
const search = container.feature('semanticSearch', {
  chunkStrategy: 'document',
})
\`\`\`

Best for: short documents where splitting would lose context.

## Search Methods

### BM25 Keyword Search

Uses SQLite FTS5 with Porter stemming for traditional keyword matching:

\`\`\`typescript
const results = await search.search('authentication tokens', {
  limit: 10,
  model: 'Guide',                        // filter by document model
  where: { status: 'published' },         // filter by metadata fields
})
\`\`\`

Returns results ranked by BM25 relevance with highlighted snippets.

### Vector Similarity Search

Embeds the query and computes cosine similarity against all stored chunk embeddings:

\`\`\`typescript
const results = await search.vectorSearch('how do users prove their identity', {
  limit: 10,
})
\`\`\`

Finds conceptually related content even without keyword overlap. Results are deduplicated by document, keeping the best-scoring chunk per document.

### Hybrid Search (Recommended)

Runs both BM25 and vector search in parallel, then fuses results using Reciprocal Rank Fusion:

\`\`\`typescript
const results = await search.hybridSearch('authentication flow', {
  limit: 10,
  model: 'Guide',
  where: { category: 'security' },
})
\`\`\`

This gives the best results for most queries -- keyword precision combined with semantic recall.

## Search Results

All search methods return \`SearchResult[]\`:

\`\`\`typescript
interface SearchResult {
  pathId: string          // document identifier
  model: string           // content model name
  title: string           // document title
  meta: Record<string, any>  // document metadata
  score: number           // relevance score
  snippet: string         // matched text excerpt
  matchedSection?: string // section heading where the match occurred
  headingPath?: string    // full heading breadcrumb (e.g. "Auth > OAuth2 > Tokens")
}
\`\`\`

## Embedding Providers

### OpenAI (default)

Uses the OpenAI embeddings API. Requires an \`openai\` client registered in the container.

\`\`\`typescript
const search = container.feature('semanticSearch', {
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',  // 1536 dimensions
  // also available: 'text-embedding-3-large' (3072 dimensions)
})
\`\`\`

### Local (GGUF)

Runs embeddings locally using \`node-llama-cpp\` with a GGUF model file:

\`\`\`typescript
const search = container.feature('semanticSearch', {
  embeddingProvider: 'local',
  embeddingModel: 'embedding-gemma-300M-Q8_0',  // 768 dimensions
})

// Install the dependency if needed
await search.installLocalEmbeddings(process.cwd())
\`\`\`

Local models are loaded from \`~/.cache/luca/models/\` or \`~/.cache/qmd/models/\`. The model is kept in memory and automatically disposed after 5 minutes of inactivity.

## Index Management

### Incremental Updates

The feature tracks content hashes to avoid re-embedding unchanged documents:

\`\`\`typescript
// Check if a document needs re-indexing
if (search.needsReindex(doc)) {
  search.removeDocument(doc.pathId)
  await search.indexDocuments([doc])
}
\`\`\`

### Remove Stale Documents

Clean up documents that no longer exist in your collection:

\`\`\`typescript
const currentIds = ['guides/auth', 'guides/deployment']
search.removeStale(currentIds)  // deletes any indexed docs not in this list
\`\`\`

### Full Reindex

Clear everything and start fresh:

\`\`\`typescript
await search.reindex()  // clears all data
await search.indexDocuments(allDocs)  // re-index everything
\`\`\`

### Index Status

\`\`\`typescript
const stats = search.getStats()
// {
//   documentCount: 42,
//   chunkCount: 187,
//   embeddingCount: 187,
//   lastIndexedAt: '2026-03-06T...',
//   provider: 'openai',
//   model: 'text-embedding-3-small',
//   dimensions: 1536,
//   dbSizeBytes: 2457600,
// }
\`\`\`

## Database Scoping

Each provider/model combination gets its own SQLite file. If you configure \`dbPath: '.contentbase/search.sqlite'\` with the OpenAI provider and \`text-embedding-3-small\` model, the actual file will be \`.contentbase/search.openai-text-embedding-3-small.sqlite\`. This prevents dimension mismatches if you switch providers.

## ContentDb Integration Details

When using \`contentDb.buildSearchIndex()\`, the feature automatically:

- Extracts sections from your markdown documents at H2 boundaries
- Converts each document to a \`DocumentInput\` with pathId, title, meta, and sections
- Skips unchanged documents (incremental by default)
- Removes documents that no longer exist in the collection

\`\`\`typescript
const db = container.feature('contentDb', { rootPath: './docs' })
await db.load()

// Incremental update (default)
const { indexed, total } = await db.buildSearchIndex()
console.log(\`Indexed \${indexed} of \${total} documents\`)

// Force full rebuild
await db.rebuildSearchIndex()

// Check index health
console.log(db.searchIndexStatus)
\`\`\`

## Lifecycle

Always close the feature when done to release the SQLite connection and any loaded models:

\`\`\`typescript
await search.close()
\`\`\`

The feature emits events you can listen to:

\`\`\`typescript
search.on('dbReady', () => console.log('Database initialized'))
search.on('indexed', ({ documents, chunks }) => {
  console.log(\`Indexed \${documents} docs (\${chunks} chunks)\`)
})
search.on('modelLoaded', () => console.log('Local embedding model loaded'))
search.on('modelDisposed', () => console.log('Local embedding model released'))
\`\`\`
`,
  "04-features-overview.md": `---
title: Features Overview
tags: [features, built-in, fs, git, proc, vm, ui, networking, os, diskCache]
---

# Features Overview

Features are the core building blocks in Luca. A feature is a thing that emits events, has observable state, and provides an interface for doing something meaningful. The container comes with many built-in features.

## Using Features

\`\`\`typescript
// Auto-enabled features have shortcuts
container.fs          // File system
container.git         // Git operations
container.proc        // Process execution
container.vm          // JavaScript VM
container.ui          // Terminal UI
container.os          // OS info
container.networking  // Port utilities

// On-demand features are created through the factory
const cache = container.feature('diskCache', { path: './.cache' })
const db = container.feature('contentDb', { rootPath: './docs' })
\`\`\`

## Built-In Feature Reference

### fs -- File System

Read, write, and navigate the file system:

\`\`\`typescript
const fs = container.fs

// Read files (synchronous)
const content = fs.readFile('./README.md')
const json = fs.readJson('./package.json')

// Write files (async -- creates parent dirs automatically)
await fs.writeFile('./output.txt', 'Hello')

// Check existence
fs.exists('./path/to/file')

// Walk directories -- returns { files: string[], directories: string[] }
const { files } = fs.walk('./src', { include: ['*.ts'] })

// Find files upward (synchronous)
const configPath = fs.findUp('tsconfig.json')
\`\`\`

### git -- Git Operations

Work with git repositories:

\`\`\`typescript
const git = container.git

const branch = git.branch                  // Current branch name (getter)
const sha = git.sha                        // Current commit SHA (getter)
const isRepo = git.isRepo                  // Whether cwd is a git repo (getter)
const root = git.repoRoot                  // Absolute path to repo root (getter)
const files = await git.lsFiles()          // List tracked files
const recent = await git.getLatestChanges(5) // Recent commits
\`\`\`

### proc -- Process Execution

Run external processes:

\`\`\`typescript
const proc = container.proc

// Execute a command synchronously and get output as a string
const result = proc.exec('ls -la')

// Execute with options
const output = proc.exec('npm test', {
  cwd: '/path/to/project',
  env: { NODE_ENV: 'test' },
})
\`\`\`

### vm -- JavaScript VM

Execute JavaScript in an isolated context:

\`\`\`typescript
const vm = container.vm

const result = await vm.run('1 + 2 + 3')  // 6

const greeting = await vm.run('\`Hello \${name}!\`', { name: 'World' })
// 'Hello World!'

// The VM has access to the container context by default
const files = await vm.run('container.fs.walk("./src")')
\`\`\`

### ui -- Terminal UI

Colors, prompts, and formatted output:

\`\`\`typescript
const ui = container.ui

// Colors
ui.colors.green('Success!')
ui.colors.red('Error!')
ui.colors.yellow('Warning!')

// ASCII art
console.log(ui.asciiArt('My App', 'Standard'))

// Colorful ASCII banner with gradient
console.log(ui.banner('My App', { font: 'Star Wars', colors: ['red', 'white', 'blue'] }))

// Render markdown in the terminal
ui.markdown('# Hello\\n\\nThis is **bold**')
\`\`\`

### networking -- Port Utilities

\`\`\`typescript
const net = container.networking

// Find an available port (starting from a preferred port)
const port = await net.findOpenPort(3000)
\`\`\`

### os -- System Info

\`\`\`typescript
const os = container.os

os.platform   // 'darwin', 'linux', 'win32'
os.arch       // 'x64', 'arm64'
os.cpuCount   // Number of CPU cores
os.tmpdir     // Temp directory path
\`\`\`

### diskCache -- Disk-Based Cache

\`\`\`typescript
const cache = container.feature('diskCache', { path: './.cache' })

await cache.set('key', { data: 'value' })
const data = await cache.get('key')
await cache.has('key')    // true
await cache.rm('key')     // remove a cached item
\`\`\`

### contentDb -- Markdown as a Database

Turn markdown folders into queryable collections. See the dedicated [ContentBase tutorial](./11-contentbase.md).

### fileManager -- Batch File Operations

\`\`\`typescript
const fm = container.feature('fileManager')
// Batch read, write, copy, move operations
\`\`\`

### grep -- Search File Contents

\`\`\`typescript
const grep = container.grep
const results = await grep.search({ pattern: 'TODO', include: '*.ts' })
// Returns array of { file, line, column, match } objects
\`\`\`

### docker -- Docker Operations

\`\`\`typescript
const docker = container.feature('docker')
// Build, run, manage containers
\`\`\`

## Discovering Features

Don't memorize this list. You can always discover what's available at runtime:

\`\`\`typescript
// List all registered features
container.features.available

// Get documentation for any feature
container.features.describe('diskCache')

// Get docs for everything
container.features.describeAll()

// Structured introspection data for a feature's full API
container.feature('fs').introspect()
\`\`\`
`,
  "06-servers.md": `---
title: Servers
tags: [servers, express, websocket, start, stop, middleware, static]
---

# Servers

Servers are helpers that listen for connections. Luca provides Express and WebSocket servers out of the box.

## Express Server

### Basic Setup

\`\`\`typescript
const server = container.server('express', {
  port: 3000,
  cors: true,
})

await server.start()
console.log('Listening on http://localhost:3000')
\`\`\`

### With Endpoints

The most common pattern is file-based endpoints:

\`\`\`typescript
const server = container.server('express', { port: 3000, cors: true })

// Auto-discover and mount endpoint files
await server.useEndpoints('./endpoints')

// Generate OpenAPI spec
server.serveOpenAPISpec({
  title: 'My API',
  version: '1.0.0',
  description: 'An awesome API built with Luca',
})

await server.start()
\`\`\`

### Static Files

\`\`\`typescript
const server = container.server('express', {
  port: 3000,
  static: './public',  // Serve files from public/ directory
})
\`\`\`

### Port Auto-Discovery

If the requested port is taken, \`configure()\` can find an open one:

\`\`\`typescript
const server = container.server('express', { port: 3000 })
await server.configure()  // Finds port 3000 or next available
await server.start()
console.log(\`Listening on port \${server.state.get('port')}\`)
\`\`\`

### Server State

\`\`\`typescript
// After starting, check server state
await server.start()
server.state.get('listening')  // true
server.state.get('port')       // 3000

// Watch for state changes
server.state.observe((type, key, value) => {
  if (key === 'listening' && value) {
    console.log('Server is now listening')
  }
})
\`\`\`

### Accessing the Express App

For custom middleware or routes beyond file-based endpoints:

\`\`\`typescript
const server = container.server('express', { port: 3000 })

// Access the underlying express app
const app = server.app

app.use((req, res, next) => {
  console.log(\`\${req.method} \${req.url}\`)
  next()
})

app.get('/custom', (req, res) => {
  res.json({ message: 'Custom route' })
})

await server.start()
\`\`\`

## WebSocket Server

\`\`\`typescript
const ws = container.server('websocket', { port: 8080 })

ws.on('connection', (socket) => {
  console.log('Client connected')

  socket.on('message', (data) => {
    console.log('Received:', data)
    socket.send(JSON.stringify({ echo: data }))
  })
})

await ws.start()
\`\`\`

## Combining Servers

Run HTTP and WebSocket together:

\`\`\`typescript
const http = container.server('express', { port: 3000 })
const ws = container.server('websocket', { port: 8080 })

await http.useEndpoints('./endpoints')

await Promise.all([
  http.start(),
  ws.start(),
])

console.log('HTTP on :3000, WebSocket on :8080')
\`\`\`

## Discovering Servers

\`\`\`typescript
container.servers.available    // ['express', 'websocket']
container.servers.describe('express')
\`\`\`

## The \`luca serve\` Command

For most projects, you don't need to set up the server manually. The built-in \`luca serve\` command does it for you:

\`\`\`bash
luca serve --port 3000
\`\`\`

It automatically:
- Finds your \`endpoints/\` directory
- Mounts all endpoint files
- Serves \`public/\` as static files
- Generates the OpenAPI spec
- Prints all routes
`,
  "23-assistant-driven-ui.md": `---
title: "Advanced: An Assistant That Drives Your UI"
tags:
  - browser
  - assistant
  - tools
  - containerLink
  - reactive
  - advanced
  - rpc
---
# Advanced: An Assistant That Drives Your UI

You have a reactive browser app ([tutorial 22](./22-reactive-frontend.md)) and you know features expose tools that assistants pick up with \`assistant.use()\` ([Features as Tool Providers](../examples/feature-as-tool-provider.md)). This tutorial connects the two: **a server-side assistant that can operate the front-end the user is looking at** — add items, flip tabs, run a query — with every action visibly updating the live UI.

This is the "assistant spawns a UI, then drives it" loop. It's built entirely from generic Luca primitives; nothing here is bespoke.

## The one insight: it's the same tool pattern, plus one hop

Exposing tools never changes. A feature declares \`static tools\` (name → \`{ description, schema }\`), implements a matching method per tool, and an assistant calls \`use(feature)\` to register them. That's true for \`fileTools\`, for your own server features, and for this.

The *only* new problem is a **location gap**: the assistant runs in a Node process, but the app's state and methods live in the user's browser. You need a way for server code to call a method over in the browser and get the result back. That transport is the **\`containerLink\`** feature — and once you have it, the tool-provider pattern drops in unchanged.

\`\`\`
┌─ Node process ──────────────┐         ┌─ Browser ───────────────┐
│  assistant.use(remote)      │  ws     │  container.feature('app')│
│  remote.addTodo(args) ──────┼────────▶│  .addTodo(args)          │
│         ▲ result            │  eval   │   → mutates state        │
│         └───────────────────┼─────────┤   → emit('changed')      │
└─────────────────────────────┘         │   → UI re-renders        │
                                         └──────────────────────────┘
\`\`\`

## \`containerLink\` in a nutshell

\`containerLink\` is one feature with two sides — the browser gets the client, a Node process gets the host:

- **Host (Node):** \`container.feature('containerLink', { port: 8089 })\`, then \`await link.start()\`. It's a WebSocket server. It emits \`connection(uuid, meta)\` when a browser registers, and its key method is **\`eval(containerId, code, context?, timeout?)\`** — run code inside that browser and get the (awaited) result back.
- **Client (browser):** \`container.feature('containerLink', { hostUrl })\`, then \`await link.connect()\`. It registers with the host and services eval requests.

The trust is **one-directional**: the host can eval in the browser, never the reverse (the browser can only \`emitToHost(event, data)\`). Evaluated code runs through the browser's \`vm\` with the **\`container\` in scope**, and — crucially — the host \`await\`s a Promise the code returns. So an async method call round-trips cleanly.

> \`luca describe containerLink\` and \`luca describe containerLink --platform=web\` show the full surface of each side.

## Step 1 — the browser app, with methods worth calling

Start from tutorial 22's store-as-feature. The only thing that matters for remote control: **each mutating method ends with \`emit('changed')\`**, so when the assistant calls it, the human watching the page sees the update. Reference the app through \`container.feature('app')\` (that's what's in scope on the browser side) — not \`window.app\`.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/luca@3.3.3/web"
  const { Feature } = container

  class TodoApp extends Feature {
    static shortcut = 'features.app'
    static { Feature.register(this, 'app') }

    get todos() { return this.state.get('todos') || [] }

    async addTodo({ title }) {
      const todo = { id: container.utils.uuid(), title, done: false }
      this.state.set('todos', [...this.todos, todo])
      this.emit('changed')                 // ← the user sees it appear
      return todo
    }
    async toggleTodo({ id }) {
      this.state.set('todos', this.todos.map((t) => t.id === id ? { ...t, done: !t.done } : t))
      this.emit('changed')
      return { id }
    }
    async listTodos() { return this.todos }
  }

  const app = container.feature('app')
  // ...render with React exactly as in tutorial 22...

  // Connect back to the host so it can drive this app.
  const link = container.feature('containerLink', {
    hostUrl: \`ws://\${location.hostname}:8089\`,
    meta: { app: 'todos' },              // lets the host tell windows apart
  })
  await link.connect()
</script>
\`\`\`

That's the entire browser-side change: three callable methods and one \`connect()\`.

## Step 2 — a server feature that exposes those methods as tools

This is an ordinary tool-provider feature (\`features/todo-remote.ts\`), identical in shape to \`fileTools\`. The difference is that each method, instead of doing the work locally, **evals the call over the link**. The server owns the Zod schemas — it's the side talking to the model.

\`\`\`ts
// features/todo-remote.ts
import { z } from 'zod'
import { Feature } from 'luca'

export class TodoRemote extends Feature {
  static override stability = 'experimental' as const
  static { Feature.register(this, 'todoRemote') }

  // 1. The tool surface the assistant sees (Zod, per the standard pattern)
  static override tools = {
    addTodo: {
      description: 'Add a todo to the UI the user is looking at.',
      schema: z.object({ title: z.string().describe('The todo text') })
        .describe('Add a todo to the UI the user is looking at.'),
    },
    toggleTodo: {
      description: 'Toggle a todo done/undone by its id.',
      schema: z.object({ id: z.string().describe('The todo id') })
        .describe('Toggle a todo done/undone by its id.'),
    },
    listTodos: {
      description: 'List the todos currently shown in the UI.',
      schema: z.object({}).describe('List the todos currently shown in the UI.'),
    },
  }

  get link() { return this.container.feature('containerLink') }
  get uiId() { return this.state.get('uiId') as string | undefined }

  // 2. Each method forwards the call into the browser and returns its result.
  //    Pass args via the eval *context* (second arg) — no string interpolation,
  //    no injection surface. \`args\` and \`container\` are both in scope over there.
  async addTodo(args: { title: string }) {
    return this.callUi(\`container.feature('app').addTodo(args)\`, args)
  }
  async toggleTodo(args: { id: string }) {
    return this.callUi(\`container.feature('app').toggleTodo(args)\`, args)
  }
  async listTodos() {
    return this.callUi(\`container.feature('app').listTodos()\`, {})
  }

  private async callUi(code: string, args: any) {
    if (!this.uiId) throw new Error('No UI is connected yet — open the app in a browser first.')
    return this.link.eval(this.uiId, code, { args })
  }

  // 3. Teach the assistant it's operating a live surface, not a database.
  override setupToolsConsumer(consumer: any) {
    if (typeof consumer.addSystemPromptExtension === 'function') {
      consumer.addSystemPromptExtension('todoRemote', [
        '## Todo UI',
        'These tools operate the live todo list the user is watching on screen.',
        'Prefer listTodos to see current state before toggling. Actions are visible immediately.',
      ].join('\\n'))
    }
  }
}

export default TodoRemote
\`\`\`

Because \`TodoRemote\` is a normal feature, everything from the tool-provider example still holds: handlers are auto-bound by name in \`toTools()\`, you can call them directly to test without a model, and \`toTools({ only })\` scopes them down.

## Step 3 — wire the host, track the window, hand it to the assistant

Put the plumbing where it runs before anything else — \`luca.cli.ts\`'s \`main()\`, or a dedicated command. Serve the app with \`luca serve\` (tutorial 22), and run the link host alongside it:

\`\`\`ts
// in luca.cli.ts main(), a command, or a script
await container.helpers.discoverAll()          // register features/todo-remote.ts

const link = container.feature('containerLink', { port: 8089 })
await link.start()

const remote = container.feature('todoRemote')

// When a browser opens the app, remember which container is the todo UI.
link.on('connection', (uuid: string, meta: any) => {
  if (meta?.meta?.app === 'todos') remote.state.set('uiId', uuid)
})
link.on('disconnection', (uuid: string) => {
  if (remote.uiId === uuid) remote.state.set('uiId', undefined)
})

const assistant = container.feature('assistant', {
  systemPrompt: 'You help the user manage their todo list.',
  model: 'gpt-4.1-mini',
})
assistant.use(remote)                          // addTodo / toggleTodo / listTodos now registered

await assistant.start()
console.log(await assistant.ask('Add todos for milk, eggs, and bread, then show me the list.'))
// The three items pop into the browser as the model calls addTodo, and
// listTodos returns the real state — the assistant narrates what's on screen.
\`\`\`

The loop is closed: the model calls a tool → the handler evals into the browser → the method mutates state and emits \`changed\` → the user's UI re-renders → the result flows back to the model. Everything you already learned about tool providers and reactive features composes; \`containerLink\` just carries the call across the process boundary.

## Scaling up: let the browser own its tool surface

Hardcoding \`TodoRemote\`'s schemas on the server is right when *you* wrote the UI. But if UIs are generated on the fly — an assistant writes a new workflow, serves it, and wants to drive it without anyone updating server code — the tool contract has to come *from the browser*.

The shape: have the browser app expose its own tools (in the browser, schemas are plain JSON Schema — there's no Zod), and fetch them over the link at connect time:

\`\`\`ts
// host: discover the app's declared tools
const schemas = await link.eval(uiId,
  \`JSON.stringify(container.feature('app').toTools().schemas)\`)   // returns { toolName: jsonSchema }

// build one proxy handler per tool, each evaling the matching method in the browser
for (const name of Object.keys(JSON.parse(schemas))) {
  // handler forwards to container.feature('app')[name](args) over the link
}
\`\`\`

One friction point to plan for: **\`assistant.addTool()\` wants a Zod schema** (it calls \`schema.toJSONSchema()\` internally). Browser-declared schemas arrive as JSON Schema, so a fully dynamic path needs a JSON-Schema→Zod step on the host. That conversion is the reason most apps keep the tool contract on the server (Step 2) and only reach for dynamic discovery when the set of UIs genuinely isn't known ahead of time.

> **Alternate transport.** If your app runs in *native* windows you spawn (not a persistent WebSocket link), you can inject and evaluate JS in a window directly and poll a result global instead of using \`containerLink.eval\`. Same author-facing idea — the app exposes \`toTools()\`; only the pipe differs.

## Gotchas

- **Host→browser eval runs arbitrary code in the user's page.** Only connect a browser to a host you control, and treat the \`containerLink\` port like any other trusted local service. Connections are token-authenticated per session.
- **\`emit('changed')\` in every mutating method**, or the assistant will change state the user can't see — defeating the point.
- **Results must be JSON-serializable.** \`eval\` marshals the return value over WebSocket; return plain objects, not class instances or DOM nodes.
- **Handle "no UI connected."** The assistant may call a tool before any browser has opened the app — fail with a clear message (as \`callUi\` does) rather than evaling into \`undefined\`.
- **Pass arguments via the eval context, not string interpolation** — \`link.eval(id, 'fn(args)', { args })\` keeps model-supplied values out of the code string.
- **Reference \`container.feature('app')\` in evaled code.** \`container\` is in scope on the browser side; \`window\`-globals may not be, depending on how the page loaded.
- **Route by \`meta\` when multiple windows connect.** The \`connection(uuid, meta)\` event carries the \`meta\` you passed to \`connect()\` — use it to pick the right UI, or track several.

## What's Next

- [Browser: Reactive UIs with No Build Step](./22-reactive-frontend.md) — the app this drives
- [Features as Tool Providers](../examples/feature-as-tool-provider.md) — \`static tools\`, \`toTools()\`, \`use()\`, \`setupToolsConsumer()\` in depth
- [Assistants](./12-assistants.md) — building and running assistants
- \`luca describe containerLink\` / \`--platform=web\` — the full host and client APIs
`,
  "25-express-websocket-sidecar.md": `---
title: "Express + a WebSocket Sidecar with luca serve --setup"
tags:
  - servers
  - express
  - websocket
  - serve
  - setup
  - sidecar
  - realtime
---
# Express + a WebSocket Sidecar with \`luca serve --setup\`

You have REST endpoints served by \`luca serve\` ([tutorial 7](./07-endpoints.md)). Now you want **live push** — a WebSocket running in the same process, alongside the HTTP API, so a \`POST\` can notify every connected client. This is the "sidecar" shape: one process, two servers, one shared state.

The clean seam for wiring it up is **\`luca serve --setup\`**. You keep \`luca serve\` managing Express (endpoints, static, OpenAPI, port handling), and hand it a small module that receives the running server so you can attach the WebSocket sidecar and connect the two. No custom bootstrap, no reinventing the serve command.

## The shape

\`\`\`
                 luca serve --setup setup.ts --port 3000
                 │
  ┌──────────────┼───────────────────────────────┐
  │  one process                                  │
  │                                               │
  │   Express (owned by luca serve)   :3000       │  ← endpoints/ + public/
  │        │                                      │
  │        │ setup.ts wires them together         │
  │        ▼                                      │
  │   WebSocket sidecar (you start)   :8081       │  ← live push to clients
  └───────────────────────────────────────────────┘
\`\`\`

\`luca serve\` builds the Express server, mounts your \`endpoints/\`, and serves \`public/\`. \`--setup setup.ts\` hands your module that Express server **after endpoints mount but before it starts listening** — exactly the right moment to start the sidecar and stash shared handles.

## The setup module contract

A setup module's default export is a function that receives the Luca Express server. It may be async and is awaited:

\`\`\`ts
// setup.ts
export default async function setup(server) {
  // \`server\` is the Luca ExpressServer. Two things you always have:
  const container = server.container   // the full container — reliable handle
  const app = server.app               // the underlying Express app (routes mounted, not yet listening)

  // ...attach middleware, start the sidecar, share state (below)
}
\`\`\`

What's true at setup time:
- **\`server.app\` is ready** — endpoints are already mounted; you can add more middleware or routes.
- **It is not listening yet** — \`luca serve\` calls \`start()\` *after* your setup returns. Don't assume the HTTP port is open.
- **\`server.container\` is your container** — use it for features, clients, and the WebSocket server.

> Express has three doors for custom wiring: the \`create: (app, server) => app\` option (when the app is first built, before endpoints), \`server.app.use(...)\` on the instance, and \`luca serve --setup\` from the CLI. This tutorial uses the CLI door — it's the one that composes with the managed \`serve\` lifecycle.

## Start the WebSocket sidecar

Luca's \`websocket\` server binds its **own port** — so the sidecar is a *companion port* (say \`8081\`) next to Express on \`3000\`. Start it in \`setup.ts\` and stash it on \`app.locals\` so your REST endpoints can reach it:

\`\`\`ts
// setup.ts
export default async function setup(server) {
  const container = server.container
  const app = server.app

  // A JSON WebSocket server on its own port, alongside Express.
  const ws = container.server('websocket', { port: 8081, json: true })

  ws.on('connection', (socket) => {
    ws.send(socket, { type: 'welcome', at: Date.now() })
    socket.on('message', (raw) => {
      // client → server messages arrive here
    })
  })

  await ws.start()

  // Shared state: endpoints reach the sidecar via req.app.locals.
  app.locals.ws = ws
  console.log('WebSocket sidecar listening on :8081')
}
\`\`\`

\`app.locals\` is the blessed way to share objects across the HTTP and WebSocket halves — endpoint files can't import a variable from \`setup.ts\`, but they can read \`req.app.locals\`.

## Wire REST → WebSocket

The payoff: an HTTP write triggers a live push. Here's an endpoint that records a message and broadcasts it to every connected socket. Endpoint handlers are \`(params, ctx)\`; reach the sidecar through \`ctx.request.app.locals\`:

\`\`\`ts
// endpoints/messages.ts  →  POST /api/messages
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/messages'

export const postSchema = z.object({
  text: z.string().describe('The message body'),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const ws = ctx.request.app.locals.ws            // the sidecar, shared from setup.ts
  const message = { id: ctx.container.utils.uuid(), text: params.text, at: Date.now() }

  await ws.broadcast({ type: 'message', message })  // push to all connected clients
  return { ok: true, message }
}
\`\`\`

Now \`POST /api/messages\` returns JSON to the caller *and* fans the message out to every WebSocket client in real time. HTTP handles the write; the sidecar handles the notify.

Need the server to *ask* a specific client something and await its reply? The Luca WebSocket server has \`ask(socket, type, data)\` request/response semantics — see the [ask-and-reply example](../examples/websocket-ask-and-reply-example.md).

## The client side

Connect from a browser app ([tutorial 22](./22-reactive-frontend.md)) or any Luca container — note the client targets the **sidecar port**, not the HTTP port:

\`\`\`js
// in the browser (or any container)
const socket = container.client('websocket', { baseURL: 'ws://localhost:8081' })
socket.on('message', (msg) => {
  if (msg.type === 'message') store.addMessage(msg.message)  // push into your reactive store
})
await socket.connect()
\`\`\`

A \`fetch('/api/messages', …)\` to \`:3000\` now shows up on every connected client via \`:8081\`.

## Run it

\`\`\`bash
luca serve --setup setup.ts --port 3000
\`\`\`

You get Express on \`:3000\` (your endpoints + \`public/\` + \`/openapi.json\`) and the WebSocket sidecar on \`:8081\`, in one process, sharing state. \`luca serve\` holds the process open and handles shutdown.

## Lifecycle & gotchas

- **Setup runs before \`listen()\`.** \`server.app\` is ready and endpoints are mounted, but the HTTP port isn't open yet. Do setup work (start the sidecar, add middleware, seed \`app.locals\`); don't make requests to yourself from inside setup.
- **Share state through \`app.locals\`.** Endpoint files are separate modules — they can't import from \`setup.ts\`. Put shared handles (\`ws\`, caches, queues) on \`app.locals\` in setup and read \`ctx.request.app.locals\` in handlers.
- **The sidecar is a companion port.** Clients connect to \`ws://host:8081\`, distinct from the HTTP \`:3000\`. For browsers, that's a different origin — allow it (Express \`--cors\` is on by default for the HTTP side; the WS side isn't CORS-gated the same way, but mind mixed \`ws://\`/\`wss://\` under HTTPS).
- **Want a single shared port (HTTP \`Upgrade\`)?** Luca's \`websocket\` server always binds its own port, and the Express HTTP listener doesn't exist until \`start()\` (after setup) — so true single-port upgrade means owning the \`http.Server\` yourself with raw \`ws\` (\`new WebSocketServer({ noServer: true })\` + \`httpServer.on('upgrade', …)\`) in a custom command, not via \`luca serve\`. Reach for it only if a second port is genuinely unacceptable; the companion-port sidecar is simpler and is what \`serve\` supports cleanly.
- **\`Bun.serve\`/\`Bun.spawn\` are unavailable** in the VM-loaded setup module — use \`container.server(...)\` (as here) and \`container.feature('proc')\`.
- **Clean up if you must.** \`luca serve\` tears down on SIGINT. If your sidecar holds external resources, close them in a \`process.on('SIGINT', …)\` handler registered in setup.

## Alternative: own the whole lifecycle in a command

If you don't want \`luca serve\` managing things — you need custom startup order, your own signal handling, or to run both servers from a script — build the pair directly and start them together (see [Servers → Combining Servers](./06-servers.md)):

\`\`\`ts
const http = container.server('express', { port: 3000, static: './public' })
const ws = container.server('websocket', { port: 8081, json: true })
await http.useEndpoints('./endpoints')
http.app.locals.ws = ws
await Promise.all([http.start(), ws.start()])
\`\`\`

Same two-server shape; \`--setup\` is just the version where \`serve\` owns Express and you bolt the sidecar on.

## What's Next

- [Servers](./06-servers.md) — Express and WebSocket server primitives and options
- [Endpoints](./07-endpoints.md) — file-based routes served by \`luca serve\`
- [WebSocket ask-and-reply](../examples/websocket-ask-and-reply-example.md) — server↔client request/response
- [Browser: Reactive UIs](./22-reactive-frontend.md) — subscribing to the sidecar from a front-end store
`,
  "00-bootstrap.md": `---
title: "Bootstrap: Learning the Container at Runtime"
tags:
  - bootstrap
  - introspection
  - repl
  - agent
  - discovery
  - quickstart
---
# Bootstrap: Learning the Container at Runtime

You don't need to memorize the Luca API. The container tells you everything it can do — at runtime. This tutorial teaches you the discovery pattern so you can explore any feature, client, server, or command without reading docs.

## Start with \`luca eval\`

The \`eval\` command runs JavaScript with the container in scope. All features are available as top-level variables.

\`\`\`bash
# What features are available?
luca eval "container.features.available"
# => ['fs', 'git', 'proc', 'vm', 'networking', 'os', 'grep', ...]

# What clients?
luca eval "container.clients.available"

# What servers?
luca eval "container.servers.available"

# What commands?
luca eval "container.commands.available"
\`\`\`

## Describe Anything

The \`luca describe\` command generates API docs for any helper. It reads JSDoc, Zod schemas, and method signatures to produce markdown documentation.

\`\`\`bash
# Describe the container itself
luca describe

# Describe a feature
luca describe fs

# Describe multiple at once
luca describe git fs proc

# Show only specific sections
luca describe fs --methods --examples

# Describe all features
luca describe features
\`\`\`

In code, the same works via registries:

\`\`\`js
container.features.describe('fs')       // markdown docs for fs
container.features.describeAll()        // condensed overview of all features
container.clients.describe('rest')      // docs for the rest client
\`\`\`

## The Discovery Pattern

Every registry follows the same shape. Once you know the pattern, you can explore anything:

\`\`\`js
// List what's available
container.features.available
container.clients.available
container.servers.available
container.commands.available

// Get docs for a specific helper
container.features.describe('fs')
container.clients.describe('rest')
container.servers.describe('express')

// Check if something exists
container.features.has('fs')           // => true

// Get a helper instance
const fs = container.feature('fs')
const rest = container.client('rest')
\`\`\`

## Instance Introspection

Once you have a helper instance, it can describe itself:

\`\`\`js
const fs = container.feature('fs')

// Structured introspection (object with methods, getters, events, state, options)
fs.introspect()

// Human-readable markdown
fs.introspectAsText()
\`\`\`

The container itself is introspectable:

\`\`\`js
container.introspect()          // structured object with all registries, state, events
container.introspectAsText()    // full markdown overview
\`\`\`

## The REPL

For interactive exploration, use \`luca console\`. It gives you a persistent REPL with the container and all features in scope:

\`\`\`bash
luca console
\`\`\`

Inside the REPL, you can tab-complete, call methods, and explore interactively. Variables survive across lines.

## Feature Shortcuts

In eval and REPL contexts, core features are available as top-level variables — no need to call \`container.feature()\`:

\`\`\`bash
luca eval "fs.readFile('package.json')"
luca eval "git.branch"
luca eval "proc.exec('ls')"
luca eval "grep.search('.', 'TODO')"
\`\`\`

## Quick Reference

| Want to know...                | Ask                                    |
|--------------------------------|----------------------------------------|
| What registries exist?         | \`container.registries\`                 |
| What features are available?   | \`container.features.available\`         |
| Full docs for a feature?       | \`container.features.describe('fs')\`    |
| All features at a glance?      | \`container.features.describeAll()\`     |
| Structured introspection?      | \`feature.introspect()\`                 |
| What state does it have?       | \`feature.state.current\`               |
| What events does it emit?      | \`feature.introspect().events\`          |
| Full container overview?       | \`container.introspectAsText()\`            |
| CLI docs for a helper?         | \`luca describe <name>\`                 |

## Gotchas

### \`paths.join()\` vs \`paths.resolve()\`

\`container.paths.join()\` and \`container.paths.resolve()\` are Node's \`path.join\` and \`path.resolve\` curried with \`container.cwd\`. This means \`paths.join()\` always prepends \`cwd\` — even if you pass an absolute path as the first argument.

\`\`\`js
// WRONG — paths.join will prepend cwd to the absolute tmpdir path
const bad = container.paths.join(os.tmpdir, 'mydir')
// => "/your/project/tmp/mydir" (not what you want)

// RIGHT — paths.resolve respects absolute first args
const good = container.paths.resolve(os.tmpdir, 'mydir')
// => "/tmp/mydir"
\`\`\`

**Rule of thumb:** Use \`paths.join()\` for project-relative paths, \`paths.resolve()\` when the base is already absolute.

## What's Next

- [The Container](./02-container.md) — deep dive into state, events, and lifecycle
- [Scripts](./03-scripts.md) — run scripts and executable markdown notebooks
- [Features Overview](./04-features-overview.md) — explore built-in features
- [Writing Commands](./08-commands.md) — add CLI commands to your project
`,
  "22-reactive-frontend.md": `---
title: "Browser: Reactive UIs with No Build Step"
tags:
  - browser
  - esm
  - web
  - frontend
  - react
  - reactive
  - no-build
---
# Browser: Reactive UIs with No Build Step

[Tutorial 20](./20-browser-esm.md) showed you can import Luca from esm.sh and use features in the browser. This tutorial goes one step further: **build a complete, reactive front-end application** — the kind with live-updating panels, streaming data, and real state — with **no bundler, no \`npm install\`, no build step, and no framework lock-in.**

The whole thing rests on three ideas. Learn them once and you can build any UI this way.

## The three ideas

1. **esm.sh means no build.** Any npm package (React, Preact, marked, chart.js…) is importable as a URL. The browser's native ES module loader does the rest. There is no \`package.json\` for the front-end, no Webpack, no Vite, nothing to compile. You write an \`.html\` file and serve it.

2. **A Luca feature is a reactive store.** Every feature already has observable state (\`this.state.get/set\`) and an event bus (\`this.emit/.on/.off\`). That is *exactly* what a front-end store is. You don't need Redux, Zustand, or Context — the container gives you one for free, and it's the same API you use on the server.

3. **The view subscribes to the store's events.** Whatever renders the DOM — plain JavaScript, React, Preact, Vue — just listens for the feature's \`changed\` event and re-reads state. The store never knows about the view. That decoupling is the whole pattern.

Everything below is an elaboration of those three ideas.

## Prove the mechanism with plain DOM

Before any framework, here is the entire pattern in ~20 lines. A feature holds state and emits \`changed\`; a render function listens and repaints. Save as \`public/index.html\`:

\`\`\`html
<!DOCTYPE html>
<html>
<body>
  <button id="dec">−</button>
  <span id="value">0</span>
  <button id="inc">+</button>

  <script type="module">
    import container from "https://esm.sh/luca/web"
    const { Feature } = container

    class Counter extends Feature {
      static shortcut = 'features.counter'
      static { Feature.register(this, 'counter') }

      get value() { return this.state.get('value') || 0 }
      bump(by) {
        this.state.set('value', this.value + by)
        this.emit('changed')          // ← the only line the view cares about
      }
    }

    const counter = container.feature('counter')

    // The view: re-read state whenever the store changes.
    const render = () => { document.getElementById('value').textContent = counter.value }
    counter.on('changed', render)
    render()

    document.getElementById('inc').onclick = () => counter.bump(1)
    document.getElementById('dec').onclick = () => counter.bump(-1)
  </script>
</body>
</html>
\`\`\`

Serve it:

\`\`\`shell
luca serve
\`\`\`

\`luca serve\` serves \`public/\` as static files (and \`endpoints/\` as an API — more on that below). Open the URL, click the buttons. **No build step ran.** The feature is the store; \`changed\` is the signal; \`render\` is the subscriber. That is the pattern. React just makes the \`render\` half nicer.

## Add React from a URL

You do not install React. You import it. \`React.createElement\` (aliased to \`e\`) replaces JSX, so there's no compile step — this is plain JavaScript the browser runs directly.

\`\`\`html
<script type="module">
  import React from "https://esm.sh/react@18.3.1"
  import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1"
  import container from "https://esm.sh/luca/web"

  const e = React.createElement
</script>
\`\`\`

> **The one React footgun:** react-dom must use the *same* React instance. Pin both to the same version and add \`?deps=react@18.3.1\` to the react-dom URL (or use an import map — see Gotchas). Skip this and you get "Invalid hook call."

Now bridge the store to React with a tiny hook. This is not part of Luca — it's six lines you write once and reuse everywhere. It subscribes a component to any feature's \`changed\` event and forces a re-render:

\`\`\`js
// Re-render this component whenever any of the given features emit 'changed'.
function useFeatureVersion(features) {
  const [, setTick] = React.useState(0)
  React.useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    features.forEach((f) => f.on('changed', bump))
    return () => features.forEach((f) => f.off('changed', bump))
  }, features)
}
\`\`\`

The counter, now in React:

\`\`\`js
function CounterApp() {
  useFeatureVersion([counter])            // re-render on every 'changed'
  return e('div', null,
    e('button', { onClick: () => counter.bump(-1) }, '−'),
    e('span', { style: { margin: '0 1rem' } }, counter.value),
    e('button', { onClick: () => counter.bump(1) }, '+'),
  )
}

createRoot(document.getElementById('root')).render(e(CounterApp))
\`\`\`

The feature is unchanged from the plain-DOM version. Only the subscriber changed. **The store has no idea React exists** — which is why you could swap in Preact or Vue without touching it.

## Scale up: the Api / Store / App layers

A counter fits in one feature. A real app — one that fetches data, holds it, and coordinates actions — is clearest as **three features**, each with one job:

| Layer | Responsibility | Never does |
| --- | --- | --- |
| **Api** | Talk to the backend (\`fetch\`, websocket, SSE). Returns plain data. | Hold state, know about the UI |
| **Store** | Hold in-memory state. Expose getters. \`emit('changed')\` after every mutation. | Make network calls |
| **App** | Orchestrate: call Api, push results into Store, expose high-level actions (\`start()\`, \`refresh()\`). | Render |

\`\`\`js
class Api extends Feature {
  static shortcut = 'features.api'
  static { Feature.register(this, 'api') }
  get rest() { return this.container.client('rest', { baseURL: '/api' }) }
  loadTodos() { return this.rest.get('/todos') }        // returns parsed JSON directly
}

class Store extends Feature {
  static shortcut = 'features.store'
  static { Feature.register(this, 'store') }
  get todos() { return this.state.get('todos') || [] }
  setTodos(todos) { this.state.set('todos', todos); this.emit('changed') }
}

class App extends Feature {
  static shortcut = 'features.app'
  static { Feature.register(this, 'app') }
  get api() { return this.container.feature('api') }
  get store() { return this.container.feature('store') }

  async start() {
    this.state.set('loading', true); this.emit('changed')
    try {
      this.store.setTodos(await this.api.loadTodos())
    } catch (err) {
      this.state.set('error', err.message)
    }
    this.state.set('loading', false); this.emit('changed')
  }

  // One atomic read for the view — no scattered getters, no stale closures.
  snapshot() {
    return {
      loading: this.state.get('loading'),
      error: this.state.get('error'),
      todos: this.store.todos,
    }
  }
}
\`\`\`

Features compose through the container (\`this.container.feature('api')\`) — the same way server-side features depend on each other. The **\`snapshot()\` idiom** is worth adopting: the component makes one call and reads a single plain object, instead of pulling from several getters that might drift out of sync mid-render.

\`\`\`js
function TodoApp() {
  const app = container.feature('app')
  const store = container.feature('store')
  useFeatureVersion([app, store])           // subscribe to both

  const { loading, error, todos } = app.snapshot()
  if (loading) return e('p', null, 'Loading…')
  if (error) return e('p', { style: { color: 'red' } }, error)
  return e('ul', null, todos.map((t) => e('li', { key: t.id }, t.title)))
}

const app = container.feature('app')
createRoot(document.getElementById('root')).render(e(TodoApp))
app.start()                                 // kick off the initial load
\`\`\`

## The backend half: \`endpoints/\` + \`luca serve\`

\`luca serve\` serves your static \`public/\` **and** file-based routes from \`endpoints/\` on the *same origin*. Same origin means the browser makes no cross-origin request, so **there's no CORS to configure** — the Api layer just fetches \`/api/...\`.

\`\`\`ts
// endpoints/todos.ts  →  GET /api/todos
import type { EndpointContext } from 'luca'

export const path = '/api/todos'

// Handlers are (params, ctx). Return a value — it's serialized to JSON.
export async function get(_params: any, ctx: EndpointContext) {
  const db = ctx.container.feature('sqlite')       // full node container on the server
  return db.query('SELECT id, title FROM todos').all()
}
\`\`\`

\`\`\`shell
luca serve --watch        # hot-reloads endpoints on change
\`\`\`

Your browser has the *web* container (no \`fs\`, \`git\`, \`proc\`); your endpoints have the *node* container (everything). The REST client is the bridge between them. See [Endpoints](./07-endpoints.md) and [Servers](./06-servers.md) for the full API.

## Live updates

The \`changed\`-event pattern makes live data trivial — the transport pushes into the Store, the Store emits, the view repaints. Pick the transport that fits:

- **Polling** — simplest. An \`App\` timer calls \`refresh()\` every few seconds.
- **WebSocket** — \`container.client('socket', { url })\`; \`socket.on('message', …)\` pushes into the Store.
- **Server-Sent Events** — for one-way streams (LLM tokens, build logs). Read \`res.body.getReader()\` and dispatch each \`data:\` line into the Store. When parsing SSE by hand, keep the trailing partial line in a buffer across chunks (\`buffer = lines.pop()\`), or you'll drop events split across a network boundary.

In every case the view code is identical — it only ever knows about \`changed\`.

## Gotchas

- **Pin versions; esm.sh caches hard.** \`https://esm.sh/luca@3.3.3/web\`, not bare \`luca/web\`, for anything you want to be stable.
- **One React instance.** react-dom must resolve the same React as your components. Pin both versions and add \`?deps=react@VERSION\` to react-dom, or use an **import map** (cleanest when you split code across files):
  \`\`\`html
  <script type="importmap">
  { "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1",
    "luca/web": "https://esm.sh/luca@3.3.3/web"
  }}
  </script>
  \`\`\`
  Then \`import React from "react"\` resolves through the map — one instance, everywhere.
- **\`?dev\` while developing.** \`https://esm.sh/react@18.3.1?dev\` gives readable errors and warnings; drop it in production.
- **Emit \`changed\` after *every* mutation.** A forgotten \`emit\` is the #1 cause of "the state updated but the UI didn't." Centralize mutations in Store methods so the emit lives in one place.
- **Web container ≠ node container.** No \`fs\`/\`git\`/\`proc\` in the browser. Anything node-only goes behind an endpoint.
- **SPA routing.** When you serve only \`public/\` (no explicit \`--static-dir\`), \`luca serve\` enables history fallback so client-side routes resolve to \`index.html\`.

## It's framework-agnostic

Nothing above is React-specific except \`useFeatureVersion\` and \`createElement\`. The store is a plain Luca feature. Swap the view layer freely:

- **Vanilla DOM** — the first example; a \`render()\` function on \`changed\`.
- **Preact** — identical to the React code; import from \`https://esm.sh/preact@10/compat\`.
- **Vue / Svelte / lit** — subscribe their reactivity primitive to the feature's \`changed\` event.

The durable skill is the pattern — *a feature is your reactive store; the view subscribes to its events* — not any one library.

## What's Next

- [Browser: Import Luca from esm.sh](./20-browser-esm.md) — the feature/state/event basics this builds on
- [Endpoints](./07-endpoints.md) — file-based API routes served by \`luca serve\`
- [Servers](./06-servers.md) — the Express server, static serving, and CORS options
- [State and Events](./05-state-and-events.md) — the state machine and event bus, in depth
- [Creating Features](./10-creating-features.md) — full feature anatomy (schemas, lifecycle, events)
`,
  "08-commands.md": `---
title: Writing Commands
tags: [commands, cli, luca-cli, scripts, args]
---

# Writing Commands

Commands are CLI actions that the \`luca\` command discovers and runs. They are Helper subclasses under the hood — the framework grafts your module exports into a proper Command class at runtime, so you get the full Helper lifecycle (state, events, introspection) without ceremony.

## Basic Command

\`\`\`typescript
// commands/seed.ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const description = 'Seed the database with sample data'

export const argsSchema = z.object({
  count: z.number().default(10).describe('Number of records to seed'),
  table: z.string().optional().describe('Specific table to seed'),
})

export default async function seed(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  console.log(\`Seeding \${options.count} records...\`)

  for (let i = 0; i < options.count; i++) {
    console.log(\`  Created record \${i + 1}\`)
  }

  console.log('Done.')
}
\`\`\`

Run it:

\`\`\`bash
luca seed --count 20 --table users
\`\`\`

## How Discovery Works

When you run \`luca <command>\`, the CLI:

1. Loads built-in commands (serve, run, eval, describe, etc.)
2. Loads \`luca.cli.ts\` if present (for project-level container customization)
3. Discovers project commands via the \`helpers\` feature — scans \`commands/\` for \`.ts\` files
4. Discovers user commands from \`~/.luca/commands/\`
5. The filename becomes the command name: \`commands/seed.ts\` → \`luca seed\`

Discovery routes through the \`helpers\` feature (\`container.feature('helpers')\`), which handles native import vs VM loading and deduplicates concurrent discovery calls. Commands loaded through the VM get \`container\` injected as a global.

The \`LUCA_COMMAND_DISCOVERY\` env var controls discovery: \`"disable"\` skips all, \`"no-local"\` skips project, \`"no-home"\` skips user commands.

## Command Module Patterns

### Pattern 1: Default Export Function (recommended for project commands)

The simplest pattern — export a default async function. The function becomes the command's \`run\` method.

\`\`\`typescript
// commands/greet.ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const description = 'Greet someone'
export const argsSchema = z.object({
  name: z.string().default('world').describe('Who to greet'),
})

export default async function greet(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  console.log(\`Hello, \${options.name}!\`)
}
\`\`\`

### Pattern 2: Object Default Export with handler

Useful when you want to co-locate all exports in one object:

\`\`\`typescript
// commands/deploy.ts
import { z } from 'zod'
import type { ContainerContext } from 'luca'

export const argsSchema = z.object({
  env: z.enum(['staging', 'production']).describe('Target environment'),
  dryRun: z.boolean().default(false).describe('Preview without deploying'),
})

async function deploy(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  if (options.dryRun) {
    console.log(\`[DRY RUN] Would deploy to \${options.env}\`)
    return
  }
  console.log(\`Deploying \${container.git.sha} to \${options.env}...\`)
}

export default {
  description: 'Deploy the application',
  argsSchema,
  handler: deploy,
}
\`\`\`

### Pattern 3: registerHandler (used by built-in commands)

Built-in commands use \`commands.registerHandler()\` for explicit registration. This is the pattern used in \`src/commands/\`:

\`\`\`typescript
// src/commands/my-builtin.ts
import { z } from 'zod'
import { commands } from '../command'
import { CommandOptionsSchema } from '../schemas/base'
import type { ContainerContext } from '../container'

declare module '../command.js' {
  interface AvailableCommands {
    'my-builtin': ReturnType<typeof commands.registerHandler>
  }
}

export const argsSchema = CommandOptionsSchema.extend({
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})

export default async function myBuiltin(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  // implementation
}

commands.registerHandler('my-builtin', {
  description: 'A built-in command',
  argsSchema,
  handler: myBuiltin,
})
\`\`\`

Project commands generally don't need \`registerHandler\` — discovery handles registration automatically.

## Module Exports Reference

| Export | Type | Description |
|--------|------|-------------|
| \`default\` | function or object | Async function becomes \`run\`, or object with \`{ description, argsSchema, handler }\` |
| \`description\` | string | Help text shown in \`luca --help\` |
| \`argsSchema\` | Zod schema | Defines accepted flags, parsed from CLI args automatically |
| \`positionals\` | string[] | Names for positional arguments (mapped from \`container.argv._\`) |
| \`run\` | function | Named export alternative to default function — grafted as the command's run method |
| \`handler\` | function | Legacy alternative to \`run\` — receives parsed args via \`parseArgs()\` |

When discovery loads your module, \`graftModule()\` synthesizes a Command subclass from these exports. The \`run\` or \`handler\` function becomes the command's implementation, schemas become static properties, and any other exported functions become methods on the command instance.

## Arguments and Schemas

The \`argsSchema\` uses Zod to define what flags your command accepts. These are parsed from the CLI automatically:

\`\`\`typescript
export const argsSchema = z.object({
  // String flag: --name "John"
  name: z.string().describe('User name'),

  // Number flag: --port 3000
  port: z.number().default(3000).describe('Port number'),

  // Boolean flag: --verbose
  verbose: z.boolean().default(false).describe('Enable verbose logging'),

  // Optional flag: --output file.json
  output: z.string().optional().describe('Output file path'),

  // Enum flag: --format json
  format: z.enum(['json', 'csv', 'table']).default('table').describe('Output format'),
})
\`\`\`

### Positional Arguments

Export a \`positionals\` array to map CLI positional args into named fields on \`options\`. Each entry names the corresponding positional — \`positionals[0]\` maps \`_[1]\` (the first arg after the command name), \`positionals[1]\` maps \`_[2]\`, etc.

\`\`\`typescript
export const positionals = ['target', 'destination']

export const argsSchema = z.object({
  target: z.string().describe('Source path to operate on'),
  destination: z.string().optional().describe('Where to write output'),
})

// luca my-command ./src ./out
// => options.target === './src', options.destination === './out'
\`\`\`

Positional mapping only applies when dispatched from the CLI. For programmatic dispatch (\`cmd.dispatch({ target: './src' }, 'headless')\`), args are already named.

The raw positional array is still available as \`options._\` if you need it — \`_[0]\` is always the command name:

\`\`\`typescript
// luca greet Alice Bob
// options._ => ['greet', 'Alice', 'Bob']
\`\`\`

## Using the Container

Commands receive a context with the full container:

\`\`\`typescript
export default async function handler(options: any, context: ContainerContext) {
  const { container } = context

  // File system operations
  const config = container.fs.readJson('./config.json')

  // Git info (these are getters, not methods)
  const branch = container.git.branch
  const sha = container.git.sha

  // Terminal UI
  container.ui.colors.green('Success!')

  // Run external processes (synchronous, returns string)
  const result = container.proc.exec('ls -la')

  // Use any feature
  const cache = container.feature('diskCache', { path: './.cache' })
}
\`\`\`

## Command Dispatch

When the CLI runs a command, it calls \`cmd.dispatch()\` which:

1. Reads raw input from \`container.argv\` (or explicit args if called programmatically)
2. Validates args against \`argsSchema\` if present
3. Maps positional args if \`positionals\` is declared
4. Intercepts \`--help\` to show auto-generated help text
5. Calls \`run(parsedOptions, context)\` with the validated, typed options

You can also dispatch commands programmatically:

\`\`\`typescript
const cmd = container.command('seed')
await cmd.dispatch({ count: 20, table: 'users' }, 'headless')
\`\`\`

## Conventions

- **File location**: \`commands/<name>.ts\` in the project root. Auto-discovered by the CLI.
- **Naming**: kebab-case filenames. \`commands/build-site.ts\` → \`luca build-site\`.
- **Use the container**: Never import \`fs\`, \`path\`, \`child_process\` directly. Use \`container.feature('fs')\`, \`container.paths\`, \`container.feature('proc')\`.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI catches and reports them.
- **Help text**: Use \`.describe()\` on every schema field — it powers \`luca <command> --help\`.
`,
  "14-type-system.md": `---
title: Type System and Module Augmentation
tags: [types, typescript, zod, module-augmentation, schemas, type-safety]
---

# Type System and Module Augmentation

Luca's type system ensures that as you add features, clients, servers, and commands, the container's factory methods stay fully typed. This is powered by Zod schemas and TypeScript module augmentation.

## The Pattern

When you register a new helper, you augment the corresponding interface so TypeScript knows about it:

\`\`\`typescript
import { Feature, features, FeatureStateSchema, FeatureOptionsSchema } from 'luca'
import { z } from 'zod'

// 1. Define your feature
export class MyCache extends Feature<MyCacheState, MyCacheOptions> {
  // ...
}

// 2. Register it
features.register('myCache', MyCache)

// 3. Augment the interface
declare module 'luca' {
  interface AvailableFeatures {
    myCache: typeof MyCache
  }
}

// 4. Now fully typed everywhere:
const cache = container.feature('myCache', { ttl: 3600 })
//    ^-- TypeScript knows this is MyCache
//                                  ^-- autocomplete for MyCache options
\`\`\`

## Zod Schemas = Types + Runtime Validation

Every schema you define gives you both compile-time types and runtime validation:

\`\`\`typescript
// Define once with Zod
export const UserOptionsSchema = FeatureOptionsSchema.extend({
  apiKey: z.string().describe('API key for authentication'),
  timeout: z.number().default(5000).describe('Request timeout in ms'),
  retries: z.number().default(3).describe('Max retry attempts'),
})

// Extract the type
export type UserOptions = z.infer<typeof UserOptionsSchema>

// Use for static typing
export class UserService extends Feature<UserState, UserOptions> {
  static override optionsSchema = UserOptionsSchema

  connect() {
    // this.options is typed: { apiKey: string, timeout: number, retries: number }
    const { apiKey, timeout } = this.options
  }
}
\`\`\`

The schema also powers:
- **Runtime validation** when options are passed to the factory
- **Introspection** -- \`.describe()\` text appears in \`helper.introspect()\`
- **Documentation** -- field descriptions appear in \`container.features.describe('userService')\`

## State Typing

\`\`\`typescript
const TaskStateSchema = FeatureStateSchema.extend({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
  })).default([]),
  filter: z.enum(['all', 'active', 'done']).default('all'),
})

type TaskState = z.infer<typeof TaskStateSchema>

class TaskManager extends Feature<TaskState> {
  static override stateSchema = TaskStateSchema

  addTask(title: string) {
    const tasks = this.state.get('tasks')
    //    ^-- typed as Array<{ id: string, title: string, done: boolean }>

    this.state.set('tasks', [...(tasks || []), { id: '1', title, done: false }])
    //                       ^-- TypeScript validates the shape
  }
}
\`\`\`

## Module Augmentation for All Helper Types

The pattern is the same for features, clients, servers, and commands:

\`\`\`typescript
// Features
declare module 'luca' {
  interface AvailableFeatures {
    myFeature: typeof MyFeature
  }
}

// Clients
declare module 'luca' {
  interface AvailableClients {
    myClient: typeof MyClient
  }
}

// Servers
declare module 'luca' {
  interface AvailableServers {
    myServer: typeof MyServer
  }
}

// Commands
declare module 'luca' {
  interface AvailableCommands {
    myCommand: typeof MyCommand
  }
}
\`\`\`

## Using .describe() Effectively

\`\`\`typescript
const ConfigSchema = z.object({
  host: z.string().describe('Database hostname or IP address'),
  port: z.number().default(5432).describe('Database port'),
  database: z.string().describe('Database name to connect to'),
  ssl: z.boolean().default(false).describe('Whether to use SSL/TLS for the connection'),
  pool: z.object({
    min: z.number().default(2).describe('Minimum connections to keep open'),
    max: z.number().default(10).describe('Maximum connections allowed'),
  }).describe('Connection pool configuration'),
})
\`\`\`

These descriptions are not just for humans reading the code -- they show up in:
- \`container.features.describe('db')\` output
- \`container.features.introspect('db')\` data
- OpenAPI specs when used in endpoint schemas
- AI agent tool descriptions

## The Full Typed Flow

\`\`\`typescript
// 1. You define a feature with schemas
export class Analytics extends Feature<AnalyticsState, AnalyticsOptions> { ... }

// 2. You register + augment
features.register('analytics', Analytics)
declare module 'luca' {
  interface AvailableFeatures { analytics: typeof Analytics }
}

// 3. Now every interaction is typed:
const a = container.feature('analytics', { trackingId: 'UA-123' })
//    ^-- Analytics instance     ^-- autocomplete: 'analytics'
//                                         ^-- type error if wrong options

a.state.get('pageViews')  // typed by AnalyticsState
a.on('pageView', ...)     // typed by event definitions
a.track('click', { ... }) // typed by Analytics methods
\`\`\`

This is the core principle: **never break the type system.** Every step of \`container.feature('name', options)\` should give you autocomplete, type checking, and documentation.
`,
  "02-container.md": `---
title: The Container
tags: [container, singleton, state, events, registries, dependency-injection]
---

# The Container

The container is the heart of every Luca application. It is a per-process singleton that provides:

- **Dependency injection** via factory methods and registries
- **Observable state** that you can watch for changes
- **Event bus** for decoupled communication
- **Registries** for discovering available helpers

## Getting the Container

\`\`\`typescript
import container from 'luca'
\`\`\`

The import resolves automatically based on environment -- \`luca\` gives you a \`NodeContainer\` on the server and a \`WebContainer\` in browser builds. You can also be explicit:

\`\`\`typescript
import container from 'luca/node'  // Always NodeContainer
import container from 'luca/web'   // Always WebContainer
\`\`\`

The NodeContainer comes pre-loaded with registries for features, clients, servers, commands, and endpoints. Core features like \`fs\`, \`git\`, \`proc\`, \`os\`, \`networking\`, \`ui\`, and \`vm\` are auto-enabled.

## Registries

Every helper type has a registry. Registries let you discover what's available and create instances:

\`\`\`typescript
// What features are available?
container.features.available
// => ['fs', 'git', 'proc', 'vm', 'ui', 'networking', 'os', 'diskCache', 'contentDb', ...]

// Get documentation for a feature
container.features.describe('fs')

// Get documentation for all features
container.features.describeAll()

// Check if something is registered
container.features.has('diskCache')

// Same pattern for all helper types:
container.servers.available    // ['express', 'websocket']
container.clients.available    // ['rest', 'graph', 'websocket']
container.commands.available   // ['serve', 'run', ...]
\`\`\`

## Factory Methods

Create helper instances through the container's factory methods:

\`\`\`typescript
// Features (cached by id + options hash)
const fs = container.feature('fs')
const cache = container.feature('diskCache', { path: './cache' })

// Servers
const server = container.server('express', { port: 3000, cors: true })

// Clients
const api = container.client('rest', { baseURL: 'https://api.example.com' })
\`\`\`

Factory results are **cached**. Calling \`container.feature('fs')\` twice returns the same instance. Different options produce different instances.

## Enabled Features (Shortcuts)

Some features are "enabled" on the container, giving them shortcut access:

\`\`\`typescript
// These are equivalent:
container.feature('fs')
container.fs

// Auto-enabled features:
container.fs           // File system
container.git          // Git operations
container.proc         // Process execution
container.vm           // JavaScript VM
container.ui           // Terminal UI
container.os           // OS info
container.networking   // Port finding, availability
\`\`\`

To enable your own feature:

\`\`\`typescript
const myFeature = container.feature('myFeature', { enable: true })
// Now accessible as container.myFeature
\`\`\`

## Observable State

The container (and every helper) has observable state:

\`\`\`typescript
// Set state
container.state.set('ready', true)

// Get state
container.state.get('ready') // true

// Get a snapshot of all state
container.state.current

// Observe all changes (changeType is 'add' | 'update' | 'delete')
container.state.observe((changeType, key, value) => {
  console.log(\`\${key} \${changeType}:\`, value)
})

// State has a version counter
container.state.version // increments on every change
\`\`\`

## Event Bus

The container has a built-in event bus for decoupled communication:

\`\`\`typescript
// Listen for events
container.on('featureEnabled', (featureName) => {
  console.log(\`\${featureName} was enabled\`)
})

// Emit events
container.emit('myCustomEvent', { some: 'data' })

// One-time listener
container.once('ready', () => console.log('Container is ready'))

// Wait for an event (promise-based)
await container.waitFor('ready')
\`\`\`

## Plugins and \`.use()\`

Extend the container with the \`.use()\` method:

\`\`\`typescript
// Enable a feature by name
container.use('diskCache')

// Attach a plugin
container.use(MyPlugin)
\`\`\`

A plugin is any class with a static \`attach(container)\` method:

\`\`\`typescript
class MyPlugin {
  static attach(container) {
    // Add registries, factories, whatever you need
    container.myThing = new MyThing(container)
    return container
  }
}
\`\`\`

## Utilities

The container provides common utilities so you don't need extra dependencies:

\`\`\`typescript
container.utils.uuid()                          // Generate a v4 UUID
container.utils.hashObject({ foo: 'bar' })      // Deterministic hash
container.utils.stringUtils.camelCase('my-var')  // 'myVar'
container.utils.stringUtils.kebabCase('MyVar')   // 'my-var'
container.utils.stringUtils.pluralize('feature') // 'features'

// Lodash utilities
const { uniq, groupBy, keyBy, debounce, throttle } = container.utils.lodash
\`\`\`

## Path Utilities

\`\`\`typescript
container.paths.resolve('relative/path')    // Resolve from cwd
container.paths.join('a', 'b', 'c')         // Join path segments
container.paths.relative('/absolute/path')  // Make relative to cwd
\`\`\`

## Package Manifest

Access the project's package.json:

\`\`\`typescript
container.manifest.name        // "my-app"
container.manifest.version     // "0.1.0"
container.manifest.dependencies
\`\`\`

## Introspection

Discover everything about the container at runtime:

\`\`\`typescript
// Structured introspection data
const info = container.introspect()

// Human-readable markdown
const docs = container.introspectAsText()
\`\`\`

This is what makes Luca especially powerful for AI agents -- they can discover the entire API surface at runtime without reading documentation.
`,
  "20-browser-esm.md": `---
title: "Browser: Import Luca from esm.sh"
tags:
  - browser
  - esm
  - web
  - quickstart
  - cdn
---
# Browser: Import Luca from esm.sh

You can use Luca in any browser environment — no bundler, no build step. Import it from [esm.sh](https://esm.sh) and you get the singleton container on \`window.luca\`, ready to go. All the same APIs apply.

## Basic Setup

\`\`\`html
<script type="module">
  import "https://esm.sh/luca/web"

  const container = window.luca
  console.log(container.uuid) // unique container ID
  console.log(container.features.available) // ['assetLoader', 'voice', 'speech', 'network', 'vault', 'vm', 'esbuild', 'helpers', 'containerLink']
</script>
\`\`\`

The import triggers module evaluation, which creates the \`WebContainer\` singleton and attaches it to \`window.luca\`. That's it.

If you prefer a named import:

\`\`\`html
<script type="module">
  import container from "https://esm.sh/luca/web"
  // container === window.luca
</script>
\`\`\`

## Using Features

Once you have the container, features work exactly like they do on the server — lazy-loaded via \`container.feature()\`.

\`\`\`html
<script type="module">
  import "https://esm.sh/luca/web"
  const { luca: container } = window

  // Load a script from a CDN
  const assetLoader = container.feature('assetLoader')
  await assetLoader.loadScript('https://cdn.jsdelivr.net/npm/chart.js')

  // Load a stylesheet
  await assetLoader.loadStylesheet('https://cdn.jsdelivr.net/npm/water.css@2/out/water.css')

  // Text-to-speech
  const speech = container.feature('speech')
  speech.speak('Hello from Luca')

  // Voice recognition
  const voice = container.feature('voice')
  voice.on('transcript', ({ text }) => console.log('Heard:', text))
  voice.start()
</script>
\`\`\`

## State and Events

The container is a state machine and event bus. This works identically to the server.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/luca/web"

  // Listen for state changes
  container.on('stateChanged', ({ changes }) => {
    console.log('State changed:', changes)
  })

  // Feature-level state and events
  const voice = container.feature('voice')
  voice.on('stateChanged', ({ changes }) => {
    document.getElementById('status').textContent = changes.listening ? 'Listening...' : 'Idle'
  })
</script>
\`\`\`

## REST Client

Make HTTP requests with the built-in REST client. Methods return parsed JSON directly.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/luca/web"

  const api = container.client('rest', { baseURL: 'https://jsonplaceholder.typicode.com' })
  const posts = await api.get('/posts')
  console.log(posts) // array of post objects, not a Response wrapper
</script>
\`\`\`

## WebSocket Client

Connect to a WebSocket server:

\`\`\`html
<script type="module">
  import container from "https://esm.sh/luca/web"

  const socket = container.client('socket', { url: 'ws://localhost:3000' })
  socket.on('message', (data) => console.log('Received:', data))
  socket.send({ type: 'hello' })
</script>
\`\`\`

## Extending: Custom Features

The container exposes the \`Feature\` class directly, so you can create your own features without any additional imports.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/luca/web"

  const { Feature } = container

  class Theme extends Feature {
    static shortcut = 'features.theme'
    static { Feature.register(this, 'theme') }

    get current() {
      return this.state.get('mode') || 'light'
    }

    toggle() {
      const next = this.current === 'light' ? 'dark' : 'light'
      this.state.set('mode', next)
      document.documentElement.setAttribute('data-theme', next)
      this.emit('themeChanged', { mode: next })
    }
  }

  const theme = container.feature('theme')
  theme.on('themeChanged', ({ mode }) => console.log('Theme:', mode))
  theme.toggle() // => Theme: dark
</script>
\`\`\`

## Utilities

The container's built-in utilities are available in the browser too.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/luca/web"

  // UUID generation
  const id = container.utils.uuid()

  // Lodash helpers
  const { groupBy, keyBy, pick } = container.utils.lodash

  // String utilities
  const { camelCase, kebabCase } = container.utils.stringUtils
</script>
\`\`\`

## Full Example: A Minimal App

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Luca Browser Demo</title>
</head>
<body>
  <h1>Luca Browser Demo</h1>
  <button id="speak">Speak</button>
  <button id="theme">Toggle Theme</button>
  <pre id="output"></pre>

  <script type="module">
    import container from "https://esm.sh/luca/web"

    const log = (msg) => {
      document.getElementById('output').textContent += msg + '\\n'
    }

    // Load a stylesheet
    const assets = container.feature('assetLoader')
    await assets.loadStylesheet('https://cdn.jsdelivr.net/npm/water.css@2/out/water.css')

    // Custom feature
    const { Feature } = container

    class Theme extends Feature {
      static shortcut = 'features.theme'
      static { Feature.register(this, 'theme') }

      toggle() {
        const next = (this.state.get('mode') || 'light') === 'light' ? 'dark' : 'light'
        this.state.set('mode', next)
        document.documentElement.style.colorScheme = next
        this.emit('themeChanged', { mode: next })
      }
    }

    const theme = container.feature('theme')
    theme.on('themeChanged', ({ mode }) => log(\`Theme: \${mode}\`))

    // Speech
    const speech = container.feature('speech')

    document.getElementById('speak').onclick = () => speech.speak('Hello from Luca')
    document.getElementById('theme').onclick = () => theme.toggle()

    log(\`Container ID: \${container.uuid}\`)
    log(\`Features: \${container.features.available.join(', ')}\`)
  </script>
</body>
</html>
\`\`\`

Save this as an HTML file, open it in a browser, and everything works — no npm, no bundler, no build step.

## Gotchas

- **esm.sh caches aggressively.** Pin a version if you need stability: \`https://esm.sh/luca@0.0.29/web\`
- **Browser features only.** The web container doesn't include node-specific features like \`fs\`, \`git\`, \`proc\`, or \`docker\`. If you need server features, run Luca on the server and connect via the REST or WebSocket clients.
- **\`window.luca\` is the singleton.** Don't call \`createContainer()\` — it just warns and returns the same instance. If you need isolation, use \`container.subcontainer()\`.
- **CORS applies.** REST client requests from the browser are subject to browser CORS rules. Your API must send the right headers.

## What's Next

- [State and Events](./05-state-and-events.md) — deep dive into the state machine and event bus (works identically in the browser)
- [Creating Features](./10-creating-features.md) — full anatomy of a feature with schemas, state, and events
- [Clients](./09-clients.md) — REST and WebSocket client APIs
`,
  "15-project-patterns.md": `---
title: Project Patterns and Recipes
tags: [patterns, recipes, examples, architecture, full-stack, best-practices]
---

# Project Patterns and Recipes

Common patterns for building applications with Luca.

## Pattern: REST API with File-Based Routing

The most common Luca project -- a JSON API with automatic OpenAPI docs.

\`\`\`
my-api/
├── package.json
├── endpoints/
│   ├── health.ts
│   ├── users.ts
│   └── users/[id].ts
├── commands/
│   └── seed.ts
└── public/
    └── index.html
\`\`\`

\`\`\`json
// package.json
{
  "name": "my-api",
  "scripts": {
    "dev": "luca serve",
    "seed": "luca seed"
  },
  "dependencies": {
    "luca": "latest",
    "zod": "^3.24.0"
  }
}
\`\`\`

Start with \`bun run dev\`. OpenAPI spec auto-generated at \`/openapi.json\`.

## Pattern: CLI Tool

A project that's primarily a set of CLI commands.

\`\`\`
my-tool/
├── package.json
├── commands/
│   ├── init.ts
│   ├── build.ts
│   ├── deploy.ts
│   └── status.ts
└── lib/
    └── helpers.ts
\`\`\`

\`\`\`bash
luca init --template react
luca build --minify
luca deploy --env production
luca status
\`\`\`

## Pattern: AI-Powered App

An API with an AI assistant behind it.

\`\`\`
ai-app/
├── package.json
├── endpoints/
│   ├── health.ts
│   ├── ask.ts           # Proxies to the assistant
│   └── conversations.ts # List/manage conversations
├── assistants/
│   └── helper/
│       ├── CORE.md
│       ├── tools.ts
│       ├── hooks.ts
│       └── docs/
│           ├── product-info.md
│           ├── faq.md
│           └── policies.md
└── public/
    └── index.html       # Chat UI
\`\`\`

The endpoint creates the assistant and forwards questions:

\`\`\`typescript
// endpoints/ask.ts
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/ask'
export const postSchema = z.object({
  question: z.string(),
  conversationId: z.string().optional(),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const assistant = ctx.container.feature('assistant', {
    folder: 'assistants/helper',
    model: 'gpt-4o',
  })

  const answer = await assistant.ask(params.question)
  return { answer }
}
\`\`\`

## Pattern: Content-Driven Site

Using contentbase to power a documentation site or blog.

\`\`\`
docs-site/
├── package.json
├── content/
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── configuration.md
│   │   └── deployment.md
│   └── reference/
│       ├── api.md
│       └── cli.md
├── endpoints/
│   ├── docs.ts          # Query and serve content
│   └── search.ts        # Full-text search over content
└── public/
    └── index.html
\`\`\`

\`\`\`typescript
// endpoints/docs.ts
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/docs'
export const getSchema = z.object({
  section: z.string().optional(),
})

export async function get(params: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const db = ctx.container.feature('contentDb', { rootPath: './content' })
  await db.load()
  // ... query and return content
}
\`\`\`

## Pattern: Automation Script Suite

A collection of scripts for DevOps or data tasks.

\`\`\`
automation/
├── package.json
├── scripts/
│   ├── backup-db.ts
│   ├── sync-data.ts
│   ├── generate-report.ts
│   └── cleanup-old-files.ts
└── config.json
\`\`\`

\`\`\`bash
luca run scripts/backup-db.ts
luca run scripts/sync-data.ts --since 2024-01-01
luca run scripts/generate-report.ts --format pdf
\`\`\`

## Pattern: Feature Composition

Build complex features by composing simpler ones:

\`\`\`typescript
class NotificationService extends Feature<NotifState, NotifOptions> {
  private cache: any
  private api: any

  async initialize() {
    // Compose other features
    this.cache = this.container.feature('diskCache', { path: './.notif-cache' })
    this.api = this.container.client('rest', {
      baseURL: this.options.webhookUrl,
    })
    await this.api.connect()
  }

  async send(channel: string, message: string) {
    // Check rate limiting via cache
    const key = \`ratelimit:\${channel}\`
    if (await this.cache.has(key)) {
      this.emit('rateLimited', { channel })
      return
    }

    // Send via API client
    await this.api.post('/send', { channel, message })
    await this.cache.set(key, true, { ttl: 60 })

    this.emit('sent', { channel, message })
  }
}
\`\`\`

## Best Practices

1. **Use file-based conventions** -- endpoints in \`endpoints/\`, commands in \`commands/\`, assistants in \`assistants/\`. This is the Luca way.

2. **Let the container own your dependencies** -- instead of importing libraries directly, use features and clients. This gives you introspection, state management, and events for free.

3. **Keep endpoints thin** -- endpoints should validate input and delegate to features. Business logic belongs in features, not route handlers.

4. **Compose features** -- build complex behavior by combining simpler features. Each feature should do one thing well.

5. **Use Zod everywhere** -- for endpoint schemas, feature options, state definitions. It gives you types, validation, and documentation in one place.

6. **Document with JSDoc** -- Luca's introspection system extracts it. Your documentation IS your code.
`,
  "05-state-and-events.md": `---
title: State and Events
tags: [state, events, observable, reactive, bus, emit, on, once, waitFor]
---

# State and Events

Every container and helper in Luca has observable state and a typed event bus. These are the core primitives for building reactive applications.

## Observable State

State is a key-value store that notifies observers when values change.

### Basic Usage

\`\`\`typescript
// Every helper has state
const feature = container.feature('myFeature')

feature.state.set('loading', true)
feature.state.get('loading')      // true
feature.state.current              // Snapshot: { loading: true, ... }
feature.state.version              // Number, increments on every change
\`\`\`

### Observing Changes

\`\`\`typescript
// Watch all state changes
const dispose = feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
  console.log(\`\${key} was \${changeType}d:\`, value)
})

// Later, stop observing
dispose()
\`\`\`

### Container State

The container itself tracks important state:

\`\`\`typescript
container.state.get('started')           // boolean
container.state.get('enabledFeatures')   // string[]
container.state.get('registries')        // string[]
\`\`\`

### State in Custom Features

Define your feature's state shape with a Zod schema:

\`\`\`typescript
const TaskStateSchema = FeatureStateSchema.extend({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
  })).default([]).describe('List of tasks'),
  filter: z.enum(['all', 'active', 'done']).default('all').describe('Current filter'),
})

class TaskManager extends Feature<z.infer<typeof TaskStateSchema>> {
  static override stateSchema = TaskStateSchema

  addTask(title: string) {
    const tasks = this.state.get('tasks') || []
    const task = { id: crypto.randomUUID(), title, done: false }
    this.state.set('tasks', [...tasks, task])
    this.emit('taskAdded', task)
  }

  get activeTasks() {
    return (this.state.get('tasks') || []).filter(t => !t.done)
  }
}
\`\`\`

## Event Bus

The event bus enables decoupled communication between components.

### Emitting and Listening

\`\`\`typescript
// Listen for an event
feature.on('taskCompleted', (task) => {
  console.log(\`Task "\${task.title}" is done!\`)
})

// Emit an event
feature.emit('taskCompleted', { id: '1', title: 'Write docs', done: true })
\`\`\`

### One-Time Listeners

\`\`\`typescript
feature.once('initialized', () => {
  console.log('Feature is ready (this runs once)')
})
\`\`\`

### Waiting for Events (Promise-Based)

\`\`\`typescript
// Block until an event fires
await feature.waitFor('ready')
console.log('Feature is now ready')

// Useful for initialization sequences
const server = container.server('express', { port: 3000 })
await server.start()
console.log('Server is accepting connections on port', server.state.get('port'))
\`\`\`

### Container Events

The container emits events for lifecycle moments:

\`\`\`typescript
container.on('featureEnabled', (featureId, feature) => {
  console.log(\`Feature \${featureId} was enabled\`)
})
\`\`\`

## Patterns

### Coordinating Between Features

\`\`\`typescript
const auth = container.feature('auth')
const analytics = container.feature('analytics')

// Analytics reacts to auth events
auth.on('userLoggedIn', (user) => {
  analytics.logEvent('login', { userId: user.id })
})

auth.on('userLoggedOut', (user) => {
  analytics.logEvent('logout', { userId: user.id })
})
\`\`\`

### State-Driven UI Updates

\`\`\`typescript
const cart = container.feature('cart')

cart.state.observe((type, key, value) => {
  if (key === 'items') {
    renderCartBadge(value.length)
  }
  if (key === 'total') {
    renderCartTotal(value)
  }
})
\`\`\`

### Initialization Gates

\`\`\`typescript
// Wait for multiple features to be ready
await Promise.all([
  container.feature('db').waitFor('connected'),
  container.feature('cache').waitFor('ready'),
  container.feature('auth').waitFor('initialized'),
])

console.log('All systems ready, starting server...')
await container.server('express', { port: 3000 }).start()
\`\`\`
`,
  "11-contentbase.md": `---
title: Contentbase - Markdown as a Database
tags: [contentbase, contentdb, markdown, database, models, query, collections]
---

# Contentbase - Markdown as a Database

Contentbase lets you treat folders of markdown files as queryable database collections. Define models with Zod schemas, extract structured data from frontmatter and content, and query it with a fluent API.

## Setup

\`\`\`typescript
import container from 'luca'

const db = container.feature('contentDb', { rootPath: './content' })
const { defineModel, section, hasMany, belongsTo } = db.library
\`\`\`

## Directory Structure

\`\`\`
content/
├── posts/
│   ├── hello-world.md
│   ├── getting-started.md
│   └── advanced-tips.md
├── authors/
│   ├── alice.md
│   └── bob.md
└── tags/
    ├── javascript.md
    └── typescript.md
\`\`\`

## Defining Models

Models map to subdirectories and define the shape of your content:

\`\`\`typescript
import { z } from 'zod'

const Post = defineModel('Post', {
  // Maps to content/posts/
  prefix: 'posts',

  // Frontmatter schema
  meta: z.object({
    title: z.string(),
    date: z.string(),
    status: z.enum(['draft', 'published', 'archived']),
    author: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),

  // Extract structured data from the markdown body
  sections: {
    summary: section('Summary', {
      extract: (query) => query.select('paragraph')?.toString() || '',
      schema: z.string(),
    }),
    codeExamples: section('Code Examples', {
      extract: (query) => query.selectAll('code').map((n: any) => n.toString()),
      schema: z.array(z.string()),
    }),
  },

  // Relationships
  relationships: {
    author: belongsTo(() => Author, { key: 'meta.author' }),
    tags: hasMany(() => Tag, { heading: 'Tags' }),
  },
})

const Author = defineModel('Author', {
  prefix: 'authors',
  meta: z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['writer', 'editor', 'admin']),
  }),
  relationships: {
    posts: hasMany(() => Post, { foreignKey: 'meta.author' }),
  },
})
\`\`\`

## Registering and Loading

\`\`\`typescript
db.register(Post)
db.register(Author)
await db.load()  // Parses all markdown files and builds the queryable index
\`\`\`

## Querying

Contentbase provides a fluent query API:

\`\`\`typescript
// Fetch all posts
const allPosts = await db.query(Post).fetchAll()

// Filter by frontmatter fields
const published = await db.query(Post)
  .where('meta.status', 'published')
  .fetchAll()

// Multiple filters
const recentPosts = await db.query(Post)
  .where('meta.status', 'published')
  .where('meta.tags', 'includes', 'javascript')
  .fetchAll()

// Get a single document by slug (filename without .md)
const post = await db.query(Post).find('hello-world')
\`\`\`

## Markdown File Format

Each markdown file has YAML frontmatter and a body:

\`\`\`markdown
---
title: Hello World
date: 2024-01-15
status: published
author: alice
tags: [javascript, tutorial]
---

# Hello World

This is the post content.

## Summary

A brief introduction to our blog.

## Code Examples

\\\`\\\`\\\`javascript
console.log('Hello!')
\\\`\\\`\\\`
\`\`\`

## Use Cases

- **Documentation sites** -- query and render docs with frontmatter metadata
- **Blog engines** -- posts with authors, tags, categories
- **Knowledge bases** -- structured content with relationships
- **Project management** -- epics, stories, tasks as markdown with status tracking
- **Configuration** -- human-readable config files that are also queryable

## Full Example: Blog Engine

\`\`\`typescript
import container from 'luca'
import { z } from 'zod'

const db = container.feature('contentDb', { rootPath: './blog' })
const { defineModel, section, hasMany } = db.library

const Post = defineModel('Post', {
  prefix: 'posts',
  meta: z.object({
    title: z.string(),
    date: z.string(),
    status: z.enum(['draft', 'published']),
    tags: z.array(z.string()).default([]),
  }),
  sections: {
    excerpt: section('Excerpt', {
      extract: (q) => q.select('paragraph')?.toString() || '',
      schema: z.string(),
    }),
  },
})

db.register(Post)
await db.load()

// Get published posts for the homepage
const posts = await db.query(Post)
  .where('meta.status', 'published')
  .fetchAll()

for (const post of posts) {
  console.log(\`\${post.meta.title} (\${post.meta.date})\`)
  console.log(\`  \${post.sections.excerpt}\`)
}
\`\`\`
`,
  "26-the-vm.md": `# The VM: How Your Code Actually Runs

Every piece of user code in a luca project — commands, endpoints, \`luca eval\` snippets,
\`luca run\` scripts, runnable markdown blocks — executes through the container's \`vm\`
feature. Understanding this one layer explains most of luca's "magic" (a bare folder of
\`.ts\` files runs with zero installs) and most of its gotchas (why a global you expected
isn't there). This tutorial is for both humans and agents: it is the contract.

## The execution contract

Luca has **one execution contract with three entry points**:

- **\`luca eval\`** is *expression-oriented*: your code runs with the container in scope
  and the value of the final expression is printed. Declarations and loops print
  nothing. TypeScript syntax is fine — input is transpiled first.
- **\`luca run script.ts\`** is *program-oriented*: the file's top-level code runs first
  (module evaluation), then, if the script exports a \`default\` function (or a named
  \`main\`), it is called as the entry point with the container context and its return
  value is printed:

  \`\`\`ts skip
  export default async function main({ container }) {
    const fs = container.feature('fs')
    return await fs.readJsonAsync('data.json')
  }
  \`\`\`

  A non-function \`default\` export is treated as a data module and printed. Scripts with
  no exports just run top to bottom, exactly as before.
- **\`luca run doc.md\`** is *literate eval*: each fenced \`ts\`/\`js\` block runs like an
  eval snippet in one shared context, top to bottom, and each block's final expression
  value is displayed beneath it (\`⇒ ...\`). Mark a block \` \`\`\`ts silent\` to run it
  without displaying its value, or \` \`\`\`ts skip\` to not run it at all.

In all three, the container is in scope and **top-level \`await\` just works** — code
containing it is wrapped in an async IIFE, and the final expression's value survives the
wrapping (the boundary between "everything before" and "the final expression" is found
by real parsing, not line heuristics).

## Why a VM at all

The \`luca\` binary bundles its whole runtime. When it loads *your* files — which may
import \`luca\` or \`zod\`, neither of which exists in your \`node_modules\` (you don't need a
\`node_modules\`) — something has to resolve those imports to the binary's bundled copies.
That something is the VM feature plus **virtual modules**.

## Virtual modules

\`vm.defineModule(id, exports)\` registers a module that \`require()\` / \`import\` resolves
**before** Node's native resolution:

\`\`\`ts
const vm = container.feature('vm')
vm.defineModule('answers', { magic: 42 })
const { magic } = vm.createRequireFor(container.cwd)('answers')
magic
\`\`\`

Before any of your files load, the runtime seeds:

| Module id | What you get |
|---|---|
| \`luca\`, \`luca/node\` | the full luca exports + the singleton container as \`default\` |
| \`luca/schemas\`, \`luca/client\`, \`luca/server\`, ... | the corresponding subpath exports |
| \`@soederpop/luca\` (+ subpaths) | legacy aliases of the above |
| \`zod\` | zod v4 — \`import { z }\`, \`import * as z\`, and \`import z\` all work |

Two consequences worth internalizing:

1. **zod is always available.** Endpoint and command files should export zod schemas
   unconditionally — you get argument validation and the auto-generated OpenAPI spec
   for free. (\`container.zod\` is the same instance, so schemas built inside and outside
   the VM share one zod identity.)
2. Virtual-module precedence is also a **sandboxing tool**: registering an inert stub
   under \`'fs'\` and \`'node:fs'\` means \`require('fs')\` inside VM code gets your stub, not
   the real thing. Register both forms — \`require('fs')\` is normalized to \`node:fs\`
   during resolution, so a stub under only one id can be bypassed.

## The globals model

VM contexts start deliberately close to empty. Three tiers:

- **Free from the JS realm** (always there, nothing injects them): \`Promise\`, \`Date\`,
  \`Math\`, \`JSON\`, \`Object\`, \`Array\`, \`RegExp\`, ...
- **Injected by luca**: \`console\`, \`setTimeout\`/\`setInterval\` (+clears), \`process\`,
  \`Buffer\`, \`URL\`/\`URLSearchParams\`, \`AbortController\`/\`AbortSignal\`, \`FormData\`,
  \`Blob\`/\`File\`, \`Headers\`/\`Request\`/\`Response\`/\`fetch\`, \`crypto\`,
  \`TextEncoder\`/\`TextDecoder\` — plus every **enabled container helper** by name
  (\`fs\`, \`ui\`, \`proc\`, ...) via \`container.context\`. Module loading additionally gets
  \`require\`, \`exports\`, \`module\`, \`__filename\`, \`__dirname\`.
- **Not there**: everything else. \`Bun.spawn\`/\`Bun.serve\` are unavailable in
  command/endpoint handlers — use \`container.feature('proc')\` or Node's
  \`child_process\`. If you build your own context with \`vm.createContext({...})\` and
  pass only your own keys, remember you are opting out of the injected tier — add back
  what your code needs.

This applies to *command and endpoint handlers too*, not just code you run through
\`vm.run\` yourself — they are VM-loaded modules. If you hit a missing global that
\`globalThis.X\` can reach, that's a candidate for the injected tier: raise it.

## ESM in, CJS through

Your files are written as ESM (\`import\`/\`export\`), but the VM executes CommonJS. The
transpiler rewrites on the way in:

- \`import { a } from './x.ts'\` → \`const { a } = require('./x.ts')\` — relative imports
  between your own files work, so commands can share a local \`lib/\` module.
- \`export const a = ...\` → \`exports.a = ...\`
- \`export default ...\` → \`module.exports.default = ...\` — which is exactly what
  \`luca run\` reads back to find your entry point.

Markdown blocks are the exception: they are snippets, not modules — no \`import\`/\`export\`
inside blocks; use the injected container instead.

## The three vm primitives

\`\`\`ts skip
const vm = container.feature('vm')

// 1. run — execute a snippet, get the final expression's value
const sum = await vm.run('numbers.reduce((a, b) => a + b, 0)', { numbers: [1, 2, 3] })

// 2. loadModule — load a file as a CJS module (what command discovery uses)
const mod = vm.loadModule(container.paths.resolve('commands/hello.ts'))

// 3. defineModule — make a virtual module resolvable inside VM code
vm.defineModule('config', { port: 3000 })
\`\`\`

For a worked sandboxing example (Proxy-wrapped container + stubbed \`fs\`/\`child_process\`),
see the script-runner pattern in \`docs/examples/\`.

## Debugging tips

- \`luca eval\` is the fastest probe: it runs through the exact same VM pipeline as your
  command, so "works in eval, fails in my command" almost always means a missing
  context key, not a VM difference.
- \`luca describe vm\` lists the full API with runnable examples.
- If a script "does nothing": check you aren't expecting an ignored export shape — the
  entry point is \`default\` (or \`main\`); other named exports are data, not entry points.
`,
  "12-assistants.md": `---
title: Building Assistants
tags: [assistants, ai, openai, tools, hooks, conversation, CORE.md]
---

# Building Assistants

Assistants are AI-powered conversational agents defined by a file-based convention. Each assistant lives in its own folder with a system prompt, tools, hooks, and documentation.

## Directory Structure

\`\`\`
assistants/my-assistant/
├── CORE.md           # System prompt (required)
├── tools.ts          # Tool definitions with Zod schemas
├── hooks.ts          # Lifecycle event handlers
└── docs/             # Internal documentation the assistant can search
    ├── guide.md
    └── faq.md
\`\`\`

## CORE.md -- The System Prompt

This is the assistant's personality and instructions. It's a markdown file that becomes the system message:

\`\`\`markdown
# Customer Support Assistant

You are a helpful customer support agent for Acme Corp. You help users with
billing questions, account issues, and product information.

Always research internal docs before answering product questions.
Be polite and concise.
\`\`\`

## tools.ts -- Tool Definitions

Define functions that the assistant can call. Each tool has a Zod schema describing its parameters:

\`\`\`typescript
const { z } = require('zod')

async function lookupOrder({ orderId }) {
  // In a real app, query your database
  return {
    orderId,
    status: 'shipped',
    trackingNumber: 'ABC123',
    estimatedDelivery: '2024-01-20',
  }
}

async function createTicket({ subject, priority, description }) {
  // Create a support ticket
  const ticketId = \`TICKET-\${Date.now()}\`
  return {
    ticketId,
    subject,
    priority,
    message: \`Ticket \${ticketId} created successfully\`,
  }
}

async function searchProducts({ query, category }) {
  // Search product catalog
  return {
    results: [
      { name: 'Widget Pro', price: 29.99, inStock: true },
      { name: 'Widget Lite', price: 19.99, inStock: false },
    ],
  }
}

const schemas = {
  lookupOrder: z.object({
    orderId: z.string().describe('The order ID to look up'),
  }).describe('Look up an order by its ID to get status and tracking info'),

  createTicket: z.object({
    subject: z.string().describe('Brief ticket subject line'),
    priority: z.enum(['low', 'medium', 'high']).describe('Ticket priority'),
    description: z.string().describe('Detailed description of the issue'),
  }).describe('Create a new support ticket'),

  searchProducts: z.object({
    query: z.string().describe('Search terms'),
    category: z.string().optional().describe('Product category filter'),
  }).describe('Search the product catalog'),
}

module.exports = { lookupOrder, createTicket, searchProducts, schemas }
\`\`\`

**Important:** The function name must match the key in the \`schemas\` object. The \`.describe()\` on the schema object itself becomes the tool description that the AI model sees.

## hooks.ts -- Lifecycle Hooks

React to assistant events:

\`\`\`typescript
function started() {
  console.log('[assistant] Session started')
}

function response(text) {
  // Called when the assistant produces a text response
  console.log(\`[assistant] \${text.slice(0, 100)}...\`)
}

function toolCall(name, args) {
  // Called before a tool is executed
  console.log(\`[assistant] Calling tool: \${name}\`, args)
}

function error(err) {
  console.error('[assistant] Error:', err.message)
}

module.exports = { started, response, toolCall, error }
\`\`\`

## docs/ -- Internal Documentation

The \`docs/\` folder contains markdown files that the assistant can search using the built-in \`researchInternalDocs\` tool. This is automatically injected -- you don't need to define it in tools.ts.

\`\`\`
docs/
├── billing-faq.md
├── product-catalog.md
├── return-policy.md
└── troubleshooting.md
\`\`\`

In CORE.md, instruct the assistant to use it:

\`\`\`markdown
When asked about products, billing, or policies, always use the
researchInternalDocs tool first to find accurate information before answering.
\`\`\`

## Using the Assistant

### In a Script

\`\`\`typescript
import container from 'luca'

const assistant = container.feature('assistant', {
  folder: 'assistants/my-assistant',
  model: 'gpt-4o',
})

// Ask a question
const answer = await assistant.ask('What is the return policy?')
console.log(answer)

// Multi-turn conversation
const follow = await assistant.ask('And how long does the refund take?')
console.log(follow)

// Save the conversation
await assistant.save({ title: 'Return policy inquiry' })
\`\`\`

### In an Endpoint

Expose the assistant as an API:

\`\`\`typescript
// endpoints/ask.ts
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/ask'
export const description = 'Ask the support assistant a question'
export const tags = ['assistant']

export const postSchema = z.object({
  question: z.string().describe('Your question'),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const assistant = ctx.container.feature('assistant', {
    folder: 'assistants/my-assistant',
    model: 'gpt-4o',
  })

  const answer = await assistant.ask(params.question)
  return { answer }
}
\`\`\`

### Streaming Responses

\`\`\`typescript
const assistant = container.feature('assistant', {
  folder: 'assistants/my-assistant',
  model: 'gpt-4o',
})

// Listen for chunks as they arrive
assistant.on('chunk', (text) => {
  process.stdout.write(text)
})

await assistant.ask('Explain quantum computing')
\`\`\`

## Best Practices

1. **Write focused CORE.md prompts** -- tell the assistant exactly what it is and what it should/shouldn't do
2. **Keep tools simple** -- each tool should do one thing. The AI model is better at composing simple tools than using complex ones
3. **Use docs/ liberally** -- put all reference material in docs/ so the assistant can look things up rather than relying on the model's training data
4. **Use Zod \`.describe()\`** -- the descriptions on schemas and fields are what the model sees to decide when and how to call tools
5. **Test with real questions** -- ask the assistant the kinds of things real users will ask
`,
  "03-scripts.md": `---
title: Running Scripts and Markdown Notebooks
tags: [scripts, luca-run, automation, bun, standalone, markdown, codeblocks, notebook]
---

# Running Scripts and Markdown Notebooks

\`luca run\` executes TypeScript/JavaScript files and markdown files. This is often the fastest way to try out Luca features, automate tasks, or build runnable documentation.

## Running a TypeScript Script

\`\`\`bash
luca run scripts/hello.ts
\`\`\`

\`\`\`typescript
// scripts/hello.ts
import container from 'luca'

console.log('Available features:', container.features.available)
console.log('Git branch:', container.git.branch)
console.log('OS:', container.os.platform, container.os.arch)
\`\`\`

The extension is optional -- \`luca run scripts/hello\` tries \`.ts\`, \`.js\`, and \`.md\` automatically.

## Running Markdown Files

This is one of Luca's most useful features. \`luca run\` can execute markdown files as runnable notebooks. It walks through the document, renders the prose to the terminal, and executes each \`ts\` or \`js\` fenced codeblock in sequence. All blocks share the same VM context, so variables defined in one block are available in the next.

\`\`\`bash
luca run docs/tutorial.md
\`\`\`

### How It Works

Given a markdown file like this:

\`\`\`\`markdown
# Setup Tutorial

First, let's see what's available (container is provided automatically):

\`\`\`ts
console.log(container.features.available)
\`\`\`

Now let's use the file system feature:

\`\`\`ts
const { files } = container.fs.walk('./src', { include: ['*.ts'] })
console.log(\`Found \${files.length} TypeScript files\`)
\`\`\`

This block won't run because it's Python:

\`\`\`python
print("I'm skipped -- only ts and js blocks run")
\`\`\`
\`\`\`\`

When you run \`luca run docs/tutorial.md\`, it:

1. Renders "# Setup Tutorial" and the prose as formatted markdown in your terminal
2. Displays the first codeblock, then executes it
3. Renders the next paragraph
4. Displays and executes the second codeblock (which can reference \`container\` from block 1)
5. Skips the Python block entirely (only \`ts\` and \`js\` blocks execute)

### Skipping Blocks

Add \`skip\` in the code fence meta to prevent a block from running:

\`\`\`\`markdown
\`\`\`ts skip
// This block is shown but NOT executed
dangerousOperation()
\`\`\`
\`\`\`\`

### Safe Mode

Use \`--safe\` to require manual approval before each block runs:

\`\`\`bash
luca run docs/tutorial.md --safe
\`\`\`

The runner will prompt "Run this block? (y/n)" before executing each codeblock. Great for walkthroughs where you want to pause and observe.

### Shared Context

All codeblocks in a markdown file share a VM context. The context includes \`console\` and the full container context, so you can use container features without importing:

\`\`\`\`markdown
\`\`\`ts
// Block 1: container is already available in the context
const { files } = container.fs.walk('./src')
\`\`\`

\`\`\`ts
// Block 2: \`files\` from block 1 is still in scope
console.log(\`Found \${files.length} files in src/\`)
\`\`\`
\`\`\`\`

### Use Cases for Markdown Scripts

- **Runnable tutorials** -- documentation that actually executes
- **Onboarding guides** -- new developers run the guide and see real output
- **Demo scripts** -- explain and execute in the same document
- **Literate DevOps** -- annotated operational runbooks

## TypeScript Script Examples

### File Processor

\`\`\`typescript
// scripts/process-images.ts
import container from 'luca'

const { fs, proc } = container

const { files: images } = fs.walk('./uploads', { include: ['*.png', '*.jpg'] })
console.log(\`Processing \${images.length} images...\`)

for (const image of images) {
  console.log(\`  Optimizing: \${image}\`)
  proc.exec(\`optipng \${image}\`)
}

console.log('Done.')
\`\`\`

### Data Migration

\`\`\`typescript
// scripts/migrate-data.ts
import container from 'luca'

const { fs } = container

const api = container.client('rest', {
  baseURL: 'https://api.example.com',
})
await api.connect()

const oldData = fs.readJson('./data/legacy-users.json')
console.log(\`Migrating \${oldData.length} users...\`)

for (const user of oldData) {
  await api.post('/users', {
    name: user.full_name,
    email: user.email_address,
    role: 'user',
  })
  console.log(\`  Migrated: \${user.full_name}\`)
}

console.log('Migration complete.')
\`\`\`

### Generate Report

\`\`\`typescript
// scripts/weekly-report.ts
import container from 'luca'

const { git, fs } = container

const branch = git.branch       // getter, not a method
const sha = git.sha             // getter, not a method
const files = await git.lsFiles()
const { files: srcFiles } = fs.walk('./src', { include: ['*.ts'] })

const report = \`# Weekly Report

- Branch: \${branch}
- Commit: \${sha}
- Tracked files: \${files.length}
- Source files: \${srcFiles.length}

Generated: \${new Date().toISOString()}
\`

await fs.writeFile('./reports/weekly.md', report)
console.log('Report generated: reports/weekly.md')
\`\`\`

## Tips

- **Use the container** -- don't import \`fs\` from Node directly. \`container.fs\` gives you the same operations with the benefit of working within the container ecosystem.
- **Markdown scripts are great for prototyping** -- write a markdown file, mix explanation with code, run it, iterate.
- **Use \`--safe\` for unfamiliar scripts** -- review each block before it runs.
`,
  "09-clients.md": `---
title: Using Clients
tags: [clients, rest, graphql, websocket, http, api, axios]
---

# Using Clients

Clients connect your application to external services. Luca provides built-in clients for REST APIs, GraphQL, and WebSocket connections.

## REST Client

The REST client wraps axios with Luca's helper patterns (state, events, introspection):

\`\`\`typescript
const api = container.client('rest', {
  baseURL: 'https://api.example.com',
  headers: {
    Authorization: 'Bearer my-token',
  },
})

await api.connect()

// Standard HTTP methods
const users = await api.get('/users')
const user = await api.get('/users/123')
const created = await api.post('/users', { name: 'Alice', email: 'alice@example.com' })
const updated = await api.put('/users/123', { name: 'Alice Updated' })
await api.delete('/users/123')
\`\`\`

### REST Client Events

\`\`\`typescript
api.on('failure', (error) => {
  console.error('Request failed:', error.message)
})

// State changes track connection status
api.state.observe((type, key, value) => {
  if (key === 'connected') {
    console.log(\`Client connected: \${value}\`)
  }
})
\`\`\`

## GraphQL Client

For GraphQL APIs, use the REST client's \`post()\` method to send queries and mutations:

\`\`\`typescript
const graph = container.client('rest', {
  baseURL: 'https://api.example.com/graphql',
  headers: { Authorization: 'Bearer my-token' },
})

await graph.connect()

// Send a query
const result = await graph.post('/', {
  query: \`
    query GetUser($id: ID!) {
      user(id: $id) {
        name
        email
        posts { title }
      }
    }
  \`,
  variables: { id: '123' },
})

// Send a mutation
const mutationResult = await graph.post('/', {
  query: \`
    mutation CreatePost($input: PostInput!) {
      createPost(input: $input) {
        id
        title
      }
    }
  \`,
  variables: { input: { title: 'Hello World', body: '...' } },
})
\`\`\`

## WebSocket Client

The WebSocket client wraps a raw \`WebSocket\` connection:

\`\`\`typescript
const ws = container.client('websocket', {
  baseURL: 'wss://realtime.example.com',
})

await ws.connect()

// Access the underlying WebSocket via ws.ws
ws.ws.onmessage = (event) => {
  console.log('Received:', event.data)
}

ws.ws.send(JSON.stringify({ type: 'subscribe', channel: 'updates' }))

// Clean up
ws.ws.close()
\`\`\`

## Discovering Clients

\`\`\`typescript
container.clients.available   // ['rest', 'graph', 'websocket']
container.clients.describe('rest')
\`\`\`

## Using Clients in Endpoints

\`\`\`typescript
// endpoints/proxy.ts
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/external-data'

export const getSchema = z.object({
  query: z.string().describe('Search query'),
})

export async function get(params: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const api = ctx.container.client('rest', {
    baseURL: 'https://external-api.com',
  })

  await api.connect()
  const data = await api.get(\`/search?q=\${encodeURIComponent(params.query)}\`)

  return { results: data }
}
\`\`\`

## Using Clients in Features

\`\`\`typescript
class WeatherService extends Feature<WeatherState, WeatherOptions> {
  private api: any

  async initialize() {
    this.api = this.container.client('rest', {
      baseURL: 'https://api.weather.com',
      headers: { 'X-API-Key': this.options.apiKey },
    })
    await this.api.connect()
  }

  async getForecast(city: string) {
    const data = await this.api.get(\`/forecast/\${encodeURIComponent(city)}\`)
    this.state.set('lastForecast', data)
    this.emit('forecastFetched', data)
    return data
  }
}
\`\`\`
`,
  "21-embedding-luca.md": `---
title: Embedding Luca in an Existing Project
tags: [setup, npm, library, embedding, integration]
---

# Embedding Luca in an Existing Project

The canonical way to use Luca is the standalone binary — see [Getting Started](./01-getting-started.md). But sometimes you already have an app, a build pipeline, and a \`package.json\`, and you want the container *inside* it as a library. That's what this path is for.

## When to Choose This Path

Use the **binary** when:

- You're starting a new project or tool
- You want zero npm dependencies and no supply chain exposure
- You want to ship your project as its own standalone binary with \`luca bundle\`

Embed Luca as a **package** when:

- You have an existing TypeScript/Bun app and want the container's features inside it
- You need to import Luca modules into your own build (bundlers, monorepos, CI pipelines you already own)
- You're using the React bindings or building a browser app on the web container

Both paths use the exact same container — the difference is only who owns the runtime.

## Install

\`\`\`bash
bun add luca
\`\`\`

Bun is Luca's runtime; the package assumes it.

## Import the Container

The container is a per-process singleton — dependency injector, event bus, and state machine:

\`\`\`typescript
import container from 'luca/node'

// Now you have access to all features
const fs = container.fs           // File system operations
const git = container.git         // Git utilities (branch, sha, lsFiles, etc.)
const ui = container.ui           // Terminal UI (colors, prompts, figlet)
const proc = container.feature('proc')  // Process execution
\`\`\`

Everything you'd get in the binary is on the container: features, clients, servers, observable state, the event bus. The discovery pattern from [Bootstrap](./00-bootstrap.md) works identically:

\`\`\`typescript
container.features.available          // list every feature
container.features.describe('fs')     // markdown docs at runtime
\`\`\`

## Entry Points

The package exposes several entry points depending on where your code runs:

\`\`\`typescript
import container from 'luca'          // node container (default)
import container from 'luca/node'     // node container, explicit
import container from 'luca/web'      // browser container
import { ... } from 'luca/react'      // React bindings
import { ... } from 'luca/agi'        // AGI layer — assistants, conversations, providers
\`\`\`

In the browser without a bundler, you can load it straight from a CDN — see [Browser ESM](./20-browser-esm.md):

\`\`\`js
import container from 'https://esm.sh/luca/web'
\`\`\`

## Using It in Your App

A script in your existing project:

\`\`\`typescript
// scripts/migrate.ts
import container from 'luca/node'

const sqlite = container.feature('sqlite')
const ui = container.feature('ui')

const db = await sqlite.open('app.db')
await db.exec(\`CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY)\`)
ui.print.success('Migration complete')
\`\`\`

Run it with your own tooling (\`bun run scripts/migrate.ts\`) — or with the CLI, which the package also installs:

\`\`\`bash
bunx luca run scripts/migrate.ts
bunx luca serve
bunx luca describe features
\`\`\`

The convention folders (\`commands/\`, \`endpoints/\`, \`features/\`, \`assistants/\`) are auto-discovered by the CLI exactly as they are in binary projects, so you can mix both styles: import the container in your own code, and let \`luca serve\` pick up your \`endpoints/\` folder.

## Building Custom Helpers

Extending the container works the same in both worlds — features, clients, and servers register themselves:

\`\`\`typescript
import { Feature } from 'luca/feature'

export class MyCache extends Feature {
  static { Feature.register(this, 'myCache') }
  // ...
}
\`\`\`

See [Creating Features](./10-creating-features.md) for the full guide.

## Graduating to a Binary

Nothing about the embedded path locks you in. If your Luca-powered corner of the app grows into something you want to ship on its own, \`luca bundle <name>\` compiles the convention folders into a standalone binary — see [Getting Started, step 5](./01-getting-started.md#5-ship-it).

## What's Next

- [Getting Started](./01-getting-started.md) -- the canonical binary path
- [The Container](./02-container.md) -- deep dive into the container
- [Browser ESM](./20-browser-esm.md) -- the web container without a build step
- [Creating Features](./10-creating-features.md) -- extend the container with your own helpers
- [Assistants](./12-assistants.md) -- build an AI operator into your project
`,
  "16-google-features.md": `---
title: Google Features
tags: [google, drive, sheets, calendar, docs, oauth2, service-account, auth, api]
---

# Google Features

Luca provides five features for working with Google APIs: authentication, Drive files, Sheets data, Calendar events, and Docs-as-markdown. All are built on the official \`googleapis\` package.

## Setting Up Google Cloud Credentials

Before using any Google feature, you need credentials from a Google Cloud project.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** > **New Project**
3. Name it (e.g. "Luca Integration") and click **Create**

### Step 2: Enable the APIs

In your project, go to **APIs & Services > Library** and enable:

- **Google Drive API**
- **Google Sheets API**
- **Google Calendar API**
- **Google Docs API**

Click each one and hit **Enable**.

### Step 3a: OAuth2 Credentials (for personal/interactive use)

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - Choose **External** (or Internal if using Google Workspace)
   - Fill in app name and your email for support/developer contact
   - Add scopes: \`drive.readonly\`, \`spreadsheets.readonly\`, \`calendar.readonly\`, \`documents.readonly\`
   - Add yourself as a test user
4. Back in **Credentials**, create an **OAuth client ID**:
   - Application type: **Desktop app** (or Web application)
   - For Desktop app, no redirect URI is needed (Luca handles it)
   - For Web application, add \`http://localhost:9876/oauth2callback\` as an authorized redirect URI
5. Download or copy the **Client ID** and **Client Secret**

Set them as environment variables in your \`.env\`:

\`\`\`
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
\`\`\`

### Step 3b: Service Account Credentials (for servers/automation)

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > Service account**
3. Name it and click **Create and Continue**
4. Grant it appropriate roles (e.g. Viewer) and click **Done**
5. Click on the service account > **Keys** tab > **Add Key > Create new key > JSON**
6. Save the downloaded JSON key file

Set the path as an environment variable:

\`\`\`
GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/service-account-key.json
\`\`\`

**Important:** For service accounts to access your personal files, you must share Drive files/folders, Sheets, and Calendars with the service account's email address (found in the JSON key file as \`client_email\`).

## Authentication

### OAuth2 (Interactive)

Opens a browser for Google consent. Best for personal/development use:

\`\`\`typescript
const auth = container.feature('googleAuth', {
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
  ],
})

// Opens browser, waits for consent, stores refresh token
await auth.authorize()

console.log(auth.isAuthenticated)  // true
console.log(auth.state.get('email'))  // your Google email
\`\`\`

On subsequent runs, the refresh token is automatically restored from the disk cache -- no browser needed:

\`\`\`typescript
const auth = container.feature('googleAuth')
const restored = await auth.tryRestoreTokens()

if (restored) {
  console.log('Authenticated from cached token')
} else {
  await auth.authorize()
}
\`\`\`

### Service Account (Non-Interactive)

No browser needed. Best for servers and automation:

\`\`\`typescript
const auth = container.feature('googleAuth', {
  serviceAccountKeyPath: '/path/to/key.json',
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})

await auth.authenticateServiceAccount()
\`\`\`

Or pass the key object directly:

\`\`\`typescript
const key = JSON.parse(fs.readFileSync('/path/to/key.json', 'utf-8'))

const auth = container.feature('googleAuth', {
  serviceAccountKey: key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

await auth.authenticateServiceAccount()
\`\`\`

### Auth Events

\`\`\`typescript
auth.on('authenticated', ({ mode, email }) => {
  console.log(\`Signed in via \${mode} as \${email}\`)
})

auth.on('tokenRefreshed', () => {
  console.log('Access token refreshed automatically')
})

auth.on('error', (err) => {
  console.error('Auth error:', err.message)
})
\`\`\`

### Revoking Credentials

\`\`\`typescript
await auth.revoke()  // Revokes tokens and clears cached refresh token
\`\`\`

## Google Drive

List, search, browse, and download files from Google Drive.

\`\`\`typescript
const drive = container.feature('googleDrive')
\`\`\`

### List Files

\`\`\`typescript
// List recent files
const { files } = await drive.listFiles()

// With a Drive query filter
const { files: pdfs } = await drive.listFiles("mimeType = 'application/pdf'")

// Paginate
const page1 = await drive.listFiles(undefined, { pageSize: 10 })
const page2 = await drive.listFiles(undefined, { pageSize: 10, pageToken: page1.nextPageToken })
\`\`\`

### Search

\`\`\`typescript
// Search by name and content
const { files } = await drive.search('quarterly report')

// Filter by MIME type
const { files: slides } = await drive.search('presentation', {
  mimeType: 'application/vnd.google-apps.presentation',
})

// Search within a folder
const { files: inFolder } = await drive.search('notes', {
  inFolder: 'folder-id-here',
})
\`\`\`

### Browse Folders

\`\`\`typescript
// Browse root
const root = await drive.browse()
console.log('Folders:', root.folders.map(f => f.name))
console.log('Files:', root.files.map(f => f.name))

// Browse a specific folder
const contents = await drive.browse('folder-id-here')

// List a folder's contents (flat list)
const { files } = await drive.listFolder('folder-id-here')
\`\`\`

### Download Files

\`\`\`typescript
// Get file metadata
const file = await drive.getFile('file-id')
console.log(file.name, file.mimeType, file.size)

// Download as Buffer
const buffer = await drive.download('file-id')

// Download to local disk
const savedPath = await drive.downloadTo('file-id', './downloads/report.pdf')

// Export a Google Workspace file (Docs, Sheets, Slides) to another format
const pdfBuffer = await drive.exportFile('doc-id', 'application/pdf')
const csvBuffer = await drive.exportFile('sheet-id', 'text/csv')
\`\`\`

### Shared Drives

\`\`\`typescript
const sharedDrives = await drive.listDrives()

// List files from a shared drive
const { files } = await drive.listFiles(undefined, { corpora: 'allDrives' })
\`\`\`

## Google Sheets

Read spreadsheet data as JSON objects, CSV strings, or raw 2D arrays.

\`\`\`typescript
const sheets = container.feature('googleSheets', {
  defaultSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
})
\`\`\`

You can find the spreadsheet ID in the URL: \`https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit\`

### Read as JSON

The first row becomes object keys, subsequent rows become values:

\`\`\`typescript
// Read the first sheet
const data = await sheets.getAsJson()
// => [{ Name: 'Alice', Age: '30', City: 'Austin' }, { Name: 'Bob', Age: '25', City: 'Denver' }]

// Read a specific tab
const revenue = await sheets.getAsJson('Q4 Revenue')

// Read from a different spreadsheet
const other = await sheets.getAsJson('Sheet1', 'other-spreadsheet-id')
\`\`\`

### Read as CSV

\`\`\`typescript
const csv = await sheets.getAsCsv('Sheet1')
// => "Name,Age,City\\nAlice,30,Austin\\nBob,25,Denver"
\`\`\`

### Read Raw Ranges

\`\`\`typescript
// A1 notation
const values = await sheets.getRange('Sheet1!A1:D10')
// => [['Name', 'Age', 'City'], ['Alice', '30', 'Austin'], ...]

// Entire sheet
const all = await sheets.getRange('Sheet1')
\`\`\`

### Save to Files

\`\`\`typescript
await sheets.saveAsJson('./data/export.json')
await sheets.saveAsJson('./data/revenue.json', 'Revenue')

await sheets.saveAsCsv('./data/export.csv')
await sheets.saveAsCsv('./data/revenue.csv', 'Revenue')
\`\`\`

### Spreadsheet Metadata

\`\`\`typescript
const meta = await sheets.getSpreadsheet()
console.log(meta.title)
console.log(meta.sheets)  // [{ sheetId, title, rowCount, columnCount }, ...]

// Just the tab list
const tabs = await sheets.listSheets()
tabs.forEach(t => console.log(t.title, \`\${t.rowCount} rows\`))
\`\`\`

## Google Calendar

List calendars and read events with convenience methods for common queries.

\`\`\`typescript
const calendar = container.feature('googleCalendar', {
  timeZone: 'America/Chicago',
})
\`\`\`

### List Calendars

\`\`\`typescript
const calendars = await calendar.listCalendars()
calendars.forEach(c => {
  console.log(\`\${c.primary ? '★' : ' '} \${c.summary} (\${c.id})\`)
})
\`\`\`

### Today's Events

\`\`\`typescript
const today = await calendar.getToday()
today.forEach(event => {
  const time = event.start.dateTime
    ? new Date(event.start.dateTime).toLocaleTimeString()
    : 'All day'
  console.log(\`\${time} - \${event.summary}\`)
})
\`\`\`

### Upcoming Events

\`\`\`typescript
// Next 7 days
const upcoming = await calendar.getUpcoming(7)

// Next 30 days
const month = await calendar.getUpcoming(30)

// From a specific calendar
const work = await calendar.getUpcoming(7, 'work-calendar-id')
\`\`\`

### Search Events

\`\`\`typescript
const standups = await calendar.searchEvents('standup')
const reviews = await calendar.searchEvents('review', {
  timeMin: '2026-03-01T00:00:00Z',
  timeMax: '2026-03-31T23:59:59Z',
})
\`\`\`

### List Events with Full Options

\`\`\`typescript
const { events, nextPageToken } = await calendar.listEvents({
  calendarId: 'primary',
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 14 * 86400000).toISOString(),
  maxResults: 50,
  orderBy: 'startTime',
})

events.forEach(e => {
  console.log(e.summary, e.start, e.location, e.attendees?.length)
})
\`\`\`

### Get a Single Event

\`\`\`typescript
const event = await calendar.getEvent('event-id-here')
console.log(event.summary, event.description, event.attendees)
\`\`\`

## Google Docs

Read Google Docs and convert them to Markdown or plain text.

\`\`\`typescript
const docs = container.feature('googleDocs')
\`\`\`

You can find the document ID in the URL: \`https://docs.google.com/document/d/{DOCUMENT_ID}/edit\`

### Convert to Markdown

\`\`\`typescript
const markdown = await docs.getAsMarkdown('document-id')
console.log(markdown)
\`\`\`

The converter handles:
- Headings (H1-H6)
- **Bold**, *italic*, ~~strikethrough~~
- [Links](url)
- \`Code spans\` (Courier/monospace fonts)
- Ordered and unordered lists with nesting
- Tables (markdown pipe format)
- Images (\`![alt](url)\`)
- Section breaks (\`---\`)

### Save as Markdown File

\`\`\`typescript
const path = await docs.saveAsMarkdown('document-id', './docs/imported.md')
console.log(\`Saved to \${path}\`)
\`\`\`

### Plain Text

\`\`\`typescript
const text = await docs.getAsText('document-id')
\`\`\`

### Raw Document Structure

\`\`\`typescript
const doc = await docs.getDocument('document-id')
console.log(doc.title)
console.log(doc.body?.content)  // Array of structural elements
console.log(doc.lists)           // List definitions
console.log(doc.inlineObjects)   // Embedded images
\`\`\`

### List and Search Docs

\`\`\`typescript
// List all Google Docs in your Drive
const allDocs = await docs.listDocs()
allDocs.forEach(d => console.log(d.name, d.id))

// Filter by name
const reports = await docs.listDocs('report')

// Full-text search
const results = await docs.searchDocs('quarterly earnings')
\`\`\`

## Common Patterns

### Authenticate Once, Use Everywhere

All Google features share the same \`googleAuth\` instance. Authenticate once and every feature picks it up:

\`\`\`typescript
// Auth first
const auth = container.feature('googleAuth')
await auth.authorize()

// All features auto-use the authenticated client
const drive = container.feature('googleDrive')
const sheets = container.feature('googleSheets')
const calendar = container.feature('googleCalendar')
const docs = container.feature('googleDocs')

// No additional auth needed
const files = await drive.listFiles()
const events = await calendar.getToday()
\`\`\`

### Download a Google Doc as Markdown via Drive Export

Two approaches -- the Docs API (richer formatting) or Drive export (simpler):

\`\`\`typescript
// Approach 1: Docs API with full markdown conversion (recommended)
const docs = container.feature('googleDocs')
const markdown = await docs.getAsMarkdown('doc-id')

// Approach 2: Drive export as plain text
const drive = container.feature('googleDrive')
const buffer = await drive.exportFile('doc-id', 'text/plain')
const plainText = buffer.toString('utf-8')
\`\`\`

### Batch Download Sheets as JSON

\`\`\`typescript
const drive = container.feature('googleDrive')
const sheets = container.feature('googleSheets')

// Find all spreadsheets in a folder
const { files } = await drive.listFolder('folder-id')
const spreadsheets = files.filter(f => f.mimeType === 'application/vnd.google-apps.spreadsheet')

for (const file of spreadsheets) {
  const data = await sheets.getAsJson(undefined, file.id)
  await container.fs.writeFileAsync(
    container.paths.resolve(\`./data/\${file.name}.json\`),
    JSON.stringify(data, null, 2)
  )
  console.log(\`Exported \${file.name}: \${data.length} rows\`)
}
\`\`\`

### Error Handling

All features emit \`error\` events and update \`lastError\` in state:

\`\`\`typescript
const drive = container.feature('googleDrive')

drive.on('error', (err) => {
  console.error('Drive error:', err.message)
})

try {
  await drive.download('invalid-id')
} catch (err) {
  console.log(drive.state.get('lastError'))
}
\`\`\`

## Scopes Reference

Use the narrowest scopes needed. All default to readonly:

| Scope | Access |
|-------|--------|
| \`drive.readonly\` | View and download Drive files |
| \`drive\` | Full read/write access to Drive |
| \`spreadsheets.readonly\` | Read spreadsheet data |
| \`spreadsheets\` | Read and write spreadsheet data |
| \`calendar.readonly\` | View calendar events |
| \`calendar\` | Full calendar access |
| \`documents.readonly\` | View document content |
| \`documents\` | Full document access |

Full scope URLs follow the pattern: \`https://www.googleapis.com/auth/{scope}\`
`
}

export const bootstrapReferences: Record<string, string> = {
  "helper-index.md": `# Helper Index

Every built-in helper in the luca container. Run \`luca describe <name>\` for full docs on any of them, or search by meaning with \`luca describe --query "..."\`.

| Name | Kind | Category | Stability | Description |
|------|------|----------|-----------|-------------|
| \`assistant\` | feature | ai-assistants | core | An Assistant is a combination of a system prompt and tool calls that has a conversation with an LLM. |
| \`assistantsManager\` | feature | ai-assistants | core | Discovers and manages assistant definitions by looking for subdirectories in two locations: ~/.luca/assistants/ and cwd/assistants/. |
| \`browserUse\` | feature | media-browser | experimental | Browser automation feature wrapping the browser-use CLI. |
| \`cipherSocial\` | feature | media-browser | experimental | Cipher P2P feature — connects a Luca agent to the Cipher encrypted social network. |
| \`claudeCode\` | feature | agent-wrappers | stable | Claude Code CLI wrapper feature. |
| \`claudeController\` | feature | agent-wrappers | stable | Multi-session spawner for interactive Claude Code workers. |
| \`codingTools\` | feature | ai-assistants | stable | Shell primitives for AI coding assistants: rg, ls, cat, sed, awk. |
| \`containerLink\` | feature | system | stable | ContainerLink (Node-side) — WebSocket host for remote web containers. |
| \`contentDb\` | feature | data-storage | core | Provides access to a Contentbase Collection for a folder of structured markdown files. |
| \`conversation\` | feature | ai-assistants | stable | A self-contained conversation with OpenAI that supports streaming, tool calling, and message state management. |
| \`conversationHistory\` | feature | ai-assistants | stable | Persists conversations to disk using the diskCache feature (cacache). |
| \`diskCache\` | feature | data-storage | core | File-backed key-value cache built on top of the cacache library (the same store that powers npm). |
| \`dns\` | feature | networking | stable | The Dns feature provides structured DNS lookups by wrapping the \`dig\` CLI. |
| \`docker\` | feature | dev-tools | stable | Docker CLI interface feature for managing containers, images, and executing Docker commands. |
| \`docsReader\` | feature | content-nlp | stable | The DocsReader feature is an AI Assisted wrapper around a ContentDB feature. |
| \`downloader\` | feature | media-browser | stable | A feature that provides file downloading capabilities from URLs. |
| \`fileManager\` | feature | filesystem | core | The FileManager feature creates a database-like, in-memory index of all of the files in the project, provides metadata about these files, and can watch for changes to them. |
| \`fileTools\` | feature | ai-assistants | stable | Curated file-system and code-search tools for AI assistants. |
| \`fs\` | feature | filesystem | core | The FS feature provides methods for interacting with the file system, relative to the container's cwd. |
| \`git\` | feature | dev-tools | core | The Git feature provides utilities for interacting with Git repositories. |
| \`googleAuth\` | feature | google-workspace | stable | Google authentication feature supporting OAuth2 browser flow and service account auth. |
| \`googleCalendar\` | feature | google-workspace | stable | Google Calendar feature for listing calendars and reading events. |
| \`googleDocs\` | feature | google-workspace | stable | Google Docs feature for reading documents and converting them to Markdown. |
| \`googleDrive\` | feature | google-workspace | stable | Google Drive feature for listing, searching, browsing, and downloading files. |
| \`googleMail\` | feature | google-workspace | stable | Google Mail feature for searching, reading, and watching Gmail messages. |
| \`googleSheets\` | feature | google-workspace | stable | Google Sheets feature for reading spreadsheet data as JSON, CSV, or raw arrays. |
| \`grep\` | feature | filesystem | core | The Grep feature provides utilities for searching file contents using ripgrep (rg) or grep. |
| \`helpers\` | feature | system | core | The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. |
| \`ink\` | feature | ui-output | stable | Ink Feature — React-powered Terminal UI via Ink Exposes the Ink library (React for CLIs) through the container so any feature, script, or application can build rich terminal user interfaces using React components rendered directly in the terminal. |
| \`introspectionScanner\` | feature | system | core | Scans TypeScript files for Helper classes and generates introspection data using AST analysis |
| \`ipcSocket\` | feature | networking | stable | IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. |
| \`jsonTree\` | feature | content-nlp | stable | JsonTree Feature - A powerful JSON file tree loader and processor This feature provides functionality to recursively load JSON files from a directory structure and build a hierarchical tree representation. |
| \`lucaCoder\` | feature | agent-wrappers | experimental | A coding assistant that owns a lower-level Assistant instance and gates all tool calls through a permission system. |
| \`mcpBridge\` | feature | ai-assistants | stable | Bridges local stdio MCP servers to Luca assistants by discovering their tools and exposing them as first-class assistant tool calls. |
| \`memory\` | feature | ai-assistants | stable | Semantic memory storage and retrieval for AI agents. |
| \`modelProviders\` | feature | ai-assistants | core | Resolve model provider profiles and route requests to provider transports. |
| \`networking\` | feature | networking | stable | The Networking feature provides utilities for network-related operations. |
| \`nlp\` | feature | content-nlp | stable | The NLP feature provides natural language processing utilities for parsing utterances into structured data. |
| \`openaiCodex\` | feature | agent-wrappers | stable | OpenAI Codex CLI wrapper feature. |
| \`opener\` | feature | media-browser | stable | The Opener feature opens files, URLs, desktop applications, and code editors. |
| \`os\` | feature | system | core | The OS feature provides access to operating system utilities and information. |
| \`packageFinder\` | feature | dev-tools | stable | PackageFinder Feature - Comprehensive package discovery and analysis tool This feature provides powerful capabilities for discovering, indexing, and analyzing npm packages across the entire project workspace. |
| \`postgres\` | feature | data-storage | stable | Postgres feature for safe SQL execution through Bun's native SQL client. |
| \`proc\` | feature | process | core | The ChildProcess feature provides utilities for executing external processes and commands. |
| \`processManager\` | feature | process | stable | Manages long-running child processes with tracking, events, and automatic cleanup. |
| \`python\` | feature | dev-tools | stable | The Python VM feature provides Python virtual machine capabilities for executing Python code. |
| \`redis\` | feature | data-storage | stable | Redis feature for shared state and pub/sub communication between container instances. |
| \`repl\` | feature | system | stable | REPL feature — provides an interactive read-eval-print loop with tab completion and history. |
| \`runpod\` | feature | system | experimental | RunPod feature — manage GPU cloud pods, templates, volumes, and SSH connections via the RunPod REST API. |
| \`scheduler\` | feature | process | stable | In-process task scheduler: recurring intervals, cron expressions, and one-shot timers as named, observable, stoppable tasks — plus the daemon lifecycle (\`run()\`) that keeps a long-running command alive until SIGINT/SIGTERM. |
| \`secureShell\` | feature | process | stable | SecureShell Feature -- SSH command execution and SCP file transfers. |
| \`semanticSearch\` | feature | content-nlp | experimental | Semantic search feature providing BM25 keyword search, vector similarity search, and hybrid search with Reciprocal Rank Fusion over a SQLite-backed index. |
| \`skillsLibrary\` | feature | content-nlp | stable | Manages a registry of skill locations — folders containing SKILL.md files. |
| \`socketRepl\` | feature | system | stable | Socket REPL — a WebSocket-powered interactive read-eval-print loop. |
| \`sqlite\` | feature | data-storage | core | SQLite feature for safe SQL execution through Bun's native sqlite binding. |
| \`store\` | feature | data-storage | stable | Store Feature — durable, cross-process JSON state with safe concurrent updates THE blessed answer to "two luca processes need to share state." Every \`luca <command>\` invocation is a separate process: a server and its \`--stats\` sibling, a fleet manager and its \`stop\` command, a watcher and a reporter — none of them share memory. |
| \`telegram\` | feature | media-browser | stable | Telegram bot feature powered by grammY. |
| \`telnyxAssistantConnector\` | feature | ai-assistants | experimental | Bridges a local Luca assistant to Telnyx AI by exposing tool handlers as HTTP endpoints and creating a mirrored Telnyx assistant with webhook bindings. |
| \`tmux\` | feature | process | stable | Tmux session manager for controlling coding assistants and long-running CLI tools. |
| \`transpiler\` | feature | dev-tools | core | Transpile TypeScript, TSX, and JSX to JavaScript at runtime using Bun's built-in transpiler. |
| \`tts\` | feature | media-browser | experimental | TTS feature — synthesizes text to audio files via RunPod's Chatterbox Turbo endpoint. |
| \`ui\` | feature | ui-output | core | UI Feature - Interactive Terminal User Interface Builder Unified interface for building professional CLI experiences using chalk (colors/styles), figlet (ASCII art), and inquirer (interactive prompts). |
| \`vault\` | feature | system | stable | The Vault feature provides encryption and decryption capabilities using AES-256-GCM. |
| \`vm\` | feature | dev-tools | core | The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. |
| \`voiceMode\` | feature | ai-assistants | experimental | VoiceMode helper |
| \`yaml\` | feature | ui-output | core | The YAML feature provides utilities for parsing and stringifying YAML data. |
| \`yamlTree\` | feature | content-nlp | stable | YamlTree Feature - A powerful YAML file tree loader and processor This feature provides functionality to recursively load YAML files from a directory structure and build a hierarchical tree representation. |
| \`elevenlabs\` | client | media-browser | experimental | ElevenLabs client — text-to-speech synthesis via the ElevenLabs REST API. |
| \`graph\` | client | networking | stable | GraphQL client that wraps RestClient with convenience methods for executing queries and mutations. |
| \`openai\` | client | ai-assistants | core | OpenAI client — wraps the OpenAI SDK for chat completions, responses API, embeddings, and image generation. |
| \`rest\` | client | networking | core | HTTP REST client built on top of axios. |
| \`socketio\` | client | networking | stable | Socket.IO client that bridges socket.io-client events to Luca's Helper event bus. |
| \`voicebox\` | client | media-browser | experimental | VoiceBox client — local TTS synthesis via VoiceBox.sh REST API (Qwen3-TTS). |
| \`websocket\` | client | networking | stable | WebSocket client that bridges raw WebSocket events to Luca's Helper event bus, providing a clean interface for sending/receiving messages, tracking connection state (\`state.connected\`, \`state.reconnectAttempts\`), and optional auto-reconnection with exponential backoff (base \`reconnectInterval\`, doubled per attempt, capped at 30s, up to \`maxReconnectAttempts\`). |
| \`express\` | server | networking | core | Express.js HTTP server with automatic endpoint mounting, CORS, and SPA history fallback. |
| \`llmProxy\` | server | ai-assistants | experimental | Runs a [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start) in a docker container, exposing every configured backend — local GPU boxes running OpenAI-compatible servers, LM Studio, paid APIs like OpenAI and Anthropic — behind a single OpenAI-compatible endpoint on \`http://localhost:<port>/v1\`. |
| \`mcp\` | server | ai-assistants | core | MCP (Model Context Protocol) server for exposing tools, resources, and prompts to AI clients like Claude Code. |
| \`websocket\` | server | networking | stable | WebSocket server built on the \`ws\` library with optional JSON message framing. |

_Generated by \`luca build-bootstrap\` from live introspection data — do not edit by hand._
`
}
