# Supervisor-Worker Multi-Container Orchestration

A central container process spawns and manages child containers, enabling shared state, coordination, and self-restart capabilities using existing Luca features.

## Motivation

The container, with its `proc` and `ipcSocket` features built in, lends itself well to building a central container process that spawns other containers. These containers can all share state with the central process and coordinate between each other. The ability for any container to restart itself and come back online makes this a robust foundation for multi-process applications.

## Building Blocks (Already Exist)

| Need | Existing Primitive |
|------|--------------------|
| Spawn child processes | `proc.spawnAndCapture` / `Bun.spawn` |
| Kill processes | `proc.kill(pid)` |
| IPC channel | `ipcSocket.listen()` / `ipcSocket.connect()` |
| Observable state | `State` with `.observe()` |
| Event coordination | `Bus` (every helper has one) |
| Port allocation | `networking.findOpenPort()` |
| Feature encapsulation | `Feature` subclass pattern |

## Design

Two new features, both subclasses of `Feature`:

### 1. `Supervisor` Feature (Central Container)

```
State:
  workers: Map<string, { id, pid, socketPath, status, config, restartCount }>

Responsibilities:
  - spawn(id, scriptPath, options) - Bun.spawn a new process
  - tracks PIDs and socket paths in state
  - listens on a well-known IPC socket (e.g., /tmp/luca-supervisor-{uuid}.sock)
  - accepts connections from workers, indexes them by worker ID
  - handles restart requests
  - periodic heartbeat/health check
```

The supervisor spawns each worker as a separate `bun` process running a Luca script. It passes its own socket path as an environment variable so workers know where to connect:

```ts
const child = Bun.spawn(['bun', workerScript], {
  env: {
    ...process.env,
    LUCA_SUPERVISOR_SOCK: this.socketPath,
    LUCA_WORKER_ID: workerId,
  },
})
```

### 2. `Worker` Feature (Child Containers)

```
State:
  workerId: string
  supervisorConnected: boolean

Responsibilities:
  - on enable, connects to supervisor via LUCA_SUPERVISOR_SOCK
  - announces itself: { type: 'register', workerId, pid: process.pid }
  - handles messages from supervisor (state sync, commands, shutdown)
  - exposes requestRestart() - sends { type: 'restart' } to supervisor
```

## The Restart Flow

A container cannot restart itself -- it can only ask to be restarted. The supervisor owns the lifecycle, the worker owns the decision.

```
Worker                          Supervisor
  |                                |
  |-- { type: 'restart' } ------->|
  |                                |  1. Records restart intent
  |<-- { type: 'shutdown' } ------|  2. Sends graceful shutdown
  |                                |
  |  (worker runs cleanup,         |
  |   closes IPC, exits 0)         |
  |                                |  3. Detects process exit
  |                                |  4. Respawns with same config
  |                                |  5. Increments restartCount
  |                                |
  |-- { type: 'register' } ------>|  6. New worker connects
  |<-- { type: 'state-sync' } ----|  7. Supervisor pushes shared state
```

A worker can also exit with a conventional code (e.g., exit code 75) to signal "restart me" without an IPC message -- this handles the case where the worker crashes before it can send a message.

## State Sharing

Message-based state patch pattern over IPC for eventual consistency:

```ts
// Supervisor broadcasts state changes to all workers
supervisor.state.observe((changeType, key, value) => {
  this.broadcast({ type: 'state-patch', changeType, key, value })
})

// Worker applies patches to a local "shared" state
worker.on('message', (msg) => {
  if (msg.type === 'state-patch') {
    this.sharedState.set(msg.key, msg.value)
  }
})
```

Each container's own `state` remains authoritative for its own concerns; the `sharedState` is a read-replica of the supervisor's state.

## Health Checks

The supervisor sends periodic heartbeats. Workers must respond within a timeout:

```
Supervisor                      Worker
  |-- { type: 'ping', ts } ------>|
  |<-- { type: 'pong', ts } ------|
```

If a worker misses N pings, the supervisor considers it dead, kills the PID, and respawns based on the worker's restart policy (`always`, `on-failure`, `never`).

## Prerequisite: NDJSON Framing for ipcSocket

The `ipcSocket` feature currently does raw `JSON.parse(data)` on each TCP data event, which breaks on packet fragmentation. The `WindowManager` feature already solves this correctly -- buffer incoming data, split on `\n`, parse each line. That pattern should be pulled into `ipcSocket` directly. Small change (~15 lines) but critical for reliability.

## Why This Works With Luca's Grain

- **Feature pattern** is the right abstraction -- Supervisor and Worker each have typed state, events, and options. They're discoverable via `container.features.describe()`.
- **No shared memory needed** -- Luca's state is already observable with `.observe()`, so broadcasting patches is natural.
- **The event bus carries it** -- `supervisor.on('workerConnected')`, `supervisor.on('workerDied')`, `worker.on('restartRequested')` all fit the existing event-driven model.
- **Each worker is a full container** -- it gets `fs`, `proc`, `git`, etc. for free. A worker that runs an express server gets all of `container.server('express')`.
- **`container.use(Worker)` in scripts** -- any Luca script can opt into being a managed worker with one line.

## What You Don't Need to Build

- A custom process manager -- `Bun.spawn` + PID tracking is enough
- A custom protocol -- NDJSON over Unix domain sockets (already proven in WindowManager)
- A service registry -- the supervisor's state *is* the registry
- Consensus/leader election -- the supervisor is the single source of truth by design

## Estimated Scope

- Two features (~200-300 lines each)
- NDJSON upgrade to ipcSocket (~15 lines)
- Convention for worker scripts
