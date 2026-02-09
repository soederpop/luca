# Voice and Speech in the Browser

The `WebContainer` includes two features that let your application talk and listen: `VoiceRecognition` (speech-to-text) and `Speech` (text-to-speech). Together they turn a browser tab into a voice-controlled interface.

Both features wrap the Web Speech API, which is supported in Chrome, Edge, and Safari. They follow the standard Luca patterns: observable state, events, and the container's feature factory.

## VoiceRecognition — Listening

### Enabling

```ts
import luca from '/browser.js'

const voice = luca.feature('voice', { enable: true })
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `language` | `string` | `'en-US'` | BCP 47 language code |
| `continuous` | `boolean` | `false` | Keep listening after the user pauses |
| `autoListen` | `boolean` | `false` | Start listening immediately on creation |

```ts
// Listen continuously in British English
const voice = luca.feature('voice', {
  enable: true,
  language: 'en-GB',
  continuous: true,
})
```

### Starting and Stopping

```ts
voice.start()   // begin listening (clears any previous transcript)
voice.stop()    // stop listening gracefully
voice.abort()   // cancel immediately
```

`start()` clears the transcript before beginning — each listening session starts fresh.

### The Result Event

The primary event is `'result'`, which fires as the user speaks:

```ts
voice.on('result', ({ finalTranscript, interimTranscript }) => {
  console.log('Final:', finalTranscript)
  console.log('Interim:', interimTranscript)
})
```

| Property | Description |
|---|---|
| `finalTranscript` | Text the speech engine is confident about. Accumulates across the session. |
| `interimTranscript` | Text that may still change as more audio comes in. Updates rapidly. |

For a live-typing effect, show `interimTranscript`. For commands you'll act on, wait for `finalTranscript`.

### One-Shot Commands with whenFinished()

For "press to talk" interactions, `whenFinished()` returns a promise that resolves with the full transcript when the user stops speaking:

```ts
voice.start()
// User speaks: "create a new file called readme"
const command = await voice.whenFinished()
console.log(command) // "create a new file called readme"
```

If the voice feature isn't already listening, `whenFinished()` calls `start()` for you:

```ts
// This works — start() is called implicitly
const command = await voice.whenFinished()
```

### State

VoiceRecognition tracks its status in observable state:

```ts
voice.listening   // boolean — currently listening?
voice.transcript  // string — accumulated final transcript

// Or via the state object
voice.state.get('listening')
voice.state.get('transcript')

// React to state changes
voice.state.observe((changeType, key, value) => {
  if (key === 'listening') {
    button.textContent = value ? 'Listening...' : 'Start'
  }
  if (key === 'transcript') {
    display.textContent = value
  }
})
```

### Events

| Event | Payload | When |
|---|---|---|
| `'result'` | `{ finalTranscript, interimTranscript }` | Speech recognized |
| `'start'` | — | Listening began |
| `'stop'` | — | `stop()` was called |
| `'abort'` | — | `abort()` was called |
| `'end'` | — | Listening ended (any reason) |
| `'error'` | `string` | Recognition error |

### Clearing the Transcript

The transcript accumulates across the session. To reset it without stopping:

```ts
voice.clearTranscript()
```

## Speech — Speaking

### Enabling

```ts
const speech = luca.feature('speech', { enable: true })
```

### Loading Voices

Browsers provide multiple synthetic voices. Load them before speaking:

```ts
speech.loadVoices()
console.log(speech.voices)
// [{ name: 'Samantha', lang: 'en-US', default: true }, ...]
```

The `voices` array contains `SpeechSynthesisVoice` objects from the browser. The default voice is auto-selected when voices load.

### Speaking

```ts
speech.say('Hello from Luca!')
```

With a specific voice:

```ts
const voice = speech.voices.find(v => v.name.includes('Daniel'))
speech.say('Good morning', { voice })
```

### Setting a Default Voice

```ts
speech.setDefaultVoice('Samantha')

// Now all say() calls use Samantha unless overridden
speech.say('This uses Samantha')
speech.say('This uses Daniel', { voice: danielVoice })
```

### Cancelling

Stop speaking mid-sentence:

```ts
speech.cancel()
```

### State

```ts
speech.defaultVoice  // the currently selected SpeechSynthesisVoice object
speech.voices        // all available voices

