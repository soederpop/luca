import { z } from 'zod'
import { Feature } from '../feature.js'
import { FeatureEventsSchema, FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

export const SchedulerStateSchema = FeatureStateSchema.extend({
  /** Number of currently active scheduled tasks */
  taskCount: z.number().default(0).describe('Number of currently active scheduled tasks'),
  /** Whether run() is holding the process open as a daemon */
  running: z.boolean().default(false).describe('Whether run() is holding the process open as a daemon'),
})
export type SchedulerState = z.infer<typeof SchedulerStateSchema>

export const SchedulerOptionsSchema = FeatureOptionsSchema.extend({})
export type SchedulerOptions = z.infer<typeof SchedulerOptionsSchema>

export const SchedulerEventsSchema = FeatureEventsSchema.extend({
  'task:added': z.tuple([z.string().describe('Task name')]).describe('Emitted when a task is scheduled'),
  'task:run': z.tuple([z.string().describe('Task name')]).describe('Emitted after a task run completes (success or error)'),
  'task:error': z.tuple([
    z.string().describe('Task name'),
    z.any().describe('The error the task threw'),
  ]).describe('Emitted when a task run throws. The task stays scheduled and keeps running'),
  'task:stopped': z.tuple([z.string().describe('Task name')]).describe('Emitted when a task is stopped'),
  shutdown: z.tuple([z.string().describe('The signal that triggered the shutdown')]).describe('Emitted when run() shuts down in response to a signal'),
}).describe('Scheduler events')

export const ScheduledTaskInfoSchema = z.object({
  name: z.string().describe('Unique task name'),
  type: z.enum(['every', 'cron', 'at']).describe('How the task was scheduled'),
  spec: z.string().describe('The schedule spec as given: a duration, a cron expression, or an ISO date'),
  active: z.boolean().describe('Whether the task is still scheduled to run'),
  running: z.boolean().describe('Whether the task function is executing right now'),
  runs: z.number().describe('How many times the task has run'),
  errors: z.number().describe('How many runs ended in an error'),
  lastRun: z.number().optional().describe('Timestamp (ms since epoch) of the most recent run'),
  lastError: z.string().optional().describe('Message from the most recent error, if any'),
  nextRun: z.number().optional().describe('Timestamp (ms since epoch) of the next scheduled run'),
}).describe('A snapshot of a scheduled task')
export type ScheduledTaskInfo = z.infer<typeof ScheduledTaskInfoSchema>

/** Handle returned by every(), cron(), at(), and in(). */
export interface TaskHandle {
  /** The task's unique name — pass to scheduler.stop() or find it in scheduler.tasks */
  name: string
  /** Cancel the task. Safe to call more than once. */
  stop: () => void
  /** Live snapshot of the task's schedule and run history */
  readonly info: ScheduledTaskInfo
}

/** Options accepted by every(), cron(), at(), and in(). */
export interface ScheduleTaskOptions {
  /** Unique name for the task (defaults to an auto-generated one). Scheduling a second active task with the same name throws. */
  name?: string
  /** Called when a run throws. The task keeps its schedule either way; errors are also recorded on the task and emitted as 'task:error'. */
  onError?: (error: unknown) => void
}

/** Options accepted by every() only. */
export interface EveryTaskOptions extends ScheduleTaskOptions {
  /** Run the task immediately instead of waiting for the first interval (default: false) */
  immediate?: boolean
}

/** Options accepted by run(). */
export interface SchedulerRunOptions {
  /** Signals that trigger shutdown (default: SIGINT and SIGTERM) */
  signals?: NodeJS.Signals[]
  /** Awaited after tasks stop, before run() resolves — put cleanup here */
  onShutdown?: (signal: string) => void | Promise<void>
}

interface TaskRecord {
  name: string
  type: 'every' | 'cron' | 'at'
  spec: string
  active: boolean
  running: boolean
  runs: number
  errors: number
  lastRun?: number
  lastError?: string
  nextRun?: number
  timer?: ReturnType<typeof setTimeout>
  fn: () => any | Promise<any>
  onError?: (error: unknown) => void
}

const MAX_TIMEOUT = 2 ** 31 - 1

const DURATION_UNITS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
}

const CRON_ALIASES: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
}

const MONTH_NAMES: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
}

const DAY_NAMES: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}

interface CronSpec {
  minutes: Set<number>
  hours: Set<number>
  daysOfMonth: Set<number>
  months: Set<number>
  daysOfWeek: Set<number>
  domRestricted: boolean
  dowRestricted: boolean
}

