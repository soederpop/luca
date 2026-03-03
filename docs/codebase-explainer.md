# Luca Codebase Reference

> **Read this file first** before exploring the codebase. It describes the purpose of every folder and module, what each exports, and how the pieces fit together. This should be sufficient context to work on most tasks without re-reading every source file.

## Project Overview

**Package:** `@soederpop/luca` v0.0.1
**Runtime:** Bun (Node-compatible)
**Language:** TypeScript (ESNext, bundler moduleResolution, strict mode)
**Test Runner:** Vitest
**Build:** `mkdist` for library, `bun build --compile` for CLI binary
**Path Aliases:** `@/` → `src/`, `@/node/` → `src/node/`, `@/web/` → `src/web/`

Luca — **Lightweight Universal Conversational Architecture** — is a layered dependency injection container framework. It provides observable state, typed event buses, and registries of **Helpers** (Features, Clients, Servers, Commands, Endpoints) that compose into platform-specific containers. The system is designed for both human developers and AI agents to discover and work with at dev-time and runtime through its introspection system.

---

## Architecture Summary

```
                    Container (state, events, registries, factories)
                        |
            ┌───────────┼───────────┐
            │           │           │
       NodeContainer  WebContainer  (your own)
            │
       AGIContainer
```

The **Container** is a per-process singleton that acts as:
- A **dependency injector** — factory methods create and cache helper instances
- An **event bus** — `emit()`, `on()`, `once()`, `waitFor()`
- A **state machine** — observable `State<T>` with change callbacks
- A **registry host** — `container.features`, `container.clients`, `container.servers`, etc.

**Helpers** are the building blocks: Feature, Client, Server, Command, Endpoint. Each has typed state, options, events, and full introspection support. You create them through container factory methods (`container.feature('fs')`) which handle caching, context injection, and lifecycle.

Three container layers ship with the project:
1. **Container** (platform-agnostic) — state, events, feature registry
2. **NodeContainer** extends Container — adds fs, git, proc, networking, ui, vm, plus Client/Server/Command/Endpoint registries
3. **AGIContainer** extends NodeContainer — adds OpenAI conversations, Claude Code, skills library, conversation history

A **WebContainer** targets the browser with speech, voice recognition, asset loading, and browser-compatible features.

---

## Top-Level Directory Structure

```
@luca/
├── src/                    # All source code
├── dist/                   # Build output (mkdist --declaration)
├── docs/                   # Documentation and ideas
├── scripts/                # Build scripts, scaffolding, utilities
├── test/                   # Vitest test suite
├── public/                 # Static files served by the express server
├── playground/             # Scratch space (gitignored content)
├── output/                 # Script output artifacts
├── index.ts                # Root entry (placeholder)
├── package.json            # Package config, scripts, dependencies
├── tsconfig.json           # TypeScript config with path aliases
├── vitest.config.ts        # Vitest config with path alias resolution
├── Dockerfile              # RunPod-based container image
├── CLAUDE.md               # AI assistant instructions
└── .cursorrules            # Cursor IDE instructions (mirrors CLAUDE.md)
```

---

## `src/` — Core Framework

### Primitives

| File | Exports | Purpose |
|------|---------|---------|
| `state.ts` | `State<T>`, `StateChangeType`, `SetStateValue` | Observable key-value state store. Methods: `get`, `set`, `delete`, `has`, `setState`, `observe`, `clear`, `entries`, `values`, `keys`. Has a `version` counter and `current` snapshot getter. Every `set`/`delete` notifies observers. |
| `bus.ts` | `Bus<T>`, `EventMap`, `EventStats` | Typed event emitter. Methods: `emit`, `on`, `off`, `once`, `waitFor` (returns Promise). Tracks fire counts, timestamps, and fires-per-minute statistics per event. |
| `hash-object.ts` | `hashObject(value): string` | Browser-compatible deterministic hashing (FNV-1a / djb2). Serializes any JS value into a canonical string with type prefixes, sorts object keys for determinism, handles circular references. Produces base36 hash strings used as cache keys throughout the framework. |

### Helper System

