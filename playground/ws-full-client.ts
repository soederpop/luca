// Part 3 client: Exercises all endpoints on the full server
import WebSocket from 'ws'
import { v4 as uuid } from 'node-uuid'

const ws = new WebSocket('ws://localhost:8081')

function send(data: any) {
  const id = uuid()
  ws.send(JSON.stringify({ id, data }))
  return id
}

ws.on('open', () => {
  console.log('Connected to full server\n')

  // Query git info
  send({ type: 'getGitInfo' })

  // Query container state
  send({ type: 'getState' })

  // Send a ping
  send({ type: 'ping' })

  // Send a chat message (will be broadcast to all clients)
  send({ type: 'chat', text: 'Hello everyone!' })

  // Send an unknown type to test fallback
  send({ type: 'foobar' })

  // Close after a couple seconds so the script exits
  setTimeout(() => {
    console.log('\nClosing connection')
    ws.close()
  }, 2000)
})

ws.on('message', (rawData) => {
  const msg = JSON.parse(rawData.toString())
  console.log(`[${msg.type}]`, JSON.stringify(msg, null, 2))
})

ws.on('close', () => {
  console.log('Disconnected')
  process.exit(0)
})

ws.on('error', (err) => {
  console.error('Connection error:', err.message)
  process.exit(1)
})
