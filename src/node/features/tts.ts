import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { createHash } from 'crypto'

const CHATTERBOX_ENDPOINT = 'https://api.runpod.ai/v2/chatterbox-turbo/runsync'

const PRESET_VOICES = [
  'aaron', 'abigail', 'anaya', 'andy', 'archer',
  'brian', 'chloe', 'dylan', 'emmanuel', 'ethan',
  'evelyn', 'gavin', 'gordon', 'ivan', 'laura',
  'lucy', 'madison', 'marisol', 'meera', 'walter',
] as const

type PresetVoice = typeof PRESET_VOICES[number]

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
 * Requires a `RUNPOD_API_KEY` environment variable or an `apiKey` option. Three
 * output formats are supported: `wav` (default, uncompressed), `flac` (lossless
 * compressed), and `ogg` (lossy compressed). Generated files are saved to
 * `outputDir` (defaults to `~/.luca/tts-cache`) with hash-based filenames, and the
 * `synthesized` event fires on the Luca event bus when generation completes.
 *
 * @example
 * ```typescript
 * // (no-run) requires RUNPOD_API_KEY and calls the RunPod API
 * const tts = container.feature('tts', {
 *   voice: 'lucy',            // default preset voice
 *   format: 'wav',            // 'wav' | 'flac' | 'ogg'
 *   outputDir: '/tmp/tts-output'
 * })
 *
 * // List the 20 preset voice names (safe — no API call)
 * console.log('Available voices:', tts.voices.join(', '))
 *
 * // Synthesize with a preset voice
 * const path = await tts.synthesize('Good morning! Here is your daily briefing.', {
 *   voice: 'ethan'
 * })
 * console.log('Audio saved to:', path)
 * console.log('Last generated file:', tts.state.get('lastFile'))
 *
 * // Clone any voice from a reference audio URL instead of a preset
 * const cloned = await tts.synthesize('Hello world, this is a cloned voice.', {
 *   voiceUrl: 'https://example.com/reference-voice.wav'
 * })
 * ```
 */
export class TTS extends Feature<TTSState, TTSOptions> {
  static override shortcut = 'features.tts' as const
  static override stability = 'experimental' as const
  static override category = 'media-browser' as const
  static override envVars = ['RUNPOD_API_KEY']
  static override stateSchema = TTSStateSchema
  static override optionsSchema = TTSOptionsSchema
  static override eventsSchema = TTSEventsSchema
  static { Feature.register(this, 'tts') }

  /** RunPod API key from options or environment. */
  get apiKey(): string {
    return this.options.apiKey || process.env.RUNPOD_API_KEY || ''
  }

  /** Directory where generated audio files are saved. */
  get outputDir(): string {
    return this.options.outputDir || this.container.paths.resolve(this.container.feature('os').homedir, '.luca', 'tts-cache')
  }

  /**
   * The 20 preset voice names available in Chatterbox Turbo.
   *
   * Safe to read without an API key — this is a static list, no network call.
   *
   * @example
   * ```typescript
   * const tts = container.feature('tts')
   * console.log('Available voices:', tts.voices.join(', '))
   * // aaron, abigail, anaya, andy, archer, brian, chloe, dylan, emmanuel, ethan, ...
   * ```
   */
  get voices(): readonly string[] {
    return PRESET_VOICES
  }

  /**
   * Synthesize text to an audio file using Chatterbox Turbo.
   *
   * Calls the RunPod public endpoint, waits for generation, downloads the
   * resulting audio, and saves it to the output directory. On completion the
   * file path is recorded in state (`lastFile`) and the `synthesized` event
   * fires with `(text, filePath, voice, durationMs)`. If `voiceUrl` is given
   * it takes precedence over any preset `voice` — the reference audio should
   * be a clear recording of the voice you want to clone. Defaults: voice
   * `'lucy'`, format `'wav'`. Throws if no RunPod API key is configured.
   *
   * @param text - The text to synthesize into speech
   * @param options - Override voice, format, or provide a voiceUrl for cloning
   * @returns Absolute path to the generated audio file
   *
   * @example
   * ```typescript
   * // (no-run) requires RUNPOD_API_KEY and calls the RunPod API
   * // Use a preset voice
   * const path = await tts.synthesize('Good morning!', { voice: 'ethan' })
   * console.log('Audio saved to:', path)
   *
   * // Clone a voice from a reference audio URL
   * const clonedPath = await tts.synthesize('Hello world', {
   *   voiceUrl: 'https://example.com/reference.wav'
   * })
   *
   * // Choose an output format per call: wav (uncompressed, default),
   * // flac (lossless), or ogg (lossy)
   * const ogg = await tts.synthesize('OGG format', { format: 'ogg' })
   * ```
   */
  async synthesize(text: string, options?: {
    voice?: string
    format?: 'wav' | 'flac' | 'ogg'
    voiceUrl?: string
  }): Promise<string> {
    if (!this.apiKey) {
      throw new Error('TTS requires a RunPod API key. Set RUNPOD_API_KEY or pass apiKey in options.')
    }

    const voice = options?.voice || this.options.voice || 'lucy'
    const format = options?.format || this.options.format || 'wav'

    this.setState({ generating: true, lastText: text })

    const startTime = Date.now()

    try {
      const input: Record<string, any> = {
        prompt: text,
        format,
      }

      if (options?.voiceUrl) {
        input.voice_url = options.voiceUrl
      } else {
        input.voice = voice
      }

      const response = await fetch(CHATTERBOX_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(`Chatterbox API error ${response.status}: ${body}`)
      }

      const data = await response.json() as { output?: { audio_url?: string }, error?: string }

      if (data.error) {
        throw new Error(`Chatterbox API error: ${data.error}`)
      }

      const audioUrl = data.output?.audio_url
      if (!audioUrl) {
        throw new Error('No audio_url in Chatterbox response')
      }

      // Download the audio file
      const audioResponse = await fetch(audioUrl)
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`)
      }

      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

      // Save to output dir with hash-based name
      this.container.fs.ensureFolder(this.outputDir)
      const hash = createHash('md5').update(text).digest('hex').slice(0, 8)
      const filename = `${hash}-${Date.now()}.${format}`
      const filePath = this.container.paths.join(this.outputDir, filename)

      await this.container.fs.writeFileAsync(filePath, audioBuffer)

      const durationMs = Date.now() - startTime

      this.setState({ generating: false, lastFile: filePath })
      this.emit('synthesized', text, filePath, voice, durationMs)

      return filePath
    } catch (error: any) {
      this.setState({ generating: false })
      this.emit('error', error)
      throw error
    }
  }
}

export default TTS