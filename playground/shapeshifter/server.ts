import container from '@/node'
import express from 'express'
import { resolve } from 'path'

// ─── Shared State ────────────────────────────────────────────────
// This is the source of truth. Changes here broadcast to all clients.

const sharedState = container.newState({
  files: [] as string[],
  branch: '',
  sha: '',
  platform: '',
  hostname: '',
  cwd: '',
  selectedFile: null as string | null,
  fileContent: null as string | null,
  clientCount: 0,
  lastCommand: '',
  lastCommandTime: '',
})

// Populate initial data
sharedState.setState({
  branch: container.git.branch,
  sha: container.git.sha,
  platform: container.os.platform,
  hostname: container.os.hostname,
  cwd: container.cwd,
})

// ─── HTTP Server ─────────────────────────────────────────────────
// Serves the HTML page and the bundled browser code.

const distDir = resolve(import.meta.dirname!, 'dist')
const publicDir = resolve(import.meta.dirname!, 'public')

const http = container.server('express', {
  port: 3000,
  create(app) {
    // Serve the built browser bundle from dist/
    app.use(express.static(distDir))

    // Serve static assets from public/ (but index.html is handled explicitly)
    app.use(express.static(publicDir))

    // Serve the HTML page at root
    app.get('/', (_req, res) => {
      res.sendFile(resolve(publicDir, 'index.html'))
    })

    return app
  },
})

// ─── WebSocket Server ────────────────────────────────────────────
// Handles commands from browsers and broadcasts state changes.

const ws = container.server('websocket', { port: 8081 })

ws.on('connection', (socket: any) => {
  // Track connected clients
  sharedState.setState((s: any) => ({
    clientCount: s.clientCount + 1,
  }))

  // Send a full snapshot so the new client is up to date
  ws.send(socket, {
    type: 'snapshot',
    state: sharedState.current,
    version: sharedState.version,
  })

  console.log(`Client connected (${sharedState.get('clientCount')} total)`)
})

ws.on('message', (rawData: any, socket: any) => {
  const { id, data } = JSON.parse(rawData.toString())

  if (data.type === 'command') {
    handleCommand(data, socket, id)
  }
})

// ─── State → Broadcast ──────────────────────────────────────────
// Every state change is broadcast to every connected browser.

sharedState.observe((changeType: string, key: string, value: any) => {
  ws.broadcast({
    type: 'stateChange',
    changeType,
    key: String(key),
    value,
    version: sharedState.version,
  })
})

// ─── Command Handler ─────────────────────────────────────────────
// Processes voice commands from the browser.

async function handleCommand(
  msg: { action: string; args?: any },
  socket: any,
  id: string,
) {
  const action = msg.action.toLowerCase()

  sharedState.set('lastCommand', action)
  sharedState.set('lastCommandTime', new Date().toISOString())

  let response = ''

  if (action.includes('list files') || action.includes('show files')) {
    const files = await container.git.lsFiles()
    const trimmed = files.slice(0, 15)
    sharedState.set('files', trimmed)
    response = `Found ${files.length} files. Showing the first ${trimmed.length}.`
  } else if (
    action.includes('what branch') ||
    action.includes('which branch')
  ) {
    const branch = container.git.branch
    sharedState.set('branch', branch)
    response = `You're on the ${branch} branch.`
  } else if (action.includes('read file') || action.includes('open file')) {
    const filename = msg.args || extractFilename(action)
    if (filename) {
      try {
        const content = container.fs.readFile(filename)
        sharedState.set('selectedFile', filename)
        sharedState.set('fileContent', content)
        response = `Opened ${filename}.`
      } catch {
        response = `Could not read ${filename}.`
      }
    } else {
      response = 'Which file would you like me to read?'
    }
  } else if (action.includes('close file')) {
    sharedState.set('selectedFile', null)
    sharedState.set('fileContent', null)
    response = 'File closed.'
  } else if (
    action.includes('system info') ||
    action.includes('system status')
  ) {
    sharedState.setState({
      platform: container.os.platform,
      hostname: container.os.hostname,
    })
    response = `Running on ${container.os.platform}, hostname ${container.os.hostname}.`
  } else {
    response = `I heard "${action}" but I don't know how to handle that.`
  }

  // Tell the browser to speak the response
  ws.send(socket, { type: 'speak', text: response, replyTo: id })
}

function extractFilename(text: string): string | null {
  // Simple extraction: take the last word as the filename
  const words = text.split(' ')
  const last = words[words.length - 1]
  if (last && last !== 'file') return last
  return null
}

// ─── Start Everything ────────────────────────────────────────────

await Promise.all([http.start(), ws.start()])

console.log(container.ui.colors.green(`HTTP server: http://localhost:${http.port}`))
console.log(container.ui.colors.cyan(`WebSocket server: ws://localhost:${ws.port}`))
console.log(container.ui.colors.yellow('Open the browser and start talking.'))
