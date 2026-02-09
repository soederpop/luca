# The Shapeshifter: Full-Stack Real-Time App with Shared State

This tutorial builds a complete application where the same Luca container architecture runs on both server and browser, sharing state over WebSockets. You'll add voice recognition in the browser to control the server, and text-to-speech to read responses aloud.

This is a capstone tutorial. It assumes you've read:
- [Getting Started](./getting-started.md)
- [Express Server](./express-server.md)
- [WebSocket Communication](./websocket-communication.md)
- [Building for the Browser](./building-for-the-browser.md)
- [Observable State Sync](./observable-state-sync.md)
- [Voice and Speech](./voice-and-speech.md)

## What We're Building

A two-sided application:

**Server (NodeContainer):**
- Express serves the HTML page and browser bundle
- WebSocket server handles commands and broadcasts state
- Observable state tracks files, git info, and system data
- Any state change is broadcast to all connected browsers

**Browser (WebContainer):**
- Mirrors the server's state locally
- Voice recognition captures spoken commands
- Commands travel over WebSocket to the server
- Server executes them and updates state
- State changes flow back to the browser
- Text-to-speech reads confirmations aloud
- The DOM updates reactively from state observation

The result: say "list files" into your microphone and hear the server read them back.

## Architecture Overview

```
┌─────────────────────────────────┐
│  Browser (WebContainer)         │
│                                 │
│  VoiceRecognition ──┐           │
│                     ▼           │
│  SocketClient ──── WebSocket ──────┐
│        ▲                        │  │
│        │                        │  │
│  State (mirror) ◄── observe ── UI  │
│                                 │  │
│  Speech ◄── state changes       │  │
└─────────────────────────────────┘  │
                                     │
┌─────────────────────────────────┐  │
│  Server (NodeContainer)         │  │
│                                 │  │
│  WebsocketServer ◄─────────────────┘
│        │
│        ▼
│  Command Handler
│        │
│        ▼
│  State (source of truth)
│        │
│  observe ──► broadcast to all clients
│                                 │
│  ExpressServer ── static files  │
│  FS, Git, OS ── data sources    │
└─────────────────────────────────┘
```

## Project Structure

```
shapeshifter/
├── server.ts          # NodeContainer server
├── client.ts          # Browser entry point (bundled by esbuild)
├── build.ts           # esbuild bundler for client.ts
├── public/
│   └── index.html     # The web page
└── dist/              # Build output (generated)
    └── client.js
```

## Step 1: The Shared Protocol

Both sides need to agree on the message types. We won't use a shared file (since the browser code is bundled separately), but both sides use the same conventions.

**Message types from server to client:**

| type | payload | when |
|---|---|---|
| `snapshot` | `{ state, version }` | On initial connection |
| `stateChange` | `{ changeType, key, value, version }` | When server state changes |
| `speak` | `{ text }` | When the server wants the browser to say something |

**Message types from client to server:**

| type | payload | when |
|---|---|---|
| `command` | `{ action, args? }` | When a voice command is recognized |

## Step 2: The Server

