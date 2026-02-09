# The Panopticon

A live, queryable intelligence layer over your entire codebase exposed as an MCP server. Any MCP-compatible client (Claude Desktop, VS Code, etc.) can ask questions about your project and get real-time, grounded answers.

## The Demo

Start the Panopticon pointed at a monorepo. It indexes everything — files, git history, package dependencies, content models. Then open Claude Desktop (or any MCP client) and ask:

- "What changed since yesterday?"
- "Which packages depend on lodash?"
- "Show me all the TODO comments in the auth module"
- "What markdown content models are defined?"
- "Find all files that import from the payments feature"

All answers are live. Change a file, and the next query reflects it instantly.

## What It Demonstrates

- MCP server as the universal API for developer tools
- File watching + indexing as a foundation for smart tooling
- How Luca features compose into something greater than the sum of their parts
- The container as a living model of a project, not just a static snapshot

## Features Used

- `McpServer` — exposes tools and resources to MCP clients
- `FileManager` — watches the project, maintains file index, pattern matching
- `Git` — branch info, recent changes, file history
- `PackageFinder` — dependency graph, duplicate detection, scope analysis
- `Grep` — ripgrep-powered code search exposed as an MCP tool
- `ContentDb` — if the project has markdown content, query it as structured data
- `DiskCache` — cache expensive index operations between queries

## Key Moments

- Asking a question in Claude Desktop and getting an answer grounded in your actual codebase
- Editing a file and immediately seeing the updated answer
- Discovering a dependency issue you didn't know about via natural language
- The MCP tool list growing as more features are enabled
