# The Diplomat

An MCP server that starts with zero tools. As users interact with it, it uses the Expert system and container introspection to dynamically register new MCP tools and resources based on what the user needs. The server literally grows its own API surface in real time.

## The Demo

Start the Diplomat MCP server and connect to it from Claude Desktop. Initially it only has one tool: `ask` — you can ask it what it's capable of.

1. User asks: "Can you search my codebase?"
2. The Diplomat introspects the container, finds the `Grep` feature
3. Dynamically registers a `search_code` MCP tool wrapping `features.grep`
4. User immediately uses it: "Search for all TODO comments"
5. User asks: "Can you manage my Docker containers?"
6. The Diplomat finds the `Docker` feature, registers `list_containers`, `start_container`, `stop_container` tools
7. The tool list keeps growing based on demand

Next session, the Diplomat remembers what tools it created (via Identity) and starts with them pre-registered.

## What It Demonstrates

- MCP as a dynamic, evolvable protocol — not a static API
- Container introspection as the source of truth for capability discovery
- The Expert system's ability to reason about what to expose
- Identity for persistent capability memory
- The Luca philosophy: the runtime teaches itself

## Features Used

- `McpServer` — dynamic tool/resource registration
- `Expert` — reasoning about what capabilities to expose
- `ContainerChat` — understanding available features and their APIs
- `VM` — executing dynamically generated tool handlers
- `ESBuild` — compiling tool handler code at runtime
- `Identity` — remembering registered tools across sessions
- `Snippets` — storing and managing generated tool code

## Key Moments

- The MCP tool list being empty at start
- Asking a question and watching a new tool appear
- Using the newly created tool immediately
- Restarting and seeing all the tools already there
- The Diplomat explaining why it chose to expose certain methods and not others
