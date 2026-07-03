---
title: Authoring a Custom Feature
tags:
  - features
  - composition
  - authoring
  - state
  - events
  - discovery
  - conventions
lastTested: '2026-07-03'
lastTestPassed: true
---

# Authoring a Custom Feature

This is the full lifecycle of building your own container feature: write a feature file that **composes existing helpers** (here: `fs` + `grep`), register it through discovery, then drive it — call methods, observe state, listen to events. Everything a "real" feature in a `features/` folder does, executed live.

For the API surface of any helper we lean on here, run `luca describe fs`, `luca describe grep`, or `luca describe helpers`.

## The anatomy

A feature is a class with three Zod schemas and some methods:

- **options** — construction-time configuration (`container.feature('x', options)`)
- **state** — observable runtime state; every write notifies observers
- **events** — a typed event bus other code can subscribe to

Framework conventions that matter (the introspection system and `luca describe` are built on them):

- Every schema field gets a `.describe('...')` — this text becomes the generated docs.
- The class and its public methods get JSDoc with `@example` blocks — same reason.
- Setup logic goes in `afterInitialize()`, not the constructor.
- Composition happens through `this.container` — a feature never imports another feature's module; it asks the container for it.

## Write the feature file

We build `todoScanner`: point it at a directory, it greps for annotation markers, keeps observable counts in state, and emits a `scanned` event. Note the composition: `fs` checks the directory, `grep` does the searching.

In a real project this file would live at `features/todo-scanner.ts`. Here we write it to a scratch folder inside the project so the example is self-contained — inside the project, because the file's `import ... from 'luca'` must resolve against your project's dependencies, exactly as it would for a real `features/` folder.

```ts
// bare assignments (no const) so these survive into the later blocks
pluginRoot = container.paths.resolve('tmp', `feature-authoring-demo-${Date.now()}`)
featureDir = container.paths.resolve(pluginRoot, 'features')

const featureSource = `
import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'

export const TodoScannerStateSchema = FeatureStateSchema.extend({
  scanning: z.boolean().default(false).describe('Whether a scan is currently running'),
  lastScanCount: z.number().default(0).describe('Number of annotations found by the most recent scan'),
  lastScannedAt: z.string().optional().describe('ISO timestamp of the most recent scan'),
})
export type TodoScannerState = z.infer<typeof TodoScannerStateSchema>

export const TodoScannerOptionsSchema = FeatureOptionsSchema.extend({
  directory: z.string().optional().describe('Directory to scan (defaults to the container cwd)'),
  markers: z.array(z.string()).default(['TODO', 'FIXME']).describe('Annotation markers to search for'),
})
export type TodoScannerOptions = z.infer<typeof TodoScannerOptionsSchema>

export const TodoScannerEventsSchema = FeatureEventsSchema.extend({
  scanned: z.tuple([
    z.number().describe('Number of annotations found'),
  ]).describe('Emitted after each completed scan'),
})

/**
 * Scans a directory for code annotations (TODO, FIXME, ...) by composing
 * the fs and grep features. Keeps observable counts in state and emits a
 * \`scanned\` event after every run.
 */
export class TodoScanner extends Feature<TodoScannerState, TodoScannerOptions> {
  static override shortcut = 'features.todoScanner' as const
  static override stability = 'experimental' as const
  static override stateSchema = TodoScannerStateSchema
  static override optionsSchema = TodoScannerOptionsSchema
  static override eventsSchema = TodoScannerEventsSchema
  static { Feature.register(this, 'todoScanner') }

  /**
   * Run a scan and return the matches.
   */
  async scan() {
    const { container } = this
    const dir = this.options.directory || container.cwd

    // Compose: fs guards, grep searches
    const fs = container.feature('fs')
    if (!fs.exists(dir)) throw new Error('todoScanner: directory does not exist: ' + dir)

    this.setState({ scanning: true })

    const grep = container.feature('grep')
    const pattern = (this.options.markers || ['TODO', 'FIXME']).join('|')
    const matches = await grep.search({ pattern, path: dir, include: '*.ts' })

    this.setState({
      scanning: false,
      lastScanCount: matches.length,
      lastScannedAt: new Date().toISOString(),
    })
    this.emit('scanned', matches.length)

    return matches
  }
}