| File | Exports | Purpose |
|------|---------|---------|
| `helper.ts` | `Helper<State, Options, Events>`, `HelperState`, `HelperOptions` | Abstract base class for all registered components. Has `uuid`, `state: State<T>`, internal `Bus`, `options`, `context`, `container` getter. Supports `introspect()` / `introspectAsText()` (static and instance). `afterInitialize()` hook called in constructor. `hide()` makes properties non-enumerable for cleaner REPL display. Static `shortcut`, `description`, `stateSchema`, `optionsSchema`, `eventsSchema`. |
| `feature.ts` | `Feature<State, Options>`, `FeaturesRegistry`, `features` (singleton), `AvailableFeatures` | Extends Helper. Adds `enable()` which attaches the feature as a property on the container and emits `featureEnabled`. `isEnabled` getter. The `AvailableFeatures` interface is extended via module augmentation as features register. The `features` singleton is the global FeaturesRegistry. |
| `client.ts` | `Client`, `RestClient`, `GraphClient`, `WebSocketClient`, `ClientsRegistry`, `clients`, `AvailableClients` | Client extends Helper with `connect()`, `isConnected`, `baseURL`. RestClient wraps axios with `get/post/put/patch/delete`. GraphClient is a placeholder. WebSocketClient opens a native WebSocket. Static `attach()` adds `clients` registry and `client()` factory to a container. |
| `server.ts` | `Server`, `ServersRegistry`, `servers`, `AvailableServers`, `ServersInterface` | Server extends Helper with `start()`, `stop()`, `configure()` (finds open port). State tracks `port`, `listening`, `configured`, `stopped`. Static `attach()` adds `servers` registry and `server()` factory. |
| `command.ts` | `Command`, `CommandsRegistry`, `commands`, `AvailableCommands`, `CommandHandler` | Command extends Helper with `execute()` (override), `run()` (lifecycle: started → execute → completed/failed), `parseArgs()`. The registry has `registerHandler()` for quick command creation without subclassing, and `discover()` for file-based auto-registration. |
| `endpoint.ts` | `Endpoint`, `EndpointsRegistry`, `endpoints`, `EndpointModule`, `EndpointHandler`, `EndpointContext` | Endpoint extends Helper for file-based HTTP routes (Remix-style). Supports `get/post/put/patch/delete` handlers with Zod validation. `load()` imports an endpoint module, `mount(app)` registers routes on Express. `toOpenAPIPathItem()` generates OpenAPI spec fragments. |
| `registry.ts` | `Registry<T>` | Abstract named registry for helper types. Has `scope` string, `register(id, constructor)`, `lookup(id)`, `has(id)`, `available` (string[]), `describe(id)`, `describeAll()`, `introspect(id)`. Own event bus for registry events. |

### Container

| File | Exports | Purpose |
|------|---------|---------|
| `container.ts` | `Container`, `ContainerArgv`, `ContainerContext`, `ContainerState`, `Plugin`, `Extension`, `AvailableInstanceTypes`, `z` | The core DI container. Has `uuid`, `state`, internal `Bus`, `features` registry (via Proxy for enabled feature access), `feature()` factory with hash-based caching, `use()` for plugins, `context` getter (enabled features + custom context + container ref), `utils` (hashObject, stringUtils, uuid, lodash subset), environment detection (`isBrowser`, `isNode`, `isBun`, etc.), `registerHelperType()`, `inspect()` / `inspectAsText()` for container-level introspection, `bus()` and `newState()` convenience factories. Re-exports `z` from zod. |

### Schemas

| File | Exports | Purpose |
|------|---------|---------|
| `schemas/base.ts` | All Zod schemas for state/options/events of every helper type, `describeZodShape()`, `describeEventsSchema()`, `createHelperSchemas()` | Central schema definitions. Each helper type (Helper, Feature, Client, Server, Command, Endpoint) has `*StateSchema`, `*OptionsSchema`, `*EventsSchema`. `describeZodShape()` converts a ZodObject into `{ field: { type, description } }` for introspection. `describeEventsSchema()` does the same for event tuple schemas. |

### Introspection

