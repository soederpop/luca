// Part 1: Basic WebSocket server using NodeContainer
import container from '../src/node'

const ws = container.server('websocket', { port: 8081 })

ws.on('connection', (socket) => {
  console.log('Client connected')

  // Send a welcome message to the new client
  ws.send(socket, { type: 'welcome', message: 'Hello from the server' })
})

ws.on('message', (rawData, socket) => {
  const data = JSON.parse(rawData.toString())
  console.log('Received:', data)

  // Echo back to the sender
  ws.send(socket, { type: 'echo', payload: data })
})

await ws.start()
console.log(`WebSocket server listening on port ${ws.port}`)
