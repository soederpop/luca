import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { homedir } from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'
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
      mkdirSync(this.outputDir, { recursive: true })
      const hash = createHash('md5').update(text).digest('hex').slice(0, 8)
      const filename = `${hash}-${Date.now()}.${format}`
      const filePath = join(this.outputDir, filename)

      writeFileSync(filePath, audioBuffer)

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

export default features.register('tts', TTS)
