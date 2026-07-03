---
title: "Daemon & Poll-Loop Commands"
tags: [commands, daemon, polling, scheduling, utils, proc]
lastTested: "2026-07-03"
lastTestPassed: true
---

# Daemon & Poll-Loop Commands

Luca's low-level scheduling primitives live on `container.utils`: `sleep`, `backoff`, and `every`. This example covers all three, plus the full lifecycle of a long-running command (keep-alive, SIGINT cleanup, single-instance locking). When you want named tasks, cron expressions, run history, or a one-line daemon lifecycle, reach for the managed layer instead — `container.feature('scheduler')` — covered in the [scheduler example](./scheduler.md).

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