| File | Exports | Purpose |
|------|---------|---------|
| `introspection/index.ts` | `introspect()`, `setBuildTimeData()`, `interceptRegistration()`, `setContainerBuildTimeData()`, `getContainerBuildTimeData()`, `__INTROSPECTION__`, `__CONTAINER_INTROSPECTION__`, type definitions | The runtime introspection registry. `__INTROSPECTION__` is a `Map<string, HelperIntrospection>` populated from two sources: (1) build-time AST data via `setBuildTimeData()` from generated files, and (2) runtime Zod schema data via `interceptRegistration()` called when helpers register. Types: `HelperIntrospection`, `MethodIntrospection`, `GetterIntrospection`, `EventIntrospection`, `ContainerIntrospection`, `RegistryIntrospection`. |
| `introspection/scan.ts` | `IntrospectionScannerFeature` | Feature that uses the TypeScript compiler API to AST-parse source files, extracting JSDoc comments, method signatures, getter types, and event definitions from Helper subclasses. Used by the build script to generate introspection data. |
| `introspection/generated.node.ts` | (side-effect) | Auto-generated file. Calls `setBuildTimeData()` for every node feature, populating the introspection registry with AST-extracted metadata. |
| `introspection/generated.web.ts` | (side-effect) | Same as above for web features. |
| `introspection/generated.agi.ts` | (side-effect) | Same as above for AGI features plus container introspection. |

### Entrypoints

| File | Exports | Purpose |
|------|---------|---------|
| `node.ts` | `default` (NodeContainer singleton), `servers`, `features`, `clients`, `ui`, `fs`, `vm`, `proc` | Node entrypoint. Creates a `NodeContainer`, imports `generated.node.ts` for introspection data, and exports the singleton plus commonly-used feature instances. |
| `browser.ts` | `default` (WebContainer singleton), re-exports from `web/container.ts` | Browser entrypoint. Creates a `WebContainer` singleton, imports `generated.web.ts`. |

### CLI

| File | Exports | Purpose |
|------|---------|---------|
| `cli/cli.ts` | (executable) | The `luca` CLI entry point. Imports the AGI container and registered commands. Routes `argv[0]` to the matching command, or falls back to `run` for implicit script execution. Shows usage help if no arguments provided. |

---

## `src/node/` — Node/Bun Platform Layer

| File | Exports | Purpose |
|------|---------|---------|
| `container.ts` | `NodeContainer`, `NodeFeatures`, `Feature`, `features`, `State`, all feature types | Extends `Container` with Node-specific capabilities. Auto-enables core features on construction: `fs`, `proc`, `git`, `grep`, `os`, `networking`, `ui`, `vm`. Attaches `Client`, `Server`, `Command`, `Endpoint` helper types. Provides `cwd`, `manifest`, `argv`, `paths` (join, resolve, relative, dirname, parse), `urlUtils`. Imports all node features as side effects. |
| `feature.ts` | `Feature`, `features`, `FeatureState`, `FeatureOptions` | Node-specific Feature subclass with a typed `container` getter returning `NodeContainer`. |

### `src/node/features/` — Node Features

All features follow the same pattern: extend `Feature`, declare a `static shortcut`, define `stateSchema`/`optionsSchema`/`eventsSchema`, register with `features.register()`, and augment `AvailableFeatures`.

**Auto-enabled** (instantiated when NodeContainer is created):

| Feature | Class | Description |
|---------|-------|-------------|
| `fs` | FS | Filesystem operations relative to cwd: readFile, readdir, walk, findUp, exists, readJson, writeFileAsync, ensureFile, rm, rmdir, and more. |
| `proc` | ChildProcess | Execute external processes: exec, execAndCapture, spawnAndCapture, runScript. Captures stdout/stderr and exit codes. |
| `git` | Git | Git repository utilities: lsFiles, branch, sha, isRepo, isRepoRoot, repoRoot, status information. |
| `grep` | Grep | Search file contents with regex patterns, case-insensitive matching, file type filtering, and context lines. |
| `os` | OS | Operating system info: arch, platform, tmpdir, homedir, cpuCount, hostname, networkInterfaces, macAddresses. |
| `networking` | Networking | Network utilities: findOpenPort, isPortOpen. |
| `ui` | UI | Terminal UI toolkit: ASCII art with figlet, colored text with chalk, markdown rendering, interactive prompts, banners, gradients. |
| `vm` | VM | Code execution in isolated Node.js vm contexts with controlled variable access. |

**On-demand** (created when explicitly requested):

