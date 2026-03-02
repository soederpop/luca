# Luca CLI

The `luca` command-line interface provides commands for running scripts, starting servers, inspecting the container, and interacting with AI assistants.

## Usage

```
luca <command|file> [options]
```

When given a file path instead of a command name, luca delegates to `run` automatically.

---

## Commands

### help

Show help for luca commands.

```
luca help [command]
```

With no arguments, displays the full command list. Pass a command name to see its detailed usage.

---

### run

Run a script or markdown file (.ts, .js, .md).

```
luca run <file> [options]
```

Resolves the file by trying the path as-is, then appending `.ts`, `.js`, `.md` in order. Markdown files are executed block-by-block with the container in scope. TypeScript and JavaScript files are run as standalone scripts via `proc.runScript`.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--safe` | boolean | `false` | Require approval before each code block (markdown mode) |
| `--console` | boolean | `false` | Start an interactive REPL after executing a markdown file, with all accumulated context |

---

### serve

Start the API server with file-based endpoints.

```
luca serve [options]
```

Discovers endpoints from `endpoints/` or `src/endpoints/`, serves static files from `public/` or the current directory (if `index.html` exists), and starts an Express server.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--port` | number | `3000` | Port to listen on |
| `--endpoints-dir` | string | auto | Directory to load endpoints from |
| `--static-dir` | string | auto | Directory to serve static files from |
| `--setup` | string | | Path to a TS module whose default export receives the server instance |
| `--cors` | boolean | `true` | Enable CORS |
| `--force` | boolean | `false` | Kill any process currently using the target port |
| `--any-port` | boolean | `false` | Find an available port starting above 3000 |
| `--open` | boolean | `true` | Open the server URL in Google Chrome |

#### Setup scripts

The `--setup` flag lets you customize the Express server before it starts. The module is loaded through the VM, so `container` and all features are in the global scope. The default export receives the server helper instance.

```ts
// setup.ts
export default function (server) {
  const app = server.app

  app.use('/webhook', (req, res) => {
    res.json({ ok: true })
  })

  app.get('/health', (req, res) => {
    res.json({ status: 'healthy' })
  })
}
```

```
luca serve --setup setup.ts
```

---

### eval

Evaluate a JavaScript/TypeScript expression with the container in scope.

```
luca eval "<code>" [options]
```

All enabled features are available as top-level variables in the evaluation context.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | `false` | Serialize output as JSON |

**Examples:**

```
luca eval "container.features.available"
luca eval "fs.readdir('src')" --json
luca eval "networking.isPortOpen(3000)"
```

---

### console

Start an interactive REPL with all container features in scope.

```
luca console
```

All registered features are instantiated and available as top-level variables. If a `luca.console.ts` file exists in the project root, its exports are merged into the REPL scope.

---

### describe

Describe the container, registries, or individual helpers.

```
luca describe [target...] [options]
```

Targets can be:
- Nothing — shows command usage
- `container` — full container introspection
- A registry name: `features`, `clients`, `servers`, `commands`, `endpoints`
- A helper name: `fs`, `express`, `rest`, etc. (fuzzy-matched across registries)
- A qualified name: `features.fs`, `servers.express`

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--json` | boolean | `false` | Output introspection data as JSON instead of markdown |
| `--pretty` | boolean | `false` | Render markdown with terminal styling |
| `--no-title` | boolean | `false` | Omit the title header from output |
| `--description` | boolean | `false` | Show the description section |
| `--usage` | boolean | `false` | Show the usage section |
| `--methods` | boolean | `false` | Show the methods section |
| `--getters` | boolean | `false` | Show the getters section |
| `--events` | boolean | `false` | Show the events section |
| `--state` | boolean | `false` | Show the state section |
| `--options` | boolean | `false` | Show the options section |
| `--env-vars` | boolean | `false` | Show the envVars section |
| `--examples` | boolean | `false` | Show the examples section |

Section flags can be combined. When none are specified, all sections are shown.

**Examples:**

```
luca describe fs
luca describe servers
luca describe features.vm --methods --pretty
luca describe rest websocket --json
```

---

### chat

Start an interactive chat session with a local assistant.

```
luca chat [name] [options]
```

Discovers assistants from the configured folder (default `assistants/`). If multiple assistants are found and no name is given, prompts for selection.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--model` | string | | Override the LLM model for the assistant |
| `--folder` | string | `assistants` | Directory containing assistant definitions |

---

### prompt

Send a prompt file to an assistant, Claude Code, or OpenAI Codex and stream the response.

```
luca prompt <target> <path/to/prompt.md> [options]
```

The target can be:
- `claude` — runs the prompt through the Claude Code CLI
- `codex` — runs the prompt through the OpenAI Codex CLI
- Any other name — looks up a local assistant via `assistantsManager`

The prompt file is read as plain text and sent in full. Output streams to stdout as it arrives.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--model` | string | | Override the LLM model (assistant mode only) |
| `--folder` | string | `assistants` | Directory containing assistant definitions |

**Examples:**

```
luca prompt claude prompts/refactor.md
luca prompt codex prompts/add-tests.md
luca prompt my-assistant prompts/summarize.md --model gpt-4o
```

---

### mcp

Start an MCP (Model Context Protocol) server.

```
luca mcp [options]
```

Starts an MCP server that exposes the project's endpoints and tools to MCP-compatible clients.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--transport` | `stdio` \| `http` | `stdio` | Transport type |
| `--port` | number | `3001` | Port for HTTP transport |
| `--name` | string | auto | Server name reported to MCP clients |
| `--version` | string | auto | Server version reported to MCP clients |

---

### sandbox-mcp

Start an MCP server with a Luca container sandbox for AI agents to explore and test code.

```
luca sandbox-mcp [options]
```

Provides tools (`eval`, `inspect_container`, `list_registry`, `describe_helper`, `inspect_helper_instance`), prompts (`discover`, `introspect`), and resources (`luca://container/info`, `luca://features`) for AI agents to interact with the container.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--transport` | `stdio` \| `http` | `stdio` | Transport type |
| `--port` | number | `3002` | Port for HTTP transport |

---

## Project Commands

Any `commands/` folder in a project (or `~/.luca/commands/` globally) extends the CLI. For example, a file `commands/deploy.ts` becomes `luca deploy`. These modules are loaded through the VM and have full container access.
