import { NodeContainer } from '../src/node/container'

const args = new Set(process.argv.slice(2))
const socketArg = process.argv.slice(2).find((arg) => arg.startsWith('--socket='))
const socketPath = socketArg?.slice('--socket='.length)
const shouldSpawnTTY = args.has('--spawn-tty')
const shouldSpawnWindow = args.has('--spawn-window')

const container = new NodeContainer({ cwd: process.cwd() })
const wm = socketPath
  ? container.feature('windowManager', { socketPath })
  : container.feature('windowManager')

wm.listen()

const logCount = () => {
  console.log(`[state] windowCount=${wm.state.get('windowCount')}`)
}

wm.on('clientConnected', () => {
  console.log('[clientConnected] native launcher connected')
})

wm.on('clientDisconnected', () => {
  console.log('[clientDisconnected] native launcher disconnected')
})

wm.on('windowAck', (msg) => {
  console.log('[windowAck]', JSON.stringify(msg))
  logCount()
})

wm.on('windowClosed', (msg) => {
  console.log('[windowClosed]', JSON.stringify(msg))
  logCount()
})

wm.on('terminalExited', (msg) => {
  console.log('[terminalExited]', JSON.stringify(msg))
})

wm.on('message', (msg) => {
  if (msg?.type === 'windowAck' || msg?.type === 'windowClosed' || msg?.type === 'terminalExited') {
    return
  }
  console.log('[message]', JSON.stringify(msg))
})

let spawned = false
wm.on('clientConnected', async () => {
  if (spawned) return
  spawned = true

  if (shouldSpawnWindow) {
    const opened = await wm.spawn({
      url: 'https://example.com',
      width: 900,
      height: 620,
    })
    console.log('[spawn-window]', opened)
  }

  if (shouldSpawnTTY) {
    const tty = await wm.spawnTTY({
      command: 'zsh',
      args: ['-lc', 'echo "window-manager lifecycle demo"; sleep 2; exit 7'],
      title: 'WM Lifecycle Demo',
      cols: 110,
      rows: 32,
      width: 960,
      height: 620,
      cwd: process.cwd(),
    })
    console.log('[spawn-tty]', tty)
  }
})

await container.sleep(150)

console.log(`[ready] listening=${wm.isListening} socket=${wm.state.get('socketPath') ?? '<unset>'}`)
if (!wm.isListening) {
  console.log(`[error] ${wm.state.get('lastError') ?? 'windowManager failed to bind socket'}`)
  console.log('[hint] try: bun run scripts/test-window-manager-lifecycle.ts --socket=/tmp/ipc-window.sock')
}
console.log('[usage] bun run scripts/test-window-manager-lifecycle.ts [--spawn-tty] [--spawn-window] [--socket=/path/to/ipc-window.sock]')
console.log('[ready] waiting for native app connection...')
