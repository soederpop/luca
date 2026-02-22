# Documentation Audit

Periodically do an audit of all Feature, Server, Client subclasses to make sure they are completely documented.


## Files

- `src/node/features/*.ts` NodeContainer features
- `src/clients/*/index.ts` Client subclasses
- `src/agi/features.ts` AGIContainer features

## Generating Introspection Data for Runtime consumption

After any changes to the above files, make sure to run:

```shell
bun run build:introspection 
```

## Documentation Guidelines

Here is a good example of a well documented feature, notice that:

- All of the Options, State, Event schema items have `describe()` calls
- There is a docblock above the class which uses a simple example with no imports, using the factory pattern
- getters are documented
- methods have jsdoc also with an example
- method options have jsdoc comments for typescript consumers

```ts

export const TTSOptionsSchema = FeatureOptionsSchema.extend({
  apiKey: z.string().optional().describe('RunPod API key (falls back to RUNPOD_API_KEY env var)'),
  voice: z.string().optional().describe('Default preset voice name'),
  outputDir: z.string().optional().describe('Directory to save generated audio files'),
  format: z.enum(['wav', 'flac', 'ogg']).default('wav').describe('Audio output format'),
})
export type TTSOptions = z.infer<typeof TTSOptionsSchema>

export const TTSStateSchema = FeatureStateSchema.extend({
  lastFile: z.string().optional().describe('Path to the last generated audio file'),
  lastText: z.string().optional().describe('Text of the last synthesis request'),
  generating: z.boolean().default(false).describe('Whether audio is currently being generated'),
})
export type TTSState = z.infer<typeof TTSStateSchema>

export const TTSEventsSchema = FeatureEventsSchema.extend({
  synthesized: z.tuple([
    z.string().describe('The text that was synthesized'),
    z.string().describe('Path to the generated audio file'),
    z.string().describe('Voice used'),
    z.number().describe('Duration of the API call in milliseconds'),
  ]).describe('Emitted when audio synthesis completes'),
  error: z.tuple([
    z.any().describe('The error'),
  ]).describe('Emitted when synthesis fails'),
})

/**
 * TTS feature — synthesizes text to audio files via RunPod's Chatterbox Turbo endpoint.
 *
 * Generates high-quality speech audio by calling the Chatterbox Turbo public endpoint
 * on RunPod, downloads the resulting audio, and saves it locally. Supports 20 preset
 * voices and voice cloning via a reference audio URL.
 *
 * @example
 * ```typescript
 * const tts = container.feature('tts', { enable: true })
 * const path = await tts.synthesize('Hello, how are you?', { voice: 'lucy' })
 * console.log(`Audio saved to: ${path}`)
 * ```
 */
export class TTS extends Feature<TTSState, TTSOptions> {
  static override shortcut = 'features.tts' as const
  static override envVars = ['RUNPOD_API_KEY']
  static override stateSchema = TTSStateSchema
  static override optionsSchema = TTSOptionsSchema
  static override eventsSchema = TTSEventsSchema

  /** RunPod API key from options or environment. */
  get apiKey(): string {
    return this.options.apiKey || process.env.RUNPOD_API_KEY || ''
  }

  /** Directory where generated audio files are saved. */
  get outputDir(): string {
    return this.options.outputDir || join(homedir(), '.luca', 'tts-cache')
  }

  /** The 20 preset voice names available in Chatterbox Turbo. */
  get voices(): readonly string[] {
    return PRESET_VOICES
  }

  /**
   * Synthesize text to an audio file using Chatterbox Turbo.
   *
   * Calls the RunPod public endpoint, downloads the generated audio,
   * and saves it to the output directory.
   *
   * @param text - The text to synthesize into speech
   * @param options - Override voice, format, or provide a voiceUrl for cloning
   * @returns Absolute path to the generated audio file
   *
   * @example
   * ```typescript
   * // Use a preset voice
   * const path = await tts.synthesize('Good morning!', { voice: 'ethan' })
   *
   * // Clone a voice from a reference audio URL
   * const path = await tts.synthesize('Hello world', {
   *   voiceUrl: 'https://example.com/reference.wav'
   * })
   * ```
   */
  async synthesize(text: string, options?: {
		/* which voice to use */
    voice?: string
		/* which format to save the output in */
    format?: 'wav' | 'flac' | 'ogg'
		/* an optional url to use for voice cloning */
    voiceUrl?: string
  }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('TTS requires a RunPod API key. Set RUNPOD_API_KEY or pass apiKey in options.')
    }
		// omitted
	}

}

```