| Feature | Class | Description |
|---------|-------|-------------|
| `diskCache` | DiskCache | File-backed key-value store using cacache. Supports get/set/has/rm/keys, large blob storage, optional encryption via Vault. |
| `contentDb` | ContentDb | Turns a folder of structured markdown files into a queryable collection system via the Contentbase library. |
| `downloader` | Downloader | Download files from URLs to the local filesystem. |
| `esbuild` | ESBuild | Compile TypeScript/ESM to JavaScript at runtime using esbuild. |
| `fileManager` | FileManager | File scanning and watching system. Monitors directory changes, maintains file index, supports glob matching. |
| `ipcSocket` | IpcSocket | Inter-process communication via Unix domain sockets. Server/client modes, JSON serialization, broadcast messaging. |
| `jsonTree` | JsonTree | Loads JSON files from a directory into a hierarchical tree with camelCase property mapping. |
| `mdxBundler` | MdxBundler | Compiles MDX (Markdown + JSX) into executable JavaScript using mdx-bundler. |
| `opener` | Opener | Opens files/URLs with the system default application. HTTP URLs open in Chrome. |
| `packageFinder` | PackageFinder | Scans and indexes npm packages in a directory for lookup, duplicate detection, and dependency analysis. |
| `portExposer` | PortExposer | Exposes local ports to the public internet via ngrok with session management. |
| `python` | Python | Manages Python environments (uv, conda, venv, system). Detects environment, installs deps, executes scripts. |
| `repl` | Repl | Interactive REPL with readline, command history persistence, and tab autocomplete. |
| `runpod` | Runpod | Manages RunPod GPU cloud pods: list templates, available GPUs, create/manage compute instances. |
| `secureShell` | SecureShell | SSH command execution and SCP file transfer with password and key-based authentication. |
| `telegram` | Telegram | Telegram bot integration via grammy. Polling and webhook modes for handling updates and commands. |
| `vault` | Vault | AES-256-GCM encryption/decryption for secure data storage with secret key management. |
| `yamlTree` | YamlTree | Loads YAML files from a directory into a hierarchical tree (like JsonTree but for YAML). |
| `yaml` | YAML | Parse YAML strings to objects and stringify objects to YAML via js-yaml. |
| `docker` | Docker | Docker container/image management: list, create, start, stop, exec, pull, build, logs, prune. |
| `ink` | Ink | React-for-CLIs via the Ink library. Build rich terminal UIs with React components. |

---

## `src/web/` — Browser Platform Layer

| File | Exports | Purpose |
|------|---------|---------|
| `container.ts` | `WebContainer`, `WebFeatures`, `Client`, `RestClient`, `SocketClient` | Browser container. Extends Container, attaches Client registry and all web features/clients via the extension module. |
| `feature.ts` | `Feature`, `features`, `AvailableFeatures` | Browser-specific Feature subclass with typed `container` getter returning `WebContainer`. |
| `extension.ts` | `attach(container)` | Plugin that registers all web features and clients onto a container in one call. |

### `src/web/features/` — Browser Features

| Feature | Class | Description |
|---------|-------|-------------|
| `assetLoader` | AssetLoader | Inject scripts and stylesheets into the page. Convenient `unpkg()` method for loading npm packages. |
| `esbuild` | Esbuild | Compile/transform JS/TS in the browser using esbuild-wasm. |
| `mdxLoader` | MdxLoader | Load and compile MDX source into React components at runtime. |
| `network` | Network | Track browser online/offline status with observable state. |
| `speech` | Speech | Text-to-speech synthesis with voice selection and configuration. |
| `vault` | WebVault | Client-side AES-GCM encryption/decryption using the Web Crypto API. |
| `vm` | VM | Sandboxed JS execution in the browser with context injection. |
| `voice` | VoiceRecognition | Speech-to-text via Web Speech API with continuous listening and transcript accumulation. |

### `src/web/clients/` — Browser Clients

| Client | Class | Description |
|--------|-------|-------------|
| `socket` | SocketClient | WebSocket client with optional auto-reconnection for real-time bidirectional communication. |

### `src/web/shims/`

Contains `isomorphic-vm.ts` — a browser polyfill for Node's `vm` module using the Function constructor.

---

## `src/agi/` — AI/AGI Layer

| File | Exports | Purpose |
|------|---------|---------|
| `container.server.ts` | `AGIContainer`, `ConversationFactoryOptions`, `default` (singleton) | Extends NodeContainer with AI capabilities. Uses OpenAIClient, ClaudeCode, OpenAICodex, Conversation, SkillsLibrary, ConversationHistory. Initializes a `docs` ContentDb pointed at `docs/`. Provides a `conversation()` convenience factory for creating conversations with tools and system prompts. |
| `index.ts` | `default` (re-exports AGI container) | Convenience re-export. |
| `openai-client.ts` | `OpenAIClient` | Client wrapper for the OpenAI API. Manages API key, org, project, model config. Tracks request counts, token usage, timing. Methods: `createChatCompletion`, `createEmbedding`, `createImage`, `listModels`, `ask`, `chat`, `raw` (direct SDK access). |
| `README.md` | (documentation) | Brief description of the AGI module. |