/**
 * In-process task scheduler: recurring intervals, cron expressions, and one-shot
 * timers as named, observable, stoppable tasks — plus the daemon lifecycle
 * (`run()`) that keeps a long-running command alive until SIGINT/SIGTERM.
 *
 * This is the managed layer above `container.utils.sleep/backoff/every`. Reach
 * for the utils when you need a bare poll loop inside other code; reach for the
 * scheduler when tasks should have names, run history, error tracking, and a
 * single shutdown path.
 *
 * Intervals accept milliseconds or duration strings (`'30s'`, `'5m'`, `'1h30m'`).
 * Cron expressions use standard 5-field syntax (minute hour day-of-month month
 * day-of-week) with lists, ranges, steps, names (`mon`, `jan`), and aliases
 * (`@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`). Cron dates evaluate
 * in local time. A task's next run is never scheduled until the previous run
 * finishes, so slow ticks don't overlap. A run that throws is recorded and
 * emitted as `task:error`, and the task stays on schedule.
 *
 * @example
 * ```typescript
 * const scheduler = container.feature('scheduler')
 *
 * scheduler.every('5m', syncOnce, { name: 'sync', immediate: true })
 * scheduler.cron('0 9 * * mon-fri', sendDigest, { name: 'digest' })
 * scheduler.in('30s', warmCache)
 *
 * // Daemon: keeps the process alive, stops all tasks on SIGINT/SIGTERM
 * await scheduler.run()
 * ```
 *
 * @example
 * ```typescript
 * // Observability: every task has a name, run counts, and error history
 * const handle = scheduler.every('10s', pollQueue)
 * console.log(handle.info)     // live snapshot: { name, runs, errors, lastError, nextRun, ... }
 * console.log(scheduler.tasks) // [{ name, type, spec, runs, errors, lastRun, nextRun, ... }]
 * handle.stop()
 * ```
 */
export class Scheduler extends Feature<SchedulerState, SchedulerOptions> {
  static override shortcut = 'features.scheduler' as const
  static override stability = 'stable' as const
  static override stateSchema = SchedulerStateSchema
  static override optionsSchema = SchedulerOptionsSchema
  static override eventsSchema = SchedulerEventsSchema
  static { Feature.register(this, 'scheduler') }

  private _tasks = new Map<string, TaskRecord>()
  private _anonCounter = 0

  /**
   * Snapshots of every task this scheduler knows about, including finished
   * one-shots and stopped tasks (check `active`).
   * @example
   * ```typescript
   * const stuck = scheduler.tasks.filter(t => t.active && t.errors > 0)
   * ```
   */
  get tasks(): ScheduledTaskInfo[] {
    return Array.from(this._tasks.values()).map((task) => this._snapshot(task))
  }

  /**
   * Parse a duration into milliseconds. Accepts a number (passed through),
   * a numeric string (`'250'`), or a duration string combining units:
   * `ms`, `s`, `m`, `h`, `d`, `w` — e.g. `'30s'`, `'5m'`, `'1h30m'`, `'2d'`.
   * @param input - The duration to parse
   * @returns The duration in milliseconds
   * @throws Error when the string is not a valid duration
   * @example
   * ```typescript
   * scheduler.parseDuration('1h30m') // 5400000
   * scheduler.parseDuration(250)     // 250
   * ```
   */
  parseDuration(input: string | number): number {
    if (typeof input === 'number') {
      if (!Number.isFinite(input) || input < 0) throw new Error(`Invalid duration: ${input}`)
      return input
    }
    const str = input.trim()
    if (/^\d+(\.\d+)?$/.test(str)) return Number(str)

    const pattern = /(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)/g
    let total = 0
    let matchedLength = 0
    for (const match of str.matchAll(pattern)) {
      total += Number(match[1]) * DURATION_UNITS[match[2]!]!
      matchedLength += match[0].length
    }
    const leftover = str.replace(pattern, '').trim()
    if (matchedLength === 0 || leftover.length > 0) {
      throw new Error(`Invalid duration: '${input}'. Use milliseconds or a duration string like '30s', '5m', '1h30m'`)
    }
    return total
  }

