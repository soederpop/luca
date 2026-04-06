import { z } from 'zod'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '@soederpop/luca/schemas/base.js'
import { Client } from "@soederpop/luca/client";
import { RestClient } from "../rest";
import type { ContainerContext } from "@soederpop/luca/container";
import type { NodeContainer } from "../../node/container.js";

declare module "@soederpop/luca/client" {
  interface AvailableClients {
    voicebox: typeof VoiceBoxClient;
  }
}

export const VoiceBoxClientOptionsSchema = ClientOptionsSchema.extend({
  baseURL: z.string().optional().describe('VoiceBox server URL (falls back to VOICEBOX_URL env var, default http://127.0.0.1:17493)'),
  defaultProfileId: z.string().optional().describe('Default voice profile ID for synthesis'),
  defaultEngine: z.string().optional().default('qwen').describe('Default TTS engine (qwen, luxtts, chatterbox, chatterbox_turbo)'),
  defaultModelSize: z.string().optional().default('1.7B').describe('Default model size (1.7B or 0.6B)'),
  defaultLanguage: z.string().optional().default('en').describe('Default language code'),
})
export type VoiceBoxClientOptions = z.infer<typeof VoiceBoxClientOptionsSchema>

export const VoiceBoxClientStateSchema = ClientStateSchema.extend({
  requestCount: z.number().default(0).describe('Total number of API requests made'),
  characterCount: z.number().default(0).describe('Total characters sent for synthesis'),
  lastRequestTime: z.number().nullable().default(null).describe('Timestamp of the last API request'),
})
export type VoiceBoxClientState = z.infer<typeof VoiceBoxClientStateSchema>

export const VoiceBoxClientEventsSchema = ClientEventsSchema.extend({
  speech: z.tuple([z.object({
    profileId: z.string(),
    text: z.string(),
    audioSize: z.number(),
  })]).describe('Emitted after speech synthesis completes'),
  profiles: z.tuple([z.array(z.any())]).describe('Emitted after listing profiles'),
})

export type EffectConfig = {
  type: string
  enabled?: boolean
  params?: Record<string, any>
}

export type SynthesizeOptions = {
  profileId?: string
  engine?: string
  modelSize?: string
  language?: string
  instruct?: string
  seed?: number
  maxChunkChars?: number
  crossfadeMs?: number
  normalize?: boolean
  effectsChain?: EffectConfig[]
  disableCache?: boolean
}

/**
 * VoiceBox client — local TTS synthesis via VoiceBox.sh REST API (Qwen3-TTS).
 *
 * Provides methods for managing voice profiles and generating speech audio locally.
 * Uses the streaming endpoint for synchronous synthesis (returns WAV buffer).
 *
 * @example
 * ```typescript
 * const vb = container.client('voicebox')
 * await vb.connect()
 * const profiles = await vb.listProfiles()
 * const audio = await vb.synthesize('Hello world', { profileId: profiles[0].id })
 * // audio is a Buffer of WAV data
 * ```
 */
export class VoiceBoxClient extends RestClient<VoiceBoxClientState, VoiceBoxClientOptions> {
  static override shortcut = "clients.voicebox" as const
  static override envVars = ['VOICEBOX_URL']
  static override stateSchema = VoiceBoxClientStateSchema
  static override optionsSchema = VoiceBoxClientOptionsSchema
  static override eventsSchema = VoiceBoxClientEventsSchema

  static { Client.register(this, 'voicebox') }

  override get initialState(): VoiceBoxClientState {
    return {
      ...super.initialState,
      requestCount: 0,
      characterCount: 0,
      lastRequestTime: null,
    }
  }

  constructor(options: VoiceBoxClientOptions, context: ContainerContext) {
    options = {
      ...options,
      baseURL: options.baseURL || process.env.VOICEBOX_URL || 'http://127.0.0.1:17493',
    }
    super(options, context)
  }

