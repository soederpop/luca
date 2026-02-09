# Observable State as a Synchronization Primitive

Luca's `State` class isn't just a place to store data — it's an observable, versioned, serializable object that notifies you the moment anything changes. This makes it a natural synchronization primitive: when state changes on one side of a WebSocket, you can broadcast the change and have the other side apply it.

This tutorial goes deep on how `State` works and builds up to the pattern of keeping a `NodeContainer` and a `WebContainer` in sync over a network.

## State Fundamentals

Create a standalone state object with `container.newState()`:

```ts
const appState = container.newState({
  count: 0,
  users: [],
  loading: false,
})
```

This returns a `State<T>` instance with the shape inferred from the initial value.

### Reading State

```ts
appState.get('count')     // 0
appState.get('users')     // []
appState.current          // { count: 0, users: [], loading: false }
appState.version          // 0 — increments on every change
appState.keys()           // ['count', 'users', 'loading']
appState.has('count')     // true
appState.entries()        // [['count', 0], ['users', []], ['loading', false]]
```

### Writing State

Individual keys:

```ts
appState.set('count', 1)
appState.set('loading', true)
```

Bulk updates with `setState`:

```ts
// Object form — each key triggers observers individually
appState.setState({ count: 5, loading: false })

// Function form — receives current state
appState.setState((current) => ({
  count: current.count + 1,
}))
```

Deleting keys:

```ts
appState.delete('loading')
```

Clearing everything:

```ts
appState.clear()
```

### No-Op on Same Value

Setting a key to its current value (same reference) is a no-op — no version bump, no observer notification:

```ts
appState.set('count', 1)  // version: 1, observers fire
appState.set('count', 1)  // nothing happens
appState.set('count', 2)  // version: 2, observers fire
```

## The Observer Pattern

The real power of `State` is observation. Call `observe()` with a callback, and it fires on every change:

```ts
const unsubscribe = appState.observe((changeType, key, value) => {
  console.log(`[${changeType}] ${String(key)} =`, value)
})
```

The callback receives three arguments:

| Argument | Type | Description |
|---|---|---|
| `changeType` | `'add' \| 'update' \| 'delete'` | What kind of change |
| `key` | `keyof T` | Which key changed |
| `value` | `T[key] \| undefined` | The new value (undefined on delete) |

Examples:

```ts
appState.set('count', 1)
// Observer fires: ('update', 'count', 1)

appState.set('newKey', 'hello')
// Observer fires: ('add', 'newKey', 'hello')

appState.delete('newKey')
// Observer fires: ('delete', 'newKey', 'hello')  — value is the deleted value
```

### Unsubscribing

`observe()` returns an unsubscribe function:

```ts
const unsubscribe = appState.observe((changeType, key, value) => {
  // ...
})

// Later, when you're done:
unsubscribe()
```

### Multiple Observers

You can attach as many observers as you want. They all fire on every change:

```ts
// Observer 1: update the DOM
appState.observe((changeType, key, value) => {
  document.getElementById(key).textContent = value
})

// Observer 2: log to console
appState.observe((changeType, key, value) => {
  console.log(`${key} changed to ${value}`)
})

// Observer 3: send over WebSocket
appState.observe((changeType, key, value) => {
  ws.send({ type: 'stateChange', changeType, key, value })
})
```

### setState Triggers Per-Key

When you call `setState` with multiple keys, each key fires observers independently:

```ts
appState.observe((changeType, key, value) => {
  console.log(`${key} = ${value}`)
})

appState.setState({ count: 10, loading: true })
// Fires twice:
//   "count = 10"
//   "loading = true"
```

## Versioning

Every state object has a `version` that auto-increments on every change:

```ts
const state = container.newState({ x: 0 })
state.version  // 0

state.set('x', 1)
state.version  // 1

state.set('x', 2)
state.version  // 2

state.setState({ x: 3 })
state.version  // 3
```

Versions are useful for:

- **Change detection:** "Has anything changed since I last checked?"
- **Ordering:** "Which update came first?"
- **Sync protocols:** "Send me everything after version N"

## State as a Sync Primitive

Here's the core idea: if you observe state changes on one side of a connection and apply them on the other side, you get synchronized state.

### The Pattern

