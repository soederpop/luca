# TTS (features.tts)

> Stability: `experimental`

TTS feature — synthesizes text to audio files via RunPod's Chatterbox Turbo endpoint. Generates high-quality speech audio by calling the Chatterbox Turbo public endpoint on RunPod, downloads the resulting audio, and saves it locally. Supports 20 preset voices and voice cloning via a reference audio URL. Requires a `RUNPOD_API_KEY` environment variable or an `apiKey` option. Three output formats are supported: `wav` (default, uncompressed), `flac` (lossless compressed), and `ogg` (lossy compressed). Generated files are saved to `outputDir` (defaults to `~/.luca/tts-cache`) with hash-based filenames, and the `synthesized` event fires on the Luca event bus when generation completes.

## Usage

```ts
container.feature('tts', {
  // RunPod API key (falls back to RUNPOD_API_KEY env var)
  apiKey,
  // Default preset voice name
  voice,
  // Directory to save generated audio files
  outputDir,
  // Audio output format
  format,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `apiKey` | `string` | RunPod API key (falls back to RUNPOD_API_KEY env var) |
| `voice` | `string` | Default preset voice name |
| `outputDir` | `string` | Directory to save generated audio files |
| `format` | `string` | Audio output format |

## Methods

### synthesize

Synthesize text to an audio file using Chatterbox Turbo. Calls the RunPod public endpoint, waits for generation, downloads the resulting audio, and saves it to the output directory. On completion the file path is recorded in state (`lastFile`) and the `synthesized` event fires with `(text, filePath, voice, durationMs)`. If `voiceUrl` is given it takes precedence over any preset `voice` — the reference audio should be a clear recording of the voice you want to clone. Defaults: voice `'lucy'`, format `'wav'`. Throws if no RunPod API key is configured.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | The text to synthesize into speech |
| `options` | `{
    voice?: string
    format?: 'wav' | 'flac' | 'ogg'
    voiceUrl?: string
  }` |  | Override voice, format, or provide a voiceUrl for cloning |

**Returns:** `Promise<string>`

```ts
// (no-run) requires RUNPOD_API_KEY and calls the RunPod API
// Use a preset voice
const path = await tts.synthesize('Good morning!', { voice: 'ethan' })
console.log('Audio saved to:', path)

// Clone a voice from a reference audio URL
const clonedPath = await tts.synthesize('Hello world', {
 voiceUrl: 'https://example.com/reference.wav'
})

// Choose an output format per call: wav (uncompressed, default),
// flac (lossless), or ogg (lossy)
const ogg = await tts.synthesize('OGG format', { format: 'ogg' })
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `apiKey` | `string` | RunPod API key from options or environment. |
| `outputDir` | `string` | Directory where generated audio files are saved. |
| `voices` | `readonly string[]` | The 20 preset voice names available in Chatterbox Turbo. Safe to read without an API key — this is a static list, no network call. |

## Events (Zod v4 schema)

### synthesized

Emitted when audio synthesis completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The text that was synthesized |
| `arg1` | `string` | Path to the generated audio file |
| `arg2` | `string` | Voice used |
| `arg3` | `number` | Duration of the API call in milliseconds |



### error

Emitted when synthesis fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `lastFile` | `string` | Path to the last generated audio file |
| `lastText` | `string` | Text of the last synthesis request |
| `generating` | `boolean` | Whether audio is currently being generated |

## Environment Variables

- `RUNPOD_API_KEY`

## Examples

**features.tts**

```ts
// (no-run) requires RUNPOD_API_KEY and calls the RunPod API
const tts = container.feature('tts', {
 voice: 'lucy',            // default preset voice
 format: 'wav',            // 'wav' | 'flac' | 'ogg'
 outputDir: '/tmp/tts-output'
})

// List the 20 preset voice names (safe — no API call)
console.log('Available voices:', tts.voices.join(', '))

// Synthesize with a preset voice
const path = await tts.synthesize('Good morning! Here is your daily briefing.', {
 voice: 'ethan'
})
console.log('Audio saved to:', path)
console.log('Last generated file:', tts.state.get('lastFile'))

// Clone any voice from a reference audio URL instead of a preset
const cloned = await tts.synthesize('Hello world, this is a cloned voice.', {
 voiceUrl: 'https://example.com/reference-voice.wav'
})
```



**synthesize**

```ts
// (no-run) requires RUNPOD_API_KEY and calls the RunPod API
// Use a preset voice
const path = await tts.synthesize('Good morning!', { voice: 'ethan' })
console.log('Audio saved to:', path)

// Clone a voice from a reference audio URL
const clonedPath = await tts.synthesize('Hello world', {
 voiceUrl: 'https://example.com/reference.wav'
})

// Choose an output format per call: wav (uncompressed, default),
// flac (lossless), or ogg (lossy)
const ogg = await tts.synthesize('OGG format', { format: 'ogg' })
```



**voices**

```ts
const tts = container.feature('tts')
console.log('Available voices:', tts.voices.join(', '))
// aaron, abigail, anaya, andy, archer, brian, chloe, dylan, emmanuel, ethan, ...
```

