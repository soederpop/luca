---
title: Features as Tool Providers for Assistants
tags:
  - feature
  - tools
  - assistant
  - composition
  - use
  - setupToolsConsumer
  - toTools
  - authoring
lastTested: '2026-07-03'
lastTestPassed: true
---

# Features as Tool Providers for Assistants

Any feature can expose tools that assistants pick up via `assistant.use(feature)`. This is how you compose lower-level container capabilities into an assistant-ready tool surface. The built-in `fileTools` feature is the canonical example — it wraps `fs` and `grep` into a focused set of tools modeled on what coding assistants need.

For the helpers involved: `luca describe fileTools`, `luca describe assistant`, `luca describe helpers`.

## The Pattern

A feature becomes a tool provider by defining three things:

1. **`static tools`** — a record mapping tool names to `{ description, schema }` entries (Zod schemas with `.describe()` on every field)
2. **Matching methods** — instance methods whose names match the keys in `static tools`; `toTools()` auto-binds each schema to the same-named method
3. **`setupToolsConsumer()`** (optional) — a hook that runs when an assistant calls `use()`, perfect for injecting system prompt guidance

When an assistant calls `assistant.use(feature)`, the framework:
- Calls the feature's `toTools()` to collect `{ schemas, handlers }` (walking the prototype chain, so subclasses can override parent tools; instance-level `tool()` registrations win over all)
- Registers each tool on the assistant via `addTool()`
- Calls `setupToolsConsumer(assistant)` so the feature can configure the assistant (e.g. add system prompt extensions)

## Anatomy of fileTools

Here's the structure of the built-in `fileTools` feature (abridged from the real source — shown, not executed; the runnable version of this pattern is the walkthrough below):

```ts skip
import { z } from 'zod'
import { Feature } from 'luca'

export class FileTools extends Feature {
  static override stability = 'stable' as const
  static { Feature.register(this, 'fileTools') }

  // ── 1. Declare tools with Zod schemas ──────────────────────────
  static override tools = {
    readFile: {
      description: 'Read the contents of a file.',
      schema: z.object({
        path: z.string().describe('File path relative to the project root'),
        offset: z.number().optional().describe('Line number to start reading from'),
        limit: z.number().optional().describe('Maximum number of lines to read'),
      }).describe('Read the contents of a file.'),
    },
    searchFiles: {
      description: 'Search file contents for a pattern using ripgrep.',
      schema: z.object({
        pattern: z.string().describe('Search pattern (regex supported)'),
        path: z.string().optional().describe('Directory to search in'),
        include: z.string().optional().describe('Glob pattern to filter files'),
      }).describe('Search file contents for a pattern using ripgrep.'),
    },
    // ... editFile, listDirectory, findFiles, fileInfo, and more
  }

  // ── 2. Implement each tool as an instance method ───────────────
  // Method names must match the keys in static tools exactly.
  // Each receives the parsed args object; composition happens
  // through this.container, never through direct imports.

  async readFile(args: { path: string; offset?: number; limit?: number }) {
    const fs = this.container.feature('fs')
    return await fs.readFileAsync(args.path)
  }

  async searchFiles(args: { pattern: string; path?: string; include?: string }) {
    const grep = this.container.feature('grep')
    const results = await grep.search({ pattern: args.pattern, path: args.path, include: args.include })
    return JSON.stringify(results.map(r => ({ file: r.file, line: r.line, content: r.content })))
  }

  // ── 3. Configure the assistant when it calls use() ─────────────
  override setupToolsConsumer(consumer) {
    // If the consumer is an assistant, inject guidance into its system prompt
    if (typeof consumer.addSystemPromptExtension === 'function') {
      consumer.addSystemPromptExtension('fileTools', [
        '## File Tools',
        '- All file paths are relative to the project root unless they start with /',
        '- Use searchFiles to understand code before modifying it',
        '- Use editFile for surgical changes — prefer it over writeFile',
      ].join('\n'))
    }
  }
}
```