```ts
// shapeshifter/server.ts
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
    // Serve the built browser bundle
    app.use(express.static(distDir))

    // Serve the HTML page
    app.get('/', (_req, res) => {
      res.sendFile(resolve(publicDir, 'index.html'))
    })

    return app
  },
})

// ─── WebSocket Server ────────────────────────────────────────────
// Handles commands from browsers and broadcasts state changes.

const ws = container.server('websocket', { port: 8081 })

ws.on('connection', (socket) => {
  // Track connected clients
  sharedState.setState((s) => ({
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

ws.on('message', (rawData, socket) => {
  const { id, data } = JSON.parse(rawData.toString())

  if (data.type === 'command') {
    handleCommand(data, socket, id)
  }
})

// ─── State → Broadcast ──────────────────────────────────────────
// Every state change is broadcast to every connected browser.

sharedState.observe((changeType, key, value) => {
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

function handleCommand(msg: { action: string; args?: any }, socket: any, id: string) {
  const action = msg.action.toLowerCase()

  sharedState.set('lastCommand', action)
  sharedState.set('lastCommandTime', new Date().toISOString())

  let response = ''

  if (action.includes('list files') || action.includes('show files')) {
    const files = container.fs.lsFiles().slice(0, 15)
    sharedState.set('files', files)
    response = `Found ${files.length} files.`
  }

  else if (action.includes('what branch') || action.includes('which branch')) {
    const branch = container.git.branch
    sharedState.set('branch', branch)
    response = `You're on the ${branch} branch.`
  }

  else if (action.includes('read file') || action.includes('open file')) {
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
  }

  else if (action.includes('close file')) {
    sharedState.set('selectedFile', null)
    sharedState.set('fileContent', null)
    response = 'File closed.'
  }

  else if (action.includes('system info') || action.includes('system status')) {
    sharedState.setState({
      platform: container.os.platform,
      hostname: container.os.hostname,
    })
    response = `Running on ${container.os.platform}, hostname ${container.os.hostname}.`
  }

  else {
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

console.log(container.ui.colorize('green', `HTTP server: http://localhost:${http.port}`))
console.log(container.ui.colorize('cyan', `WebSocket server: ws://localhost:${ws.port}`))
console.log(container.ui.colorize('yellow', 'Open the browser and start talking.'))
```

## Step 3: The Browser Entry Point

This file gets bundled by esbuild into a single file the browser can import.

```ts
// shapeshifter/client.ts
import luca from '@/browser'

// ─── Enable Features ─────────────────────────────────────────────

let voice: any
try {
  voice = luca.feature('voice', { enable: true, continuous: true })
} catch {
  console.warn('Voice recognition not supported in this browser')
}

let speech: any
if ('speechSynthesis' in window) {
  speech = luca.feature('speech', { enable: true })
}

// ─── Shared State Mirror ─────────────────────────────────────────
// Mirrors the server's state. Changes flow in from WebSocket.

const serverState = luca.newState({
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

// ─── Local UI State ──────────────────────────────────────────────
// Tracks browser-only concerns.

const uiState = luca.newState({
  connected: false,
  listening: false,
  interimTranscript: '',
})

// ─── WebSocket Connection ────────────────────────────────────────

const ws = luca.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true,
})

ws.on('message', (event) => {
  const msg = JSON.parse(event.data)

  switch (msg.type) {
    case 'snapshot':
      serverState.setState(msg.state)
      break

    case 'stateChange':
      if (msg.changeType === 'delete') {
        serverState.delete(msg.key)
      } else {
        serverState.set(msg.key, msg.value)
      }
      break

    case 'speak':
      if (speech) speech.say(msg.text)
      break
  }
})

// ─── Voice → Commands ────────────────────────────────────────────

if (voice) {
  voice.on('result', ({ finalTranscript, interimTranscript }: any) => {
    uiState.set('interimTranscript', interimTranscript)

    if (finalTranscript.trim()) {
      ws.send({ type: 'command', action: finalTranscript.trim() })
    }
  })

  voice.state.observe((_ct: string, key: string, value: any) => {
    if (key === 'listening') {
      uiState.set('listening', value)
    }
  })
}

// ─── Reactive UI ─────────────────────────────────────────────────
// State observations drive DOM updates. No framework needed.

function renderUI() {
  const state = serverState.current
  const ui = uiState.current

  setHTML('status', ui.connected
    ? `Connected (${state.clientCount} client${state.clientCount !== 1 ? 's' : ''})`
    : 'Disconnected')

  setHTML('listening-status', ui.listening ? 'Listening...' : 'Not listening')
  setHTML('interim', ui.interimTranscript)
  setHTML('last-command', state.lastCommand || '—')
  setHTML('branch', state.branch || '—')
  setHTML('sha', state.sha ? state.sha.slice(0, 8) : '—')
  setHTML('platform', `${state.platform} / ${state.hostname}`)
  setHTML('cwd', state.cwd || '—')

  // File list
  const filesEl = document.getElementById('files')
  if (filesEl) {
    if (state.files.length > 0) {
      filesEl.innerHTML = state.files
        .map((f: string) => `<li><code>${f}</code></li>`)
        .join('')
    } else {
      filesEl.innerHTML = '<li>No files loaded. Say "list files" to populate.</li>'
    }
  }

  // Selected file
  const fileViewEl = document.getElementById('file-view')
  if (fileViewEl) {
    if (state.selectedFile) {
      fileViewEl.innerHTML = `
        <h3>${state.selectedFile}</h3>
        <pre><code>${escapeHTML(state.fileContent || '')}</code></pre>
      `
    } else {
      fileViewEl.innerHTML = '<p>No file selected. Say "read file [name]" to open one.</p>'
    }
  }
}

// Re-render on any state change
serverState.observe(renderUI)
uiState.observe(renderUI)

function setHTML(id: string, text: string) {
  const el = document.getElementById(id)
  if (el) el.textContent = text
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// ─── Button Handlers ─────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const listenBtn = document.getElementById('listen-btn')
  if (listenBtn && voice) {
    listenBtn.addEventListener('click', () => {
      if (voice.listening) {
        voice.stop()
      } else {
        voice.start()
      }
    })
  }

  const listFilesBtn = document.getElementById('list-files-btn')
  if (listFilesBtn) {
    listFilesBtn.addEventListener('click', () => {
      ws.send({ type: 'command', action: 'list files' })
    })
  }
})