### `src/agi/features/` — AGI Features

| Feature | Class | Description |
|---------|-------|-------------|
| `claude-code` | ClaudeCode | Integrates with the Claude CLI. Manages subprocess communication with streaming JSON events (init, assistant messages, tool calls, results). Provides `run()`, `start()` (background), `abort()`, progress tracking hooks. |
| `conversation` | Conversation | Multi-turn OpenAI conversations with tool integration. Manages message history, streaming responses, and automatic tool-call loops. Supports text and image content. |
| `conversation-history` | ConversationHistory | Persistent storage/retrieval of conversations. Save, load, search with filtering by tags, threads, models, date ranges. Metadata tracking. |
| `docs-reader` | DocsReader | Wraps a ContentDb to provide conversational document querying. Creates a Conversation with tools that find and read relevant documents to answer questions. |
| `openai-codex` | OpenAICodex | Similar to ClaudeCode but for OpenAI's Codex. Handles streaming JSON events for messages, function calls, tool results, and exec commands. |
| `openapi` | OpenAPI | Loads and parses OpenAPI specifications. Extracts endpoint info (operationId, method, path, summary) into a queryable format. |
| `skills-library` | SkillsLibrary | Manages skills loaded from markdown files with frontmatter. Skills have name, description, version, tags, instructions. Provides discovery and access tools. |

### `src/agi/endpoints/` — AGI HTTP Endpoints

File-based routing (Remix-style). Each file exports HTTP method handlers.

| File | Path | Methods | Description |
|------|------|---------|-------------|
| `ask.ts` | `/ask` | POST | Accept a question with optional context and stream flag. |
| `conversations.ts` | `/api/conversations` | GET | List/search conversations with filtering by tag, thread, model, text. Pagination support. |
| `conversations/[id].ts` | `/api/conversations/:id` | GET, DELETE | Retrieve or delete a specific conversation by ID. |
| `experts.ts` | `/api/experts` | GET | List available experts by scanning `experts/*/SYSTEM-PROMPT.md` files. |

---

## `src/servers/` — Server Implementations

| File | Class | Shortcut | Description |
|------|-------|----------|-------------|
| `express.ts` | ExpressServer | `servers.express` | HTTP server wrapping Express.js. CORS, static file serving, file-based endpoint registration via `useEndpoints(dir)`, OpenAPI spec generation via `serveOpenAPISpec()`. |
| `socket.ts` | WebsocketServer | `servers.websocket` | WebSocket server for real-time bidirectional communication. Optional auto JSON parsing, broadcast to all clients. |

---

## `src/clients/` — Client Implementations

| File | Class | Description |
|------|-------|-------------|
| `client-template.ts` | MyClient | Template/example showing how to extend RestClient with custom state schema and registration. |
| `civitai/index.ts` | CivitaiClient | REST client for the Civitai model marketplace API. Model search, checkpoint/LoRA/embedding downloads. |
| `comfyui/index.ts` | ComfyUIClient | REST + WebSocket client for ComfyUI (Stable Diffusion). Queue management, workflow execution, progress tracking. |

---

## `src/commands/` — Built-in CLI Commands

| File | Command | Description |
|------|---------|-------------|
| `serve.ts` | `luca serve` | Start the Express API server with file-based endpoints, static file serving, and OpenAPI spec. |
| `console.ts` | `luca console` | Launch an interactive REPL with all container features in scope and tab autocomplete. |
| `run.ts` | `luca run <file>` | Execute a script file (.ts, .js) or a markdown runbook (.md with code blocks). Markdown mode renders prose and executes code blocks sequentially. |
| `index.ts` | (barrel) | Re-exports Command types and side-effect imports each command for registration. |

---

## `docs/` — Documentation

| File | Purpose |
|------|---------|
| `codebase-explainer.md` | This file. Comprehensive codebase map for developers and AI agents. |
| `philosophy.md` | Core vision: container-as-REPL, Docker-style layering (Platform → Domain → Application), the 60-95% solution. |
| `principles.md` | Design principles: 20 years of pattern reuse, "boss with lieutenants" architecture (state machine + event bus), guiding developers/AI toward consistent structures. |
| `ideas/` | Feature ideas and brainstorming (currently empty). |