## Using It

Wiring tools onto an assistant needs no API key — `use()` registers the tool surface and runs `setupToolsConsumer` immediately, before any model is contacted. We can verify the whole handshake live:

```ts
fileTools = container.feature('fileTools')

reviewer = container.feature('assistant', {
  systemPrompt: 'You are a coding assistant.',
  model: 'gpt-4.1-mini',
})
reviewer.use(fileTools)

// The assistant now has the full fileTools surface...
const toolNames = Object.keys(reviewer.tools)
console.log('registered tools:', toolNames.join(', '))
for (const expected of ['readFile', 'writeFile', 'editFile', 'searchFiles', 'listDirectory']) {
  if (!toolNames.includes(expected)) throw new Error(`expected ${expected} to be registered`)
}

// ...and setupToolsConsumer injected the usage guidance into its system prompt
if (!reviewer.effectiveSystemPrompt.includes('## File Tools')) {
  throw new Error('fileTools guidance missing from the effective system prompt')
}
console.log('tool surface and system prompt extension verified')
```

### Selective tool registration

You can expose only a subset of tools — `toTools({ only })` returns a `{ schemas, handlers, setup }` package that `use()` also accepts:

```ts
scout = container.feature('assistant', {
  systemPrompt: 'You are a read-only code scout.',
  model: 'gpt-4.1-mini',
})
scout.use(fileTools.toTools({ only: ['readFile', 'searchFiles', 'listDirectory'] }))

const scoutTools = Object.keys(scout.tools)
if (scoutTools.length !== 3) throw new Error(`expected exactly 3 tools, got ${scoutTools.length}: ${scoutTools}`)
if (scoutTools.includes('writeFile')) throw new Error('writeFile should have been excluded')
console.log('scout has only:', scoutTools.join(', '))
```

## Walkthrough: author your own tool-providing feature

Now the full lifecycle for a feature of your own: write it, register it through discovery, inspect its tool surface, and hand it to an assistant. In a real project this file lives in `features/` and is picked up automatically; here we write it to a scratch folder inside the project (so its `import ... from 'luca'` resolves) and discover it explicitly — the same pattern as the [custom feature authoring example](./custom-feature-authoring.md).

We build `diceTools`: a tiny feature exposing one tool, with matching method and system prompt guidance.

```ts
// bare assignments (no const) so these survive into the later blocks
pluginRoot = container.paths.resolve('tmp', `tool-provider-demo-${Date.now()}`)
featureDir = container.paths.resolve(pluginRoot, 'features')

const featureSource = `
import { z } from 'zod'
import { Feature } from 'luca'

/**
 * Dice-rolling tools for assistants. One static tools entry, one
 * matching method, one setupToolsConsumer hook — the whole pattern.
 */
export class DiceTools extends Feature {
  static override stability = 'experimental' as const
  static { Feature.register(this, 'diceTools') }

  // 1. Declare the tool surface
  static override tools = {
    rollDice: {
      description: 'Roll one or more dice and return the rolls and their total.',
      schema: z.object({
        sides: z.number().default(6).describe('How many sides each die has'),
        count: z.number().default(1).describe('How many dice to roll'),
      }).describe('Roll one or more dice and return the rolls and their total.'),
    },
  }

  // 2. Implement it — the method name matches the static tools key
  async rollDice(args: { sides?: number; count?: number }) {
    const sides = args.sides ?? 6
    const count = args.count ?? 1
    const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides))
    return JSON.stringify({ rolls, total: rolls.reduce((a, b) => a + b, 0) })
  }

  // 3. Teach the consumer how to use it
  override setupToolsConsumer(consumer) {
    if (typeof consumer.addSystemPromptExtension === 'function') {
      consumer.addSystemPromptExtension('diceTools', [
        '## Dice Tools',
        'Use rollDice for anything involving chance. Never invent dice results yourself.',
      ].join('\\n'))
    }
  }
}

