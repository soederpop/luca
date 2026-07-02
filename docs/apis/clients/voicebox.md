# VoiceBoxClient (clients.voicebox)

> Stability: `experimental`

VoiceBox client — local TTS synthesis via VoiceBox.sh REST API (Qwen3-TTS). Provides methods for managing voice profiles and generating speech audio locally. Uses the streaming endpoint for synchronous synthesis (returns WAV buffer).

## Usage

```ts
container.client('voicebox', {
  // VoiceBox server URL (falls back to VOICEBOX_URL env var, default http://127.0.0.1:17493)
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
  // Default voice profile ID for synthesis
  defaultProfileId,
  // Default TTS engine (qwen, luxtts, chatterbox, chatterbox_turbo)
  defaultEngine,
  // Default model size (1.7B or 0.6B)
  defaultModelSize,
  // Default language code
  defaultLanguage,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | VoiceBox server URL (falls back to VOICEBOX_URL env var, default http://127.0.0.1:17493) |
| `json` | `boolean` | Whether to automatically parse responses as JSON |
| `defaultProfileId` | `string` | Default voice profile ID for synthesis |
| `defaultEngine` | `string` | Default TTS engine (qwen, luxtts, chatterbox, chatterbox_turbo) |
| `defaultModelSize` | `string` | Default model size (1.7B or 0.6B) |
| `defaultLanguage` | `string` | Default language code |

## Methods

### connect

Validate the VoiceBox server is reachable by hitting the health endpoint.

**Returns:** `Promise<this>`



### listProfiles

List all voice profiles.

**Returns:** `Promise<any[]>`

```ts
const profiles = await vb.listProfiles()
console.log(profiles.map(p => `${p.name} (${p.sample_count} samples)`))
```



### getProfile

Get a single voice profile by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `profileId` | `string` | ✓ | Parameter profileId |

**Returns:** `Promise<any>`



### createProfile

Create a new voice profile.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `options` | `{ description?: string; language?: string }` |  | Parameter options |

**Returns:** `Promise<any>`



### listEffects

List available audio effects and their parameter definitions.

**Returns:** `Promise<any>`



### synthesize

Synthesize speech from text using the streaming endpoint. Returns audio as a WAV Buffer (synchronous — blocks until audio is ready).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to convert to speech |
| `options` | `SynthesizeOptions` |  | Profile, engine, model, and other synthesis options |

`SynthesizeOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `profileId` | `string` |  |
| `engine` | `string` |  |
| `modelSize` | `string` |  |
| `language` | `string` |  |
| `instruct` | `string` |  |
| `seed` | `number` |  |
| `maxChunkChars` | `number` |  |
| `crossfadeMs` | `number` |  |
| `normalize` | `boolean` |  |
| `effectsChain` | `EffectConfig[]` |  |
| `disableCache` | `boolean` |  |

**Returns:** `Promise<Buffer>`

```ts
const audio = await vb.synthesize('Hello world', { profileId: 'abc-123' })
// audio is a Buffer of WAV data
```



### generate

Generate speech asynchronously (returns metadata, not audio). Use getAudio() to fetch the audio after generation completes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |
| `options` | `SynthesizeOptions` |  | Parameter options |

`SynthesizeOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `profileId` | `string` |  |
| `engine` | `string` |  |
| `modelSize` | `string` |  |
| `language` | `string` |  |
| `instruct` | `string` |  |
| `seed` | `number` |  |
| `maxChunkChars` | `number` |  |
| `crossfadeMs` | `number` |  |
| `normalize` | `boolean` |  |
| `effectsChain` | `EffectConfig[]` |  |
| `disableCache` | `boolean` |  |

**Returns:** `Promise<any>`



### getAudio

Fetch generated audio by generation ID. Returns WAV Buffer.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `generationId` | `string` | ✓ | Parameter generationId |

**Returns:** `Promise<Buffer>`



### say

Synthesize and write audio to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Parameter text |
| `outputPath` | `string` | ✓ | Parameter outputPath |
| `options` | `SynthesizeOptions` |  | Parameter options |

`SynthesizeOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `profileId` | `string` |  |
| `engine` | `string` |  |
| `modelSize` | `string` |  |
| `language` | `string` |  |
| `instruct` | `string` |  |
| `seed` | `number` |  |
| `maxChunkChars` | `number` |  |
| `crossfadeMs` | `number` |  |
| `normalize` | `boolean` |  |
| `effectsChain` | `EffectConfig[]` |  |
| `disableCache` | `boolean` |  |

**Returns:** `Promise<string>`



## Events (Zod v4 schema)

### failure

Emitted when a request fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error object |



### profiles

Emitted after listing profiles

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `array` |  |



### speech

Emitted after speech synthesis completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `profileId` | `string` |  |
| `text` | `string` |  |
| `audioSize` | `number` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether the client is currently connected |
| `requestCount` | `number` | Total number of API requests made |
| `characterCount` | `number` | Total characters sent for synthesis |
| `lastRequestTime` | `any` | Timestamp of the last API request |

## Environment Variables

- `VOICEBOX_URL`

## Examples

**clients.voicebox**

```ts
const vb = container.client('voicebox')
await vb.connect()
const profiles = await vb.listProfiles()
const audio = await vb.synthesize('Hello world', { profileId: profiles[0].id })
// audio is a Buffer of WAV data
```



**listProfiles**

```ts
const profiles = await vb.listProfiles()
console.log(profiles.map(p => `${p.name} (${p.sample_count} samples)`))
```



**synthesize**

```ts
const audio = await vb.synthesize('Hello world', { profileId: 'abc-123' })
// audio is a Buffer of WAV data
```

