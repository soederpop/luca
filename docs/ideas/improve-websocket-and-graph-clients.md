# Improve WebSocket and Graph Clients

## WebSocket Client

The `WebSocketClient` is currently a minimal stub. It only overrides `connect()` to create a raw `WebSocket` instance stored at `this.ws`. Users must access the raw WebSocket directly (`ws.ws.onmessage`, `ws.ws.send()`, `ws.ws.close()`), which is awkward and doesn't leverage Luca's helper patterns.

### Proposed Improvements

- **Wire WebSocket events to the Helper event bus**: `message`, `open`, `close`, `error` events from the raw WebSocket should be bridged to the Helper's `emit()` system so users can do `ws.on('message', handler)` instead of `ws.ws.onmessage = handler`
- **Add a `send()` method**: Wrap `ws.ws.send()` with JSON serialization and error handling
- **Add a `disconnect()` method**: Properly close the WebSocket and update `state.connected` to `false`
- **Auto-reconnect option**: Support configurable reconnection with backoff
- **Track connection state**: Update `state.connected` based on WebSocket `open`/`close` events
- **Add to `AvailableClients` interface**: Currently `WebSocketClient` is registered in the runtime registry but missing from the TypeScript `AvailableClients` interface, so `container.client('websocket', ...)` isn't fully typed

## Graph Client

The `GraphClient` currently extends `Client` (not `RestClient`), which means it has no HTTP methods (`get`, `post`, `put`, `delete`). It's effectively an empty class with just a different shortcut name. Users must use the REST client directly for GraphQL APIs.

### Proposed Improvements

- **Extend `RestClient` instead of `Client`**: This gives GraphClient all HTTP methods out of the box
- **Add a `query()` method**: Convenience wrapper around `post()` that handles the GraphQL query/variables/operationName envelope
- **Add a `mutate()` method**: Same as `query()` but semantically distinct for mutations
- **Extract `data` from responses**: GraphQL responses wrap results in `{ data, errors }` - the client should unwrap this and handle errors
- **Support GraphQL error handling**: Emit `failure` events for GraphQL-level errors (where HTTP status is 200 but `errors` array is present)
