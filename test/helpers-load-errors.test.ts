import { describe, it, expect, spyOn } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

/**
 * Regression coverage for the incident that motivated this feature: a
 * project command whose import failed (a missing `lib/` file the package
 * never shipped) was warned about during discovery and then silently
 * dropped. `luca <that command>` fell through to the help listing and
 * exited 0, so nothing that reads the exit code noticed anything was wrong.
 *
 * discover() now records every import failure in `helpers.loadErrors`
 * alongside the existing `console.warn`, so a caller can tell "nothing
 * here" apart from "something here is broken".
 */

// `commands`/`selectors` are process-wide singleton registries (see
// src/command.ts), shared across every test file in this bun test run —
// discover() skips a name it already knows about, so a fixture's working
// command needs a name unique to this file, not a generic one like "hello"
// that another test file's fixture might also register first.
const UNIQUE = `${Date.now()}${Math.random().toString(36).slice(2)}`
const workingCommandName = `loadErrorsOk${UNIQUE}`
const brokenFeatureName = `loadErrorsBrokenFeature${UNIQUE}`

function makeFixture(): string {
  const root = join(os.tmpdir(), `luca-load-errors-${UNIQUE}`)
  mkdirSync(join(root, 'commands'), { recursive: true })
  mkdirSync(join(root, 'features'), { recursive: true })

  writeFileSync(
    join(root, 'commands', `${workingCommandName}.ts`),
    `export const description = 'a working command'\nexport default async function ok() { return 'ok' }\n`,
  )
  writeFileSync(
    join(root, 'commands', 'broken.ts'),
    `import { nothing } from '../lib/does-not-exist'\nexport default async function broken() { return nothing }\n`,
  )
  writeFileSync(
    join(root, 'features', `${brokenFeatureName}.ts`),
    `import { nothing } from '../lib/does-not-exist'\nexport default nothing\n`,
  )

  return root
}

describe('helpers.discover records load errors', () => {
  it('registers the working command, skips the broken one, and records exactly one load error', async () => {
    const root = makeFixture()
    const container = new NodeContainer({ cwd: root })
    const helpers = container.feature('helpers') as any

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const names = await helpers.discover('commands')

      expect(names).toContain(workingCommandName)
      expect(names).not.toContain('broken')
      expect(container.commands.has(workingCommandName)).toBe(true)
      expect(container.commands.has('broken')).toBe(false)

      expect(helpers.loadErrors).toHaveLength(1)
      expect(helpers.loadErrors[0]).toMatchObject({ type: 'commands', name: 'broken' })
      expect(helpers.loadErrors[0].path).toContain('broken.ts')
      expect(helpers.loadErrors[0].message).toBeTruthy()

      expect(warnSpy).toHaveBeenCalledTimes(1)

      // A repeat discover() of the same type+directory is memoized — no
      // duplicate entries pile up in loadErrors.
      const namesAgain = await helpers.discover('commands')
      expect(namesAgain).toEqual(names)
      expect(helpers.loadErrors).toHaveLength(1)
      expect(warnSpy).toHaveBeenCalledTimes(1)
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('emits a loadError event exactly once for the failing command', async () => {
    const root = makeFixture()
    const container = new NodeContainer({ cwd: root })
    const helpers = container.feature('helpers') as any

    const events: any[] = []
    helpers.on('loadError', (entry: any) => events.push(entry))

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await helpers.discover('commands')
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({ type: 'commands', name: 'broken' })
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('records a features load error with type "features"', async () => {
    const root = makeFixture()
    const container = new NodeContainer({ cwd: root })
    const helpers = container.feature('helpers') as any

    const warnSpy = spyOn(console, 'warn').mockImplementation(() => {})
    try {
      await helpers.discover('features')

      expect(helpers.loadErrors).toHaveLength(1)
      expect(helpers.loadErrors[0]).toMatchObject({ type: 'features', name: brokenFeatureName })
    } finally {
      warnSpy.mockRestore()
    }
  })
})
