# Luca

**Build the system. Put an agent inside it.**

Luca is a single binary that builds real applications — HTTP APIs, WebSocket services, CLIs, MCP servers, phone lines, terminal and browser UIs — with AI assistants as first-class parts of the runtime. The assistant uses the same tools, state, and events as your code. It answers over any transport you give it. It can inspect, extend, and rebuild the system it runs in. Then you compile all of it into a binary of your own.

Picture the difference: most agents are *clients* of your software — a chat window bolted onto the side. A Luca assistant is a *component* of it. When your API starts failing at 3am, the service, its state, and the tools to inspect it are already one object graph. There is nothing to wire together.

```ts
import container from 'luca'

const operator = container.feature('assistant', {
  folder: 'assistants/operator',        // CORE.md prompt + tools.ts + hooks.ts
})

operator.use(container.feature('secureShell', { host: 'staging-api' }))
operator.use(container.feature('docker'))
operator.use(container.feature('git'))

await operator.start()
await operator.ask('The API is returning 500s. Diagnose it and report.')
```

`use()` gives the assistant every tool that helper exposes — typed, documented, with operating notes injected into its prompt. No hand-written tool schemas, and no schemas drifting out of sync with the code, because the schemas *are* the code's own introspection.

78 features · 7 clients · 4 servers · zero install steps · MIT

## Install

```sh
curl -fsSL https://luca-js.soederpop.com/install.sh | bash
```

