# HANDOFF

> Last updated: 2026-02-18

## What Is This

**LUCA** (Lightweight Universal Conversational Architecture) is a TypeScript/Bun framework for building **observable, stateful, event-emitting dependency injectors** called containers. Every component can `introspect()` at runtime, making the system equally navigable by humans and AI agents.

**Author:** Jon Soeder
**Version:** 0.0.1
**Runtime:** Bun
**Started:** June 2025
**License:** MIT

## Core Architecture

A `Container` is a per-process singleton combining: observable state, typed event bus, registries of components, and factory methods to instantiate them. All components extend a `Helper` base class with Zod-validated state, events, and introspection.

```
Container
├── State (observable, versioned)
├── Bus (typed events with stats)
├── Registries: features, clients, servers, commands, endpoints
├── Factories: container.feature('fs'), container.server('express'), etc.
└── Context: enabled features + shared data passed to all helpers
```

**Three container types ship today:**

| Container | Purpose | Features |
|-----------|---------|----------|
| `NodeContainer` | Server-side apps, scripts, CLI tools | 40+ features (fs, git, docker, postgres, vm, google APIs, etc.) |
| `WebContainer` | Browser apps | 8 features (speech, voice, esbuild, asset loading, etc.) |
| `AGIContainer` | AI agent orchestration (extends Node) | 9 features (conversations, claude-code, openai-codex, skills, docs) |

## What's Built

### Core (stable)
- `Container`, `Helper`, `Feature`, `Client`, `Server`, `Command`, `Endpoint`, `Registry` base classes
- `State<T>` observable store, `Bus<T>` typed event emitter
- Zod-based schemas powering both TypeScript types and runtime introspection
- Module augmentation pattern for type-safe factory methods
- Build-time introspection scanner + generated metadata (~25k lines)

### Node Features (40+)
**System:** fs, proc, os, git, grep, networking, opener, tmux, secure-shell, docker
**Data:** postgres, sqlite, disk-cache, vault (AES-256-GCM), yaml, json-tree, content-db
**Code:** vm, script-runner, repl, python, esbuild, mdx-bundler
**Cloud/External:** runpod, telegram, downloader, port-exposer, ipc-socket
**Google:** google-auth, google-drive, google-sheets, google-calendar, google-docs

### Web Features (8)
asset-loader, esbuild, mdx-loader, network, speech, voice-recognition, vault, vm

### AGI Features (9)
assistant, conversation, conversation-history, claude-code, openai-codex, skills-library, docs-reader, assistants-manager, openapi

### Servers & Clients
**Servers:** Express (with file-based endpoint routing), WebSocket, MCP
**Clients:** REST (axios), GraphQL, WebSocket (auto-reconnect), OpenAI, Supabase, Civitai, ComfyUI

### CLI Commands
`luca serve` | `luca console` | `luca run` | `luca chat` | `luca mcp` | `luca mcp-sandbox` | `luca content-mcp`

### Assistants
- **luca-expert** — Framework documentation assistant with 15 tutorials and source-reading tools
- **project-owner** — Development orchestrator managing ideas/plans as contentbase collections

### Documentation
- `CLAUDE.md` — development guidelines and project commands
- `docs/codebase-explainer.md` — 470-line module-by-module reference
- `docs/philosophy.md` — architectural vision and design rationale
- `docs/contentbase-readme.md` — markdown-as-database API
- `docs/introspection.md` — runnable introspection demo
- `assistants/luca-expert/docs/` — 15 comprehensive tutorials
- `scripts/examples/` — 20+ runnable example scripts

### Tests
6 test files covering: event bus, state, feature loading, client/server communication, node container, integration

## Development Timeline

### Phase 1 — Foundation (Jun 8-17, 2025)
Initial commit through first working prototype. Built the container/helper/feature/registry core, introspection system, OpenAI client, web container, MCP server basics, Python feature. Then paused for ~8 months.

