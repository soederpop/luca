# Scheduler (features.scheduler)

> Stability: `stable`

In-process task scheduler: recurring intervals, cron expressions, and one-shot timers as named, observable, stoppable tasks — plus the daemon lifecycle (`run()`) that keeps a long-running command alive until SIGINT/SIGTERM. This is the managed layer above `container.utils.sleep/backoff/every`. Reach for the utils when you need a bare poll loop inside other code; reach for the scheduler when tasks should have names, run history, error tracking, and a single shutdown path. Intervals accept milliseconds or duration strings (`'30s'`, `'5m'`, `'1h30m'`). Cron expressions use standard 5-field syntax (minute hour day-of-month month day-of-week) with lists, ranges, steps, names (`mon`, `jan`), and aliases (`@hourly`, `@daily`, `@weekly`, `@monthly`, `@yearly`). Cron dates evaluate in local time. A task's next run is never scheduled until the previous run finishes, so slow ticks don't overlap. A run that throws is recorded and emitted as `task:error`, and the task stays on schedule.

## Usage

```ts
container.feature('scheduler')
```

## Methods

### parseDuration

Parse a duration into milliseconds. Accepts a number (passed through), a numeric string (`'250'`), or a duration string combining units: `ms`, `s`, `m`, `h`, `d`, `w` — e.g. `'30s'`, `'5m'`, `'1h30m'`, `'2d'`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `string | number` | ✓ | The duration to parse |

**Returns:** `number`

```ts
scheduler.parseDuration('1h30m') // 5400000
scheduler.parseDuration(250)     // 250
```



### every

Run a function on a recurring interval as a named task. Uses the recursive-setTimeout idiom: the next run is scheduled only after the previous one finishes, so runs never overlap.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `interval` | `string | number` | ✓ | Milliseconds or a duration string ('30s', '5m', '1h30m') |
| `fn` | `() => any | Promise<any>` | ✓ | The function to run (sync or async) |
| `options` | `EveryTaskOptions` |  | Task name, immediate first run, and error handler |

`EveryTaskOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `immediate` | `boolean` | Run the task immediately instead of waiting for the first interval (default: false) |

**Returns:** `TaskHandle`

```ts
const poll = scheduler.every('30s', async () => { await syncOnce() }, {
 name: 'sync',
 immediate: true,
})
// later
poll.stop() // or scheduler.stop('sync')
```



### cron

Run a function on a cron schedule as a named task. Standard 5-field syntax (minute hour day-of-month month day-of-week) with lists (`1,15`), ranges (`mon-fri`), steps (`0-59/15`, and star-with-step), month/day names, and `@hourly`-style aliases. Day-of-month and day-of-week follow the standard rule: when both are restricted, the task runs when either matches. Times are local.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `expression` | `string` | ✓ | A 5-field cron expression or alias like '@daily' |
| `fn` | `() => any | Promise<any>` | ✓ | The function to run (sync or async) |
| `options` | `ScheduleTaskOptions` |  | Task name and error handler |

`ScheduleTaskOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique name for the task (defaults to an auto-generated one). Scheduling a second active task with the same name throws. |
| `onError` | `(error: unknown) => void` | Called when a run throws. The task keeps its schedule either way; errors are also recorded on the task and emitted as 'task:error'. |

**Returns:** `TaskHandle`

```ts
scheduler.cron('0-59/15 * * * *', rotateLogs)           // every 15 minutes
scheduler.cron('0 9 * * mon-fri', digest, { name: 'digest' }) // weekdays at 9am
scheduler.cron('@daily', cleanup)
```



### at

Run a function once at a specific time.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `when` | `Date | string | number` | ✓ | A Date, a timestamp in ms, or an ISO date string |
| `fn` | `() => any | Promise<any>` | ✓ | The function to run (sync or async) |
| `options` | `ScheduleTaskOptions` |  | Task name and error handler |

`ScheduleTaskOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique name for the task (defaults to an auto-generated one). Scheduling a second active task with the same name throws. |
| `onError` | `(error: unknown) => void` | Called when a run throws. The task keeps its schedule either way; errors are also recorded on the task and emitted as 'task:error'. |

**Returns:** `TaskHandle`

```ts
scheduler.at(new Date('2026-07-04T09:00:00'), sendReminder)
```



### in

Run a function once after a delay. Sugar for at(Date.now() + duration).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `delay` | `string | number` | ✓ | Milliseconds or a duration string ('30s', '5m') |
| `fn` | `() => any | Promise<any>` | ✓ | The function to run (sync or async) |
| `options` | `ScheduleTaskOptions` |  | Task name and error handler |

`ScheduleTaskOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Unique name for the task (defaults to an auto-generated one). Scheduling a second active task with the same name throws. |
| `onError` | `(error: unknown) => void` | Called when a run throws. The task keeps its schedule either way; errors are also recorded on the task and emitted as 'task:error'. |

