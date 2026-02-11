import container from '@/node'
import express from 'express'
import { resolve } from 'path'
import { generatePortraitPrompts, type AvatarImage } from './workflow'

const ui = container.feature('ui')

// ── Configuration ───────────────────────────────────────────────

const CONFIG = {
  server: {
    httpPort: 3456,
    wsPort: 8082,
  },
  // How long to fake each image generation (total ~20s across 4 images)
  mockDelayMs: 5000,
  // Steps to simulate per image
  mockSteps: 30,
}

// ── Shared State ────────────────────────────────────────────────
// Source of truth. Changes broadcast to all connected browsers.

const sharedState = container.newState({
  phase: 'booting' as 'booting' | 'connecting' | 'generating' | 'ready' | 'selected' | 'error',
  errorMessage: '',

  // Generation progress
  currentImage: 0,
  totalImages: 4,
  stepProgress: 0,
  stepCurrent: 0,
  stepTotal: CONFIG.mockSteps,

  // Results
  images: [] as AvatarImage[],

  // Selection
  selectedIndex: null as number | null,
  selectedAvatar: null as AvatarImage | null,

  // Cached avatar (loaded on startup if exists)
  hasCachedAvatar: false,
  cachedAvatar: null as {
    filename: string
    prompt: string
    seed: number
    selectedAt: string
  } | null,
})

// ── Stock Placeholder Images ────────────────────────────────────
// Generate simple colored portrait placeholders as PNG files.

const PLACEHOLDER_COLORS = ['#667eea', '#764ba2', '#f093fb', '#4fd1c5']
const PLACEHOLDER_LABELS = ['A', 'B', 'C', 'D']