  override get container(): NodeContainer {
    return super.container as unknown as NodeContainer
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
   * Validate the VoiceBox server is reachable by hitting the health endpoint.
   */
  override async connect(): Promise<this> {
    try {
      const health = await this.get('/health')
      if (health?.status !== 'ok' && health?.status !== 'healthy') {
        // Accept any 200 response as healthy
      }
      await super.connect()
      this.emit('connected' as any)
      return this
    } catch (error) {
      this.emit('failure', error)
      throw error
    }
  }

  /**
   * List all voice profiles.
   *
   * @returns Array of voice profile objects
   *
   * @example
   * ```typescript
   * const profiles = await vb.listProfiles()
   * console.log(profiles.map(p => `${p.name} (${p.sample_count} samples)`))
   * ```
   */
  async listProfiles(): Promise<any[]> {
    this.trackRequest()
    const result = await this.get('/profiles')
    const profiles = Array.isArray(result) ? result : []
    this.emit('profiles', profiles)
    return profiles
  }

  /**
   * Get a single voice profile by ID.
   */
  async getProfile(profileId: string): Promise<any> {
    this.trackRequest()
    return this.get(`/profiles/${profileId}`)
  }

  /**
   * Create a new voice profile.
   */
  async createProfile(name: string, options: { description?: string; language?: string } = {}): Promise<any> {
    this.trackRequest()
    return this.post('/profiles', { name, ...options })
  }

  /**
   * List available audio effects and their parameter definitions.
   */
  async listEffects(): Promise<any> {
    this.trackRequest()
    return this.get('/effects/available')
  }

  /**
   * Synthesize speech from text using the streaming endpoint.
   * Returns audio as a WAV Buffer (synchronous — blocks until audio is ready).
   *
   * @param text - The text to convert to speech
   * @param options - Profile, engine, model, and other synthesis options
   * @returns Audio data as a WAV Buffer
   *
   * @example
   * ```typescript
   * const audio = await vb.synthesize('Hello world', { profileId: 'abc-123' })
   * // audio is a Buffer of WAV data
   * ```
   */
  async synthesize(text: string, options: SynthesizeOptions = {}): Promise<Buffer> {
    const profileId = options.profileId || this.options.defaultProfileId
    if (!profileId) throw new Error('profileId is required for VoiceBox synthesis')

    const engine = options.engine || this.options.defaultEngine || 'qwen'
    const modelSize = options.modelSize || this.options.defaultModelSize || '1.7B'
    const language = options.language || this.options.defaultLanguage || 'en'

    const body: Record<string, any> = {
      profile_id: profileId,
      text,
      language,
      engine,
      model_size: modelSize,
    }

    if (options.instruct) body.instruct = options.instruct
    if (options.seed != null) body.seed = options.seed
    if (options.maxChunkChars != null) body.max_chunk_chars = options.maxChunkChars
    if (options.crossfadeMs != null) body.crossfade_ms = options.crossfadeMs
    if (options.normalize != null) body.normalize = options.normalize
    if (options.effectsChain) body.effects_chain = options.effectsChain

    // Check disk cache
    if (!options.disableCache) {
      const { hashObject } = this.container.utils
      const cacheKey = `voicebox:${hashObject({ text, profileId, engine, modelSize, language, instruct: options.instruct })}`
      const diskCache = this.container.feature('diskCache')

      if (await diskCache.has(cacheKey)) {
        const cached = await diskCache.get(cacheKey)
        const audioBuffer = Buffer.from(cached, 'base64')
        this.emit('speech', { profileId, text, audioSize: audioBuffer.length })
        return audioBuffer
      }

      const audioBuffer = await this.fetchStreamAudio(body, text.length)
      await diskCache.set(cacheKey, audioBuffer.toString('base64'))
      this.emit('speech', { profileId, text, audioSize: audioBuffer.length })
      return audioBuffer
    }

    const audioBuffer = await this.fetchStreamAudio(body, text.length)
    this.emit('speech', { profileId, text, audioSize: audioBuffer.length })
    return audioBuffer
  }

  /**
   * Generate speech asynchronously (returns metadata, not audio).
   * Use getAudio() to fetch the audio after generation completes.
   */
  async generate(text: string, options: SynthesizeOptions = {}): Promise<any> {
    const profileId = options.profileId || this.options.defaultProfileId
    if (!profileId) throw new Error('profileId is required for VoiceBox generation')

    const body: Record<string, any> = {
      profile_id: profileId,
      text,
      language: options.language || this.options.defaultLanguage || 'en',
      engine: options.engine || this.options.defaultEngine || 'qwen',
      model_size: options.modelSize || this.options.defaultModelSize || '1.7B',
    }

    if (options.instruct) body.instruct = options.instruct
    if (options.seed != null) body.seed = options.seed
    if (options.effectsChain) body.effects_chain = options.effectsChain

    this.trackRequest(text.length)
    return this.post('/generate', body)
  }

  /**
   * Fetch generated audio by generation ID. Returns WAV Buffer.
   */
  async getAudio(generationId: string): Promise<Buffer> {
    this.trackRequest()
    const response = await this.axios({
      method: 'GET',
      url: `/audio/${generationId}`,
      responseType: 'arraybuffer',
      headers: { Accept: 'audio/wav' },
    })
    return Buffer.from(response.data)
  }

  /**
   * Synthesize and write audio to a file.
   */
  async say(text: string, outputPath: string, options: SynthesizeOptions = {}): Promise<string> {
    const audio = await this.synthesize(text, options)
    const resolvedPath = this.container.paths.resolve(outputPath)
    await this.container.fs.writeFileAsync(resolvedPath, audio)
    return resolvedPath
  }

  private async fetchStreamAudio(body: Record<string, any>, charCount: number): Promise<Buffer> {
    this.trackRequest(charCount)
    const response = await this.axios({
      method: 'POST',
      url: '/generate/stream',
      data: body,
      responseType: 'arraybuffer',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'audio/wav',
      },
    })
    return Buffer.from(response.data)
  }
}

export default VoiceBoxClient
