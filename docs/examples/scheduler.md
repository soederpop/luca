---
title: "Scheduler"
tags: [features, scheduler, cron, daemon, polling, scheduling]
lastTested: "2026-07-03"
lastTestPassed: true
---

# Scheduler

`container.feature('scheduler')` runs recurring intervals, cron expressions, and one-shot timers as **named, observable, stoppable tasks** — and gives long-running commands their lifecycle via `run()`. It's the managed layer above the `container.utils` timing primitives (`sleep`, `backoff`, `every`): reach for the scheduler when tasks deserve names, run history, and a single shutdown path.

## every — recurring tasks

Intervals accept milliseconds or duration strings (`'30s'`, `'5m'`, `'1h30m'`). The next run is never scheduled until the previous one finishes, so slow ticks don't overlap.

```ts
const scheduler = container.feature('scheduler')

let ticks = 0
const task = scheduler.every(100, () => { ticks++ }, { name: 'ticker', immediate: true })

await container.utils.sleep(350)
task.stop()

console.log(`'${task.name}' ran ${task.info.runs} times`)
```

## Task observability

Every task tracks its runs, errors, and next scheduled run. `scheduler.tasks` lists snapshots of everything the scheduler knows about (finished and stopped tasks included — check `active`).

```ts
const scheduler = container.feature('scheduler')

const flaky = scheduler.every(50, () => {
  throw new Error('transient failure')
}, { name: 'flaky' })

await container.utils.sleep(180)
flaky.stop()

const info = scheduler.tasks.find(t => t.name === 'flaky')
console.log(`runs: ${info.runs}, errors: ${info.errors}, lastError: '${info.lastError}'`)
```

A run that throws is recorded on the task, emitted as `task:error`, and passed to your `onError` handler — the task stays on schedule either way.

## cron — calendar schedules

Standard 5-field syntax (minute hour day-of-month month day-of-week) with lists, ranges, steps, names (`mon-fri`, `jan`), and aliases (`@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`). Times are local. `nextCronDate()` shows when an expression fires next without scheduling anything.

```ts
const scheduler = container.feature('scheduler')

console.log('next quarter hour:', scheduler.nextCronDate('*/15 * * * *').toLocaleString())
console.log('next weekday 9am: ', scheduler.nextCronDate('0 9 * * mon-fri').toLocaleString())
console.log('next @daily:      ', scheduler.nextCronDate('@daily').toLocaleString())

const digest = scheduler.cron('0 9 * * mon-fri', () => sendDigest(), { name: 'digest' })
console.log(`'${digest.name}' first fires`, new Date(digest.info.nextRun).toLocaleString())
digest.stop()

function sendDigest() {}
```

Invalid expressions throw immediately with the reason (`out of range`, `expected 5 fields`, …) — before the task is registered.

## at / in — one-shots

`at()` takes a Date, timestamp, or ISO string; `in()` takes a delay. One-shots deactivate after they fire.

```ts
const scheduler = container.feature('scheduler')

const once = scheduler.in('50ms', () => console.log('fired!'), { name: 'once' })
await container.utils.sleep(120)
console.log(`active: ${once.info.active}, runs: ${once.info.runs}`)
```

## run — the daemon lifecycle

`run()` holds the process open until SIGINT/SIGTERM, then stops every task, runs your `onShutdown` hook, and resolves with the signal name. This replaces the manual `await new Promise(() => {})` + signal-handler idiom. (Shown, not executed — it runs until you Ctrl-C.)

```ts skip
import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Sync worker with a managed schedule'

export default async function syncWorker(options: {}, context: ContainerContext) {
  const { container } = context

  // Single-instance guard (see the daemon-command example)
  container.feature('proc').establishLock('tmp/sync-worker.pid')

  const scheduler = container.feature('scheduler')
  scheduler.every('30s', () => syncOnce(container), { name: 'sync', immediate: true })
  scheduler.cron('@hourly', () => compactDatabase(container), { name: 'compact' })

  const signal = await scheduler.run({
    onShutdown: async () => { await flushBuffers(container) },
  })
  console.log(`shut down on ${signal}`)
}
```

## Summary

`every` for intervals, `cron` for calendar schedules, `at`/`in` for one-shots — each returns a handle with `name`, `stop()`, and a live `info` snapshot, and `scheduler.tasks` shows them all. `run()` is the daemon lifecycle: block until a signal, stop everything, clean up. For a bare unnamed loop, the primitives on `container.utils` (covered in the [daemon-command example](./daemon-command.md)) are still there.
