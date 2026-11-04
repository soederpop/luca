import { describe, expect, it } from 'bun:test'
import { Bus } from '../src/bus'
import { ClaudeCode } from '../src/agi/features/claude-code'
import { OpenAICodex } from '../src/agi/features/openai-codex'

/**
 * waitForSession on a fake harness: a Bus for events and a sessions map for
 * state, with the real method borrowed from the feature's prototype. Two
 * sessions awaited at once must each resolve on their own result. The old
 * code called off() with no listener when the first finished, which removed
 * the second waiter too and left it hanging forever.
 */
function fakeHarness(waitForSession: Function) {
  const bus = new Bus<any>()
  const sessions: Record<string, any> = {}
  const harness: any = {
    state: { current: { sessions } },
    on: (event: string, listener: any) => bus.on(event, listener),
    off: (event: string, listener?: any) => bus.off(event, listener),
    emit: (event: string, payload: any) => bus.emit(event, payload),
    waitForSession,
  }
  const start = (id: string) => { sessions[id] = { sessionId: id, status: 'running' } }
  const finish = (id: string, status: 'completed' | 'error' = 'completed') => {
    sessions[id].status = status
    bus.emit(status === 'error' ? 'session:error' : 'session:result', { sessionId: id })
  }
  return { harness, start, finish }
}

const settled = async (promise: Promise<unknown>) => {
  const marker = Symbol('pending')
  const outcome = await Promise.race([promise, new Promise((r) => setTimeout(() => r(marker), 20))])
  return outcome !== marker
}

for (const [name, method] of [
  ['ClaudeCode', ClaudeCode.prototype.waitForSession],
  ['OpenAICodex', OpenAICodex.prototype.waitForSession],
] as const) {
  describe(`${name}.waitForSession`, () => {
    it('resolves two concurrent waits independently', async () => {
      const { harness, start, finish } = fakeHarness(method)
      start('a'); start('b')
      const a = harness.waitForSession('a')
      const b = harness.waitForSession('b')

      finish('a')
      expect((await a).status).toBe('completed')
      expect(await settled(b)).toBe(false)

      finish('b')
      expect((await b).status).toBe('completed')
    })

    it('a finishing session does not remove the other waiter\'s error listener', async () => {
      const { harness, start, finish } = fakeHarness(method)
      start('a'); start('b')
      const a = harness.waitForSession('a')
      const b = harness.waitForSession('b')
      finish('b')
      await b
      finish('a', 'error')
      expect((await a).status).toBe('error')
    })

    it('returns a finished session at once', async () => {
      const { harness, start, finish } = fakeHarness(method)
      start('a'); finish('a')
      expect((await harness.waitForSession('a')).status).toBe('completed')
    })
  })
}
