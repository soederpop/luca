---
title: Getting Started with Luca
tags: [setup, quickstart, project, init, install, bundle]
---

# Getting Started with Luca

Luca ships as a single binary. You install one file, and that file is the framework, the runtime, and the build tool. No `npm install`, no `node_modules`, no supply chain exposure.

This tutorial takes you from nothing to a shipped binary of your own.

## 1. Install the Binary

```sh
curl -fsSL https://luca-js.soederpop.com/install.sh | bash
```

Detects your platform, downloads the binary, puts `luca` in your path. Or grab a release directly from [GitHub Releases](https://github.com/soederpop/luca/releases/latest) — binaries are available for macOS (Apple Silicon and Intel), Linux (x64 and ARM64), and Windows (x64).

Verify it works:

```sh
luca --version
luca describe features
```

That second command is the important one — it prints docs for every feature the runtime carries: file system, git, process management, SQLite, HTTP servers, AI assistants, and more. You'll never need to memorize this list; the binary can always tell you what it can do. (See [Bootstrap: Learning the Container at Runtime](./00-bootstrap.md) for the full discovery pattern.)

## 2. Create a Project

```sh
luca bootstrap my-app
cd my-app
```

This scaffolds a project with `commands/`, `endpoints/`, `features/`, `docs/`, and AI assistant configuration — everything wired up and ready to extend:

```
my-app/
├── commands/           # Project-local CLI commands (auto-discovered by `luca`)
├── endpoints/          # File-based HTTP routes (auto-discovered by `luca serve`)
├── features/           # Custom container features
├── assistants/         # AI assistants (file-based convention)
├── docs/               # Content documents queryable via container.docs
└── public/             # Static files served by `luca serve`
```

There's no `package.json` required and nothing to install. The binary discovers these folders by convention and runs them through its own runtime.

## 3. Add Your Own Pieces

Generate boilerplate with `luca scaffold`:

```sh
luca scaffold command seed --description "Seed the database"
luca scaffold endpoint health --description "Health check endpoint"
luca scaffold feature myCache --description "Custom caching layer"
```

A command handler receives the container with everything on it:

```typescript
// commands/seed.ts
export default async function seed(options, context) {
  const { container } = context
  const fs = container.feature('fs')
  const ui = container.feature('ui')

  ui.print.success(`Seeded ${options.count} records`)
}
```

An endpoint gets the container via context too:

```typescript
// endpoints/health.ts
export const path = '/health'

export async function get(_params, ctx) {
  const { container } = ctx
  return { status: 'ok', uptime: process.uptime() }
}
```

No imports beyond what the container gives you. File I/O, HTTP clients, databases, YAML, git — it's all on the container, typed and documented. Run `luca describe fs` (or any helper name) whenever you want the full API.

## 4. Run It

```sh
# run your CLI command
luca seed --count 10

# start the API server — auto-discovers endpoints/, serves public/,
# generates an OpenAPI spec at /openapi.json
luca serve

# run a one-off script with the container in scope
luca run scripts/migrate.ts
```

Your commands show up alongside the built-ins when you run `luca` with no arguments.

## 5. Ship It

This is the payoff. Compile your project — your commands, endpoints, features, and assistants — into its own standalone binary:

```sh
luca bundle my-app
```

The output is a self-contained executable. No node, no bun, no npm on the target machine. Your users download one file and run it; your custom commands show up in `my-app --help`.

Single binary in, single binary out.

## Using Luca Inside an Existing App?

If you want the container as a library inside an existing TypeScript/Bun project — `bun add luca`, import the container, keep your own build — see [Embedding Luca in an Existing Project](./21-embedding-luca.md).

## What's Next

- [Bootstrap: Learning the Container at Runtime](./00-bootstrap.md) -- the discovery pattern: `luca describe`, `luca eval`, the REPL
- [The Container](./02-container.md) -- deep dive into the container
- [Scripts and Markdown Notebooks](./03-scripts.md) -- run scripts and executable markdown
- [Using Features](./04-features-overview.md) -- explore built-in features
- [Writing Endpoints](./07-endpoints.md) -- build your API routes
- [Writing Commands](./08-commands.md) -- add CLI commands to your project
- [Assistants](./12-assistants.md) -- build an AI operator into your project
