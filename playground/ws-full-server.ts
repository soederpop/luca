// Part 3: Full WebSocket server with introspection, state broadcasting, and typed protocol
import container from '../src/node'
import type { WebsocketServer } from '../src/servers/socket'
import type { ClientMessages, ServerMessages } from './protocol'

const ws = container.server('websocket', { port: 8081 })

// --- Typed protocol helper (from "Building a Typed Protocol" section) ---
function createProtocol(ws: WebsocketServer) {
  return {
    onMessage<T extends keyof ClientMessages>(
      type: T,
      handler: (data: ClientMessages[T], socket: any, id: string) => void
    ) {
      ws.on('message', (rawData, socket) => {
        const { id, data } = JSON.parse(rawData.toString())
        if (data.type === type) {
          handler(data, socket, id)
        }
      })
    },

    reply<T extends keyof ServerMessages>(
      socket: any,
      type: T,
      data: ServerMessages[T]
    ) {
      ws.send(socket, { type, ...data })
    },
  }
}

const proto = createProtocol(ws)

// --- Connection handler: send available features on connect ---
ws.on('connection', (socket) => {
  console.log('Client connected')
  ws.send(socket, {
    type: 'connected',
    features: container.features.available,
  })
})

// --- Typed message handlers ---
proto.onMessage('ping', (_data, socket, id) => {
  proto.reply(socket, 'pong', { replyTo: id })
})

proto.onMessage('getState', (_data, socket, id) => {
  proto.reply(socket, 'state', {
    replyTo: id,
    state: container.currentState,
  })
})

proto.onMessage('getGitInfo', (_data, socket, id) => {
  proto.reply(socket, 'gitInfo', {
    replyTo: id,
    branch: container.git.branch,
    sha: container.git.sha,
  })
})

proto.onMessage('exec', (data, socket, id) => {
  container.proc.exec(data.command).then((result: any) => {
    proto.reply(socket, 'execResult', {
      replyTo: id,
      stdout: result.stdout,
      stderr: result.stderr,
    })
  })
})

proto.onMessage('chat', (data, socket, id) => {
  // Broadcast chat to all connected clients
  ws.broadcast({
    type: 'chat',
    from: id,
    text: data.text,
  })
})

// --- Broadcast state changes to all clients ---
container.state.observe(() => {
  ws.broadcast({
    type: 'stateChanged',
    state: container.currentState,
  })
})

// --- Fallback handler for unknown message types ---
ws.on('message', (rawData, socket) => {
  const { id, data } = JSON.parse(rawData.toString())
  const knownTypes = ['ping', 'getState', 'getGitInfo', 'exec', 'chat']
  if (!knownTypes.includes(data.type)) {
    ws.send(socket, { type: 'unknown', replyTo: id })
  }
})

await ws.start()
console.log(`WebSocket server ready on ws://localhost:${ws.port}`)
