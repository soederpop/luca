import { describe, it, expect } from 'bun:test'
import { tmpdir } from 'os'
import { mkdtempSync, writeFileSync } from 'fs'
import { join } from 'path'
import { NodeContainer } from '../src/node/container'

/**
 * Regression tests for the dual-React bug (challenge round 3, finding #1).
 *
 * VM-loaded user modules that `import React from 'react'` (or `from 'ink'`)
 * used to get a SECOND copy inlined at bundle time from a nearby node_modules,
 * while the ink feature rendered with the runtime's own copy. Two React
 * instances break every ink hook: "Invalid hook call",
 * `useStdin().isRawModeSupported === undefined`, duplicate-key warning storms.
 *
 * The fix bridges react/ink into VM code as (lazy) virtual modules, so user
 * code and the ink feature share one module instance.
 */

const scratchModule = (source: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'luca-ink-vm-'))
  const file = join(dir, 'mod.ts')
  writeFileSync(file, source)
  return file
}

describe('VM.defineLazyModule', () => {
  it('invokes the loader on first require only, then caches', () => {
    const container = new NodeContainer()
    const vm = container.feature('vm')

    let builds = 0
    vm.defineLazyModule('lazy-probe', () => ({ builds: ++builds }))
    expect(builds).toBe(0)

    const file = scratchModule(`
      import { builds } from 'lazy-probe'
      export const seen = builds
    `)
    const first = vm.loadModule(file)
    const second = vm.loadModule(file)
    expect(first.seen).toBe(1)
    expect(second.seen).toBe(1)
    expect(builds).toBe(1)
  })

  it('marks lazy ids external during bundling', () => {
    const container = new NodeContainer()
    const vm = container.feature('vm')
    vm.defineLazyModule('lazy-ext', () => ({}))
    expect(vm.virtualModuleIds).toContain('lazy-ext')
  })
})

describe('react/ink virtual module bridge', () => {
  it('VM-loaded modules share the runtime react instance', async () => {
    const container = new NodeContainer()
    container.helpers.seedVirtualModules()
    const vm = container.feature('vm')

    const file = scratchModule(`
      import React from 'react'
      export const capturedReact = React
    `)
    const mod = vm.loadModule(file)
    const runtimeReact = require('react')
    // Identity, not shape: two structurally-equal copies are exactly the bug.
    expect(mod.capturedReact.createElement).toBe(runtimeReact.createElement)
    expect(mod.capturedReact.useState).toBe(runtimeReact.useState)
  })

  it('loadModuleExports pre-loads ink so direct ink imports share the feature module', async () => {
    const file = scratchModule(`
      import { Text, useInput } from 'ink'
      export const capturedText = Text
      export const capturedUseInput = useInput
    `)
    // cwd = the scratch dir: no node_modules there, so loadModuleExports takes
    // the VM path — the same route the compiled binary uses in user projects.
    const container = new NodeContainer({ cwd: join(file, '..') })
    const mod = await container.helpers.loadModuleExports(file)

    const ink = container.feature('ink', { enable: true })
    await ink.loadModules()
    expect(mod.capturedText).toBe(ink.components.Text)
    expect(mod.capturedUseInput).toBe(ink.hooks.useInput)
  })

  it("the lazy 'ink' loader throws an actionable error before the feature loads", () => {
    const container = new NodeContainer()
    container.helpers.seedVirtualModules()
    const vm = container.feature('vm')

    const file = scratchModule(`
      const ink = require('ink')
      export const loaded = !!ink
    `)
    // ink was never loaded and require() is synchronous — expect the guidance error
    expect(() => vm.loadModule(file)).toThrow(/loads asynchronously/)
  })
})
