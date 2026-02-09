# Building for the Browser with WebContainer

Luca isn't just for Node. The `WebContainer` brings the same architecture — dependency injection, observable state, event buses, features, and clients — into the browser. This tutorial covers how to get Luca running in a web page, what's available to you, and how to wire it up with a server.

## The Two Containers

Luca has two platform-specific containers:

| | NodeContainer | WebContainer |
|---|---|---|
| **Import** | `import container from '@/node'` | `import container from '@/browser'` |
| **Runtime** | Bun / Node.js | Browser |
| **Auto-enabled features** | 7 (fs, git, proc, os, networking, ui, vm) | None — everything is opt-in |
| **Available features** | 26+ | 8 (assetLoader, voice, speech, network, vault, vm, esbuild, mdxLoader) |
| **Registries** | features, clients, servers | features, clients |

The key philosophical difference: `NodeContainer` auto-enables core features because server environments are predictable. `WebContainer` makes everything opt-in because browser capabilities vary and some (like microphone access) require user permission.

Both share the same base `Container` class. They have the same state system, event bus, factory caching, and plugin architecture.

## Getting a WebContainer

The browser entry point exports a pre-built singleton:

```ts
// src/browser.ts
import { WebContainer } from './web/container.js'
export default new WebContainer({})
```

When bundled and loaded in a browser, this gives you a ready-to-use container.

## Building the Browser Bundle

Luca uses esbuild to bundle the `WebContainer` and all its features into a single ESM file that browsers can import.

```ts
// scripts/build-web.ts
import container from '@/node'
import * as esbuild from 'esbuild'

const result = await esbuild.build({
  entryPoints: ['src/browser.ts'],
  bundle: true,
  outfile: 'dist/esbuild/browser.js',
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  sourcemap: true,
  conditions: ['browser', 'import'],
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.browser': 'true',
    'global': 'globalThis',
  },
})
```

The `conditions: ['browser', 'import']` is important — it tells esbuild to resolve packages like `isomorphic-ws` to their browser implementations.

Run the build:

```bash
bun run scripts/build-web.ts
```

This produces `dist/esbuild/browser.js` — a self-contained ESM module.

## Serving the Bundle

The simplest way to get Luca into a browser is to serve the bundle alongside an HTML page using the `ExpressServer`:

```ts
// scripts/serve.ts
import container from '@/node'
import express from 'express'
import { resolve } from 'path'

const distDir = resolve(import.meta.dirname!, '..', 'dist', 'esbuild')

const server = container.server('express', {
  port: 3000,
  create(app) {
    app.use(express.static(distDir))

    app.get('/', (_req, res) => {
      res.sendFile(resolve(import.meta.dirname!, 'serve', 'index.html'))
    })

    return app
  },
})

await server.start()
console.log('Serving at http://localhost:3000')
```

And the HTML page:

```html
<!-- scripts/serve/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Luca</title>
</head>
<body>
  <h1>Luca</h1>
  <p>Open the browser console to interact with <code>window.luca</code></p>
  <script type="module">
    import luca from '/browser.js'
    window.luca = luca
    console.log('window.luca is ready', luca)
  </script>
</body>
</html>
```

The import path `/browser.js` resolves to `dist/esbuild/browser.js` because the entire dist directory is served as static files.

Build and serve:

```bash
bun run scripts/build-web.ts && bun run scripts/serve.ts
```

Open `http://localhost:3000`, open the browser console, and you'll have a live `WebContainer` at `window.luca`.

## Enabling Browser Features

Unlike `NodeContainer`, nothing is enabled by default. You opt into features explicitly:

```ts
import luca from '/browser.js'

// Enable voice recognition
const voice = luca.feature('voice', { enable: true })

// Enable text-to-speech
const speech = luca.feature('speech', { enable: true })

// Enable online/offline detection
const network = luca.feature('network', { enable: true })
network.start()

// Enable the asset loader (for loading external scripts/styles)
const assetLoader = luca.feature('assetLoader', { enable: true })

// Enable the browser VM
const vm = luca.feature('vm', { enable: true })
```

Once enabled, features attach to the container as properties:

```ts
luca.voice    // VoiceRecognition instance
luca.speech   // Speech instance
luca.network  // Network instance
```

## Available Browser Features

### AssetLoader

Dynamically load scripts and stylesheets into the page:

```ts
const loader = luca.feature('assetLoader', { enable: true })

// Load a CSS file
await loader.loadStylesheet('https://cdn.example.com/styles.css')

// Load and remove
loader.removeStylesheet('https://cdn.example.com/styles.css')

// Load a JS library from unpkg and get its global
const React = await loader.unpkg('react', 'React')
```

### VoiceRecognition

Speech-to-text using the Web Speech API:

```ts
const voice = luca.feature('voice', { enable: true, language: 'en-US' })

voice.on('result', ({ finalTranscript, interimTranscript }) => {
  console.log('Heard:', finalTranscript)
})

voice.start()
const transcript = await voice.whenFinished()
```

Covered in depth in the [Voice and Speech tutorial](./voice-and-speech.md).

### Speech

Text-to-speech using the Web Speech Synthesis API:

```ts
const speech = luca.feature('speech', { enable: true })

speech.loadVoices()
speech.say('Hello from Luca!')
```

