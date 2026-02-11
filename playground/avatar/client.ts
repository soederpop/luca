import luca from '@/browser'

// ── Server State Mirror ─────────────────────────────────────────
// Syncs from WebSocket. This is the source of truth from the server.

const serverState = luca.newState({
  phase: 'booting' as string,
  errorMessage: '',
  currentImage: 0,
  totalImages: 4,
  stepProgress: 0,
  stepCurrent: 0,
  stepTotal: 30,
  images: [] as Array<{
    index: number
    filename: string
    url: string
    prompt: string
    seed: number
  }>,
  selectedIndex: null as number | null,
  selectedAvatar: null as {
    filename: string
    url: string
    prompt: string
    seed: number
  } | null,
  hasCachedAvatar: false,
  cachedAvatar: null as any,
})

// ── Local UI State ──────────────────────────────────────────────

const uiState = luca.newState({
  connected: false,
})

// ── WebSocket Connection ────────────────────────────────────────

const ws = luca.client('websocket', {
  baseURL: 'ws://localhost:8082',
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
  }
})

// ── Actions ─────────────────────────────────────────────────────

function selectAvatar(index: number) {
  ws.send({ type: 'select', index })
}

function regenerate() {
  ws.send({ type: 'regenerate' })
}

// ── Phase Visibility ────────────────────────────────────────────

const phases = ['phase-boot', 'phase-generating', 'phase-grid', 'phase-selected', 'phase-error']

function showPhase(id: string) {
  for (const p of phases) {
    const el = document.getElementById(p)
    if (el) el.classList.toggle('active', p === id)
  }
}

// ── Rendering ───────────────────────────────────────────────────

function renderUI() {
  const state = serverState.current as any
  const ui = uiState.current as any

  // Connection indicator
  const connEl = document.getElementById('connection')
  if (connEl) {
    connEl.textContent = ui.connected ? 'connected' : 'disconnected'
    connEl.className = `connection ${ui.connected ? 'connected' : ''}`
  }

  // Phase routing
  switch (state.phase) {
    case 'booting':
    case 'connecting':
      showPhase('phase-boot')
      renderBoot(state)
      break

    case 'generating':
      showPhase('phase-generating')
      renderGenerating(state)
      break

    case 'ready':
      showPhase('phase-grid')
      renderGrid(state)
      break

    case 'selected':
      showPhase('phase-selected')
      renderSelected(state)
      break

    case 'error':
      showPhase('phase-error')
      renderError(state)
      break
  }
}

function renderBoot(state: any) {
  const text = document.getElementById('boot-text')
  if (!text) return

  if (state.phase === 'connecting') {
    text.textContent = 'Connecting to image generator...'
  } else {
    text.textContent = 'Initializing...'
  }
}

function renderGenerating(state: any) {
  const label = document.getElementById('gen-label')
  const percent = document.getElementById('gen-percent')
  const bar = document.getElementById('gen-bar')
  const grid = document.getElementById('gen-grid')

  if (label) label.textContent = `Generating image ${state.currentImage + 1} of ${state.totalImages}...`
  if (percent) percent.textContent = `${state.stepProgress}%`
  if (bar) (bar as HTMLElement).style.width = `${state.stepProgress}%`

  if (grid) renderImageCards(grid, state, false)
}

function renderGrid(state: any) {
  const grid = document.getElementById('pick-grid')
  if (grid) renderImageCards(grid, state, true)
}

