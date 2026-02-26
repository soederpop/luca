import { z } from 'zod'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '@soederpop/luca/schemas/base.js'
import { clients, RestClient } from "@soederpop/luca/client";
import type { Container, ContainerContext } from "@soederpop/luca/container";
import type { ClientsInterface, ClientOptions } from "@soederpop/luca/client";
import type { AxiosRequestConfig } from 'axios'

declare module "@soederpop/luca/client" {
  interface AvailableClients {
    elevenlabs: typeof ElevenLabsClient;
  }
}

export const ElevenLabsClientOptionsSchema = ClientOptionsSchema.extend({
  apiKey: z.string().optional().describe('ElevenLabs API key (falls back to ELEVENLABS_API_KEY env var)'),
  defaultVoiceId: z.string().optional().describe('Default voice ID for speech synthesis'),
  defaultModelId: z.string().optional().default('eleven_multilingual_v2').describe('Default TTS model ID'),
  outputFormat: z.string().optional().default('mp3_44100_128').describe('Audio output format (e.g. mp3_44100_128, pcm_16000)'),
})
export type ElevenLabsClientOptions = z.infer<typeof ElevenLabsClientOptionsSchema>

export const ElevenLabsClientStateSchema = ClientStateSchema.extend({
  requestCount: z.number().default(0).describe('Total number of API requests made'),
  characterCount: z.number().default(0).describe('Total characters sent for synthesis (tracks billing usage)'),
  lastRequestTime: z.number().nullable().default(null).describe('Timestamp of the last API request'),
})
export type ElevenLabsClientState = z.infer<typeof ElevenLabsClientStateSchema>

export const ElevenLabsClientEventsSchema = ClientEventsSchema.extend({
  speech: z.tuple([z.object({
    voiceId: z.string(),
    text: z.string(),
    audioSize: z.number(),
  })]).describe('Emitted after speech synthesis completes'),
  voices: z.tuple([z.array(z.any())]).describe('Emitted after listing voices'),
})

export type ElevenLabsVoiceSettings = {
  stability?: number
  similarityBoost?: number
  style?: number
  speed?: number
  useSpeakerBoost?: boolean
}

export type SynthesizeOptions = {
  voiceId?: string
  modelId?: string
  outputFormat?: string
  voiceSettings?: ElevenLabsVoiceSettings
}

/**
 * ElevenLabs client — text-to-speech synthesis via the ElevenLabs REST API.
 *
 * Provides methods for listing voices, listing models, and generating speech audio.
 * Audio is returned as a Buffer; use `say()` for a convenience method that writes to disk.
 *
 * @example
 * ```typescript
 * const el = container.client('elevenlabs')
 * await el.connect()
 * const voices = await el.listVoices()
 * const audio = await el.synthesize('Hello world')
 * // audio is a Buffer of mp3 data
 * ```
 */
export class ElevenLabsClient extends RestClient<ElevenLabsClientState, ElevenLabsClientOptions> {
  static override shortcut = "clients.elevenlabs" as const
  static override envVars = ['ELEVENLABS_API_KEY']
  static override stateSchema = ElevenLabsClientStateSchema
  static override optionsSchema = ElevenLabsClientOptionsSchema
  static override eventsSchema = ElevenLabsClientEventsSchema

  // @ts-ignore
  static override attach(container: Container & ClientsInterface, options?: any) {
    container.clients.register("elevenlabs", ElevenLabsClient);
    return container
  }

  override get initialState(): ElevenLabsClientState {
    return {
      ...super.initialState,
      requestCount: 0,
      characterCount: 0,
      lastRequestTime: null,
    }
  }

  constructor(options: ElevenLabsClientOptions, context: ContainerContext) {
    options = {
      ...options,
      baseURL: 'https://api.elevenlabs.io',
    }
    super(options, context)
  }

  /** The resolved API key from options or environment. */
  get apiKey(): string {
    return this.options.apiKey || process.env.ELEVENLABS_API_KEY || ''
  }

  /**
   * Inject the xi-api-key header before each request.
   */
  override async beforeRequest() {
    this.axios.defaults.headers.common['xi-api-key'] = this.apiKey
  }

  private trackRequest(characters = 0) {
    const requestCount = this.state.get('requestCount') || 0
    const characterCount = this.state.get('characterCount') || 0
    this.setState({
      requestCount: requestCount + 1,
      characterCount: characterCount + characters,
      lastRequestTime: Date.now(),
    })
  }

