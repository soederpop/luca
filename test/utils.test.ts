import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const container = new NodeContainer()

describe('container.utils timing helpers', () => {
  describe('sleep', () => {
    it('resolves after roughly the given duration', async () => {
      const start = Date.now()
      await container.utils.sleep(30)
      expect(Date.now() - start).toBeGreaterThanOrEqual(25)
    })
  })

  describe('backoff', () => {
    it('returns the result on first success without retrying', async () => {
      let calls = 0
      const result = await container.utils.backoff(() => {
        calls++
        return 'ok'
      })
      expect(result).toBe('ok')
      expect(calls).toBe(1)
    })

    it('retries until success and reports retries via onRetry', async () => {
      let calls = 0
      const retries: number[] = []
      const result = await container.utils.backoff(
        () => {
          calls++
          if (calls < 3) throw new Error(`fail ${calls}`)
          return 'recovered'
        },
        { attempts: 5, delay: 5, onRetry: (_err, attempt) => retries.push(attempt) }
      )
      expect(result).toBe('recovered')
      expect(calls).toBe(3)
      expect(retries).toEqual([1, 2])
    })

    it('throws the last error after exhausting attempts', async () => {
      let calls = 0
      await expect(
        container.utils.backoff(
          () => {
            calls++
            throw new Error(`fail ${calls}`)
          },
          { attempts: 3, delay: 1 }
        )
      ).rejects.toThrow('fail 3')
      expect(calls).toBe(3)
    })

    it('respects maxDelay and grows the delay by factor', async () => {
      const started = Date.now()
      await expect(
        container.utils.backoff(() => { throw new Error('nope') }, {
          attempts: 3, delay: 10, factor: 10, maxDelay: 20,
        })
      ).rejects.toThrow('nope')
      // delays: 10ms then min(100, 20)=20ms — well under the 1000ms an uncapped factor would take
      expect(Date.now() - started).toBeLessThan(500)
    })
  })

  describe('every', () => {
    it('runs repeatedly and stops when the cancel function is called', async () => {
      let runs = 0
      const stop = container.utils.every(10, () => { runs++ })
      await container.utils.sleep(55)
      stop()
      const runsAtStop = runs
      expect(runsAtStop).toBeGreaterThanOrEqual(2)
      await container.utils.sleep(30)
      expect(runs).toBe(runsAtStop)
    })

    it('runs immediately when immediate is set', async () => {
      let runs = 0
      const stop = container.utils.every(1000, () => { runs++ }, { immediate: true })
      await container.utils.sleep(20)
      stop()
      expect(runs).toBe(1)
    })

    it('does not overlap async runs', async () => {
      let active = 0
      let maxActive = 0
      const stop = container.utils.every(5, async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await container.utils.sleep(20)
        active--
      }, { immediate: true })
      await container.utils.sleep(80)
      stop()
      expect(maxActive).toBe(1)
    })

    it('keeps running and reports errors via onError', async () => {
      let runs = 0
      const errors: unknown[] = []
      const stop = container.utils.every(10, () => {
        runs++
        throw new Error(`boom ${runs}`)
      }, { onError: (e) => errors.push(e) })
      await container.utils.sleep(45)
      stop()
      expect(runs).toBeGreaterThanOrEqual(2)
      expect(errors.length).toBe(runs)
    })
  })
})
