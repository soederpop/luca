// Auto-generated bootstrap content
// Generated at: 2026-03-15T02:33:56.117Z
// Source: docs/bootstrap/*.md, docs/bootstrap/templates/*
//
// Do not edit manually. Run: luca build-bootstrap

export const bootstrapFiles: Record<string, string> = {
  "SKILL": `# Luca: Learning the Container at Runtime

Everything starts with \`container\`. You don't need to memorize APIs — you need to know the shape of things and how to ask the container what it can do. This guide teaches you that shape. From there, the system reveals itself.

## The Container

The container is a singleton that holds everything your application needs. It organizes components into **registries** — collections you can query.

\`\`\`js
// What registries exist?
container.registries
// => ['features', 'clients', 'servers', 'commands', 'endpoints']

// What's available in each?
container.features.available
// => ['fs', 'git', 'proc', 'vm', 'networking', 'os', 'grep', ...]
container.clients.available
// => ['rest', 'websocket', ...]
container.servers.available
// => ['express', 'websocket', ...]
\`\`\`

## Getting a Helper

Use the factory function to get an instance. Features auto-enable on first access.

\`\`\`js
const fs = container.feature('fs')
const rest = container.client('rest')
const express = container.server('express')
\`\`\`

Core features are also available as top-level shortcuts in eval/repl contexts:

\`\`\`js
fs.readFile('package.json')
git.branch
proc.exec('ls')
\`\`\`

## Discovery: The Only Pattern You Need

Every registry can describe its contents. Every helper instance can describe itself.

\`\`\`js
// From a registry — get docs for any helper by name
container.features.describe('fs')       // => markdown API docs
container.features.describeAll()        // => condensed overview of all features
container.clients.describe('rest')      // => markdown API docs for rest client

// From the CLI
// luca describe fs
// luca describe clients
// luca describe

// From a helper instance — structured introspection
const fs = container.feature('fs')
fs.introspect()         // => { description, methods, getters, events, state, options }
fs.introspectAsText()   // => same info as readable markdown
\`\`\`

The container itself is introspectable:

\`\`\`js
container.inspect()          // structured object with all registries, state, events
container.inspectAsText()    // full markdown overview
\`\`\`

**This is the core loop: if you know something exists, you can learn everything about it at runtime.**

## State

Every helper has observable state — a live object you can read, write, and watch.

\`\`\`js
const feature = container.feature('fs')

// Read
feature.state.current          // snapshot of all state
feature.state.get('someKey')   // single value

// Write
feature.state.set('key', 'value')

// Watch
feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
})
\`\`\`

The container itself has state too: \`container.state.current\`, \`container.state.observe()\`.

## Events

Every helper is an event emitter. Components announce things without knowing who listens.

\`\`\`js
feature.on('someEvent', (...args) => { })
feature.once('someEvent', (...args) => { })
feature.emit('someEvent', data)
await feature.waitFor('someEvent')  // promise that resolves on next emit
\`\`\`

The container emits lifecycle events:

\`\`\`js
container.on('featureEnabled', (feature) => { })
container.on('stateChange', (key, value) => { })
\`\`\`

What events does a helper emit? Ask it:

\`\`\`js
fs.introspect().events
// => { fileChanged: { description, arguments }, ... }
\`\`\`

## Utilities

The container provides common utilities — no external imports needed:

\`\`\`js
container.utils.uuid()                          // v4 UUID
container.utils.hashObject(obj)                 // deterministic hash
container.utils.stringUtils.camelCase('foo-bar')
container.utils.lodash.groupBy(items, 'type')
container.paths.resolve('src', 'index.ts')      // path operations
\`\`\`

## Summary

The entire API surface is discoverable from a single object:

| Want to know...              | Ask                                    |
|------------------------------|----------------------------------------|
| What registries exist?       | \`container.registries\`                 |
| What features are available? | \`container.features.available\`         |
| Full docs for a feature?     | \`container.features.describe('fs')\`    |
| All features at a glance?    | \`container.features.describeAll()\`     |
| Structured introspection?    | \`feature.introspect()\`                 |
| What state does it have?     | \`feature.state.current\`                |
| What events does it emit?    | \`feature.introspect().events\`          |
| Full container overview?     | \`container.inspectAsText()\`            |

You now know the shape. For specifics — what methods \`fs\` has, what options \`express\` takes, what events \`git\` emits — ask the container. It will tell you everything.

See \`references/api-docs/\` for the full pre-generated API reference.
`,
  "CLAUDE": `# Luca Project

This project uses the [Luca framework](https://github.com/soederpop/luca) — Lightweight Universal Conversational Architecture.

For a deep dive into the framework internals, see the [Luca GitHub repository](https://github.com/soederpop/luca).

## Runtime

The runtime is **bun**. Use \`bun run\` for scripts, \`bun test\` for tests.

## The \`luca\` CLI

The \`luca\` binary is available in the path. Key commands:

- \`luca\` — list available commands (built-in + project commands)
- \`luca eval "expression"\` — evaluate JS with the container in scope
- \`luca describe\` — describe the container
- \`luca describe fs\` — describe a specific feature, client, or server
- \`luca describe features\` — describe all features
- \`luca serve\` — start a local server using \`endpoints/\` folder
- \`luca run script.ts\` — run a script with the container
- \`luca scaffold <type> <name>\` — generate boilerplate for a new helper (run \`luca scaffold\` for full help)

## Container Rules

- **NEVER import from \`fs\`, \`path\`, or other Node builtins.** Use \`container.feature('fs')\` for file operations, \`container.paths\` for path operations.
- The container should provide everything you need. If something is missing, raise the concern rather than pulling in external dependencies.
- Use \`container.utils\` for common utilities (uuid, lodash helpers, string utils).

## Learning the Framework

1. Read \`.claude/skills/luca-framework/SKILL.md\` for the mental model and discovery patterns
2. Use \`luca describe <name>\` to learn about any feature, client, or server
3. Browse \`.claude/skills/luca-framework/references/api-docs/\` for full API reference
4. In code, use \`container.features.describe('name')\` or \`helper.introspect()\` for runtime docs
5. For source-level deep dives: [github.com/soederpop/luca](https://github.com/soederpop/luca)

## Project Structure

- \`commands/\` — custom CLI commands, run via \`luca <commandName>\` (auto-discovered)
- \`endpoints/\` — file-based HTTP routes, served via \`luca serve\` (auto-discovered)
- \`features/\` — custom container features, discovered via \`container.helpers.discoverAll()\` (auto-discovered)
- \`docs/\` — content documents managed by the \`contentDb\` feature (\`container.docs\`). See [contentbase](https://github.com/soederpop/contentbase) for the document model system.
- \`luca.cli.ts\` — optional project-level CLI customization (runs before any command)

## Extending the Container

Use \`luca scaffold\` to generate new helpers:

\`\`\`sh
luca scaffold command myTask --description "Automate something"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint users --description "User management API"
\`\`\`

Run \`luca scaffold\` with no arguments for full usage and examples.

## Git Strategy

Roll on main. Commit with good messages that explain why, not just what.
`
}

