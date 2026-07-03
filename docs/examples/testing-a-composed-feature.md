---
title: Testing a Composed Feature
tags:
  - testing
  - bun
  - features
  - state
  - events
  - composition
lastTested: '2026-07-03'
lastTestPassed: true
---

# Testing a Composed Feature

You built a feature that composes other helpers — now prove it works. The test runner is **bun** (`bun test`, never vitest), and the patterns below are the ones this framework's own `test/*.test.ts` files use: a fresh container per test, state assertions via `state.get()`, observer spies, and events awaited as promises.

One honest caveat about this document: `bun:test` only exists inside a `bun test` run, not inside the container VM that executes these docs. So the real test code appears in **skip blocks** (shown verbatim, not executed), and each one is paired with a **runnable block** that performs the identical assertions with plain conditionals — which means the claims in the skip blocks are still regression-checked every time this doc runs.

## The feature under test

A small but genuinely composed feature: `tally` counts lines in files through the `fs` feature, tracks observable state, and emits a `tallied` event. In a real project this lives at `features/tally.ts`; here we write it into a scratch folder inside the project (inside, because its `import ... from 'luca'` must resolve against project dependencies) and load it through discovery — the exact mechanism that loads a project's `features/` folder.

```ts
// bare assignments (no const) so these survive into later blocks
pluginRoot = container.paths.resolve('tmp', `testing-composed-feature-${Date.now()}`)
featureDir = container.paths.resolve(pluginRoot, 'features')

const featureSource = `
import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'

export const TallyStateSchema = FeatureStateSchema.extend({
  tallies: z.number().default(0).describe('How many tallies have run'),
  lastCount: z.number().optional().describe('Line count from the most recent tally'),
})
export type TallyState = z.infer<typeof TallyStateSchema>

export const TallyOptionsSchema = FeatureOptionsSchema.extend({
  trim: z.boolean().default(true).describe('Ignore trailing newlines when counting'),
})
export type TallyOptions = z.infer<typeof TallyOptionsSchema>

export const TallyEventsSchema = FeatureEventsSchema.extend({
  tallied: z.tuple([
    z.string().describe('The file that was counted'),
    z.number().describe('The line count'),
  ]).describe('Emitted after each completed tally'),
})

/**
 * Counts lines in files by composing the fs feature.
 */
export class Tally extends Feature<TallyState, TallyOptions> {
  static override shortcut = 'features.tally' as const
  static override stability = 'experimental' as const
  static override stateSchema = TallyStateSchema
  static override optionsSchema = TallyOptionsSchema
  static override eventsSchema = TallyEventsSchema
  static { Feature.register(this, 'tally') }

  // initialState is NOT derived from schema defaults — declare it explicitly
  override get initialState(): TallyState {
    return { enabled: false, tallies: 0 }
  }

  async tally(file: string) {
    const fs = this.container.feature('fs')
    if (!fs.exists(file)) throw new Error('tally: no such file: ' + file)

    let text = String(fs.readFile(file))
    if (this.options.trim !== false) text = text.replace(/\\n+$/, '')
    const lines = text.split('\\n').length

    this.setState({ tallies: (this.state.get('tallies') || 0) + 1, lastCount: lines })
    this.emit('tallied', file, lines)
    return lines
  }
}

export default Tally
`

fs.ensureFolder(featureDir)
fs.writeFile(container.paths.resolve(featureDir, 'tally.ts'), featureSource)

// a fixture to count: three lines plus a trailing newline
sampleFile = container.paths.resolve(pluginRoot, 'sample.txt')
fs.writeFile(sampleFile, 'alpha\nbeta\ngamma\n')

const discovered = await helpers.discover('features', { directory: featureDir })
if (!container.features.available.includes('tally')) throw new Error('tally did not register via discovery')
console.log('discovered and registered:', discovered)
```

## How do I get a fresh container in a test?

The answer the real tests use: **construct one**. `new NodeContainer()` per test (or per `describe`) gives you isolated helper instances while sharing the module-global registry — registration happens in the feature file's `static { Feature.register(...) }` block the moment the module is imported.

