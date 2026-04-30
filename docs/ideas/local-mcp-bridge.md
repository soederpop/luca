---
title: Local MCP Bridge
status: exploring
tags:
  - mcp
  - openai
  - luca
  - assistants
goal: 
needs: []
---

# Local MCP Bridge

OpenAI does not talk directly to local MCP servers, but Luca assistants can bridge that gap by treating MCP as a backend protocol rather than a model protocol.

## Problem

The Luca assistant uses `conversation`, which wraps the Chat Completions or Responses APIs. That means local MCP servers are not natively available to the OpenAI model in the way they are in clients that speak MCP directly.

This creates an annoying gap:

- local MCP tools exist
- the assistant runtime can access local processes and local services
- but the model cannot directly use those MCP capabilities

## Core Idea

Implement an MCP client bridge inside Luca and expose MCP-backed capabilities as normal assistant tool calls.

Instead of:

- model ↔ MCP server directly

Use:

- model ↔ Luca conversation tool calls ↔ MCP bridge ↔ local MCP server

To the model, these would just look like normal tools.

## Two Possible Approaches

### 1. Generic bridge tools

Expose a small set of generic tools such as:

- `listMcpServers()`
- `listMcpTools({ server })`
- `callMcpTool({ server, tool, arguments })`
- `readMcpResource({ server, uri })`
- `getMcpPrompt({ server, name, arguments })`

#### Pros
- simple to build
- one bridge can support everything
- easy to debug

#### Cons
- worse ergonomics for the model
- more prompt burden
- requires multi-step reasoning for discovery and invocation

### 2. Materialized MCP tools

At startup, connect to configured local MCP servers, discover their tools, and register them as first-class assistant tools.

Examples:

- `github_search_code`
- `figma_get_file`
- `postgres_query`

#### Pros
- much better model UX
- feels native
- less need for generic discovery flows

#### Cons
- more implementation complexity
- naming collisions need handling
- requires refresh/reload behavior if server capabilities change

## Recommended Architecture

A hybrid approach is probably best.

### Layer 1: MCP bridge feature

Create a Luca feature responsible for:

- reading MCP server configuration
- spawning or connecting to local MCP servers
- managing transports such as stdio
- discovering tools, prompts, and resources
- calling MCP tools
- caching capabilities and schemas

Conceptually:

```ts
class McpBridge {
  async connectServer(config) {}
  async listTools(serverName) {}
  async callTool(serverName, toolName, args) {}
  async listResources(serverName) {}
  async readResource(serverName, uri) {}
  async listPrompts(serverName) {}
  async getPrompt(serverName, name, args) {}
}
```

### Layer 2: Assistant tool adapter

Expose bridge capabilities to the assistant as either:

- generic bridge tools for discovery and invocation
- dynamically materialized first-class tools for better UX

### Layer 3: Prompt contract

Add a small instruction block telling the assistant:

- local MCP-backed capabilities may be available
- prefer direct bridged tools when present
- use generic bridge discovery tools when needed
- treat these as ordinary tools rather than protocol-level interactions

## Prompting Strategy

Do not make the model speak MCP wire protocol directly.

Instead, teach it about the available tools in normal tool-call terms.

Example:

```md
You can access local MCP-backed capabilities through these tools:

- github_search_code(query, repo?)
- docs_lookup(topic)
- postgres_query(sql)

These tools are backed by local MCP servers. Use them like normal tools.
If you need more detail, call `mcp_describe_capabilities`.
```

The model does not need to know anything about MCP internals if the bridge handles protocol details.

## What Not To Do

### Do not make the model manually emit MCP protocol messages
That is fragile, token-heavy, and unnecessary.

### Do not dump huge tool catalogs into every prompt
Only expose relevant tools or provide compact discovery mechanisms.

### Do not leak transport details into the assistant prompt
Keep protocol and connection management in code, not in instructions.

## Good V1

A realistic first version:

- build `features/mcp-bridge.ts`
- support local stdio MCP servers
- expose generic assistant tools:
  - `listMcpCapabilities`
  - `useMcpTool`
- add a short prompt instruction describing how to use them

This would already enable local MCP access through OpenAI-backed Luca assistants.

## Better V2

Once the basics work, add:

- dynamic per-tool registration
- server health checks
- connection reuse
- schema validation
- namespacing like `server__toolName`
- caching of discovered capabilities
- support for MCP resources and prompts, not just tools

## Alternative: Separate Bridge Service

Another option is a standalone local bridge service:

- bridge talks MCP to local servers
- Luca talks HTTP, WebSocket, or IPC to the bridge
- assistants call bridge-backed tools

This could be useful if multiple assistants need shared access or if process isolation is helpful.

Still, embedding this as a Luca feature is probably the simplest first implementation.

## Recommendation

Build this as a Luca MCP bridge feature and expose it to `conversation` as ordinary tool calls.

Best first path:

1. support stdio MCP servers
2. expose generic discovery and invocation tools
3. later materialize high-value MCP tools as first-class assistant tools

That should provide local MCP access for OpenAI-backed assistants without requiring native MCP support in the OpenAI API.
