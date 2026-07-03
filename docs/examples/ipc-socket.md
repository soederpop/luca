---
title: "IPC Socket"
tags: [ipcSocket, ipc, unix-socket, messaging]
lastTested: null
lastTestPassed: null
---

# ipcSocket

Inter-process communication via Unix domain sockets. Supports both server and client modes with JSON message serialization, broadcast messaging, and event-driven message handling.

## Overview

The `ipcSocket` feature enables processes to communicate through file-system-based Unix domain sockets. A server listens on a socket path and accepts multiple client connections. Messages are automatically JSON-encoded with unique IDs. Both server and client emit `message` events for incoming data. Because IPC requires coordinating two processes (server and client), all socket operation examples use skip blocks.

## Enabling the Feature

```ts
const ipc = container.feature('ipcSocket', { enable: true })
console.log('IPC Socket enabled:', ipc.state.get('enabled'))
console.log('Current mode:', ipc.state.get('mode'))
```

## Exploring the API

```ts
const docs = container.features.describe('ipcSocket')
console.log(docs)
```

## Checking Mode

```ts
// code blocks share one scope — `ipc` comes from the first block
console.log('Is server:', ipc.isServer)
console.log('Is client:', ipc.isClient)
```

## Hub and Spoke: a Complete Runnable Roundtrip

Each feature instance is mode-locked to server-XOR-client, but you can get two independent instances in one process by constructing them with distinct `name` options. This example runs a full request/reply roundtrip:

```ts
const hub = container.feature('ipcSocket', { name: 'hub' })
const spoke = container.feature('ipcSocket', { name: 'spoke' })

const sock = `/tmp/ipc-example-${process.pid}.sock`
await hub.listen(sock, true)  // `true` removes any stale socket file before binding

// Server side: messages sent via ask() arrive with a requestId —
// reply with it (plus the sender's clientId when replying from the server).
hub.on('message', (data, clientId) => {
  if (data.requestId && data.type === 'sum') {
    hub.reply(data.requestId, { sum: data.numbers.reduce((a, b) => a + b, 0) }, clientId)
  }
})

await spoke.connect(sock, { name: 'worker-1' })
const answer = await spoke.ask({ type: 'sum', numbers: [1, 2, 3] })
console.log('answer:', JSON.stringify(answer))  // { "sum": 6 }

await spoke.disconnect()
await hub.stopServer()
```

In real projects the hub and spoke live in different processes (e.g. a `luca hub` command and a `luca ask` command) — the API is identical; only the socket path is shared. Fire-and-forget messages use `send()`/`sendTo(clientId)` instead of `ask()`/`reply()`.

**Gotcha:** a CLI command holding an open socket keeps the event loop alive after its work finishes — call `disconnect()`/`stopServer()` and, if the command still hangs, `process.exit(0)`.

## Broadcasting Messages

Send a message to all connected clients from the server.

```ts skip
ipc.broadcast({
  type: 'notification',
  message: 'Deployment starting',
  timestamp: Date.now()
})
```

Each connected client receives the broadcast as a `message` event. Messages are JSON-encoded with a UUID for correlation.

## Stopping the Server

Gracefully shut down the server and disconnect all clients.

```ts skip
await ipc.stopServer()
console.log('Server stopped')
```

The `stopServer` method closes the listener, destroys all active client connections, and resets internal state.

## Summary

The `ipcSocket` feature provides Unix domain socket IPC with JSON message serialization, multi-client support, broadcast messaging, and automatic socket cleanup. It works in either server or client mode within a single feature instance.
