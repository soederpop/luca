# VoiceRecognition (features.voice)

> Stability: `experimental`

Speech-to-text recognition using the Web Speech API (SpeechRecognition). Wraps the browser's built-in speech recognition, supporting continuous listening, interim results, and language selection. Recognized text is accumulated in state and emitted as events for real-time transcription UIs.

## Usage

```ts
container.feature('voice', {
  // BCP 47 language code for recognition (e.g. en-US)
  language,
  // Whether to continuously listen for speech
  continuous,
  // Whether to automatically start listening on creation
  autoListen,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `language` | `string` | BCP 47 language code for recognition (e.g. en-US) |
| `continuous` | `boolean` | Whether to continuously listen for speech |
| `autoListen` | `boolean` | Whether to automatically start listening on creation |

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

Fires when speech recognition starts listening



### stop

Fires when speech recognition is manually stopped



### abort

Fires when speech recognition is aborted



### result

Fires when speech recognition produces a result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `finalTranscript` | `string` | Accumulated final transcript text |
| `interimTranscript` | `string` | Current interim transcript text |



### error

Fires when speech recognition encounters an error

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Error message from the recognizer |



### end

Fires when speech recognition ends



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `listening` | `boolean` | Whether the recognizer is currently listening |
| `transcript` | `string` | Accumulated final transcript text |

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