  /**
   * Run a function on a recurring interval as a named task. Uses the
   * recursive-setTimeout idiom: the next run is scheduled only after the
   * previous one finishes, so runs never overlap.
   * @param interval - Milliseconds or a duration string ('30s', '5m', '1h30m')
   * @param fn - The function to run (sync or async)
   * @param options - Task name, immediate first run, and error handler
   * @returns A handle with the task's name, a stop() function, and a live info snapshot
   * @example
   * ```typescript
   * const poll = scheduler.every('30s', async () => { await syncOnce() }, {
   *   name: 'sync',
   *   immediate: true,
   * })
   * // later
   * poll.stop() // or scheduler.stop('sync')
   * ```
   */
  every(interval: string | number, fn: () => any | Promise<any>, options: EveryTaskOptions = {}): TaskHandle {
    const ms = this.parseDuration(interval)
    const spec = typeof interval === 'number' ? `${interval}ms` : interval
    const task = this._createTask('every', spec, fn, options)

    const schedule = () => {
      task.nextRun = Date.now() + ms
      task.timer = setTimeout(tick, ms)
    }
    const tick = async () => {
      if (!task.active) return
      await this._execute(task)
      if (task.active) schedule()
    }

    if (options.immediate) {
      tick()
    } else {
      schedule()
    }
    return this._handle(task)
  }

  /**
   * Run a function on a cron schedule as a named task. Standard 5-field
   * syntax (minute hour day-of-month month day-of-week) with lists (`1,15`),
   * ranges (`mon-fri`), steps (`0-59/15`, and star-with-step), month/day
   * names, and `@hourly`-style aliases. Day-of-month and day-of-week follow the standard rule: when both
   * are restricted, the task runs when either matches. Times are local. Invalid
   * expressions throw immediately with the reason — before the task is registered.
   * @param expression - A 5-field cron expression or alias like '@daily'
   * @param fn - The function to run (sync or async)
   * @param options - Task name and error handler
   * @returns A handle with the task's name, a stop() function, and a live info snapshot
   * @throws Error when the cron expression is invalid
   * @example
   * ```typescript
   * scheduler.cron('0-59/15 * * * *', rotateLogs)           // every 15 minutes
   * scheduler.cron('0 9 * * mon-fri', digest, { name: 'digest' }) // weekdays at 9am
   * scheduler.cron('@daily', cleanup)
   * ```
   */
  cron(expression: string, fn: () => any | Promise<any>, options: ScheduleTaskOptions = {}): TaskHandle {
    this._parseCron(expression) // validate before registering
    const task = this._createTask('cron', expression, fn, options)

    const scheduleNext = () => {
      const next = this.nextCronDate(expression)
      task.nextRun = next.getTime()
      this._armAt(task, next, async () => {
        await this._execute(task)
        if (task.active) scheduleNext()
      })
    }
    scheduleNext()
    return this._handle(task)
  }

