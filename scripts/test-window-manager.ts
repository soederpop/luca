import { NodeContainer } from '../src/node/container'

const container = new NodeContainer({ cwd: process.cwd() })
const wm = container.feature('windowManager')

// Start listening for the native app to connect
await wm.listen()
console.log('Listening:', wm.isListening)
console.log('Socket path:', wm.state.get('socketPath'))

wm.on('clientConnected', () => {
  console.log('App connected')
})

// Forward any non-window messages from the app
wm.on('message', (msg) => {
  console.log('Message from app:', msg)
})

// Wait for the app, then spawn a window
wm.on('clientConnected', async () => {
  const result = await wm.spawn({
    url: 'https://www.google.com',
    width: 1024,
    height: 768,
  })
  console.log('Spawned window:', result)
})

console.log('Waiting for native app to connect...')