```ts skip
import { describe, it, expect } from 'bun:test'
import { NodeContainer } from 'luca'   // in the framework repo itself: '../src/node/container'
import './features/tally'              // side-effect import runs Feature.register

describe('tally registration', () => {
  it('is registered once the module is imported', () => {
    const c = new NodeContainer()
    expect(c.features.available).toContain('tally')
  })

  it('memoizes per container: same args return same instance', () => {
    const c = new NodeContainer()
    expect(c.feature('tally').uuid).toBe(c.feature('tally').uuid)
  })

  it('different containers get different instances', () => {
    const a = new NodeContainer().feature('tally')
    const b = new NodeContainer().feature('tally')
    expect(a.uuid).not.toBe(b.uuid)
  })
})
```

Two rules fall out of this: **registries are global** (register once, visible from every container), and **instances are per container, memoized by id + options** (so a fresh container is what gives a test a clean slate).

Doc blocks don't have the `NodeContainer` class in scope, but `container.subcontainer({})` constructs a fresh instance of the same concrete class — so we can verify those exact claims right now:

```ts
freshContainer = container.subcontainer({})

if (!freshContainer.features.available.includes('tally')) throw new Error('registry should be shared globally')

const a = container.feature('tally')
const b = container.feature('tally')
if (a.uuid !== b.uuid) throw new Error('same container + same options should memoize to one instance')

const c = freshContainer.feature('tally')
if (c.uuid === a.uuid) throw new Error('a fresh container should get a fresh instance')
console.log('registry shared, instances isolated per container')
```

## Asserting behavior and state

The bun:test version — construct, call, assert on the return value and on `state.get()`:

```ts skip
import { describe, it, expect } from 'bun:test'
import { NodeContainer } from 'luca'
import './features/tally'

describe('tally()', () => {
  it('counts lines and updates state', async () => {
    const c = new NodeContainer()
    const tally = c.feature('tally')

    const lines = await tally.tally('test/fixtures/sample.txt')

    expect(lines).toBe(3)
    expect(tally.state.get('lastCount')).toBe(3)
    expect(tally.state.get('tallies')).toBe(1)
  })

  it('respects options', async () => {
    const c = new NodeContainer()
    const raw = c.feature('tally', { trim: false })
    expect(await raw.tally('test/fixtures/sample.txt')).toBe(4) // trailing newline counts
  })
})
```

The same assertions, live — each "test" takes a fresh subcontainer, exactly as each `it()` above takes a fresh `NodeContainer`:

```ts
const tally = container.subcontainer({}).feature('tally')
const lines = await tally.tally(sampleFile)
if (lines !== 3) throw new Error(`expected 3 lines, got ${lines}`)
if (tally.state.get('lastCount') !== 3) throw new Error('state.lastCount not updated')
if (tally.state.get('tallies') !== 1) throw new Error('state.tallies should be 1 after one run')

const raw = container.subcontainer({}).feature('tally', { trim: false })
const rawLines = await raw.tally(sampleFile)
if (rawLines !== 4) throw new Error(`trim:false should count the trailing newline, got ${rawLines}`)
console.log('behavior and state verified: 3 trimmed, 4 raw')
```

## Spying on state observers

In bun tests, `mock()` gives you a spy, and the observer contract is `(changeType, key, value)` — `'add'` for a new key, `'update'` for an existing one, `'delete'` on removal:

```ts skip
import { describe, it, expect, mock } from 'bun:test'
import { NodeContainer } from 'luca'
import './features/tally'

it('notifies state observers', async () => {
  const c = new NodeContainer()
  const tally = c.feature('tally')
  const observer = mock()
  tally.state.observe(observer)

  await tally.tally('test/fixtures/sample.txt')

  expect(observer).toHaveBeenCalledWith('update', 'tallies', 1)   // existed in initialState
  expect(observer).toHaveBeenCalledWith('add', 'lastCount', 3)    // first write of a new key
})
```

