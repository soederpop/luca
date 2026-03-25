// Auto-generated bootstrap content
// Generated at: 2026-03-24T19:30:42.472Z
// Source: docs/bootstrap/*.md, docs/bootstrap/templates/*, docs/examples/*.md, docs/tutorials/*.md
//
// Do not edit manually. Run: luca build-bootstrap

export const bootstrapFiles: Record<string, string> = {
  "SKILL": `---
name: Using the luca framework
description: The @soederpop/luca framework, when you see a project with docs/ commands/ features/ luca.cli.ts endpoints/ folders, or @soederpop/luca is in the package.json, or the user is asking you to develop a new Luca feature, use this skill to learn about the APIs and how to learn the framework at runtime.  The luca cli bundles all of the documentation in a searchable, progressively learnable interface designed for students and AI assistants alike
---
# Luca: Learning the Container

The Luca framework \`@soederpop/luca\` ships a \`luca\` binary — a bun-based CLI for a dependency injection container. This project is based on it if this skill is present. The container auto-discovers modules in \`commands/\`, \`clients/\`, \`servers/\`, \`features/\`, and \`endpoints/\` folders.

The \`luca\` cli loads typescript modules in through its VM which injects a \`container\` global that is a singleton object from which you can learn about, and access all different kinds of utils and Helpers (features, clients, servers, commands, and compositions thereof)

There are three things to learn, in this order:

1. **Discover** what the container can do — \`luca describe\`
2. **Build** new helpers when your project needs them — \`luca scaffold\`
3. **Prototype** and debug with live code — \`luca eval\`
4. **Write Runnable Markdown** a great usecase is \`luca run markdown.md\` where the markdown codeblocks are executed inside the Luca VM.
---

## Phase 1: Discover with \`luca describe\`

This is your primary tool. Before reading source files, searching for APIs, or writing any code — ask describe. It outputs full documentation for any part of the container: methods, options, events, state, examples.

### See what's available

\`\`\`shell
luca describe features     # index of all available features
luca describe clients      # index of all available clients
luca describe servers      # index of all available servers
\`\`\`

You can even learn about features in the browser container, or a specific platform (server, node are the same, browser,web are the same)

\`\`\`shell
luca describe features --platform=web 
luca describe features --platform=server
\`\`\`

### Learn about specific helpers

\`\`\`shell
luca describe fs           # full docs for the fs feature
luca describe git          # full docs for git
luca describe rest         # full docs for the rest client
luca describe express      # full docs for the express server
luca describe git fs proc  # multiple helpers in one shot
\`\`\`

### Drill into a specific method or getter

Use dot notation to get docs for a single method or getter on any helper:

\`\`\`shell
luca describe ui.banner            # docs for the banner() method on ui
luca describe fs.readFile          # docs for readFile() on fs
luca describe ui.colors            # docs for the colors getter on ui
luca describe git.branch           # docs for the branch getter on git
\`\`\`

This shows the description, parameters, return type, and examples for just that member. If the member doesn't exist, it lists all available methods and getters on the helper.

### Get targeted documentation

You can filter to only the sections you need:

\`\`\`shell
luca describe fs --methods          # just the methods
luca describe git --events          # just the events it emits
luca describe express --options     # just the constructor options
luca describe fs git --examples     # just examples for both
luca describe fs --usage --methods  # combine sections
\`\`\`

### Describe the container itself

\`\`\`shell
luca describe              # overview of the container
luca describe self         # same thing
\`\`\`

### Get help on any command

\`\`\`shell
luca                       # list all available commands
luca describe --help       # full flag reference for describe
luca help scaffold         # help for any command
\`\`\`

**Use \`luca describe\` liberally.** It is the fastest, safest way to understand what the container provides. Every feature, client, and server is self-describing — if you know a name, describe will tell you everything about it. Use dot notation (\`ui.banner\`, \`fs.readFile\`) when you need docs on just one method or getter.

---

## Phase 2: Build with \`luca scaffold\`

When your project needs a new helper, scaffold it. The \`scaffold\` command generates correct boilerplate — you fill in the logic.

### Learn how to build each type

Before creating anything, read the tutorial for that helper type:

\`\`\`shell
luca scaffold feature --tutorial    # how features work, full guide
luca scaffold command --tutorial    # how commands work
luca scaffold endpoint --tutorial   # how endpoints work
luca scaffold client --tutorial     # how clients work
luca scaffold server --tutorial     # how servers work
\`\`\`

These tutorials are the authoritative reference for each helper type. They cover imports, schemas, class structure, registration, conventions, and complete examples.

### Generate a helper

\`\`\`shell
luca scaffold <type> <name> --description "What it does"
\`\`\`

The workflow after scaffolding:

\`\`\`shell
luca scaffold command sync-data --description "Pull data from staging"
# edit commands/sync-data.ts — add your logic
luca describe sync-data            # verify it shows up and reads correctly
\`\`\`

Every scaffolded helper is auto-discovered by the container at runtime.

### When to use each type

| You need to...                                     | Scaffold a...  | Example                                                        |
|----------------------------------------------------|----------------|----------------------------------------------------------------|
| Add a reusable local capability (caching, crypto)  | **feature**    | \`luca scaffold feature disk-cache --description "File-backed key-value cache"\` |
| Add a CLI task (build, deploy, generate)           | **command**    | \`luca scaffold command deploy --description "Deploy to production"\` |
| Talk to an external API or service                 | **client**     | \`luca scaffold client github --description "GitHub API wrapper"\` |
| Accept incoming connections (HTTP, WS)             | **server**     | \`luca scaffold server mqtt --description "MQTT broker"\` |
| Add a REST route to \`luca serve\`                   | **endpoint**   | \`luca scaffold endpoint users --description "User management API"\` |

### Scaffold options

\`\`\`shell
luca scaffold command deploy --description "..."    # writes to commands/deploy.ts
luca scaffold endpoint users --print                # print to stdout instead of writing
luca scaffold feature cache --output lib/cache.ts   # override output path
\`\`\`

---

## Phase 3: Prototype with \`luca eval\`

Once you know what's available (describe) and how to build things (scaffold), use \`luca eval\` to test ideas, verify behavior, and debug.

\`\`\`shell
luca eval "container.features.available"
luca eval "container.feature('proc').exec('ls')"
luca eval "container.feature('fs').readFile('package.json')"
\`\`\`

The eval command boots a full container with all helpers discovered and registered. Core features are available as top-level shortcuts:

\`\`\`shell
luca eval "fs.readFile('package.json')"
luca eval "git.branch"
luca eval "proc.exec('ls')"
\`\`\`

**Reach for eval when you're stuck.** It gives you full control of the container at runtime — you can test method calls, inspect state, verify event behavior, and debug issues that are hard to reason about from docs alone.

**Use eval as a testing tool.** Before wiring up a full command handler or feature, test your logic in eval first. Want to verify how \`fs.moveAsync\` behaves, or whether a watcher event fires the way you expect? Run it in eval. This is the fastest way to validate container code without the overhead of building the full command around it.

\`\`\`shell
# Test file operations before building a command around them
luca eval "await fs.moveAsync('inbox/test.json', 'inbox/valid/test.json')"

# First: luca describe fileManager --events  (to learn what events exist)
# Then test the behavior:
luca eval "const fm = container.feature('fileManager'); fm.on('file:change', (e) => console.log(e)); await fm.watch({ paths: ['inbox'] })"
\`\`\`

### The REPL

For interactive exploration, \`luca console\` opens a persistent REPL with the container in scope. Useful when you need to try multiple things in sequence.

---

## Key Concepts

### The Container

The container is a singleton that holds everything your application needs. It organizes components into **registries**: features, clients, servers, commands, and endpoints. Use the factory functions to get instances:

\`\`\`js
const fs = container.feature('fs')
const rest = container.client('rest')
const server = container.server('express')
\`\`\`

### State

Every helper and the container itself have observable state:

\`\`\`js
const feature = container.feature('fs')

feature.state.current              // snapshot of all state
feature.state.get('someKey')       // single value
feature.state.set('key', 'value')  // update

// Watch for changes
feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
})
\`\`\`

The container has state too: \`container.state.current\`, \`container.state.observe()\`.

### Events

Every helper and the container are event emitters — \`on\`, \`once\`, \`emit\`, \`waitFor\` all work as expected. Use \`luca describe <name> --events\` to see what a helper emits.

### Utilities

The container provides common utilities at \`container.utils\` — no external imports needed:

- \`container.utils.uuid()\` — v4 UUID
- \`container.utils.hashObject(obj)\` — deterministic hash
- \`container.utils.stringUtils\` — camelCase, kebabCase, pluralize, etc.
- \`container.utils.lodash\` — groupBy, keyBy, pick, omit, debounce, etc.
- \`container.paths.resolve()\` / \`container.paths.join()\` — path operations

### Programmatic introspection

Everything \`luca describe\` outputs is also available at runtime in code:

\`\`\`js
container.features.describe('fs')   // markdown docs (same as the CLI)
feature.introspect()                // structured object: { methods, events, state, options }
container.inspectAsText()           // full container overview as markdown
\`\`\`

This is useful inside commands and scripts where you need introspection data programmatically.

---

## Server development troubleshooting

- You can use \`container.proc.findPidsByPort(3000)\` which will return an array of numbers.
- You can use \`container.proc.kill(pid)\` to kill that process
- You can combine these two functions in \`luca eval\` if a server you're developing won't start because a previous instance is running (common inside e.g. claude code sessions )
- \`luca serve --force\` will also replace the running process with the current one
- \`luca serve --any-port\` will open on any port


## Reference

- \`references/api-docs/\` — full pre-generated API reference for every built-in feature, client, and server
- \`references/examples/\` — runnable example docs for each feature (e.g. \`fs.md\`, \`git.md\`, \`proc.md\`)
- \`references/tutorials/\` — step-by-step tutorials covering the container, helpers, commands, endpoints, and more
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
- \`luca describe <name>\` — full docs for any feature, client, or server (e.g. \`luca describe fs\`)
- \`luca describe <name>.<member>\` — docs for a specific method or getter (e.g. \`luca describe ui.banner\`, \`luca describe fs.readFile\`)
- \`luca describe features\` — index of all available features (also: \`clients\`, \`servers\`)
- \`luca serve\` — start a local server using \`endpoints/\` folder
- \`luca run script.ts\` — run a script with the container
- \`luca scaffold <type> <name>\` — generate boilerplate for a new helper (run \`luca scaffold\` for full help)

## Container Rules

- **NEVER import from \`fs\`, \`path\`, or other Node builtins.** Use \`container.feature('fs')\` for file operations, \`container.paths\` for path operations.
- The container should provide everything you need. If something is missing, raise the concern rather than pulling in external dependencies.
- Use \`container.utils\` for common utilities (uuid, lodash helpers, string utils).

## Learning the Framework

1. **Discover** — Run \`luca describe features\`, \`luca describe clients\`, \`luca describe servers\` to see what's available. Then \`luca describe <name>\` for full docs on any helper, or \`luca describe <name>.<member>\` to drill into a specific method or getter. This is your first move, always. (See \`.claude/skills/luca-framework/SKILL.md\` for the full mental model.)
2. **Build** — Run \`luca scaffold <type> --tutorial\` before creating a new helper. It covers the full guide for that type.
3. **Prototype** — Use \`luca eval "expression"\` to test container code before wiring up full handlers. Reach for eval when you're stuck — it gives you full runtime access.
4. **Reference** — Browse \`.claude/skills/luca-framework/references/\` for pre-generated API docs, runnable examples, and tutorials

## Project Structure

- \`commands/\` — custom CLI commands, run via \`luca <commandName>\` (auto-discovered)
- \`endpoints/\` — file-based HTTP routes, served via \`luca serve\` (auto-discovered)
- \`features/\` — custom container features, discovered via \`container.helpers.discoverAll()\` (auto-discovered)
- \`docs/\` — content documents managed by the \`contentDb\` feature (\`container.docs\`). See [contentbase](https://github.com/soederpop/contentbase) for the document model system.
- \`luca.cli.ts\` — optional project-level CLI customization (runs before any command)

## Command Arguments

Command handlers receive \`(options, context)\`. The \`options\` object contains:
- **Named flags** from \`argsSchema\`: \`--verbose\` → \`options.verbose\`
- **Positional args** mapped via \`positionals\` export: \`luca cmd ./src\` → \`options.target\`
- **Raw positionals** in \`options._\`: array where \`_[0]\` is the command name, \`_[1+]\` are positional args

To accept positional arguments, export a \`positionals\` array that maps them to named fields in \`argsSchema\`:

\`\`\`ts
export const positionals = ['target']  // luca myCmd ./src => options.target === './src'
export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})
\`\`\`

## What's Available

The container provides more than you might expect. Before importing anything external, check here:

- **YAML** — \`container.feature('yaml')\` wraps \`js-yaml\`. Use \`.parse(str)\` and \`.stringify(obj)\`.
- **SQLite** — \`container.feature('sqlite')\` for databases. Parameterized queries, tagged templates.
- **REST client** — \`container.client('rest', { baseURL })\`. Methods (\`get\`, \`post\`, etc.) return **parsed JSON directly**, not \`{ data, status, headers }\`. On HTTP errors, the error is returned (not thrown).
- **Content DB** — \`container.docs\` (alias for \`container.feature('contentDb')\`) manages markdown documents with frontmatter. Query with \`docs.query(docs.models.MyModel).fetchAll()\`.
- **Grep** — \`container.feature('grep')\` has \`search()\` and \`codeAnnotations()\` for finding TODOs/FIXMEs/etc.
- **chalk** — available as \`container.feature('ui').colors\`, not via \`import('chalk')\`.
- **figlet** — available as \`container.feature('ui').asciiArt(text)\`.
- **uuid** — \`container.utils.uuid()\`
- **lodash** — \`container.utils.lodash\` (groupBy, keyBy, pick, omit, debounce, etc.)
- **string utils** — \`container.utils.stringUtils\` (camelCase, kebabCase, pluralize, etc.)

## Known Gotchas

- **For DELETE endpoint handlers, use \`export { del as delete }\`** — \`delete\` is a JS reserved word. Define your function with any name, then re-export it as \`delete\`.
- **Bun globals (\`Bun.spawn\`, \`Bun.serve\`) are unavailable** in command/endpoint handlers. Use Node's \`child_process\` for spawning processes, or use \`container.feature('proc').exec()\`.
- **\`ui.print.*\` writes to stdout** — if your command supports \`--json\`, gate UI output behind \`if (!options.json)\`.
- **VM contexts start empty** — when using \`container.feature('vm')\`, inject globals explicitly (\`console\`, \`Date\`, \`Promise\`, \`crypto\`, \`TextEncoder\`, \`setTimeout\`).
- **Long-running commands** (servers, watchers) need \`await new Promise(() => {})\` at the end with a \`process.on('SIGINT', ...)\` handler for cleanup.
- **Shared state between endpoints**: use \`ctx.request.app.locals\` to share data across endpoint files.
- **Database init**: use \`luca.cli.ts\` \`main()\` hook for table creation and seeding — it runs before any command or server starts.

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

  // Handle unknown commands gracefully instead of silently failing
  container.onMissingCommand(async ({ phrase }: { phrase: string }) => {
    container.command('help').dispatch()
  })
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
 *
 * Positional words after the command name are available as options._
 * For example: \`luca about commands\` → options._[1] === 'commands'
 */
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Display project information and discovered helpers'

export const argsSchema = z.object({})

export default async function about(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
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
`,
  "runme": `# Runnable Markdown

The \`luca\` CLI allows you to run markdown blocks as long as they're tagged with \`ts\` in the language.

\`\`\`ts
const banner = ui.banner('LUCA', {
    font: 'Puffy',
    colors: ['red','white','blue']
})

ui.print(banner)
\`\`\`

What is kind of cool is ( so long as there's no top-level-await in the block ) the context will preserve:

\`\`\`ts
if(typeof banner === 'undefined') {
    ui.print.red('uh oh, something broke.')
}
\`\`\`

You can skip blocks too with the skip tag in the language of the fenced block

\`\`\`ts skip
console.log('Not gonna say anything')
\`\`\`

Did you hear something? No.

Something even cooler is the ability to render React blocks.  This makes luca kind of like a poor man's MDX.  I just define some Blocks in the markdown by creating an h2 \`## Blocks\` section with a fenced codeblock that uses \`tsx\`. The \`ink.components\` and \`ink.React\` globals are injected into the scope.

## Blocks

\`\`\`tsx
const { Box, Text } = ink.components
const React = ink.React

function Greeting({ name, role }) {
  return (
    <Box borderStyle="round" padding={1}>
      <Text color="green" bold>Hello {name}!</Text>
      <Text dimColor> ({role})</Text>
    </Box>
  )
}
\`\`\`

## Rendering React Blocks

Then I can use the Blocks in code.

\`\`\`ts
await render('Greeting', { name: 'Jon', role: 'Humble Servant' })
\`\`\`
`
}

