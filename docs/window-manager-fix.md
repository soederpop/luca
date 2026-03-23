# Window Manager Fix

## Problem

The current `windowManager` design allows any Luca process to call `listen()` on the same well-known Unix socket:

- `~/Library/Application Support/LucaVoiceLauncher/ipc-window.sock`

That means unrelated commands can compete for ownership of the app-facing socket. The current implementation makes this worse by doing the following on startup:

1. If the socket path exists, `unlinkSync(socketPath)`.
2. Bind a new server at the same path.

This creates a race where one Luca process can steal the socket from another. The native `LucaVoiceLauncher` app then disconnects from the old server and reconnects to whichever process currently owns the path. If that process exits, the app falls into reconnect loops.

This is the root cause of the observed behavior where:

- the launcher sometimes connects successfully
- the connection then drops unexpectedly
- repeated `ipc connect failed` messages appear in the launcher log

## Design Goal

We want:

- one stable owner of the app-facing socket
- many independent Luca commands able to trigger window actions
- optional failover if the main owner dies
- support for multiple launcher app clients over time, and optionally at once

The key design rule is:

> Many clients is fine. Many servers competing for the same well-known socket is not.

## Recommended Architecture

### 1. Single broker for the app socket

Only one broker process may own:

- `ipc-window.sock`

The broker is responsible for:

- accepting native launcher app connections
- tracking connected app clients
- routing window commands to the selected app client
- receiving `windowAck`, `windowClosed`, and `terminalExited`
- routing responses and lifecycle events back to the original requester

### 2. Separate control channel for Luca commands

Luca commands should not bind the app-facing socket directly.

Instead, they should talk to the broker over a separate channel, for example:

- `~/Library/Application Support/LucaVoiceLauncher/ipc-window-control.sock`

This control channel is for producers:

- `luca main`
- `luca workflow run ...`
- `luca present`
- scripts
- background jobs

These producers send requests to the broker, and the broker fans them out to the connected app client.

### 3. Broker supports multiple app clients

The broker should replace the current single `_client` field with a registry:

```ts
Map<string, ClientConnection>
```

Each client should have:

- `clientId`
- `socket`
- `buffer`
- metadata if useful later, such as display, role, labels, or lastSeenAt

This allows:

- multiple launcher app instances
- reconnect without confusing request ownership
- future routing by target client

## Routing Model

### Producer -> broker

Producer sends a request like:

```json
{
  "type": "windowRequest",
  "requestId": "uuid",
  "originId": "uuid",
  "targetClientId": "optional",
  "window": {
    "action": "open",
    "url": "https://example.com"
  }
}
```

### Broker -> app client

Broker forwards the request to the chosen app client, preserving `requestId`.

### App client -> broker

App replies with:

- `windowAck`
- `windowClosed`
- `terminalExited`

### Broker -> producer

Broker routes:

- the `windowAck` back to the producer that originated the request
- lifecycle events either to the originating producer, or to any subscribed producer

## Client Selection Policy

The simplest policy is:

- use the most recently connected healthy app client

Later policies can support:

- explicit `targetClientId`
- labels like `role=presenter`
- display-aware routing
- sticky routing based on `windowId -> clientId`

## Leader Election / Failover

If we want multiple `windowManager` instances to exist, they must not all behave as brokers.

Instead:

1. Try connecting to the broker control socket.
2. If broker exists, act as a producer client.
3. If broker does not exist, try to acquire a broker lock.
4. If lock succeeds, become broker and bind both sockets.
5. If lock fails, retry broker connection and act as producer.

Possible lock mechanisms:

- lock file with `flock`
- lock directory with atomic `mkdir`
- local TCP/Unix registration endpoint

The important constraint is:

- only the elected broker binds `ipc-window.sock`

All other instances must route through it.

## Why not let many processes bind the same socket?

Because Unix domain socket paths are singular ownership points. A path is not a shared bus.

If multiple processes all call `listen()` against the same path and delete stale files optimistically, they will:

- steal the path from each other
- disconnect the app unexpectedly
- lose in-flight requests
- create non-deterministic routing

This is fundamentally the wrong abstraction.

## Backward-Compatible Migration

We can migrate without breaking the public `windowManager.spawn()` API.

### Phase 1

- Introduce a broker mode internally.
- Add `ipc-window-control.sock`.
- Keep the existing app protocol unchanged.
- Make `windowManager.spawn()` talk to the broker when possible.

### Phase 2

- Prevent non-broker processes from binding `ipc-window.sock`.
- Replace blind `unlinkSync(socketPath)` with active listener detection.
- Add broker election and failover.

### Phase 3

- Add multi-client routing.
- Add subscriptions for lifecycle events.
- Add explicit target selection if needed.

## Minimal Fix if We Need Something Fast

If we do not implement the full broker immediately, we should at least stop destroying active listeners.

`listen()` should:

1. Attempt to connect to the existing socket.
2. If a listener is alive, do not unlink or rebind.
3. If the socket is dead, clean it up and bind.

This does not solve multi-producer routing, but it prevents random Luca commands from stealing the app socket from a healthy broker.

## Proposed Internal Refactor

Current state:

- one process tries to be both broker and producer
- one `_client`
- one app-facing socket

Target state:

- broker owns app-facing socket
- producers use control socket
- broker stores:
  - `clients: Map<clientId, ClientConnection>`
  - `pendingRequests: Map<requestId, PendingRequest>`
  - `requestOrigins: Map<requestId, originConnection>`
  - `windowOwners: Map<windowId, clientId>`

That separation gives us:

- stable app connectivity
- multi-command triggering
- failover
- room for multi-client routing

## Summary

The right fix is not “allow many `listen()` calls on the same socket.”

The right fix is:

- one elected broker owns the app socket
- many Luca processes talk to the broker
- many app clients may connect to the broker
- failover is implemented through broker election, not socket contention

That preserves a stable connection for the launcher app while still allowing multiple people, commands, or workflows to trigger window operations.