---

## `scripts/` — Build and Development Scripts

| File | npm Script | Purpose |
|------|------------|---------|
| `explain-codebase.ts` | `bun run explain-codebase` | Uses Claude Code to generate an AI-powered explanation of the project structure. Tracks tokens and elapsed time. |
| `scaffold.ts` | `bun run scripts/scaffold.ts` | Interactive CLI tool to generate boilerplate for new Features, Clients, Servers, or Endpoints with proper naming conventions. |
| `update-introspection-data.ts` | `luca update-introspection` | Runs IntrospectionScannerFeature against three source trees (node, web, agi) and outputs generated metadata files. Now a proper luca command in `commands/update-introspection.ts`. |
| `scratch.ts` | `bun run scripts/scratch.ts` | Quick scratch/test script for ad-hoc experimentation. |

### `scripts/examples/` — Usage Examples

Runnable example scripts demonstrating various framework capabilities:

| File | Demonstrates |
|------|-------------|
| `docs-reader.ts` | Querying documentation through conversational tools |
| `excalidraw-expert.ts` | Building an expert assistant for Excalidraw diagrams |
| `file-manager.ts` | File scanning and watching |
| `ideas.ts` | Working with idea documents |
| `interactive-chat.ts` | Multi-turn chat with OpenAI |
| `openai-tool-calls.ts` | OpenAI function calling with tool definitions |
| `opening-a-web-browser.ts` | Using the opener feature |
| `telegram-bot.ts` | Building a Telegram bot |
| `using-claude-code.ts` | Running Claude Code programmatically |
| `using-contentdb.ts` | Working with ContentDb collections |
| `using-conversations.ts` | Conversation feature usage |
| `using-disk-cache.ts` | DiskCache storage |
| `using-openai-codex.ts` | OpenAI Codex integration |
| `using-runpod.ts` | RunPod GPU cloud management |
| `vm-loading-esm-modules.ts` | Loading ESM modules in VM contexts |

---

## `test/` — Test Suite

Run with `bun test`. Uses Vitest with global test mode.

| File | Coverage |
|------|----------|
| `state.test.ts` | State class: initialization, get/set/delete, version tracking, observers, setState with partial and function |
| `bus.test.ts` | Bus class: emit/on/off/once, waitFor, event stats, history |
| `features.test.ts` | Feature registry, caching behavior, core feature smoke tests (OS, FS, VM, Networking, YAML) |
| `node-container.test.ts` | NodeContainer: uuid, cwd, environment detection, state, events, utils, plugin system |
| `clients-servers.test.ts` | Client/server registration, REST/Graph clients, Express server, connection lifecycle |
| `integration.test.ts` | End-to-end integration tests across multiple systems |

---

## Key Patterns

### Plugin / use() Pattern
```ts
container.use(Client)        // Calls Client.attach(container) → adds clients registry + factory
container.use(Server)        // Calls Server.attach(container) → adds servers registry + factory
container.use('featureName') // Enables a registered feature by string ID
container.use(SomePlugin)    // Calls SomePlugin.attach(container)
```

### Feature Registration Pattern
Every feature file ends with:
```ts
export default features.register('shortName', MyFeature)
```
And uses module augmentation for type safety:
```ts
declare module '../feature' {
  interface AvailableFeatures {
    shortName: typeof MyFeature
  }
}
```

### Feature Factory with Caching
```ts
container.feature('fs')                     // Returns cached singleton
container.feature('fs', { different: true }) // Different options → different instance
```
Cache key = `hashObject({ id, options, uuid: container.uuid })` — same args always return the same instance.

### Introspection Pipeline
1. **Build time:** `luca update-introspection` (command in `commands/update-introspection.ts`) runs `IntrospectionScannerFeature` to AST-parse all Helper subclasses, extracting JSDoc comments, method signatures, getter types, event definitions
2. **Output:** `src/introspection/generated.{node,web,agi}.ts` files that call `setBuildTimeData()`
3. **Runtime:** `interceptRegistration()` merges Zod schema info (state shape, options shape, event args) when features register with a registry
4. **Access:** `helper.introspect()` or `Helper.introspect()` returns `HelperIntrospection`, `helper.introspectAsText()` returns formatted markdown. `container.inspect()` / `container.inspectAsText()` for container-level introspection.

