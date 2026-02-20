import { NodeContainer } from '../src/node/container'

const container = new NodeContainer({ cwd: process.cwd() })
const listener = container.feature('launcherAppCommandListener', {
  enable: true,
  autoListen: true,
})

await listener.enable()

console.log('Listening on:', listener.state.get('socketPath'))
console.log('Waiting for native app to connect...\n')

listener.on('clientConnected', () => {
  console.log('[connected] Native app connected')
})

listener.on('clientDisconnected', () => {
  console.log('[disconnected] Native app disconnected')
})

listener.on('command', async (cmd) => {
  console.log(`[command] "${cmd.text}" (source: ${cmd.source}, id: ${cmd.id})`)

  cmd.ack('Got it, working on it!')

  // Simulate some work
  await new Promise((r) => setTimeout(r, 1500))
  cmd.progress(0.5, 'Halfway there')

  await new Promise((r) => setTimeout(r, 1500))
  cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'All done!' })

  console.log(`[finished] "${cmd.text}" (${listener.state.get('commandsReceived')} total received)`)
})

listener.on('message', (msg) => {
  console.log('[message]', JSON.stringify(msg))
})
