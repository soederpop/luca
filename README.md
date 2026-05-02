# Luca

**Lightweight Universal Conversational Architecture**
*(aka Le Ultimate Component Architecture)*

An agent-native TypeScript runtime that ships as a single binary — and builds yours too.

Luca gives humans and AI agents the same architectural map: one self-documenting `container` object with typed features, clients, servers, commands, state, events, and runtime docs. The agent doesn't guess at architecture — it discovers it. No `npm install`, no `node_modules`, no supply chain exposure, no ceremony.

## What Makes Luca Different

AI agents today either generate sprawling ad-hoc code or fight against frameworks that weren't designed for them. They don't know what's available, what conventions to follow, or where to put things. The result is brittle, unreviewable output that drifts further from the codebase with every generation.

Luca solves this with three ideas:

**One introspectable container.** Every Luca app has a single `container` — a dependency-injected runtime that carries features, clients, servers, commands, endpoints, observable state, and an event bus. Every component describes itself: constructor options, method signatures, events emitted, state shape. The human reads the same docs the agent reads. There is one way to do things.

**Single binary in, single binary out.** Luca ships as a standalone binary. No runtime dependencies, no package manager, no exposure to the npm supply chain. You use it to build your project, then compile your project into its own standalone binary with your custom commands, features, endpoints, and assistants baked in.

**The assistant is a first-class citizen.** Luca's `Assistant` class can `use()` any feature, client, or server in the container — inheriting its tools automatically. The assistant doesn't need hand-written tool definitions. It discovers capabilities from the runtime it's embedded in.

## Installation

```sh
curl -fsSL https://luca-js.soederpop.com/install.sh | bash
```

Detects your platform, downloads the binary, puts `luca` in your path. Done.

