# HANDOFF

> Last updated: 2026-02-17

## What Is This

**LUCA** (Lightweight Universal Conversational Architecture) is a TypeScript/Bun framework for building **observable, stateful, event-emitting dependency injectors** called containers. Every component can `introspect()` at runtime, making the system equally navigable by humans and AI agents.

**Author:** Jon Soeder
**Version:** 0.0.1
**Runtime:** Bun
**Started:** June 2025
**Commits:** 107
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
**Google (new):** google-auth, google-drive, google-sheets, google-calendar, google-docs

### Web Features (8)
asset-loader, esbuild, mdx-loader, network, speech, voice-recognition, vault, vm

### AGI Features (9)
assistant, conversation, conversation-history, claude-code, openai-codex, skills-library, docs-reader, assistants-manager, openapi

### Servers & Clients
**Servers:** Express (with file-based endpoint routing), WebSocket, MCP
**Clients:** REST (axios), GraphQL, WebSocket (auto-reconnect), OpenAI, Supabase, Civitai, ComfyUI

### CLI Commands
`luca serve` | `luca console` | `luca run` | `luca chat` | `luca mcp` | `luca mcp-sandbox`

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

### Phase 7 — Current Work (Feb 17)
Google Workspace integration (5 features: Auth, Drive, Sheets, Calendar, Docs). MCP sandbox command for AI agents to explore the container via eval tool. Documentation updates. Introspection metadata regenerated.

## Recent Commits (last 10)

```
d2a3821 Feb 17  claude code can use the mcp-sandbox feature
9863290 Feb 17  Fix eval tool description: fs.list → fs.readdir
f62faee Feb 17  Add tutorial for Google features with auth setup guide
4cee81c Feb 17  Add luca mcp-sandbox command for AI agent container exploration
2c170d8 Feb 17  Add Google integration features: Auth, Drive, Sheets, Calendar, Docs
e41798a Feb 17  Ideas collection + write tools for project-owner assistant
44f3c89 Feb 17  some documentation, related to the next steps
d5b2728 Feb 17  the homeFolder pattern
4d77787 Feb 17  working on the project owner assistant
5dbe23d Feb 17  fixes to the console command, improvements to the Plan model
```

## Uncommitted Work

```
Modified:   src/commands/index.ts (mcp-sandbox registration)
Modified:   src/node/container.ts (google feature imports)
Modified:   src/introspection/generated.*.ts (regenerated metadata)
Modified:   package.json (googleapis dependency)
Modified:   assistants/project-owner/docs/plans/add-google-features.md
Untracked:  src/commands/mcp-sandbox.ts
Untracked:  src/node/features/google-auth.ts
Untracked:  src/node/features/google-calendar.ts
Untracked:  src/node/features/google-docs.ts
Untracked:  src/node/features/google-drive.ts
Untracked:  src/node/features/google-sheets.ts
```

## Approved Plans (queued)

| Plan | Description |
|------|-------------|
| `add-google-features` | **In progress** — Google Workspace API integration |
| `add-webcam-feature` | Browser webcam with computer vision pipeline |
| `refactor-container-events` | Typed event bus with Zod schema validation |
| `add-websocket-auth` | JWT token-based WebSocket authentication |

## Project Vision

From the README: the goal is to build a fully online autonomous BEING that can publish APIs and MCP servers, use a computer, modify its own code via the `claudeCode` feature, and deploy copies of itself — driven by hourly heartbeat prompts coordinating multiple AI coding assistants.

## Key Patterns to Know

1. **Everything extends Helper** — state, events, container access, introspection come free
2. **Module augmentation** — `AvailableFeatures`, `AvailableClients`, etc. keep factories type-safe
3. **Zod everywhere** — schemas power both TypeScript types and runtime introspection
4. **Contentbase** — folders of markdown are queryable collections with Zod-validated models
5. **Introspection** — `container.features.describeAll()` documents everything at runtime
6. **File-based routing** — endpoints discovered from directory structure (Remix-style)

## Quick Start

```bash
bun install
bun test              # run tests
bun run typecheck     # verify types
bun run console       # interactive REPL with container
bun run build:introspection  # regenerate metadata after changing features
```
