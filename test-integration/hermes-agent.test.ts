import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import {
  requireBinary,
  describeWithRequirements,
  createAGIContainer,
  CLI_TIMEOUT,
} from './helpers'
import type { AGIContainer } from '../src/agi/container.server'

const hermesBin = requireBinary('hermes')

// The adapter boot alone takes ~15s (it loads MCP servers), plus inference
const HERMES_TIMEOUT = 180_000

describeWithRequirements('Hermes Agent Integration', [hermesBin], () => {
  let container: AGIContainer

  beforeAll(() => {
    container = createAGIContainer()
  })

  afterAll(async () => {
    const hermes = (container as any).feature('hermesAgent')
    await hermes.stopAdapter()
  })

  it(
    'checkAvailability confirms hermes is installed and captures the version',
    async () => {
      const hermes = (container as any).feature('hermesAgent')
      const available = await hermes.checkAvailability()
      expect(available).toBe(true)
      expect(hermes.state.current.hermesVersion).toMatch(/\d+\.\d+\.\d+/)
      expect(hermes.parsedVersion).toBeDefined()
    },
    CLI_TIMEOUT
  )

  it(
    'registers the hermesAcp client lazily',
    () => {
      ;(container as any).feature('hermesAgent')
      expect((container as any).clients.has('hermesAcp')).toBe(true)
    }
  )

  it(
    'run() completes a simple prompt and streams events',
    async () => {
      const hermes = (container as any).feature('hermesAgent')

      const events: Record<string, number> = {}
      for (const name of ['session:start', 'session:init', 'session:delta', 'session:result']) {
        hermes.on(name, () => { events[name] = (events[name] ?? 0) + 1 })
      }

      const session = await hermes.run('Reply with exactly: HERMES_TEST_OK. Do not use any tools.')

      expect(session).toBeDefined()
      expect(session.status).toBe('completed')
      expect(typeof session.result).toBe('string')
      expect(session.result).toContain('HERMES_TEST_OK')
      expect(session.acpSessionId).toBeDefined()
      expect(session.turns).toBe(1)

      expect(events['session:start']).toBe(1)
      expect(events['session:init']).toBe(1)
      expect(events['session:delta']).toBeGreaterThan(0)
      expect(events['session:result']).toBe(1)

      // Adapter stays up for reuse
      expect(hermes.state.current.adapterRunning).toBe(true)

      // Token usage is reported (no cost accounting in hermes)
      const usage = hermes.usage(session.id)
      expect(usage.sessionCount).toBe(1)
      expect(usage.totalTokens).toBeGreaterThan(0)
    },
    HERMES_TIMEOUT
  )

  it(
    'reuses the running adapter for a second run',
    async () => {
      const hermes = (container as any).feature('hermesAgent')
      expect(hermes.state.current.adapterRunning).toBe(true)

      const startedAt = Date.now()
      const session = await hermes.run('Reply with exactly: SECOND_RUN_OK. Do not use any tools.')

      expect(session.status).toBe('completed')
      expect(session.result).toContain('SECOND_RUN_OK')
      // No 15s adapter boot this time — generous bound to avoid flakes
      expect(Date.now() - startedAt).toBeLessThan(60_000)
    },
    HERMES_TIMEOUT
  )

  it(
    'abort() cancels a running session',
    async () => {
      const hermes = (container as any).feature('hermesAgent')

      const aborted: string[] = []
      hermes.on('session:abort', ({ sessionId }: { sessionId: string }) => aborted.push(sessionId))

      const sessionId = await hermes.start('Count from 1 to 100000 slowly, one number per line.')

      // Wait until the ACP session exists, then cancel
      await new Promise<void>((resolve) => {
        hermes.on('session:init', ({ sessionId: sid }: { sessionId: string }) => {
          if (sid === sessionId) resolve()
        })
      })
      hermes.abort(sessionId)

      const session = await hermes.waitForSession(sessionId)
      expect(session.status).toBe('error')
      expect(session.error).toContain('Aborted')
      expect(aborted).toContain(sessionId)
    },
    HERMES_TIMEOUT
  )

  it(
    'reads session history from the hermes session store',
    async () => {
      const hermes = (container as any).feature('hermesAgent')
      const acpSessionId = hermes.sessionId
      if (!acpSessionId) return // no prior run — nothing to assert

      const history = await hermes.getSessionHistory(acpSessionId)
      expect(Array.isArray(history)).toBe(true)
    },
    CLI_TIMEOUT
  )

  it(
    'lists sessions from the hermes session store',
    async () => {
      const hermes = (container as any).feature('hermesAgent')
      const { raw, lines } = await hermes.listSessions({ limit: 5 })
      expect(typeof raw).toBe('string')
      expect(Array.isArray(lines)).toBe(true)
    },
    CLI_TIMEOUT
  )
})