### Phase 2 — Revival & Hardening (Feb 7-8, 2026)
Resumed development. Migrated state/options to Zod schemas, wrote test suite, rewrote introspection to use Zod instead of AST parsing, built web container ESM bundle, added typed event bus.

### Phase 3 — AI Agent Infrastructure (Feb 9-14)
Built the AGI layer: Conversation class with tool calls, DocsReader, Assistant feature, AssistantsManager. Major cleanup removing old expert/identity/chat patterns in favor of the new Assistant helper. File-based endpoint routing. Integration tests.

### Phase 4 — Assistants & Developer Experience (Feb 14-15)
Created `luca-expert` assistant with 15 tutorials verified against source. Added `luca chat` command. Enhanced introspection with type expansion and section filtering. Added `askAboutLucaSource` tool. Turn tracking and event improvements.

### Phase 5 — Infrastructure Expansion (Feb 15-16)
Postgres, SQLite, Supabase client. First-class MCP Server helper. WebSocket and GraphQL client overhaul with full Helper integration. Cleanup pass.

### Phase 6 — Orchestration & Planning (Feb 16-17)
Built `project-owner` assistant with ideas/plans contentbase collections. `homeFolder` pattern for `~/.luca`. Synchronous assistant lifecycle hooks. `luca.console.ts` support. VM `loadModule` and `runSync`.

### Phase 7 — Google & MCP Sandbox (Feb 17)
Google Workspace integration (5 features: Auth, Drive, Sheets, Calendar, Docs). MCP sandbox command for AI agents to explore the container via eval tool. Documentation updates. Introspection metadata regenerated.

### Phase 8 — Content MCP & Extensibility (Feb 18)
Built `luca content-mcp` — a full MCP server that wraps any contentbase Collection, giving AI agents read/write access to structured markdown via Model Context Protocol. CLI now discovers user-level commands from `~/.luca/commands/`. Built a `handoff` command with rich terminal UX (banners, spinners, live progress). Fixed `.md` extension normalization bug in contentbase's `Collection.document()`. Set up MCP configuration in `~/@soederpop` for cross-project AI workflows.

## What We Did Today (Feb 18)

### 1. `luca content-mcp` Command (740 lines)
The biggest deliverable: a new command that spawns an MCP server wrapping a contentbase Collection. This lets any MCP-compatible AI agent (Claude, etc.) interact with structured markdown content through a standardized protocol.

**Capabilities:**
- 10 tools: query, search, validate, CRUD operations, section editing, actions
- 4 static resources (schema, TOC, models-summary, primer) + per-document dynamic resources
- Auto-generated `create-{modelName}` prompts from collection model definitions
- Supports stdio and HTTP transports
- 3-tier collection resolution (index.ts > models.ts > auto-discover) via contentbase's `loadCollection`
- Validation runs as guardrail not gate — documents save even with errors so the LLM can decide

### 2. CLI Home Directory Command Discovery
The Luca CLI (`src/cli/cli.ts`) now discovers and loads commands from `~/.luca/commands/` in addition to the project-local commands. This enables user-level custom commands that work across all projects.

### 3. Handoff Command (`~/.luca/commands/handoff.ts`)
A user-level command that uses the `claude-code` feature to analyze git activity and generate a HANDOFF.md summary. Features rich terminal UX with:
- ASCII art banner with gradient colors (cyan/magenta/yellow)
- Animated spinner with live phase/turn tracking
- Post-completion summary box with session metrics
- Markdown-rendered output via `ui.markdown()`

**Known issue:** Cannot run inside an active Claude Code session due to nested session prevention (`CLAUDECODE` env var check).

### 4. Contentbase Bugfix — Extension Normalization
Fixed `Collection.document()` in contentbase to strip `.md`/`.mdx` extensions from pathId before lookup. Previously, when AI models included `.md` in document references (e.g., `"getting-started.md"` instead of `"getting-started"`), the lookup would fail silently. The fix normalizes using the collection's configured extensions, resolving the issue across all call sites in docs-reader and assistant features.

