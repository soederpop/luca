# VoiceMode (features.voiceMode)

> Stability: `experimental`

VoiceMode helper

## Usage

```ts
container.feature('voiceMode')
```

## Methods

### useTtsProvider

Inject a TTS provider at runtime, overriding any configured provider. Can be called before or after `assistant.use()` — the provider is resolved lazily on first synthesis. Use this to swap providers mid-session too.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `provider` | `TtsProvider` | ✓ | Parameter provider |

`TtsProvider` properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | `string` | Human-readable name for logging and state display. |
| `format` | `'wav' | 'mp3'` | Audio format returned by `synthesize`. Defaults to 'mp3'. Determines the temp-file extension passed to the player. |

**Returns:** `this`

```ts
voiceMode.useTtsProvider({
 name: 'kokoro-rest',
 synthesize: async (text) => {
   const speech = container.client('speech', { baseURL: 'http://gpu-host:8002' })
   return speech.synthesize(text, { voice: 'af_heart' })
 },
})
```



### _getTtsProvider

Resolve the active TTS provider. Priority: 1) manually injected via `useTtsProvider()`, 2) passed as `options.tts` at construction, 3) built-in resolution from `options.provider` string. The resolved provider is cached for the lifetime of the feature (or until `useTtsProvider()` is called again). `connect()` is called lazily before the first synthesis; if it throws, the connection is retried on the next call.

**Returns:** `Promise<TtsProvider>`



### toggleVoiceMode

Toggle voice mode on or off. When enabled: speech-first prompt guidance, TTS pipeline active, low maxTokens. When disabled: normal markdown assistant, no TTS, normal maxTokens.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `enabled` | `boolean` | ✓ | Parameter enabled |

**Returns:** `void`



### enableVoiceMode

**Returns:** `void`



### disableVoiceMode

**Returns:** `void`



### mute

**Returns:** `void`



### unmute

**Returns:** `void`



### createSpeechTurn

Create a headless, cancellable speech turn with a provider-neutral transport and pluggable audio sink. This is the realtime/server path. It never creates files or invokes a local player; the caller owns the transport and destination.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `SpeechTurnOptions` | ✓ | Speech transport, audio sink, segmentation, and abort options. |

**Returns:** `SpeechTurn`

```ts
const turn = voiceMode.createSpeechTurn({ transport, sink })
turn.consume('Hello from a streamed response. ')
await turn.finish()
```



### speak

Speak arbitrary text through the TTS pipeline (outside of a conversation turn).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |

**Returns:** `Promise<void>`



### waitForSpeechDone

Wait until the current turn's audio has fully played. Safe to call even if nothing is playing (resolves immediately).

**Returns:** `Promise<void>`



### loadPhraseManifest

Loads the phrase manifest JSON from the assistant's generated folder and indexes by tag.

**Returns:** `void`



### randomPhrase

Returns a random phrase file path for the given tag, avoiding repeats.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tag` | `string` | ✓ | Parameter tag |

**Returns:** `string | null`



### playPhrase

Plays a random audio phrase for the given tag using afplay.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tag` | `string` | ✓ | Parameter tag |

**Returns:** `void`



### playToolcallPhrase

**Returns:** `void`



### playToolResultPhrase

**Returns:** `void`



### playToolErrorPhrase

**Returns:** `void`



### checkCapabilities

Check whether TTS is available for the current provider config. If a custom provider was injected via `tts` option or `useTtsProvider()`, we attempt its `connect()` method. If it has none, we assume it's available.

**Returns:** `Promise<{ available: boolean; missing: string[] }>`



### setupToolsConsumer

Called automatically when `assistant.use(voiceMode)` is invoked. This is where we wire into the assistant's lifecycle.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `assistant` | `Assistant` | ✓ | Parameter assistant |

**Returns:** `void`



### detach

Detach from the assistant, removing event listeners and ext methods.

**Returns:** `void`



### summarizeForSpeech

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |

**Returns:** `Promise<string>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `assistant` | `Assistant | null` | The assistant this voiceMode is attached to. |
| `isMuted` | `boolean` |  |
| `isSpeaking` | `boolean` |  |

## Events (Zod v4 schema)

### providerChanged

Event emitted by VoiceMode



### muted

Event emitted by VoiceMode



### unmuted

Event emitted by VoiceMode



### attached

Event emitted by VoiceMode



### detached

Event emitted by VoiceMode



### turnComplete

Event emitted by VoiceMode



### summarizing

Event emitted by VoiceMode



### toolCall

Event emitted by VoiceMode



### toolResult

Event emitted by VoiceMode



### toolError

Event emitted by VoiceMode



### generating

Event emitted by VoiceMode



### speaking

Event emitted by VoiceMode



### error

Event emitted by VoiceMode



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` |  |
| `muted` | `boolean` |  |
| `speaking` | `boolean` |  |
| `generating` | `boolean` |  |
| `turnCount` | `number` |  |
| `attached` | `boolean` |  |
| `provider` | `string` |  |
| `playPhrases` | `boolean` |  |
| `ttsAvailable` | `boolean` |  |
| `lastToolPhraseAt` | `number` |  |
| `phraseManifestLoaded` | `boolean` |  |

## Examples

**useTtsProvider**

```ts
voiceMode.useTtsProvider({
 name: 'kokoro-rest',
 synthesize: async (text) => {
   const speech = container.client('speech', { baseURL: 'http://gpu-host:8002' })
   return speech.synthesize(text, { voice: 'af_heart' })
 },
})
```



**createSpeechTurn**

```ts
const turn = voiceMode.createSpeechTurn({ transport, sink })
turn.consume('Hello from a streamed response. ')
await turn.finish()
```