export default DiceTools
`

fs.ensureFolder(featureDir)
fs.writeFile(container.paths.resolve(featureDir, 'dice-tools.ts'), featureSource)
console.log('feature file written')
```

### Register and introspect the tool surface

`helpers.discover('features', { directory })` loads the module, which runs its `static { Feature.register(...) }` block. After that, `toTools()` shows exactly what an assistant would receive — and the handlers are directly callable, which is the fastest way to test tool implementations without a model in the loop.

```ts
const discovered = await helpers.discover('features', { directory: featureDir })
console.log('discovered:', discovered)
if (!container.features.available.includes('diceTools')) throw new Error('diceTools did not register')

dice = container.feature('diceTools')
const pkg = dice.toTools()

if (Object.keys(pkg.schemas).join() !== 'rollDice') throw new Error('expected exactly the rollDice schema')
if (typeof pkg.handlers.rollDice !== 'function') throw new Error('rollDice handler was not auto-bound to the method')
if (typeof pkg.setup !== 'function') throw new Error('setupToolsConsumer should be packaged as pkg.setup')

// call the tool handler directly — no assistant, no model
const rolled = JSON.parse(await pkg.handlers.rollDice({ sides: 6, count: 3 }))
console.log('direct tool call:', rolled)
if (rolled.rolls.length !== 3) throw new Error('expected 3 rolls')
if (rolled.total !== rolled.rolls.reduce((a, b) => a + b, 0)) throw new Error('total should match the rolls')
```

### Hand it to an assistant

```ts
gameMaster = container.feature('assistant', {
  systemPrompt: 'You are a game master for a dice game.',
  model: 'gpt-4.1-mini',
})
gameMaster.use(dice)

if (!Object.keys(gameMaster.tools).includes('rollDice')) throw new Error('rollDice not registered on the assistant')
if (!gameMaster.effectiveSystemPrompt.includes('## Dice Tools')) throw new Error('diceTools guidance missing from system prompt')

// the registered tool carries the schema description through to the model
console.log('rollDice description:', gameMaster.tools.rollDice.description)
console.log('assistant wired with diceTools')
```

### Let the model actually call it

Everything above ran without credentials. Actually starting the assistant and asking a question sends the tool schemas to the model, which decides to call `rollDice`; the framework routes the call to your method and feeds the result back. That requires an `OPENAI_API_KEY` in the environment, so it's shown rather than run:

```ts skip
await gameMaster.start()
const answer = await gameMaster.ask('Roll 2d20 for initiative and tell me the total.')
console.log(answer)
// The transcript will include a rollDice tool call with { sides: 20, count: 2 }
// and the model's narration of the real (not hallucinated) result.
```

### Clean up

```ts
await fs.rmdir(pluginRoot)
console.log('cleaned up', pluginRoot)
```

## Why This Pattern Matters

This is how features compose for AI. Instead of the assistant importing `fs` and `grep` directly:

- The **feature** owns the tool surface — schemas, descriptions, and implementations in one place
- The **assistant** gets a curated interface, not raw container access
- **`setupToolsConsumer()`** lets the feature teach the assistant how to use the tools well
- **`toTools({ only })`** lets you scope down what the assistant can do

Any feature you build can follow this same pattern. Define `static tools`, implement matching methods, optionally override `setupToolsConsumer()`, and assistants can `use()` it. Other built-ins to study: `contentDb` (document exploration tools) and `codingTools` — `luca describe <name>` shows each one's surface.

## Summary

Features are the natural place to package tools for assistants. The `static tools` record declares the schema, instance methods implement the logic (auto-bound by name in `toTools()`), and `setupToolsConsumer()` wires up assistant-specific configuration like system prompt extensions. This keeps tool definitions, implementations, and assistant guidance co-located in a single feature class — and every piece of the handshake is verifiable without an API key, right up to the final `ask()`.