  /**
   * Run a function once at a specific time. One-shots deactivate after they
   * fire (`active` becomes false) but stay visible in scheduler.tasks.
   * @param when - A Date, a timestamp in ms, or an ISO date string
   * @param fn - The function to run (sync or async)
   * @param options - Task name and error handler
   * @returns A handle with the task's name, a stop() function, and a live info snapshot
   * @throws Error when the date is invalid
   * @example
   * ```typescript
   * scheduler.at(new Date('2026-07-04T09:00:00'), sendReminder)
   * ```
   */
  at(when: Date | string | number, fn: () => any | Promise<any>, options: ScheduleTaskOptions = {}): TaskHandle {
    const date = when instanceof Date ? when : new Date(when)
    if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: '${when}'`)
    const task = this._createTask('at', date.toISOString(), fn, options)

    task.nextRun = date.getTime()
    this._armAt(task, date, async () => {
      await this._execute(task)
      this._deactivate(task)
    })
    return this._handle(task)
  }

  /**
   * Run a function once after a delay. Sugar for at(Date.now() + duration).
   * @param delay - Milliseconds or a duration string ('30s', '5m')
   * @param fn - The function to run (sync or async)
   * @param options - Task name and error handler
   * @returns A handle with the task's name, a stop() function, and a live info snapshot
   * @example
   * ```typescript
   * scheduler.in('30s', () => console.log('half a minute later'))
   * ```
   */
  in(delay: string | number, fn: () => any | Promise<any>, options: ScheduleTaskOptions = {}): TaskHandle {
    return this.at(Date.now() + this.parseDuration(delay), fn, options)
  }

  /**
   * Stop a task by name. Safe to call for unknown or already-stopped tasks.
   * @param name - The task name (from the handle or scheduler.tasks)
   * @returns true if an active task was stopped, false otherwise
   * @example
   * ```typescript
   * scheduler.stop('sync')
   * ```
   */
  stop(name: string): boolean {
    const task = this._tasks.get(name)
    if (!task || !task.active) return false
    this._deactivate(task)
    this.emit('task:stopped', task.name)
    return true
  }

  /**
   * Stop every active task. Called automatically when run() receives a
   * shutdown signal.
   * @returns The number of tasks stopped
   * @example
   * ```typescript
   * scheduler.stopAll()
   * ```
   */
  stopAll(): number {
    let stopped = 0
    for (const task of this._tasks.values()) {
      if (task.active) {
        this._deactivate(task)
        this.emit('task:stopped', task.name)
        stopped++
      }
    }
    return stopped
  }

  /**
   * Keep the process alive until a shutdown signal arrives, then stop all
   * tasks and resolve. This is the daemon lifecycle for long-running
   * commands — no `await new Promise(() => {})` needed.
   * @param options - Signals to listen for (default SIGINT/SIGTERM) and an onShutdown cleanup hook
   * @returns The name of the signal that triggered shutdown
   * @example
   * ```typescript
   * scheduler.every('1m', poll, { name: 'poller', immediate: true })
   * const signal = await scheduler.run({
   *   onShutdown: async () => { await flushBuffers() },
   * })
   * console.log(`shut down on ${signal}`)
   * ```
   */
  async run(options: SchedulerRunOptions = {}): Promise<string> {
    const signals = options.signals ?? ['SIGINT', 'SIGTERM']
    this.setState({ running: true })

    return new Promise<string>((resolve) => {
      const keepAlive = setInterval(() => {}, 60_000)
      const handlers = new Map<NodeJS.Signals, () => void>()
      const shutdown = async (signal: string) => {
        for (const [sig, handler] of handlers) process.off(sig, handler)
        clearInterval(keepAlive)
        this.stopAll()
        this.setState({ running: false })
        this.emit('shutdown', signal)
        await options.onShutdown?.(signal)
        resolve(signal)
      }
      for (const sig of signals) {
        const handler = () => { shutdown(sig) }
        handlers.set(sig, handler)
        process.on(sig, handler)
      }
    })
  }

  /**
   * Compute the next date a cron expression fires, in local time. Useful for
   * showing "next run" without scheduling anything.
   * @param expression - A 5-field cron expression or alias like '@daily'
   * @param from - The reference time (default: now). The result is strictly after this.
   * @returns The next matching Date
   * @throws Error when the expression is invalid or can never match (e.g. '0 0 30 2 *')
   * @example
   * ```typescript
   * scheduler.nextCronDate('0 9 * * mon') // next Monday 09:00 local time
   * ```
   */
  nextCronDate(expression: string, from: Date = new Date()): Date {
    const spec = this._parseCron(expression)
    const date = new Date(from.getTime())
    date.setSeconds(0, 0)
    date.setMinutes(date.getMinutes() + 1)

    const limit = from.getTime() + 4 * 366 * 86_400_000
    while (date.getTime() <= limit) {
      if (!spec.months.has(date.getMonth() + 1) || !this._dayMatches(spec, date)) {
        date.setDate(date.getDate() + 1)
        date.setHours(0, 0, 0, 0)
        continue
      }
      if (!spec.hours.has(date.getHours())) {
        date.setHours(date.getHours() + 1, 0, 0, 0)
        continue
      }
      if (!spec.minutes.has(date.getMinutes())) {
        date.setMinutes(date.getMinutes() + 1)
        continue
      }
      return date
    }
    throw new Error(`Cron expression '${expression}' never matches a date`)
  }

  /** Whether a date satisfies the day-of-month/day-of-week fields, applying the standard both-restricted-means-OR rule. */
  private _dayMatches(spec: CronSpec, date: Date): boolean {
    const domMatch = spec.daysOfMonth.has(date.getDate())
    const dowMatch = spec.daysOfWeek.has(date.getDay())
    if (spec.domRestricted && spec.dowRestricted) return domMatch || dowMatch
    if (spec.domRestricted) return domMatch
    if (spec.dowRestricted) return dowMatch
    return true
  }

  /** Parse and validate a 5-field cron expression (or @alias) into value sets. */
  private _parseCron(expression: string): CronSpec {
    const expr = CRON_ALIASES[expression.trim().toLowerCase()] ?? expression.trim()
    const fields = expr.split(/\s+/)
    if (fields.length !== 5) {
      throw new Error(`Invalid cron expression '${expression}': expected 5 fields (minute hour day-of-month month day-of-week), got ${fields.length}`)
    }
    const [minute, hour, dom, month, dow] = fields as [string, string, string, string, string]
    return {
      minutes: this._parseCronField(minute, 0, 59, expression),
      hours: this._parseCronField(hour, 0, 23, expression),
      daysOfMonth: this._parseCronField(dom, 1, 31, expression),
      months: this._parseCronField(month, 1, 12, expression, MONTH_NAMES),
      daysOfWeek: this._parseCronField(dow, 0, 7, expression, DAY_NAMES, true),
      domRestricted: dom !== '*',
      dowRestricted: dow !== '*',
    }
  }

  /** Parse one cron field (lists, ranges, steps, names) into the set of matching values. */
  private _parseCronField(
    field: string,
    min: number,
    max: number,
    expression: string,
    names?: Record<string, number>,
    sundayWraps = false,
  ): Set<number> {
    const values = new Set<number>()
    const fail = (why: string): never => {
      throw new Error(`Invalid cron expression '${expression}': ${why}`)
    }
    const toNumber = (token: string): number => {
      const named = names?.[token.toLowerCase()]
      if (named != null) return named
      if (!/^\d+$/.test(token)) fail(`'${token}' is not a number${names ? ' or a name' : ''}`)
      const value = Number(token)
      if (value < min || value > max) fail(`'${token}' is out of range ${min}-${max}`)
      return value
    }

    for (const part of field.split(',')) {
      const [rangeToken, stepToken, ...extra] = part.split('/')
      if (extra.length > 0 || rangeToken === '' || stepToken === '') fail(`malformed field '${part}'`)
      const step = stepToken != null ? Number(stepToken) : 1
      if (!Number.isInteger(step) || step < 1) fail(`invalid step in '${part}'`)

      let start: number
      let end: number
      if (rangeToken === '*') {
        start = min
        end = max
      } else if (rangeToken!.includes('-')) {
        const [low, high, ...rest] = rangeToken!.split('-')
        if (rest.length > 0 || !low || !high) fail(`malformed range '${rangeToken}'`)
        start = toNumber(low!)
        end = toNumber(high!)
        if (start > end) fail(`range '${rangeToken}' is backwards`)
      } else {
        start = toNumber(rangeToken!)
        end = stepToken != null ? max : start
      }

      for (let value = start; value <= end; value += step) {
        values.add(sundayWraps && value === 7 ? 0 : value)
      }
    }
    return values
  }

  /** Register a task record, enforcing unique names among active tasks. */
  private _createTask(
    type: TaskRecord['type'],
    spec: string,
    fn: () => any | Promise<any>,
    options: ScheduleTaskOptions,
  ): TaskRecord {
    const name = options.name ?? `${type}:${spec}:${++this._anonCounter}`
    const existing = this._tasks.get(name)
    if (existing?.active) {
      throw new Error(`A task named '${name}' is already scheduled. Stop it first or pick another name.`)
    }
    const task: TaskRecord = {
      name, type, spec,
      active: true,
      running: false,
      runs: 0,
      errors: 0,
      fn,
      onError: options.onError,
    }
    this._tasks.set(name, task)
    this._syncTaskCount()
    this.emit('task:added', name)
    return task
  }

  /** Run a task's function once, recording the outcome. Errors never escape — they are recorded, emitted, and passed to onError. */
  private async _execute(task: TaskRecord): Promise<void> {
    task.running = true
    try {
      await task.fn()
    } catch (error) {
      task.errors++
      task.lastError = error instanceof Error ? error.message : String(error)
      this.emit('task:error', task.name, error)
      task.onError?.(error)
    } finally {
      task.running = false
      task.runs++
      task.lastRun = Date.now()
      this.emit('task:run', task.name)
    }
  }

  /** Arm a timer to fire at a specific date, chaining timeouts past the ~24.8-day setTimeout ceiling. */
  private _armAt(task: TaskRecord, when: Date, fire: () => void): void {
    const delay = when.getTime() - Date.now()
    if (delay > MAX_TIMEOUT) {
      task.timer = setTimeout(() => this._armAt(task, when, fire), MAX_TIMEOUT)
    } else {
      task.timer = setTimeout(fire, Math.max(0, delay))
    }
  }

  /** Mark a task inactive and clear its timer. */
  private _deactivate(task: TaskRecord): void {
    task.active = false
    task.nextRun = undefined
    if (task.timer) clearTimeout(task.timer)
    this._syncTaskCount()
  }

  private _syncTaskCount(): void {
    let count = 0
    for (const task of this._tasks.values()) {
      if (task.active) count++
    }
    this.setState({ taskCount: count })
  }

  private _snapshot(task: TaskRecord): ScheduledTaskInfo {
    return {
      name: task.name,
      type: task.type,
      spec: task.spec,
      active: task.active,
      running: task.running,
      runs: task.runs,
      errors: task.errors,
      lastRun: task.lastRun,
      lastError: task.lastError,
      nextRun: task.nextRun,
    }
  }

  private _handle(task: TaskRecord): TaskHandle {
    const scheduler = this
    return {
      name: task.name,
      stop: () => { scheduler.stop(task.name) },
      get info() { return scheduler._snapshot(task) },
    }
  }
}

export default Scheduler
