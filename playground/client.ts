// Part 2: WebSocket client for testing the server from Bun/Node
// In a browser, you'd use: import container from '../src/browser'
// and container.client('websocket', { baseURL: 'ws://localhost:8081' })
//
// Since we're running in Bun, we use the ws library directly to simulate
// the same message envelope format that SocketClient uses.
import WebSocket from 'ws'
import { v4 as uuid } from 'node-uuid'

const ws = new WebSocket('ws://localhost:8081')

function send(data: any) {
  // Match the SocketClient envelope format: { id, data }
  ws.send(JSON.stringify({
    id: uuid(),
    data,
  }))
}

ws.on('open', () => {
  console.log('Connected to server')

  // Send a chat message
  send({ type: 'chat', text: 'Hello from the client!' })

  // Send a ping
  send({ type: 'ping' })
})

ws.on('message', (rawData) => {
  const msg = JSON.parse(rawData.toString())
  console.log('Server says:', msg)
})

ws.on('close', () => {
  console.log('Disconnected')
})

ws.on('error', (err) => {
  console.error('Connection error:', err.message)
})
