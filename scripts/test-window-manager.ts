import { NodeContainer } from '../src/node/container'

const container = new NodeContainer({ cwd: process.cwd() })
const wm = container.feature('windowManager')

console.log('Connected:', wm.isConnected)

// Ping the server
const pong = await wm.ping()
console.log('Ping response:', pong)

// Spawn a Google window
const result = await wm.spawn({
  url: 'https://www.google.com',
  width: 1024,
  height: 768,
})
console.log('Spawned window:', result)