Without `mock()`, a plain array records the same call log:

```ts
const t = container.subcontainer({}).feature('tally')
const calls = []
const unsubscribe = t.state.observe((changeType, key, value) => calls.push([changeType, key, value]))

await t.tally(sampleFile)

const saw = (type, key, value) => calls.some(c => c[0] === type && c[1] === key && c[2] === value)
if (!saw('update', 'tallies', 1)) throw new Error('observer missed the tallies update (key existed in initialState)')
if (!saw('add', 'lastCount', 3)) throw new Error('observer missed the lastCount add (new key)')

unsubscribe()
await t.tally(sampleFile)
if (calls.length !== 2) throw new Error('unsubscribe() should stop notifications')
console.log('observer contract verified: (changeType, key, value), unsubscribe works')
```

## Awaiting events

Real tests wrap the event in a promise **before** triggering the behavior (the pattern in `test/websocket-ask.test.ts`), then await it:

```ts skip
import { it, expect } from 'bun:test'
import { NodeContainer } from 'luca'
import './features/tally'

it('emits tallied with the file and count', async () => {
  const c = new NodeContainer()
  const tally = c.feature('tally')

  const event = new Promise((resolve) => {
    tally.once('tallied', (file, count) => resolve({ file, count }))
  })

  await tally.tally('test/fixtures/sample.txt')

  const { file, count } = await event
  expect(file).toContain('sample.txt')
  expect(count).toBe(3)
})
```

Every helper also has `waitFor(event)` — handy shorthand, with one caveat: it resolves with only the **first** listener argument, so for multi-argument events like `tallied(file, count)` use the promise-plus-`once` pattern to capture everything. (Use one one-shot listener per emission — `waitFor` is `once` under the hood, and a `once` listener removing itself during dispatch can starve a second one-shot listener registered on the same event.)

```ts
const t2 = container.subcontainer({}).feature('tally')

// promise-plus-once: captures every event argument
const event = new Promise((resolve) => {
  t2.once('tallied', (file, count) => resolve({ file, count }))
})
await t2.tally(sampleFile)

const { file, count } = await event
if (!file.endsWith('sample.txt')) throw new Error('tallied event missing the file argument')
if (count !== 3) throw new Error('tallied event missing the count argument')

// waitFor: shorthand for the next emission, but only the FIRST argument survives
const firstArgOnly = t2.waitFor('tallied')
await t2.tally(sampleFile)
const viaWaitFor = await firstArgOnly
if (viaWaitFor !== file) throw new Error('waitFor should resolve with the first event argument')

console.log('event awaited: tallied', count, 'lines — waitFor caveat confirmed')
```

## Cleaning up long-lived helpers

If a feature under test opens sockets, servers, or watchers, the suite hangs without teardown. The framework's own websocket tests use `afterAll`:

```ts skip
import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from 'luca'

describe('a feature that starts a server', () => {
  const c = new NodeContainer()
  const server = c.server('websocket', { json: true })

  afterAll(async () => {
    try { await server.stop() } catch {}
  })

  // ...its
})
```

Our tally feature holds no resources, so this doc only needs to remove its scratch folder:

```ts
await fs.rmdir(pluginRoot)
console.log('cleaned up', pluginRoot)
```

## The checklist

- Tests live in `test/<name>.test.ts` and run with `bun test` (or `bun test test/tally.test.ts` for one file). Never vitest.
- Importing anything from `bun:test` disables auto-globals — import `describe`, `it`, `expect` explicitly alongside `mock` / `spyOn` / `afterAll`.
- **Fresh container per test**: `new NodeContainer()`. Registration is global; instances are memoized per container + options.
- Import the feature module (side-effect registration) or run `helpers.discover('features', { directory })` before asking the container for it.
- Assert state with `state.get()`; spy on `state.observe` knowing the `(changeType, key, value)` contract; await events with promise-plus-`once` (or `waitFor` when one argument is enough).
- Tear down servers and sockets in `afterAll` — and keep every test passing; broken tests don't get committed.
