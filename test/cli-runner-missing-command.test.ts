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

})

// The handler claim contract: a userland onMissingCommand handler takes
// responsibility for the exit code by returning `true` / `{ handled: true }`,
// or by setting `missingCommandHandled` on state for an async handoff.
// Anything else and runCli sets process.exitCode = 1 once the handler
// returns, unless the handler already left a non-zero code behind. Every
// handler shipped in this codebase (root luca.cli.ts, agentic-loop's, the
// bootstrap template) falls back to help without claiming the phrase, so
// this is what makes an unknown command exit 1 for all of them without any
// change on their part.
describe('runCli — missing-command handler claim contract', () => {
  // `makeHandler` receives the container so a handler can close over it
  // (e.g. to set a state flag on itself) before it's wired up.
  async function runWithHandler(makeHandler: (container: any) => any) {
    const root = emptyTmp()
    const container = new NodeContainer({ cwd: root })
    container.state.set('missingCommandHandler', makeHandler(container))
    ;(container.argv as any)._ = ['definitely-not-a-command']

    const prevExitCode = process.exitCode
    try {
      await runCli(container, {
        loadGlobalCli: false,
        discoverLocalCommands: false,
        discoverUserHelpers: false,
        implicitRun: false,
      })
      return { container, exitCode: process.exitCode }
    } finally {
      process.exitCode = prevExitCode ?? 0
    }
  }

  it('a handler returning undefined gives exit 1 and receives { words, phrase, argv }', async () => {
    let received: any = null
    const { exitCode } = await runWithHandler(() => async (payload: any) => {
      received = payload
    })

    expect(exitCode).toBe(1)
    expect(received.words).toEqual(['definitely-not-a-command'])
    expect(received.phrase).toBe('definitely-not-a-command')
    expect(received.argv).toBeTruthy()
    expect(received.argv._).toEqual(['definitely-not-a-command'])
  })

  it('a handler returning true claims the phrase and keeps exit 0', async () => {
    const { exitCode } = await runWithHandler(() => async () => true)
    // bun's test runner leaves process.exitCode at 0 (not undefined) once
    // any earlier test has touched it, so "kept 0" is asserted as falsy
    // rather than strictly undefined.
    expect(exitCode).toBeFalsy()
  })

  it('a handler returning { handled: true } claims the phrase and keeps exit 0', async () => {
    const { exitCode } = await runWithHandler(() => async () => ({ handled: true }))
    expect(exitCode).toBeFalsy()
  })

  it('a handler setting the missingCommandHandled state flag claims the phrase and keeps exit 0', async () => {
    // Simulates an async handoff: the handler itself returns nothing
    // meaningful, but flags the phrase as handled on the container before
    // it resolves.
    const { exitCode } = await runWithHandler((container) => async () => {
      container.state.set('missingCommandHandled', true)
    })
    expect(exitCode).toBeFalsy()
  })

  it('a handler that sets a custom non-zero exit code keeps it', async () => {
    const { exitCode } = await runWithHandler(() => async () => {
      process.exitCode = 3
    })
    expect(exitCode).toBe(3)
  })

  it('a throwing handler logs the error and gives exit 1', async () => {
    const errSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { exitCode } = await runWithHandler(() => async () => {
        throw new Error('handler blew up')
      })
      expect(exitCode).toBe(1)
      const output = errSpy.mock.calls.map((c) => c.join(' ')).join('\n')
      expect(output).toContain('handler blew up')
    } finally {
      errSpy.mockRestore()
    }
  })

  it('bare luca with no command keeps exit 0', async () => {
    const root = emptyTmp()
    const container = new NodeContainer({ cwd: root })
    container.state.set('missingCommandHandler', async () => {
      throw new Error('should never be called for an empty command line')
    })
    ;(container.argv as any)._ = []

    const prevExitCode = process.exitCode
    try {
      await runCli(container, {
        loadGlobalCli: false,
        discoverLocalCommands: false,
        discoverUserHelpers: false,
        implicitRun: false,
      })
      // Bare `luca` never touches process.exitCode at all — it should come
      // out exactly as it went in.
      expect(process.exitCode).toBe(prevExitCode)
    } finally {
      process.exitCode = prevExitCode ?? 0
    }
  })

  it('no handler registered at all still exits 1 for an unknown command', async () => {
    const root = emptyTmp()
    const container = new NodeContainer({ cwd: root })
    ;(container.argv as any)._ = ['definitely-not-a-command']

    const prevExitCode = process.exitCode
    try {
      await runCli(container, {
        loadGlobalCli: false,
        discoverLocalCommands: false,
        discoverUserHelpers: false,
        implicitRun: false,
      })
      expect(process.exitCode).toBe(1)
    } finally {
      process.exitCode = prevExitCode ?? 0
    }
  })
})