### 5. MCP Configuration for @soederpop
Set up MCP configuration files in `~/@soederpop` to enable AI agents to use the content-mcp server for cross-project workflows.

### 6. Import Cleanup
Updated `src/agi/container.server.ts` and `src/agi/index.ts` to clean up import paths.

## Current State

**Branch:** `implement-self-improvement-loop` (6 commits ahead of main)
**Working tree:** Clean — all work committed
**Stashes:** 4 (older, from main and general-intelligence branches)

## Recent Commits

```
4166f07 Feb 18  update imports
99bb288 Feb 18  Add content-mcp command for exposing contentbase collections via MCP
cb4fad6 Feb 18  the cli discovers commands in the home directory
99c6ba7 Feb 17  cleaned up the exports
4528d5f Feb 17  moved the project-owner stuff into the soederpop portfolio
8e7b047 Feb 17  Implement phase 1 self-improvement loop foundations
```

## What To Do Tomorrow

### High Priority

1. **Test the content-mcp server end-to-end** — The 740-line command was built but needs real-world testing with an actual MCP client. Verify all 10 tools work correctly, resources resolve, and prompts generate properly. Test with Claude Code or another MCP consumer.

2. **Merge `implement-self-improvement-loop` to main** — The branch has 6 solid commits including the content-mcp command, CLI extensibility, and import cleanup. Review the diff against main, run tests, and merge.

3. **Fix the nested session issue for the handoff command** — The `~/.luca/commands/handoff.ts` command can't run inside Claude Code because of the `CLAUDECODE` env var safety check. Options:
   - Have the handoff command unset the env var before spawning (with appropriate safeguards)
   - Run it outside of Claude Code sessions (e.g., from a plain terminal)
   - Build a non-Claude-Code version that generates the handoff from git data alone

### Medium Priority

4. **Wire content-mcp into actual workflows** — Now that the server exists, configure it as an MCP server in Claude Code's `.mcp.json` for projects that have contentbase collections. The `~/@soederpop` MCP config is started but needs testing.

5. **Build more `~/.luca/commands/`** — The home directory command discovery is powerful. Consider commands for:
   - `luca status` — quick project health check
   - `luca plan` — interact with the project-owner assistant's plans
   - `luca ideas` — browse and add to the ideas collection

6. **Contentbase: add tests for extension normalization** — The `.md` stripping fix works but has no test coverage. Add a unit test to contentbase verifying `collection.document("foo.md")` resolves the same as `collection.document("foo")`.

### Queued Plans (from project-owner)

| Plan | Status | Description |
|------|--------|-------------|
| `add-google-features` | Done (needs testing) | Google Workspace API integration |
| `add-webcam-feature` | Queued | Browser webcam with computer vision pipeline |
| `refactor-container-events` | Queued | Typed event bus with Zod schema validation |
| `add-websocket-auth` | Queued | JWT token-based WebSocket authentication |

## Key Patterns to Know

1. **Everything extends Helper** — state, events, container access, introspection come free
2. **Module augmentation** — `AvailableFeatures`, `AvailableClients`, etc. keep factories type-safe
3. **Zod everywhere** — schemas power both TypeScript types and runtime introspection
4. **Contentbase** — folders of markdown are queryable collections with Zod-validated models
5. **Introspection** — `container.features.describeAll()` documents everything at runtime
6. **File-based routing** — endpoints discovered from directory structure (Remix-style)
7. **Home commands** — `~/.luca/commands/*.ts` are auto-discovered and available globally

## Project Vision

From the README: the goal is to build a fully online autonomous BEING that can publish APIs and MCP servers, use a computer, modify its own code via the `claudeCode` feature, and deploy copies of itself — driven by hourly heartbeat prompts coordinating multiple AI coding assistants.

## Quick Start

```bash
bun install
bun test              # run tests
bun run typecheck     # verify types
bun run console       # interactive REPL with container
bun run build:introspection  # regenerate metadata after changing features
```