### Observable State
Both Container and Helper have `State<T>` objects. `state.observe(callback)` fires on every `set`/`delete`. Container re-emits `stateChange` on its event bus.

### Module Augmentation for Type Safety
Registering a new helper extends the corresponding interface:
```ts
declare module '../client' {
  interface AvailableClients {
    myApi: typeof MyApiClient
  }
}
// Now container.client('myApi', options) is fully typed
```

---

## Class Hierarchy

```
State<T>                         # Observable state store
Bus<T>                           # Typed event emitter with stats
Registry<T extends Helper>      # Named helper registry
  ├── FeaturesRegistry           # scope: "features"
  ├── ClientsRegistry            # scope: "clients"
  ├── ServersRegistry            # scope: "servers"
  ├── CommandsRegistry           # scope: "commands"
  └── EndpointsRegistry          # scope: "endpoints"

Container                        # Core DI container (platform-agnostic)
  ├── NodeContainer              # Server-side (auto-enables core features, has Client/Server/Command/Endpoint)
  │   └── AGIContainer           # AI agent container (OpenAI, Claude, conversations, skills)
  └── WebContainer               # Browser-side (speech, voice, assets, network)

Helper<State, Options, Events>   # Abstract base for all helpers
  ├── Feature                    # Enableable helper with container attachment
  │   ├── (Node Feature)         # Typed container → NodeContainer
  │   └── (Web Feature)          # Typed container → WebContainer
  ├── Client                     # Connectable helper with baseURL
  │   ├── RestClient             # Axios-based HTTP (get/post/put/patch/delete)
  │   │   ├── GraphClient        # Placeholder for GraphQL
  │   │   ├── CivitaiClient      # Civitai model marketplace
  │   │   └── ComfyUIClient      # ComfyUI Stable Diffusion
  │   ├── WebSocketClient        # Native WebSocket client
  │   └── OpenAIClient           # OpenAI API wrapper
  ├── Server                     # Startable/stoppable helper with port management
  │   ├── ExpressServer          # Express.js HTTP server
  │   └── WebsocketServer        # ws-based WebSocket server
  ├── Command                    # CLI command with execute/run lifecycle
  └── Endpoint                   # File-based HTTP route with validation
```

---

## Package.json Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `build` | `mkdist --declaration --ext=js` | Build library to `dist/` with type declarations |
| `build:introspection` | `luca update-introspection` | Regenerate introspection metadata files |
| `compile` | `bun build ./src/cli/cli.ts --compile --outfile dist/luca` | Build single-file `luca` CLI executable |
| `typecheck` | `tsc -p tsconfig.json --noEmit` | Type-check the entire project |
| `explain-codebase` | `bun run scripts/explain-codebase.ts` | AI-generated codebase explanation |
| `clean` | `rm -rf dist build package` | Clean build artifacts |

---

## Key Dependencies

| Package | Used For |
|---------|----------|
| `zod` | Schema validation for all Helper state, options, and events. Runtime introspection via `toJSONSchema()`. |
| `lodash-es` | Utility functions (exposed on `container.utils.lodash`) |
| `axios` | HTTP client underlying RestClient |
| `openai` | OpenAI SDK (AGI layer) |
| `express` + `cors` | ExpressServer |
| `ws` | WebSocket server |
| `esbuild` / `esbuild-wasm` | Build tooling + runtime compilation features |
| `node-uuid` | UUID generation |
| `inflect` | pluralize/singularize (exposed on `container.utils.stringUtils`) |
| `js-yaml` | YAML feature |
| `chokidar` | File watching (FileManager) |
| `inquirer` | Interactive CLI prompts (UI wizard) |
| `figlet` + `chalk` | Terminal ASCII art and colored text (UI feature) |
| `ink` + `react` | React-for-CLIs terminal UI |
| `cacache` | Content-addressable cache (DiskCache) |
| `grammy` | Telegram bot framework |
| `@ngrok/ngrok` | Port exposer tunnel |
| `contentbase` | Structured markdown document collections (local package) |
| `@modelcontextprotocol/sdk` | MCP server support |
| `@openai/codex` | OpenAI Codex integration |
| `marked` + `marked-terminal` | Markdown rendering in terminal |
| `mdx-bundler` | MDX compilation |
