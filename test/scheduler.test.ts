import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const container = new NodeContainer()
const scheduler = container.feature('scheduler')
const sleep = container.utils.sleep

describe('scheduler feature', () => {
  describe('parseDuration', () => {
    it('parses duration strings into milliseconds', () => {
      expect(scheduler.parseDuration('250ms')).toBe(250)
      expect(scheduler.parseDuration('30s')).toBe(30_000)
      expect(scheduler.parseDuration('5m')).toBe(300_000)
      expect(scheduler.parseDuration('1h30m')).toBe(5_400_000)
      expect(scheduler.parseDuration('2d')).toBe(172_800_000)
    })

    it('passes numbers and numeric strings through as milliseconds', () => {
      expect(scheduler.parseDuration(250)).toBe(250)
      expect(scheduler.parseDuration('250')).toBe(250)
    })

    it('throws on invalid durations', () => {
      expect(() => scheduler.parseDuration('abc')).toThrow('Invalid duration')
      expect(() => scheduler.parseDuration('5 parsecs')).toThrow('Invalid duration')
      expect(() => scheduler.parseDuration(-5)).toThrow('Invalid duration')
    })
  })

  describe('nextCronDate', () => {
    // 2026-07-03 10:07 local time is a Friday
    const from = new Date(2026, 6, 3, 10, 7)

    it('finds the next minute step in the same hour', () => {
      expect(scheduler.nextCronDate('*/15 * * * *', from)).toEqual(new Date(2026, 6, 3, 10, 15))
    })

    it('rolls over to the next day when the time has passed', () => {
      expect(scheduler.nextCronDate('0 9 * * *', from)).toEqual(new Date(2026, 6, 4, 9, 0))
    })

    it('supports day names and finds the next weekday', () => {
      expect(scheduler.nextCronDate('30 14 * * mon', from)).toEqual(new Date(2026, 6, 6, 14, 30))
    })

    it('supports ranges with day names', () => {
      // 10:08 on a Friday is still within mon-fri
      expect(scheduler.nextCronDate('* * * * mon-fri', from)).toEqual(new Date(2026, 6, 3, 10, 8))
    })

    it('supports @aliases', () => {
      expect(scheduler.nextCronDate('@daily', from)).toEqual(new Date(2026, 6, 4, 0, 0))
      expect(scheduler.nextCronDate('@hourly', from)).toEqual(new Date(2026, 6, 3, 11, 0))
    })

    it('applies the standard OR rule when both day fields are restricted', () => {
      // day-of-month 13 OR Friday — the next Friday (Jul 10) comes before Jul 13
      expect(scheduler.nextCronDate('0 0 13 * fri', from)).toEqual(new Date(2026, 6, 10, 0, 0))
    })

    it('returns a date strictly after from', () => {
      const exactMatch = new Date(2026, 6, 3, 10, 7, 0, 0)
      expect(scheduler.nextCronDate('* * * * *', exactMatch)).toEqual(new Date(2026, 6, 3, 10, 8))
    })

    it('throws on invalid expressions', () => {
      expect(() => scheduler.nextCronDate('61 * * * *', from)).toThrow('out of range')
      expect(() => scheduler.nextCronDate('* * * *', from)).toThrow('expected 5 fields')
      expect(() => scheduler.nextCronDate('* * * * frog', from)).toThrow('not a number')
    })

    it('throws on expressions that never match', () => {
      expect(() => scheduler.nextCronDate('0 0 30 2 *', from)).toThrow('never matches')
    })
  })

  describe('every', () => {
    it('runs repeatedly, tracks runs, and stops via the handle', async () => {
      const task = scheduler.every(10, () => {}, { name: 'every-basic' })
      await sleep(55)
      task.stop()
      const runsAtStop = task.info.runs
      expect(runsAtStop).toBeGreaterThanOrEqual(2)
      expect(task.info.active).toBe(false)
      await sleep(30)
      expect(task.info.runs).toBe(runsAtStop)
    })

    it('accepts duration strings and runs immediately when asked', async () => {
      const task = scheduler.every('1h', () => {}, { name: 'every-immediate', immediate: true })
      await sleep(20)
      expect(task.info.runs).toBe(1)
      expect(task.info.nextRun).toBeGreaterThan(Date.now())
      task.stop()
    })

    it('never overlaps slow async runs', async () => {
      let active = 0
      let maxActive = 0
      const task = scheduler.every(5, async () => {
        active++
        maxActive = Math.max(maxActive, active)
        await sleep(20)
        active--
      }, { name: 'every-overlap', immediate: true })
      await sleep(80)
      task.stop()
      expect(maxActive).toBe(1)
    })

    it('records errors, emits task:error, and stays scheduled', async () => {
      const events: string[] = []
      const errors: unknown[] = []
      scheduler.on('task:error', (name: string, error: unknown) => {
        if (name === 'every-errors') events.push(String(error))
      })
      const task = scheduler.every(10, () => {
        throw new Error('boom')
      }, { name: 'every-errors', onError: (e) => errors.push(e) })
      await sleep(45)
      task.stop()
      expect(task.info.runs).toBeGreaterThanOrEqual(2)
      expect(task.info.errors).toBe(task.info.runs)
      expect(task.info.lastError).toBe('boom')
      expect(errors.length).toBe(task.info.runs)
      expect(events.length).toBe(task.info.runs)
    })

    it('rejects a duplicate active task name, and frees the name on stop', () => {
      const task = scheduler.every('1h', () => {}, { name: 'every-dup' })
      expect(() => scheduler.every('1h', () => {}, { name: 'every-dup' })).toThrow("already scheduled")
      task.stop()
      const again = scheduler.every('1h', () => {}, { name: 'every-dup' })
      expect(again.info.active).toBe(true)
      again.stop()
    })
  })

  describe('at / in', () => {
    it('runs once and deactivates', async () => {
      let runs = 0
      const task = scheduler.in(15, () => { runs++ }, { name: 'in-once' })
      expect(task.info.active).toBe(true)
      await sleep(50)
      expect(runs).toBe(1)
      expect(task.info.active).toBe(false)
      expect(task.info.runs).toBe(1)
    })

    it('fires immediately for dates in the past', async () => {
      let ran = false
      scheduler.at(Date.now() - 1000, () => { ran = true }, { name: 'at-past' })
      await sleep(20)
      expect(ran).toBe(true)
    })

    it('throws on invalid dates', () => {
      expect(() => scheduler.at('not a date', () => {})).toThrow('Invalid date')
    })
  })

  describe('cron scheduling', () => {
    it('validates the expression before registering the task', () => {
      expect(() => scheduler.cron('nope', () => {})).toThrow('Invalid cron expression')
      expect(scheduler.tasks.find((t) => t.spec === 'nope')).toBeUndefined()
    })

    it('schedules a task with the next run set from the expression', () => {
      const task = scheduler.cron('*/5 * * * *', () => {}, { name: 'cron-basic' })
      expect(task.info.nextRun).toBeGreaterThan(Date.now())
      expect(task.info.type).toBe('cron')
      task.stop()
    })
  })

  describe('task management', () => {
    it('lists task snapshots and stops everything with stopAll', async () => {
      scheduler.every('1h', () => {}, { name: 'mgmt-a' })
      scheduler.every('1h', () => {}, { name: 'mgmt-b' })
      const names = scheduler.tasks.map((t) => t.name)
      expect(names).toContain('mgmt-a')
      expect(names).toContain('mgmt-b')

      const stopped = scheduler.stopAll()
      expect(stopped).toBeGreaterThanOrEqual(2)
      expect(scheduler.tasks.every((t) => !t.active)).toBe(true)
      expect(scheduler.state.get('taskCount')).toBe(0)
    })

    it('stop() returns false for unknown or already-stopped tasks', () => {
      expect(scheduler.stop('never-existed')).toBe(false)
      const task = scheduler.every('1h', () => {}, { name: 'mgmt-stop-twice' })
      expect(scheduler.stop('mgmt-stop-twice')).toBe(true)
      expect(scheduler.stop('mgmt-stop-twice')).toBe(false)
      task.stop() // safe no-op
    })
  })

  describe('run (daemon lifecycle)', () => {
    it('resolves on a shutdown signal, stopping all tasks and running onShutdown', async () => {
      let cleanedUp = false
      const task = scheduler.every(10, () => {}, { name: 'daemon-loop' })
      const running = scheduler.run({ onShutdown: () => { cleanedUp = true } })
      await sleep(30)
      expect(scheduler.state.get('running')).toBe(true)

      process.emit('SIGINT' as any)
      const signal = await running
      expect(signal).toBe('SIGINT')
      expect(cleanedUp).toBe(true)
      expect(task.info.active).toBe(false)
      expect(scheduler.state.get('running')).toBe(false)
    })
  })
})
