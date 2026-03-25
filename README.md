# Luca

**Lightweight Universal Conversational Architecture**

A single binary CLI that ships 40+ self-documenting features, clients, and servers. No `npm install`, no setup — download it and start building.

Luca gives you a `container` object — think of it like a Docker container for your application runtime. It's a per-process singleton, event bus, state machine, and dependency injector all in one. Layer your own features, clients, servers, commands, and endpoints on top of the base `NodeContainer` (server) or `WebContainer` (browser), then bundle it into your own single-file executable or browser build.

The `AGIContainer` extends the node stack with features, clients, and servers for building AI assistants — wrappers around major coding models, tool orchestration, and UIs to visualize them working.

## Installation

### Download the binary

Grab the latest release for your platform from [GitHub Releases](https://github.com/soederpop/luca/releases/latest):

| Platform | Binary |
|----------|--------|
| macOS (Apple Silicon) | `luca-darwin-arm64` |
| macOS (Intel) | `luca-darwin-x64` |
| Linux x64 | `luca-linux-x64` |
| Linux ARM64 | `luca-linux-arm64` |
| Windows x64 | `luca-windows-x64.exe` |

**Quick install (macOS/Linux):**

```sh
# Download (replace PLATFORM with your arch, e.g. darwin-arm64)
curl -L -o luca https://github.com/soederpop/luca/releases/latest/download/luca-PLATFORM
chmod +x luca
sudo mv luca /usr/local/bin/
```

### macOS Gatekeeper warning

The binary is not yet code-signed (code signing is in progress). On first run macOS will block it with *"luca can't be opened because Apple cannot check it for malicious software."*

To allow it:

1. **System Settings** > **Privacy & Security** > scroll down to the Security section
2. You'll see a message about `luca` being blocked — click **Allow Anyway**
3. Run `luca` again and click **Open** in the confirmation dialog

Or from the terminal:

```sh
xattr -d com.apple.quarantine /usr/local/bin/luca
```

After that it runs without interruption.

### Verify

```sh
luca --version
# luca v0.0.34 (main@325a0ee) built 2026-03-25T06:10:28Z
```

## Quick Start

### Bootstrap a new project

```sh
luca bootstrap my-app
cd my-app
```

Or just run `luca bootstrap` and it'll ask you for a project name. This scaffolds a project with `commands/`, `endpoints/`, `features/`, `docs/`, and AI assistant configuration — everything wired up and ready to extend.

### Explore

```sh
luca                              # list all commands
luca describe features            # index of 40+ features
luca describe fs                  # full docs for any feature
luca describe fs.readFile         # drill into a specific method
luca eval "container.features.available"  # run code with the container in scope
luca console                      # full REPL
```

### Run scripts and markdown

`luca run` executes TypeScript, JavaScript, and markdown files. Markdown files have their code blocks executed in order, with `container` already in scope — no imports needed:

````md
# my-script.md

Grab some data and print it:

```ts
const fs = container.feature('fs')
const files = await fs.readdir('.')
console.log(`Found ${files.length} files`)
```

Then do something with it:

```ts
const yaml = container.feature('yaml')
console.log(yaml.stringify({ files }))
```
````

```sh
luca run my-script.md
```

Each block shares state with the previous ones, so variables defined in one block are available in the next. Use `--safe` to require approval before each block, or `--console` to drop into a REPL afterward with all the accumulated context.  **Note:** if your block uses top-level awaits, we can't preserve context.  You can use `container.addContext({ yourVariable })` and it will be available as a global variable in future blocks.

### Serve

```sh
luca serve   # serves endpoints/ folder as HTTP routes
```

See [`docs/CLI.md`](./docs/CLI.md) for the full CLI reference.

## How It Works

### Self-documenting at runtime

Every helper (feature, client, server) carries its own introspection metadata — constructor options, observable state shape, events emitted, environment variables used, method signatures. This powers `luca describe`, works in the REPL, and enables metaprogramming.

```ts
import container from '@soederpop/luca'

container.features.available   // ['fs','git','proc','vault',...]
container.clients.available    // ['rest','websocket']
container.servers.available    // ['express','websocket','ipc','mcp']

container.features.describe()  // markdown summary of all features
container.feature('fs').introspect()          // json
container.feature('fs').introspectAsText()    // markdown
```

### Content-aware documentation

The node container includes `container.docs` powered by [Contentbase](https://github.com/soederpop/contentbase) — query your project's markdown documentation like a database:

```ts
await container.docs.load()
const { Tutorial } = container.docs.models
const tutorials = await container.docs.query(Tutorial).fetchAll()
```

### Project extensions

Drop files into convention-based folders and they're auto-discovered:

- `commands/` — custom CLI commands, run via `luca <name>`
- `endpoints/` — file-based HTTP routes, served via `luca serve`
- `features/` — custom container features

Generate boilerplate with `luca scaffold`:

```sh
luca scaffold command myTask --description "Automate something"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint users --description "User management API"
```

### Building an assistant

Features can inject their own tools into an assistant via `assistant.use()`. Here's an assistant that can browse the web:

```ts
import container from '@soederpop/luca'

const browser = container.feature('browserUse', { headed: true })
const assistant = container.feature('assistant', {
  systemPrompt: 'You are a web research assistant. Use your browser tools to find information.',
  model: 'gpt-4.1-mini',
})

// browserUse injects its tools — open, click, type, screenshot, extract, etc.
assistant.use(browser)
await assistant.start()

await assistant.ask('Go to hacker news and tell me what the top 3 stories are about')
```

### AI coding assistant integration

The CLI works great alongside Claude Code, Codex, and other coding assistants:

- `luca describe` gives assistants full API docs for any helper
- `luca eval` lets them test container expressions before committing code
- `luca sandbox-mcp` provides a REPL and doc browser as an MCP server

## Development

### Prerequisites

- [Bun](https://bun.sh) (runtime and test runner)

### Setup

```sh
git clone https://github.com/soederpop/luca.git
cd luca
bun install
```

### Running in dev

```sh
# Run the CLI from source (equivalent to the luca binary)
bun run src/cli/cli.ts

# Examples
bun run src/cli/cli.ts describe features
bun run src/cli/cli.ts eval "container.features.available"
```

### Testing

```sh
# Unit tests
bun test

# Integration tests (may require API keys / env vars)
bun run test:integration
```

### Building the binary

```sh
bun run compile
```

This runs the full pipeline: introspection generation, scaffold templates, bootstrap code, python bridge, build stamp, then compiles to `dist/luca` via Bun's native compiler.

### Project structure

```
src/
  cli/          CLI entry point and commands
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
