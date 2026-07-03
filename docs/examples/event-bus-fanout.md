---
title: 'Event Bus Fanout: In-Process, Cross-Boundary, Cross-Process'
tags:
  - events
  - bus
  - container
  - websocket
  - redis
  - composition
  - fanout
lastTested: '2026-07-03'
lastTestPassed: true
---

# Event Bus Fanout: In-Process, Cross-Boundary, Cross-Process

The container **is** an event bus: `container.on` / `container.emit` / `container.once` / `container.off` / `container.waitFor`. Every helper carries its own bus with the same API. Nothing is relayed anywhere automatically — fanout is something you *compose*, and it composes in three widening rings: listeners in the same process, websocket clients outside the process, and redis subscribers on other machines. This doc walks all three.

For the APIs used here: `luca describe servers.websocket`, `luca describe clients.websocket`, `luca describe redis`.

## Ring 1: the container's own bus

Events take any name and any arguments. `once` fires a single time, `off` unsubscribes, `waitFor(event)` returns a promise for the next emission (resolving with the first listener argument). There is also a wildcard: `container.on('*', (event, ...args) => ...)` sees **every** event by name — the primitive that makes generic relays possible.

```ts
const received = []
const handler = (payload) => received.push(payload)
container.on('fanout:job', handler)
container.emit('fanout:job', { id: 1 })
container.emit('fanout:job', { id: 2 })
if (received.length !== 2 || received[1].id !== 2) throw new Error('on/emit did not deliver both payloads')

container.off('fanout:job', handler)
container.emit('fanout:job', { id: 3 })
if (received.length !== 2) throw new Error('off() did not unsubscribe the listener')

let onceCount = 0
container.once('fanout:once', () => onceCount++)
container.emit('fanout:once')
container.emit('fanout:once')
if (onceCount !== 1) throw new Error('once() fired more than once')

// wildcard: observe every event crossing the container bus
const names = []
const spy = (event) => names.push(event)
container.on('*', spy)
container.emit('fanout:alpha')
container.emit('fanout:beta', 42)
container.off('*', spy)
if (!names.includes('fanout:alpha') || !names.includes('fanout:beta')) {
  throw new Error('wildcard listener missed an event')
}

// waitFor: promise for the next emission
const arrival = container.waitFor('fanout:ready')
setTimeout(() => container.emit('fanout:ready', 'go'), 10)
const signal = await arrival
if (signal !== 'go') throw new Error('waitFor did not resolve with the event argument')

console.log('container bus verified: on/off, once, wildcard, waitFor')
```

## Scoped buses relay upward

`container.bus()` mints an independent bus — a private channel that does not pollute the container's event space. The wildcard makes relaying to the container a one-liner, with a namespace prefix so the origin stays legible. Buses also keep stats: `getEventStats(event)`, `firedEvents`, `history`.

```ts
const jobBus = container.bus()

// generic relay: everything on jobBus resurfaces on the container as jobs:*
jobBus.on('*', (event, ...args) => container.emit(`jobs:${event}`, ...args))

let containerSaw = null
container.on('jobs:completed', (id) => { containerSaw = id })

jobBus.emit('started', 'job-1')
jobBus.emit('completed', 'job-1')

if (containerSaw !== 'job-1') throw new Error('scoped bus event did not relay to the container')
if (jobBus.getEventStats('completed').fireCount !== 1) throw new Error('bus stats did not record the emit')
if (!jobBus.firedEvents.includes('started')) throw new Error('firedEvents missing started')
console.log('scoped bus relayed to container; stats:', jobBus.firedEvents.join(', '))
```

## The container narrates its own lifecycle

Two events the framework emits for you: `helperInitialized` (after any helper's `afterInitialize()` completes) and `featureEnabled` (with the feature's shortcut). Helpers do **not** forward their own events to the container — a feature's `emit()` stays on that feature's bus — but these lifecycle hooks let you observe helpers coming online and attach relays the moment they do.

