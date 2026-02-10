import luca from '@/browser'

// ─── Enable Features ─────────────────────────────────────────────

// Voice and Speech are already registered and enabled by WebContainerExtensions.
// Grab existing instances if available, otherwise try to enable them.
let voice: any = (luca as any).voice || null
let speech: any = (luca as any).speech || null

if (!voice) {
  try {
    voice = luca.feature('voice', { enable: true, continuous: true })
  } catch {
    console.warn('Voice recognition not supported in this browser')
  }
}

if (!speech && 'speechSynthesis' in window) {
  try {
    speech = luca.feature('speech', { enable: true })
  } catch {
    console.warn('Speech synthesis not available')
  }
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

ws.on('message', (event: any) => {
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
  const state = serverState.current as any
  const ui = uiState.current as any

  setHTML(
    'status',
    ui.connected
      ? `Connected (${state.clientCount} client${state.clientCount !== 1 ? 's' : ''})`
      : 'Disconnected',
  )

  setHTML('listening-status', ui.listening ? 'Listening...' : 'Not listening')
  setHTML('interim', ui.interimTranscript)
  setHTML('last-command', state.lastCommand || '—')
  setHTML('branch', state.branch || '—')
  setHTML('sha', state.sha ? state.sha.slice(0, 8) : '—')
  setHTML('platform', `${state.platform} / ${state.hostname}`)
  setHTML('cwd', state.cwd || '—')

  // Update listen button text
  const listenBtn = document.getElementById('listen-btn')
  if (listenBtn) {
    listenBtn.textContent = ui.listening ? 'Stop Listening' : 'Start Listening'
  }

  // File list
  const filesEl = document.getElementById('files')
  if (filesEl) {
    if (state.files && state.files.length > 0) {
      filesEl.innerHTML = state.files
        .map((f: string) => `<li><code>${escapeHTML(f)}</code></li>`)
        .join('')
    } else {
      filesEl.innerHTML =
        '<li>No files loaded. Say "list files" or click the button to populate.</li>'
    }
  }

  // Selected file
  const fileViewEl = document.getElementById('file-view')
  if (fileViewEl) {
    if (state.selectedFile) {
      fileViewEl.innerHTML = `
        <h3>${escapeHTML(state.selectedFile)}</h3>
        <pre><code>${escapeHTML(state.fileContent || '')}</code></pre>
      `
    } else {
      fileViewEl.innerHTML =
        '<p>No file selected. Say "read file [name]" to open one.</p>'
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ─── Button Handlers ─────────────────────────────────────────────

const listenBtn = document.getElementById('listen-btn')
if (listenBtn && voice) {
  listenBtn.addEventListener('click', () => {
    if (voice.listening) {
      voice.stop()
    } else {
      voice.start()
    }
  })
} else if (listenBtn && !voice) {
  listenBtn.textContent = 'Voice Not Supported'
  listenBtn.setAttribute('disabled', 'true')
  listenBtn.style.opacity = '0.5'
}

const listFilesBtn = document.getElementById('list-files-btn')
if (listFilesBtn) {
  listFilesBtn.addEventListener('click', () => {
    ws.send({ type: 'command', action: 'list files' })
  })
}

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