export default TodoScanner
`

fs.ensureFolder(featureDir)
fs.writeFile(container.paths.resolve(featureDir, 'todo-scanner.ts'), featureSource)
console.log('feature file written to', featureDir)
```

(`fs`, `os`, `grep`, and `helpers` are already in scope in these runnable docs — the container injects its context. In your own scripts, `container.feature('fs')` gets you the same instances.)

## Seed something to find

Give the scanner a codebase with annotations in it.

```ts
srcDir = container.paths.resolve(pluginRoot, 'src')
fs.ensureFolder(srcDir)
fs.writeFile(container.paths.resolve(srcDir, 'auth.ts'), [
  'export function login() {',
  '  // TODO: rate-limit repeated failures',
  '  return true',
  '}',
  '// FIXME: logout does not clear the session cache',
  'export function logout() {}',
].join('\n'))
fs.writeFile(container.paths.resolve(srcDir, 'billing.ts'), [
  '// TODO: support proration',
  'export const invoice = () => 42',
].join('\n'))
```

## Register through discovery

`helpers.discover(type, { directory })` is how project `features/` folders load — and it works on any folder, which is what makes it a plugin mechanism (see the [meta-discovery example](./meta-discovery.md)). The file's `static { Feature.register(this, 'todoScanner') }` block runs when the module loads; after that the registry knows it.

```ts
const discovered = await helpers.discover('features', { directory: featureDir })
console.log('discovered:', discovered)

if (!container.features.available.includes('todoScanner')) {
  throw new Error('todoScanner did not register — discovery failed')
}
console.log('todoScanner is registered alongside', container.features.available.length - 1, 'other features')
```

Enumerate registries with `.available` — they're class instances, so `Object.keys(container.features)` will not list helper ids.

## Drive it: options, state, events

Instantiate with options, subscribe to state and events, then call the method. Factories are memoized per id + options, so any later `container.feature('todoScanner')` call in this process gets the same instance and the same state.

```ts
const scanner = container.feature('todoScanner', { directory: srcDir })

// observable state — observers receive (changeType, key, value) per mutation
const observedCounts = []
scanner.state.observe((changeType, key, value) => {
  if (key === 'lastScanCount') observedCounts.push(value)
})

// typed event bus
let announced = null
scanner.on('scanned', (count) => { announced = count })

const matches = await scanner.scan()

console.log('found', matches.length, 'annotations')
for (const m of matches) console.log(` ${m.file}:${m.line} ${m.content.trim()}`)

// assert the composed behavior actually happened
if (matches.length !== 3) throw new Error(`expected 3 annotations, got ${matches.length}`)
if (announced !== 3) throw new Error('scanned event did not fire with the count')
if (scanner.state.get('lastScanCount') !== 3) throw new Error('state.lastScanCount not updated')
if (!observedCounts.includes(3)) throw new Error('state observer never saw the new count')
if (scanner.state.get('scanning') !== false) throw new Error('scanning state did not settle back to false')
console.log('state, events, and composition all verified')
```

## Clean up

```ts
await fs.rmdir(pluginRoot)
console.log('cleaned up', pluginRoot)
```

## The checklist

When you author a feature for a real project (start with `luca scaffold feature myThing`):

1. **File** in `features/<kebab-name>.ts`, class registered via `static { Feature.register(this, '<camelName>') }`, default export the class.
2. **Schemas** extend `FeatureStateSchema` / `FeatureOptionsSchema` / `FeatureEventsSchema`, with `.describe()` on every field.
3. **JSDoc + @example** on the class and every public method — `luca describe <name>` is generated from them.
4. **Compose through `this.container`** — `this.container.feature('fs')`, never a direct import of another helper.
5. **Type augmentation** (in-project): add `declare module 'luca' { interface AvailableFeatures { myThing: typeof MyThing } }` so `container.feature('myThing')` returns your type.
6. Verify with `luca about` (discovery) and `luca describe myThing` (docs).