```
Server State ──observe──> serialize ──WebSocket──> deserialize ──> Client State
Client State ──observe──> serialize ──WebSocket──> deserialize ──> Server State
```

Both sides:
1. Have their own `State` object
2. Observe their own state for local changes
3. Send changes over WebSocket when they happen
4. Receive changes from the other side and apply them
5. Ignore changes that came from the network (to avoid echo loops)

### Avoiding Echo Loops

The biggest gotcha in two-way sync: when you receive a change from the server and apply it locally, your local observer fires and tries to send it back to the server. You need a flag to distinguish local changes from remote ones.

```ts
let applyingRemote = false

// Send local changes to the server
appState.observe((changeType, key, value) => {
  if (applyingRemote) return  // Don't echo back
  ws.send({ type: 'stateChange', changeType, key, value })
})

// Apply remote changes locally
ws.on('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'stateChange') {
    applyingRemote = true
    if (msg.changeType === 'delete') {
      appState.delete(msg.key)
    } else {
      appState.set(msg.key, msg.value)
    }
    applyingRemote = false
  }
})
```

## Full Example: Server-to-Client Sync

The most common pattern: the server is the source of truth, and clients receive a mirror of its state.

### Server

```ts
import container from '@/node'

const appState = container.newState({
  files: [] as string[],
  branch: '',
  uptime: 0,
})

const ws = container.server('websocket', { port: 8081 })

ws.on('connection', (socket) => {
  // Send full state snapshot on connect
  ws.send(socket, {
    type: 'snapshot',
    state: appState.current,
    version: appState.version,
  })
})

// Broadcast every change to all clients
appState.observe((changeType, key, value) => {
  ws.broadcast({
    type: 'stateChange',
    changeType,
    key: String(key),
    value,
    version: appState.version,
  })
})

await ws.start()

// Update state from real data
setInterval(() => {
  appState.set('uptime', process.uptime())
}, 1000)

appState.set('branch', container.git.branch)
appState.set('files', container.fs.lsFiles().slice(0, 10))
```

### Client (Browser)

```ts
import luca from '/browser.js'

const serverState = luca.newState({
  files: [],
  branch: '',
  uptime: 0,
})

const ws = luca.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true,
})

ws.on('message', (event) => {
  const msg = JSON.parse(event.data)

  switch (msg.type) {
    case 'snapshot':
      // Apply full state on initial connect
      serverState.setState(msg.state)
      break

    case 'stateChange':
      // Apply incremental changes
      if (msg.changeType === 'delete') {
        serverState.delete(msg.key)
      } else {
        serverState.set(msg.key, msg.value)
      }
      break
  }
})

// React to state changes in the UI
serverState.observe((changeType, key, value) => {
  const el = document.getElementById(key)
  if (el) el.textContent = JSON.stringify(value)
})

await ws.connect()
```

## Full Example: Bidirectional Sync

When both sides can make changes (e.g., the browser sends commands that modify server state, or the browser has local state the server needs to know about):

### Shared Protocol

Define the message types both sides understand:

```ts
// shared/protocol.ts
interface StateChangeMessage {
  type: 'stateChange'
  changeType: 'add' | 'update' | 'delete'
  key: string
  value?: any
  version: number
  source: 'server' | 'client'
}

interface SnapshotMessage {
  type: 'snapshot'
  state: Record<string, any>
  version: number
}

interface CommandMessage {
  type: 'command'
  action: string
  args?: any
}
```

### Server

```ts
import container from '@/node'

const sharedState = container.newState({
  files: [] as string[],
  branch: '',
  selectedFile: null as string | null,
  clientCount: 0,
})

const ws = container.server('websocket', { port: 8081 })
let applyingRemote = false

ws.on('connection', (socket) => {
  sharedState.setState((current) => ({
    clientCount: current.clientCount + 1,
  }))

  ws.send(socket, {
    type: 'snapshot',
    state: sharedState.current,
    version: sharedState.version,
  })
})

ws.on('message', (rawData, socket) => {
  const { data } = JSON.parse(rawData.toString())

  if (data.type === 'stateChange' && data.source === 'client') {
    // Apply the client's change to server state
    applyingRemote = true
    sharedState.set(data.key, data.value)
    applyingRemote = false

    // Broadcast to ALL clients (including the sender, for confirmation)
    ws.broadcast({
      type: 'stateChange',
      changeType: data.changeType,
      key: data.key,
      value: data.value,
      version: sharedState.version,
      source: 'server',
    })
  }

  if (data.type === 'command') {
    handleCommand(data, socket)
  }
})

// Broadcast server-initiated changes
sharedState.observe((changeType, key, value) => {
  if (applyingRemote) return
  ws.broadcast({
    type: 'stateChange',
    changeType,
    key: String(key),
    value,
    version: sharedState.version,
    source: 'server',
  })
})

function handleCommand(msg, socket) {
  switch (msg.action) {
    case 'listFiles':
      sharedState.set('files', container.fs.lsFiles().slice(0, 20))
      break
    case 'selectFile':
      sharedState.set('selectedFile', msg.args)
      break
  }
}

await ws.start()
```