  /**
   * Validate the API key by listing available models.
   *
   * @returns This client instance
   * @throws If the API key is invalid or the connection fails
   *
   * @example
   * ```typescript
   * await el.connect()
   * ```
   */
  override async connect(): Promise<this> {
    try {
      await this.get('/v1/models')
      await super.connect()
      this.emit('connected' as any)
      return this
    } catch (error) {
      this.emit('failure', error)
      throw error
    }
  }

  /**
   * List available voices with optional search and filtering.
   *
   * @param options - Query parameters for filtering voices
   * @returns Array of voice objects
   *
   * @example
   * ```typescript
   * const voices = await el.listVoices()
   * const premade = await el.listVoices({ category: 'premade' })
   * ```
   */
  async listVoices(options: {
    search?: string
    category?: string
    voice_type?: string
    page_size?: number
    next_page_token?: string
  } = {}): Promise<any> {
    this.trackRequest()
    const result = await this.get('/v2/voices', options)
    if (result?.voices) {
      this.emit('voices', result.voices)
    }
    return result
  }

  /**
   * Get details for a single voice.
   *
   * @param voiceId - The voice ID to look up
   * @returns Voice object with settings, labels, and metadata
   *
   * @example
   * ```typescript
   * const voice = await el.getVoice('21m00Tcm4TlvDq8ikWAM')
   * console.log(voice.name, voice.settings)
   * ```
   */
  async getVoice(voiceId: string): Promise<any> {
    this.trackRequest()
    return this.get(`/v1/voices/${voiceId}`)
  }

  /**
   * List available TTS models.
   *
   * @returns Array of model objects with IDs and capabilities
   *
   * @example
   * ```typescript
   * const models = await el.listModels()
   * console.log(models.map(m => m.model_id))
   * ```
   */
  async listModels(): Promise<any[]> {
    this.trackRequest()
    return this.get('/v1/models')
  }

  /**
   * Synthesize speech from text, returning audio as a Buffer.
   *
   * @param text - The text to convert to speech
   * @param options - Voice, model, format, and voice settings overrides
   * @returns Audio data as a Buffer
   *
   * @example
   * ```typescript
   * const audio = await el.synthesize('Hello world')
   * // audio is a Buffer of mp3 data
   *
   * const custom = await el.synthesize('Hello', {
   *   voiceId: '21m00Tcm4TlvDq8ikWAM',
   *   voiceSettings: { stability: 0.5, similarityBoost: 0.8 }
   * })
   * ```
   */
  async synthesize(text: string, options: SynthesizeOptions = {}): Promise<Buffer> {
    const voiceId = options.voiceId || this.options.defaultVoiceId || 'JBFqnCBsd6RMkjVDRZzb'
    const modelId = options.modelId || this.options.defaultModelId || 'eleven_multilingual_v2'
    const outputFormat = options.outputFormat || this.options.outputFormat || 'mp3_44100_128'

    const body: Record<string, any> = {
      text,
      model_id: modelId,
    }

    if (options.voiceSettings) {
      body.voice_settings = {
        stability: options.voiceSettings.stability,
        similarity_boost: options.voiceSettings.similarityBoost,
        style: options.voiceSettings.style,
        speed: options.voiceSettings.speed,
        use_speaker_boost: options.voiceSettings.useSpeakerBoost,
      }
    }

    this.trackRequest(text.length)

    await this.beforeRequest()

    const response = await this.axios({
      method: 'POST',
      url: `/v1/text-to-speech/${voiceId}`,
      params: { output_format: outputFormat },
      data: body,
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
    })

    const audioBuffer = Buffer.from(response.data)

    this.emit('speech', {
      voiceId,
      text,
      audioSize: audioBuffer.length,
    })

    return audioBuffer
  }

  /**
   * Synthesize speech and write the audio to a file.
   *
   * @param text - The text to convert to speech
   * @param outputPath - File path to write the audio to
   * @param options - Voice, model, format, and voice settings overrides
   * @returns The resolved output path
   *
   * @example
   * ```typescript
   * const path = await el.say('Hello world', './hello.mp3')
   * console.log(`Audio saved to ${path}`)
   * ```
   */
  async say(text: string, outputPath: string, options: SynthesizeOptions = {}): Promise<string> {
    const audio = await this.synthesize(text, options)
    const resolvedPath = this.container.paths.resolve(outputPath)
    await this.container.fs.writeFileAsync(resolvedPath, audio)
    return resolvedPath
  }
}

export default clients.register("elevenlabs", ElevenLabsClient)