export const bootstrapTemplates: Record<string, string> = {
  "docs-models": `import { defineModel, z } from 'contentbase'

/**
 * Define your content models here. Each model maps to a folder prefix
 * inside the docs/ directory. Documents in those folders follow the
 * model's metadata schema.
 *
 * Access documents at runtime:
 *   const docs = container.docs          // contentDb feature
 *   if (!docs.isLoaded) await docs.load()
 *   const notes = await docs.query(docs.models.Note).fetchAll()
 *
 * See https://github.com/soederpop/contentbase for full documentation.
 */

export const Note = defineModel('Note', {
  prefix: 'notes',
  meta: z.object({
    tags: z.array(z.string()).default([]),
    status: z.enum(['draft', 'published']).default('draft'),
  }),
})
`,
  "luca-cli": `/**
 * luca.cli.ts — Project-level CLI customization
 *
 * This file is automatically loaded by the \`luca\` CLI before any command runs.
 * Use it to:
 *
 * - Discover project-level helpers (features, commands, endpoints)
 * - Register custom context variables accessible in \`luca eval\`
 * - Set up project-specific container configuration
 *
 * Exports:
 *   main(container)    — called at CLI startup, before command execution
 *   onStart(container) — called when the container's 'started' event fires
 *
 * Example:
 *   export async function main(container: any) {
 *     await container.helpers.discoverAll()
 *     container.addContext('myFeature', container.feature('myFeature'))
 *   }
 */

export async function main(container: any) {
  // Discover project-level helpers (commands/, features/, endpoints/)
  await container.helpers.discoverAll()
}
`,
  "docs-readme": `# Docs

This folder contains structured content documents managed by the [contentbase](https://github.com/soederpop/contentbase) system.

## How it works

Documents are markdown files with YAML frontmatter. Each document belongs to a **model** defined in \`docs/models.ts\`. Models specify:
- A **prefix** (subfolder name, e.g. \`notes/\`)
- A **metadata schema** (validated frontmatter fields)

## Accessing documents at runtime

The \`contentDb\` feature (aliased to \`container.docs\`) loads and queries documents:

\`\`\`typescript
const docs = container.docs
if (!docs.isLoaded) await docs.load()

// Query all notes
const notes = await docs.query(docs.models.Note).fetchAll()

// Get a specific document
const doc = docs.collection('notes').document('my-note')
\`\`\`

## Creating a new document

Add a markdown file in the appropriate subfolder:

\`\`\`markdown
---
title: My First Note
tags: [example]
status: draft
---

Content goes here.
\`\`\`

## Learn more

- [Contentbase GitHub](https://github.com/soederpop/contentbase) — full documentation and API reference
- \`luca describe contentDb\` — runtime docs for the contentDb feature
`,
  "example-feature": `import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    example: typeof Example
  }
}

const ExampleStateSchema = FeatureStateSchema.extend({
  greetCount: z.number().default(0).describe('Number of times greet() has been called'),
})
type ExampleState = z.infer<typeof ExampleStateSchema>

const ExampleOptionsSchema = FeatureOptionsSchema.extend({})
type ExampleOptions = z.infer<typeof ExampleOptionsSchema>

/**
 * An example feature demonstrating the luca feature pattern.
 *
 * Discovered automatically by \`container.helpers.discoverAll()\`
 * and available as \`container.feature('example')\`.
 *
 * To learn more: \`luca scaffold feature --tutorial\`
 *
 * @example
 * \`\`\`typescript
 * const example = container.feature('example')
 * example.greet('Luca') // => "Hello, Luca! (greeting #1)"
 * \`\`\`
 */
export class Example extends Feature<ExampleState, ExampleOptions> {
  static override shortcut = 'features.example' as const
  static override stateSchema = ExampleStateSchema
  static override optionsSchema = ExampleOptionsSchema
  static override description = 'An example feature demonstrating the luca feature pattern'
  static { Feature.register(this, 'example') }

  /**
   * A simple method to show the feature works.
   * @param name - Name to greet
   * @returns Greeting string
   */
  greet(name = 'World') {
    const count = (this.state.get('greetCount') || 0) + 1
    this.state.set('greetCount', count)
    return \`Hello, \${name}! (greeting #\${count})\`
  }
}

export default Example
`,
  "about-command": `/**
 * about — Display project information and discovered helpers.
 * Run with: luca about
 */
export const description = 'Display project information and discovered helpers'

export async function handler(_options: any, context: any) {
  const container = context.container
  const ui = container.feature('ui')

  // Discover all project-level helpers (commands, features, endpoints, etc.)
  const discovered = await container.helpers.discoverAll()

  const projectName = container.paths.resolve('.').split('/').pop() || 'project'

  ui.print.cyan(\`\\n  \${projectName}\\n\`)
  ui.print('  Powered by luca — Lightweight Universal Conversational Architecture\\n')

  const types = ['features', 'clients', 'servers', 'commands', 'endpoints']

  for (const type of types) {
    const names = discovered[type] || []
    if (names.length > 0) {
      ui.print.green(\`  \${type} (\${names.length})\`)
      for (const name of names) {
        ui.print(\`    • \${name}\`)
      }
    }
  }

  const totalBuiltIn = types.reduce((sum: number, t: string) => sum + (container[t]?.available?.length || 0), 0)
  ui.print.dim(\`\\n  \${totalBuiltIn} built-in helpers available. Run \\\`luca describe\\\` for details.\\n\`)
}
`,
  "health-endpoint": `/**
 * Health check endpoint.
 * Accessible at GET /api/health when you run \`luca serve\`.
 */
export const path = '/api/health'
export const description = 'Health check endpoint'
export const tags = ['health']

export async function get(_params: any, ctx: any) {
  return {
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  }
}
`
}