export const bootstrapExamples: Record<string, string> = {
  "disk-cache.md": `---
title: "Disk Cache"
tags: [diskCache, storage, caching]
lastTested: null
lastTestPassed: null
---

# diskCache

A file-backed key-value cache powered by cacache (the same store behind npm). Persist arbitrary data to disk with a simple get/set interface.

## Overview

The \`diskCache\` feature is on-demand. Enable it with a \`path\` option pointing to a cache directory. It is ideal for persisting computed results, downloaded assets, or any data you want to survive across process restarts without setting up a full database.

## Creating a Cache

We start by enabling the feature and pointing it at a temporary directory.

\`\`\`ts
const cache = container.feature('diskCache', { path: '/tmp/luca-example-cache' })
console.log('diskCache enabled:', cache.state.get('enabled'))
\`\`\`

The cache directory is created automatically when the first entry is written.

## Storing and Retrieving Values

Use \`set()\` to write a key and \`get()\` to read it back.

\`\`\`ts
await cache.set('greeting', 'Hello from Luca!')
const value = await cache.get('greeting')
console.log('Retrieved:', value)
\`\`\`

The value comes back exactly as stored.

## Checking for Keys

Use \`has()\` to check whether a key exists without reading it.

\`\`\`ts
const exists = await cache.has('greeting')
console.log('Has greeting?', exists)
const missing = await cache.has('nonexistent')
console.log('Has nonexistent?', missing)
\`\`\`

This is useful for conditional caching patterns where you want to skip expensive work if a result is already stored.

## Listing All Keys

Use \`keys()\` to enumerate everything in the cache.

\`\`\`ts
await cache.set('user:1', JSON.stringify({ name: 'Alice' }))
await cache.set('user:2', JSON.stringify({ name: 'Bob' }))
const allKeys = await cache.keys()
console.log('All keys:', allKeys)
\`\`\`

Keys are plain strings, so you can use naming conventions like prefixes to organize entries.

## Removing Entries

Use \`rm()\` to delete a single key, or \`clearAll(true)\` to wipe the entire cache.

\`\`\`ts
await cache.rm('user:2')
const afterRemove = await cache.keys()
console.log('After removing user:2:', afterRemove)

await cache.clearAll(true)
const afterClear = await cache.keys()
console.log('After clearAll:', afterClear)
\`\`\`

Note that \`clearAll\` requires passing \`true\` as a confirmation safeguard.

## Summary

This demo covered creating a disk cache, storing and retrieving values, checking key existence, listing keys, and removing entries. The \`diskCache\` feature provides a lightweight persistence layer without any external dependencies.
`,
  "fs.md": `---
title: "fs"
tags: [fs, filesystem, core]
lastTested: null
lastTestPassed: null
---

# fs

File system utilities for reading, writing, checking, and walking files and directories.

## Overview

The \`fs\` feature is a core feature, meaning it is auto-enabled on every container. You can access it directly as a global or via \`container.feature('fs')\`. It provides synchronous and asynchronous methods for common filesystem operations. All paths are resolved relative to the container's working directory.

## Reading Files

Use \`readFile()\` to read a file as a string. This is the simplest way to get file contents.

\`\`\`ts
const content = fs.readFile('README.md')
console.log('README.md length:', content.length, 'characters')
console.log('First line:', content.split('\\n')[0])
\`\`\`

The returned value is always a string, ready for processing.

## Reading JSON

Use \`readJson()\` to read and parse a JSON file in one step. No need for manual \`JSON.parse()\`.

\`\`\`ts
const pkg = fs.readJson('package.json')
console.log('Package name:', pkg.name)
console.log('Version:', pkg.version)
console.log('Dependencies:', Object.keys(pkg.dependencies || {}).length, 'packages')
\`\`\`

This is especially handy for configuration files and manifests.

## Checking Existence

Use \`exists()\` to check whether a file or directory is present before operating on it.

\`\`\`ts
console.log('README.md exists:', fs.exists('README.md'))
console.log('package.json exists:', fs.exists('package.json'))
console.log('nonexistent.txt exists:', fs.exists('nonexistent.txt'))
console.log('src/ exists:', fs.exists('src'))
\`\`\`

Returns a simple boolean. There is also an \`existsAsync()\` variant.

## Walking a Directory

Use \`walk()\` to recursively list all files under a directory tree. You can filter to just files or just directories.

\`\`\`ts
const result = fs.walk('src', { files: true, directories: false, exclude: ['node_modules'] })
console.log('Total files in src/:', result.files.length)
console.log('First 5 files:')
result.files.slice(0, 5).forEach(f => console.log(' ', f))
\`\`\`

Walk returns an object with \`files\` and \`directories\` arrays of relative paths.

## Finding Files Upward

Use \`findUp()\` to search for a file by walking up the directory tree from the current working directory. This is useful for locating project root markers.

\`\`\`ts
const tsconfig = fs.findUp('tsconfig.json')
console.log('tsconfig.json found at:', tsconfig)

const packageJson = fs.findUp('package.json')
console.log('package.json found at:', packageJson)
\`\`\`

Returns the absolute path if found, or \`null\` if the file is not in any ancestor directory.

## Summary

This demo covered reading files as strings and JSON, checking existence, recursively walking directories, and searching upward for project configuration files. These are the bread-and-butter operations for any script that needs to interact with the filesystem.
`,
  "ipc-socket.md": `---
title: "IPC Socket"
tags: [ipcSocket, ipc, unix-socket, messaging]
lastTested: null
lastTestPassed: null
---

# ipcSocket

Inter-process communication via Unix domain sockets. Supports both server and client modes with JSON message serialization, broadcast messaging, and event-driven message handling.

## Overview

The \`ipcSocket\` feature enables processes to communicate through file-system-based Unix domain sockets. A server listens on a socket path and accepts multiple client connections. Messages are automatically JSON-encoded with unique IDs. Both server and client emit \`message\` events for incoming data. Because IPC requires coordinating two processes (server and client), all socket operation examples use skip blocks.

## Enabling the Feature

\`\`\`ts
const ipc = container.feature('ipcSocket', { enable: true })
console.log('IPC Socket enabled:', ipc.state.get('enabled'))
console.log('Current mode:', ipc.state.get('mode'))
\`\`\`

## Exploring the API

\`\`\`ts
const docs = container.features.describe('ipcSocket')
console.log(docs)
\`\`\`

## Checking Mode

\`\`\`ts
const ipc = container.feature('ipcSocket')
console.log('Is server:', ipc.isServer)
console.log('Is client:', ipc.isClient)
\`\`\`

## Starting a Server

Listen on a Unix domain socket and handle incoming connections.

\`\`\`ts skip
const server = await ipc.listen('/tmp/myapp.sock', true)
console.log('Server listening')

ipc.on('connection', (socket) => {
  console.log('Client connected')
})

ipc.on('message', (data) => {
  console.log('Received:', data)
  ipc.broadcast({ reply: 'ACK', original: data })
})
\`\`\`

The second argument \`true\` removes any stale socket file before binding. Without it, the call throws if the socket file already exists.

## Connecting a Client

Connect to an existing server and exchange messages.

\`\`\`ts skip
const socket = await ipc.connect('/tmp/myapp.sock')
console.log('Connected to server')

ipc.on('message', (data) => {
  console.log('Server says:', data)
})

ipc.send({ type: 'hello', clientId: 'worker-1' })
\`\`\`

Messages sent via \`ipc.send()\` are automatically wrapped with a unique ID for tracking. The server receives the original data in the \`message\` event.

## Broadcasting Messages

Send a message to all connected clients from the server.

\`\`\`ts skip
ipc.broadcast({
  type: 'notification',
  message: 'Deployment starting',
  timestamp: Date.now()
})
\`\`\`

Each connected client receives the broadcast as a \`message\` event. Messages are JSON-encoded with a UUID for correlation.

## Stopping the Server

Gracefully shut down the server and disconnect all clients.

\`\`\`ts skip
await ipc.stopServer()
console.log('Server stopped')
\`\`\`

The \`stopServer\` method closes the listener, destroys all active client connections, and resets internal state.

## Summary

The \`ipcSocket\` feature provides Unix domain socket IPC with JSON message serialization, multi-client support, broadcast messaging, and automatic socket cleanup. It works in either server or client mode within a single feature instance.
`,
  "json-tree.md": `---
title: "JSON Tree"
tags: [jsonTree, json, files, data-loading]
lastTested: null
lastTestPassed: null
---

# jsonTree

Load JSON files from directory structures into a nested object tree.

## Overview

The \`jsonTree\` feature is an on-demand feature that recursively scans a directory for \`.json\` files and builds a hierarchical JavaScript object from them. File paths are converted to camelCased property paths, so \`config/database/production.json\` becomes \`tree.config.database.production\`. This is useful when your project stores structured data across many JSON files and you want to access it all through a single unified object.

## Feature Documentation

Let us inspect the feature's built-in documentation.

\`\`\`ts
const desc = container.features.describe('jsonTree')
console.log(desc)
\`\`\`

The key method is \`loadTree(basePath, key?)\` which scans a directory and populates the \`tree\` getter.

## Enabling the Feature

Enable jsonTree and check its initial state.

\`\`\`ts
const jsonTree = container.feature('jsonTree', { enable: true })
console.log('jsonTree enabled:', jsonTree.state.enabled)
console.log('Initial tree:', JSON.stringify(jsonTree.tree))
\`\`\`

The tree starts empty until you load directories into it.

## How loadTree Works

The \`loadTree(basePath, key?)\` method recursively scans a directory for \`.json\` files, parses each one, and builds a nested object from the file paths. The optional \`key\` parameter controls where in the tree the data is stored.

\`\`\`ts
console.log('loadTree processing steps:')
console.log('  1. Scans basePath recursively for *.json files')
console.log('  2. Reads and parses each file with JSON.parse()')
console.log('  3. Converts file paths to camelCased property paths')
console.log('  4. Stores the result under the given key in feature state')
console.log('')
console.log('Example call: await jsonTree.loadTree("config", "appConfig")')
console.log('  config/db/prod.json => jsonTree.tree.appConfig.db.prod')
\`\`\`

After calling \`loadTree\`, the data is accessible through the \`tree\` getter, which returns all loaded trees minus internal state properties.

## Inspecting the Tree Getter

The \`tree\` getter provides clean access to loaded data. Before any data is loaded, it returns an empty object.

\`\`\`ts
console.log('Tree before loading:', JSON.stringify(jsonTree.tree))
console.log('Tree type:', typeof jsonTree.tree)
console.log('Tree is clean (no "enabled" key):', !('enabled' in jsonTree.tree))
\`\`\`

The getter filters out the internal \`enabled\` state property so you only see your loaded JSON data.

## Path Transformation Rules

The feature applies consistent transformations when building the tree:

- Directory names become nested object properties
- File names (without \`.json\`) become leaf properties
- All names are converted to camelCase
- Hyphens and dots in names are handled by the camelCase conversion

\`\`\`ts
// Conceptual example of path mapping:
const mappings = {
  'config/database/production.json': 'tree.config.database.production',
  'data/user-profiles.json': 'tree.data.userProfiles',
  'settings/app-config.json': 'tree.settings.appConfig',
}
for (const [file, path] of Object.entries(mappings)) {
  console.log(\`\${file} => \${path}\`)
}
\`\`\`

## Summary

This demo covered the \`jsonTree\` feature, which scans directories for JSON files and builds a nested object tree from them. File paths are transformed into camelCased property paths, making it easy to access deeply nested configuration or data files through a single unified interface.
`,
  "package-finder.md": `---
title: "Package Finder"
tags: [packageFinder, packages, dependencies, npm]
lastTested: null
lastTestPassed: null
---

# packageFinder

Scans your workspace's node_modules and builds a queryable index of every installed package. Find duplicates, inspect versions, and map dependency relationships.

## Overview

The \`packageFinder\` feature is on-demand. After enabling and starting it, it recursively walks all node_modules directories, reads every package.json, and indexes the results. Use it for dependency auditing, duplicate detection, or understanding what is actually installed in your project.

## Starting the Finder

Enable the feature and run the initial scan.

\`\`\`ts
const finder = container.feature('packageFinder')
await finder.start()
console.log('Scan complete:', finder.isStarted)
console.log('Unique packages:', finder.packageNames.length)
console.log('Total manifests:', finder.manifests.length)
\`\`\`

The difference between unique package names and total manifests reveals how many packages exist in multiple copies (different versions in different locations).

## Listing Packages

Browse the discovered package names.

\`\`\`ts
const names = finder.packageNames
console.log('First 10 packages:')
names.slice(0, 10).forEach(n => console.log(' ', n))
\`\`\`

Package names include both scoped and unscoped packages from every node_modules tree in the workspace.

## Finding a Package by Name

Look up a specific package to see its version and location.

\`\`\`ts
const zod = finder.findByName('zod')
if (zod) {
  console.log('Found:', zod.name)
  console.log('Version:', zod.version)
  console.log('Description:', zod.description)
}
\`\`\`

If multiple versions exist, \`findByName\` returns the first match. Use \`filter()\` to find all instances.

## Scoped Packages

The finder tracks which npm scopes are present in your dependencies.

\`\`\`ts
const scopes = finder.scopes
console.log('Scopes found:', scopes.length)
scopes.slice(0, 8).forEach(s => {
  const count = finder.packageNames.filter(n => n.startsWith(s)).length
  console.log(\`  \${s}: \${count} packages\`)
})
\`\`\`

This is useful for auditing which organizations and ecosystems your project depends on.

## Detecting Duplicates

Packages that appear in multiple locations (often at different versions) show up in the duplicates list.

\`\`\`ts
const dupes = finder.duplicates
console.log('Duplicate packages:', dupes.length)
dupes.slice(0, 5).forEach(name => {
  const count = finder.counts[name]
  console.log(\`  \${name}: \${count} copies\`)
})
\`\`\`

Duplicates increase install size and can cause subtle bugs when multiple versions of the same library coexist.

## Summary

This demo covered scanning the workspace for packages, listing and looking up packages, inspecting scopes, and detecting duplicates. The \`packageFinder\` feature gives you a complete inventory of your installed dependencies for auditing and analysis.
`,
  "process-manager.md": `---
title: "Process Manager"
tags: [processManager, processes, spawn, lifecycle]
lastTested: null
lastTestPassed: null
---

# processManager

Manage long-running child processes with tracking, events, and automatic cleanup.

## Overview

The \`processManager\` feature is an on-demand feature for spawning and supervising child processes. Unlike \`proc.spawn\` which blocks until a process exits, processManager returns a \`SpawnHandler\` immediately -- a handle object with its own state, events, and lifecycle methods. The feature tracks all spawned processes and can kill them all on parent exit. Use it when you need to orchestrate multiple background services, dev servers, or worker processes.

## Enabling the Feature

Enable the processManager with auto-cleanup so tracked processes are killed when the parent exits.

\`\`\`ts
const pm = container.feature('processManager', { enable: true, autoCleanup: true })
console.log('ProcessManager enabled:', pm.state.enabled)
console.log('Total spawned so far:', pm.state.totalSpawned)
\`\`\`

## Spawning a Process

Spawn a short-lived process and capture its output. The \`spawn\` method returns a \`SpawnHandler\` immediately.

\`\`\`ts
const handle = pm.spawn('echo', ['hello from process manager'], { tag: 'greeter' })
console.log('Spawned process tag:', 'greeter')
console.log('Handle has kill method:', typeof handle.kill === 'function')
\`\`\`

The handle provides methods like \`kill()\` and events like \`stdout\`, \`stderr\`, \`exited\`, and \`crashed\`.

## Listing Tracked Processes

The processManager keeps track of every process it has spawned, whether running or finished.

\`\`\`ts
const all = pm.list()
console.log('Tracked processes:', all.length)
console.log('Total spawned:', pm.state.totalSpawned)
\`\`\`

You can also look up a specific process by its tag.

\`\`\`ts
const found = pm.getByTag('greeter')
console.log('Found by tag:', found ? 'yes' : 'no')
\`\`\`

## Spawning and Killing

You can spawn a longer process and then kill it. Here we spawn \`sleep\` and immediately terminate it.

\`\`\`ts
const sleeper = pm.spawn('sleep', ['10'], { tag: 'sleeper' })
console.log('Sleeper spawned')
sleeper.kill()
console.log('Sleeper killed')
console.log('Total spawned now:', pm.state.totalSpawned)
\`\`\`

## Cleaning Up

The \`killAll\` method terminates every tracked process, and \`stop\` does a full teardown including removing exit handlers.

\`\`\`ts
pm.killAll()
const remaining = pm.list().filter(h => h.state?.status === 'running')
console.log('Running after killAll:', remaining.length)
\`\`\`

## Summary

This demo covered the \`processManager\` feature: spawning processes that return handles immediately, tracking them by ID or tag, listing all tracked processes, and killing them individually or all at once. It is the right tool for orchestrating background services, dev servers, and any scenario where you need non-blocking process management with lifecycle events.
`,
  "assistant-with-process-manager.md": `---
title: "Assistant with ProcessManager Tools"
tags: [assistant, processManager, tools, runtime, use]
lastTested: null
lastTestPassed: null
---

# Assistant with ProcessManager Tools

Create an assistant at runtime, give it processManager tools, and watch it orchestrate long-running processes — spawning ping and top, checking their output over time, running a quick command in between, then coming back to report.

## The Demo

\`\`\`ts
const pm = container.feature('processManager', { enable: true, autoCleanup: true })
const ui = container.feature('ui')

const assistant = container.feature('assistant', {
  systemPrompt: [
    'You are a process management assistant with tools to spawn, monitor, inspect, and kill background processes.',
    'When asked to check on processes, use getProcessOutput to read their latest output and summarize what you see.',
    'For ping output, parse the lines and calculate the average response time yourself.',
    'For top output, summarize CPU and memory usage from the header lines.',
    'Always be concise — give the data, not a lecture.',
  ].join('\\n'),
  model: 'gpt-4.1-mini',
})

assistant.use(pm)
await assistant.start()

const tools = Object.keys(assistant.tools)
console.log(ui.colors.cyan('Tools registered:'), tools.join(', '))
console.log()

// ── Helper to print assistant responses ──────────────────────────────
const ask = async (label, question) => {
  console.log(ui.colors.dim(\`── \${label} ──\`))
  console.log(ui.colors.yellow('→'), question.split('\\n')[0])
  const response = await assistant.ask(question)
  console.log(ui.markdown(response))
  console.log()
  return response
}

// Step 1: Spawn long-running processes
await ask('SPAWN',
  'Spawn two background processes:\\n' +
  '1. Ping google.com with tag "ping-google" (use: ping -c 20 google.com)\\n' +
  '2. Run top in batch mode with tag "top-monitor" (use: top -l 5 -s 2)\\n' +
  'Confirm both are running.'
)

// Step 2: Wait, then check in on their output
await new Promise(r => setTimeout(r, 4000))
await ask('CHECK-IN #1',
  'Check on both processes. For ping-google, read the stdout and tell me how many replies so far and the average response time. For top-monitor, read the stdout and tell me the current CPU usage summary.'
)

// Step 3: Quick one-shot command while the others keep going
await ask('QUICK COMMAND',
  'Run a quick command: "uptime" — tell me the system load averages.'
)

// Step 4: Second check-in — more data should have accumulated
await new Promise(r => setTimeout(r, 4000))
await ask('CHECK-IN #2',
  'Check on ping-google again. How many replies now vs last time? What is the average response time? Also list all tracked processes and their status.'
)

// Step 5: Kill everything
await ask('CLEANUP',
  'Kill all running processes and confirm they are stopped.'
)

// Belt and suspenders
pm.killAll()
const remaining = pm.list().filter(h => h.status === 'running')
console.log(ui.colors.green('Running after cleanup:'), remaining.length)
\`\`\`

## Summary

This example showed a runtime assistant orchestrating real background processes over multiple conversation turns — spawning long-running \`ping\` and \`top\` commands, checking in on their output as it accumulates, running a quick \`uptime\` in between, then coming back for a second check-in before cleaning everything up. The assistant parsed ping times, summarized CPU usage, and managed the full lifecycle without any hardcoded logic — just natural language and processManager tools.
`,
  "postgres.md": `---
title: "PostgreSQL"
tags: [postgres, database, sql, storage]
lastTested: null
lastTestPassed: null
---

# postgres

PostgreSQL feature for safe SQL execution through Bun's native SQL client. Supports parameterized queries, tagged-template literals, and write operations.

## Overview

Use the \`postgres\` feature when you need to interact with a PostgreSQL database. It provides three query interfaces: parameterized \`query()\` for reads, \`execute()\` for writes, and the \`sql\` tagged template for injection-safe inline SQL.

Requires a running PostgreSQL instance and a connection URL.

## Enabling the Feature

\`\`\`ts
const pg = container.feature('postgres', {
  url: 'postgres://user:pass@localhost:5432/mydb'
})
console.log('Postgres feature created')
console.log('Connection URL configured:', !!pg.state.url)
\`\`\`

Pass your connection URL via the \`url\` option. In production, read from an environment variable.

## API Documentation

\`\`\`ts
const info = await container.features.describe('postgres')
console.log(info)
\`\`\`

## Parameterized Queries

Use \`query()\` for SELECT statements with \`$N\` placeholders to prevent SQL injection.

\`\`\`ts skip
const users = await pg.query(
  'SELECT id, email FROM users WHERE active = $1 LIMIT $2',
  [true, 10]
)
console.log(\`Found \${users.length} active users\`)
users.forEach(u => console.log(\`  \${u.id}: \${u.email}\`))
\`\`\`

With a running database, this would return an array of row objects matching the query. The \`query\` event fires on each execution.

## Tagged Template SQL

The \`sql\` tagged template automatically converts interpolated values into bound parameters.

\`\`\`ts skip
const email = 'hello@example.com'
const rows = await pg.sql\`
  SELECT id, name FROM users WHERE email = \${email}
\`
console.log('Found:', rows)
\`\`\`

This is the most ergonomic way to write queries. Each interpolated value becomes a \`$N\` parameter automatically, preventing SQL injection without manual placeholder numbering.

## Write Operations

Use \`execute()\` for INSERT, UPDATE, and DELETE statements that return affected row counts.

\`\`\`ts skip
const { rowCount } = await pg.execute(
  'UPDATE users SET active = $1 WHERE last_login < $2',
  [false, '2024-01-01']
)
console.log(\`Deactivated \${rowCount} users\`)
\`\`\`

The \`execute\` event fires with the row count after each write operation.

## Closing the Connection

\`\`\`ts skip
await pg.close()
console.log('Connection closed:', !pg.state.connected)
\`\`\`

Always close the connection when done. The \`closed\` event fires after teardown.

## Summary

The \`postgres\` feature wraps Bun's native SQL client with three query methods: \`query()\` for parameterized reads, \`execute()\` for writes, and the \`sql\` tagged template for ergonomic injection-safe queries. Events fire for each operation. Key methods: \`query()\`, \`execute()\`, \`sql\`, \`close()\`.
`,
  "python.md": `---
title: "Python"
tags: [python, scripting, virtualenv, integration]
lastTested: null
lastTestPassed: null
---

# python

Python virtual machine feature for executing Python code, managing environments, and installing dependencies. Automatically detects uv, conda, venv, or system Python.

## Overview

The \`python\` feature provides a bridge between Luca and the Python ecosystem. It auto-detects the best available Python environment (uv, conda, venv, system), can install project dependencies, and execute Python code with variable injection and local variable capture. Requires Python to be installed on the host.

## Enabling the Feature

\`\`\`ts
const python = container.feature('python', { enable: true })
console.log('Python feature enabled:', python.state.get('enabled'))
console.log('Python ready:', python.state.get('isReady'))
\`\`\`

## Exploring the API

\`\`\`ts
const docs = container.features.describe('python')
console.log(docs)
\`\`\`

## Environment Detection

\`\`\`ts
const python = container.feature('python')
await python.detectEnvironment()
console.log('Environment type:', python.state.get('environmentType'))
console.log('Python path:', python.state.get('pythonPath'))
\`\`\`

## Running Inline Code

Execute Python code directly and capture the output.

\`\`\`ts skip
const result = await python.execute('print("Hello from Python!")')
console.log('stdout:', result.stdout)
console.log('exit code:', result.exitCode)
\`\`\`

You can also pass variables into the Python context and capture locals after execution.

\`\`\`ts skip
const result = await python.execute(
  'greeting = f"Hello {name}, you are {age}!";\\nprint(greeting)',
  { name: 'Alice', age: 30 },
  { captureLocals: true }
)
console.log('stdout:', result.stdout)
console.log('locals:', result.locals)
\`\`\`

The \`captureLocals\` option serializes all local variables from the script back to JavaScript as JSON.

## Running a Script File

Execute an existing \`.py\` file and capture its output.

\`\`\`ts skip
const result = await python.executeFile('/path/to/analysis.py')
console.log('stdout:', result.stdout)
console.log('stderr:', result.stderr)
\`\`\`

## Creating a Virtual Environment

Install project dependencies using the auto-detected package manager.

\`\`\`ts skip
const python = container.feature('python', {
  dir: '/path/to/python-project',
  installCommand: 'pip install -r requirements.txt'
})
const result = await python.installDependencies()
console.log('Install exit code:', result.exitCode)
\`\`\`

When no \`installCommand\` is provided, the feature infers the correct command from the detected environment type (e.g., \`uv sync\` for uv, \`pip install -e .\` for venv).

## Summary

The \`python\` feature bridges Luca and Python by auto-detecting environments, managing dependencies, and providing inline code execution with variable injection. It supports uv, conda, venv, and system Python installations.
`,
  "yaml.md": `---
title: "YAML"
tags: [yaml, parsing, serialization, config]
lastTested: null
lastTestPassed: null
---

# yaml

Parse YAML strings into JavaScript objects and serialize objects back to YAML. A thin wrapper around js-yaml.

## Overview

The \`yaml\` feature is on-demand. It provides two methods: \`parse()\` and \`stringify()\`. Use it any time you need to read or write YAML configuration files, convert between formats, or work with YAML data in memory.

## Parsing a YAML String

Start by enabling the feature and parsing some YAML.

\`\`\`ts
const yml = container.feature('yaml')
const config = yml.parse(\`
name: my-app
version: 2.1.0
database:
  host: localhost
  port: 5432
features:
  - auth
  - logging
  - caching
\`)
console.log('Parsed name:', config.name)
console.log('Parsed db host:', config.database.host)
console.log('Parsed features:', config.features)
\`\`\`

The parser handles nested objects, arrays, numbers, and booleans automatically.

## Serializing an Object to YAML

Use \`stringify()\` to convert a JavaScript object into a YAML-formatted string.

\`\`\`ts
const output = yml.stringify({
  server: { host: '0.0.0.0', port: 3000 },
  logging: { level: 'info', pretty: true },
  cors: { origins: ['https://example.com', 'https://app.example.com'] }
})
console.log('YAML output:')
console.log(output)
\`\`\`

The output is human-readable and suitable for writing to configuration files.

## Round-Trip Conversion

A common pattern is reading YAML, modifying data, and writing it back. Here we verify that a round-trip preserves data.

\`\`\`ts
const original = \`
environment: production
replicas: 3
resources:
  cpu: 500m
  memory: 256Mi
\`
const parsed = yml.parse(original)
parsed.replicas = 5
parsed.resources.memory = '512Mi'
const updated = yml.stringify(parsed)
console.log('Updated YAML:')
console.log(updated)
const reparsed = yml.parse(updated)
console.log('Replicas after round-trip:', reparsed.replicas)
console.log('Memory after round-trip:', reparsed.resources.memory)
\`\`\`

The data survives the parse-modify-stringify cycle intact.

## Working with Complex Structures

YAML handles deeply nested and mixed-type structures well.

\`\`\`ts
const complex = yml.stringify({
  users: [
    { name: 'Alice', roles: ['admin', 'editor'], active: true },
    { name: 'Bob', roles: ['viewer'], active: false },
  ],
  settings: {
    maxRetries: 3,
    timeout: null,
    nested: { deep: { value: 42 } }
  }
})
console.log(complex)
\`\`\`

Nulls, booleans, numbers, and nested arrays all serialize cleanly.

## Summary

This demo covered parsing YAML strings, serializing objects to YAML, round-trip conversion, and handling complex nested structures. The \`yaml\` feature gives you a clean two-method API for all YAML operations.
`,
  "nlp.md": `---
title: "Natural Language Processing"
tags: [nlp, parsing, text-analysis]
lastTested: null
lastTestPassed: null
---

# nlp

Natural language processing utilities for parsing utterances into structured data, POS tagging, and entity extraction.

## Overview

The \`nlp\` feature is an on-demand feature that combines two complementary NLP libraries: **compromise** for verb normalization and quick structural parsing, and **wink-nlp** for high-accuracy part-of-speech tagging and named entity recognition. Use it when you need to extract intent from voice commands, classify sentence structure, or identify entities in text.

## Enabling the Feature

The nlp feature is on-demand, so we enable it explicitly.

\`\`\`ts
const nlp = container.feature('nlp', { enable: true })
console.log('NLP feature enabled:', nlp.state.enabled)
\`\`\`

## Parsing Voice Commands

The \`parse()\` method uses compromise to extract structured command data: an intent (normalized verb), a target noun, an optional prepositional subject, and any modifiers.

\`\`\`ts
const cmd1 = nlp.parse("open the terminal")
console.log('Command:', JSON.stringify(cmd1, null, 2))
\`\`\`

Prepositional phrases with "of" are extracted as the subject.

\`\`\`ts
const cmd2 = nlp.parse("draw a diagram of the auth flow")
console.log('Command with subject:', JSON.stringify(cmd2, null, 2))
\`\`\`

Notice how \`intent\` is the normalized verb form ("draw"), \`target\` is the direct object ("diagram"), and \`subject\` captures the prepositional phrase ("auth flow").

## POS Tagging and Entity Recognition

The \`analyze()\` method uses wink-nlp for high-accuracy part-of-speech tagging and named entity recognition.

\`\`\`ts
const analysis = nlp.analyze("meet john at 3pm about the deployment")
console.log('Tokens:')
for (const tok of analysis.tokens) {
  console.log(\`  \${tok.value.padEnd(15)} \${tok.pos}\`)
}
console.log('Entities:', JSON.stringify(analysis.entities))
\`\`\`

Each token is tagged with its part of speech (VERB, NOUN, ADP, DET, etc.) and named entities like times and proper nouns are extracted separately.

## Full Understanding

The \`understand()\` method combines both \`parse()\` and \`analyze()\` into a single result, giving you structured command data alongside detailed POS tags and entities.

\`\`\`ts
const full = nlp.understand("send an email to sarah about the quarterly report")
console.log('Intent:', full.intent)
console.log('Target:', full.target)
console.log('Modifiers:', full.modifiers)
console.log('Token count:', full.tokens.length)
console.log('Entities:', JSON.stringify(full.entities))
\`\`\`

This is the most complete method when you need both the high-level command structure and the detailed linguistic analysis in one call.

## Comparing Multiple Commands

Parse is fast and lightweight, making it suitable for batch processing of voice commands.

\`\`\`ts
const commands = [
  "deploy the app to production",
  "restart the database server",
  "show logs for the api gateway",
]
for (const raw of commands) {
  const parsed = nlp.parse(raw)
  console.log(\`"\${raw}" => intent: \${parsed.intent}, target: \${parsed.target}\`)
}
\`\`\`

## Summary

This demo covered the three main methods of the \`nlp\` feature: \`parse()\` for quick structural extraction from voice commands, \`analyze()\` for detailed POS tagging and entity recognition, and \`understand()\` for a combined view of both. The feature is well suited for building voice command interpreters, chatbot intent classifiers, and text analysis pipelines.
`,
  "structured-output-with-assistants.md": `---
title: "Structured Output with Assistants"
tags: [assistant, conversation, structured-output, zod, openai]
lastTested: null
lastTestPassed: null
---

# Structured Output with Assistants

Get typed, schema-validated JSON responses from OpenAI instead of raw text strings.

## Overview

OpenAI's Structured Outputs feature constrains the model to return JSON that exactly matches a schema you provide. Combined with Zod, this means \`ask()\` can return parsed objects instead of strings — no regex parsing, no "please respond in JSON", no malformed output.

Pass a \`schema\` option to \`ask()\` and the response comes back as a parsed object guaranteed to match your schema.

## Basic: Extract Structured Data

The simplest use case — ask a question and get structured data back.

\`\`\`ts
const { z } = container
const conversation = container.feature('conversation', {
  model: 'gpt-4.1-mini',
  history: [{ role: 'system', content: 'You are a helpful data extraction assistant.' }]
})

const result = await conversation.ask('The founders of Apple are Steve Jobs, Steve Wozniak, and Ronald Wayne. They started it in 1976 in Los Altos, California.', {
  schema: z.object({
    company: z.string(),
    foundedYear: z.number(),
    location: z.string(),
    founders: z.array(z.string()),
  }).describe('CompanyInfo')
})

console.log('Company:', result.company)
console.log('Founded:', result.foundedYear)
console.log('Location:', result.location)
console.log('Founders:', result.founders)
\`\`\`

The \`.describe()\` on the schema gives OpenAI the schema name — keep it short and descriptive.

## Enums and Categorization

Structured outputs work great for classification tasks where you want the model to pick from a fixed set of values.

\`\`\`ts
const { z } = container
const conversation = container.feature('conversation', {
  model: 'gpt-4.1-mini',
  history: [{ role: 'system', content: 'You are a helpful assistant.' }]
})

const sentiment = await conversation.ask('I absolutely love this product, it changed my life!', {
  schema: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral', 'mixed']),
    confidence: z.number(),
    reasoning: z.string(),
  }).describe('SentimentAnalysis')
})

console.log('Sentiment:', sentiment.sentiment)
console.log('Confidence:', sentiment.confidence)
console.log('Reasoning:', sentiment.reasoning)
\`\`\`

Because the model is constrained by the schema, \`sentiment\` will always be one of the four allowed values.

## Nested Objects and Arrays

Schemas can be as complex as you need. Here we extract a structured analysis with nested objects.

\`\`\`ts
const { z } = container
const conversation = container.feature('conversation', {
  model: 'gpt-4.1-mini',
  history: [{ role: 'system', content: 'You are a technical analyst.' }]
})

const analysis = await conversation.ask(
  'TypeScript 5.5 introduced inferred type predicates, which automatically narrow types in filter callbacks. It also added isolated declarations for faster builds in monorepos, and a new regex syntax checking feature.',
  {
    schema: z.object({
      subject: z.string(),
      version: z.string(),
      features: z.array(z.object({
        name: z.string(),
        category: z.enum(['type-system', 'performance', 'developer-experience', 'syntax', 'other']),
        summary: z.string(),
      })),
      featureCount: z.number(),
    }).describe('ReleaseAnalysis')
  }
)

console.log('Subject:', analysis.subject, analysis.version)
console.log('Features:')
for (const f of analysis.features) {
  console.log(\`  [\${f.category}] \${f.name}: \${f.summary}\`)
}
console.log('Total features:', analysis.featureCount)
\`\`\`

Every level of nesting is validated — the model cannot return a feature without a category or skip required fields.

## With an Assistant

Structured outputs work the same way through the assistant API. The schema passes straight through to the underlying conversation.

\`\`\`ts
const { z } = container
const assistant = container.feature('assistant', {
  systemPrompt: 'You are a code review assistant. You analyze code snippets and provide structured feedback.',
  model: 'gpt-4.1-mini',
})

const review = await assistant.ask(
  'Review this: function add(a, b) { return a + b }',
  {
    schema: z.object({
      issues: z.array(z.object({
        severity: z.enum(['info', 'warning', 'error']),
        message: z.string(),
      })),
      suggestion: z.string(),
      score: z.number(),
    }).describe('CodeReview')
  }
)

console.log('Score:', review.score)
console.log('Suggestion:', review.suggestion)
console.log('Issues:')
for (const issue of review.issues) {
  console.log(\`  [\${issue.severity}] \${issue.message}\`)
}
\`\`\`

## Summary

This demo covered extracting structured data, classification with enums, nested schema validation, and using structured outputs through both the conversation and assistant APIs. The key is passing a Zod schema via \`{ schema }\` in the options to \`ask()\` — OpenAI guarantees the response matches, and you get a parsed object back.
`,
  "networking.md": `---
title: "networking"
tags: [networking, ports, network, core]
lastTested: null
lastTestPassed: null
---

# networking

Port discovery and availability checking for network services.

## Overview

The \`networking\` feature is a core feature, auto-enabled on every container. You can access it directly as a global or via \`container.feature('networking')\`. It provides async methods for finding available ports and checking whether a given port is already in use. Use it before starting servers to avoid port conflicts.

## Finding an Open Port

Use \`findOpenPort()\` to get the next available port starting from a given number. If the requested port is taken, it searches upward.

\`\`\`ts
const port = await networking.findOpenPort(3000)
console.log('Available port starting from 3000:', port)
\`\`\`

If port 3000 is free, you get 3000 back. If not, you get the next one that is.

## Checking Port Availability

Use \`isPortOpen()\` to check whether a specific port is available without claiming it.

\`\`\`ts
const is3000Open = await networking.isPortOpen(3000)
console.log('Port 3000 available:', is3000Open)

const is80Open = await networking.isPortOpen(80)
console.log('Port 80 available:', is80Open)
\`\`\`

Returns \`true\` if the port is free, \`false\` if something is already listening on it.

## Finding Multiple Ports

You can call \`findOpenPort()\` with different starting points to allocate several non-conflicting ports for a multi-service setup.

\`\`\`ts
const apiPort = await networking.findOpenPort(8080)
const wsPort = await networking.findOpenPort(8090)
const devPort = await networking.findOpenPort(5173)
console.log('API server port:', apiPort)
console.log('WebSocket port:', wsPort)
console.log('Dev server port:', devPort)
\`\`\`

Each call independently finds the next available port from its starting point.

## Summary

This demo covered finding available ports from a starting number, checking individual port availability, and allocating multiple ports for multi-service architectures. The \`networking\` feature eliminates port conflicts before they happen.
`,
  "vault.md": `---
title: "Vault"
tags: [vault, encryption, security, crypto]
lastTested: null
lastTestPassed: null
---

# vault

AES-256-GCM encryption and decryption for sensitive data. Encrypt strings and get them back with a simple two-method API.

## Overview

The \`vault\` feature is on-demand. It generates or accepts a secret key and provides \`encrypt()\` and \`decrypt()\` methods using AES-256-GCM, an authenticated encryption scheme. Use it to protect sensitive configuration values, tokens, or any data that should not be stored in plaintext.

## Enabling the Vault

Create a vault instance. It will generate a secret key automatically.

\`\`\`ts
const vault = container.feature('vault')
console.log('Vault enabled:', vault.state.get('enabled'))
\`\`\`

The vault is ready to use immediately after creation.

## Encrypting a String

Pass any plaintext string to \`encrypt()\` and receive an opaque encrypted payload.

\`\`\`ts
const secret = 'my-database-password-12345'
const encrypted = vault.encrypt(secret)
console.log('Original:', secret)
console.log('Encrypted:', encrypted)
console.log('Encrypted length:', encrypted.length)
\`\`\`

The encrypted output is a base64-encoded string containing the IV, auth tag, and ciphertext. It is safe to store in config files or databases.

## Decrypting Back to Plaintext

Use \`decrypt()\` with the same vault instance to recover the original value.

\`\`\`ts
const decrypted = vault.decrypt(encrypted)
console.log('Decrypted:', decrypted)
console.log('Round-trip matches:', decrypted === secret)
\`\`\`

The decrypted value is identical to the original input.

## Encrypting Multiple Values

Each call to \`encrypt()\` produces a unique ciphertext, even for the same input, because a fresh IV is generated every time.

\`\`\`ts
const a = vault.encrypt('same-input')
const b = vault.encrypt('same-input')
console.log('Encryption A:', a)
console.log('Encryption B:', b)
console.log('Same ciphertext?', a === b)
console.log('Both decrypt correctly?', vault.decrypt(a) === vault.decrypt(b))
\`\`\`

This property (semantic security) means an attacker cannot tell if two ciphertexts contain the same plaintext.

## Summary

This demo covered enabling the vault, encrypting strings, decrypting them back, and verifying that repeated encryption produces unique ciphertexts. The \`vault\` feature provides straightforward authenticated encryption for any sensitive data your application handles.
`,
  "google-calendar.md": `---
title: "Google Calendar"
tags: [googleCalendar, google, calendar, events, scheduling]
lastTested: null
lastTestPassed: null
---

# googleCalendar

Google Calendar feature for listing calendars and reading events. Creates a Calendar v3 API client and depends on \`googleAuth\` for authentication.

## Overview

Use the \`googleCalendar\` feature when you need to read calendar data: list calendars, fetch today's events, look ahead at upcoming days, or search events by text. Provides convenience methods for common time-based queries alongside the full \`listEvents()\` for custom ranges.

Requires Google OAuth2 credentials or a service account with Calendar access.

## Enabling the Feature

\`\`\`ts
const calendar = container.feature('googleCalendar', {
  defaultCalendarId: 'primary',
  timeZone: 'America/Chicago'
})
console.log('Google Calendar feature created')
console.log('Default calendar:', calendar.defaultCalendarId)
\`\`\`

## API Documentation

\`\`\`ts
const info = await container.features.describe('googleCalendar')
console.log(info)
\`\`\`

## Listing Calendars

Discover all calendars accessible to the authenticated user.

\`\`\`ts skip
const calendars = await calendar.listCalendars()
calendars.forEach(c => console.log(\`  \${c.summary} (\${c.id})\`))
\`\`\`

Returns calendar metadata including ID, summary, time zone, and access role. Use the ID to target specific calendars in other methods.

## Today's Events and Upcoming

Quick methods for the most common queries.

\`\`\`ts skip
const today = await calendar.getToday()
console.log(\`Today: \${today.length} events\`)
today.forEach(e => console.log(\`  \${e.start} - \${e.summary}\`))

const upcoming = await calendar.getUpcoming(7)
console.log(\`Next 7 days: \${upcoming.length} events\`)
upcoming.forEach(e => console.log(\`  \${e.start} - \${e.summary}\`))
\`\`\`

\`getToday()\` returns events from midnight to midnight in the configured timezone. \`getUpcoming(days)\` looks ahead the specified number of days from now.

## Searching Events

Search across event summaries, descriptions, and locations.

\`\`\`ts skip
const meetings = await calendar.searchEvents('standup')
console.log(\`Found \${meetings.length} standup events\`)
meetings.forEach(e => console.log(\`  \${e.start} - \${e.summary}\`))
\`\`\`

The search is freetext and matches against multiple event fields. Combine with time range options for more precise results.

## Custom Time Range Queries

Use \`listEvents()\` for full control over the query parameters.

\`\`\`ts skip
const events = await calendar.listEvents({
  timeMin: '2026-03-01T00:00:00Z',
  timeMax: '2026-03-31T23:59:59Z',
  maxResults: 50,
  orderBy: 'startTime',
  singleEvents: true
})
console.log(\`March events: \${events.items.length}\`)
\`\`\`

Supports pagination via \`pageToken\`, ordering by \`startTime\` or \`updated\`, and filtering by calendar ID.

## Summary

The \`googleCalendar\` feature provides read access to Google Calendar events. Use the convenience methods \`getToday()\` and \`getUpcoming()\` for quick lookups, \`searchEvents()\` for text search, or \`listEvents()\` for full query control. Authentication is handled by \`googleAuth\`. Key methods: \`listCalendars()\`, \`getToday()\`, \`getUpcoming()\`, \`searchEvents()\`, \`listEvents()\`.
`,
  "content-db.md": `---
title: "Content Database"
tags: [contentDb, markdown, content, database]
lastTested: null
lastTestPassed: null
---

# contentDb

Treat folders of structured markdown files as queryable databases. Each markdown file is a document with frontmatter metadata and content.

## Overview

The \`contentDb\` feature is on-demand. Enable it with a \`rootPath\` pointing to a directory that contains a \`models.ts\` file and subfolders of markdown documents. It is perfect for documentation sites, knowledge bases, or any content-driven application where markdown is the source of truth.

## Loading a Collection

We point the feature at the project's docs directory, which already has models and content.

\`\`\`ts
const contentDb = container.feature('contentDb', { rootPath: '.' })
await contentDb.load()
console.log('Loaded:', contentDb.isLoaded)
\`\`\`

The \`load()\` call discovers the models defined in \`models.ts\` and parses every markdown file in the matching prefix directories.

## Discovering Models

Each collection has named models. Let us see what is available.

\`\`\`ts
const names = contentDb.modelNames
console.log('Available models:', names)
\`\`\`

Models correspond to subdirectories. Each model defines a schema for the frontmatter metadata its documents must conform to.

## Querying Documents

Use \`query()\` to fetch documents belonging to a model. Here we query the Tutorial model.

\`\`\`ts
const tutorials = await contentDb.query(contentDb.models.Tutorial).fetchAll()
console.log('Tutorial count:', tutorials.length)
tutorials.slice(0, 3).forEach(doc => {
  console.log('-', doc.id, '|', doc.meta?.title)
})
\`\`\`

Documents come back with their parsed frontmatter, content, and a unique id derived from the file path.

## Parsing a Single File

You can also parse any markdown file directly without going through the query system.

\`\`\`ts
const doc = contentDb.parseMarkdownAtPath('./docs/tutorials/01-getting-started.md')
console.log('Title:', doc.meta?.title)
console.log('Tags:', doc.meta?.tags)
\`\`\`

This is useful when you know exactly which file you want and do not need to iterate over a collection.

## Collection Summary

The feature tracks a model summary in its state, giving you a quick overview of the entire collection.

\`\`\`ts
console.log(contentDb.state.get('modelSummary'))
\`\`\`

This summary shows each model and how many documents belong to it.

## Summary

This demo covered loading a contentbase collection, listing models, querying documents by model, parsing individual markdown files, and inspecting the collection summary. The \`contentDb\` feature turns your markdown files into a lightweight, schema-validated content database.
`,
  "file-manager.md": `---
title: "File Manager"
tags: [fileManager, files, indexing, filesystem]
lastTested: null
lastTestPassed: null
---

# fileManager

Builds an in-memory index of every file in your project with metadata and glob matching. Think of it as a fast, queryable snapshot of your file tree.

## Overview

The \`fileManager\` feature is on-demand. After enabling it and calling \`start()\`, it scans the project directory and indexes every file. You can then match files by glob patterns, inspect metadata, and list unique extensions. It is useful for code analysis tools, documentation generators, or any script that needs to reason about project structure.

## Starting the File Manager

Enable the feature and kick off the initial scan.

\`\`\`ts
const fm = container.feature('fileManager')
await fm.start()
console.log('Scan complete:', fm.isStarted)
console.log('Total files indexed:', fm.fileIds.length)
\`\`\`

The scan respects common ignore patterns (node_modules, .git, etc.) by default.

## Matching Files by Glob

Use \`match()\` to find file paths matching a glob pattern.

\`\`\`ts
const tsFiles = fm.match('**/*.ts')
console.log('TypeScript files found:', tsFiles.length)
tsFiles.slice(0, 5).forEach(f => console.log(' ', f))
\`\`\`

This returns an array of relative file paths that match the pattern.

## Inspecting File Metadata

Use \`matchFiles()\` to get full file objects instead of just paths. Each object contains metadata about the file.

\`\`\`ts
const pkgFiles = fm.matchFiles('package.json')
pkgFiles.forEach(f => {
  console.log('File:', f.id)
  console.log('  Extension:', f.extension)
  console.log('  Directory:', f.directory)
})
\`\`\`

File objects include properties like \`id\` (relative path), \`extension\`, and \`directory\`.

## Unique Extensions

The file manager tracks every file extension it encounters across the project.

\`\`\`ts
const extensions = fm.uniqueExtensions
console.log('Unique extensions:', extensions.length)
console.log('Extensions:', extensions.slice(0, 15).join(', '))
\`\`\`

This is handy for understanding the technology mix in a project at a glance.

## Directory Listing

You can also get the unique set of directories that contain indexed files.

\`\`\`ts
const dirs = fm.directoryIds
console.log('Directories:', dirs.length)
dirs.slice(0, 8).forEach(d => console.log(' ', d))
\`\`\`

Combined with glob matching, this gives you a complete picture of the project layout.

## Summary

This demo covered starting the file manager, glob matching, inspecting file metadata, listing unique extensions, and enumerating directories. The \`fileManager\` feature provides a fast, in-memory file index for project analysis and tooling.
`,
  "runpod.md": `---
title: "RunPod GPU Cloud"
tags: [runpod, gpu, cloud, pods, ssh, infrastructure]
lastTested: null
lastTestPassed: null
---

# runpod

GPU cloud pod management via the RunPod REST API and CLI. Provision GPU instances, manage network volumes, SSH into pods, and transfer files.

## Overview

Use the \`runpod\` feature when you need to manage GPU cloud infrastructure. It provides a complete interface for creating and managing RunPod GPU pods, including template selection, volume management, SSH access, file transfers, and lifecycle operations (start, stop, remove). Integrates with the \`secureShell\` feature for remote command execution.

Requires a \`RUNPOD_API_KEY\` environment variable or an \`apiKey\` option.

## Enabling the Feature

\`\`\`ts
const runpod = container.feature('runpod', {
  dataCenterId: 'US-TX-3'
})
console.log('RunPod feature created')
console.log('Data center:', runpod.dataCenterId)
console.log('API key configured:', !!runpod.apiKey)
\`\`\`

## API Documentation

\`\`\`ts
const info = await container.features.describe('runpod')
console.log(info)
\`\`\`

## Listing Pods and GPUs

Query your existing pods and available GPU types.

\`\`\`ts skip
const pods = await runpod.getpods()
pods.forEach(p => console.log(\`\${p.name}: \${p.desiredStatus} - $\${p.costPerHr}/hr\`))

const gpus = await runpod.listSecureGPUs()
gpus.forEach(g => console.log(\`\${g.gpuType}: $\${g.ondemandPrice}/hr\`))
\`\`\`

Use \`getpods()\` for detailed REST API data including port mappings and public IP, or \`listPods()\` for a quick summary via the CLI.

## Creating and Managing Pods

Provision a new GPU pod and manage its lifecycle.

\`\`\`ts skip
const pod = await runpod.createPod({
  name: 'my-training-pod',
  gpuTypeId: 'NVIDIA RTX 4090',
  templateId: 'abc123',
  volumeInGb: 50,
  containerDiskInGb: 50,
  ports: ['8888/http', '22/tcp']
})
console.log(\`Pod \${pod.id} created\`)

const ready = await runpod.waitForPod(pod.id, 'RUNNING', { timeout: 120000 })
console.log('Pod is running:', ready.desiredStatus)
\`\`\`

After creation, use \`waitForPod()\` to poll until the pod reaches the desired status.

## Pod Lifecycle

\`\`\`ts skip
await runpod.stopPod('pod-abc123')
console.log('Pod stopped')

await runpod.startPod('pod-abc123')
console.log('Pod restarted')

await runpod.removePod('pod-abc123')
console.log('Pod permanently deleted')
\`\`\`

Stopping a pod preserves its disk; removing it is permanent.

## SSH and Remote Execution

Connect to a running pod and execute commands remotely.

\`\`\`ts skip
const shell = await runpod.getShell('pod-abc123')
const output = await shell.exec('nvidia-smi')
console.log(output)

const ls = await shell.exec('ls /workspace')
console.log('Workspace files:', ls)
\`\`\`

The \`getShell()\` method uses REST API data for reliable SSH connections. Use it over \`createRemoteShell()\` which depends on the CLI.

## Network Volumes

Manage persistent storage that survives pod restarts.

\`\`\`ts skip
const vol = await runpod.createVolume({ name: 'my-models', size: 100 })
console.log(\`Created volume \${vol.id}\`)

const volumes = await runpod.listVolumes()
volumes.forEach(v => console.log(\`\${v.name}: \${v.size}GB\`))

await runpod.removeVolume('vol-abc123')
\`\`\`

Attach network volumes to pods via the \`networkVolumeId\` option in \`createPod()\`.

## Summary

The \`runpod\` feature provides complete GPU cloud management. Create pods from templates, manage lifecycle (start/stop/remove), SSH into running pods, and manage network storage volumes. Supports polling for readiness and file transfer operations. Key methods: \`createPod()\`, \`getpods()\`, \`waitForPod()\`, \`getShell()\`, \`listVolumes()\`, \`createVolume()\`.
`,
  "websocket-ask-and-reply-example.md": `---
title: "websocket-ask-and-reply"
tags: [websocket, client, server, ask, reply, rpc]
lastTested: null
lastTestPassed: null
---

# websocket-ask-and-reply

Request/response conversations over WebSocket using \`ask()\` and \`reply()\`.

## Overview

The WebSocket client and server both support a request/response protocol on top of the normal fire-and-forget message stream. The client can \`ask()\` the server a question and await the answer. The server can \`ask()\` a connected client the same way. Under the hood it works with correlation IDs — \`requestId\` on the request, \`replyTo\` on the response — but you never have to touch those directly.

## Setup

Declare the shared references that all blocks will use, and wire up the server's message handler. This block is synchronous so the variables persist across subsequent blocks.

\`\`\`ts
var port = 0
var server = container.server('websocket', { json: true })
var client = null

server.on('message', (data, ws) => {
  if (data.type === 'add') {
    data.reply({ sum: data.data.a + data.data.b })
  } else if (data.type === 'divide') {
    if (data.data.b === 0) {
      data.replyError('division by zero')
    } else {
      data.reply({ result: data.data.a / data.data.b })
    }
  }
})
console.log('Server and handlers configured')
\`\`\`

## Start Server and Connect Client

\`\`\`ts
port = await networking.findOpenPort(19900)
await server.start({ port })
console.log('Server listening on port', port)

client = container.client('websocket', { baseURL: \`ws://localhost:\${port}\` })
await client.connect()
console.log('Client connected')
\`\`\`

## Client Asks the Server

\`ask(type, data, timeout?)\` sends a message and returns a promise that resolves with the response payload.

\`\`\`ts
var sum = await client.ask('add', { a: 3, b: 4 })
console.log('3 + 4 =', sum.sum)

var quotient = await client.ask('divide', { a: 10, b: 3 })
console.log('10 / 3 =', quotient.result.toFixed(2))
\`\`\`

## Handling Errors

When the server calls \`replyError(message)\`, the client's \`ask()\` promise rejects with that message.

\`\`\`ts
try {
  await client.ask('divide', { a: 1, b: 0 })
} catch (err) {
  console.log('Caught error:', err.message)
}
\`\`\`

## Server Asks the Client

The server can also ask a connected client. The client handles incoming requests by listening for messages with a \`requestId\` and sending back a \`replyTo\` response.

\`\`\`ts
client.on('message', (data) => {
  if (data.requestId && data.type === 'whoAreYou') {
    client.send({ replyTo: data.requestId, data: { name: 'luca-client', version: '1.0' } })
  }
})

var firstClient = [...server.connections][0]
var identity = await server.ask(firstClient, 'whoAreYou')
console.log('Client identified as:', identity.name, identity.version)
\`\`\`

## Timeouts

If nobody replies, \`ask()\` rejects after the timeout (default 10s, configurable as the third argument).

\`\`\`ts
try {
  await client.ask('noop', {}, 500)
} catch (err) {
  console.log('Timed out as expected:', err.message)
}
\`\`\`

## Regular Messages Still Work

Messages without \`requestId\` flow through the normal \`message\` event as always. The ask/reply protocol is purely additive.

\`\`\`ts
var received = null
server.on('message', (data) => {
  if (data.type === 'ping') received = data
})

await client.send({ type: 'ping', ts: Date.now() })
await new Promise(r => setTimeout(r, 50))
console.log('Regular message received:', received.type, '— no requestId:', received.requestId === undefined)
\`\`\`

## Cleanup

\`\`\`ts
await client.disconnect()
await server.stop()
console.log('Done')
\`\`\`

## Summary

The ask/reply protocol gives you awaitable request/response over WebSocket without leaving the Luca helper API. The client calls \`ask(type, data)\` and gets back a promise. The server's message handler gets \`reply()\` and \`replyError()\` injected on any message that carries a \`requestId\`. The server can also \`ask()\` a specific client. Timeouts, error propagation, and cleanup of pending requests on disconnect are all handled automatically.
`,
  "port-exposer.md": `---
title: "Port Exposer"
tags: [portExposer, ngrok, networking, tunnel]
lastTested: null
lastTestPassed: null
---

# portExposer

Exposes local HTTP services via ngrok with SSL-enabled public URLs. Useful for development, testing webhooks, and sharing local services with external consumers.

## Overview

The \`portExposer\` feature creates an ngrok tunnel from a local port to a public HTTPS URL. It supports custom subdomains, regional endpoints, basic auth, and OAuth (features that require a paid ngrok plan). Requires ngrok to be installed or available as a dependency, and optionally an auth token for premium features.

## Enabling the Feature

\`\`\`ts
const exposer = container.feature('portExposer', {
  port: 3000,
  enable: true
})
console.log('Port Exposer enabled:', exposer.state.get('enabled'))
\`\`\`

## Exploring the API

\`\`\`ts
const docs = container.features.describe('portExposer')
console.log(docs)
\`\`\`

## Checking Connection State

\`\`\`ts
const exposer = container.feature('portExposer', { port: 3000 })
console.log('Connected:', exposer.isConnected())
\`\`\`

## Exposing a Port

Create a tunnel and get the public URL.

\`\`\`ts skip
const url = await exposer.expose()
console.log('Public URL:', url)
console.log('Connected:', exposer.isConnected())
\`\`\`

The returned URL is an HTTPS endpoint that forwards traffic to \`localhost:3000\`. The tunnel remains active until \`close()\` is called or the process exits.

## Getting Connection Info

Retrieve a snapshot of the current tunnel state.

\`\`\`ts skip
await exposer.expose()
const info = exposer.getConnectionInfo()
console.log('Public URL:', info.publicUrl)
console.log('Local port:', info.localPort)
console.log('Connected at:', info.connectedAt)
\`\`\`

## Reconnecting with New Options

Close the existing tunnel and re-expose with different settings.

\`\`\`ts skip
const url1 = await exposer.expose()
console.log('First URL:', url1)

const url2 = await exposer.reconnect({ port: 8080 })
console.log('New URL (port 8080):', url2)
\`\`\`

The \`reconnect\` method calls \`close()\` internally, merges the new options, then calls \`expose()\` again.

## Closing the Tunnel

\`\`\`ts skip
await exposer.close()
console.log('Tunnel closed:', !exposer.isConnected())
\`\`\`

Calling \`close()\` when no tunnel is active is a safe no-op. The \`disable()\` method also closes the tunnel before disabling the feature.

## Summary

The \`portExposer\` feature wraps ngrok to expose local ports as public HTTPS endpoints. It supports connection lifecycle management, reconnection with new options, and event-driven notifications for tunnel state changes. Requires ngrok to be installed.
`,
  "secure-shell.md": `---
title: "Secure Shell"
tags: [secureShell, ssh, scp, remote, deployment]
lastTested: null
lastTestPassed: null
---

# secureShell

SSH command execution and SCP file transfers. Uses the system \`ssh\` and \`scp\` binaries to run commands on remote hosts and transfer files securely.

## Overview

The \`secureShell\` feature provides an SSH client for executing commands on remote machines and transferring files via SCP. It supports both key-based and password-based authentication. All operations require a reachable SSH target host, so the actual connection and command examples use skip blocks.

## Enabling the Feature

\`\`\`ts
const ssh = container.feature('secureShell', {
  host: 'example.com',
  username: 'deploy',
  key: '~/.ssh/id_ed25519',
  enable: true
})
console.log('SSH enabled:', ssh.state.get('enabled'))
\`\`\`

## Exploring the API

\`\`\`ts
const docs = container.features.describe('secureShell')
console.log(docs)
\`\`\`

## Feature Options

\`\`\`ts
const ssh = container.feature('secureShell', {
  host: '192.168.1.100',
  port: 22,
  username: 'admin',
  key: '~/.ssh/id_rsa'
})
console.log('Host configured:', ssh.options.host)
console.log('Port:', ssh.options.port || 22)
\`\`\`

## Testing the Connection

Verify that the SSH target is reachable before running commands.

\`\`\`ts skip
const ok = await ssh.testConnection()
console.log('Connection OK:', ok)
console.log('State connected:', ssh.state.get('connected'))
\`\`\`

The \`testConnection\` method runs a simple echo command on the remote host. If it succeeds, \`state.connected\` is set to \`true\`.

## Executing a Remote Command

Run a shell command on the remote host and capture its output.

\`\`\`ts skip
const uptime = await ssh.exec('uptime')
console.log('Remote uptime:', uptime)

const listing = await ssh.exec('ls -la /var/log')
console.log(listing)
\`\`\`

The \`exec\` method returns the command's stdout as a string. It uses the configured host, username, and authentication credentials.

## Uploading and Downloading Files

Transfer files between the local machine and the remote host using SCP.

\`\`\`ts skip
await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
console.log('Upload complete')
\`\`\`

\`\`\`ts skip
await ssh.download('/var/log/app.log', './logs/app.log')
console.log('Download complete')
\`\`\`

Both methods use the same authentication credentials configured on the feature instance. Paths on the remote side are absolute or relative to the user's home directory.

## Summary

The \`secureShell\` feature wraps the system \`ssh\` and \`scp\` commands to provide remote command execution and file transfers. It supports key-based and password-based authentication, connection testing, and maintains connection state on the feature instance.
`,
  "google-sheets.md": `---
title: "Google Sheets"
tags: [googleSheets, google, sheets, spreadsheet, data]
lastTested: null
lastTestPassed: null
---

# googleSheets

Google Sheets feature for reading spreadsheet data as JSON, CSV, or raw arrays. Creates a Sheets v4 API client and depends on \`googleAuth\` for authentication.

## Overview

Use the \`googleSheets\` feature when you need to read data from Google Sheets. It provides convenient methods for reading ranges, converting rows to JSON objects (using the first row as headers), and exporting as CSV. You can set a default spreadsheet ID to avoid passing it on every call.

Requires Google OAuth2 credentials or a service account with Sheets access.

## Enabling the Feature

\`\`\`ts
const sheets = container.feature('googleSheets', {
  defaultSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms'
})
console.log('Google Sheets feature created')
console.log('Default spreadsheet configured:', !!sheets.options.defaultSpreadsheetId)
\`\`\`

## API Documentation

\`\`\`ts
const info = await container.features.describe('googleSheets')
console.log(info)
\`\`\`

## Reading Data as JSON

The \`getAsJson()\` method treats the first row as headers and returns an array of objects.

\`\`\`ts skip
const data = await sheets.getAsJson('Sheet1')
console.log(\`Read \${data.length} rows\`)
data.slice(0, 3).forEach(row => console.log(row))
// => [{ name: 'Alice', age: '30' }, { name: 'Bob', age: '25' }, ...]
\`\`\`

With a valid spreadsheet, this reads the first sheet tab and converts each row into a keyed object using the header row. Numeric values come through as strings by default.

## Reading Specific Ranges

Use A1 notation to read a precise cell range.

\`\`\`ts skip
const values = await sheets.getRange('Sheet1!A1:D10')
console.log(\`Got \${values.length} rows, \${values[0]?.length} columns\`)
values.forEach(row => console.log(row.join(' | ')))
\`\`\`

Returns a 2D array of strings. Useful when you need raw cell data without header interpretation.

## Exporting as CSV

\`\`\`ts skip
const csv = await sheets.getAsCsv('Revenue')
console.log(csv)
\`\`\`

Returns the entire sheet as a CSV-formatted string, ready for piping to files or other tools.

## Saving to Local Files

\`\`\`ts skip
await sheets.saveAsJson('./data/export.json', 'Sheet1')
console.log('Saved JSON export')

await sheets.saveAsCsv('./data/export.csv', 'Revenue')
console.log('Saved CSV export')
\`\`\`

Both methods write the file and return the resolved path. Paths are relative to the container's working directory.

## Spreadsheet Metadata

\`\`\`ts skip
const meta = await sheets.getSpreadsheet()
console.log('Title:', meta.title)

const tabs = await sheets.listSheets()
tabs.forEach(t => console.log(\`  Tab: \${t.title} (\${t.rowCount} rows)\`))
\`\`\`

Inspect the spreadsheet structure before reading data.

## Summary

The \`googleSheets\` feature reads Google Sheets data in three formats: JSON objects, raw 2D arrays, and CSV strings. Set a default spreadsheet ID for convenience. Authentication is handled by \`googleAuth\`. Key methods: \`getAsJson()\`, \`getRange()\`, \`getAsCsv()\`, \`saveAsJson()\`, \`saveAsCsv()\`, \`listSheets()\`.
`,
  "esbuild.md": `---
title: "esbuild"
tags: [esbuild, transpilation, bundling, typescript]
lastTested: null
lastTestPassed: null
---

# esbuild

Transpile TypeScript, TSX, and JSX to JavaScript at runtime using Bun's built-in transpiler. Compile code strings on the fly without touching the filesystem.

## Overview

The \`esbuild\` feature is a core feature, meaning it is auto-enabled on every container. You can access it directly as a global or via \`container.feature('esbuild')\`. It wraps Bun's transpiler and exposes both synchronous and asynchronous \`transform\` methods. Use it for runtime code generation, plugin systems, or any scenario where you need to compile TypeScript strings to runnable JavaScript.

## Synchronous Transform

Use \`transformSync()\` to transpile a TypeScript string to JavaScript in a single blocking call.

\`\`\`ts
const result = esbuild.transformSync('const x: number = 42; console.log(x);')
console.log('Input:  const x: number = 42; console.log(x);')
console.log('Output:', result.code.trim())
\`\`\`

The type annotations are stripped and the output is plain JavaScript.

## Async Transform

The async \`transform()\` method does the same thing but returns a promise. Prefer this in hot paths where you do not want to block.

\`\`\`ts
const tsxCode = \`
interface Props { name: string }
const Greet = (props: Props) => <h1>Hello {props.name}</h1>
\`
const out = await esbuild.transform(tsxCode, { loader: 'tsx' })
console.log('TSX transpiled:')
console.log(out.code.trim())
\`\`\`

Notice the \`loader: 'tsx'\` option tells the transpiler to handle JSX syntax.

## Minification

Pass \`minify: true\` to produce compact output with whitespace removed.

\`\`\`ts
const verbose = \`
  function greet(name: string): string {
    const greeting = "Hello, " + name + "!";
    return greeting;
  }
\`
const normal = esbuild.transformSync(verbose)
const minified = esbuild.transformSync(verbose, { minify: true })
console.log('Normal length:', normal.code.length)
console.log('Minified length:', minified.code.length)
console.log('Minified:', minified.code.trim())
\`\`\`

Minification is useful when generating code that will be sent to a browser or embedded in a response.

## Different Loaders

The feature supports multiple source languages via the \`loader\` option.

\`\`\`ts
const jsxResult = esbuild.transformSync(
  'const App = () => <div className="app">Content</div>',
  { loader: 'tsx' }
)
console.log('JSX output:', jsxResult.code.trim())
\`\`\`

Supported loaders include \`ts\` (default), \`tsx\`, \`jsx\`, and \`js\`.

## Summary

This demo covered synchronous and asynchronous transpilation, minification, and using different source loaders. The \`esbuild\` feature gives you runtime TypeScript-to-JavaScript compilation with zero configuration.
`,
  "proc.md": `---
title: "proc"
tags: [proc, process, shell, core]
lastTested: null
lastTestPassed: null
---

# proc

Process execution utilities for running shell commands and capturing their output.

## Overview

The \`proc\` feature is a core feature, auto-enabled on every container. You can access it directly as a global or via \`container.feature('proc')\`. It provides synchronous and asynchronous methods for executing shell commands. Use \`exec()\` for quick synchronous calls and \`execAndCapture()\` when you need structured output with exit codes.

## Simple Command Execution

Use \`exec()\` to run a command synchronously and get its stdout as a string.

\`\`\`ts
const result = proc.exec('echo hello from luca')
console.log('Output:', result.trim())
\`\`\`

The output is returned directly as a string, with no wrapper object.

## Listing Files

Commands that produce multi-line output work naturally. Each line comes through as part of the string.

\`\`\`ts
const listing = proc.exec('ls src')
const entries = listing.trim().split('\\n')
console.log('Entries in src/:', entries.length)
entries.slice(0, 5).forEach(e => console.log(' ', e))
\`\`\`

You can split and process the output like any other string.

## Working Directory Option

Pass a \`cwd\` option to run a command in a different directory without changing the container's working directory.

\`\`\`ts
const rootFiles = proc.exec('ls -1', { cwd: '.' })
console.log('Files in project root:')
rootFiles.trim().split('\\n').slice(0, 5).forEach(f => console.log(' ', f))
\`\`\`

This is useful when you need to operate on files in a subdirectory or sibling project.

## Getting System Info

Shell commands work for gathering system information that might not be available through other features.

\`\`\`ts
const date = proc.exec('date')
console.log('Current date:', date.trim())

const whoami = proc.exec('whoami')
console.log('Current user:', whoami.trim())
\`\`\`

Any command available on the system PATH can be called through \`exec()\`.

## Async Execution with Capture

Use \`execAndCapture()\` for async execution with structured output including exit code and stderr.

\`\`\`ts
const result = await proc.execAndCapture('ls src')
console.log('Exit code:', result.exitCode)
console.log('Stdout lines:', result.stdout.trim().split('\\n').length)
console.log('Stderr:', result.stderr || '(empty)')
\`\`\`

The returned object gives you \`stdout\`, \`stderr\`, \`exitCode\`, and \`pid\` for full control over the result.

## Summary

This demo covered synchronous command execution, processing multi-line output, running commands in different directories, gathering system info, and async execution with structured results. The \`proc\` feature is the escape hatch for anything the other features do not cover directly.
`,
  "downloader.md": `---
title: "Downloader"
tags: [downloader, network, files, http]
lastTested: null
lastTestPassed: null
---

# downloader

Download files from remote URLs and save them to the local filesystem.

## Overview

The \`downloader\` feature is an on-demand feature that fetches files from HTTP/HTTPS URLs and writes them to disk. It handles the network request, buffering, and file writing automatically. Use it when you need to programmatically pull remote assets -- images, documents, data files -- into your project.

## Feature Documentation

Let us inspect the feature's built-in documentation to understand its API.

\`\`\`ts
const desc = container.features.describe('downloader')
console.log(desc)
\`\`\`

The feature exposes a single \`download(url, targetPath)\` method that fetches a URL and writes the response body to the specified path.

## Enabling the Feature

Enable the downloader and inspect its initial state.

\`\`\`ts
const downloader = container.feature('downloader', { enable: true })
console.log('Downloader enabled:', downloader.state.enabled)
\`\`\`

Once enabled, the feature is ready to accept download requests.

## Inspecting the API

The downloader has a straightforward interface: one method for downloading.

\`\`\`ts
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(downloader))
  .filter(m => !m.startsWith('_') && m !== 'constructor')
console.log('Available methods:', methods.join(', '))
\`\`\`

The \`download\` method takes two arguments: a URL string and a target file path. The target path is resolved relative to the container's working directory.

## How Downloading Works

Here is what happens when you call \`download()\`:

1. The feature makes an HTTP fetch to the provided URL
2. The response is buffered into memory
3. The buffer is written to the filesystem at the target path
4. The path is resolved using the container's path resolution

\`\`\`ts
// Example usage (not executed to avoid network calls):
//   await downloader.download(
//     'https://example.com/data.json',
//     'downloads/data.json'
//   )
console.log('Downloader is ready. Call downloader.download(url, path) to fetch files.')
\`\`\`

## Summary

This demo covered the \`downloader\` feature, which provides a simple one-method API for fetching remote files and saving them locally. It handles HTTP requests, buffering, and file writing, making it the right choice for any task that involves pulling assets from the network.
`,
  "google-docs.md": `---
title: "Google Docs"
tags: [googleDocs, google, docs, documents, markdown]
lastTested: null
lastTestPassed: null
---

# googleDocs

Google Docs feature for reading documents and converting them to Markdown. Depends on \`googleAuth\` for authentication and optionally \`googleDrive\` for listing documents.

## Overview

Use the \`googleDocs\` feature when you need to read Google Docs content. Its standout capability is converting Google Docs to well-formatted Markdown, handling headings, bold/italic/strikethrough, links, code, lists, tables, and images. Also supports plain text extraction and raw document structure access.

Requires Google OAuth2 credentials or a service account with Docs access.

## Enabling the Feature

\`\`\`ts
const docs = container.feature('googleDocs')
console.log('Google Docs feature created')
\`\`\`

## API Documentation

\`\`\`ts
const info = await container.features.describe('googleDocs')
console.log(info)
\`\`\`

## Reading as Markdown

Convert a Google Doc into clean Markdown with full formatting support.

\`\`\`ts skip
const markdown = await docs.getAsMarkdown('1abc_document_id')
console.log(markdown)
\`\`\`

The converter handles headings (H1-H6), bold, italic, strikethrough, links, code fonts, ordered/unordered lists with nesting, tables, images, and section breaks. This is the primary method for extracting document content.

## Plain Text and Raw Structure

\`\`\`ts skip
const text = await docs.getAsText('1abc_document_id')
console.log('Plain text length:', text.length)

const rawDoc = await docs.getDocument('1abc_document_id')
console.log('Document title:', rawDoc.title)
console.log('Sections:', rawDoc.body.content.length)
\`\`\`

Use \`getAsText()\` when you only need the words without any formatting. Use \`getDocument()\` when you need the full Docs API structure for custom processing.

## Saving to Files

\`\`\`ts skip
const path = await docs.saveAsMarkdown('1abc_document_id', './output/doc.md')
console.log('Saved to:', path)
\`\`\`

Downloads and converts a doc to Markdown in one step. The path is resolved relative to the container's working directory.

## Listing and Searching Docs

Uses Google Drive under the hood to find Google Docs by name or content.

\`\`\`ts skip
const allDocs = await docs.listDocs()
console.log(\`Found \${allDocs.length} Google Docs\`)
allDocs.slice(0, 5).forEach(d => console.log(\`  \${d.name} (\${d.id})\`))

const results = await docs.searchDocs('meeting notes')
console.log(\`Search returned \${results.length} docs\`)
\`\`\`

Both methods filter Drive results to the Google Docs MIME type automatically.

## Summary

The \`googleDocs\` feature reads Google Docs and converts them to Markdown, plain text, or raw API structures. The Markdown converter handles all common formatting elements. Uses \`googleDrive\` for listing and searching documents. Key methods: \`getAsMarkdown()\`, \`getAsText()\`, \`getDocument()\`, \`saveAsMarkdown()\`, \`listDocs()\`, \`searchDocs()\`.
`,
  "ink-renderer.md": `# Feature Registry

## Blocks

\`\`\`tsx
const { Box, Text } = ink.components
const React = ink.React

function Table({ rows, columns }) {
  const colWidth = Math.floor(70 / columns)

  const chunked = []
  for (let i = 0; i < rows.length; i += columns) {
    chunked.push(rows.slice(i, i + columns))
  }

  return (
    <Box flexDirection="column">
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">Available Features</Text>
      </Box>
      {chunked.map((row, ri) => (
        <Box key={ri} flexDirection="row">
          {row.map((item, ci) => (
            <Box key={ci} width={colWidth} paddingX={1}>
              <Text color="green">{item}</Text>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}
\`\`\`

## Features

\`\`\`ts
const features = container.features.available
await render('Table', { rows: features, columns: 3 })
\`\`\`
`,
  "git.md": `---
title: "git"
tags: [git, version-control, core]
lastTested: null
lastTestPassed: null
---

# git

Git repository operations including branch info, commit history, and file listing.

## Overview

The \`git\` feature is a core feature, auto-enabled on every container. You can access it directly as a global or via \`container.feature('git')\`. It provides getters for quick repo metadata and methods for querying commit history and tracked files. All operations use the repository that contains the container's working directory.

## Repository Info

The basic getters give you quick access to the current repository state without any arguments.

\`\`\`ts
console.log('Is a git repo:', git.isRepo)
console.log('Repo root:', git.repoRoot)
console.log('Current branch:', git.branch)
console.log('Current SHA:', git.sha)
\`\`\`

These are synchronous getters, so you can use them inline anywhere.

## Listing Tracked Files

Use \`lsFiles()\` to list files tracked by git. This wraps \`git ls-files\` with structured options.

\`\`\`ts
const files = await git.lsFiles()
console.log('Total tracked files:', files.length)
console.log('First 5 files:')
files.slice(0, 5).forEach(f => console.log(' ', f))
\`\`\`

You can filter for modified, deleted, or untracked files by passing options.

## Filtered File Listing

Pass options to \`lsFiles()\` to narrow down the results by file status or pattern.

\`\`\`ts
const tsFiles = await git.lsFiles({ include: '*.ts' })
console.log('Tracked .ts files:', tsFiles.length)

const srcFiles = await git.lsFiles({ baseDir: 'src' })
console.log('Files in src/:', srcFiles.length)
\`\`\`

The \`include\`, \`exclude\`, and \`baseDir\` options let you scope the listing precisely.

## Latest Commits

Use \`getLatestChanges()\` to retrieve recent commit metadata. Each entry has a \`title\`, \`message\`, and \`author\`.

\`\`\`ts
const changes = await git.getLatestChanges(3)
changes.forEach((c, i) => {
  console.log(\`\${i + 1}. [\${c.author}] \${c.title}\`)
})
\`\`\`

This is useful for generating changelogs, displaying recent activity, or auditing history.

## File History

Use \`fileLog()\` to see the commit history for a specific file.

\`\`\`ts
const log = git.fileLog('package.json')
console.log('Commits touching package.json:', log.length)
log.slice(0, 3).forEach(entry => {
  console.log(\`  \${entry.sha.slice(0, 8)} \${entry.message}\`)
})
\`\`\`

Each entry contains the commit \`sha\` and \`message\`. This is a synchronous method.

## Summary

This demo covered checking repository status, listing tracked files with filters, viewing recent commit history, and inspecting per-file commit logs. These tools give scripts full visibility into the git state of a project.
`,
  "ink.md": `---
title: "Ink"
tags: [ink, react, terminal, ui, components]
lastTested: null
lastTestPassed: null
---

# ink

React-powered terminal UI via the Ink library. Build rich, interactive command-line interfaces using React components that render directly in the terminal.

## Overview

The \`ink\` feature exposes the Ink library (React for CLIs) through the container. It provides access to React itself, all Ink components (Box, Text, Spacer, etc.), all Ink hooks (useInput, useApp, useFocus, etc.), and a render/unmount lifecycle. Because Ink renders an interactive React tree in the terminal, it cannot be fully demonstrated in a non-interactive markdown runner. Runnable blocks cover setup and introspection; actual rendering is shown in skip blocks.

## Enabling the Feature

\`\`\`ts
const ink = container.feature('ink', { enable: true })
console.log('Ink enabled:', ink.state.get('enabled'))
console.log('Currently mounted:', ink.isMounted)
\`\`\`

## Exploring the API

\`\`\`ts
const docs = container.features.describe('ink')
console.log(docs)
\`\`\`

## Loading Modules

The \`loadModules\` method pre-loads React and Ink so that the sync getters work immediately.

\`\`\`ts
const ink = container.feature('ink', { enable: true })
await ink.loadModules()
const componentNames = Object.keys(ink.components)
const hookNames = Object.keys(ink.hooks)
console.log('Components:', componentNames.join(', '))
console.log('Hooks:', hookNames.join(', '))
console.log('React available:', typeof ink.React.createElement)
\`\`\`

## Rendering a Component

Mount a React element to the terminal using \`React.createElement\`.

\`\`\`ts skip
const { Box, Text } = ink.components
const { React } = ink

ink.render(
  React.createElement(Box, { flexDirection: 'column' },
    React.createElement(Text, { color: 'green' }, 'Hello from Ink'),
    React.createElement(Text, { dimColor: true }, 'Powered by Luca')
  )
)
await ink.waitUntilExit()
\`\`\`

The \`render\` method mounts the React tree and starts the Ink render loop. \`waitUntilExit\` returns a promise that resolves when the app exits (via \`useApp().exit()\` or \`unmount()\`).

## Using Hooks

Ink hooks like \`useInput\` and \`useFocus\` work inside functional components passed to \`render\`.

\`\`\`ts skip
const { Text } = ink.components
const { React } = ink
const { useInput, useApp } = ink.hooks

function App() {
  const { exit } = useApp()
  useInput((input, key) => {
    if (input === 'q') exit()
  })
  return React.createElement(Text, null, 'Press q to quit')
}

ink.render(React.createElement(App))
await ink.waitUntilExit()
console.log('App exited')
\`\`\`

## Unmounting and Cleanup

Tear down the rendered app and clear terminal output.

\`\`\`ts skip
ink.render(
  React.createElement(ink.components.Text, null, 'Temporary UI')
)
ink.clear()
ink.unmount()
console.log('Mounted after unmount:', ink.isMounted)
\`\`\`

The \`clear\` method erases all Ink-rendered content from the terminal. The \`unmount\` method tears down the React tree. Both are safe to call when no app is mounted.

## Summary

The \`ink\` feature brings React-based terminal UIs to Luca scripts. It provides the full Ink component and hook library, a render lifecycle with mount/unmount/rerender, and access to the React module itself. Best suited for interactive CLI tools and dashboards.
`,
  "yaml-tree.md": `---
title: "YAML Tree"
tags: [yamlTree, yaml, files, data-loading]
lastTested: null
lastTestPassed: null
---

# yamlTree

Load YAML files from directory structures into a nested object tree.

## Overview

The \`yamlTree\` feature is an on-demand feature that recursively scans a directory for \`.yml\` and \`.yaml\` files and builds a hierarchical JavaScript object from them. It works identically to \`jsonTree\` but for YAML content. File paths are converted to camelCased property paths, so \`config/database/production.yml\` becomes \`tree.config.database.production\`. This is useful for projects that store configuration, infrastructure definitions, or data in YAML format.

## Feature Documentation

Let us inspect the feature's built-in documentation.

\`\`\`ts
const desc = container.features.describe('yamlTree')
console.log(desc)
\`\`\`

Like jsonTree, the key method is \`loadTree(basePath, key?)\` and the data is accessed through the \`tree\` getter.

## Enabling the Feature

Enable yamlTree and check its initial state.

\`\`\`ts
const yamlTree = container.feature('yamlTree', { enable: true })
console.log('yamlTree enabled:', yamlTree.state.enabled)
console.log('Initial tree:', JSON.stringify(yamlTree.tree))
\`\`\`

The tree starts empty until you load directories into it.

## Loading YAML Files

We can attempt to load YAML files from the project. If the project has any \`.yml\` or \`.yaml\` files, they will appear in the tree.

\`\`\`ts
await yamlTree.loadTree('.', 'root')
const keys = Object.keys(yamlTree.tree.root || {})
console.log('Keys loaded under root:', keys.length ? keys.join(', ') : '(no YAML files found)')
\`\`\`

If no YAML files are found, the tree for that key will be empty. This is expected for projects that do not use YAML.

## How It Compares to jsonTree

The yamlTree and jsonTree features share the same design pattern:

- Both recursively scan directories
- Both convert file paths to camelCased property paths
- Both store results in a \`tree\` getter
- Both accept a custom key for namespacing

The only difference is the file extensions they look for and the parser they use.

\`\`\`ts
const comparison = {
  jsonTree: { extensions: ['.json'], parser: 'JSON.parse' },
  yamlTree: { extensions: ['.yml', '.yaml'], parser: 'YAML parser' },
}
for (const [name, info] of Object.entries(comparison)) {
  console.log(\`\${name}: scans \${info.extensions.join(', ')} files, uses \${info.parser}\`)
}
\`\`\`

## Path Transformation Rules

The same path transformation rules apply as in jsonTree:

- Directory names become nested object properties
- File names (without extension) become leaf properties
- All names are converted to camelCase

\`\`\`ts
const mappings = {
  'infra/k8s/deployment.yml': 'tree.infra.k8s.deployment',
  'config/app-settings.yaml': 'tree.config.appSettings',
  'data/seed/users.yml': 'tree.data.seed.users',
}
for (const [file, path] of Object.entries(mappings)) {
  console.log(\`\${file} => \${path}\`)
}
\`\`\`

## Summary

This demo covered the \`yamlTree\` feature, which scans directories for YAML files (.yml and .yaml) and builds a nested object tree. It follows the same pattern as \`jsonTree\` and is ideal for projects that rely on YAML for configuration, infrastructure definitions, or structured data.
`,
  "grep.md": `---
title: "grep"
tags: [grep, search, core]
lastTested: null
lastTestPassed: null
---

# grep

Search file contents for patterns, find imports, definitions, and TODO comments.

## Overview

The \`grep\` feature is a core feature, auto-enabled on every container. You can access it directly as a global or via \`container.feature('grep')\`. It wraps ripgrep with a structured API, providing methods for pattern search, import discovery, definition lookup, and TODO scanning. Results come back as arrays of match objects with file, line, and content info.

## Searching for a Pattern

Use \`search()\` to find occurrences of a pattern across files. Options let you filter by file type, limit results, and control case sensitivity.

\`\`\`ts
const results = await grep.search({ pattern: 'container', include: '*.ts', exclude: 'node_modules', maxResults: 5 })
console.log('Matches for "container" in .ts files (first 5):')
results.forEach(r => {
  console.log(\`  \${r.file}:\${r.line} \${r.content.trim().slice(0, 60)}\`)
})
\`\`\`

Each match object contains \`file\`, \`line\`, and \`content\` fields.

## Counting Matches

Use \`count()\` to get just the number of matches without fetching all the details.

\`\`\`ts
const total = await grep.count('container', { include: '*.ts', exclude: 'node_modules' })
console.log('Total "container" occurrences in .ts files:', total)
\`\`\`

This is much faster when you only need the total.

## Finding Import Statements

Use \`imports()\` to find all files that import a specific module or path.

\`\`\`ts
const results = await grep.imports('path', { include: '*.ts', exclude: 'node_modules', maxResults: 5 })
console.log('Files importing "path" (first 5):')
results.forEach(r => {
  console.log(\`  \${r.file}:\${r.line} \${r.content.trim().slice(0, 70)}\`)
})
\`\`\`

This searches for both \`import\` and \`require\` patterns automatically.

## Finding Definitions

Use \`definitions()\` to locate where functions, classes, types, or variables are defined.

\`\`\`ts
const defs = await grep.definitions('Feature', { include: '*.ts', exclude: 'node_modules', maxResults: 5 })
console.log('Definitions matching "Feature" (first 5):')
defs.forEach(d => {
  console.log(\`  \${d.file}:\${d.line} \${d.content.trim().slice(0, 70)}\`)
})
\`\`\`

This searches for \`function\`, \`class\`, \`type\`, \`interface\`, \`const\`, and \`let\` declarations.

## Finding TODOs

Use \`todos()\` to scan for TODO, FIXME, HACK, and XXX comments across the codebase.

\`\`\`ts
const todos = await grep.todos({ include: '*.ts', exclude: 'node_modules', maxResults: 5 })
console.log('TODOs found in .ts files (first 5):')
todos.forEach(t => {
  console.log(\`  \${t.file}:\${t.line} \${t.content.trim().slice(0, 70)}\`)
})
\`\`\`

This is handy for tracking technical debt and outstanding work items.

## Summary

This demo covered pattern searching with structured results, counting matches efficiently, finding import statements, locating definitions by name, and scanning for TODO comments. The \`grep\` feature is the go-to tool for codebase analysis and discovery.
`,
  "google-auth.md": `---
title: "Google Auth"
tags: [googleAuth, google, oauth2, authentication, service-account]
lastTested: null
lastTestPassed: null
---

# googleAuth

Google authentication feature supporting OAuth2 browser flow and service account auth. Handles the complete OAuth2 lifecycle including token refresh and secure storage via diskCache.

## Overview

Use the \`googleAuth\` feature to authenticate with Google APIs. It supports two modes: OAuth2 (opens a browser for user consent) and service account (non-interactive, uses a JSON key file). Other Google features (drive, sheets, calendar, docs) depend on this feature automatically.

Requires either \`GOOGLE_CLIENT_ID\` and \`GOOGLE_CLIENT_SECRET\` environment variables for OAuth2, or a service account key file.

## Enabling the Feature

\`\`\`ts
const auth = container.feature('googleAuth')
console.log('Auth mode:', auth.authMode)
console.log('Authenticated:', auth.isAuthenticated)
\`\`\`

The feature reads \`GOOGLE_CLIENT_ID\` and \`GOOGLE_CLIENT_SECRET\` from the environment automatically. You can also pass \`clientId\` and \`clientSecret\` as options.

## API Documentation

\`\`\`ts
const info = await container.features.describe('googleAuth')
console.log(info)
\`\`\`

## OAuth2 Authorization Flow

The \`authorize()\` method starts the full OAuth2 browser flow: it spins up a local callback server, opens the consent page, exchanges the code for tokens, and caches the refresh token.

\`\`\`ts skip
const auth = container.feature('googleAuth', {
  scopes: ['https://www.googleapis.com/auth/drive.readonly']
})
await auth.authorize()
console.log('Authenticated:', auth.isAuthenticated)
console.log('Scopes:', auth.state.scopes)
\`\`\`

When running with valid credentials, this opens a browser to Google's consent page. After approval, tokens are stored in diskCache and automatically refreshed on expiry.

## Service Account Authentication

For server-to-server auth without a browser, use a service account JSON key file.

\`\`\`ts skip
const auth = container.feature('googleAuth', {
  mode: 'service-account',
  serviceAccountKeyPath: '/path/to/service-account-key.json',
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
})
await auth.authenticateServiceAccount()
console.log('Service account email:', auth.state.email)
\`\`\`

Service accounts are ideal for automation, CI/CD, and background services that need Google API access without user interaction.

## Token Management

Tokens are cached automatically and restored on subsequent runs. You can also revoke credentials.

\`\`\`ts skip
// Attempt to restore from cache (called automatically)
const restored = await auth.tryRestoreTokens()
console.log('Restored from cache:', restored)

// Get the auth client for passing to Google API constructors
const client = await auth.getAuthClient()
console.log('Auth client ready')

// Revoke and clear cached tokens
await auth.revoke()
console.log('Credentials revoked')
\`\`\`

The \`tokenRefreshed\` event fires when tokens are automatically refreshed, and \`authenticated\` fires after successful authentication.

## Summary

The \`googleAuth\` feature provides the authentication layer for all Google API features. It supports OAuth2 browser flow and service accounts, with automatic token refresh and diskCache storage. Other Google features (drive, sheets, calendar, docs) use it automatically. Key methods: \`authorize()\`, \`authenticateServiceAccount()\`, \`getAuthClient()\`, \`revoke()\`.
`,
  "tts.md": `---
title: "Text-to-Speech"
tags: [tts, speech, audio, runpod, chatterbox]
lastTested: null
lastTestPassed: null
---

# tts

Text-to-speech feature that synthesizes audio files via RunPod's Chatterbox Turbo endpoint. Supports 20 preset voices and voice cloning from a reference audio URL.

## Overview

Use the \`tts\` feature when you need to generate speech audio from text. It calls the Chatterbox Turbo public endpoint on RunPod, downloads the resulting audio, and saves it locally. Choose from 20 preset voices or clone any voice by providing a reference audio URL.

Requires a \`RUNPOD_API_KEY\` environment variable or an \`apiKey\` option.

## Enabling the Feature

\`\`\`ts
const tts = container.feature('tts', {
  voice: 'lucy',
  format: 'wav',
  outputDir: '/tmp/tts-output'
})
console.log('TTS feature created')
console.log('Default voice:', tts.options.voice)
console.log('Output format:', tts.options.format)
\`\`\`

## API Documentation

\`\`\`ts
const info = await container.features.describe('tts')
console.log(info)
\`\`\`

## Available Voices

List all 20 preset voice names.

\`\`\`ts
console.log('Available voices:', tts.voices.join(', '))
\`\`\`

## Generating Speech

Synthesize text with a preset voice.

\`\`\`ts skip
const path = await tts.synthesize('Good morning! Here is your daily briefing.', {
  voice: 'ethan'
})
console.log('Audio saved to:', path)
console.log('Last generated file:', tts.state.lastFile)
\`\`\`

The synthesize method sends the text to RunPod, waits for generation, downloads the audio, and saves it to the output directory. The \`synthesized\` event fires with the file path on completion.

## Voice Cloning

Clone any voice by providing a reference audio URL.

\`\`\`ts skip
const path = await tts.synthesize('Hello world, this is a cloned voice.', {
  voiceUrl: 'https://example.com/reference-voice.wav'
})
console.log('Cloned voice audio saved to:', path)
\`\`\`

The reference audio should be a clear recording of the voice you want to clone. The Chatterbox Turbo model uses it to match the voice characteristics.

## Output Formats

\`\`\`ts skip
const wav = await tts.synthesize('WAV format', { format: 'wav' })
const flac = await tts.synthesize('FLAC format', { format: 'flac' })
const ogg = await tts.synthesize('OGG format', { format: 'ogg' })
console.log('Generated files:', wav, flac, ogg)
\`\`\`

Three output formats are supported: WAV (default, uncompressed), FLAC (lossless compressed), and OGG (lossy compressed).

## Summary

The \`tts\` feature generates speech audio via RunPod's Chatterbox Turbo. Choose from 20 preset voices or clone a custom voice with a reference URL. Supports WAV, FLAC, and OGG output formats. Key methods: \`synthesize()\`. Key getters: \`voices\`, \`outputDir\`.
`,
  "os.md": `---
title: "os"
tags: [os, system, platform, core]
lastTested: null
lastTestPassed: null
---

# os

Operating system information including platform, architecture, CPU, and network details.

## Overview

The \`os\` feature is a core feature, auto-enabled on every container. You can access it directly as a global or via \`container.feature('os')\`. It exposes system metadata through simple getters -- no method calls needed. Use it to detect the runtime environment, adapt behavior per platform, or gather machine info for diagnostics.

## Platform and Architecture

The \`platform\` and \`arch\` getters tell you what operating system and CPU architecture the code is running on.

\`\`\`ts
console.log('Platform:', os.platform)
console.log('Architecture:', os.arch)
\`\`\`

Platform returns values like \`darwin\`, \`linux\`, or \`win32\`. Architecture returns values like \`arm64\` or \`x64\`.

## CPU Information

The \`cpuCount\` getter reports the number of logical CPU cores available.

\`\`\`ts
console.log('CPU cores:', os.cpuCount)
\`\`\`

Use this to size worker pools or decide how many parallel tasks to run.

## System Paths

The \`tmpdir\` and \`homedir\` getters return commonly needed system directories.

\`\`\`ts
console.log('Temp directory:', os.tmpdir)
console.log('Home directory:', os.homedir)
\`\`\`

These are the OS defaults -- \`tmpdir\` for throwaway files and \`homedir\` for the current user's home.

## Hostname

The \`hostname\` getter returns the machine's network hostname.

\`\`\`ts
console.log('Hostname:', os.hostname)
\`\`\`

This can be useful for logging, multi-machine coordination, or display purposes.

## Network Interfaces

The \`macAddresses\` getter returns MAC addresses for non-internal IPv4 network interfaces.

\`\`\`ts
const macs = os.macAddresses
console.log('MAC addresses:', macs.length, 'found')
macs.slice(0, 3).forEach(mac => console.log(' ', mac))
\`\`\`

MAC addresses are useful for machine fingerprinting or license management.

## Summary

This demo covered querying the platform and architecture, checking CPU core count, retrieving system directory paths, reading the hostname, and listing network MAC addresses. The \`os\` feature gives scripts everything they need to adapt to and report on the runtime environment.
`,
  "sqlite.md": `---
title: "SQLite"
tags: [sqlite, database, sql, storage]
lastTested: null
lastTestPassed: null
---

# sqlite

In-process SQLite database via Bun's native binding. Create tables, insert rows, and query data with parameterized SQL or tagged templates.

## Overview

The \`sqlite\` feature is on-demand. Pass \`{ path: ':memory:' }\` for an in-memory database or a file path for persistence. It supports parameterized queries to prevent SQL injection and a convenient tagged-template syntax for inline SQL.

## Creating an In-Memory Database

Enable the feature with an in-memory path. No files are created on disk.

\`\`\`ts
const db = container.feature('sqlite', { path: ':memory:' })
console.log('SQLite enabled:', db.state.get('enabled'))
\`\`\`

The database is ready for queries immediately.

## Creating a Table

Use \`execute()\` for DDL and write statements.

\`\`\`ts
await db.execute(\`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    active INTEGER DEFAULT 1
  )
\`)
console.log('Table created')
\`\`\`

The \`execute()\` method returns metadata including the number of changes and the last inserted row ID.

## Inserting Rows

Insert data using parameterized queries to keep values safe.

\`\`\`ts
await db.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Alice', 'alice@example.com'])
await db.execute('INSERT INTO users (name, email) VALUES (?, ?)', ['Bob', 'bob@example.com'])
const result = await db.execute('INSERT INTO users (name, email, active) VALUES (?, ?, ?)', ['Charlie', 'charlie@example.com', 0])
console.log('Last insert ID:', result.lastInsertRowid)
console.log('Changes:', result.changes)
\`\`\`

Each \`?\` placeholder is bound to the corresponding value in the array, preventing SQL injection.

## Querying Rows

Use \`query()\` for SELECT statements that return result rows.

\`\`\`ts
const users = await db.query('SELECT * FROM users WHERE active = ?', [1])
console.log('Active users:')
users.forEach(u => console.log(\`  \${u.id}: \${u.name} <\${u.email}>\`))
\`\`\`

Results come back as an array of plain objects with column names as keys.

## Tagged Template Queries

The \`sql\` tagged template lets you write queries with inline interpolation that is still safely parameterized.

\`\`\`ts
const emailDomain = '%example.com'
const rows = await db.sql\`SELECT name, email FROM users WHERE email LIKE \${emailDomain}\`
console.log('Users matching domain:')
rows.forEach(r => console.log(\`  \${r.name}: \${r.email}\`))
\`\`\`

Interpolated values become bound parameters automatically. This combines readability with safety.

## Summary

This demo covered creating an in-memory SQLite database, defining tables, inserting rows with parameterized queries, reading data back, and using the tagged-template SQL syntax. The \`sqlite\` feature gives you a full relational database with zero setup.
`,
  "docker.md": `---
title: "Docker"
tags: [docker, containers, images, devops]
lastTested: null
lastTestPassed: null
---

# docker

Docker CLI interface for managing containers, images, and executing commands inside running containers. Provides comprehensive Docker operations including build, run, exec, logs, and system pruning.

## Overview

The \`docker\` feature wraps the Docker CLI to give you programmatic control over containers and images. It requires Docker to be installed and the Docker daemon to be running on the host machine. All methods return structured data rather than raw CLI output.

## Enabling the Feature

\`\`\`ts
const docker = container.feature('docker', { enable: true })
console.log('Docker feature enabled:', docker.state.get('enabled'))
\`\`\`

## Exploring the API

\`\`\`ts
const docs = container.features.describe('docker')
console.log(docs)
\`\`\`

## Checking Availability

\`\`\`ts
const docker = container.feature('docker')
const available = await docker.checkDockerAvailability()
console.log('Docker available:', available)
console.log('State:', docker.state.get('isDockerAvailable'))
\`\`\`

## Building an Image

Build a Docker image from a Dockerfile in a project directory.

\`\`\`ts skip
await docker.buildImage('./my-project', {
  tag: 'my-app:latest',
  buildArgs: { NODE_ENV: 'production' },
  nocache: true
})
console.log('Image built successfully')
\`\`\`

If the build succeeds, the image appears in \`docker.listImages()\`. The \`buildArgs\` option passes \`--build-arg\` flags to the Docker build command.

## Running a Container

Create and start a container from an image with port mappings, volumes, and environment variables.

\`\`\`ts skip
const containerId = await docker.runContainer('nginx:latest', {
  name: 'web-server',
  ports: ['8080:80'],
  detach: true,
  environment: { NGINX_HOST: 'localhost' }
})
console.log('Container started:', containerId)
\`\`\`

The \`detach: true\` option runs the container in the background and returns its ID. Without it, the call blocks until the container exits.

## Executing Commands in a Container

Run commands inside a running container and capture the output.

\`\`\`ts skip
const result = await docker.execCommand('web-server', ['ls', '-la', '/usr/share/nginx/html'])
console.log('stdout:', result.stdout)
console.log('exit code:', result.exitCode)
\`\`\`

The command array avoids shell interpretation issues. The returned object includes \`stdout\`, \`stderr\`, and \`exitCode\`.

## Creating a Shell

The \`createShell\` method returns a shell-like wrapper for running multiple commands against the same container.

\`\`\`ts skip
const shell = await docker.createShell('web-server', {
  workdir: '/app'
})
await shell.run('ls -la')
console.log(shell.last.stdout)
await shell.run('cat package.json')
console.log(shell.last.stdout)
await shell.destroy()
\`\`\`

Call \`destroy()\` when finished to clean up any helper containers created for volume-mounted shells.

## Summary

The \`docker\` feature provides a complete programmatic interface to Docker: build images, run and manage containers, execute commands inside them, retrieve logs, and prune unused resources. All operations require the Docker daemon to be running on the host.
`,
  "telegram.md": `---
title: "Telegram Bot"
tags: [telegram, bot, messaging, grammy]
lastTested: null
lastTestPassed: null
---

# telegram

Telegram bot feature powered by grammY. Supports long-polling and webhook modes, with the full grammY Bot instance exposed for direct API access. Events bridge to Luca's event bus.

## Overview

Use the \`telegram\` feature when you need to build a Telegram bot. It wraps the grammY library and handles bot lifecycle (start, stop, polling, webhooks) while bridging Telegram events into Luca's event system.

Requires a \`TELEGRAM_BOT_TOKEN\` environment variable or a \`token\` option from [@BotFather](https://t.me/BotFather).

## Enabling the Feature

\`\`\`ts
const tg = container.feature('telegram', {
  mode: 'polling',
  dropPendingUpdates: true
})
console.log('Telegram feature created, mode:', tg.mode)
\`\`\`

The feature reads \`TELEGRAM_BOT_TOKEN\` from the environment automatically. You can also pass \`token\` explicitly as an option.

## API Documentation

\`\`\`ts
const info = await container.features.describe('telegram')
console.log(info)
\`\`\`

## Registering Commands

Bot commands are registered with \`.command()\` and also emit events on Luca's event bus.

\`\`\`ts skip
tg.command('start', (ctx) => ctx.reply('Welcome! I am your Luca bot.'))
tg.command('help', (ctx) => ctx.reply('Available: /start, /help, /ping'))
tg.command('ping', (ctx) => ctx.reply('Pong!'))
console.log('Registered commands:', tg.state.commandsRegistered)
\`\`\`

If the bot were running with a valid token, sending \`/start\` in Telegram would reply with "Welcome! I am your Luca bot." and the \`command\` event would fire on the Luca event bus.

## Handling Messages

Use \`.handle()\` to register grammY update handlers for any filter query.

\`\`\`ts skip
tg.handle('message:text', (ctx) => {
  ctx.reply(\`Echo: \${ctx.message.text}\`)
})
tg.handle('callback_query:data', (ctx) => {
  ctx.answerCallbackQuery('Button clicked!')
})
\`\`\`

The \`.handle()\` method maps directly to grammY's \`bot.on()\` and supports all grammY filter queries like \`message:photo\`, \`edited_message\`, and \`callback_query:data\`.

## Starting the Bot

\`\`\`ts skip
await tg.start()
console.log('Bot is running:', tg.isRunning)
console.log('Mode:', tg.mode)
\`\`\`

Once started in polling mode, the bot continuously fetches updates from Telegram. Call \`await tg.stop()\` to shut down gracefully. The \`started\` and \`stopped\` events fire on the Luca event bus.

## Summary

The \`telegram\` feature provides a complete Telegram bot lifecycle manager. Register commands and handlers, then start polling or set up a webhook. All Telegram events are bridged to Luca's event bus for integration with other features. Key methods: \`command()\`, \`handle()\`, \`start()\`, \`stop()\`, \`setupWebhook()\`.
`,
  "repl.md": `---
title: "REPL"
tags: [repl, interactive, debugging, console]
lastTested: null
lastTestPassed: null
---

# repl

Interactive read-eval-print loop with tab completion, history, and full container access.

## Overview

The \`repl\` feature is an on-demand feature that launches an interactive REPL session inside a VM context populated with the container and all its helpers. It supports tab completion for dot-notation property access, command history persistence, and top-level await. Since it is interactive, it cannot run inside a markdown code block -- instead, the typical workflow is to run \`luca run somefile.md --console\` which executes all code blocks first and then drops into a REPL with the accumulated context.

## Feature Documentation

Let us inspect the feature's built-in documentation.

\`\`\`ts
const desc = container.features.describe('repl')
console.log(desc)
\`\`\`

The main method is \`start(options?)\` which begins the interactive session. It accepts an optional context object and history path.

## Enabling the Feature

We can enable the feature and inspect its state without starting the interactive session.

\`\`\`ts
const repl = container.feature('repl', { enable: true })
console.log('REPL enabled:', repl.state.enabled)
console.log('REPL started:', repl.state.started)
\`\`\`

The feature is enabled but not started. Starting it would block execution waiting for interactive input, which is not suitable for a markdown runner context.

## Configuration Options

The REPL feature accepts several options for customization.

\`\`\`ts
const options = {
  prompt: 'Custom prompt string displayed before each input line',
  historyPath: 'Path to a file where command history is persisted between sessions',
  context: 'Additional variables injected into the VM evaluation context',
}
for (const [key, desc] of Object.entries(options)) {
  console.log(\`  \${key}: \${desc}\`)
}
\`\`\`

When you provide a \`context\` object to \`start()\`, those variables become globally available in the REPL session alongside the container and its helpers.

## How to Use the REPL

The recommended way to use the REPL is through the \`--console\` flag on \`luca run\`.

\`\`\`ts
console.log('Usage patterns:')
console.log('')
console.log('  luca run script.md --console')
console.log('    Run all code blocks, then drop into REPL with accumulated context')
console.log('')
console.log('  luca run setup.md --console')
console.log('    Execute setup code, then explore interactively')
console.log('')
console.log('Inside the REPL:')
console.log('  - Tab completion works on all container properties')
console.log('  - Top-level await is supported')
console.log('  - Type .exit or exit to quit')
\`\`\`

This is especially powerful when combined with runnable markdown files: you define your setup and data loading in code blocks, then explore the results interactively in the REPL.

## REPL Context

When launched via \`--console\`, the REPL inherits everything from the markdown execution context. This means all variables, enabled features, and loaded data carry over.

\`\`\`ts
console.log('The REPL context automatically includes:')
const globals = ['container', 'fs', 'git', 'proc', 'grep', 'os', 'networking', 'ui', 'vm', 'esbuild', 'console']
for (const name of globals) {
  console.log(\`  \${name}\`)
}
console.log('')
console.log('Plus any variables defined in preceding code blocks.')
\`\`\`

## Summary

This demo covered the \`repl\` feature, which provides an interactive REPL with tab completion, history, and async support. Since it is interactive by nature, it is best used via \`luca run somefile.md --console\` to combine scripted setup with interactive exploration. The REPL inherits the full container context plus any variables accumulated during markdown execution.
`,
  "google-drive.md": `---
title: "Google Drive"
tags: [googleDrive, google, drive, files, storage]
lastTested: null
lastTestPassed: null
---

# googleDrive

Google Drive feature for listing, searching, browsing, and downloading files. Creates a Drive v3 API client and depends on \`googleAuth\` for authentication.

## Overview

Use the \`googleDrive\` feature when you need to interact with Google Drive: list files, search by name or content, browse folder hierarchies, download files, or export Google Workspace documents. Authentication is handled automatically via the \`googleAuth\` feature.

Requires Google OAuth2 credentials or a service account with Drive access.

## Enabling the Feature

\`\`\`ts
const drive = container.feature('googleDrive', {
  pageSize: 50
})
console.log('Google Drive feature created')
console.log('Default page size:', 50)
\`\`\`

## API Documentation

\`\`\`ts
const info = await container.features.describe('googleDrive')
console.log(info)
\`\`\`

## Listing and Searching Files

List recent files or search by name, content, or MIME type.

\`\`\`ts skip
const { files } = await drive.listFiles()
console.log(\`Found \${files.length} files:\`)
files.slice(0, 5).forEach(f => console.log(\`  \${f.name} (\${f.mimeType})\`))

const { files: pdfs } = await drive.search('quarterly report', {
  mimeType: 'application/pdf'
})
console.log(\`Found \${pdfs.length} matching PDFs\`)
\`\`\`

The \`listFiles()\` method accepts an optional Drive query string for filtering. The \`search()\` method provides a simpler interface for text-based searches.

## Browsing Folders

Browse a folder to see its files and subfolders separately.

\`\`\`ts skip
const root = await drive.browse()
console.log('Root folders:', root.folders.length)
console.log('Root files:', root.files.length)

const sub = await drive.browse('folder-id-here')
sub.folders.forEach(f => console.log(\`  [dir] \${f.name}\`))
sub.files.forEach(f => console.log(\`  [file] \${f.name}\`))
\`\`\`

The \`browse()\` method defaults to the root folder and separates the results into \`folders\` and \`files\` for easy navigation.

## Downloading and Exporting

Download files to disk or export Google Workspace documents to other formats.

\`\`\`ts skip
await drive.downloadTo('file-id', './downloads/report.pdf')
console.log('File downloaded')

const buffer = await drive.download('file-id')
console.log('Downloaded', buffer.length, 'bytes')

const csv = await drive.exportFile('sheet-id', 'text/csv')
console.log('Exported sheet as CSV:', csv.length, 'bytes')
\`\`\`

Use \`download()\` for binary files and \`exportFile()\` for converting Google Docs, Sheets, or Slides to formats like PDF, CSV, or plain text.

## Shared Drives

\`\`\`ts skip
const drives = await drive.listDrives()
drives.forEach(d => console.log(\`  \${d.name} (\${d.id})\`))
\`\`\`

List all shared drives the authenticated user has access to.

## Summary

The \`googleDrive\` feature provides complete Drive v3 API access for file management. Browse folders, search by content or type, download files, and export Workspace documents. Authentication is handled by \`googleAuth\`. Key methods: \`listFiles()\`, \`search()\`, \`browse()\`, \`download()\`, \`downloadTo()\`, \`exportFile()\`.
`,
  "ui.md": `---
title: "ui"
tags: [ui, terminal, colors, ascii-art, core]
lastTested: null
lastTestPassed: null
---

# ui

Terminal UI utilities including colors, ASCII art, gradients, and markdown rendering.

## Overview

The \`ui\` feature is a core feature, auto-enabled on every container. You can access it directly as a global or via \`container.feature('ui')\`. It provides chalk-based color styling, figlet-powered ASCII art, color gradient effects, and terminal markdown rendering. Use it to make CLI output readable and visually organized.

## Text Colors

The \`colors\` getter provides the full chalk API for coloring and styling terminal text.

\`\`\`ts
const { colors } = ui
console.log(colors.green('Success: all tests passed'))
console.log(colors.red('Error: file not found'))
console.log(colors.yellow('Warning: deprecated API'))
console.log(colors.bold.cyan('Info: build complete'))
\`\`\`

Colors can be chained with styles like \`bold\`, \`italic\`, \`underline\`, and \`dim\`.

## ASCII Art

Use \`asciiArt()\` to render text in large figlet fonts. Pass the text and a font name.

\`\`\`ts
const art = ui.asciiArt('LUCA', 'Standard')
console.log(art)
\`\`\`

The \`fonts\` getter lists all available figlet fonts if you want to explore options.

## Banner with Gradient

Use \`banner()\` to combine ASCII art with a color gradient for eye-catching headers.

\`\`\`ts
const result = ui.banner('Hello', { font: 'Small', colors: ['cyan', 'blue', 'magenta'] })
console.log(result)
\`\`\`

The gradient is applied automatically across the lines of the ASCII art.

## Color Gradients

Use \`applyGradient()\` to apply color transitions to any text. Choose between horizontal (per-character) and vertical (per-line) directions.

\`\`\`ts
const horizontal = ui.applyGradient('Horizontal gradient across this text', ['red', 'yellow', 'green'], 'horizontal')
console.log(horizontal)

const lines = 'Line one\\nLine two\\nLine three\\nLine four'
const vertical = ui.applyGradient(lines, ['cyan', 'blue', 'magenta'], 'vertical')
console.log(vertical)
\`\`\`

Horizontal gradients color each character individually. Vertical gradients color each line uniformly.

## Markdown Rendering

Use \`markdown()\` to render a markdown string for terminal display with formatting preserved.

\`\`\`ts
const md = ui.markdown('## Features\\n\\n- **Bold** text\\n- \`inline code\`\\n- Regular paragraph text\\n')
console.log(md)
\`\`\`

This uses marked-terminal under the hood to produce styled terminal output from markdown source.

## Summary

This demo covered text coloring with chalk, ASCII art generation with figlet, gradient banners, horizontal and vertical color gradients, and markdown rendering. The \`ui\` feature handles all the visual polish for terminal applications.
`,
  "vm.md": `---
title: "vm"
tags: [vm, sandbox, evaluation, core]
lastTested: null
lastTestPassed: null
---

# vm

JavaScript VM for evaluating code in isolated contexts with shared or independent state.

## Overview

The \`vm\` feature is a core feature, auto-enabled on every container. You can access it directly as a global or via \`container.feature('vm')\`. It provides methods for running JavaScript in sandboxed contexts, passing variables in, and optionally preserving state across multiple runs. Use it for plugin systems, dynamic code evaluation, or testing snippets in isolation.

## Simple Expression Evaluation

Use \`runSync()\` to evaluate a JavaScript expression and get the result back immediately.

\`\`\`ts
const sum = vm.runSync('2 + 3 * 4')
console.log('2 + 3 * 4 =', sum)

const greeting = vm.runSync('\`Hello \${name}!\`', { name: 'Luca' })
console.log(greeting)
\`\`\`

The second argument is an optional context object whose keys become variables in the evaluated code.

## Running with Context Variables

Use \`run()\` for async evaluation with injected variables. This is the async equivalent of \`runSync()\`.

\`\`\`ts
const result = await vm.run('numbers.reduce((a, b) => a + b, 0)', {
  numbers: [10, 20, 30, 40]
})
console.log('Sum of [10, 20, 30, 40]:', result)
\`\`\`

Any JavaScript value can be passed through the context -- arrays, objects, functions, and primitives.

## Getting the Context Back

Use \`performSync()\` to run code and get both the result and the modified context. This lets you inspect variables that were set during execution.

\`\`\`ts
const { result, context } = vm.performSync('x = x * 2; x + 1', { x: 21 })
console.log('Result:', result)
console.log('x after execution:', context.x)
\`\`\`

The context is mutated in place, so you can see side effects of the evaluated code.

## Shared State Across Runs

Use \`createContext()\` to build a persistent context that carries state across multiple evaluations.

\`\`\`ts
const ctx = vm.createContext({ counter: 0 })
vm.runSync('counter += 1', ctx)
vm.runSync('counter += 1', ctx)
vm.runSync('counter += 10', ctx)
console.log('Counter after 3 runs:', vm.runSync('counter', ctx))
\`\`\`

The same context object is reused, so variables accumulate across calls.

## Error Handling

When evaluated code might throw, wrap the call in a try/catch to handle it gracefully.

\`\`\`ts
try {
  vm.runSync('undefinedFunction()')
} catch (err) {
  console.log('Error caught:', err.constructor.name)
  console.log('Message:', err.message)
}
\`\`\`

This keeps a bad snippet from crashing the rest of your program.

## Summary

This demo covered synchronous and async expression evaluation, passing context variables into the sandbox, inspecting mutated context after execution, maintaining shared state across runs, and safe error handling. The \`vm\` feature is the foundation for dynamic code execution in any Luca application.
`,
  "opener.md": `---
title: "Opener"
tags: [opener, files, urls, apps, editor]
lastTested: null
lastTestPassed: null
---

# opener

Opens files, URLs, desktop applications, and code editors from scripts. HTTP/HTTPS URLs open in Chrome, files open with the system default handler, and VS Code / Cursor can be targeted directly.

## Overview

The \`opener\` feature provides a simple interface for opening things on the host system. It delegates to platform-appropriate commands (\`open\` on macOS, \`start\` on Windows, direct invocation on Linux). Because every method triggers a side effect (launching an application or browser), all operational examples use skip blocks.

## Enabling the Feature

\`\`\`ts
const opener = container.feature('opener', { enable: true })
console.log('Opener enabled:', opener.state.get('enabled'))
\`\`\`

## Exploring the API

\`\`\`ts
const docs = container.features.describe('opener')
console.log(docs)
\`\`\`

## Opening a URL

Open a URL in Google Chrome (the default browser for HTTP/HTTPS targets).

\`\`\`ts skip
await opener.open('https://github.com/soederpop/luca')
console.log('URL opened in Chrome')
\`\`\`

Non-HTTP paths are opened with the platform default handler. For example, opening a \`.png\` file would launch Preview on macOS.

\`\`\`ts skip
await opener.open('/Users/jon/screenshots/diagram.png')
\`\`\`

## Opening a Desktop App

Launch any desktop application by name.

\`\`\`ts skip
await opener.app('Slack')
console.log('Slack launched')
\`\`\`

\`\`\`ts skip
await opener.app('Finder')
\`\`\`

On macOS this uses \`open -a\`. The application name should match what appears in \`/Applications\`.

## Opening in VS Code or Cursor

Open a file or folder directly in VS Code or Cursor.

\`\`\`ts skip
await opener.code('/Users/jon/projects/my-app')
console.log('VS Code opened')
\`\`\`

\`\`\`ts skip
await opener.cursor('/Users/jon/projects/my-app/src/index.ts')
console.log('Cursor opened')
\`\`\`

Both methods fall back to \`open -a\` on macOS if the CLI command is not found in PATH.

## Summary

The \`opener\` feature provides \`open\`, \`app\`, \`code\`, and \`cursor\` methods for launching URLs, files, desktop applications, and code editors from Luca scripts. All operations produce side effects on the host system.
`,
  "ink-blocks.md": `# Ink Blocks — Poor Man's MDX

This example demonstrates rendering rich terminal UI inline in a markdown document using ink blocks.

## Blocks

\`\`\`tsx
const { Box, Text } = ink.components
const React = ink.React

function Greeting({ name, role }) {
  return (
    <Box borderStyle="round" padding={1}>
      <Text color="green" bold>Hello {name}!</Text>
      <Text dimColor> ({role})</Text>
    </Box>
  )
}

function StatusBar({ items }) {
  return (
    <Box flexDirection="row" gap={2}>
      {items.map((item, i) =>
        <Text key={i} color={item.ok ? 'green' : 'red'}>{item.label}</Text>
      )}
    </Box>
  )
}

function DelayedMessage({ message, delay, done }) {
  const [visible, setVisible] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true)
      done()
    }, delay || 500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <Box>
      <Text dimColor={!visible} color={visible ? 'cyan' : undefined}>
        {visible ? message : 'Loading...'}
      </Text>
    </Box>
  )
}
\`\`\`

## Report

Let's greet the admin:

\`\`\`ts
await render('Greeting', { name: 'Jon', role: 'admin' })
\`\`\`

Now let's check the system status:

\`\`\`ts
await render('StatusBar', { items: [
  { label: 'API', ok: true },
  { label: 'DB', ok: false },
  { label: 'Cache', ok: true },
]})
\`\`\`

Now an async block that waits for a timer before rendering:

\`\`\`ts
await renderAsync('DelayedMessage', { message: 'Data loaded successfully!', delay: 1000 })
\`\`\`

All done. Blocks rendered inline with the document flow.
`
}

