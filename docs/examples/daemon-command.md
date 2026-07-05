---
title: Daemon & Poll-Loop Commands
tags:
  - commands
  - daemon
  - polling
  - scheduling
  - utils
  - proc
  - scheduler
  - cron
lastTested: '2026-07-05'
lastTestPassed: true
---

# Daemon & Poll-Loop Commands

Luca's low-level scheduling primitives live on `container.utils`: `sleep`, `backoff`, and `every`. This example covers all three, plus the full lifecycle of a long-running command (keep-alive, SIGINT cleanup, single-instance locking). When you want named tasks, cron expressions, run history, or a one-line daemon lifecycle, reach for the managed layer instead — `container.feature('scheduler')` — covered in its own section below.

## sleep — pauses between work

`utils.sleep(ms)` resolves after the given delay. It's the building block for polite loops that don't hammer an API.

```ts
const started = Date.now()
await container.utils.sleep(150)
console.log(`slept for ~${Date.now() - started}ms`)
```

## backoff — retry flaky calls with exponential delay

`utils.backoff(fn, opts)` retries an async function until it succeeds or attempts run out. The delay doubles after each failure (tune with `factor`, cap with `maxDelay`). It returns the function's result, or throws the last error.

```ts
let calls = 0

const result = await container.utils.backoff(async () => {
  calls++
  if (calls < 3) throw new Error(`transient failure #${calls}`)
  return `succeeded on attempt ${calls}`
}, {
  attempts: 5,
  delay: 50,
  onRetry: (err, attempt) => console.log(`attempt ${attempt} failed: ${err.message}`)
})

console.log(result)
```

## every — the poll loop

`utils.every(ms, fn)` codifies the recursive-`setTimeout` idiom: the next run is only scheduled after the previous one finishes, so slow ticks never overlap. It returns a `stop()` function.

```ts
let ticks = 0

const stop = container.utils.every(100, async () => {
  ticks++
  console.log(`tick ${ticks}`)
}, { immediate: true })

// let it run for a few ticks, then stop it
await container.utils.sleep(350)
stop()
console.log(`stopped after ${ticks} ticks`)
```

Pass `{ onError: (err) => ... }` to keep the loop alive through failures — without it, a throwing tick stops the loop and surfaces the error.

## The managed layer: scheduler

`utils.every` gives you a bare loop and a `stop()` function — nothing else. The `scheduler` feature wraps the same non-overlapping-tick idiom in **named tasks** with run history, error tracking, and cron expressions. Every `scheduler.every()` / `cron()` / `at()` / `in()` call returns a handle with a live `info` snapshot, and `scheduler.tasks` lists everything it knows about.

```ts
scheduler = container.feature('scheduler')

let schedTicks = 0
const poll = scheduler.every(100, () => { schedTicks++ }, { name: 'demo-poll', immediate: true })

// let it tick a couple of times, then stop it
await container.utils.sleep(350)
poll.stop()

// run history lives on the handle (and in scheduler.tasks)
console.log(poll.info)
if (poll.info.runs < 2) throw new Error(`expected at least 2 runs, got ${poll.info.runs}`)
if (poll.info.errors !== 0) throw new Error('demo task should not have errored')
if (poll.info.active !== false) throw new Error('stopped task should be inactive')

const listed = scheduler.tasks.find(t => t.name === 'demo-poll')
if (!listed || listed.runs !== poll.info.runs) throw new Error('scheduler.tasks should list the same snapshot')
console.log(`demo-poll ran ${poll.info.runs} times, then stopped cleanly`)
```

Intervals accept milliseconds or duration strings (`'30s'`, `'5m'`, `'1h30m'`). Cron tasks use standard 5-field syntax with names and `@daily`-style aliases — and `nextCronDate()` lets you inspect a schedule without waiting for it:

```ts
const digest = scheduler.cron('0 9 * * mon-fri', () => console.log('good morning'), { name: 'digest' })
console.log('digest next fires at', new Date(digest.info.nextRun).toString())
console.log('next Monday 9am:', scheduler.nextCronDate('0 9 * * mon').toString())

// a failing task stays scheduled — errors are recorded, not fatal
const flaky = scheduler.every(100, () => { throw new Error('boom') }, { name: 'flaky', immediate: true })
await container.utils.sleep(150)

// stop everything before the script ends — active tasks hold timers
const stopped = scheduler.stopAll()
console.log(`stopped ${stopped} tasks`)
if (flaky.info.errors < 1) throw new Error('expected the flaky task to record its error')
if (flaky.info.active) throw new Error('stopAll should have deactivated flaky')
if (scheduler.state.get('taskCount') !== 0) throw new Error('taskCount should be 0 after stopAll')
```

For a daemon command, `await scheduler.run()` replaces both the keep-alive promise and the SIGINT handler: it holds the process open, stops all tasks on SIGINT/SIGTERM, awaits your `onShutdown` hook, and resolves with the signal name. Run `luca describe scheduler` for the full API (`every`, `cron`, `at`, `in`, `stop`, `stopAll`, `run`, `tasks`, `nextCronDate`, events).

## Single-instance locking with proc

`proc.establishLock(pidPath)` writes the current PID to a file and **exits the process** if the file already names a live process — so two copies of your daemon never run at once. Stale PID files (dead process) are cleaned up automatically, and cleanup handlers on SIGINT/SIGTERM/exit remove the file on shutdown. It returns `{ release }` for manual release.

```ts
proc = container.feature('proc')

lockPath = `tmp/daemon-example-${Date.now()}.pid`
const lock = proc.establishLock(lockPath) // paths resolve relative to container.cwd

if (!fs.exists(lockPath)) throw new Error('lock file was not created')
if (fs.readFile(lockPath).trim() !== String(process.pid)) throw new Error('lock file should contain our PID')

lock.release()
if (fs.exists(lockPath)) throw new Error('release() should remove the lock file')
console.log('lock acquired and released cleanly')
```

## The full daemon command

Putting it together in a real command file — `commands/sync-worker.ts`. Three things make a command long-running: a PID lock so only one instance runs, an `await new Promise(() => {})` keep-alive, and a SIGINT handler that cleans up. (Shown, not executed — it runs forever.)

```ts skip
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Poll for new work every 30 seconds'

export const argsSchema = z.object({
  interval: z.number().default(30).describe('Poll interval in seconds'),
})

export default async function syncWorker(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context

  // 1. Single-instance guard — exits if another copy is running,
  //    removes the pid file automatically on exit
  const proc = container.feature('proc')
  proc.establishLock('tmp/sync-worker.pid')

  // 2. The poll loop — retries flaky work with backoff inside each tick
  const stop = container.utils.every(options.interval * 1000, async () => {
    await container.utils.backoff(() => doOneSync(container), { attempts: 3, delay: 500 })
  }, { immediate: true, onError: (err) => console.error('tick failed:', err) })

  // 3. Hold the process open; release everything on Ctrl-C
  process.on('SIGINT', () => {
    stop()
    process.exit(0)
  })
  await new Promise(() => {})
}
```

## Summary

`sleep` for pauses, `backoff` for retries, `every` for non-overlapping poll loops — all on `container.utils`, no imports. A daemon command adds `proc.establishLock()` for single-instance safety, `await new Promise(() => {})` to stay alive, and a SIGINT handler to clean up — or replaces the last two with a single `await container.feature('scheduler').run()`. Run `luca scaffold command --tutorial` for the full command-authoring guide.