Or grab a release directly from [GitHub Releases](https://github.com/soederpop/luca/releases/latest):

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `luca-darwin-arm64` |
| macOS (Intel) | `luca-darwin-x64` |
| Linux x64 | `luca-linux-x64` |
| Linux ARM64 | `luca-linux-arm64` |
| Windows x64 | `luca-windows-x64.exe` |

```sh
luca --version
```

## Quick Start

```sh
luca bootstrap my-app
cd my-app
```

This scaffolds a project with `commands/`, `endpoints/`, `features/`, `docs/`, and AI assistant configuration — everything wired up and ready to extend.

Now explore what the runtime can do:

```sh
luca                              # list all commands
luca describe features            # see every available feature
luca describe fs                  # full docs for a specific feature
luca describe fs.readFile         # drill into a specific method
luca eval "container.features.available"  # run code against the live container
luca console                      # full REPL
```

This is the core loop: discover what's available, evaluate code against it, build on top of it. Your AI assistant does the same thing.

## The Container

One import. One object. Everything on it.

```ts
import container from '@soederpop/luca'

container.features.available   // ['fs', 'git', 'proc', 'vault', 'yaml', 'sqlite', ...]
container.clients.available    // ['rest', 'websocket', ...]
container.servers.available    // ['express', 'websocket', 'ipc', 'mcp', ...]
```

The container is a singleton — a per-process global that acts as dependency injector, event bus, and state machine. Features, clients, and servers are lazy-loaded from registries. Every helper carries introspection metadata that powers `luca describe`, the REPL, and agent tool discovery.

```ts
const fs = container.feature('fs')
const rest = container.client('rest', { baseURL: 'https://api.example.com' })
const server = container.server('express')
```

No imports beyond the container. No `require('fs')`, no `import axios`, no `npm install anything`. The container provides file I/O, HTTP clients, databases, YAML parsing, git operations, browser automation, terminal UI, semantic search, encryption, and more — all typed, all documented, all discoverable at runtime.

### In the browser

```js
import container from 'https://esm.sh/@soederpop/luca/web'
```

Same singleton pattern, optimized for browser features. `window.luca` is set automatically.

## Build an Assistant

The assistant is the interface that ties everything together. It can `use()` any module in the container, automatically inheriting that module's tools:

```ts
import container from '@soederpop/luca'

const browser = container.feature('browserUse', { headed: true })
const assistant = container.feature('assistant', {
  systemPrompt: 'You are a web research assistant.',
  model: 'gpt-4.1-mini',
})

// browserUse injects its tools — open, click, type, screenshot, extract, etc.
assistant.use(browser)
await assistant.start()

await assistant.ask('Go to hacker news and tell me the top 3 stories')
```

The assistant doesn't need hand-written tool schemas. When it calls `use(browser)`, it gets every tool that `browserUse` exposes — typed, documented, ready to invoke. Swap `browserUse` for `fs` or `git` or `sqlite` and the assistant gets a completely different toolkit from the same pattern.

This is what agent-native means: the runtime teaches the agent what it can do.

### The Assistant as Operator

Most agent frameworks give you a chat loop with tool calls bolted on. Luca gives you an agent that can operate real infrastructure.

The container has servers — REST, WebSocket, IPC. It has clients for all of them. It has process management, a VM, file I/O, databases, git, docker, SSH, even GPU compute over RunPod. The assistant can `use()` any combination of these, which means you can build agents that:

- **Stand up and manage servers** — spin up an Express server, add routes, react to incoming requests
- **Listen to events across transports** — WebSocket messages, IPC signals, HTTP webhooks, file system changes
- **Spawn and manage processes** — launch child processes, monitor their output, kill them when done — locally, over SSH, in Docker containers, or on remote GPU instances
- **Inspect and react to state** — every helper has observable state and an event bus; the assistant can watch for changes and act on them autonomously
- **Run code in a sandboxed VM** — execute untrusted code safely, evaluate expressions, build REPL-like workflows

The assistant isn't answering questions in a chat window. It's running your infrastructure, reacting to events in real time, and coordinating across multiple systems — all through the same `container` it already knows how to discover.

```ts
const assistant = container.feature('assistant', {
  systemPrompt: 'You manage the deployment pipeline. Monitor builds, restart failed services, report status.',
  model: 'gpt-4.1-mini',
})

assistant.use(container.feature('proc'))
assistant.use(container.server('express'))
assistant.use(container.server('websocket'))
assistant.use(container.feature('docker'))
assistant.use(container.feature('fs'))

await assistant.start()
```

That's an agent harness. Not a chatbot — an operator.

## Build Your Own Binary

Luca isn't just a tool you use — it's a tool that builds tools.

Bootstrap a project, add your own commands, features, endpoints, and assistants, then compile the whole thing into a standalone binary:

```sh
luca bootstrap my-tool
cd my-tool

# add your own commands, features, endpoints
luca scaffold command analyze --description "Run analysis on input data"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint status --description "Health check endpoint"

# compile to a single binary
luca bundle
```

The output is a self-contained executable. No node, no bun, no npm on the target machine. Your users download one file and run it. Your custom commands show up in `my-tool --help`. Your assistant ships inside.

## Project Structure

Convention-based folders are auto-discovered:

```
commands/       custom CLI commands → luca <name>
endpoints/      file-based HTTP routes → luca serve
features/       custom container features → container.feature('<name>')
assistants/     AI assistants with system prompts and tools
docs/           content documents queryable via container.docs
```

Generate boilerplate with `luca scaffold`:

```sh
luca scaffold command myTask --description "Automate something"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint users --description "User management API"
```

## Run Scripts and Markdown

`luca run` executes TypeScript, JavaScript, and markdown files with the container in scope:

````md
# my-script.md

```ts
const fs = container.feature('fs')
const files = await fs.readdir('.')
console.log(`Found ${files.length} files`)
```

```ts
const yaml = container.feature('yaml')
console.log(yaml.stringify({ files }))
```
````

```sh
luca run my-script.md
```

Blocks share state. Use `--safe` for approval before each block, `--console` to drop into a REPL afterward with accumulated context.

## AI Coding Assistant Integration

Luca is designed to work alongside Claude Code, Codex, and other AI coding assistants:

- `luca describe` gives the assistant full API docs for any helper — method signatures, options, events, state shape
- `luca eval` lets the assistant test container expressions before writing code
- `luca sandbox-mcp` exposes a REPL and doc browser as an MCP server

The assistant doesn't need to read source files to understand the framework. It asks the framework directly.

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime and test runner)

### Setup

```sh
git clone https://github.com/soederpop/luca.git
cd luca
bun install
bun run setup
```

### Running in dev

```sh
bun run src/cli/cli.ts                           # same as luca binary
bun run src/cli/cli.ts describe features
bun run src/cli/cli.ts eval "container.features.available"
```

### Testing

```sh
bun test                    # unit tests
bun run test:integration    # integration tests (may require API keys)
```

### Building the binary

```sh
bun run compile
```

Runs the full pipeline: introspection generation, scaffold templates, build stamp, then compiles to `dist/luca` via Bun's native compiler.

### Project structure

```
src/
  cli/          CLI entry point and built-in commands
  node/         NodeContainer and server-side features
  web/          WebContainer and browser features
  agi/          AGIContainer — AI assistant layer
  schemas/      Shared Zod schemas
  react/        React bindings
test/           Unit tests
test-integration/  Integration tests
docs/
  apis/         Generated API docs
  examples/     Runnable examples (luca run docs/examples/grep)
  tutorials/    Longer-form guides
```

## License

MIT
