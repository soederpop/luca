# VoiceMode (features.voiceMode)

> Stability: `experimental`

VoiceMode helper

## Usage

```ts
container.feature('voiceMode', {
  
  provider,
  
  voiceId,
  
  modelId,
  
  voiceSettings,
  
  conversationModePrefix,
  
  voicebox,
  
  maxChunkLength,
  
  minChunkLength,
  
  summarize,
  
  debug,
  
  playPhrases,
  
  toolPhraseWindowSeconds,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `string` |  |
| `voiceId` | `string` |  |
| `modelId` | `string` |  |
| `voiceSettings` | `any` |  |
| `conversationModePrefix` | `string` |  |
| `voicebox` | `object` |  |
| `maxChunkLength` | `number` |  |
| `minChunkLength` | `number` |  |
| `summarize` | `boolean` |  |
| `debug` | `boolean` |  |
| `playPhrases` | `boolean` |  |
| `toolPhraseWindowSeconds` | `number` |  |

## Methods

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

Check whether TTS is available for the current provider config.

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