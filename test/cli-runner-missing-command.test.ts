import { describe, it, expect, spyOn } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { runCli } from '../src/cli/runner'
import os from 'os'
import { join } from 'path'
import { mkdirSync } from 'fs'

function emptyTmp(): string {
  const dir = join(
    os.tmpdir(),
    `luca-cli-runner-missing-command-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(dir, { recursive: true })
  return dir
}

// A broken command is not the same phrase as an unknown one: it was found
// by discovery, it just couldn't import. runCli must report its own path
// and message and exit 1 without ever handing the phrase to a userland
// missing-command handler. This is the load-error branch — the handler
// contract itself (undefined/true/state-flag/custom-code/throwing) is
// covered separately once that behavior lands.
describe('runCli — command load errors', () => {
  it('prints the path and message, exits 1, and skips the missing-command handler entirely', async () => {
    const root = emptyTmp()
    const container = new NodeContainer({ cwd: root })
    const helpers = container.feature('helpers') as any

    // Seed the load error the way discovery would have recorded it, without
    // running real discovery — this isolates the runner's dispatch logic
    // from the discovery mechanism, which has its own coverage.
    const brokenPath = join(root, 'commands', 'broken.ts')
    helpers.state.set('loadErrors', [
      { type: 'commands', name: 'broken', path: brokenPath, message: "Cannot find module '../lib/does-not-exist'" },
    ])

    let handlerCalled = false
    container.state.set('missingCommandHandler', async () => {
      handlerCalled = true
    })

    ;(container.argv as any)._ = ['broken']

    const errSpy = spyOn(console, 'error').mockImplementation(() => {})
    const prevExitCode = process.exitCode
    try {
      await runCli(container, {
        loadGlobalCli: false,
        discoverLocalCommands: false,
        discoverUserHelpers: false,
        implicitRun: false,
      })

      expect(handlerCalled).toBe(false)
      expect(process.exitCode).toBe(1)

      const output = errSpy.mock.calls.map((c) => c.join(' ')).join('\n')
      expect(output).toContain("command 'broken' failed to load")
      expect(output).toContain(brokenPath)
      expect(output).toContain("Cannot find module '../lib/does-not-exist'")
    } finally {
      // Bun ignores `process.exitCode = undefined`, which would leave this
      // test's exit code 1 stuck on the whole test run.
      process.exitCode = prevExitCode ?? 0
      errSpy.mockRestore()
    }
  })

  it('falls through to the missing-command handler when there is no load error for the name', async () => {
    const root = emptyTmp()
    const container = new NodeContainer({ cwd: root })

    let handlerCalled = false
    container.state.set('missingCommandHandler', async () => {
      handlerCalled = true
    })

    ;(container.argv as any)._ = ['definitely-not-a-command']

    const prevExitCode = process.exitCode
    try {
      await runCli(container, {
        loadGlobalCli: false,
        discoverLocalCommands: false,
        discoverUserHelpers: false,
        implicitRun: false,
      })

      expect(handlerCalled).toBe(true)
    } finally {
      process.exitCode = prevExitCode ?? 0
    }
  })
})