speech.state.get('defaultVoice')  // voice name string
speech.state.get('voices')        // array of voice objects
```

## Combining Voice and Speech

The natural pairing: listen for a command, process it, speak a response.

```ts
const voice = luca.feature('voice', { enable: true })
const speech = luca.feature('speech', { enable: true })

async function listenAndRespond() {
  const command = await voice.whenFinished()
  console.log('Heard:', command)

  // Process the command...
  const response = processCommand(command)

  speech.say(response)
}

function processCommand(text) {
  const lower = text.toLowerCase()
  if (lower.includes('hello')) return 'Hello! How can I help?'
  if (lower.includes('time')) return `It's ${new Date().toLocaleTimeString()}`
  return `You said: ${text}`
}
```

## Voice Command Loop

For a continuous voice assistant, create a loop that listens, processes, speaks, and listens again:

```ts
const voice = luca.feature('voice', { enable: true })
const speech = luca.feature('speech', { enable: true })

async function commandLoop() {
  while (true) {
    console.log('Listening...')
    const command = await voice.whenFinished()

    if (!command.trim()) continue

    console.log('Command:', command)
    const response = await handleCommand(command)

    if (response) {
      speech.say(response)
      // Wait a moment for speech to start before listening again
      await new Promise(r => setTimeout(r, 500))
    }
  }
}

commandLoop()
```

## Sending Voice Commands Over WebSocket

The real power is combining voice with a server connection. The browser listens, sends commands to the server, and speaks the response:

```ts
const voice = luca.feature('voice', { enable: true, continuous: true })
const speech = luca.feature('speech', { enable: true })

const ws = luca.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true,
})

// Voice → WebSocket
voice.on('result', ({ finalTranscript }) => {
  if (finalTranscript.trim()) {
    ws.send({ type: 'voiceCommand', text: finalTranscript })
  }
})

// WebSocket → Speech
ws.on('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.type === 'speak') {
    speech.say(msg.text)
  }
})

await ws.connect()
voice.start()
```

On the server:

```ts
import container from '@/node'

const ws = container.server('websocket', { port: 8081 })

ws.on('message', (rawData, socket) => {
  const { data } = JSON.parse(rawData.toString())

  if (data.type === 'voiceCommand') {
    const result = handleCommand(data.text)
    ws.send(socket, { type: 'speak', text: result })
  }
})

function handleCommand(text) {
  const lower = text.toLowerCase()

  if (lower.includes('list files')) {
    const files = container.fs.lsFiles().slice(0, 5)
    return `You have ${files.length} files. The first few are: ${files.join(', ')}`
  }

  if (lower.includes('what branch')) {
    return `You're on the ${container.git.branch} branch`
  }

  return `I heard: ${text}`
}

await ws.start()
```

Now you can speak "list files" in your browser and hear the server read them back to you.

## Browser Permissions

Voice recognition requires microphone access. The browser will show a permission prompt the first time `voice.start()` is called. There's no way to trigger this programmatically — it requires a user gesture (like a button click).

Best practice: start listening in response to a button click, not on page load.

```ts
document.getElementById('start').addEventListener('click', () => {
  voice.start() // Browser shows microphone permission prompt
})
```

If the user denies permission, the `'error'` event fires:

```ts
voice.on('error', (error) => {
  if (error === 'not-allowed') {
    console.log('Microphone permission denied')
  }
})
```

## Graceful Degradation

Not all browsers support the Web Speech API. VoiceRecognition checks for `webkitSpeechRecognition` in the constructor and throws if it's not available. Guard against this:

```ts
let voice

try {
  voice = luca.feature('voice', { enable: true })
} catch (e) {
  console.log('Voice recognition not supported in this browser')
  // Fall back to text input
}
```

Speech synthesis has broader support, but you should still check:

```ts
if ('speechSynthesis' in window) {
  const speech = luca.feature('speech', { enable: true })
  speech.say('Hello!')
} else {
  console.log('Speech synthesis not supported')
}
```

## Next Steps

- [Building for the Browser](./building-for-the-browser.md) — get the WebContainer running
- [Observable State Sync](./observable-state-sync.md) — synchronize state between server and browser
- [WebSocket Communication](./websocket-communication.md) — the transport layer
