# VoiceRecognition (features.voice)

Speech-to-text recognition using the Web Speech API (SpeechRecognition). Wraps the browser's built-in speech recognition, supporting continuous listening, interim results, and language selection. Recognized text is accumulated in state and emitted as events for real-time transcription UIs.

## Usage

```ts
container.feature('voice')
```

## Methods

### whenFinished

**Returns:** `void`



### start

**Returns:** `void`



### stop

**Returns:** `void`



### abort

**Returns:** `void`



### clearTranscript

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `listening` | `any` | Whether the speech recognizer is currently listening for audio input. |
| `transcript` | `any` | Returns the accumulated final transcript text from recognition results. |

## Events (Zod v4 schema)

### start

Event emitted by VoiceRecognition



### stop

Event emitted by VoiceRecognition



### abort

Event emitted by VoiceRecognition



## Examples

**features.voice**

```ts
const voice = container.feature('voice', { continuous: true, autoListen: true })

voice.on('transcript', ({ text }) => {
 console.log('Heard:', text)
})

// Or start manually
voice.start()
```