// ─── Connect ─────────────────────────────────────────────────────

ws.connect().then(() => {
  uiState.set('connected', true)
  renderUI()
})

// Export for console access
;(window as any).luca = luca
;(window as any).serverState = serverState
;(window as any).uiState = uiState
;(window as any).ws = ws
```

## Step 4: The HTML Page

```html
<!-- shapeshifter/public/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>The Shapeshifter</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #0a0a0a;
      color: #e0e0e0;
      padding: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #667eea, #764ba2);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .subtitle { color: #666; margin-bottom: 2rem; }

    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .card {
      background: #141414;
      border: 1px solid #222;
      border-radius: 12px;
      padding: 1.25rem;
    }

    .card h2 {
      font-size: 0.85rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #888;
      margin-bottom: 0.75rem;
    }

    .card .value { font-size: 1.1rem; color: #fff; }

    .full-width { grid-column: 1 / -1; }

    button {
      background: #667eea;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 0.6rem 1.2rem;
      font-size: 0.95rem;
      cursor: pointer;
      margin-right: 0.5rem;
      margin-bottom: 0.5rem;
      transition: opacity 0.2s;
    }

    button:hover { opacity: 0.85; }
    button.secondary { background: #333; }

    #files {
      list-style: none;
      padding: 0;
    }

    #files li {
      padding: 0.3rem 0;
      border-bottom: 1px solid #1a1a1a;
    }

    pre {
      background: #111;
      border: 1px solid #222;
      border-radius: 8px;
      padding: 1rem;
      overflow-x: auto;
      font-size: 0.85rem;
      max-height: 300px;
      overflow-y: auto;
    }

    code { font-family: 'JetBrains Mono', 'Fira Code', monospace; }
    .listening { color: #4ade80; }
    .disconnected { color: #ef4444; }
    .connected { color: #4ade80; }
    .interim { color: #888; font-style: italic; min-height: 1.5rem; }

    .controls { margin-bottom: 1.5rem; }
  </style>
</head>
<body>
  <h1>The Shapeshifter</h1>
  <p class="subtitle">Same container, both sides of the wire. Speak to control the server.</p>

  <div class="controls">
    <button id="listen-btn">Start Listening</button>
    <button id="list-files-btn" class="secondary">List Files</button>
  </div>

  <div class="grid">
    <div class="card">
      <h2>Connection</h2>
      <div class="value" id="status">Connecting...</div>
    </div>

    <div class="card">
      <h2>Voice</h2>
      <div class="value" id="listening-status">Not listening</div>
    </div>

    <div class="card full-width">
      <h2>Heard</h2>
      <div class="interim" id="interim"></div>
      <div class="value">Last command: <span id="last-command">—</span></div>
    </div>

    <div class="card">
      <h2>Git</h2>
      <div class="value">
        Branch: <span id="branch">—</span><br>
        SHA: <span id="sha">—</span>
      </div>
    </div>

    <div class="card">
      <h2>System</h2>
      <div class="value">
        <span id="platform">—</span><br>
        <span id="cwd">—</span>
      </div>
    </div>

    <div class="card full-width">
      <h2>Files</h2>
      <ul id="files">
        <li>No files loaded. Say "list files" to populate.</li>
      </ul>
    </div>

    <div class="card full-width">
      <h2>File Viewer</h2>
      <div id="file-view">
        <p>No file selected. Say "read file [name]" to open one.</p>
      </div>
    </div>
  </div>

  <script type="module" src="/client.js"></script>
</body>
</html>
```

## Step 5: The Build Script

```ts
// shapeshifter/build.ts
import * as esbuild from 'esbuild'
import { resolve } from 'path'

await esbuild.build({
  entryPoints: [resolve(import.meta.dirname!, 'client.ts')],
  bundle: true,
  outfile: resolve(import.meta.dirname!, 'dist', 'client.js'),
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  conditions: ['browser', 'import'],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.CI': '""',
    'process.browser': 'true',
    'process.version': '""',
    'process.versions': '{}',
    'global': 'globalThis',
  },
})

console.log('Browser bundle built → shapeshifter/dist/client.js')
```

## Step 6: Run It

```bash
# Build the browser bundle
bun run shapeshifter/build.ts

# Start the server
bun run shapeshifter/server.ts
```

Open `http://localhost:3000` in Chrome (or any browser with Web Speech API support).

Click **Start Listening** and try:

- "list files" — populates the file list
- "what branch am I on" — shows the git branch
- "system info" — shows platform and hostname
- "read file package.json" — opens a file in the viewer
- "close file" — clears the viewer

The server speaks its response through your browser's speakers.

## How It All Works Together

Let's trace a single voice command through the entire system:

1. **You say** "list files"
2. **VoiceRecognition** fires its `result` event with `{ finalTranscript: "list files" }`
3. **The client** calls `ws.send({ type: 'command', action: 'list files' })`
4. **SocketClient** wraps it: `{ id: "uuid", data: { type: 'command', action: 'list files' } }`
5. **WebsocketServer** receives it, emits `'message'`
6. **The server's** message handler routes to `handleCommand`
7. **handleCommand** calls `container.fs.lsFiles()` and sets `sharedState.set('files', files)`
8. **The state observer** fires and calls `ws.broadcast({ type: 'stateChange', key: 'files', value: [...] })`
9. **The browser** receives the broadcast, applies it: `serverState.set('files', msg.value)`
10. **The UI observer** fires and re-renders the file list in the DOM
11. **The server also** sends `{ type: 'speak', text: 'Found 15 files.' }` back to the sender
12. **The browser** receives it and calls `speech.say('Found 15 files.')`

The entire round trip — voice to execution to UI update to speech — happens in under a second.

## The Symmetry

Both sides use the same architectural primitives:

| Concept | Server | Browser |
|---|---|---|
| **Container** | `NodeContainer` | `WebContainer` |
| **State** | `container.newState({...})` | `luca.newState({...})` |
| **Events** | `container.on('event', fn)` | `luca.on('event', fn)` |
| **WebSocket** | `container.server('websocket')` | `luca.client('websocket')` |
| **Feature access** | `container.fs`, `container.git` | `luca.voice`, `luca.speech` |
| **Observation** | `state.observe(fn)` | `state.observe(fn)` |

The state objects on both sides have the same API. The event buses work the same way. The WebSocket client and server use the same message envelope format. If you know how to use one container, you know how to use the other.

This is the Luca philosophy: one architecture, every runtime.

## Extending the Demo

Once you have the basic Shapeshifter running, here are some ways to push it further:

### Add More Commands

Add a file watcher so changes appear automatically:

```ts
// In server.ts
const fm = container.feature('fileManager', { enable: true })
await fm.start()
fm.on('change', (path) => {
  sharedState.setState((s) => ({
    files: [...s.files.filter(f => f !== path), path],
  }))
})
```

### Add a REPL Command

Let the browser send arbitrary code to execute on the server:

```ts
// In handleCommand:
if (action.startsWith('run ')) {
  const code = action.slice(4)
  const result = await container.vm.run(code)
  response = `Result: ${JSON.stringify(result)}`
}
```

### Expose via Ngrok

Make it accessible from your phone:

```ts
const exposer = container.feature('portExposer', { enable: true })
await exposer.expose(3000)
console.log('Public URL:', exposer.getPublicUrl())
```

### Multiple Browsers

Open the page in multiple tabs or on different devices. They all share the same state — when one says "list files", the others update too, because the server broadcasts to all connections.

## Debugging

The browser entry point exports everything to `window` for console access:

```js
// In the browser console:
window.serverState.current     // see the mirrored state
window.serverState.version     // check the version
window.uiState.current         // see UI state
window.luca.features.available // see available features
window.ws.send({ type: 'command', action: 'list files' }) // send commands manually
```

On the server, state is just as inspectable:

```ts
sharedState.current  // full state object
sharedState.version  // how many changes have happened
```

## Next Steps

You've built a complete real-time application with voice control, shared state, and the same container architecture on both sides. From here you can:

- Add an [MCP Server](./websocket-communication.md) so AI tools can interact with it too
- Add the [Docker feature](../codebase-explainer.md) to manage containers from your voice
- Build a [second-layer container](./building-the-agi-container.md) that specializes the Shapeshifter for your domain
