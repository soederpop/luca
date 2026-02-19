import { NodeContainer } from '../src/node/container'

const container = new NodeContainer({ cwd: process.cwd() })
const wm = container.feature('windowManager', { 
  autoConnect: true,
  token: "t_V+3OtVbtEYK5QcQ3RfAgcf6jCrEOLGSXalHEFSBdPso=",
  projectId: "p_luca"
} as any)

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
