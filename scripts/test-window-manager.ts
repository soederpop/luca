import { NodeContainer } from '../src/node/container'

const container = new NodeContainer({ cwd: process.cwd() })
const wm = container.feature('windowManager')

await wm.listen()
console.log('Listening:', wm.isListening)
console.log('Socket path:', wm.state.get('socketPath'))

wm.on('clientConnected', () => {
  console.log('App connected')
})

wm.on('message', (msg) => {
  console.log('Message from app:', msg)
})

wm.on('clientDisconnected', () => {
  console.log('App disconnected')
})

// Wait for the app, then spawn a TTY running luca serve in the writing assistant playground
wm.on('clientConnected', async () => {
  const result = await wm.spawnTTY({
    command: 'luca',
    args: ['serve', '--any-port'],
    cwd: '/Users/jon/@soederpop/playground/writing-assistant',
    title: 'Writing Assistant Server',
    cols: 120,
    rows: 40,
    width: 1000,
    height: 700,
  })

  console.log('Spawned TTY:', result)

  if (result.windowId) {
    console.log(`Window ID: ${result.windowId}`)
    console.log(`PID: ${result.pid}`)
  }
})

console.log('Waiting for native app to connect...')