**Returns:** `TaskHandle`

```ts
scheduler.in('30s', () => console.log('half a minute later'))
```



### stop

Stop a task by name. Safe to call for unknown or already-stopped tasks.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The task name (from the handle or scheduler.tasks) |

**Returns:** `boolean`

```ts
scheduler.stop('sync')
```



### stopAll

Stop every active task. Called automatically when run() receives a shutdown signal.

**Returns:** `number`

```ts
scheduler.stopAll()
```



### run

Keep the process alive until a shutdown signal arrives, then stop all tasks and resolve. This is the daemon lifecycle for long-running commands — no `await new Promise(() => {})` needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `SchedulerRunOptions` |  | Signals to listen for (default SIGINT/SIGTERM) and an onShutdown cleanup hook |

`SchedulerRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `signals` | `NodeJS.Signals[]` | Signals that trigger shutdown (default: SIGINT and SIGTERM) |
| `onShutdown` | `(signal: string) => void | Promise<void>` | Awaited after tasks stop, before run() resolves — put cleanup here |

**Returns:** `Promise<string>`

```ts
scheduler.every('1m', poll, { name: 'poller', immediate: true })
const signal = await scheduler.run({
 onShutdown: async () => { await flushBuffers() },
})
console.log(`shut down on ${signal}`)
```



### nextCronDate

Compute the next date a cron expression fires, in local time. Useful for showing "next run" without scheduling anything.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `expression` | `string` | ✓ | A 5-field cron expression or alias like '@daily' |
| `from` | `Date` |  | The reference time (default: now). The result is strictly after this. |

**Returns:** `Date`

```ts
scheduler.nextCronDate('0 9 * * mon') // next Monday 09:00 local time
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `tasks` | `ScheduledTaskInfo[]` | Snapshots of every task this scheduler knows about, including finished one-shots and stopped tasks (check `active`). |

## Events (Zod v4 schema)

### task:stopped

Emitted when a task is stopped

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Task name |



### shutdown

Emitted when run() shuts down in response to a signal

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The signal that triggered the shutdown |



### task:added

Emitted when a task is scheduled

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Task name |



### task:error

Emitted when a task run throws. The task stays scheduled and keeps running

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Task name |
| `arg1` | `any` | The error the task threw |



### task:run

Emitted after a task run completes (success or error)

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Task name |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `taskCount` | `number` | Number of currently active scheduled tasks |
| `running` | `boolean` | Whether run() is holding the process open as a daemon |

## Examples

**features.scheduler**

```ts
const scheduler = container.feature('scheduler')

scheduler.every('5m', syncOnce, { name: 'sync', immediate: true })
scheduler.cron('0 9 * * mon-fri', sendDigest, { name: 'digest' })
scheduler.in('30s', warmCache)

// Daemon: keeps the process alive, stops all tasks on SIGINT/SIGTERM
await scheduler.run()
```

```ts
// Observability: every task has a name, run counts, and error history
const handle = scheduler.every('10s', pollQueue)
console.log(scheduler.tasks) // [{ name, type, spec, runs, errors, lastRun, nextRun, ... }]
handle.stop()
```



**parseDuration**

```ts
scheduler.parseDuration('1h30m') // 5400000
scheduler.parseDuration(250)     // 250
```



**every**

```ts
const poll = scheduler.every('30s', async () => { await syncOnce() }, {
 name: 'sync',
 immediate: true,
})
// later
poll.stop() // or scheduler.stop('sync')
```



**cron**

```ts
scheduler.cron('0-59/15 * * * *', rotateLogs)           // every 15 minutes
scheduler.cron('0 9 * * mon-fri', digest, { name: 'digest' }) // weekdays at 9am
scheduler.cron('@daily', cleanup)
```



**at**

```ts
scheduler.at(new Date('2026-07-04T09:00:00'), sendReminder)
```



**in**

```ts
scheduler.in('30s', () => console.log('half a minute later'))
```



**stop**

```ts
scheduler.stop('sync')
```



**stopAll**

```ts
scheduler.stopAll()
```



**run**

```ts
scheduler.every('1m', poll, { name: 'poller', immediate: true })
const signal = await scheduler.run({
 onShutdown: async () => { await flushBuffers() },
})
console.log(`shut down on ${signal}`)
```



**nextCronDate**

```ts
scheduler.nextCronDate('0 9 * * mon') // next Monday 09:00 local time
```



**tasks**

```ts
const stuck = scheduler.tasks.filter(t => t.active && t.errors > 0)
```