```ts
const initialized = []
const enabled = []
container.on('helperInitialized', (helper) => initialized.push(helper))
container.on('featureEnabled', (shortcut, feature) => enabled.push(shortcut))

// options are part of the memoization key, so a distinct name mints a fresh instance
const yaml = container.feature('yaml', { name: 'fanout-demo', enable: true })

if (!initialized.includes(yaml)) throw new Error('helperInitialized did not fire for the new feature')
if (!enabled.includes('features.yaml')) throw new Error('featureEnabled did not fire with the shortcut')

// helper events stay on the helper's bus unless you relay them yourself
let relayed = null
yaml.on('enabled', () => {}) // helper-level subscription — same bus API as the container
container.on('fanout:yaml-state', (state) => { relayed = state })
yaml.on('stateChange', (state) => container.emit('fanout:yaml-state', state)) // the relay
yaml.state.set('touched', true)
if (!relayed || relayed.touched !== true) throw new Error('manual helper -> container relay failed')

console.log('lifecycle events observed:', enabled.join(', '))
```

## Ring 2: out of the process, over a websocket

To push container events to external consumers, bridge them to the websocket server's `broadcast()`. Anything emitted on the container fans out to every connected socket. The subscriber below is a real websocket client — it could just as well be a browser or another machine.

```ts
wsPort = await networking.findOpenPort(19930)
wsServer = container.server('websocket', { json: true })

// bridge: container event -> every connected websocket client
container.on('news', (item) => wsServer.broadcast({ event: 'news', item }))

// and the reverse relay: server helper events -> container bus
let connectionsSeen = 0
container.on('fanout:connection', () => { connectionsSeen++ })
wsServer.on('connection', () => container.emit('fanout:connection'))

await wsServer.start({ port: wsPort })

const firstConnection = wsServer.waitFor('connection')
subscriber = container.client('websocket', { baseURL: `ws://localhost:${wsPort}` })
await subscriber.connect()
await firstConnection
if (connectionsSeen !== 1) throw new Error('server connection event did not relay to the container')

const delivery = subscriber.waitFor('message')
container.emit('news', { headline: 'container events can leave the process' })
const received = await delivery

if (received.event !== 'news') throw new Error('websocket subscriber got the wrong envelope')
if (received.item.headline !== 'container events can leave the process') {
  throw new Error('broadcast payload did not survive the trip')
}
console.log('external websocket client received:', received.item.headline)
```

## Ring 3: across processes, over redis

The redis feature (`luca describe redis`) closes the loop between separate container processes with pub/sub: `publish(channel, message)` on one side, `subscribe(channel, handler?)` on the other (a dedicated subscriber connection is created lazily, as ioredis requires). Messages are strings — `JSON.stringify` your payloads.

**Requirement: a reachable redis server** (default `redis://localhost:6379`). No redis was reachable when this doc was tested, so these blocks are marked `skip` and not executed. With docker available you can bootstrap one via `container.feature('redis', { lazyConnect: true }).ensureLocalDocker()`.

```ts skip
// process A — the publisher
const redis = container.feature('redis', { url: 'redis://localhost:6379' })

// bridge: container event -> redis channel
container.on('news', (item) => redis.publish('news', JSON.stringify(item)))
container.emit('news', { headline: 'hello from process A' })
```

```ts skip
// process B — the subscriber, bridging back onto ITS container bus
const redis = container.feature('redis', { url: 'redis://localhost:6379' })

await redis.subscribe('news', (channel, message) => {
  container.emit('news:remote', JSON.parse(message))
})

const item = await container.waitFor('news:remote')
console.log('received from the other process:', item.headline)

// pub/sub connections keep the process alive — close when done
await redis.close()
```

The shape is identical to the websocket ring: pick a transport, listen on the container, forward. The receiving side re-emits onto its own container, so downstream code subscribes to plain container events and never knows the message crossed a process boundary.

## Shut down

```ts
await subscriber.disconnect()
await wsServer.stop()
if (wsServer.state.get('listening') !== false) throw new Error('websocket server still listening')
console.log('subscriber disconnected, server stopped')
```

## Summary

One mental model, three ranges. In-process: `container.on`/`emit`, scoped buses from `container.bus()`, the `'*'` wildcard for generic relays, and lifecycle events (`helperInitialized`, `featureEnabled`) narrating helper startup. Cross-boundary: a container listener that calls `wsServer.broadcast()`. Cross-process: the same listener calling `redis.publish()`, with the far side re-emitting into its own container. Helpers never auto-forward their events — every hop is an explicit, one-line relay you compose.