export const bootstrapTutorials: Record<string, string> = {
  "17-tui-blocks.md": `---
title: Building TUI Primitive Blocks
tags: [ink, react, terminal, ui, components, tui, blocks, tutorial]
---

# Building TUI Primitive Blocks

This tutorial teaches you how to build a library of reusable terminal UI primitives using Ink blocks. Each block is a React component you can render inline in any runnable markdown document. We'll build them from simple to complex, covering layout, color, state, and composition patterns along the way.

Run this tutorial to see every block in action:

\`\`\`
luca run docs/tutorials/17-tui-blocks
\`\`\`

## Blocks

\`\`\`tsx
const { Box, Text, Newline, Spacer } = ink.components
const React = ink.React

// ─── Divider ──────────────────────────────────────────
// A horizontal rule with an optional centered label.
function Divider({ label, color, width }) {
  const w = width || 60
  const ch = '─'

  if (!label) {
    return <Text color={color || 'gray'}>{ch.repeat(w)}</Text>
  }

  const pad = \` \${label} \`
  const side = Math.max(0, Math.floor((w - pad.length) / 2))
  const right = Math.max(0, w - side - pad.length)

  return (
    <Text>
      <Text color={color || 'gray'}>{ch.repeat(side)}</Text>
      <Text color={color || 'white'} bold>{pad}</Text>
      <Text color={color || 'gray'}>{ch.repeat(right)}</Text>
    </Text>
  )
}

// ─── Badge ────────────────────────────────────────────
// A compact colored label, like a GitHub status badge.
const BADGE_STYLES = {
  success: { bg: 'green', fg: 'white', icon: '✓' },
  error:   { bg: 'red', fg: 'white', icon: '✗' },
  warning: { bg: 'yellow', fg: 'black', icon: '!' },
  info:    { bg: 'blue', fg: 'white', icon: 'i' },
  neutral: { bg: 'gray', fg: 'white', icon: '·' },
}

function Badge({ type, label }) {
  const style = BADGE_STYLES[type] || BADGE_STYLES.neutral
  return (
    <Text backgroundColor={style.bg} color={style.fg} bold>
      {\` \${style.icon} \${label} \`}
    </Text>
  )
}

// ─── Alert ────────────────────────────────────────────
// A bordered message box for notices, warnings, errors.
const ALERT_STYLES = {
  info:    { border: 'blue', icon: 'ℹ', title: 'Info' },
  success: { border: 'green', icon: '✓', title: 'Success' },
  warning: { border: 'yellow', icon: '⚠', title: 'Warning' },
  error:   { border: 'red', icon: '✗', title: 'Error' },
}

function Alert({ type, message, title }) {
  const style = ALERT_STYLES[type] || ALERT_STYLES.info
  const heading = title || style.title

  return (
    <Box borderStyle="round" borderColor={style.border} paddingX={1} flexDirection="column" width={60}>
      <Text color={style.border} bold>{style.icon}  {heading}</Text>
      <Text>{message}</Text>
    </Box>
  )
}

// ─── KeyValue ─────────────────────────────────────────
// Display a record as aligned key: value pairs.
function KeyValue({ data, keyColor, separator }) {
  const entries = Object.entries(data)
  const maxKey = Math.max(...entries.map(([k]) => k.length))
  const sep = separator || ':'

  return (
    <Box flexDirection="column">
      {entries.map(([key, val], i) => (
        <Box key={i}>
          <Text color={keyColor || 'cyan'} bold>{key.padEnd(maxKey)}</Text>
          <Text dimColor> {sep} </Text>
          <Text>{String(val)}</Text>
        </Box>
      ))}
    </Box>
  )
}

// ─── DataTable ────────────────────────────────────────
// A data table with headers, column widths, and borders.
function DataTable({ headers, rows, borderColor }) {
  const bc = borderColor || 'gray'
  const colWidths = headers.map((h, ci) => {
    const vals = [h.label || h, ...rows.map(r => String(r[ci] ?? ''))]
    return Math.max(...vals.map(v => v.length)) + 2
  })

  const totalWidth = colWidths.reduce((a, b) => a + b, 0) + headers.length + 1
  const hLine = '─'.repeat(totalWidth - 2)

  function Row({ cells, bold: isBold, color }) {
    return (
      <Box>
        <Text color={bc}>│</Text>
        {cells.map((cell, ci) => (
          <Box key={ci}>
            <Text color={color} bold={isBold}>{\` \${String(cell).padEnd(colWidths[ci] - 2)} \`}</Text>
            <Text color={bc}>│</Text>
          </Box>
        ))}
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text color={bc}>┌{hLine}┐</Text>
      <Row cells={headers.map(h => h.label || h)} bold={true} color="cyan" />
      <Text color={bc}>├{hLine}┤</Text>
      {rows.map((row, ri) => (
        <Row key={ri} cells={row} color={ri % 2 === 0 ? 'white' : 'gray'} />
      ))}
      <Text color={bc}>└{hLine}┘</Text>
    </Box>
  )
}

// ─── ProgressBar ──────────────────────────────────────
// A visual bar with percentage and optional label.
function ProgressBar({ value, total, label, width, color }) {
  const pct = Math.min(1, Math.max(0, value / (total || 100)))
  const barWidth = (width || 30)
  const filled = Math.round(pct * barWidth)
  const empty = barWidth - filled
  const c = color || 'green'

  return (
    <Box>
      {label && <Text color="white" bold>{label.padEnd(12)} </Text>}
      <Text color={c}>{'█'.repeat(filled)}</Text>
      <Text color="gray">{'░'.repeat(empty)}</Text>
      <Text dimColor> {Math.round(pct * 100)}%</Text>
    </Box>
  )
}

// ─── Tree ─────────────────────────────────────────────
// Render a nested object/array as a tree view.
function TreeNode({ name, children: kids, isLast, prefix }) {
  const connector = isLast ? '└── ' : '├── '
  const childPrefix = prefix + (isLast ? '    ' : '│   ')

  return (
    <Box flexDirection="column">
      <Text>
        <Text color="gray">{prefix}{connector}</Text>
        {kids ? (
          <Text color="yellow" bold>{name}/</Text>
        ) : (
          <Text color="green">{name}</Text>
        )}
      </Text>
      {kids && kids.map((child, i) => (
        <TreeNode
          key={i}
          name={child.name}
          children={child.children}
          isLast={i === kids.length - 1}
          prefix={childPrefix}
        />
      ))}
    </Box>
  )
}

function Tree({ label, items }) {
  return (
    <Box flexDirection="column">
      <Text color="yellow" bold>{label || '.'}</Text>
      {items.map((item, i) => (
        <TreeNode
          key={i}
          name={item.name}
          children={item.children}
          isLast={i === items.length - 1}
          prefix=""
        />
      ))}
    </Box>
  )
}

// ─── Panel ────────────────────────────────────────────
// A titled bordered box that wraps any child content.
function Panel({ title, children, borderColor, width }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={borderColor || 'blue'}
      paddingX={1}
      width={width || 60}
    >
      {title && (
        <Box marginBottom={1}>
          <Text color={borderColor || 'blue'} bold>{title}</Text>
        </Box>
      )}
      {children}
    </Box>
  )
}

// ─── Spinner ──────────────────────────────────────────
// An animated spinner that runs until done() is called.
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function Spinner({ message, done }) {
  const [frame, setFrame] = React.useState(0)

  React.useEffect(() => {
    const timer = setInterval(() => {
      setFrame(f => (f + 1) % SPINNER_FRAMES.length)
    }, 80)
    // Signal done after a short display so the tutorial keeps moving
    const exit = setTimeout(() => done(), 1500)
    return () => { clearInterval(timer); clearTimeout(exit) }
  }, [])

  return (
    <Box>
      <Text color="cyan">{SPINNER_FRAMES[frame]} </Text>
      <Text>{message || 'Loading...'}</Text>
    </Box>
  )
}
\`\`\`

## 1. Dividers — Simple Separation

The simplest useful primitive: a horizontal line. The \`Divider\` block accepts an optional label that gets centered in the rule, and a color.

A plain divider:

\`\`\`ts
await render('Divider', {})
\`\`\`

With a label:

\`\`\`ts
await render('Divider', { label: 'Section One', color: 'cyan' })
\`\`\`

Wide with a custom color:

\`\`\`ts
await render('Divider', { label: 'Results', color: 'yellow', width: 50 })
\`\`\`

**Pattern:** Use \`Text\` for inline styled strings. The \`color\` prop accepts any named color or hex value. Use \`bold\`, \`dimColor\`, \`italic\`, \`underline\`, \`inverse\`, and \`strikethrough\` for styling.

## 2. Badges — Compact Status Labels

Badges are small colored labels for tagging status or categories. They use \`backgroundColor\` to create the filled look.

\`\`\`ts
await render('Badge', { type: 'success', label: 'PASSING' })
\`\`\`

\`\`\`ts
await render('Badge', { type: 'error', label: 'FAILED' })
\`\`\`

\`\`\`ts
await render('Badge', { type: 'warning', label: 'UNSTABLE' })
\`\`\`

\`\`\`ts
await render('Badge', { type: 'info', label: 'v2.1.0' })
\`\`\`

**Pattern:** Define a styles map keyed by type name. This keeps your component clean and makes it easy to add new variants. \`backgroundColor\` on \`Text\` creates solid filled backgrounds.

## 3. Alerts — Bordered Message Boxes

Alerts combine borders, colors, and icons for eye-catching notices. They use \`Box\` with \`borderStyle\` and \`borderColor\`.

\`\`\`ts
await render('Alert', { type: 'info', message: 'The ink feature provides Box, Text, Spacer, Newline, Static, and Transform components.' })
\`\`\`

\`\`\`ts
await render('Alert', { type: 'success', message: 'All 47 tests passed in 1.2s.' })
\`\`\`

\`\`\`ts
await render('Alert', { type: 'warning', message: 'Disk usage at 89%. Consider cleanup.' })
\`\`\`

\`\`\`ts
await render('Alert', { type: 'error', message: 'Connection refused: ECONNREFUSED 127.0.0.1:5432', title: 'Database Error' })
\`\`\`

**Pattern:** \`Box\` supports border styles: \`single\`, \`double\`, \`round\`, \`bold\`, \`singleDouble\`, \`doubleSingle\`, \`classic\`. Combine \`borderColor\` with \`paddingX\`/\`paddingY\` for clean framing.

## 4. Key-Value — Structured Data Display

\`KeyValue\` renders an object as aligned label-value pairs. Great for config views, server status, and metadata displays.

\`\`\`ts
await render('KeyValue', {
  data: {
    Host: '0.0.0.0',
    Port: 3000,
    Mode: 'development',
    PID: 48291,
    Uptime: '3h 14m',
    Workers: 4,
  },
})
\`\`\`

With a custom key color and separator:

\`\`\`ts
await render('KeyValue', {
  data: { Name: 'luca', Version: '0.8.0', Runtime: 'bun', License: 'MIT' },
  keyColor: 'yellow',
  separator: '→',
})
\`\`\`

**Pattern:** Use \`padEnd\` to align columns. The \`flexDirection="column"\` on \`Box\` stacks rows vertically. Map over \`Object.entries()\` to render dynamic data.

## 5. Data Tables — Rows and Columns

\`DataTable\` is the workhorse for displaying tabular data with headers, computed column widths, and box-drawing borders.

\`\`\`ts
await render('DataTable', {
  headers: ['Feature', 'Status', 'Type'],
  rows: [
    ['fs',       'enabled',  'core'],
    ['git',      'enabled',  'core'],
    ['ink',      'enabled',  'ui'],
    ['esbuild',  'lazy',     'build'],
    ['tts',      'disabled', 'media'],
  ],
})
\`\`\`

Wider dataset:

\`\`\`ts
await render('DataTable', {
  headers: ['Method', 'Path', 'Handler', 'Auth'],
  rows: [
    ['GET',    '/api/health',  'health.ts',  'none'],
    ['GET',    '/api/users',   'users.ts',   'jwt'],
    ['POST',   '/api/users',   'users.ts',   'jwt'],
    ['DELETE', '/api/users/:id', 'users.ts', 'admin'],
  ],
  borderColor: 'cyan',
})
\`\`\`

**Pattern:** Auto-compute column widths from header + data. Use box-drawing characters (\`┌─┐│├┤└─┘\`) for clean borders. Alternating row colors (\`ri % 2\`) improve readability.

## 6. Progress Bars — Visual Metrics

\`ProgressBar\` fills a bar proportionally. Useful for build status, disk usage, test coverage — anywhere you want a quick visual read.

\`\`\`ts
await render('ProgressBar', { label: 'Tests', value: 47, total: 50, color: 'green' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Coverage', value: 72, total: 100, color: 'yellow' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Disk', value: 89, total: 100, color: 'red' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Upload', value: 30, total: 100, color: 'cyan', width: 40 })
\`\`\`

**Pattern:** Use \`█\` and \`░\` (or any unicode pair) for filled/empty. Calculate fill width as \`Math.round(pct * barWidth)\`. Clamp the percentage to avoid overflow.

## 7. Trees — Hierarchical Data

\`Tree\` renders nested structures with box-drawing connectors. Pass an array of \`{ name, children? }\` nodes.

\`\`\`ts
await render('Tree', {
  label: 'my-app',
  items: [
    { name: 'src', children: [
      { name: 'commands', children: [
        { name: 'serve.ts' },
        { name: 'run.ts' },
      ]},
      { name: 'features', children: [
        { name: 'auth.ts' },
        { name: 'cache.ts' },
      ]},
      { name: 'index.ts' },
    ]},
    { name: 'endpoints', children: [
      { name: 'health.ts' },
      { name: 'users.ts' },
    ]},
    { name: 'package.json' },
    { name: 'tsconfig.json' },
  ],
})
\`\`\`

**Pattern:** Recursive components are natural in React. Pass a \`prefix\` string down that builds the indentation. Use \`├──\` for intermediate nodes and \`└──\` for the last child. Color directories differently from files.

## 8. Spinner — Async Animation

The \`Spinner\` block uses \`setInterval\` to cycle through braille frames. Since it stays mounted until \`done()\` is called, use \`renderAsync\`.

\`\`\`ts
await renderAsync('Spinner', { message: 'Compiling project...' })
\`\`\`

\`\`\`ts
await renderAsync('Spinner', { message: 'Fetching remote data...' })
\`\`\`

**Pattern:** \`renderAsync\` keeps the component mounted until the \`done\` callback fires (or the timeout expires). Use \`React.useEffect\` to set up timers and return cleanup functions. The \`done\` prop is injected automatically by the rendering system.

## 9. Composition — Combining Blocks

The real power comes from composing primitives together. Here's a dashboard using multiple blocks rendered in sequence:

\`\`\`ts
await render('Divider', { label: 'System Dashboard', color: 'cyan' })
\`\`\`

\`\`\`ts
await render('KeyValue', {
  data: { Host: 'localhost', Port: 3000, Env: 'development', Runtime: 'bun' },
  keyColor: 'cyan',
})
\`\`\`

\`\`\`ts
await render('Divider', { label: 'Services', color: 'cyan' })
\`\`\`

\`\`\`ts
await render('DataTable', {
  headers: ['Service', 'Status', 'Latency'],
  rows: [
    ['Express', 'running', '2ms'],
    ['WebSocket', 'running', '1ms'],
    ['Redis', 'stopped', '—'],
  ],
  borderColor: 'cyan',
})
\`\`\`

\`\`\`ts
await render('Divider', { label: 'Resources', color: 'cyan' })
\`\`\`

\`\`\`ts
await render('ProgressBar', { label: 'Memory', value: 64, total: 100, color: 'green' })
await render('ProgressBar', { label: 'CPU', value: 23, total: 100, color: 'green' })
await render('ProgressBar', { label: 'Disk', value: 87, total: 100, color: 'yellow' })
\`\`\`

\`\`\`ts
await render('Divider', {})
\`\`\`

\`\`\`ts
await render('Alert', { type: 'warning', message: 'Redis is not responding. Cache reads will fall through to database.' })
\`\`\`

## Summary

These eight primitives cover most TUI needs:

\`\`\`ts
await render('DataTable', {
  headers: ['Block', 'Use Case'],
  rows: [
    ['Divider',     'Visual separation between sections'],
    ['Badge',       'Compact status or version labels'],
    ['Alert',       'Notices, warnings, errors with borders'],
    ['KeyValue',    'Config, metadata, record display'],
    ['DataTable',   'Tabular data with headers'],
    ['ProgressBar', 'Percentages, quotas, progress'],
    ['Tree',        'File trees, dependency graphs, nested data'],
    ['Spinner',     'Async loading states with animation'],
  ],
  borderColor: 'green',
})
\`\`\`

### Key Patterns

- **Style maps** — Keep variant styles in an object keyed by type name
- **Auto-sizing** — Compute widths from data with \`padEnd\` and \`Math.max\`
- **Box-drawing** — Use unicode box chars for clean borders and connectors
- **Recursion** — React components can call themselves for tree structures
- **Async lifecycle** — Use \`renderAsync\` + \`done()\` for animated or time-based blocks
- **Composition** — Render blocks in sequence to build dashboards from primitives
`,
  "10-creating-features.md": `---
title: Creating Custom Features
tags: [features, custom, extend, zod, state, events, module-augmentation, helper]
---

# Creating Custom Features

You can create your own features to encapsulate domain logic, then register them so they're available through \`container.feature('yourFeature')\` with full type safety.

## Anatomy of a Feature

A feature has:
- **State** -- observable, defined by a Zod schema
- **Options** -- configuration passed at creation, defined by a Zod schema
- **Events** -- typed event bus
- **Methods** -- your domain logic
- **Access to the container** -- via \`this.container\`

## Basic Example

\`\`\`typescript
import { z } from 'zod'
import { Feature, features, FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'

// Define state schema by extending the base FeatureStateSchema
export const CounterStateSchema = FeatureStateSchema.extend({
  count: z.number().describe('Current count value'),
  lastUpdated: z.string().optional().describe('ISO timestamp of last update'),
})
export type CounterState = z.infer<typeof CounterStateSchema>

// Define options schema by extending the base FeatureOptionsSchema
export const CounterOptionsSchema = FeatureOptionsSchema.extend({
  initialCount: z.number().default(0).describe('Starting count value'),
  step: z.number().default(1).describe('Increment step size'),
})
export type CounterOptions = z.infer<typeof CounterOptionsSchema>

/**
 * A simple counter feature that demonstrates the feature pattern.
 * Tracks a count value with observable state and events.
 */
export class Counter extends Feature<CounterState, CounterOptions> {
  static override stateSchema = CounterStateSchema
  static override optionsSchema = CounterOptionsSchema

  /** Called when the feature is created */
  async initialize() {
    this.state.set('count', this.options.initialCount ?? 0)
  }

  /** Increment the counter by the configured step */
  increment() {
    const current = this.state.get('count') || 0
    const next = current + (this.options.step ?? 1)
    this.state.set('count', next)
    this.state.set('lastUpdated', new Date().toISOString())
    this.emit('incremented', next)
    return next
  }

  /** Decrement the counter by the configured step */
  decrement() {
    const current = this.state.get('count') || 0
    const next = current - (this.options.step ?? 1)
    this.state.set('count', next)
    this.state.set('lastUpdated', new Date().toISOString())
    this.emit('decremented', next)
    return next
  }

  /** Reset the counter to its initial value */
  reset() {
    this.state.set('count', this.options.initialCount ?? 0)
    this.emit('reset')
  }

  /** Get the current count */
  get value(): number {
    return this.state.get('count') || 0
  }
}

// Register the feature
features.register('counter', Counter)

// Module augmentation for type safety
declare module '@soederpop/luca' {
  interface AvailableFeatures {
    counter: typeof Counter
  }
}
\`\`\`

## Using Your Feature

\`\`\`typescript
import './features/counter' // Side-effect import to register

const counter = container.feature('counter', { initialCount: 10, step: 5 })

counter.on('incremented', (value) => {
  console.log(\`Count is now \${value}\`)
})

counter.increment()  // 15
counter.increment()  // 20
counter.value        // 20
counter.reset()      // Back to 10

// Observe state changes
counter.state.observe((type, key, value) => {
  console.log(\`\${key} \${type}d:\`, value)
})
\`\`\`

## Enabling on the Container

If your feature should be a container-level singleton with a shortcut:

\`\`\`typescript
export class Counter extends Feature<CounterState, CounterOptions> {
  // This creates the container.counter shortcut when enabled
  static override shortcut = 'features.counter' as const
  // ...
}

// Enable it
container.feature('counter', { enable: true })

// Now accessible as:
container.counter.increment()
\`\`\`

## Feature with Container Access

Features can access other features and the full container:

\`\`\`typescript
export class Analytics extends Feature<AnalyticsState, AnalyticsOptions> {
  /** Log an event, writing to disk cache for persistence */
  async logEvent(name: string, data: Record<string, any>) {
    const cache = this.container.feature('diskCache', { path: './.analytics' })
    const timestamp = new Date().toISOString()

    await cache.set(\`event:\${timestamp}\`, { name, data, timestamp })

    this.state.set('totalEvents', (this.state.get('totalEvents') || 0) + 1)
    this.emit('eventLogged', { name, data })
  }

  /** Get recent events from the cache */
  async recentEvents(limit = 10) {
    const fs = this.container.fs
    // ... read from cache directory
  }
}
\`\`\`

## Documenting Your Feature

Document your classes, methods, and getters with JSDoc. This is important because Luca's introspection system extracts these docs and makes them available at runtime:

\`\`\`typescript
/**
 * Manages user sessions with automatic expiration and renewal.
 * Sessions are persisted to disk and can survive process restarts.
 */
export class SessionManager extends Feature<SessionState, SessionOptions> {
  /**
   * Create a new session for the given user.
   * Returns a session token that can be used for authentication.
   */
  async createSession(userId: string): Promise<string> {
    // ...
  }

  /** The number of currently active sessions */
  get activeCount(): number {
    return this.state.get('sessions')?.length || 0
  }
}
\`\`\`

Then anyone (human or AI) can discover your feature:

\`\`\`typescript
container.features.describe('sessionManager')
// Returns the full markdown documentation extracted from your JSDoc
\`\`\`

## Best Practices

1. **Use Zod \`.describe()\` on schema fields** -- these descriptions appear in introspection and help documentation
2. **Emit events for significant actions** -- enables reactive patterns and decoupled observers
3. **Use state for observable values** -- don't hide important state in private variables if consumers need to watch it
4. **Access the container, not imports** -- prefer \`this.container.feature('fs')\` over importing fs directly, so the feature works in any container
5. **Document everything** -- JSDoc on the class, methods, and getters feeds the introspection system
`,
  "13-introspection.md": `---
title: Introspection and Discovery
tags: [introspection, runtime, discovery, documentation, describe, inspect]
---

# Introspection and Discovery

One of Luca's defining features is that everything is discoverable at runtime. You don't need to read documentation to learn what's available -- you can ask the system itself.

## Why Introspection Matters

Introspection serves two audiences:

1. **Developers** -- discover APIs while coding, without leaving the REPL or editor
2. **AI Agents** -- learn the full API surface dynamically, enabling them to use features they weren't explicitly trained on

## Container-Level Introspection

\`\`\`typescript
// Structured data about the entire container
const info = container.inspect()
// Returns: registries, enabled features, state schema, available helpers

// Human-readable markdown
const docs = container.inspectAsText()
\`\`\`

## Registry-Level Discovery

\`\`\`typescript
// What's available?
container.features.available
// => ['fs', 'git', 'proc', 'vm', 'ui', 'diskCache', 'contentDb', ...]

// Describe one
container.features.describe('diskCache')
// => Markdown documentation for diskCache feature

// Describe everything
container.features.describeAll()
// => Full documentation for all registered features

// Structured introspection data
container.features.introspect('fs')
// => { methods, getters, state, options, events, ... }
\`\`\`

Same API for all registries:

\`\`\`typescript
container.servers.available
container.servers.describe('express')

container.clients.available
container.clients.describe('rest')

container.commands.available
container.commands.describe('serve')
\`\`\`

## Helper-Level Introspection

Every helper instance can describe itself:

\`\`\`typescript
const fs = container.feature('fs')

// Structured data
const info = fs.introspect()
// => { className, methods: [...], getters: [...], state: {...}, events: [...] }

// Human-readable markdown
const docs = fs.introspectAsText()
\`\`\`

### What's in the Introspection Data?

- **Class name** and description (from JSDoc)
- **Methods** -- name, description, parameters, return type
- **Getters** -- name, description, type
- **State schema** -- all observable state fields with descriptions
- **Options schema** -- all configuration options with descriptions and defaults
- **Events** -- known event names with descriptions

## How It Works

Introspection comes from two sources:

1. **Build-time extraction** -- Luca's build step parses JSDoc comments, method signatures, and getter types from source code using AST analysis. Run \`bun run build:introspection\` to update this.

2. **Runtime Zod schemas** -- State, options, and events schemas provide descriptions, types, and defaults at runtime via Zod's \`.describe()\` method.

## Practical Example: Dynamic Tool Generation

An AI agent can use introspection to generate tool definitions for any feature:

\`\`\`typescript
// Agent discovers available features
const available = container.features.available

// Agent learns about a specific feature
const fsInfo = container.features.introspect('fs')

// fsInfo.methods tells the agent:
// - readFile(path: string): string
// - writeFile(path: string, content: string): Promise<string>
// - walk(basePath: string, options?: WalkOptions): { files: string[], directories: string[] }
// etc.

// The agent can now use these methods without prior training on the fs feature
\`\`\`

## Using Introspection in Your Features

Make your custom features introspectable by:

1. Writing JSDoc on the class, methods, and getters
2. Using Zod \`.describe()\` on schema fields
3. Running \`bun run build:introspection\` after changes

\`\`\`typescript
/**
 * Manages a pool of database connections with automatic health checking.
 * Connections are recycled when they become stale or unhealthy.
 */
export class ConnectionPool extends Feature<PoolState, PoolOptions> {
  /**
   * Acquire a connection from the pool.
   * Blocks until a connection is available or the timeout is reached.
   */
  async acquire(timeout?: number): Promise<Connection> {
    // ...
  }

  /** The number of idle connections currently in the pool */
  get idleCount(): number {
    // ...
  }

  /** The number of active connections currently checked out */
  get activeCount(): number {
    // ...
  }
}
\`\`\`

Now \`container.features.describe('connectionPool')\` returns rich documentation, and \`container.features.introspect('connectionPool')\` returns structured data -- all extracted from what you already wrote.
`,
  "01-getting-started.md": `---
title: Getting Started with Luca
tags: [setup, quickstart, project, init]
---

# Getting Started with Luca

## Prerequisites

- [Bun](https://bun.sh) installed (Luca's runtime)
- A new or existing bun project

## Create a New Project

\`\`\`bash
mkdir my-app && cd my-app
bun init -y
bun add @soederpop/luca 
\`\`\`

## Project Structure

A typical Luca project looks like this:

\`\`\`
my-app/
├── package.json
├── endpoints/          # File-based HTTP routes (auto-discovered by \`luca serve\`)
│   ├── health.ts
│   └── users.ts
├── commands/           # Project-local CLI commands (auto-discovered by \`luca\`)
│   └── seed.ts
├── assistants/         # AI assistants (file-based convention)
│   └── my-helper/
│       ├── CORE.md
│       ├── tools.ts
│       ├── hooks.ts
│       └── docs/
├── public/             # Static files served by \`luca serve\`
│   └── index.html
└── scripts/            # Standalone scripts that use the container
    └── migrate.ts
\`\`\`

## The Container

Everything in Luca revolves around the **container**. It is a per-process singleton that acts as your dependency injector, event bus, and state machine.

In scripts, you create one directly:

\`\`\`typescript
import container from '@soederpop/luca/node'

// Now you have access to all features
const fs = container.fs           // File system operations
const git = container.git         // Git utilities (branch, sha, lsFiles, etc.)
const ui = container.ui           // Terminal UI (colors, prompts, figlet)
const proc = container.feature('proc')  // Process execution
\`\`\`

In endpoints and commands, the container is provided for you via context:

\`\`\`typescript
// endpoints/health.ts
export const path = '/health'

export async function get(_params: any, ctx: EndpointContext) {
  const { container } = ctx
  return { status: 'ok', uptime: process.uptime() }
}
\`\`\`

## Running Your Project

### Start the API server

\`\`\`bash
luca serve
# or with options:
luca serve --port 4000 --endpointsDir src/endpoints
\`\`\`

This auto-discovers your \`endpoints/\` directory, mounts all routes, and generates an OpenAPI spec at \`/openapi.json\`.

### Run a CLI command

\`\`\`bash
luca seed --count 10
\`\`\`

This auto-discovers \`commands/seed.ts\` from your project and runs it.

### Run a script

\`\`\`bash
luca run scripts/migrate.ts
\`\`\`

## What's Next

- [The Container](./02-container.md) -- deep dive into the container
- [Scripts and Markdown Notebooks](./03-scripts.md) -- run scripts and executable markdown
- [Using Features](./04-features-overview.md) -- explore built-in features
- [Servers](./06-servers.md) -- set up Express and WebSocket servers
- [Writing Endpoints](./07-endpoints.md) -- build your API routes
- [Writing Commands](./08-commands.md) -- add CLI commands to your project
`,
  "07-endpoints.md": `---
title: Writing Endpoints
tags: [endpoints, routes, api, express, openapi, rest, http, server]
---

# Writing Endpoints

Endpoints are file-based HTTP routes. Each file in your \`endpoints/\` directory becomes an API route. Luca auto-discovers them when you run \`luca serve\`.

## Basic Endpoint

\`\`\`typescript
// endpoints/health.ts
export const path = '/health'
export const description = 'Health check endpoint'

export async function get() {
  return { status: 'ok', uptime: process.uptime() }
}
\`\`\`

That's it. \`luca serve\` will mount \`GET /health\` and include it in the auto-generated OpenAPI spec.

## Request Validation with Zod

Define schemas for your handlers. Parameters are validated automatically:

\`\`\`typescript
// endpoints/users.ts
import { z } from 'zod'
import type { EndpointContext } from '@soederpop/luca'

export const path = '/api/users'
export const description = 'User management'
export const tags = ['users']

// GET /api/users?role=admin&limit=10
export const getSchema = z.object({
  role: z.string().optional().describe('Filter by role'),
  limit: z.number().default(50).describe('Max results'),
})

export async function get(params: z.infer<typeof getSchema>, ctx: EndpointContext) {
  // params.role and params.limit are validated and typed
  return { users: [], total: 0 }
}

// POST /api/users
export const postSchema = z.object({
  name: z.string().describe('Full name'),
  email: z.string().email().describe('Email address'),
  role: z.enum(['user', 'admin']).default('user').describe('User role'),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  // params are validated
  return { user: { id: '1', ...params }, message: 'User created' }
}
\`\`\`

## URL Parameters

Use \`:param\` in the path or bracket-based file naming:

\`\`\`typescript
// endpoints/users/[id].ts
import { z } from 'zod'
import type { EndpointContext } from '@soederpop/luca'

export const path = '/api/users/:id'
export const description = 'Get, update, or delete a specific user'
export const tags = ['users']

export async function get(_params: any, ctx: EndpointContext) {
  const { id } = ctx.params  // From the URL
  return { user: { id, name: 'Example' } }
}

export const putSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
})

export async function put(params: z.infer<typeof putSchema>, ctx: EndpointContext) {
  const { id } = ctx.params
  return { user: { id, ...params }, message: 'Updated' }
}

// Use \`destroy\` for DELETE — it's a reserved word in JS
export async function destroy(_params: any, ctx: EndpointContext) {
  const { id } = ctx.params
  return { message: \`User \${id} deleted\` }
}
\`\`\`

## The EndpointContext

Every handler receives \`(params, ctx)\`. The context gives you access to:

\`\`\`typescript
export async function post(params: any, ctx: EndpointContext) {
  const {
    container,   // The Luca container -- access any feature from here
    request,     // Express request object
    response,    // Express response object
    query,       // Parsed query string
    body,        // Parsed request body
    params: urlParams,  // URL parameters (:id, etc.)
  } = ctx

  // Use container features
  const data = container.fs.readJson('./data/config.json')

  return { success: true }
}
\`\`\`

## Supported HTTP Methods

Export any of these handler functions:

- \`get\` -- GET requests
- \`post\` -- POST requests
- \`put\` -- PUT requests
- \`patch\` -- PATCH requests
- \`destroy\` -- DELETE requests (preferred — avoids the \`delete\` reserved word)
- \`delete\` -- DELETE requests (also works via \`export { del as delete }\`)

Each can have a corresponding schema export: \`getSchema\`, \`postSchema\`, \`putSchema\`, \`patchSchema\`, \`destroySchema\` / \`deleteSchema\`.

## What Gets Exported

| Export | Required | Description |
|--------|----------|-------------|
| \`path\` | Yes | The route path (e.g. \`/api/users\`, \`/api/users/:id\`) |
| \`description\` | No | Human-readable description (used in OpenAPI spec) |
| \`tags\` | No | Array of tags for OpenAPI grouping |
| \`get\`, \`post\`, \`put\`, \`patch\`, \`destroy\` | At least one | Handler functions (\`destroy\` maps to DELETE) |
| \`getSchema\`, \`postSchema\`, \`destroySchema\`, etc. | No | Zod schemas for request validation |

## Starting the Server

\`\`\`bash
# Default: looks for endpoints/ or src/endpoints/, serves on port 3000
luca serve

# Custom port and directories
luca serve --port 4000 --endpointsDir src/routes --staticDir public
\`\`\`

The server automatically:
- Discovers and mounts all endpoint files
- Generates an OpenAPI spec at \`/openapi.json\`
- Serves static files from \`public/\` if it exists
- Enables CORS by default
- Prints all mounted routes to the console

## Programmatic Server Setup

You can also set up the server in a script:

\`\`\`typescript
import container from '@soederpop/luca'

const server = container.server('express', { port: 3000, cors: true })

await server.useEndpoints('./endpoints')

server.serveOpenAPISpec({
  title: 'My API',
  version: '1.0.0',
  description: 'My awesome API',
})

await server.start()
console.log('Server running on http://localhost:3000')
\`\`\`

## Streaming Responses

For endpoints that need to stream (e.g. AI responses), you can write directly to the response:

\`\`\`typescript
export const path = '/api/stream'

export async function post(params: any, ctx: EndpointContext) {
  const { response } = ctx

  response.setHeader('Content-Type', 'text/event-stream')
  response.setHeader('Cache-Control', 'no-cache')

  for (const chunk of data) {
    response.write(\`data: \${JSON.stringify(chunk)}\\n\\n\`)
  }

  response.end()
}
\`\`\`
`,
  "18-semantic-search.md": `---
title: Semantic Search
tags: [semantic-search, embeddings, vector-search, bm25, hybrid-search, sqlite, contentdb]
---

# Semantic Search

Luca's \`semanticSearch\` feature provides BM25 keyword search, vector similarity search, and hybrid search with Reciprocal Rank Fusion -- all backed by SQLite. It chunks documents intelligently, generates embeddings via OpenAI or a local GGUF model, and stores everything in a single \`.sqlite\` file.

## Quick Start with ContentDb

The fastest way to use semantic search is through the \`contentDb\` feature, which handles indexing and querying automatically:

\`\`\`typescript
import container from '@soederpop/luca'

const db = container.feature('contentDb', { rootPath: './docs' })
await db.load()

// Build the search index (generates embeddings for all documents)
await db.buildSearchIndex({
  onProgress: (indexed, total) => console.log(\`\${indexed}/\${total}\`)
})

// Search your documents
const results = await db.hybridSearch('how does authentication work')
for (const r of results) {
  console.log(\`\${r.title} (score: \${r.score.toFixed(3)})\`)
  console.log(\`  \${r.snippet}\`)
}
\`\`\`

ContentDb provides three search methods that delegate to the underlying semanticSearch feature:

\`\`\`typescript
// BM25 keyword search -- best for exact term matching
await db.search('OAuth2 token refresh')

// Vector similarity search -- finds conceptually related documents
await db.vectorSearch('how do users log in')

// Hybrid search -- combines both via Reciprocal Rank Fusion (recommended)
await db.hybridSearch('authentication flow', { limit: 5 })
\`\`\`

## Using SemanticSearch Directly

For more control, use the \`semanticSearch\` feature directly:

\`\`\`typescript
import container from '@soederpop/luca'
import { SemanticSearch } from '@soederpop/luca/node/features/semantic-search'

// Attach the feature to the container
SemanticSearch.attach(container)

const search = container.feature('semanticSearch', {
  dbPath: '.contentbase/search.sqlite',
  embeddingProvider: 'openai',        // or 'local'
  embeddingModel: 'text-embedding-3-small',
  chunkStrategy: 'section',           // 'section' | 'fixed' | 'document'
  chunkSize: 900,
})

await search.initDb()
\`\`\`

## Indexing Documents

Documents are represented as \`DocumentInput\` objects with optional section metadata:

\`\`\`typescript
await search.indexDocuments([
  {
    pathId: 'guides/auth',
    model: 'Guide',
    title: 'Authentication Guide',
    meta: { status: 'published', category: 'security' },
    content: 'Full document content here...',
    sections: [
      {
        heading: 'OAuth2 Flow',
        headingPath: 'Authentication Guide > OAuth2 Flow',
        content: 'OAuth2 uses authorization codes and tokens...',
        level: 2,
      },
      {
        heading: 'Session Management',
        headingPath: 'Authentication Guide > Session Management',
        content: 'Sessions are stored server-side with a cookie...',
        level: 2,
      },
    ],
  },
  {
    pathId: 'guides/deployment',
    title: 'Deployment Guide',
    content: 'How to deploy your application...',
  },
])
\`\`\`

The \`indexDocuments\` method:
1. Stores documents in SQLite with FTS5 full-text indexing
2. Chunks each document based on the configured strategy
3. Generates embeddings for every chunk
4. Stores embeddings as BLOBs alongside the chunk text

## Chunking Strategies

The feature splits documents into chunks before embedding. Choose a strategy based on your content:

### Section (default)

Splits at heading boundaries (\`## H2\`, \`### H3\`). Each section becomes a chunk, prefixed with the heading path for context. Falls back to fixed chunking if the document has no sections.

\`\`\`typescript
const search = container.feature('semanticSearch', {
  chunkStrategy: 'section',
  chunkSize: 900,  // max tokens per chunk (sections exceeding this are split at paragraphs)
})
\`\`\`

Best for: structured documents with clear heading hierarchies.

### Fixed

Splits by word count with configurable overlap between chunks:

\`\`\`typescript
const search = container.feature('semanticSearch', {
  chunkStrategy: 'fixed',
  chunkSize: 900,
  chunkOverlap: 0.15,  // 15% overlap between adjacent chunks
})
\`\`\`

Best for: unstructured prose, logs, or transcripts.

### Document

One chunk per document -- no splitting:

\`\`\`typescript
const search = container.feature('semanticSearch', {
  chunkStrategy: 'document',
})
\`\`\`

Best for: short documents where splitting would lose context.

## Search Methods

### BM25 Keyword Search

Uses SQLite FTS5 with Porter stemming for traditional keyword matching:

\`\`\`typescript
const results = await search.search('authentication tokens', {
  limit: 10,
  model: 'Guide',                        // filter by document model
  where: { status: 'published' },         // filter by metadata fields
})
\`\`\`

Returns results ranked by BM25 relevance with highlighted snippets.

### Vector Similarity Search

Embeds the query and computes cosine similarity against all stored chunk embeddings:

\`\`\`typescript
const results = await search.vectorSearch('how do users prove their identity', {
  limit: 10,
})
\`\`\`

Finds conceptually related content even without keyword overlap. Results are deduplicated by document, keeping the best-scoring chunk per document.

### Hybrid Search (Recommended)

Runs both BM25 and vector search in parallel, then fuses results using Reciprocal Rank Fusion:

\`\`\`typescript
const results = await search.hybridSearch('authentication flow', {
  limit: 10,
  model: 'Guide',
  where: { category: 'security' },
})
\`\`\`

This gives the best results for most queries -- keyword precision combined with semantic recall.

## Search Results

All search methods return \`SearchResult[]\`:

\`\`\`typescript
interface SearchResult {
  pathId: string          // document identifier
  model: string           // content model name
  title: string           // document title
  meta: Record<string, any>  // document metadata
  score: number           // relevance score
  snippet: string         // matched text excerpt
  matchedSection?: string // section heading where the match occurred
  headingPath?: string    // full heading breadcrumb (e.g. "Auth > OAuth2 > Tokens")
}
\`\`\`

## Embedding Providers

### OpenAI (default)

Uses the OpenAI embeddings API. Requires an \`openai\` client registered in the container.

\`\`\`typescript
const search = container.feature('semanticSearch', {
  embeddingProvider: 'openai',
  embeddingModel: 'text-embedding-3-small',  // 1536 dimensions
  // also available: 'text-embedding-3-large' (3072 dimensions)
})
\`\`\`

### Local (GGUF)

Runs embeddings locally using \`node-llama-cpp\` with a GGUF model file:

\`\`\`typescript
const search = container.feature('semanticSearch', {
  embeddingProvider: 'local',
  embeddingModel: 'embedding-gemma-300M-Q8_0',  // 768 dimensions
})

// Install the dependency if needed
await search.installLocalEmbeddings(process.cwd())
\`\`\`

Local models are loaded from \`~/.cache/luca/models/\` or \`~/.cache/qmd/models/\`. The model is kept in memory and automatically disposed after 5 minutes of inactivity.

## Index Management

### Incremental Updates

The feature tracks content hashes to avoid re-embedding unchanged documents:

\`\`\`typescript
// Check if a document needs re-indexing
if (search.needsReindex(doc)) {
  search.removeDocument(doc.pathId)
  await search.indexDocuments([doc])
}
\`\`\`

### Remove Stale Documents

Clean up documents that no longer exist in your collection:

\`\`\`typescript
const currentIds = ['guides/auth', 'guides/deployment']
search.removeStale(currentIds)  // deletes any indexed docs not in this list
\`\`\`

### Full Reindex

Clear everything and start fresh:

\`\`\`typescript
await search.reindex()  // clears all data
await search.indexDocuments(allDocs)  // re-index everything
\`\`\`

### Index Status

\`\`\`typescript
const stats = search.getStats()
// {
//   documentCount: 42,
//   chunkCount: 187,
//   embeddingCount: 187,
//   lastIndexedAt: '2026-03-06T...',
//   provider: 'openai',
//   model: 'text-embedding-3-small',
//   dimensions: 1536,
//   dbSizeBytes: 2457600,
// }
\`\`\`

## Database Scoping

Each provider/model combination gets its own SQLite file. If you configure \`dbPath: '.contentbase/search.sqlite'\` with the OpenAI provider and \`text-embedding-3-small\` model, the actual file will be \`.contentbase/search.openai-text-embedding-3-small.sqlite\`. This prevents dimension mismatches if you switch providers.

## ContentDb Integration Details

When using \`contentDb.buildSearchIndex()\`, the feature automatically:

- Extracts sections from your markdown documents at H2 boundaries
- Converts each document to a \`DocumentInput\` with pathId, title, meta, and sections
- Skips unchanged documents (incremental by default)
- Removes documents that no longer exist in the collection

\`\`\`typescript
const db = container.feature('contentDb', { rootPath: './docs' })
await db.load()

// Incremental update (default)
const { indexed, total } = await db.buildSearchIndex()
console.log(\`Indexed \${indexed} of \${total} documents\`)

// Force full rebuild
await db.rebuildSearchIndex()

// Check index health
console.log(db.searchIndexStatus)
\`\`\`

## Lifecycle

Always close the feature when done to release the SQLite connection and any loaded models:

\`\`\`typescript
await search.close()
\`\`\`

The feature emits events you can listen to:

\`\`\`typescript
search.on('dbReady', () => console.log('Database initialized'))
search.on('indexed', ({ documents, chunks }) => {
  console.log(\`Indexed \${documents} docs (\${chunks} chunks)\`)
})
search.on('modelLoaded', () => console.log('Local embedding model loaded'))
search.on('modelDisposed', () => console.log('Local embedding model released'))
\`\`\`
`,
  "04-features-overview.md": `---
title: Features Overview
tags: [features, built-in, fs, git, proc, vm, ui, networking, os, diskCache]
---

# Features Overview

Features are the core building blocks in Luca. A feature is a thing that emits events, has observable state, and provides an interface for doing something meaningful. The container comes with many built-in features.

## Using Features

\`\`\`typescript
// Auto-enabled features have shortcuts
container.fs          // File system
container.git         // Git operations
container.proc        // Process execution
container.vm          // JavaScript VM
container.ui          // Terminal UI
container.os          // OS info
container.networking  // Port utilities

// On-demand features are created through the factory
const cache = container.feature('diskCache', { path: './.cache' })
const db = container.feature('contentDb', { rootPath: './docs' })
\`\`\`

## Built-In Feature Reference

### fs -- File System

Read, write, and navigate the file system:

\`\`\`typescript
const fs = container.fs

// Read files (synchronous)
const content = fs.readFile('./README.md')
const json = fs.readJson('./package.json')

// Write files (async -- creates parent dirs automatically)
await fs.writeFile('./output.txt', 'Hello')

// Check existence
fs.exists('./path/to/file')

// Walk directories -- returns { files: string[], directories: string[] }
const { files } = fs.walk('./src', { include: ['*.ts'] })

// Find files upward (synchronous)
const configPath = fs.findUp('tsconfig.json')
\`\`\`

### git -- Git Operations

Work with git repositories:

\`\`\`typescript
const git = container.git

const branch = git.branch                  // Current branch name (getter)
const sha = git.sha                        // Current commit SHA (getter)
const isRepo = git.isRepo                  // Whether cwd is a git repo (getter)
const root = git.repoRoot                  // Absolute path to repo root (getter)
const files = await git.lsFiles()          // List tracked files
const recent = await git.getLatestChanges(5) // Recent commits
\`\`\`

### proc -- Process Execution

Run external processes:

\`\`\`typescript
const proc = container.proc

// Execute a command synchronously and get output as a string
const result = proc.exec('ls -la')

// Execute with options
const output = proc.exec('npm test', {
  cwd: '/path/to/project',
  env: { NODE_ENV: 'test' },
})
\`\`\`

### vm -- JavaScript VM

Execute JavaScript in an isolated context:

\`\`\`typescript
const vm = container.vm

const result = await vm.run('1 + 2 + 3')  // 6

const greeting = await vm.run('\`Hello \${name}!\`', { name: 'World' })
// 'Hello World!'

// The VM has access to the container context by default
const files = await vm.run('container.fs.walk("./src")')
\`\`\`

### ui -- Terminal UI

Colors, prompts, and formatted output:

\`\`\`typescript
const ui = container.ui

// Colors
ui.colors.green('Success!')
ui.colors.red('Error!')
ui.colors.yellow('Warning!')

// ASCII art
console.log(ui.asciiArt('My App', 'Standard'))

// Colorful ASCII banner with gradient
console.log(ui.banner('My App', { font: 'Star Wars', colors: ['red', 'white', 'blue'] }))

// Render markdown in the terminal
ui.markdown('# Hello\\n\\nThis is **bold**')
\`\`\`

### networking -- Port Utilities

\`\`\`typescript
const net = container.networking

// Find an available port (starting from a preferred port)
const port = await net.findOpenPort(3000)
\`\`\`

### os -- System Info

\`\`\`typescript
const os = container.os

os.platform   // 'darwin', 'linux', 'win32'
os.arch       // 'x64', 'arm64'
os.cpuCount   // Number of CPU cores
os.tmpdir     // Temp directory path
\`\`\`

### diskCache -- Disk-Based Cache

\`\`\`typescript
const cache = container.feature('diskCache', { path: './.cache' })

await cache.set('key', { data: 'value' })
const data = await cache.get('key')
await cache.has('key')    // true
await cache.rm('key')     // remove a cached item
\`\`\`

### contentDb -- Markdown as a Database

Turn markdown folders into queryable collections. See the dedicated [ContentBase tutorial](./11-contentbase.md).

### fileManager -- Batch File Operations

\`\`\`typescript
const fm = container.feature('fileManager')
// Batch read, write, copy, move operations
\`\`\`

### grep -- Search File Contents

\`\`\`typescript
const grep = container.grep
const results = await grep.search({ pattern: 'TODO', include: '*.ts' })
// Returns array of { file, line, column, match } objects
\`\`\`

### docker -- Docker Operations

\`\`\`typescript
const docker = container.feature('docker')
// Build, run, manage containers
\`\`\`

## Discovering Features

Don't memorize this list. You can always discover what's available at runtime:

\`\`\`typescript
// List all registered features
container.features.available

// Get documentation for any feature
container.features.describe('diskCache')

// Get docs for everything
container.features.describeAll()

// Structured introspection data for a feature's full API
container.feature('fs').introspect()
\`\`\`
`,
  "06-servers.md": `---
title: Servers
tags: [servers, express, websocket, start, stop, middleware, static]
---

# Servers

Servers are helpers that listen for connections. Luca provides Express and WebSocket servers out of the box.

## Express Server

### Basic Setup

\`\`\`typescript
const server = container.server('express', {
  port: 3000,
  cors: true,
})

await server.start()
console.log('Listening on http://localhost:3000')
\`\`\`

### With Endpoints

The most common pattern is file-based endpoints:

\`\`\`typescript
const server = container.server('express', { port: 3000, cors: true })

// Auto-discover and mount endpoint files
await server.useEndpoints('./endpoints')

// Generate OpenAPI spec
server.serveOpenAPISpec({
  title: 'My API',
  version: '1.0.0',
  description: 'An awesome API built with Luca',
})

await server.start()
\`\`\`

### Static Files

\`\`\`typescript
const server = container.server('express', {
  port: 3000,
  static: './public',  // Serve files from public/ directory
})
\`\`\`

### Port Auto-Discovery

If the requested port is taken, \`configure()\` can find an open one:

\`\`\`typescript
const server = container.server('express', { port: 3000 })
await server.configure()  // Finds port 3000 or next available
await server.start()
console.log(\`Listening on port \${server.state.get('port')}\`)
\`\`\`

### Server State

\`\`\`typescript
// After starting, check server state
await server.start()
server.state.get('listening')  // true
server.state.get('port')       // 3000

// Watch for state changes
server.state.observe((type, key, value) => {
  if (key === 'listening' && value) {
    console.log('Server is now listening')
  }
})
\`\`\`

### Accessing the Express App

For custom middleware or routes beyond file-based endpoints:

\`\`\`typescript
const server = container.server('express', { port: 3000 })

// Access the underlying express app
const app = server.app

app.use((req, res, next) => {
  console.log(\`\${req.method} \${req.url}\`)
  next()
})

app.get('/custom', (req, res) => {
  res.json({ message: 'Custom route' })
})

await server.start()
\`\`\`

## WebSocket Server

\`\`\`typescript
const ws = container.server('websocket', { port: 8080 })

ws.on('connection', (socket) => {
  console.log('Client connected')

  socket.on('message', (data) => {
    console.log('Received:', data)
    socket.send(JSON.stringify({ echo: data }))
  })
})

await ws.start()
\`\`\`

## Combining Servers

Run HTTP and WebSocket together:

\`\`\`typescript
const http = container.server('express', { port: 3000 })
const ws = container.server('websocket', { port: 8080 })

await http.useEndpoints('./endpoints')

await Promise.all([
  http.start(),
  ws.start(),
])

console.log('HTTP on :3000, WebSocket on :8080')
\`\`\`

## Discovering Servers

\`\`\`typescript
container.servers.available    // ['express', 'websocket']
container.servers.describe('express')
\`\`\`

## The \`luca serve\` Command

For most projects, you don't need to set up the server manually. The built-in \`luca serve\` command does it for you:

\`\`\`bash
luca serve --port 3000
\`\`\`

It automatically:
- Finds your \`endpoints/\` directory
- Mounts all endpoint files
- Serves \`public/\` as static files
- Generates the OpenAPI spec
- Prints all routes
`,
  "00-bootstrap.md": `---
title: "Bootstrap: Learning the Container at Runtime"
tags:
  - bootstrap
  - introspection
  - repl
  - agent
  - discovery
  - quickstart
---
# Bootstrap: Learning the Container at Runtime

You don't need to memorize the Luca API. The container tells you everything it can do — at runtime. This tutorial teaches you the discovery pattern so you can explore any feature, client, server, or command without reading docs.

## Start with \`luca eval\`

The \`eval\` command runs JavaScript with the container in scope. All features are available as top-level variables.

\`\`\`bash
# What features are available?
luca eval "container.features.available"
# => ['fs', 'git', 'proc', 'vm', 'networking', 'os', 'grep', ...]

# What clients?
luca eval "container.clients.available"

# What servers?
luca eval "container.servers.available"

# What commands?
luca eval "container.commands.available"
\`\`\`

## Describe Anything

The \`luca describe\` command generates API docs for any helper. It reads JSDoc, Zod schemas, and method signatures to produce markdown documentation.

\`\`\`bash
# Describe the container itself
luca describe

# Describe a feature
luca describe fs

# Describe multiple at once
luca describe git fs proc

# Show only specific sections
luca describe fs --methods --examples

# Describe all features
luca describe features
\`\`\`

In code, the same works via registries:

\`\`\`js
container.features.describe('fs')       // markdown docs for fs
container.features.describeAll()        // condensed overview of all features
container.clients.describe('rest')      // docs for the rest client
\`\`\`

## The Discovery Pattern

Every registry follows the same shape. Once you know the pattern, you can explore anything:

\`\`\`js
// List what's available
container.features.available
container.clients.available
container.servers.available
container.commands.available

// Get docs for a specific helper
container.features.describe('fs')
container.clients.describe('rest')
container.servers.describe('express')

// Check if something exists
container.features.has('fs')           // => true

// Get a helper instance
const fs = container.feature('fs')
const rest = container.client('rest')
\`\`\`

## Instance Introspection

Once you have a helper instance, it can describe itself:

\`\`\`js
const fs = container.feature('fs')

// Structured introspection (object with methods, getters, events, state, options)
fs.introspect()

// Human-readable markdown
fs.introspectAsText()
\`\`\`

The container itself is introspectable:

\`\`\`js
container.inspect()          // structured object with all registries, state, events
container.inspectAsText()    // full markdown overview
\`\`\`

## The REPL

For interactive exploration, use \`luca console\`. It gives you a persistent REPL with the container and all features in scope:

\`\`\`bash
luca console
\`\`\`

Inside the REPL, you can tab-complete, call methods, and explore interactively. Variables survive across lines.

## Feature Shortcuts

In eval and REPL contexts, core features are available as top-level variables — no need to call \`container.feature()\`:

\`\`\`bash
luca eval "fs.readFile('package.json')"
luca eval "git.branch"
luca eval "proc.exec('ls')"
luca eval "grep.search('.', 'TODO')"
\`\`\`

## Quick Reference

| Want to know...                | Ask                                    |
|--------------------------------|----------------------------------------|
| What registries exist?         | \`container.registries\`                 |
| What features are available?   | \`container.features.available\`         |
| Full docs for a feature?       | \`container.features.describe('fs')\`    |
| All features at a glance?      | \`container.features.describeAll()\`     |
| Structured introspection?      | \`feature.introspect()\`                 |
| What state does it have?       | \`feature.state.current\`               |
| What events does it emit?      | \`feature.introspect().events\`          |
| Full container overview?       | \`container.inspectAsText()\`            |
| CLI docs for a helper?         | \`luca describe <name>\`                 |

## Gotchas

### \`paths.join()\` vs \`paths.resolve()\`

\`container.paths.join()\` and \`container.paths.resolve()\` are Node's \`path.join\` and \`path.resolve\` curried with \`container.cwd\`. This means \`paths.join()\` always prepends \`cwd\` — even if you pass an absolute path as the first argument.

\`\`\`js
// WRONG — paths.join will prepend cwd to the absolute tmpdir path
const bad = container.paths.join(os.tmpdir, 'mydir')
// => "/your/project/tmp/mydir" (not what you want)

// RIGHT — paths.resolve respects absolute first args
const good = container.paths.resolve(os.tmpdir, 'mydir')
// => "/tmp/mydir"
\`\`\`

**Rule of thumb:** Use \`paths.join()\` for project-relative paths, \`paths.resolve()\` when the base is already absolute.

## What's Next

- [The Container](./02-container.md) — deep dive into state, events, and lifecycle
- [Scripts](./03-scripts.md) — run scripts and executable markdown notebooks
- [Features Overview](./04-features-overview.md) — explore built-in features
- [Writing Commands](./08-commands.md) — add CLI commands to your project
`,
  "08-commands.md": `---
title: Writing Commands
tags: [commands, cli, luca-cli, scripts, args]
---

# Writing Commands

Commands are CLI actions that the \`luca\` command discovers and runs. They are Helper subclasses under the hood — the framework grafts your module exports into a proper Command class at runtime, so you get the full Helper lifecycle (state, events, introspection) without ceremony.

## Basic Command

\`\`\`typescript
// commands/seed.ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Seed the database with sample data'

export const argsSchema = z.object({
  count: z.number().default(10).describe('Number of records to seed'),
  table: z.string().optional().describe('Specific table to seed'),
})

export default async function seed(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  console.log(\`Seeding \${options.count} records...\`)

  for (let i = 0; i < options.count; i++) {
    console.log(\`  Created record \${i + 1}\`)
  }

  console.log('Done.')
}
\`\`\`

Run it:

\`\`\`bash
luca seed --count 20 --table users
\`\`\`

## How Discovery Works

When you run \`luca <command>\`, the CLI:

1. Loads built-in commands (serve, run, eval, describe, etc.)
2. Loads \`luca.cli.ts\` if present (for project-level container customization)
3. Discovers project commands via the \`helpers\` feature — scans \`commands/\` for \`.ts\` files
4. Discovers user commands from \`~/.luca/commands/\`
5. The filename becomes the command name: \`commands/seed.ts\` → \`luca seed\`

Discovery routes through the \`helpers\` feature (\`container.feature('helpers')\`), which handles native import vs VM loading and deduplicates concurrent discovery calls. Commands loaded through the VM get \`container\` injected as a global.

The \`LUCA_COMMAND_DISCOVERY\` env var controls discovery: \`"disable"\` skips all, \`"no-local"\` skips project, \`"no-home"\` skips user commands.

## Command Module Patterns

### Pattern 1: Default Export Function (recommended for project commands)

The simplest pattern — export a default async function. The function becomes the command's \`run\` method.

\`\`\`typescript
// commands/greet.ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Greet someone'
export const argsSchema = z.object({
  name: z.string().default('world').describe('Who to greet'),
})

export default async function greet(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  console.log(\`Hello, \${options.name}!\`)
}
\`\`\`

### Pattern 2: Object Default Export with handler

Useful when you want to co-locate all exports in one object:

\`\`\`typescript
// commands/deploy.ts
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const argsSchema = z.object({
  env: z.enum(['staging', 'production']).describe('Target environment'),
  dryRun: z.boolean().default(false).describe('Preview without deploying'),
})

async function deploy(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context
  if (options.dryRun) {
    console.log(\`[DRY RUN] Would deploy to \${options.env}\`)
    return
  }
  console.log(\`Deploying \${container.git.sha} to \${options.env}...\`)
}

export default {
  description: 'Deploy the application',
  argsSchema,
  handler: deploy,
}
\`\`\`

### Pattern 3: registerHandler (used by built-in commands)

Built-in commands use \`commands.registerHandler()\` for explicit registration. This is the pattern used in \`src/commands/\`:

\`\`\`typescript
// src/commands/my-builtin.ts
import { z } from 'zod'
import { commands } from '../command'
import { CommandOptionsSchema } from '../schemas/base'
import type { ContainerContext } from '../container'

declare module '../command.js' {
  interface AvailableCommands {
    'my-builtin': ReturnType<typeof commands.registerHandler>
  }
}

export const argsSchema = CommandOptionsSchema.extend({
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})

export default async function myBuiltin(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  // implementation
}

commands.registerHandler('my-builtin', {
  description: 'A built-in command',
  argsSchema,
  handler: myBuiltin,
})
\`\`\`

Project commands generally don't need \`registerHandler\` — discovery handles registration automatically.

## Module Exports Reference

| Export | Type | Description |
|--------|------|-------------|
| \`default\` | function or object | Async function becomes \`run\`, or object with \`{ description, argsSchema, handler }\` |
| \`description\` | string | Help text shown in \`luca --help\` |
| \`argsSchema\` | Zod schema | Defines accepted flags, parsed from CLI args automatically |
| \`positionals\` | string[] | Names for positional arguments (mapped from \`container.argv._\`) |
| \`run\` | function | Named export alternative to default function — grafted as the command's run method |
| \`handler\` | function | Legacy alternative to \`run\` — receives parsed args via \`parseArgs()\` |

When discovery loads your module, \`graftModule()\` synthesizes a Command subclass from these exports. The \`run\` or \`handler\` function becomes the command's implementation, schemas become static properties, and any other exported functions become methods on the command instance.

## Arguments and Schemas

The \`argsSchema\` uses Zod to define what flags your command accepts. These are parsed from the CLI automatically:

\`\`\`typescript
export const argsSchema = z.object({
  // String flag: --name "John"
  name: z.string().describe('User name'),

  // Number flag: --port 3000
  port: z.number().default(3000).describe('Port number'),

  // Boolean flag: --verbose
  verbose: z.boolean().default(false).describe('Enable verbose logging'),

  // Optional flag: --output file.json
  output: z.string().optional().describe('Output file path'),

  // Enum flag: --format json
  format: z.enum(['json', 'csv', 'table']).default('table').describe('Output format'),
})
\`\`\`

### Positional Arguments

Export a \`positionals\` array to map CLI positional args into named fields on \`options\`. Each entry names the corresponding positional — \`positionals[0]\` maps \`_[1]\` (the first arg after the command name), \`positionals[1]\` maps \`_[2]\`, etc.

\`\`\`typescript
export const positionals = ['target', 'destination']

export const argsSchema = z.object({
  target: z.string().describe('Source path to operate on'),
  destination: z.string().optional().describe('Where to write output'),
})

// luca my-command ./src ./out
// => options.target === './src', options.destination === './out'
\`\`\`

Positional mapping only applies when dispatched from the CLI. For programmatic dispatch (\`cmd.dispatch({ target: './src' }, 'headless')\`), args are already named.

The raw positional array is still available as \`options._\` if you need it — \`_[0]\` is always the command name:

\`\`\`typescript
// luca greet Alice Bob
// options._ => ['greet', 'Alice', 'Bob']
\`\`\`

## Using the Container

Commands receive a context with the full container:

\`\`\`typescript
export default async function handler(options: any, context: ContainerContext) {
  const { container } = context

  // File system operations
  const config = container.fs.readJson('./config.json')

  // Git info (these are getters, not methods)
  const branch = container.git.branch
  const sha = container.git.sha

  // Terminal UI
  container.ui.colors.green('Success!')

  // Run external processes (synchronous, returns string)
  const result = container.proc.exec('ls -la')

  // Use any feature
  const cache = container.feature('diskCache', { path: './.cache' })
}
\`\`\`

## Command Dispatch

When the CLI runs a command, it calls \`cmd.dispatch()\` which:

1. Reads raw input from \`container.argv\` (or explicit args if called programmatically)
2. Validates args against \`argsSchema\` if present
3. Maps positional args if \`positionals\` is declared
4. Intercepts \`--help\` to show auto-generated help text
5. Calls \`run(parsedOptions, context)\` with the validated, typed options

You can also dispatch commands programmatically:

\`\`\`typescript
const cmd = container.command('seed')
await cmd.dispatch({ count: 20, table: 'users' }, 'headless')
\`\`\`

## Conventions

- **File location**: \`commands/<name>.ts\` in the project root. Auto-discovered by the CLI.
- **Naming**: kebab-case filenames. \`commands/build-site.ts\` → \`luca build-site\`.
- **Use the container**: Never import \`fs\`, \`path\`, \`child_process\` directly. Use \`container.feature('fs')\`, \`container.paths\`, \`container.feature('proc')\`.
- **Exit codes**: Return nothing for success. Throw for errors — the CLI catches and reports them.
- **Help text**: Use \`.describe()\` on every schema field — it powers \`luca <command> --help\`.
`,
  "14-type-system.md": `---
title: Type System and Module Augmentation
tags: [types, typescript, zod, module-augmentation, schemas, type-safety]
---

# Type System and Module Augmentation

Luca's type system ensures that as you add features, clients, servers, and commands, the container's factory methods stay fully typed. This is powered by Zod schemas and TypeScript module augmentation.

## The Pattern

When you register a new helper, you augment the corresponding interface so TypeScript knows about it:

\`\`\`typescript
import { Feature, features, FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { z } from 'zod'

// 1. Define your feature
export class MyCache extends Feature<MyCacheState, MyCacheOptions> {
  // ...
}

// 2. Register it
features.register('myCache', MyCache)

// 3. Augment the interface
declare module '@soederpop/luca' {
  interface AvailableFeatures {
    myCache: typeof MyCache
  }
}

// 4. Now fully typed everywhere:
const cache = container.feature('myCache', { ttl: 3600 })
//    ^-- TypeScript knows this is MyCache
//                                  ^-- autocomplete for MyCache options
\`\`\`

## Zod Schemas = Types + Runtime Validation

Every schema you define gives you both compile-time types and runtime validation:

\`\`\`typescript
// Define once with Zod
export const UserOptionsSchema = FeatureOptionsSchema.extend({
  apiKey: z.string().describe('API key for authentication'),
  timeout: z.number().default(5000).describe('Request timeout in ms'),
  retries: z.number().default(3).describe('Max retry attempts'),
})

// Extract the type
export type UserOptions = z.infer<typeof UserOptionsSchema>

// Use for static typing
export class UserService extends Feature<UserState, UserOptions> {
  static override optionsSchema = UserOptionsSchema

  connect() {
    // this.options is typed: { apiKey: string, timeout: number, retries: number }
    const { apiKey, timeout } = this.options
  }
}
\`\`\`

The schema also powers:
- **Runtime validation** when options are passed to the factory
- **Introspection** -- \`.describe()\` text appears in \`helper.introspect()\`
- **Documentation** -- field descriptions appear in \`container.features.describe('userService')\`

## State Typing

\`\`\`typescript
const TaskStateSchema = FeatureStateSchema.extend({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
  })).default([]),
  filter: z.enum(['all', 'active', 'done']).default('all'),
})

type TaskState = z.infer<typeof TaskStateSchema>

class TaskManager extends Feature<TaskState> {
  static override stateSchema = TaskStateSchema

  addTask(title: string) {
    const tasks = this.state.get('tasks')
    //    ^-- typed as Array<{ id: string, title: string, done: boolean }>

    this.state.set('tasks', [...(tasks || []), { id: '1', title, done: false }])
    //                       ^-- TypeScript validates the shape
  }
}
\`\`\`

## Module Augmentation for All Helper Types

The pattern is the same for features, clients, servers, and commands:

\`\`\`typescript
// Features
declare module '@soederpop/luca' {
  interface AvailableFeatures {
    myFeature: typeof MyFeature
  }
}

// Clients
declare module '@soederpop/luca' {
  interface AvailableClients {
    myClient: typeof MyClient
  }
}

// Servers
declare module '@soederpop/luca' {
  interface AvailableServers {
    myServer: typeof MyServer
  }
}

// Commands
declare module '@soederpop/luca' {
  interface AvailableCommands {
    myCommand: typeof MyCommand
  }
}
\`\`\`

## Using .describe() Effectively

\`\`\`typescript
const ConfigSchema = z.object({
  host: z.string().describe('Database hostname or IP address'),
  port: z.number().default(5432).describe('Database port'),
  database: z.string().describe('Database name to connect to'),
  ssl: z.boolean().default(false).describe('Whether to use SSL/TLS for the connection'),
  pool: z.object({
    min: z.number().default(2).describe('Minimum connections to keep open'),
    max: z.number().default(10).describe('Maximum connections allowed'),
  }).describe('Connection pool configuration'),
})
\`\`\`

These descriptions are not just for humans reading the code -- they show up in:
- \`container.features.describe('db')\` output
- \`container.features.introspect('db')\` data
- OpenAPI specs when used in endpoint schemas
- AI agent tool descriptions

## The Full Typed Flow

\`\`\`typescript
// 1. You define a feature with schemas
export class Analytics extends Feature<AnalyticsState, AnalyticsOptions> { ... }

// 2. You register + augment
features.register('analytics', Analytics)
declare module '@soederpop/luca' {
  interface AvailableFeatures { analytics: typeof Analytics }
}

// 3. Now every interaction is typed:
const a = container.feature('analytics', { trackingId: 'UA-123' })
//    ^-- Analytics instance     ^-- autocomplete: 'analytics'
//                                         ^-- type error if wrong options

a.state.get('pageViews')  // typed by AnalyticsState
a.on('pageView', ...)     // typed by event definitions
a.track('click', { ... }) // typed by Analytics methods
\`\`\`

This is the core principle: **never break the type system.** Every step of \`container.feature('name', options)\` should give you autocomplete, type checking, and documentation.
`,
  "02-container.md": `---
title: The Container
tags: [container, singleton, state, events, registries, dependency-injection]
---

# The Container

The container is the heart of every Luca application. It is a per-process singleton that provides:

- **Dependency injection** via factory methods and registries
- **Observable state** that you can watch for changes
- **Event bus** for decoupled communication
- **Registries** for discovering available helpers

## Getting the Container

\`\`\`typescript
import container from '@soederpop/luca'
\`\`\`

The import resolves automatically based on environment -- \`@soederpop/luca\` gives you a \`NodeContainer\` on the server and a \`WebContainer\` in browser builds. You can also be explicit:

\`\`\`typescript
import container from '@soederpop/luca/node'  // Always NodeContainer
import container from '@soederpop/luca/web'   // Always WebContainer
\`\`\`

The NodeContainer comes pre-loaded with registries for features, clients, servers, commands, and endpoints. Core features like \`fs\`, \`git\`, \`proc\`, \`os\`, \`networking\`, \`ui\`, and \`vm\` are auto-enabled.

## Registries

Every helper type has a registry. Registries let you discover what's available and create instances:

\`\`\`typescript
// What features are available?
container.features.available
// => ['fs', 'git', 'proc', 'vm', 'ui', 'networking', 'os', 'diskCache', 'contentDb', ...]

// Get documentation for a feature
container.features.describe('fs')

// Get documentation for all features
container.features.describeAll()

// Check if something is registered
container.features.has('diskCache')

// Same pattern for all helper types:
container.servers.available    // ['express', 'websocket']
container.clients.available    // ['rest', 'graph', 'websocket']
container.commands.available   // ['serve', 'run', ...]
\`\`\`

## Factory Methods

Create helper instances through the container's factory methods:

\`\`\`typescript
// Features (cached by id + options hash)
const fs = container.feature('fs')
const cache = container.feature('diskCache', { path: './cache' })

// Servers
const server = container.server('express', { port: 3000, cors: true })

// Clients
const api = container.client('rest', { baseURL: 'https://api.example.com' })
\`\`\`

Factory results are **cached**. Calling \`container.feature('fs')\` twice returns the same instance. Different options produce different instances.

## Enabled Features (Shortcuts)

Some features are "enabled" on the container, giving them shortcut access:

\`\`\`typescript
// These are equivalent:
container.feature('fs')
container.fs

// Auto-enabled features:
container.fs           // File system
container.git          // Git operations
container.proc         // Process execution
container.vm           // JavaScript VM
container.ui           // Terminal UI
container.os           // OS info
container.networking   // Port finding, availability
\`\`\`

To enable your own feature:

\`\`\`typescript
const myFeature = container.feature('myFeature', { enable: true })
// Now accessible as container.myFeature
\`\`\`

## Observable State

The container (and every helper) has observable state:

\`\`\`typescript
// Set state
container.state.set('ready', true)

// Get state
container.state.get('ready') // true

// Get a snapshot of all state
container.state.current

// Observe all changes (changeType is 'add' | 'update' | 'delete')
container.state.observe((changeType, key, value) => {
  console.log(\`\${key} \${changeType}:\`, value)
})

// State has a version counter
container.state.version // increments on every change
\`\`\`

## Event Bus

The container has a built-in event bus for decoupled communication:

\`\`\`typescript
// Listen for events
container.on('featureEnabled', (featureName) => {
  console.log(\`\${featureName} was enabled\`)
})

// Emit events
container.emit('myCustomEvent', { some: 'data' })

// One-time listener
container.once('ready', () => console.log('Container is ready'))

// Wait for an event (promise-based)
await container.waitFor('ready')
\`\`\`

## Plugins and \`.use()\`

Extend the container with the \`.use()\` method:

\`\`\`typescript
// Enable a feature by name
container.use('diskCache')

// Attach a plugin
container.use(MyPlugin)
\`\`\`

A plugin is any class with a static \`attach(container)\` method:

\`\`\`typescript
class MyPlugin {
  static attach(container) {
    // Add registries, factories, whatever you need
    container.myThing = new MyThing(container)
    return container
  }
}
\`\`\`

## Utilities

The container provides common utilities so you don't need extra dependencies:

\`\`\`typescript
container.utils.uuid()                          // Generate a v4 UUID
container.utils.hashObject({ foo: 'bar' })      // Deterministic hash
container.utils.stringUtils.camelCase('my-var')  // 'myVar'
container.utils.stringUtils.kebabCase('MyVar')   // 'my-var'
container.utils.stringUtils.pluralize('feature') // 'features'

// Lodash utilities
const { uniq, groupBy, keyBy, debounce, throttle } = container.utils.lodash
\`\`\`

## Path Utilities

\`\`\`typescript
container.paths.resolve('relative/path')    // Resolve from cwd
container.paths.join('a', 'b', 'c')         // Join path segments
container.paths.relative('/absolute/path')  // Make relative to cwd
\`\`\`

## Package Manifest

Access the project's package.json:

\`\`\`typescript
container.manifest.name        // "my-app"
container.manifest.version     // "0.1.0"
container.manifest.dependencies
\`\`\`

## Introspection

Discover everything about the container at runtime:

\`\`\`typescript
// Structured introspection data
const info = container.inspect()

// Human-readable markdown
const docs = container.inspectAsText()
\`\`\`

This is what makes Luca especially powerful for AI agents -- they can discover the entire API surface at runtime without reading documentation.
`,
  "20-browser-esm.md": `---
title: "Browser: Import Luca from esm.sh"
tags:
  - browser
  - esm
  - web
  - quickstart
  - cdn
---
# Browser: Import Luca from esm.sh

You can use Luca in any browser environment — no bundler, no build step. Import it from [esm.sh](https://esm.sh) and you get the singleton container on \`window.luca\`, ready to go. All the same APIs apply.

## Basic Setup

\`\`\`html
<script type="module">
  import "https://esm.sh/@soederpop/luca/web"

  const container = window.luca
  console.log(container.uuid) // unique container ID
  console.log(container.features.available) // ['assetLoader', 'voice', 'speech', 'network', 'vault', 'vm', 'esbuild', 'helpers', 'containerLink']
</script>
\`\`\`

The import triggers module evaluation, which creates the \`WebContainer\` singleton and attaches it to \`window.luca\`. That's it.

If you prefer a named import:

\`\`\`html
<script type="module">
  import container from "https://esm.sh/@soederpop/luca/web"
  // container === window.luca
</script>
\`\`\`

## Using Features

Once you have the container, features work exactly like they do on the server — lazy-loaded via \`container.feature()\`.

\`\`\`html
<script type="module">
  import "https://esm.sh/@soederpop/luca/web"
  const { luca: container } = window

  // Load a script from a CDN
  const assetLoader = container.feature('assetLoader')
  await assetLoader.loadScript('https://cdn.jsdelivr.net/npm/chart.js')

  // Load a stylesheet
  await assetLoader.loadStylesheet('https://cdn.jsdelivr.net/npm/water.css@2/out/water.css')

  // Text-to-speech
  const speech = container.feature('speech')
  speech.speak('Hello from Luca')

  // Voice recognition
  const voice = container.feature('voice')
  voice.on('transcript', ({ text }) => console.log('Heard:', text))
  voice.start()
</script>
\`\`\`

## State and Events

The container is a state machine and event bus. This works identically to the server.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/@soederpop/luca/web"

  // Listen for state changes
  container.on('stateChanged', ({ changes }) => {
    console.log('State changed:', changes)
  })

  // Feature-level state and events
  const voice = container.feature('voice')
  voice.on('stateChanged', ({ changes }) => {
    document.getElementById('status').textContent = changes.listening ? 'Listening...' : 'Idle'
  })
</script>
\`\`\`

## REST Client

Make HTTP requests with the built-in REST client. Methods return parsed JSON directly.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/@soederpop/luca/web"

  const api = container.client('rest', { baseURL: 'https://jsonplaceholder.typicode.com' })
  const posts = await api.get('/posts')
  console.log(posts) // array of post objects, not a Response wrapper
</script>
\`\`\`

## WebSocket Client

Connect to a WebSocket server:

\`\`\`html
<script type="module">
  import container from "https://esm.sh/@soederpop/luca/web"

  const socket = container.client('socket', { url: 'ws://localhost:3000' })
  socket.on('message', (data) => console.log('Received:', data))
  socket.send({ type: 'hello' })
</script>
\`\`\`

## Extending: Custom Features

The container exposes the \`Feature\` class directly, so you can create your own features without any additional imports.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/@soederpop/luca/web"

  const { Feature } = container

  class Theme extends Feature {
    static shortcut = 'features.theme'
    static { Feature.register(this, 'theme') }

    get current() {
      return this.state.get('mode') || 'light'
    }

    toggle() {
      const next = this.current === 'light' ? 'dark' : 'light'
      this.state.set('mode', next)
      document.documentElement.setAttribute('data-theme', next)
      this.emit('themeChanged', { mode: next })
    }
  }

  const theme = container.feature('theme')
  theme.on('themeChanged', ({ mode }) => console.log('Theme:', mode))
  theme.toggle() // => Theme: dark
</script>
\`\`\`

## Utilities

The container's built-in utilities are available in the browser too.

\`\`\`html
<script type="module">
  import container from "https://esm.sh/@soederpop/luca/web"

  // UUID generation
  const id = container.utils.uuid()

  // Lodash helpers
  const { groupBy, keyBy, pick } = container.utils.lodash

  // String utilities
  const { camelCase, kebabCase } = container.utils.stringUtils
</script>
\`\`\`

## Full Example: A Minimal App

\`\`\`html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Luca Browser Demo</title>
</head>
<body>
  <h1>Luca Browser Demo</h1>
  <button id="speak">Speak</button>
  <button id="theme">Toggle Theme</button>
  <pre id="output"></pre>

  <script type="module">
    import container from "https://esm.sh/@soederpop/luca/web"

    const log = (msg) => {
      document.getElementById('output').textContent += msg + '\\n'
    }

    // Load a stylesheet
    const assets = container.feature('assetLoader')
    await assets.loadStylesheet('https://cdn.jsdelivr.net/npm/water.css@2/out/water.css')

    // Custom feature
    const { Feature } = container

    class Theme extends Feature {
      static shortcut = 'features.theme'
      static { Feature.register(this, 'theme') }

      toggle() {
        const next = (this.state.get('mode') || 'light') === 'light' ? 'dark' : 'light'
        this.state.set('mode', next)
        document.documentElement.style.colorScheme = next
        this.emit('themeChanged', { mode: next })
      }
    }

    const theme = container.feature('theme')
    theme.on('themeChanged', ({ mode }) => log(\`Theme: \${mode}\`))

    // Speech
    const speech = container.feature('speech')

    document.getElementById('speak').onclick = () => speech.speak('Hello from Luca')
    document.getElementById('theme').onclick = () => theme.toggle()

    log(\`Container ID: \${container.uuid}\`)
    log(\`Features: \${container.features.available.join(', ')}\`)
  </script>
</body>
</html>
\`\`\`

Save this as an HTML file, open it in a browser, and everything works — no npm, no bundler, no build step.

## Gotchas

- **esm.sh caches aggressively.** Pin a version if you need stability: \`https://esm.sh/@soederpop/luca@0.0.29/web\`
- **Browser features only.** The web container doesn't include node-specific features like \`fs\`, \`git\`, \`proc\`, or \`docker\`. If you need server features, run Luca on the server and connect via the REST or WebSocket clients.
- **\`window.luca\` is the singleton.** Don't call \`createContainer()\` — it just warns and returns the same instance. If you need isolation, use \`container.subcontainer()\`.
- **CORS applies.** REST client requests from the browser are subject to browser CORS rules. Your API must send the right headers.

## What's Next

- [State and Events](./05-state-and-events.md) — deep dive into the state machine and event bus (works identically in the browser)
- [Creating Features](./10-creating-features.md) — full anatomy of a feature with schemas, state, and events
- [Clients](./09-clients.md) — REST and WebSocket client APIs
`,
  "15-project-patterns.md": `---
title: Project Patterns and Recipes
tags: [patterns, recipes, examples, architecture, full-stack, best-practices]
---

# Project Patterns and Recipes

Common patterns for building applications with Luca.

## Pattern: REST API with File-Based Routing

The most common Luca project -- a JSON API with automatic OpenAPI docs.

\`\`\`
my-api/
├── package.json
├── endpoints/
│   ├── health.ts
│   ├── users.ts
│   └── users/[id].ts
├── commands/
│   └── seed.ts
└── public/
    └── index.html
\`\`\`

\`\`\`json
// package.json
{
  "name": "my-api",
  "scripts": {
    "dev": "luca serve",
    "seed": "luca seed"
  },
  "dependencies": {
    "@soederpop/luca": "latest",
    "zod": "^3.24.0"
  }
}
\`\`\`

Start with \`bun run dev\`. OpenAPI spec auto-generated at \`/openapi.json\`.

## Pattern: CLI Tool

A project that's primarily a set of CLI commands.

\`\`\`
my-tool/
├── package.json
├── commands/
│   ├── init.ts
│   ├── build.ts
│   ├── deploy.ts
│   └── status.ts
└── lib/
    └── helpers.ts
\`\`\`

\`\`\`bash
luca init --template react
luca build --minify
luca deploy --env production
luca status
\`\`\`

## Pattern: AI-Powered App

An API with an AI assistant behind it.

\`\`\`
ai-app/
├── package.json
├── endpoints/
│   ├── health.ts
│   ├── ask.ts           # Proxies to the assistant
│   └── conversations.ts # List/manage conversations
├── assistants/
│   └── helper/
│       ├── CORE.md
│       ├── tools.ts
│       ├── hooks.ts
│       └── docs/
│           ├── product-info.md
│           ├── faq.md
│           └── policies.md
└── public/
    └── index.html       # Chat UI
\`\`\`

The endpoint creates the assistant and forwards questions:

\`\`\`typescript
// endpoints/ask.ts
import { z } from 'zod'
import type { EndpointContext } from '@soederpop/luca'

export const path = '/api/ask'
export const postSchema = z.object({
  question: z.string(),
  conversationId: z.string().optional(),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const assistant = ctx.container.feature('assistant', {
    folder: 'assistants/helper',
    model: 'gpt-4o',
  })

  const answer = await assistant.ask(params.question)
  return { answer }
}
\`\`\`

## Pattern: Content-Driven Site

Using contentbase to power a documentation site or blog.

\`\`\`
docs-site/
├── package.json
├── content/
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── configuration.md
│   │   └── deployment.md
│   └── reference/
│       ├── api.md
│       └── cli.md
├── endpoints/
│   ├── docs.ts          # Query and serve content
│   └── search.ts        # Full-text search over content
└── public/
    └── index.html
\`\`\`

\`\`\`typescript
// endpoints/docs.ts
import { z } from 'zod'
import type { EndpointContext } from '@soederpop/luca'

export const path = '/api/docs'
export const getSchema = z.object({
  section: z.string().optional(),
})

export async function get(params: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const db = ctx.container.feature('contentDb', { rootPath: './content' })
  await db.load()
  // ... query and return content
}
\`\`\`

## Pattern: Automation Script Suite

A collection of scripts for DevOps or data tasks.

\`\`\`
automation/
├── package.json
├── scripts/
│   ├── backup-db.ts
│   ├── sync-data.ts
│   ├── generate-report.ts
│   └── cleanup-old-files.ts
└── config.json
\`\`\`

\`\`\`bash
luca run scripts/backup-db.ts
luca run scripts/sync-data.ts --since 2024-01-01
luca run scripts/generate-report.ts --format pdf
\`\`\`

## Pattern: Feature Composition

Build complex features by composing simpler ones:

\`\`\`typescript
class NotificationService extends Feature<NotifState, NotifOptions> {
  private cache: any
  private api: any

  async initialize() {
    // Compose other features
    this.cache = this.container.feature('diskCache', { path: './.notif-cache' })
    this.api = this.container.client('rest', {
      baseURL: this.options.webhookUrl,
    })
    await this.api.connect()
  }

  async send(channel: string, message: string) {
    // Check rate limiting via cache
    const key = \`ratelimit:\${channel}\`
    if (await this.cache.has(key)) {
      this.emit('rateLimited', { channel })
      return
    }

    // Send via API client
    await this.api.post('/send', { channel, message })
    await this.cache.set(key, true, { ttl: 60 })

    this.emit('sent', { channel, message })
  }
}
\`\`\`

## Best Practices

1. **Use file-based conventions** -- endpoints in \`endpoints/\`, commands in \`commands/\`, assistants in \`assistants/\`. This is the Luca way.

2. **Let the container own your dependencies** -- instead of importing libraries directly, use features and clients. This gives you introspection, state management, and events for free.

3. **Keep endpoints thin** -- endpoints should validate input and delegate to features. Business logic belongs in features, not route handlers.

4. **Compose features** -- build complex behavior by combining simpler features. Each feature should do one thing well.

5. **Use Zod everywhere** -- for endpoint schemas, feature options, state definitions. It gives you types, validation, and documentation in one place.

6. **Document with JSDoc** -- Luca's introspection system extracts it. Your documentation IS your code.
`,
  "05-state-and-events.md": `---
title: State and Events
tags: [state, events, observable, reactive, bus, emit, on, once, waitFor]
---

# State and Events

Every container and helper in Luca has observable state and a typed event bus. These are the core primitives for building reactive applications.

## Observable State

State is a key-value store that notifies observers when values change.

### Basic Usage

\`\`\`typescript
// Every helper has state
const feature = container.feature('myFeature')

feature.state.set('loading', true)
feature.state.get('loading')      // true
feature.state.current              // Snapshot: { loading: true, ... }
feature.state.version              // Number, increments on every change
\`\`\`

### Observing Changes

\`\`\`typescript
// Watch all state changes
const dispose = feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
  console.log(\`\${key} was \${changeType}d:\`, value)
})

// Later, stop observing
dispose()
\`\`\`

### Container State

The container itself tracks important state:

\`\`\`typescript
container.state.get('started')           // boolean
container.state.get('enabledFeatures')   // string[]
container.state.get('registries')        // string[]
\`\`\`

### State in Custom Features

Define your feature's state shape with a Zod schema:

\`\`\`typescript
const TaskStateSchema = FeatureStateSchema.extend({
  tasks: z.array(z.object({
    id: z.string(),
    title: z.string(),
    done: z.boolean(),
  })).default([]).describe('List of tasks'),
  filter: z.enum(['all', 'active', 'done']).default('all').describe('Current filter'),
})

class TaskManager extends Feature<z.infer<typeof TaskStateSchema>> {
  static override stateSchema = TaskStateSchema

  addTask(title: string) {
    const tasks = this.state.get('tasks') || []
    const task = { id: crypto.randomUUID(), title, done: false }
    this.state.set('tasks', [...tasks, task])
    this.emit('taskAdded', task)
  }

  get activeTasks() {
    return (this.state.get('tasks') || []).filter(t => !t.done)
  }
}
\`\`\`

## Event Bus

The event bus enables decoupled communication between components.

### Emitting and Listening

\`\`\`typescript
// Listen for an event
feature.on('taskCompleted', (task) => {
  console.log(\`Task "\${task.title}" is done!\`)
})

// Emit an event
feature.emit('taskCompleted', { id: '1', title: 'Write docs', done: true })
\`\`\`

### One-Time Listeners

\`\`\`typescript
feature.once('initialized', () => {
  console.log('Feature is ready (this runs once)')
})
\`\`\`

### Waiting for Events (Promise-Based)

\`\`\`typescript
// Block until an event fires
await feature.waitFor('ready')
console.log('Feature is now ready')

// Useful for initialization sequences
const server = container.server('express', { port: 3000 })
await server.start()
console.log('Server is accepting connections on port', server.state.get('port'))
\`\`\`

### Container Events

The container emits events for lifecycle moments:

\`\`\`typescript
container.on('featureEnabled', (featureId, feature) => {
  console.log(\`Feature \${featureId} was enabled\`)
})
\`\`\`

## Patterns

### Coordinating Between Features

\`\`\`typescript
const auth = container.feature('auth')
const analytics = container.feature('analytics')

// Analytics reacts to auth events
auth.on('userLoggedIn', (user) => {
  analytics.logEvent('login', { userId: user.id })
})

auth.on('userLoggedOut', (user) => {
  analytics.logEvent('logout', { userId: user.id })
})
\`\`\`

### State-Driven UI Updates

\`\`\`typescript
const cart = container.feature('cart')

cart.state.observe((type, key, value) => {
  if (key === 'items') {
    renderCartBadge(value.length)
  }
  if (key === 'total') {
    renderCartTotal(value)
  }
})
\`\`\`

### Initialization Gates

\`\`\`typescript
// Wait for multiple features to be ready
await Promise.all([
  container.feature('db').waitFor('connected'),
  container.feature('cache').waitFor('ready'),
  container.feature('auth').waitFor('initialized'),
])

console.log('All systems ready, starting server...')
await container.server('express', { port: 3000 }).start()
\`\`\`
`,
  "11-contentbase.md": `---
title: Contentbase - Markdown as a Database
tags: [contentbase, contentdb, markdown, database, models, query, collections]
---

# Contentbase - Markdown as a Database

Contentbase lets you treat folders of markdown files as queryable database collections. Define models with Zod schemas, extract structured data from frontmatter and content, and query it with a fluent API.

## Setup

\`\`\`typescript
import container from '@soederpop/luca'

const db = container.feature('contentDb', { rootPath: './content' })
const { defineModel, section, hasMany, belongsTo } = db.library
\`\`\`

## Directory Structure

\`\`\`
content/
├── posts/
│   ├── hello-world.md
│   ├── getting-started.md
│   └── advanced-tips.md
├── authors/
│   ├── alice.md
│   └── bob.md
└── tags/
    ├── javascript.md
    └── typescript.md
\`\`\`

## Defining Models

Models map to subdirectories and define the shape of your content:

\`\`\`typescript
import { z } from 'zod'

const Post = defineModel('Post', {
  // Maps to content/posts/
  prefix: 'posts',

  // Frontmatter schema
  meta: z.object({
    title: z.string(),
    date: z.string(),
    status: z.enum(['draft', 'published', 'archived']),
    author: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),

  // Extract structured data from the markdown body
  sections: {
    summary: section('Summary', {
      extract: (query) => query.select('paragraph')?.toString() || '',
      schema: z.string(),
    }),
    codeExamples: section('Code Examples', {
      extract: (query) => query.selectAll('code').map((n: any) => n.toString()),
      schema: z.array(z.string()),
    }),
  },

  // Relationships
  relationships: {
    author: belongsTo(() => Author, { key: 'meta.author' }),
    tags: hasMany(() => Tag, { heading: 'Tags' }),
  },
})

const Author = defineModel('Author', {
  prefix: 'authors',
  meta: z.object({
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['writer', 'editor', 'admin']),
  }),
  relationships: {
    posts: hasMany(() => Post, { foreignKey: 'meta.author' }),
  },
})
\`\`\`

## Registering and Loading

\`\`\`typescript
db.register(Post)
db.register(Author)
await db.load()  // Parses all markdown files and builds the queryable index
\`\`\`

## Querying

Contentbase provides a fluent query API:

\`\`\`typescript
// Fetch all posts
const allPosts = await db.query(Post).fetchAll()

// Filter by frontmatter fields
const published = await db.query(Post)
  .where('meta.status', 'published')
  .fetchAll()

// Multiple filters
const recentPosts = await db.query(Post)
  .where('meta.status', 'published')
  .where('meta.tags', 'includes', 'javascript')
  .fetchAll()

// Get a single document by slug (filename without .md)
const post = await db.query(Post).find('hello-world')
\`\`\`

## Markdown File Format

Each markdown file has YAML frontmatter and a body:

\`\`\`markdown
---
title: Hello World
date: 2024-01-15
status: published
author: alice
tags: [javascript, tutorial]
---

# Hello World

This is the post content.

## Summary

A brief introduction to our blog.

## Code Examples

\\\`\\\`\\\`javascript
console.log('Hello!')
\\\`\\\`\\\`
\`\`\`

## Use Cases

- **Documentation sites** -- query and render docs with frontmatter metadata
- **Blog engines** -- posts with authors, tags, categories
- **Knowledge bases** -- structured content with relationships
- **Project management** -- epics, stories, tasks as markdown with status tracking
- **Configuration** -- human-readable config files that are also queryable

## Full Example: Blog Engine

\`\`\`typescript
import container from '@soederpop/luca'
import { z } from 'zod'

const db = container.feature('contentDb', { rootPath: './blog' })
const { defineModel, section, hasMany } = db.library

const Post = defineModel('Post', {
  prefix: 'posts',
  meta: z.object({
    title: z.string(),
    date: z.string(),
    status: z.enum(['draft', 'published']),
    tags: z.array(z.string()).default([]),
  }),
  sections: {
    excerpt: section('Excerpt', {
      extract: (q) => q.select('paragraph')?.toString() || '',
      schema: z.string(),
    }),
  },
})

db.register(Post)
await db.load()

// Get published posts for the homepage
const posts = await db.query(Post)
  .where('meta.status', 'published')
  .fetchAll()

for (const post of posts) {
  console.log(\`\${post.meta.title} (\${post.meta.date})\`)
  console.log(\`  \${post.sections.excerpt}\`)
}
\`\`\`
`,
  "12-assistants.md": `---
title: Building Assistants
tags: [assistants, ai, openai, tools, hooks, conversation, CORE.md]
---

# Building Assistants

Assistants are AI-powered conversational agents defined by a file-based convention. Each assistant lives in its own folder with a system prompt, tools, hooks, and documentation.

## Directory Structure

\`\`\`
assistants/my-assistant/
├── CORE.md           # System prompt (required)
├── tools.ts          # Tool definitions with Zod schemas
├── hooks.ts          # Lifecycle event handlers
└── docs/             # Internal documentation the assistant can search
    ├── guide.md
    └── faq.md
\`\`\`

## CORE.md -- The System Prompt

This is the assistant's personality and instructions. It's a markdown file that becomes the system message:

\`\`\`markdown
# Customer Support Assistant

You are a helpful customer support agent for Acme Corp. You help users with
billing questions, account issues, and product information.

Always research internal docs before answering product questions.
Be polite and concise.
\`\`\`

## tools.ts -- Tool Definitions

Define functions that the assistant can call. Each tool has a Zod schema describing its parameters:

\`\`\`typescript
const { z } = require('zod')

async function lookupOrder({ orderId }) {
  // In a real app, query your database
  return {
    orderId,
    status: 'shipped',
    trackingNumber: 'ABC123',
    estimatedDelivery: '2024-01-20',
  }
}

async function createTicket({ subject, priority, description }) {
  // Create a support ticket
  const ticketId = \`TICKET-\${Date.now()}\`
  return {
    ticketId,
    subject,
    priority,
    message: \`Ticket \${ticketId} created successfully\`,
  }
}

async function searchProducts({ query, category }) {
  // Search product catalog
  return {
    results: [
      { name: 'Widget Pro', price: 29.99, inStock: true },
      { name: 'Widget Lite', price: 19.99, inStock: false },
    ],
  }
}

const schemas = {
  lookupOrder: z.object({
    orderId: z.string().describe('The order ID to look up'),
  }).describe('Look up an order by its ID to get status and tracking info'),

  createTicket: z.object({
    subject: z.string().describe('Brief ticket subject line'),
    priority: z.enum(['low', 'medium', 'high']).describe('Ticket priority'),
    description: z.string().describe('Detailed description of the issue'),
  }).describe('Create a new support ticket'),

  searchProducts: z.object({
    query: z.string().describe('Search terms'),
    category: z.string().optional().describe('Product category filter'),
  }).describe('Search the product catalog'),
}

module.exports = { lookupOrder, createTicket, searchProducts, schemas }
\`\`\`

**Important:** The function name must match the key in the \`schemas\` object. The \`.describe()\` on the schema object itself becomes the tool description that the AI model sees.

## hooks.ts -- Lifecycle Hooks

React to assistant events:

\`\`\`typescript
function started() {
  console.log('[assistant] Session started')
}

function response(text) {
  // Called when the assistant produces a text response
  console.log(\`[assistant] \${text.slice(0, 100)}...\`)
}

function toolCall(name, args) {
  // Called before a tool is executed
  console.log(\`[assistant] Calling tool: \${name}\`, args)
}

function error(err) {
  console.error('[assistant] Error:', err.message)
}

module.exports = { started, response, toolCall, error }
\`\`\`

## docs/ -- Internal Documentation

The \`docs/\` folder contains markdown files that the assistant can search using the built-in \`researchInternalDocs\` tool. This is automatically injected -- you don't need to define it in tools.ts.

\`\`\`
docs/
├── billing-faq.md
├── product-catalog.md
├── return-policy.md
└── troubleshooting.md
\`\`\`

In CORE.md, instruct the assistant to use it:

\`\`\`markdown
When asked about products, billing, or policies, always use the
researchInternalDocs tool first to find accurate information before answering.
\`\`\`

## Using the Assistant

### In a Script

\`\`\`typescript
import container from '@soederpop/luca'

const assistant = container.feature('assistant', {
  folder: 'assistants/my-assistant',
  model: 'gpt-4o',
})

// Ask a question
const answer = await assistant.ask('What is the return policy?')
console.log(answer)

// Multi-turn conversation
const follow = await assistant.ask('And how long does the refund take?')
console.log(follow)

// Save the conversation
await assistant.save({ title: 'Return policy inquiry' })
\`\`\`

### In an Endpoint

Expose the assistant as an API:

\`\`\`typescript
// endpoints/ask.ts
import { z } from 'zod'
import type { EndpointContext } from '@soederpop/luca'

export const path = '/api/ask'
export const description = 'Ask the support assistant a question'
export const tags = ['assistant']

export const postSchema = z.object({
  question: z.string().describe('Your question'),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const assistant = ctx.container.feature('assistant', {
    folder: 'assistants/my-assistant',
    model: 'gpt-4o',
  })

  const answer = await assistant.ask(params.question)
  return { answer }
}
\`\`\`

### Streaming Responses

\`\`\`typescript
const assistant = container.feature('assistant', {
  folder: 'assistants/my-assistant',
  model: 'gpt-4o',
})

// Listen for chunks as they arrive
assistant.on('chunk', (text) => {
  process.stdout.write(text)
})

await assistant.ask('Explain quantum computing')
\`\`\`

## Best Practices

1. **Write focused CORE.md prompts** -- tell the assistant exactly what it is and what it should/shouldn't do
2. **Keep tools simple** -- each tool should do one thing. The AI model is better at composing simple tools than using complex ones
3. **Use docs/ liberally** -- put all reference material in docs/ so the assistant can look things up rather than relying on the model's training data
4. **Use Zod \`.describe()\`** -- the descriptions on schemas and fields are what the model sees to decide when and how to call tools
5. **Test with real questions** -- ask the assistant the kinds of things real users will ask
`,
  "03-scripts.md": `---
title: Running Scripts and Markdown Notebooks
tags: [scripts, luca-run, automation, bun, standalone, markdown, codeblocks, notebook]
---

# Running Scripts and Markdown Notebooks

\`luca run\` executes TypeScript/JavaScript files and markdown files. This is often the fastest way to try out Luca features, automate tasks, or build runnable documentation.

## Running a TypeScript Script

\`\`\`bash
luca run scripts/hello.ts
\`\`\`

\`\`\`typescript
// scripts/hello.ts
import container from '@soederpop/luca'

console.log('Available features:', container.features.available)
console.log('Git branch:', container.git.branch)
console.log('OS:', container.os.platform, container.os.arch)
\`\`\`

The extension is optional -- \`luca run scripts/hello\` tries \`.ts\`, \`.js\`, and \`.md\` automatically.

## Running Markdown Files

This is one of Luca's most useful features. \`luca run\` can execute markdown files as runnable notebooks. It walks through the document, renders the prose to the terminal, and executes each \`ts\` or \`js\` fenced codeblock in sequence. All blocks share the same VM context, so variables defined in one block are available in the next.

\`\`\`bash
luca run docs/tutorial.md
\`\`\`

### How It Works

Given a markdown file like this:

\`\`\`\`markdown
# Setup Tutorial

First, let's see what's available (container is provided automatically):

\`\`\`ts
console.log(container.features.available)
\`\`\`

Now let's use the file system feature:

\`\`\`ts
const { files } = container.fs.walk('./src', { include: ['*.ts'] })
console.log(\`Found \${files.length} TypeScript files\`)
\`\`\`

This block won't run because it's Python:

\`\`\`python
print("I'm skipped -- only ts and js blocks run")
\`\`\`
\`\`\`\`

When you run \`luca run docs/tutorial.md\`, it:

1. Renders "# Setup Tutorial" and the prose as formatted markdown in your terminal
2. Displays the first codeblock, then executes it
3. Renders the next paragraph
4. Displays and executes the second codeblock (which can reference \`container\` from block 1)
5. Skips the Python block entirely (only \`ts\` and \`js\` blocks execute)

### Skipping Blocks

Add \`skip\` in the code fence meta to prevent a block from running:

\`\`\`\`markdown
\`\`\`ts skip
// This block is shown but NOT executed
dangerousOperation()
\`\`\`
\`\`\`\`

### Safe Mode

Use \`--safe\` to require manual approval before each block runs:

\`\`\`bash
luca run docs/tutorial.md --safe
\`\`\`

The runner will prompt "Run this block? (y/n)" before executing each codeblock. Great for walkthroughs where you want to pause and observe.

### Shared Context

All codeblocks in a markdown file share a VM context. The context includes \`console\` and the full container context, so you can use container features without importing:

\`\`\`\`markdown
\`\`\`ts
// Block 1: container is already available in the context
const { files } = container.fs.walk('./src')
\`\`\`

\`\`\`ts
// Block 2: \`files\` from block 1 is still in scope
console.log(\`Found \${files.length} files in src/\`)
\`\`\`
\`\`\`\`

### Use Cases for Markdown Scripts

- **Runnable tutorials** -- documentation that actually executes
- **Onboarding guides** -- new developers run the guide and see real output
- **Demo scripts** -- explain and execute in the same document
- **Literate DevOps** -- annotated operational runbooks

## TypeScript Script Examples

### File Processor

\`\`\`typescript
// scripts/process-images.ts
import container from '@soederpop/luca'

const { fs, proc } = container

const { files: images } = fs.walk('./uploads', { include: ['*.png', '*.jpg'] })
console.log(\`Processing \${images.length} images...\`)

for (const image of images) {
  console.log(\`  Optimizing: \${image}\`)
  proc.exec(\`optipng \${image}\`)
}

console.log('Done.')
\`\`\`

### Data Migration

\`\`\`typescript
// scripts/migrate-data.ts
import container from '@soederpop/luca'

const { fs } = container

const api = container.client('rest', {
  baseURL: 'https://api.example.com',
})
await api.connect()

const oldData = fs.readJson('./data/legacy-users.json')
console.log(\`Migrating \${oldData.length} users...\`)

for (const user of oldData) {
  await api.post('/users', {
    name: user.full_name,
    email: user.email_address,
    role: 'user',
  })
  console.log(\`  Migrated: \${user.full_name}\`)
}

console.log('Migration complete.')
\`\`\`

### Generate Report

\`\`\`typescript
// scripts/weekly-report.ts
import container from '@soederpop/luca'

const { git, fs } = container

const branch = git.branch       // getter, not a method
const sha = git.sha             // getter, not a method
const files = await git.lsFiles()
const { files: srcFiles } = fs.walk('./src', { include: ['*.ts'] })

const report = \`# Weekly Report

- Branch: \${branch}
- Commit: \${sha}
- Tracked files: \${files.length}
- Source files: \${srcFiles.length}

Generated: \${new Date().toISOString()}
\`

await fs.writeFile('./reports/weekly.md', report)
console.log('Report generated: reports/weekly.md')
\`\`\`

## Tips

- **Use the container** -- don't import \`fs\` from Node directly. \`container.fs\` gives you the same operations with the benefit of working within the container ecosystem.
- **Markdown scripts are great for prototyping** -- write a markdown file, mix explanation with code, run it, iterate.
- **Use \`--safe\` for unfamiliar scripts** -- review each block before it runs.
`,
  "09-clients.md": `---
title: Using Clients
tags: [clients, rest, graphql, websocket, http, api, axios]
---

# Using Clients

Clients connect your application to external services. Luca provides built-in clients for REST APIs, GraphQL, and WebSocket connections.

## REST Client

The REST client wraps axios with Luca's helper patterns (state, events, introspection):

\`\`\`typescript
const api = container.client('rest', {
  baseURL: 'https://api.example.com',
  headers: {
    Authorization: 'Bearer my-token',
  },
})

await api.connect()

// Standard HTTP methods
const users = await api.get('/users')
const user = await api.get('/users/123')
const created = await api.post('/users', { name: 'Alice', email: 'alice@example.com' })
const updated = await api.put('/users/123', { name: 'Alice Updated' })
await api.delete('/users/123')
\`\`\`

### REST Client Events

\`\`\`typescript
api.on('failure', (error) => {
  console.error('Request failed:', error.message)
})

// State changes track connection status
api.state.observe((type, key, value) => {
  if (key === 'connected') {
    console.log(\`Client connected: \${value}\`)
  }
})
\`\`\`

## GraphQL Client

For GraphQL APIs, use the REST client's \`post()\` method to send queries and mutations:

\`\`\`typescript
const graph = container.client('rest', {
  baseURL: 'https://api.example.com/graphql',
  headers: { Authorization: 'Bearer my-token' },
})

await graph.connect()

// Send a query
const result = await graph.post('/', {
  query: \`
    query GetUser($id: ID!) {
      user(id: $id) {
        name
        email
        posts { title }
      }
    }
  \`,
  variables: { id: '123' },
})

// Send a mutation
const mutationResult = await graph.post('/', {
  query: \`
    mutation CreatePost($input: PostInput!) {
      createPost(input: $input) {
        id
        title
      }
    }
  \`,
  variables: { input: { title: 'Hello World', body: '...' } },
})
\`\`\`

## WebSocket Client

The WebSocket client wraps a raw \`WebSocket\` connection:

\`\`\`typescript
const ws = container.client('websocket', {
  baseURL: 'wss://realtime.example.com',
})

await ws.connect()

// Access the underlying WebSocket via ws.ws
ws.ws.onmessage = (event) => {
  console.log('Received:', event.data)
}

ws.ws.send(JSON.stringify({ type: 'subscribe', channel: 'updates' }))

// Clean up
ws.ws.close()
\`\`\`

## Discovering Clients

\`\`\`typescript
container.clients.available   // ['rest', 'graph', 'websocket']
container.clients.describe('rest')
\`\`\`

## Using Clients in Endpoints

\`\`\`typescript
// endpoints/proxy.ts
import { z } from 'zod'
import type { EndpointContext } from '@soederpop/luca'

export const path = '/api/external-data'

export const getSchema = z.object({
  query: z.string().describe('Search query'),
})

export async function get(params: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const api = ctx.container.client('rest', {
    baseURL: 'https://external-api.com',
  })

  await api.connect()
  const data = await api.get(\`/search?q=\${encodeURIComponent(params.query)}\`)

  return { results: data }
}
\`\`\`

## Using Clients in Features

\`\`\`typescript
class WeatherService extends Feature<WeatherState, WeatherOptions> {
  private api: any

  async initialize() {
    this.api = this.container.client('rest', {
      baseURL: 'https://api.weather.com',
      headers: { 'X-API-Key': this.options.apiKey },
    })
    await this.api.connect()
  }

  async getForecast(city: string) {
    const data = await this.api.get(\`/forecast/\${encodeURIComponent(city)}\`)
    this.state.set('lastForecast', data)
    this.emit('forecastFetched', data)
    return data
  }
}
\`\`\`
`,
  "16-google-features.md": `---
title: Google Features
tags: [google, drive, sheets, calendar, docs, oauth2, service-account, auth, api]
---

# Google Features

Luca provides five features for working with Google APIs: authentication, Drive files, Sheets data, Calendar events, and Docs-as-markdown. All are built on the official \`googleapis\` package.

## Setting Up Google Cloud Credentials

Before using any Google feature, you need credentials from a Google Cloud project.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** > **New Project**
3. Name it (e.g. "Luca Integration") and click **Create**

### Step 2: Enable the APIs

In your project, go to **APIs & Services > Library** and enable:

- **Google Drive API**
- **Google Sheets API**
- **Google Calendar API**
- **Google Docs API**

Click each one and hit **Enable**.

### Step 3a: OAuth2 Credentials (for personal/interactive use)

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - Choose **External** (or Internal if using Google Workspace)
   - Fill in app name and your email for support/developer contact
   - Add scopes: \`drive.readonly\`, \`spreadsheets.readonly\`, \`calendar.readonly\`, \`documents.readonly\`
   - Add yourself as a test user
4. Back in **Credentials**, create an **OAuth client ID**:
   - Application type: **Desktop app** (or Web application)
   - For Desktop app, no redirect URI is needed (Luca handles it)
   - For Web application, add \`http://localhost:9876/oauth2callback\` as an authorized redirect URI
5. Download or copy the **Client ID** and **Client Secret**

Set them as environment variables in your \`.env\`:

\`\`\`
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
\`\`\`

### Step 3b: Service Account Credentials (for servers/automation)

1. Go to **APIs & Services > Credentials**
2. Click **Create Credentials > Service account**
3. Name it and click **Create and Continue**
4. Grant it appropriate roles (e.g. Viewer) and click **Done**
5. Click on the service account > **Keys** tab > **Add Key > Create new key > JSON**
6. Save the downloaded JSON key file

Set the path as an environment variable:

\`\`\`
GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/service-account-key.json
\`\`\`

**Important:** For service accounts to access your personal files, you must share Drive files/folders, Sheets, and Calendars with the service account's email address (found in the JSON key file as \`client_email\`).

## Authentication

### OAuth2 (Interactive)

Opens a browser for Google consent. Best for personal/development use:

\`\`\`typescript
const auth = container.feature('googleAuth', {
  scopes: [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/documents.readonly',
  ],
})

// Opens browser, waits for consent, stores refresh token
await auth.authorize()

console.log(auth.isAuthenticated)  // true
console.log(auth.state.get('email'))  // your Google email
\`\`\`

On subsequent runs, the refresh token is automatically restored from the disk cache -- no browser needed:

\`\`\`typescript
const auth = container.feature('googleAuth')
const restored = await auth.tryRestoreTokens()

if (restored) {
  console.log('Authenticated from cached token')
} else {
  await auth.authorize()
}
\`\`\`

### Service Account (Non-Interactive)

No browser needed. Best for servers and automation:

\`\`\`typescript
const auth = container.feature('googleAuth', {
  serviceAccountKeyPath: '/path/to/key.json',
  scopes: ['https://www.googleapis.com/auth/drive.readonly'],
})

await auth.authenticateServiceAccount()
\`\`\`

Or pass the key object directly:

\`\`\`typescript
const key = JSON.parse(fs.readFileSync('/path/to/key.json', 'utf-8'))

const auth = container.feature('googleAuth', {
  serviceAccountKey: key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
})

await auth.authenticateServiceAccount()
\`\`\`

### Auth Events

\`\`\`typescript
auth.on('authenticated', ({ mode, email }) => {
  console.log(\`Signed in via \${mode} as \${email}\`)
})

auth.on('tokenRefreshed', () => {
  console.log('Access token refreshed automatically')
})

auth.on('error', (err) => {
  console.error('Auth error:', err.message)
})
\`\`\`

### Revoking Credentials

\`\`\`typescript
await auth.revoke()  // Revokes tokens and clears cached refresh token
\`\`\`

## Google Drive

List, search, browse, and download files from Google Drive.

\`\`\`typescript
const drive = container.feature('googleDrive')
\`\`\`

### List Files

\`\`\`typescript
// List recent files
const { files } = await drive.listFiles()

// With a Drive query filter
const { files: pdfs } = await drive.listFiles("mimeType = 'application/pdf'")

// Paginate
const page1 = await drive.listFiles(undefined, { pageSize: 10 })
const page2 = await drive.listFiles(undefined, { pageSize: 10, pageToken: page1.nextPageToken })
\`\`\`

### Search

\`\`\`typescript
// Search by name and content
const { files } = await drive.search('quarterly report')

// Filter by MIME type
const { files: slides } = await drive.search('presentation', {
  mimeType: 'application/vnd.google-apps.presentation',
})

// Search within a folder
const { files: inFolder } = await drive.search('notes', {
  inFolder: 'folder-id-here',
})
\`\`\`

### Browse Folders

\`\`\`typescript
// Browse root
const root = await drive.browse()
console.log('Folders:', root.folders.map(f => f.name))
console.log('Files:', root.files.map(f => f.name))

// Browse a specific folder
const contents = await drive.browse('folder-id-here')

// List a folder's contents (flat list)
const { files } = await drive.listFolder('folder-id-here')
\`\`\`

### Download Files

\`\`\`typescript
// Get file metadata
const file = await drive.getFile('file-id')
console.log(file.name, file.mimeType, file.size)

// Download as Buffer
const buffer = await drive.download('file-id')

// Download to local disk
const savedPath = await drive.downloadTo('file-id', './downloads/report.pdf')

// Export a Google Workspace file (Docs, Sheets, Slides) to another format
const pdfBuffer = await drive.exportFile('doc-id', 'application/pdf')
const csvBuffer = await drive.exportFile('sheet-id', 'text/csv')
\`\`\`

### Shared Drives

\`\`\`typescript
const sharedDrives = await drive.listDrives()

// List files from a shared drive
const { files } = await drive.listFiles(undefined, { corpora: 'allDrives' })
\`\`\`

## Google Sheets

Read spreadsheet data as JSON objects, CSV strings, or raw 2D arrays.

\`\`\`typescript
const sheets = container.feature('googleSheets', {
  defaultSpreadsheetId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
})
\`\`\`

You can find the spreadsheet ID in the URL: \`https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/edit\`

### Read as JSON

The first row becomes object keys, subsequent rows become values:

\`\`\`typescript
// Read the first sheet
const data = await sheets.getAsJson()
// => [{ Name: 'Alice', Age: '30', City: 'Austin' }, { Name: 'Bob', Age: '25', City: 'Denver' }]

// Read a specific tab
const revenue = await sheets.getAsJson('Q4 Revenue')

// Read from a different spreadsheet
const other = await sheets.getAsJson('Sheet1', 'other-spreadsheet-id')
\`\`\`

### Read as CSV

\`\`\`typescript
const csv = await sheets.getAsCsv('Sheet1')
// => "Name,Age,City\\nAlice,30,Austin\\nBob,25,Denver"
\`\`\`

### Read Raw Ranges

\`\`\`typescript
// A1 notation
const values = await sheets.getRange('Sheet1!A1:D10')
// => [['Name', 'Age', 'City'], ['Alice', '30', 'Austin'], ...]

// Entire sheet
const all = await sheets.getRange('Sheet1')
\`\`\`

### Save to Files

\`\`\`typescript
await sheets.saveAsJson('./data/export.json')
await sheets.saveAsJson('./data/revenue.json', 'Revenue')

await sheets.saveAsCsv('./data/export.csv')
await sheets.saveAsCsv('./data/revenue.csv', 'Revenue')
\`\`\`

### Spreadsheet Metadata

\`\`\`typescript
const meta = await sheets.getSpreadsheet()
console.log(meta.title)
console.log(meta.sheets)  // [{ sheetId, title, rowCount, columnCount }, ...]

// Just the tab list
const tabs = await sheets.listSheets()
tabs.forEach(t => console.log(t.title, \`\${t.rowCount} rows\`))
\`\`\`

## Google Calendar

List calendars and read events with convenience methods for common queries.

\`\`\`typescript
const calendar = container.feature('googleCalendar', {
  timeZone: 'America/Chicago',
})
\`\`\`

### List Calendars

\`\`\`typescript
const calendars = await calendar.listCalendars()
calendars.forEach(c => {
  console.log(\`\${c.primary ? '★' : ' '} \${c.summary} (\${c.id})\`)
})
\`\`\`

### Today's Events

\`\`\`typescript
const today = await calendar.getToday()
today.forEach(event => {
  const time = event.start.dateTime
    ? new Date(event.start.dateTime).toLocaleTimeString()
    : 'All day'
  console.log(\`\${time} - \${event.summary}\`)
})
\`\`\`

### Upcoming Events

\`\`\`typescript
// Next 7 days
const upcoming = await calendar.getUpcoming(7)

// Next 30 days
const month = await calendar.getUpcoming(30)

// From a specific calendar
const work = await calendar.getUpcoming(7, 'work-calendar-id')
\`\`\`

### Search Events

\`\`\`typescript
const standups = await calendar.searchEvents('standup')
const reviews = await calendar.searchEvents('review', {
  timeMin: '2026-03-01T00:00:00Z',
  timeMax: '2026-03-31T23:59:59Z',
})
\`\`\`

### List Events with Full Options

\`\`\`typescript
const { events, nextPageToken } = await calendar.listEvents({
  calendarId: 'primary',
  timeMin: new Date().toISOString(),
  timeMax: new Date(Date.now() + 14 * 86400000).toISOString(),
  maxResults: 50,
  orderBy: 'startTime',
})

events.forEach(e => {
  console.log(e.summary, e.start, e.location, e.attendees?.length)
})
\`\`\`

### Get a Single Event

\`\`\`typescript
const event = await calendar.getEvent('event-id-here')
console.log(event.summary, event.description, event.attendees)
\`\`\`

## Google Docs

Read Google Docs and convert them to Markdown or plain text.

\`\`\`typescript
const docs = container.feature('googleDocs')
\`\`\`

You can find the document ID in the URL: \`https://docs.google.com/document/d/{DOCUMENT_ID}/edit\`

### Convert to Markdown

\`\`\`typescript
const markdown = await docs.getAsMarkdown('document-id')
console.log(markdown)
\`\`\`

The converter handles:
- Headings (H1-H6)
- **Bold**, *italic*, ~~strikethrough~~
- [Links](url)
- \`Code spans\` (Courier/monospace fonts)
- Ordered and unordered lists with nesting
- Tables (markdown pipe format)
- Images (\`![alt](url)\`)
- Section breaks (\`---\`)

### Save as Markdown File

\`\`\`typescript
const path = await docs.saveAsMarkdown('document-id', './docs/imported.md')
console.log(\`Saved to \${path}\`)
\`\`\`

### Plain Text

\`\`\`typescript
const text = await docs.getAsText('document-id')
\`\`\`

### Raw Document Structure

\`\`\`typescript
const doc = await docs.getDocument('document-id')
console.log(doc.title)
console.log(doc.body?.content)  // Array of structural elements
console.log(doc.lists)           // List definitions
console.log(doc.inlineObjects)   // Embedded images
\`\`\`

### List and Search Docs

\`\`\`typescript
// List all Google Docs in your Drive
const allDocs = await docs.listDocs()
allDocs.forEach(d => console.log(d.name, d.id))

// Filter by name
const reports = await docs.listDocs('report')

// Full-text search
const results = await docs.searchDocs('quarterly earnings')
\`\`\`

## Common Patterns

### Authenticate Once, Use Everywhere

All Google features share the same \`googleAuth\` instance. Authenticate once and every feature picks it up:

\`\`\`typescript
// Auth first
const auth = container.feature('googleAuth')
await auth.authorize()

// All features auto-use the authenticated client
const drive = container.feature('googleDrive')
const sheets = container.feature('googleSheets')
const calendar = container.feature('googleCalendar')
const docs = container.feature('googleDocs')

// No additional auth needed
const files = await drive.listFiles()
const events = await calendar.getToday()
\`\`\`

### Download a Google Doc as Markdown via Drive Export

Two approaches -- the Docs API (richer formatting) or Drive export (simpler):

\`\`\`typescript
// Approach 1: Docs API with full markdown conversion (recommended)
const docs = container.feature('googleDocs')
const markdown = await docs.getAsMarkdown('doc-id')

// Approach 2: Drive export as plain text
const drive = container.feature('googleDrive')
const buffer = await drive.exportFile('doc-id', 'text/plain')
const plainText = buffer.toString('utf-8')
\`\`\`

### Batch Download Sheets as JSON

\`\`\`typescript
const drive = container.feature('googleDrive')
const sheets = container.feature('googleSheets')

// Find all spreadsheets in a folder
const { files } = await drive.listFolder('folder-id')
const spreadsheets = files.filter(f => f.mimeType === 'application/vnd.google-apps.spreadsheet')

for (const file of spreadsheets) {
  const data = await sheets.getAsJson(undefined, file.id)
  await container.fs.writeFileAsync(
    container.paths.resolve(\`./data/\${file.name}.json\`),
    JSON.stringify(data, null, 2)
  )
  console.log(\`Exported \${file.name}: \${data.length} rows\`)
}
\`\`\`

### Error Handling

All features emit \`error\` events and update \`lastError\` in state:

\`\`\`typescript
const drive = container.feature('googleDrive')

drive.on('error', (err) => {
  console.error('Drive error:', err.message)
})

try {
  await drive.download('invalid-id')
} catch (err) {
  console.log(drive.state.get('lastError'))
}
\`\`\`

## Scopes Reference

Use the narrowest scopes needed. All default to readonly:

| Scope | Access |
|-------|--------|
| \`drive.readonly\` | View and download Drive files |
| \`drive\` | Full read/write access to Drive |
| \`spreadsheets.readonly\` | Read spreadsheet data |
| \`spreadsheets\` | Read and write spreadsheet data |
| \`calendar.readonly\` | View calendar events |
| \`calendar\` | Full calendar access |
| \`documents.readonly\` | View document content |
| \`documents\` | Full document access |

Full scope URLs follow the pattern: \`https://www.googleapis.com/auth/{scope}\`
`
}