async function generatePlaceholderImage(index: number, outputDir: string): Promise<string> {
  const color = PLACEHOLDER_COLORS[index]
  const label = PLACEHOLDER_LABELS[index]
  const filename = `avatar_placeholder_${index}.svg`

  // Create a simple SVG portrait placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="1024" viewBox="0 0 768 1024">
  <defs>
    <linearGradient id="bg${index}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1a1a2e;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="768" height="1024" fill="url(#bg${index})" rx="0"/>
  <!-- Silhouette -->
  <circle cx="384" cy="340" r="140" fill="rgba(255,255,255,0.1)"/>
  <ellipse cx="384" cy="680" rx="200" ry="240" fill="rgba(255,255,255,0.08)"/>
  <!-- Label -->
  <text x="384" y="900" text-anchor="middle" font-family="system-ui, sans-serif" font-size="48" fill="rgba(255,255,255,0.3)" font-weight="600">Option ${label}</text>
</svg>`

  const filePath = resolve(outputDir, filename)
  await Bun.write(filePath, svg)
  return filename
}

// ── Mock Generation ─────────────────────────────────────────────
// Simulates the ComfyUI generation process with a ~20s total delay.

async function mockGenerateAvatars() {
  sharedState.set('phase', 'generating')
  const outputDir = resolve(import.meta.dirname!, 'output')
  const { mkdir } = await import('fs/promises')
  await mkdir(outputDir, { recursive: true })

  const prompts = generatePortraitPrompts()
  const results: AvatarImage[] = []

  for (let i = 0; i < prompts.length; i++) {
    sharedState.set('currentImage', i)
    sharedState.set('stepProgress', 0)
    sharedState.set('stepCurrent', 0)

    // Simulate step-by-step progress
    const stepDelay = CONFIG.mockDelayMs / CONFIG.mockSteps
    for (let step = 1; step <= CONFIG.mockSteps; step++) {
      await new Promise(r => setTimeout(r, stepDelay))
      sharedState.set('stepCurrent', step)
      sharedState.set('stepProgress', Math.round((step / CONFIG.mockSteps) * 100))
    }

    // Generate the placeholder image
    const filename = await generatePlaceholderImage(i, outputDir)

    results.push({
      index: i,
      filename,
      url: `/output/${filename}`,
      prompt: prompts[i].positive,
      seed: prompts[i].seed,
    })

    // Update state incrementally so browser shows images as they arrive
    sharedState.set('images', [...results])
  }

  sharedState.set('phase', 'ready')
}

// ── Cache Management ────────────────────────────────────────────

const diskCache = container.feature('diskCache')
const CACHE_KEY = 'avatar:selected'

async function loadCachedAvatar(): Promise<boolean> {
  const hasCached = await diskCache.has(CACHE_KEY)

  if (hasCached) {
    const cached = await diskCache.get(CACHE_KEY, true) as any
    sharedState.set('hasCachedAvatar', true)
    sharedState.set('cachedAvatar', cached)
    sharedState.set('selectedAvatar', {
      index: -1,
      filename: cached.filename,
      url: `/output/${cached.filename}`,
      prompt: cached.prompt,
      seed: cached.seed,
    })
    sharedState.set('phase', 'selected')
    return true
  }

  return false
}

async function saveSelectedAvatar(image: AvatarImage) {
  await diskCache.set(CACHE_KEY, JSON.stringify({
    filename: image.filename,
    prompt: image.prompt,
    seed: image.seed,
    selectedAt: new Date().toISOString(),
  }))

  // Copy to a stable path
  const outputDir = resolve(import.meta.dirname!, 'output')
  const { copyFile } = await import('fs/promises')
  try {
    await copyFile(
      resolve(outputDir, image.filename),
      resolve(outputDir, 'selected-avatar.svg')
    )
  } catch {
    // Non-critical if copy fails
  }
}

// ── HTTP Server ─────────────────────────────────────────────────

const distDir = resolve(import.meta.dirname!, 'dist')
const publicDir = resolve(import.meta.dirname!, 'public')
const outputDir = resolve(import.meta.dirname!, 'output')

const http = container.server('express', {
  port: CONFIG.server.httpPort,
  create(app) {
    app.use(express.static(distDir))
    app.use(express.static(publicDir))
    app.use('/output', express.static(outputDir))
    app.get('/', (_req, res) => {
      res.sendFile(resolve(publicDir, 'index.html'))
    })
    return app
  },
})

// ── WebSocket Server ────────────────────────────────────────────

const ws = container.server('websocket', { port: CONFIG.server.wsPort })

ws.on('connection', (socket: any) => {
  // Send full snapshot so the new client is up to date
  ws.send(socket, {
    type: 'snapshot',
    state: sharedState.current,
    version: sharedState.version,
  })
})

ws.on('message', async (rawData: any, socket: any) => {
  const { id, data } = JSON.parse(rawData.toString())

  if (data.type === 'select') {
    const index = data.index
    const images = sharedState.get('images') as AvatarImage[]
    const image = images?.[index]

    if (image) {
      sharedState.set('selectedIndex', index)
      sharedState.set('selectedAvatar', image)
      sharedState.set('phase', 'selected')
      await saveSelectedAvatar(image)
      ui.print.green(`Avatar selected: option ${index + 1}`)
    }
  } else if (data.type === 'regenerate') {
    sharedState.set('images', [])
    sharedState.set('selectedIndex', null)
    sharedState.set('selectedAvatar', null)
    sharedState.set('hasCachedAvatar', false)
    sharedState.set('cachedAvatar', null)
    ui.print.cyan('Regenerating avatars...')
    mockGenerateAvatars()
  }
})

// ── State → Broadcast ───────────────────────────────────────────

sharedState.observe((changeType: string, key: string, value: any) => {
  ws.broadcast({
    type: 'stateChange',
    changeType,
    key: String(key),
    value,
    version: sharedState.version,
  })
})

// ── Open Browser ────────────────────────────────────────────────

async function openBrowser(url: string) {
  const proc = container.feature('proc')
  try {
    await proc.execAndCapture(`open "${url}"`)
  } catch {
    // Non-critical - user can open manually
  }
}

// ── Boot ────────────────────────────────────────────────────────

async function main() {
  ui.print.cyan('\n  Avatar Generator\n')

  // Step 1: Check for cached avatar
  const hasCached = await loadCachedAvatar()
  if (hasCached) {
    ui.print.green('  Found cached avatar selection')
  }

  // Step 2: Build browser bundle
  ui.print('  Building browser bundle...')
  const proc = container.feature('proc')
  await proc.execAndCapture(`bun run ${resolve(import.meta.dirname!, 'build.ts')}`)
  ui.print.green('  Bundle built')

  // Step 3: Start servers
  await Promise.all([http.start(), ws.start()])

  const url = `http://localhost:${CONFIG.server.httpPort}`
  ui.print.green(`\n  HTTP:      ${url}`)
  ui.print.cyan(`  WebSocket: ws://localhost:${CONFIG.server.wsPort}`)

  // Step 4: Open browser
  await openBrowser(url)
  ui.print.green('  Browser opened\n')

  // Step 5: Generate if no cached avatar
  if (!hasCached) {
    ui.print.cyan('  Generating avatar options...\n')
    await mockGenerateAvatars()
    ui.print.green('  Generation complete. Pick your avatar in the browser.\n')
  }
}

main().catch(err => {
  sharedState.set('phase', 'error')
  sharedState.set('errorMessage', err.message)
  ui.print.red(`Error: ${err.message}`)
  console.error(err)
})
