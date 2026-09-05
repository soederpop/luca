# Process lifetime and durable worker records

Choose the process lifetime before choosing a process helper. `processManager` tracks children within its own process; its in-memory registry is not a durable supervisor for later CLI invocations.

## Finite work: close resources

A connected client can keep a command alive. Close it in `finally` so success and failure release the connection:

```ts skip
const client = container.client('websocket', { baseURL: 'ws://localhost:8099', json: true })
try {
  await client.connect()
  console.log(await client.ask({ type: 'time' }))
} finally {
  await client.disconnect()
}
```

Use the actual client's documented cleanup method. Stop timers and watchers you created too. Prefer natural process exit after cleanup; unconditional `process.exit(0)` can hide failures or truncate pending output. If a CLI still hangs, identify its remaining resources rather than declaring success and terminating it blindly.

## Services: one shutdown owner

Commands receive `context.runUntilShutdown(cleanup)`; scripts can call `container.runUntilShutdown(cleanup)`. It holds the process open, handles SIGINT/SIGTERM, and awaits cleanup with a timeout guard. Do not install competing signal handlers for the same lifecycle.

```ts skip
export default async function main({ container }) {
  const fm = container.feature('fileManager')
  await fm.watch({ paths: ['inbox'] })
  await container.runUntilShutdown(async () => {
    await fm.stopWatching()
  })
}
```

The file manager updates its index before emitting `file:change`, and tolerates a file disappearing during indexing. No arbitrary 100ms delay is required before processing an event. Your own asynchronous handlers still need appropriate concurrency control and handling for repeated filesystem events.

For named schedules and task history, use `scheduler.run({ onShutdown })`. [Daemon commands](../examples/daemon-command.md) covers scheduling, retries, and single-instance locking. Test shutdown while work is in progress, not just when the service is idle.

## Detached workers: persist ownership, not just liveness

When a worker must survive the initiating command, use `proc.spawn(executable, argv, { detached: true })`, await its `spawn` event (and handle `error`), then `unref()`. Detached children default to ignored stdio. Use a worker script run through the intended runtime, for example an absolute Luca executable with `['run', absoluteWorkerScript]` for VM code.

Persist worker records with `container.store('fleet', { schema })`, never a losable cache. A useful schema includes a run UUID, PID, launch time, executable, and a worker-owned control endpoint or heartbeat. Use `store.update()` for record changes across processes:

```ts skip
const fleet = container.store('fleet', {
  schema: z.object({ workers: z.array(z.object({
    runId: z.string(), pid: z.number(), startedAt: z.string(),
  })).default([]) }),
})
// After the child's spawn event has confirmed a valid PID:
await fleet.update(state => {
  state.workers.push({ runId, pid: child.pid, startedAt: new Date().toISOString() })
})
```

This is a record fragment, not a complete supervisor. If persisting a new worker fails, stop that child so it does not become an untracked orphan. Serialize start/stop operations or use a single supervising process when concurrent management commands are possible.

`proc.kill(pid, 0)` checks liveness; it does not prove that the live process is still your worker, because PIDs are reused. Before stopping a persisted worker, validate its run identity through its control endpoint/heartbeat or supervisor. Request graceful shutdown, wait for confirmed termination, and only then remove its record. Escalate termination only for a verified owned process. A restart should reconcile stale records and establish readiness before advertising the replacement.

For multi-worker coordination, a single long-running supervisor using `processManager` can simplify ownership; persist only the supervisor identity and communicate through a control endpoint. Use SQLite transactions for durable queues and atomic job claims, not a PID list as a queue.

## Verify from independent processes

Check start, readiness, status from a second invocation, graceful stop, port/resource release, and restart. Include missing state, a dead worker, stale identity, and failure to persist the record. Use temporary state and test endpoints. A scratch cwd does not isolate home hooks, plugins, credentials, or external services.