Detects your platform, downloads the binary, puts `luca` in your path. Or grab a release directly from [GitHub Releases](https://github.com/soederpop/luca/releases/latest):

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

That one file is the framework, the runtime, and the build tool. No `npm install`, no `node_modules`, no toolchain setup.

## Five Minutes to a Working Agent

```sh
luca bootstrap my-app
cd my-app
```

This scaffolds a project with `commands/`, `endpoints/`, `features/`, `assistants/`, and `docs/` — everything wired up, including a working default assistant. Talk to it:

```sh
luca chat
```

It answers questions about the framework by driving the same CLI you're about to learn. Now learn the core loop yourself — **discover, evaluate, build**:

```sh
luca                              # list all commands
luca describe features            # see every available feature
luca describe fs                  # full docs for one feature
luca describe fs.readFile         # drill into a single method
luca eval "container.features.available"   # run code against the live container
luca console                      # full REPL
```

This loop is the whole framework. Everything in the runtime describes itself — constructor options, method signatures, events, state shape — and `describe` renders those docs on demand. You read them, your AI coding assistant reads them, and your embedded assistant reads them. Same map for everyone.

Full walkthrough: [Getting Started](docs/tutorials/01-getting-started.md). Using Luca as a library inside an existing TypeScript app: [Embedding Luca](docs/tutorials/21-embedding-luca.md). How `eval`, `run`, and your command files actually execute: [The VM](docs/tutorials/26-the-vm.md).

## What Makes Luca Different

AI agents today either generate sprawling ad-hoc code or fight frameworks that weren't designed for them. They don't know what's available, what conventions to follow, or where to put things. The output drifts further from the codebase with every generation.

Luca's answer is three ideas:

**One introspectable container.** Every Luca app has a single `container` — a dependency-injected runtime carrying features, clients, servers, commands, endpoints, observable state, and an event bus. Every component describes itself at runtime. There is one way to do things, and the runtime can tell you what it is.

**Single binary in, single binary out.** Luca ships as one standalone binary with its dependencies compiled in and audited as a unit. You build your project with it, then compile your project into *its own* binary — commands, features, endpoints, and assistants baked in. Your users download one file.

**The assistant is a component, not a client.** `assistant.use(anyHelper)` inherits that helper's tools automatically. The assistant shares the container's state and events, answers over whatever servers you mount, and discovers capabilities from the runtime it lives in — the same way you do.

## The Container

One import. One object. Everything on it.

```ts
import container from 'luca'

container.features.available   // ['fs', 'git', 'proc', 'vault', 'yaml', 'sqlite', ...]
container.clients.available    // ['rest', 'websocket', 'graphql', ...]
container.servers.available    // ['express', 'websocket', 'ipc', 'mcp']
```

The container is a per-process singleton: dependency injector, event bus, and state machine in one. Helpers are lazy-loaded from registries, and every one carries the introspection metadata that powers `luca describe`, the REPL, and agent tool discovery.

```ts
const fs = container.feature('fs')
const rest = container.client('rest', { baseURL: 'https://api.example.com' })
const api = container.server('express')   // endpoints/ mount themselves
api.serveOpenAPISpec()                    // OpenAPI docs generated from the routes
```

What's in the box: file I/O, ripgrep, child processes and long-running process management, SSH, tmux, Docker, git, SQLite, Postgres, Redis, a locked cross-process store, a Markdown content database with semantic search, browser automation, Google Workspace, Telnyx telephony, Telegram, text-to-speech, a scheduler, a secrets vault, and more. All typed, all documented, all discoverable at runtime.

In the browser, the same singleton pattern works with browser-optimized features:

```js
import container from 'https://esm.sh/luca/web'
```

## The Assistant as Operator

Most agent frameworks give you a chat loop with tool calls bolted on. Luca gives you an agent that operates real infrastructure.

An assistant is a folder: `CORE.md` for the prompt, `tools.ts` for typed tools, `hooks.ts` for lifecycle. It is a feature like any other, so it shares the container's state and events. Compose its capabilities from the same helpers your code uses:

- **Stand up and manage servers** — spin up Express, add routes, react to incoming requests
- **Listen across transports** — WebSocket messages, IPC signals, HTTP webhooks, file changes
- **Spawn and manage processes** — locally, over SSH, in Docker, or on remote GPU instances
- **Read your team's knowledge** — a folder of Markdown with frontmatter becomes a typed, queryable database (`contentDb`); semantic search finds the right runbook before it touches anything
- **Watch and react to state** — every helper has observable state and events; the assistant can act on changes autonomously
- **Run code in a sandboxed VM** — and, if you grant it, delegate patches to Claude Code or Codex, run the tests, and report back

Then serve that one assistant to everyone at once: mount it as an MCP server for your team's coding agents, a WebSocket bridge for the dashboard, an HTTP route, a Telegram bot, or a phone number it provisions itself via Telnyx.

```ts
const mcp = container.server('mcp', { serverName: 'operator' })
mcp.tool('ask', { schema, handler: ({ question }) => operator.ask(question) })
await mcp.start()   // or: luca mcp --assistant operator
```

That's an agent harness. Not a chatbot — an operator.

## Build Your Own Binary

Luca isn't just a tool you use — it's a tool that builds tools.

```sh
luca bootstrap my-tool
cd my-tool

luca scaffold command analyze --description "Run analysis on input data"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint status --description "Health check endpoint"

luca bundle my-tool
```

The output is a self-contained executable. No node, no bun, no npm on the target machine. Your custom commands show up in `my-tool --help`. Your assistant ships inside.

## Run Scripts and Markdown

`luca run` executes TypeScript, JavaScript, and Markdown files with the container in scope:

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

Blocks share state. Use `--safe` to approve each block, `--console` to drop into a REPL afterward with the accumulated context.

## Works With Your Coding Agent

Luca is designed to work alongside Claude Code, Codex, and other AI coding assistants:

- `luca describe` gives the agent full API docs for any helper — signatures, options, events, state shape
- `luca eval` lets it test container expressions before committing to code
- `luca sandbox-mcp` exposes a REPL and doc browser as an MCP server

The agent doesn't reverse-engineer the framework from source. It asks the framework directly, and the answer can't drift from the code because it's generated from the code.

## FAQ

**What if I need a library that isn't a container feature?**
You're not locked out. Your project has a `package.json`; `bun add` the package and import it — the runtime resolves your project's `node_modules`, and `luca bundle` compiles the dependency into your binary. The convention is to wrap it in a custom feature (`luca scaffold feature`) so it gets the same introspection, docs, and assistant tools as everything else. The batteries-included surface is the default, not a wall.

**Is "no supply chain exposure" really true?**
The precise claim: the `luca` binary itself has no install step, so there is nothing to typosquat and no postinstall scripts run on your machine. You are still trusting Luca's curation of its compiled-in dependencies — that's a trade, not an elimination. What you get from the trade is one audited surface, one hash to verify, and one thing to patch instead of a thousand transitive packages.

**Why not Mastra, LangGraph, or the Vercel AI SDK?**
Those are agent libraries you add to an app. Luca is the app runtime with the agent inside it. The practical difference is introspection: in Luca the tool schemas, docs, and prompt guidance are generated from the same code that runs, so nothing is hand-maintained and nothing drifts. If you already have a stack and want a chat loop, use one of those. If you want an agent that operates the system it ships in, that's what Luca is for.

**Doesn't `bun build --compile` already give me a single binary?**
It compiles your code. It doesn't give you the introspectable runtime, the self-describing helpers, the assistant harness, auto-discovered commands and endpoints, or `describe`/`eval`/`scaffold`. Luca uses Bun's compiler under the hood; the binary is the delivery mechanism, not the product.

## Development

Requires [Bun](https://bun.sh) (runtime and test runner).

```sh
git clone https://github.com/soederpop/luca.git
cd luca
bun install

bun run src/cli/cli.ts describe features   # run the CLI from source
bun test                                   # unit tests
bun run test:integration                   # integration tests (may need API keys)
bun run compile                            # full pipeline → dist/luca
```

```
src/
  cli/          CLI entry point and built-in commands
  node/         NodeContainer and server-side features
  web/          WebContainer and browser features
  agi/          AGIContainer — AI assistant layer
  schemas/      Shared Zod schemas
  react/        React bindings
test/              Unit tests
test-integration/  Integration tests
docs/
  apis/         Generated API docs
  examples/     Runnable examples (luca run docs/examples/grep)
  tutorials/    Longer-form guides
```

## License

MIT
