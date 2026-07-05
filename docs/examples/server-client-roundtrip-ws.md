---
title: 'Server ↔ Client Roundtrip: WebSockets'
tags:
  - websocket
  - servers
  - clients
  - ask
  - reply
  - broadcast
  - composition
lastTested: '2026-07-05'
lastTestPassed: true
---

# Server ↔ Client Roundtrip: WebSockets

The websocket server and websocket client are **paired helpers**: `container.server('websocket')` speaks the same framing as `container.client('websocket')`, so you get JSON messages, connection state, and an `ask()`/`reply()` request-response protocol without writing any correlation plumbing yourself. This doc runs the whole conversation in one process: plain send/receive, asks in both directions, error replies, timeouts, broadcast to multiple clients, and clean shutdown.

For each helper's full API: `luca describe servers.websocket`, `luca describe clients.websocket`.

## Create the server and wire handlers

With `json: true` the server JSON-parses incoming messages before emitting its `message` event (handler signature: `(data, ws)`). Any message that arrives with a `requestId` gets `reply()` and `replyError()` helpers attached — that is the server half of the ask protocol.

```ts
// bare assignments (no const) so these survive into later blocks
server = container.server('websocket', { json: true })

server.on('message', (data, ws) => {
  if (data.type === 'add') {
    data.reply({ sum: data.data.a + data.data.b })
  } else if (data.type === 'divide') {
    if (data.data.b === 0) data.replyError('division by zero')
    else data.reply({ result: data.data.a / data.data.b })
  }
})
console.log('server created and handlers wired')
```

## Start it, connect a client

`start({ port })` overrides any constructor port. The client's `connect()` resolves once the socket is open, and `state.connected` tracks the connection from then on.

```ts
port = await networking.findOpenPort(19910)
await server.start({ port })
if (server.state.get('listening') !== true) throw new Error('server did not report listening')

client = container.client('websocket', { baseURL: `ws://localhost:${port}` })
await client.connect()
if (client.state.get('connected') !== true) throw new Error('client did not report connected')
console.log('server listening on', port, '— client connected')
```

## Plain send and receive

Fire-and-forget messages flow through each side's `message` event. Every helper has `waitFor(event)` — a promise for the next emission (it resolves with the first listener argument). Create the promise **before** sending, or you race the delivery.

```ts
// client -> server
const arrived = server.waitFor('message')
await client.send({ type: 'ping', at: 42 })
const msg = await arrived
if (msg.type !== 'ping' || msg.at !== 42) throw new Error('server did not receive the ping payload intact')

// server -> client: server.send(ws, data) targets one connection
const pushed = client.waitFor('message')
await server.send([...server.connections][0], { type: 'pong', at: 43 })
const back = await pushed
if (back.type !== 'pong' || back.at !== 43) throw new Error('client did not receive the pong payload intact')

console.log('roundtrip verified: ping', msg.at, '/ pong', back.at)
```

## The client asks, the server replies

`ask(type, data, timeout?)` sends a message with a generated `requestId` and returns a promise for the correlated reply's `data`. On the server, `data.reply(payload)` answers it. You never touch `requestId`/`replyTo` yourself.

```ts
const sum = await client.ask('add', { a: 3, b: 4 })
if (sum.sum !== 7) throw new Error(`ask('add') returned ${JSON.stringify(sum)}`)

const quotient = await client.ask('divide', { a: 10, b: 4 })
if (quotient.result !== 2.5) throw new Error(`ask('divide') returned ${JSON.stringify(quotient)}`)

console.log('3 + 4 =', sum.sum, '| 10 / 4 =', quotient.result)
```

## Error replies reject the ask

Unlike the rest client (which *returns* errors), `ask()` failures **throw**: a `replyError(message)` from the server rejects the pending promise with that message.

```ts
let caught = null
try {
  await client.ask('divide', { a: 1, b: 0 })
} catch (err) {
  caught = err
}
if (!caught || !caught.message.includes('division by zero')) {
  throw new Error('replyError did not reject the ask with the server message')
}
console.log('error reply rejected the ask:', caught.message)
```

## The server asks the client

The protocol is symmetric. A server-initiated ask arrives at the client as a normal `message` carrying a `requestId`; the client answers by echoing it back as `replyTo`. The server addresses a specific socket from its `connections` set.

```ts
client.on('message', (data) => {
  if (data.requestId && data.type === 'whoAreYou') {
    client.send({ replyTo: data.requestId, data: { name: 'roundtrip-client', version: '1.0' } })
  }
})

const identity = await server.ask([...server.connections][0], 'whoAreYou')
if (identity.name !== 'roundtrip-client') throw new Error('server.ask did not get the client identity')
console.log('client identified itself as', identity.name, identity.version)
```

## Timeouts

If nobody replies, `ask()` rejects after the timeout (default 10s, configurable as the third argument). Our server has no handler for `noop`, so nothing answers.

```ts
try {
  await client.ask('noop', {}, 500)
  throw new Error('ask should have timed out')
} catch (err) {
  if (!err.message.includes('timed out')) throw err
  console.log('timed out as expected:', err.message)
}
```

## Broadcast to every connected client

`broadcast(data)` sends to all connections. One memoization gotcha: helper factories cache per id + options, so `container.client('websocket', { baseURL })` with identical options returns the **same instance**. Give the second client a distinguishing option (like `name`) to get a genuinely separate socket.

```ts
client2 = container.client('websocket', { baseURL: `ws://localhost:${port}`, name: 'second' })
await client2.connect()
if (server.connections.size !== 2) throw new Error(`expected 2 connections, server sees ${server.connections.size}`)

const first = client.waitFor('message')
const second = client2.waitFor('message')
await server.broadcast({ type: 'announcement', text: 'hello everyone' })

const [gotFirst, gotSecond] = await Promise.all([first, second])
if (gotFirst.text !== 'hello everyone') throw new Error('client 1 missed the broadcast')
if (gotSecond.text !== 'hello everyone') throw new Error('client 2 missed the broadcast')
console.log('both clients received the broadcast')
```

## Disconnect and stop

An open socket keeps the event loop alive — a CLI command that skips this step hangs forever. `disconnect()` suppresses auto-reconnect and rejects any in-flight asks; `stop()` terminates remaining connections and closes the server.

```ts
await client.disconnect()
await client2.disconnect()
if (client.state.get('connected') !== false) throw new Error('client 1 still reports connected')
if (client2.state.get('connected') !== false) throw new Error('client 2 still reports connected')

await server.stop()
if (server.state.get('listening') !== false) throw new Error('server still reports listening')
console.log('clients disconnected, server stopped')
```

## Summary

One paired protocol, both directions: `send()` for fire-and-forget, `ask()`/`reply()`/`replyError()` for request-response (correlation IDs handled for you), `broadcast()` for fan-out, and `waitFor(event)` to await deliveries without callback bookkeeping. Asks **throw** on error and timeout — the opposite convention from the rest client, which returns errors as values. And always `disconnect()` + `stop()` at the end, or the process never exits.