### Client (Browser)

```ts
import luca from '/browser.js'

const sharedState = luca.newState({
  files: [],
  branch: '',
  selectedFile: null,
  clientCount: 0,
})

const ws = luca.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true,
})

let applyingRemote = false

// Receive state from server
ws.on('message', (event) => {
  const msg = JSON.parse(event.data)

  if (msg.type === 'snapshot') {
    applyingRemote = true
    sharedState.setState(msg.state)
    applyingRemote = false
  }

  if (msg.type === 'stateChange' && msg.source === 'server') {
    applyingRemote = true
    if (msg.changeType === 'delete') {
      sharedState.delete(msg.key)
    } else {
      sharedState.set(msg.key, msg.value)
    }
    applyingRemote = false
  }
})

// Send local changes to server
sharedState.observe((changeType, key, value) => {
  if (applyingRemote) return
  ws.send({
    type: 'stateChange',
    changeType,
    key: String(key),
    value,
    source: 'client',
  })
})

// UI reacts to state changes
sharedState.observe((changeType, key, value) => {
  renderUI(sharedState.current)
})

await ws.connect()

// Send a command to the server
await ws.send({ type: 'command', action: 'listFiles' })
```

## Patterns and Tips

### Snapshot + Incremental

Always send a full snapshot on initial connect, then incremental changes after. This handles:
- Late joiners who missed earlier changes
- Reconnections after a disconnect
- Browser refreshes

```ts
ws.on('connection', (socket) => {
  ws.send(socket, { type: 'snapshot', state: appState.current })
})
```

### Version-Based Diffing

Use `version` to detect if you're behind:

```ts
let lastKnownVersion = 0

ws.on('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.version <= lastKnownVersion) return // already have this
  lastKnownVersion = msg.version
  // apply change...
})
```

### Scoped State

Don't sync everything. Create separate state objects for different concerns:

```ts
// Server-only state (never synced)
const internalState = container.newState({
  dbConnections: 0,
  memoryUsage: 0,
})

// Shared state (synced to clients)
const sharedState = container.newState({
  files: [],
  branch: '',
})

// Only observe the shared one for broadcasting
sharedState.observe((changeType, key, value) => {
  ws.broadcast({ type: 'stateChange', changeType, key, value })
})
```

### Last-Write-Wins

The simplest conflict resolution: whoever writes last wins. This works well for most real-time apps where:
- There's a clear authority (usually the server)
- Conflicts are rare (users are working on different things)
- Eventual consistency is acceptable

If you need stronger guarantees, use the `version` field to implement optimistic concurrency: reject updates whose version doesn't match the current version.

## Container State vs Custom State

The container itself has observable state:

```ts
container.state.observe((changeType, key, value) => {
  console.log('Container state changed:', key, value)
})
```

This tracks things like `enabledFeatures` and `started`. For your application data, always create separate state objects with `container.newState()` — this keeps concerns separated and makes sync easier.

Every Helper (Feature, Client, Server) also has its own state:

```ts
const voice = luca.feature('voice', { enable: true })
voice.state.observe((changeType, key, value) => {
  console.log('Voice state:', key, value)
})
```

You can sync Helper state the same way — observe it, serialize the changes, send them over the wire.

## Next Steps

- [Building for the Browser](./building-for-the-browser.md) — get a WebContainer running in a page
- [Voice and Speech in the Browser](./voice-and-speech.md) — voice recognition and text-to-speech
- [WebSocket Communication](./websocket-communication.md) — the transport layer for state sync