function renderImageCards(container: HTMLElement, state: any, clickable: boolean) {
  const images: any[] = state.images || []

  // Only rebuild if the card count changed
  if (container.children.length !== state.totalImages) {
    container.innerHTML = ''

    for (let i = 0; i < state.totalImages; i++) {
      const card = document.createElement('div')
      card.className = 'image-card'
      card.dataset.index = String(i)

      const num = document.createElement('div')
      num.className = 'card-number'
      num.textContent = String(i + 1)
      card.appendChild(num)

      container.appendChild(card)
    }
  }

  // Update each card
  for (let i = 0; i < state.totalImages; i++) {
    const card = container.children[i] as HTMLElement
    if (!card) continue

    const img = images[i]
    const isGenerating = state.phase === 'generating' && i === state.currentImage
    const isWaiting = state.phase === 'generating' && i > state.currentImage && !img
    const isSelected = state.selectedIndex === i

    // Reset classes
    card.className = 'image-card'
    if (isSelected) card.classList.add('selected')
    if (state.selectedIndex !== null && !isSelected) card.classList.add('dimmed')

    // Content: either image, generating overlay, or placeholder
    const existingImg = card.querySelector('img')
    const existingOverlay = card.querySelector('.generating-overlay')
    const existingPlaceholder = card.querySelector('.placeholder')
    const existingPrompt = card.querySelector('.prompt-overlay')

    if (img) {
      // Show image
      if (existingOverlay) existingOverlay.remove()
      if (existingPlaceholder) existingPlaceholder.remove()

      if (!existingImg) {
        const imgEl = document.createElement('img')
        imgEl.src = img.url
        imgEl.alt = `Avatar option ${i + 1}`
        card.appendChild(imgEl)
      } else if (existingImg.src !== new URL(img.url, location.origin).href) {
        existingImg.src = img.url
      }

      // Prompt overlay
      if (!existingPrompt) {
        const overlay = document.createElement('div')
        overlay.className = 'prompt-overlay'
        overlay.textContent = img.prompt
        card.appendChild(overlay)
      }

      // Click handler
      if (clickable && state.selectedIndex === null) {
        card.style.cursor = 'pointer'
        card.onclick = () => selectAvatar(i)
      }
    } else if (isGenerating) {
      if (existingImg) existingImg.remove()
      if (existingPlaceholder) existingPlaceholder.remove()
      if (existingPrompt) existingPrompt.remove()

      if (!existingOverlay) {
        const overlay = document.createElement('div')
        overlay.className = 'generating-overlay'
        const spinner = document.createElement('div')
        spinner.className = 'spinner'
        const text = document.createElement('div')
        text.className = 'phase-text'
        text.textContent = 'Generating...'
        overlay.appendChild(spinner)
        overlay.appendChild(text)
        card.appendChild(overlay)
      }
    } else {
      // Waiting or empty
      if (existingImg) existingImg.remove()
      if (existingOverlay) existingOverlay.remove()
      if (existingPrompt) existingPrompt.remove()

      if (!existingPlaceholder) {
        const ph = document.createElement('div')
        ph.className = 'placeholder'
        ph.textContent = isWaiting ? 'Queued...' : ''
        card.appendChild(ph)
      }
    }
  }
}

function renderSelected(state: any) {
  const imgContainer = document.getElementById('selected-image')
  const promptEl = document.getElementById('selected-prompt')
  const labelEl = document.getElementById('selected-label')

  const avatar = state.selectedAvatar || state.cachedAvatar

  if (!avatar) return

  if (imgContainer) {
    let img = imgContainer.querySelector('img')
    if (!img) {
      img = document.createElement('img')
      imgContainer.appendChild(img)
    }
    const targetUrl = avatar.url || `/output/${avatar.filename}`
    if (img.src !== new URL(targetUrl, location.origin).href) {
      img.src = targetUrl
      img.alt = 'Your avatar'
    }
  }

  if (labelEl) {
    labelEl.textContent = state.hasCachedAvatar && !state.selectedAvatar ? 'Your current avatar' : 'This is you.'
  }

  if (promptEl) {
    promptEl.textContent = avatar.prompt || ''
  }
}

function renderError(state: any) {
  const el = document.getElementById('error-text')
  if (el) el.textContent = state.errorMessage || 'Something went wrong.'
}

// ── Observers ───────────────────────────────────────────────────

serverState.observe(renderUI)
uiState.observe(renderUI)

// ── Button Handlers ─────────────────────────────────────────────

const regenBtn = document.getElementById('regenerate-btn')
if (regenBtn) {
  regenBtn.addEventListener('click', () => regenerate())
}

// ── Connect ─────────────────────────────────────────────────────

ws.connect().then(() => {
  uiState.set('connected', true)
  renderUI()
})

// Export for console access
;(window as any).luca = luca
;(window as any).serverState = serverState
;(window as any).ws = ws
