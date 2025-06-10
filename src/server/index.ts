export * from './server.js'
export * from '../servers/express.js'
export * from '../servers/socket.js'

import { servers as registry } from './server'
import { ExpressServer } from '../servers/express'
import { WebsocketServer } from '../servers/socket'

registry.register('express', ExpressServer)
registry.register('websocket', WebsocketServer)

export const servers = registry

export interface AvailableServers {
  express: typeof ExpressServer;
  websocket: typeof WebsocketServer;  
}