// Public barrel for `luca/client`. The Client base class lives in
// ./client-base.ts; concrete clients extend from there. Because nothing in
// this file is a runtime dependency of those clients, the re-exports below
// are plain static ESM — no require(), no evaluation-order tricks, and the
// module graph is acyclic at runtime (client-base only type-imports us).
export * from './client-base.js'
export { Client, Client as default } from './client-base.js'

/** HTTP REST client (axios-based). Re-exported so `import { RestClient } from 'luca/client'` works as documented. */
export { RestClient } from './clients/rest.js'
/** GraphQL client. Re-exported so `import { GraphClient } from 'luca/client'` works as documented. */
export { GraphClient } from './clients/graph.js'
/** WebSocket client. Re-exported so `import { WebSocketClient } from 'luca/client'` works as documented. */
export { WebSocketClient } from './clients/websocket.js'
export type { WebSocketClientState, WebSocketClientOptions } from './clients/websocket.js'
export type { GraphClientOptions } from './clients/graph.js'

import type { ClientsRegistry } from './client-base.js'

// AvailableClients is an open interface — subclasses augment it via `declare module`
export interface AvailableClients {}

export interface ClientsInterface {
  clients: ClientsRegistry;
  client<T extends keyof AvailableClients>(
    key: T,
    options?: ConstructorParameters<AvailableClients[T]>[0]
  ): InstanceType<AvailableClients[T]>;
}