### Network

Detect online/offline status reactively:

```ts
const network = luca.feature('network', { enable: true })
network.start()

console.log(network.isOnline)  // true

network.on('offline', () => console.log('Lost connection'))
network.on('online', () => console.log('Back online'))
```

### VM

Execute code in an isolated context (uses a hidden iframe sandbox):

```ts
const vm = luca.feature('vm', { enable: true })

const result = await vm.run('1 + 2 + 3')
console.log(result) // 6

// With context
const greeting = await vm.run('`Hello ${name}`', { name: 'World' })

// With TypeScript compilation (requires esbuild feature)
const typed = await vm.run(
  'const x: number = 42; x * 2',
  {},
  { transform: { loader: 'ts' } }
)
```

### Esbuild (Browser)

Compile TypeScript in the browser using esbuild-wasm:

```ts
const esbuild = luca.feature('esbuild', { enable: true })
await esbuild.start() // loads WASM from unpkg

const result = await esbuild.compile(`
  const x: number = 42
  console.log(x)
`)

console.log(result.code) // compiled JavaScript
```

### Vault

Encrypt and decrypt data in the browser using AES-GCM:

```ts
const vault = luca.feature('vault', { enable: true })

const encrypted = await vault.encrypt('sensitive data')
const decrypted = await vault.decrypt(encrypted)
console.log(decrypted) // 'sensitive data'
```

## Connecting to a Server

The `WebContainer` has a clients registry with a `SocketClient` for WebSocket connections:

```ts
const ws = luca.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true,
})

await ws.connect()

ws.on('message', (event) => {
  const data = JSON.parse(event.data)
  console.log('Server says:', data)
})

// Messages are auto-wrapped in an envelope with a UUID
await ws.send({ type: 'hello', text: 'Hi from the browser' })
// Server receives: { id: "uuid-here", data: { type: 'hello', text: 'Hi from the browser' } }
```

The `reconnect: true` option will automatically reconnect if the connection drops.

For a full walkthrough of WebSocket communication, see the [WebSocket Communication tutorial](./websocket-communication.md).

## State and Events Work the Same

The `WebContainer` has the same observable state and event bus as `NodeContainer`:

```ts
// Create observable state
const appState = luca.newState({
  count: 0,
  user: null,
})

// Observe changes
appState.observe((changeType, key, value) => {
  console.log(`${changeType}: ${key} =`, value)
  // Render your UI, update the DOM, etc.
})

appState.set('count', 1)  // triggers observer: "update: count = 1"

// Create an event bus
const bus = luca.bus()
bus.on('userAction', (action) => console.log(action))
bus.emit('userAction', { type: 'click', target: 'button' })
```

This is the foundation for state synchronization between server and browser — covered in the [Observable State Sync tutorial](./observable-state-sync.md).

## Environment Detection

```ts
luca.isBrowser     // true
luca.isNode        // false
luca.isProduction  // depends on how you built the bundle
```

## Introspection Works Too

Just like on the server, you can discover what's available at runtime:

```ts
luca.features.available
// ['assetLoader', 'voice', 'speech', 'network', 'vault', 'vm', 'esbuild', 'mdxLoader']

luca.enabledFeatureIds
// ['voice', 'speech'] (whatever you've enabled)
```

## A Complete Browser App

Here's a full example — a page that uses voice recognition, displays results, and connects to a server:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Luca Browser App</title>
</head>
<body>
  <h1>Luca Voice Demo</h1>
  <button id="listen">Start Listening</button>
  <p id="transcript"></p>
  <p id="status">Disconnected</p>

  <script type="module">
    import luca from '/browser.js'
    window.luca = luca

    // Enable features
    const voice = luca.feature('voice', { enable: true, continuous: true })
    const speech = luca.feature('speech', { enable: true })

    // Connect to server
    const ws = luca.client('websocket', {
      baseURL: 'ws://localhost:8081',
      reconnect: true,
    })

    // Observable state drives the UI
    const appState = luca.newState({
      connected: false,
      listening: false,
      transcript: '',
    })

    appState.observe((changeType, key, value) => {
      if (key === 'transcript') {
        document.getElementById('transcript').textContent = value
      }
      if (key === 'connected') {
        document.getElementById('status').textContent = value ? 'Connected' : 'Disconnected'
      }
    })

    // Wire up voice → state → UI
    voice.on('result', ({ finalTranscript }) => {
      appState.set('transcript', finalTranscript)
      ws.send({ type: 'voice', text: finalTranscript })
    })

    // Wire up server messages → speech
    ws.on('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'speak') {
        speech.say(msg.text)
      }
    })

    // Button handler
    document.getElementById('listen').addEventListener('click', () => {
      if (voice.listening) {
        voice.stop()
      } else {
        voice.start()
      }
    })

    // Connect
    await ws.connect()
    appState.set('connected', true)
  </script>
</body>
</html>
```

## Next Steps

- [Observable State as a Synchronization Primitive](./observable-state-sync.md) — using state to keep server and browser in sync
- [Voice and Speech in the Browser](./voice-and-speech.md) — deep dive on voice recognition and text-to-speech
- [WebSocket Communication](./websocket-communication.md) — the real-time messaging layer
