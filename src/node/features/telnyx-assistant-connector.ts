import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

export const TelnyxAssistantConnectorStateSchema = FeatureStateSchema.extend({
  publicUrl: z.string().optional().describe('The public URL for tool webhooks (tunnel or pre-configured domain)'),
  telnyxAssistantId: z.string().optional().describe('The Telnyx assistant ID created for this session'),
  phoneNumberId: z.string().optional().describe('The Telnyx phone number ID wired to the assistant'),
  port: z.number().optional().describe('The port the express server is listening on'),
  running: z.boolean().default(false).describe('Whether the connector is actively running'),
})
export type TelnyxConnectorState = z.infer<typeof TelnyxAssistantConnectorStateSchema>

export const TelnyxAssistantConnectorOptionsSchema = FeatureOptionsSchema.extend({
  assistant: z.any().describe('The Luca assistant instance to bridge to Telnyx'),
  port: z.number().default(4567).describe('Port for the local express server'),
  model: z.string().default('meta-llama/Meta-Llama-3.1-70B-Instruct').describe('Telnyx model ID'),
  greeting: z.string().optional().describe('Greeting message for the Telnyx assistant'),
  phoneNumber: z.string().optional().describe('Phone number to wire to the assistant (e.g. +13125552200)'),
  noTools: z.boolean().default(false).describe('Deploy without tools — skip local server and tunnel'),
  debug: z.boolean().default(false).describe('Emit verbose [telnyx] log output'),
  domain: z.string().optional().describe('Pre-configured domain name (e.g. from cloudflared tunnel). Skips ephemeral tunnel creation.'),
  voice: z.string().optional().describe('TTS voice ID (e.g. Telnyx.Ultra.<id> or an ElevenLabs voice ID). If omitted, uses Telnyx default.'),
  ttsProvider: z.string().optional().describe('TTS provider: "telnyx" (default) or "elevenlabs"'),
  apiKeyRef: z.string().optional().describe('Integration secret identifier for the TTS provider API key (required for ElevenLabs)'),
})
export type TelnyxConnectorOptions = z.infer<typeof TelnyxAssistantConnectorOptionsSchema>

export const TelnyxAssistantConnectorEventsSchema = FeatureEventsSchema.extend({
  started: z.tuple([z.object({
    publicUrl: z.string(),
    telnyxAssistantId: z.string(),
    port: z.number(),
  })]).describe('Emitted when the connector is fully running'),
  toolCall: z.tuple([z.string(), z.any()]).describe('Emitted when a tool is called via webhook'),
  toolError: z.tuple([z.string(), z.instanceof(Error)]).describe('Emitted when a tool call throws'),
  stopped: z.tuple([]).describe('Emitted when the connector is torn down'),
})

/**
 * Bridges a local Luca assistant to Telnyx AI by exposing tool handlers
 * as HTTP endpoints and creating a mirrored Telnyx assistant with webhook bindings.
 *
 * @example
 * ```typescript
 * const mgr = container.feature('assistantsManager')
 * const chief = mgr.create('chiefOfStaff')
 * const connector = container.feature('telnyxAssistantConnector', { assistant: chief })
 * await connector.start()
 * ```
 *
 * @extends Feature
 */
export class TelnyxAssistantConnector extends Feature<TelnyxConnectorState, TelnyxConnectorOptions> {
  static override shortcut = 'features.telnyxAssistantConnector' as const
  static override stability = 'experimental' as const
  static override stateSchema = TelnyxAssistantConnectorStateSchema
  static override optionsSchema = TelnyxAssistantConnectorOptionsSchema
  static override eventsSchema = TelnyxAssistantConnectorEventsSchema
  static { Feature.register(this, 'telnyxAssistantConnector') }

  private _log(...args: any[]) {
    if (this.options.debug) console.log(...args)
  }

  private _server: any = null
  private _tunnelProcess: any = null
  private _telnyxClient: any = null
  private _previousConnectionId: string | null = null
  private _messagingProfileId: string | null = null
  private _activeCallSid: string | null = null

  get assistant() {
    return this.options.assistant
  }

  /**
   * Canonical name derived from the assistant folder (e.g. `receptionist`),
   * used for both the Telnyx assistant and its messaging profile.
   */
  get assistantName(): string {
    const folder = this.assistant?.options?.folder
    if (folder) return String(folder).split('/').pop()!
    return this.assistant?.name || this.assistant?.constructor?.name || 'assistant'
  }

  /**
   * Get a Telnyx client (uses existing one if running, otherwise creates a fresh one).
   */
  private async _getClient() {
    if (this._telnyxClient) return this._telnyxClient
    const { Telnyx } = await import('telnyx')
    return new Telnyx({ apiKey: process.env.TELNYX_API_KEY! })
  }

  /**
   * List all messaging profiles on the account.
   */
  async listMessagingProfiles() {
    const client = await this._getClient()
    const profiles = await client.messagingProfiles.list()
    const results: any[] = []
    for await (const p of profiles) {
      results.push({
        id: p.id,
        name: p.name,
        webhook_url: p.webhook_url,
        whitelisted_destinations: p.whitelisted_destinations,
        created_at: p.created_at,
        updated_at: p.updated_at,
      })
    }
    return results
  }

  /**
   * Get full details of a messaging profile by ID.
   */
  async getMessagingProfile(profileId: string) {
    const client = await this._getClient()
    const resp = await client.messagingProfiles.retrieve(profileId)
    return resp?.data || resp
  }

  /**
   * List all AI assistants on the account.
   */
  async listAssistants() {
    const client = await this._getClient()
    const resp = await client.ai.assistants.list()
    const items = resp?.data || resp
    return Array.isArray(items) ? items.map((a: any) => ({
      id: a.id,
      name: a.name,
      model: a.model,
      enabled_features: a.enabled_features,
      telephony_settings: a.telephony_settings,
      messaging_settings: a.messaging_settings,
    })) : items
  }

  /**
   * Get full details of a Telnyx AI assistant by ID.
   */
  async getAssistant(assistantId: string) {
    const client = await this._getClient()
    const resp = await client.ai.assistants.retrieve(assistantId)
    return resp?.data || resp
  }

  /**
   * List voices available to your Telnyx account. Optionally pass an
   * integration secret ref for ElevenLabs — Telnyx will then include your
   * personal ElevenLabs voices in the response.
   *
   * @example
   * ```ts
   * await connector.listVoices()                               // Telnyx defaults
   * await connector.listVoices({ provider: 'ElevenLabs',       // your custom voices
   *                              apiKeyRef: 'elevenlabs_api_key' })
   * ```
   */
  async listVoices(opts: { provider?: string; apiKeyRef?: string; filter?: string } = {}) {
    const params: any = {}
    if (opts.apiKeyRef) params.elevenlabs_api_key_ref = opts.apiKeyRef
    const query = new URLSearchParams(params).toString()

    const r = await fetch(
      `https://api.telnyx.com/v2/text-to-speech/voices${query ? `?${query}` : ''}`,
      { headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY!}` } }
    )
    const body: any = await r.json()
    let voices: any[] = body?.voices || []
    if (opts.provider) {
      const needle = opts.provider.toLowerCase()
      voices = voices.filter((v: any) => (v.provider || '').toLowerCase() === needle)
    }
    const filtered = opts.filter
      ? voices.filter((v: any) => {
          const needle = opts.filter!.toLowerCase()
          return (v.name || '').toLowerCase().includes(needle)
            || (v.id || '').toLowerCase().includes(needle)
            || (v.voice || '').toLowerCase().includes(needle)
        })
      : voices
    return filtered.map((v: any) => ({
      voice: v.id,
      name: v.name,
      provider: v.provider,
      model_id: v.model_id,
      language: v.language,
      gender: v.gender,
    }))
  }

  /**
   * Patch voice_settings on an existing Telnyx AI assistant. Useful for
   * iterating on the voice string without redeploying.
   *
   * @example
   * ```ts
   * await connector.updateAssistantVoice('assistant-abc', {
   *   voice: 'ElevenLabs.eleven_v3.ulEiUT06p4S3sHtsvn4T',
   *   api_key_ref: 'elevenlabs_api_key',
   *   voice_speed: 1.05,
   * })
   * ```
   */
  async updateAssistantVoice(assistantId: string, voiceSettings: any) {
    const client = await this._getClient()
    this._log('[telnyx] Updating assistant voice_settings:', JSON.stringify(voiceSettings, null, 2))
    const resp = await client.ai.assistants.update(assistantId, { voice_settings: voiceSettings })
    const updated = resp?.data || resp
    this._log('[telnyx] Assistant now has voice_settings:', JSON.stringify(updated?.voice_settings, null, 2))
    return updated
  }

  /**
   * Convert text to speech and return the full audio as a Buffer.
   * Uses the Telnyx TTS REST endpoint — waits for the complete audio before returning.
   * For lower latency on longer text, use `streamSpeak()` instead.
   *
   * @example
   * ```ts
   * const audio = await connector.speak('Hello world', { voice: 'Telnyx.Ultra.Aurora' })
   * await fs.writeFile('/tmp/out.mp3', audio)
   * ```
   */
  async speak(text: string, opts: { voice?: string; apiKeyRef?: string; voiceSettings?: any } = {}): Promise<Buffer> {
    const client = await this._getClient()
    const voice = opts.voice || this.options.voice
    const params: any = { text, output_type: 'base64_output' }
    if (voice) params.voice = voice
    if (opts.apiKeyRef) params.elevenlabs = { api_key: opts.apiKeyRef }
    if (opts.voiceSettings) params.voice_settings = opts.voiceSettings

    this._log('[telnyx] TTS generate:', JSON.stringify({ voice, text: text.slice(0, 60) }))
    const resp = await client.textToSpeech.generate(params) as any
    return Buffer.from(resp.base64_audio, 'base64')
  }

  /**
   * Stream text-to-speech audio over a WebSocket, yielding `Buffer` chunks as
   * they arrive. First audio chunk typically arrives in <500ms. You can pipe
   * chunks directly to a speaker or file stream.
   *
   * @example
   * ```ts
   * // collect all chunks (still faster than speak() for long text)
   * const chunks: Buffer[] = []
   * for await (const chunk of connector.streamSpeak('Hello world')) {
   *   chunks.push(chunk)
   * }
   * const audio = Buffer.concat(chunks)
   *
   * // or pipe to a write stream as chunks arrive
   * const out = fs.createWriteStream('/tmp/out.pcm')
   * for await (const chunk of connector.streamSpeak('Hello', { voice: 'Telnyx.Ultra.Aurora' })) {
   *   out.write(chunk)
   * }
   * out.end()
   * ```
   */
  async *streamSpeak(text: string, opts: { voice?: string; voiceSettings?: any } = {}): AsyncGenerator<Buffer> {
    const client = await this._getClient()
    const voice = opts.voice || this.options.voice
    const query: any = {}
    if (voice) query.voice = voice

    const { TextToSpeechWS } = await import('telnyx/resources/text-to-speech') as any
    const ws = new TextToSpeechWS(client, query)

    this._log('[telnyx] TTS stream start:', JSON.stringify({ voice, text: text.slice(0, 60) }))

    let opened = false
    for await (const msg of ws.stream()) {
      if (msg.type === 'open' && !opened) {
        opened = true
        ws.send({ text: ' ', voice_settings: opts.voiceSettings || {} })
        ws.send({ text })
      } else if (msg.type === 'message') {
        const event = msg.message
        if (event.type === 'audio_chunk' && event.audio) {
          yield Buffer.from(event.audio, 'base64')
        } else if (event.type === 'final') {
          ws.close()
          return
        } else if (event.type === 'error') {
          ws.close()
          throw new Error(event.error || 'TTS stream error')
        }
      } else if (msg.type === 'error') {
        ws.close()
        throw msg.error
      } else if (msg.type === 'close') {
        return
      }
    }
  }

  /**
   * Try a voice_settings object on the standalone TTS command endpoint and
   * save the MP3 locally so you can listen. Fastest way to confirm a voice
   * string is valid without deploying an assistant.
   *
   * @example
   * ```ts
   * await connector.testVoice({
   *   voice: 'ElevenLabs.eleven_v3.ulEiUT06p4S3sHtsvn4T',
   *   apiKeyRef: 'elevenlabs_api_key',
   *   text: 'Top of the morning.',
   *   outputPath: 'docs/calls/voice-test.mp3',
   * })
   * ```
   */
  async testVoice(opts: { voice: string; apiKeyRef?: string; text: string; outputPath?: string; voiceSettings?: any }) {
    const body: any = { voice: opts.voice, text: opts.text }
    if (opts.apiKeyRef) body.api_key_ref = opts.apiKeyRef
    if (opts.voiceSettings) body.voice_settings = opts.voiceSettings

    this._log('[telnyx] Test TTS request:', JSON.stringify(body, null, 2))

    const resp = await fetch('https://api.telnyx.com/v2/text-to-speech/speak', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.TELNYX_API_KEY!}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!resp.ok) {
      const errText = await resp.text()
      this._log('[telnyx] Test TTS failed:', resp.status, errText)
      return { ok: false, status: resp.status, error: errText }
    }

    const outputPath = opts.outputPath || 'docs/calls/voice-test.mp3'
    const fs = this.container.feature('fs')
    const absPath = this.container.paths.resolve(outputPath)
    const buffer = Buffer.from(await resp.arrayBuffer())
    await fs.writeFile(absPath, buffer)
    this._log(`[telnyx] Saved TTS output → ${absPath} (${buffer.length} bytes)`)
    return { ok: true, path: absPath, bytes: buffer.length }
  }

  /**
   * Pretty-print the voice-related config of an assistant. Shows the raw
   * voice_settings that Telnyx has stored, so you can compare against what
   * the UI displays.
   */
  async inspectVoice(assistantId: string) {
    const assistant = await this.getAssistant(assistantId)
    const voice = assistant?.voice_settings
    this._log('[telnyx] Current voice_settings on assistant:', JSON.stringify(voice, null, 2))
    return voice
  }

  // ── Conversations ────────────────────────────────────────────────────────

  /**
   * List conversations for this assistant. Automatically filters by the
   * assistant ID stored in state when available, so you only see conversations
   * that belong to the current deployment.
   *
   * @example
   * ```ts
   * const convos = await connector.listConversations()
   * const recent = await connector.listConversations({ order: 'last_message_at.desc', limit: 20 })
   * ```
   */
  async listConversations(query: Record<string, any> = {}) {
    const client = await this._getClient()
    const assistantId = this.state.get('telnyxAssistantId')
    const params: any = { ...query }
    if (assistantId && !params['metadata->assistant_id']) {
      params['metadata->assistant_id'] = `eq.${assistantId}`
    }
    const resp = await client.ai.conversations.list(params)
    return resp?.data || resp
  }

  /**
   * Retrieve a specific conversation by ID.
   */
  async getConversation(conversationId: string) {
    const client = await this._getClient()
    const resp = await client.ai.conversations.retrieve(conversationId)
    return resp?.data || resp
  }

  /**
   * List all messages in a conversation, including assistant tool calls.
   */
  async getConversationMessages(conversationId: string) {
    const client = await this._getClient()
    const resp = await client.ai.conversations.messages.list(conversationId)
    return resp?.data || resp
  }

  /**
   * Retrieve post-call insights for a conversation (summaries, extracted data, etc.).
   * Insights are generated asynchronously after the call ends — check `status` field.
   */
  async getConversationInsights(conversationId: string) {
    const client = await this._getClient()
    const resp = await client.ai.conversations.retrieveConversationsInsights(conversationId)
    return resp?.data || resp
  }

  /**
   * Manually inject a message into a conversation. Useful for adding context
   * or system messages outside of a live call.
   */
  async addConversationMessage(conversationId: string, message: {
    role: string
    content?: string
    name?: string
    sent_at?: string
    tool_call_id?: string
    tool_calls?: Array<Record<string, unknown>>
  }) {
    const client = await this._getClient()
    await client.ai.conversations.addMessage(conversationId, message)
  }

  /**
   * Disable AI responses on a conversation so a human agent can take over.
   * While disabled, calls to the Telnyx chat endpoint return 400. Re-enable
   * with `handoffToAI()`.
   *
   * @example
   * ```ts
   * await connector.handoffToHuman(conversationId)
   * ```
   */
  async handoffToHuman(conversationId: string) {
    const client = await this._getClient()
    await client.ai.conversations.update(conversationId, {
      metadata: { ai_disabled: 'true' },
    })
    this._log(`[telnyx] Conversation ${conversationId} handed off to human (AI disabled)`)
  }

  /**
   * Re-enable AI responses on a conversation after a human handoff.
   */
  async handoffToAI(conversationId: string) {
    const client = await this._getClient()
    await client.ai.conversations.update(conversationId, {
      metadata: { ai_disabled: 'false' },
    })
    this._log(`[telnyx] Conversation ${conversationId} handed back to AI`)
  }

  // ── Insight templates ─────────────────────────────────────────────────────

  /**
   * Create an insight template — a reusable instruction applied to conversations
   * to extract structured data (summaries, action items, sentiment, etc.).
   * Optionally provide a `json_schema` to enforce structured output.
   *
   * @example
   * ```ts
   * await connector.createInsight({
   *   name: 'call-summary',
   *   instructions: 'Summarize this call in 2-3 sentences.',
   * })
   * await connector.createInsight({
   *   name: 'action-items',
   *   instructions: 'Extract any action items promised during the call.',
   *   json_schema: { type: 'array', items: { type: 'string' } },
   * })
   * ```
   */
  async createInsight(params: { name: string; instructions: string; json_schema?: unknown; webhook?: string }) {
    const client = await this._getClient()
    const resp = await client.ai.conversations.insights.create(params as any)
    return resp?.data || resp
  }

  /**
   * List all insight templates on the account.
   */
  async listInsights() {
    const client = await this._getClient()
    const results: any[] = []
    for await (const insight of client.ai.conversations.insights.list()) {
      results.push(insight)
    }
    return results
  }

  /**
   * Delete an insight template by ID.
   */
  async deleteInsight(insightId: string) {
    const client = await this._getClient()
    await client.ai.conversations.insights.delete(insightId)
  }

  // ── Phone numbers ─────────────────────────────────────────────────────────

  /**
   * List all phone numbers on the Telnyx account with their status and connection info.
   */
  async listPhoneNumbers() {
    const client = await this._getClient()
    const numbers = await client.phoneNumbers.list()
    const results: any[] = []
    for await (const num of numbers) {
      results.push({
        id: num.id,
        phone_number: num.phone_number,
        status: num.status,
        connection_id: num.connection_id,
        connection_name: num.connection_name,
        messaging_profile_id: num.messaging_profile_id,
        tags: num.tags,
      })
    }
    return results
  }

  /**
   * Get the phone number record (voice + messaging config) for an E.164 number.
   */
  async getPhoneNumber(phoneNumber: string) {
    const client = await this._getClient()
    const numbers = await client.phoneNumbers.list({ 'filter[phone_number]': phoneNumber })
    let record: any = null
    for await (const num of numbers) {
      record = num
      break
    }
    if (!record) return null

    let messagingConfig: any = null
    try {
      const msgResp = await client.phoneNumbers.messaging.retrieve(record.id)
      messagingConfig = msgResp?.data || msgResp
    } catch { }

    return {
      id: record.id,
      phone_number: record.phone_number,
      connection_id: record.connection_id,
      connection_name: record.connection_name,
      messaging_profile_id: record.messaging_profile_id,
      messaging: messagingConfig,
      tags: record.tags,
      status: record.status,
    }
  }

  /**
   * Get a TeXML application by ID.
   */
  async getTexmlApp(appId: string) {
    const client = await this._getClient()
    const resp = await client.texmlApplications.retrieve(appId)
    return resp?.data || resp
  }

  /**
   * List all TeXML applications on the account.
   */
  async listTexmlApps() {
    const client = await this._getClient()
    const resp = await client.texmlApplications.list()
    const results: any[] = []
    const items = resp?.data || resp
    if (Array.isArray(items)) {
      for (const app of items) {
        results.push({
          id: app.id,
          friendly_name: app.friendly_name,
          voice_url: app.voice_url,
          status_callback: app.status_callback,
          created_at: app.created_at,
          updated_at: app.updated_at,
        })
      }
    } else if (items?.[Symbol.asyncIterator]) {
      for await (const app of items) {
        results.push({
          id: app.id,
          friendly_name: app.friendly_name,
          voice_url: app.voice_url,
          status_callback: app.status_callback,
          created_at: app.created_at,
          updated_at: app.updated_at,
        })
      }
    }
    return results
  }

  /**
   * Delete all TeXML applications on the account.
   * Returns a summary of what was deleted and any failures.
   */
  async deleteAllTexmlApps() {
    const apps = await this.listTexmlApps()
    const client = await this._getClient()
    const results: { id: string; friendly_name: string; status: 'deleted' | 'failed'; error?: string }[] = []

    for (const app of apps) {
      try {
        await client.texmlApplications.delete(app.id)
        results.push({ id: app.id, friendly_name: app.friendly_name, status: 'deleted' })
      } catch (err: any) {
        results.push({ id: app.id, friendly_name: app.friendly_name, status: 'failed', error: err.message })
      }
    }

    return { total: apps.length, deleted: results.filter(r => r.status === 'deleted').length, results }
  }

  /**
   * Inspect the full live config: the current assistant, its messaging profile,
   * the phone number wiring, and the TeXML app. Pass a phone number to include
   * phone config, or omit to just show assistant + profile.
   */
  async inspect(phoneNumber?: string) {
    const result: any = {}

    const assistantId = this.state.get('telnyxAssistantId')
    if (assistantId) {
      result.assistant = await this.getAssistant(assistantId)
    }

    if (this._messagingProfileId) {
      result.messagingProfile = await this.getMessagingProfile(this._messagingProfileId)
    }

    if (phoneNumber || this.options.phoneNumber) {
      result.phoneNumber = await this.getPhoneNumber(phoneNumber || this.options.phoneNumber!)
    }

    const texmlAppId = result.assistant?.telephony_settings?.default_texml_app_id
    if (texmlAppId) {
      result.texmlApp = await this.getTexmlApp(texmlAppId)
    }

    return result
  }

  /**
   * Start the connector: mount tool endpoints, establish public URL, create Telnyx assistant,
   * and optionally wire a phone number to it.
   *
   * @returns The session info including public URL and Telnyx assistant ID
   *
   * @example
   * ```typescript
   * const info = await connector.start()
   * console.log(info.publicUrl, info.telnyxAssistantId)
   * ```
   */
  async start() {
    const { Telnyx } = await import('telnyx')
    this._telnyxClient = new Telnyx({ apiKey: process.env.TELNYX_API_KEY! })

    let publicUrl: string | null = null
    let port: number | null = null

    if (this.options.noTools) {
      await this._ensureMessagingProfile(null)
      const telnyxAssistant = await this._createTelnyxAssistant(null)

      if (this.options.phoneNumber) {
        await this._wirePhoneNumber(telnyxAssistant)
      }

      this.state.set('telnyxAssistantId', telnyxAssistant.id)
      this.state.set('running', true)

      const info = {
        publicUrl: null as string | null,
        telnyxAssistantId: telnyxAssistant.id,
        port: null as number | null,
        phoneNumber: this.options.phoneNumber,
      }
      this.emit('started', info)
      return info
    }

    port = await this._findAvailablePort(this.options.port)
    const server = this.container.server('express', { port, cors: true })

    this._mountToolEndpoints(server)
    this._mountHangupTool(server)
    this._mountCallEventsEndpoint(server)
    this._mountInboundSmsEndpoint(server)

    await server.start()
    this._server = server

    if (this.options.domain) {
      publicUrl = `https://${this.options.domain}`
      this._log(`[telnyx] Using pre-configured domain: ${publicUrl}`)
      await this._waitForTunnelReady(publicUrl)
    } else {
      publicUrl = await this._startTunnel(port)
      await this._waitForTunnelReady(publicUrl)
    }

    await this._ensureMessagingProfile(publicUrl)
    const telnyxAssistant = await this._createTelnyxAssistant(publicUrl)

    if (this.options.phoneNumber) {
      await this._wirePhoneNumber(telnyxAssistant)
    }

    this.state.set('publicUrl', publicUrl)
    this.state.set('telnyxAssistantId', telnyxAssistant.id)
    this.state.set('port', port)
    this.state.set('running', true)

    const info = {
      publicUrl,
      telnyxAssistantId: telnyxAssistant.id,
      port,
      phoneNumber: this.options.phoneNumber,
    }
    this.emit('started', info)

    return info
  }

  /**
   * Stop the connector: restore the phone number's previous connection,
   * delete the Telnyx assistant, kill tunnel (if ephemeral), stop the server.
   *
   * @example
   * ```typescript
   * await connector.stop()
   * ```
   */
  async stop() {
    const phoneNumberId = this.state.get('phoneNumberId')
    if (phoneNumberId && this._telnyxClient) {
      try {
        if (this._previousConnectionId) {
          await this._telnyxClient.phoneNumbers.update(phoneNumberId, {
            connection_id: this._previousConnectionId,
          })
        }
        if (!this._messagingProfileId) {
          await this._telnyxClient.phoneNumbers.messaging.update(phoneNumberId, {
            messaging_profile_id: '',
          })
          this._log('[telnyx] Unset messaging profile on phone number')
        } else {
          this._log('[telnyx] Leaving persistent messaging profile on phone number')
        }
      } catch (e) {
        // best effort
      }
    }

    const assistantId = this.state.get('telnyxAssistantId')
    if (assistantId && this._telnyxClient) {
      try {
        await this._telnyxClient.ai.assistants.delete(assistantId)
      } catch (e) {
        // best effort cleanup
      }
    }

    if (this._tunnelProcess) {
      try { this._tunnelProcess.kill() } catch {}
      this._tunnelProcess = null
    }

    if (this._server) {
      await this._server.stop()
      this._server = null
    }

    this.state.set('running', false)
    this.emit('stopped')
  }

  private _mountToolEndpoints(server: any) {
    const tools = this.assistant.tools

    for (const [name, tool] of Object.entries(tools) as [string, any][]) {
      server.app.post(`/tools/${name}`, async (req: any, res: any) => {
        try {
          this.emit('toolCall', name, req.body)
          const result = await tool.handler(req.body)
          res.json({ result })
        } catch (err: any) {
          this.emit('toolError', name, err instanceof Error ? err : new Error(String(err)))
          res.status(500).json({ error: err.message })
        }
      })
    }

    server.app.get('/health', (_req: any, res: any) => {
      res.json({
        status: 'ok',
        assistant: this.assistantName,
        tools: Object.keys(tools),
      })
    })
  }

  private _mountHangupTool(server: any) {
    server.app.post('/tools/hangup', async (_req: any, res: any) => {
      const callSid = this._activeCallSid
      this._log(`[telnyx] Hangup tool called (callSid: ${callSid})`)
      this.emit('toolCall', 'hangup', {})

      if (!callSid) {
        res.json({ result: 'No active call to hang up' })
        return
      }

      try {
        await fetch(`https://api.telnyx.com/v2/calls/${encodeURIComponent(callSid)}/actions/hangup`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.TELNYX_API_KEY!}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
        this._activeCallSid = null
        res.json({ result: 'Call ended' })
      } catch (err: any) {
        this.emit('toolError', 'hangup', err instanceof Error ? err : new Error(String(err)))
        res.json({ result: `Failed to hang up: ${err.message}` })
      }
    })
  }

  private _mountCallEventsEndpoint(server: any) {
    server.app.post('/call/events', async (req: any, res: any) => {
      try {
        const body = req.body
        const status = body?.CallStatus || body?.DialCallStatus || 'unknown'
        const callSid = body?.CallSid || 'unknown'
        const conversationId = body?.ConversationId || ''

        this._log(`[telnyx] Call event: ${status} (${callSid})`)

        const terminalStatuses = ['completed', 'failed', 'busy', 'no-answer', 'canceled', 'conversation_ended', 'analyzed']
        if (callSid && callSid !== 'unknown') {
          if (terminalStatuses.includes(status)) {
            if (this._activeCallSid === callSid) this._activeCallSid = null
          } else {
            this._activeCallSid = callSid
          }
        }

        let insights: string | null = null
        try {
          const parsed = JSON.parse(body?.ConversationInsights || '[]')
          insights = parsed?.[0]?.conversation_insights?.[0]?.result || null
        } catch {}

        if (insights) {
          this._log(`[telnyx] Summary: ${insights.slice(0, 200)}${insights.length > 200 ? '...' : ''}`)
        }

        let cost: any = null
        try { cost = JSON.parse(body?.Cost || '{}') } catch {}
        if (cost?.total) {
          this._log(`[telnyx] Cost: $${cost.total}`)
        }

        this._saveCallEvent(body, conversationId, status).catch((err: any) =>
          console.error('[telnyx] Failed to save call event:', err.message)
        )

        res.status(200).json({ status: 'ok' })
      } catch (err: any) {
        console.error('[telnyx] Call event error:', err.message)
        res.status(200).json({ status: 'ok' })
      }
    })
  }

  private _mountInboundSmsEndpoint(server: any) {
    const assistantsByPhone = new Map<string, any>()

    server.app.post('/messaging/inbound', async (req: any, res: any) => {
      res.status(200).json({ status: 'ok' })

      try {
        const payload = req.body?.data?.payload || req.body
        const eventType = req.body?.data?.event_type || ''
        const direction = payload?.direction || ''

        if (!eventType.includes('inbound') && direction !== 'inbound') return

        const from = payload?.from?.phone_number || payload?.from || ''
        const to = (payload?.to?.[0]?.phone_number) || payload?.to || ''
        const text = payload?.text || ''
        if (!text || !from) return

        this._log(`[telnyx] Inbound SMS from ${from}: "${text}"`)

        let smsAssistant = assistantsByPhone.get(from)
        if (!smsAssistant) {
          const mgr = this.container.feature('assistantsManager')
          smsAssistant = mgr.create(this.assistantName, { historyMode: 'lifecycle' })
          await smsAssistant.start()
          assistantsByPhone.set(from, smsAssistant)
          this._log(`[telnyx] Created local assistant for ${from}`)
        }

        const reply = await smsAssistant.ask(text)

        if (!reply) {
          this._log('[telnyx] Assistant returned empty reply')
          return
        }

        this._log(`[telnyx] Reply to ${from}: "${reply.slice(0, 120)}${reply.length > 120 ? '...' : ''}"`)
        this._log(`[telnyx] Sending SMS: from=${to}, to=${from}, profile=${this._messagingProfileId}`)

        const sendResult = await this._telnyxClient.messages.send({
          from: to,
          to: from,
          text: reply,
          messaging_profile_id: this._messagingProfileId,
        })
        const sendData = sendResult?.data || sendResult
        this._log(`[telnyx] SMS send response:`, JSON.stringify({
          id: sendData?.id,
          status: sendData?.to?.[0]?.status,
          from: sendData?.from?.phone_number,
          to: sendData?.to?.[0]?.phone_number,
          errors: sendData?.errors,
        }, null, 2))
        this._log(`[telnyx] SMS sent to ${from}`)
      } catch (err: any) {
        console.error('[telnyx] SMS handler error:', err.message)
      }
    })
  }

  /**
   * Save a call event to docs/calls/{slug}/{status}-{timestamp}.json.
   * Each call gets its own folder (keyed by CallSid). MP3 recordings are
   * downloaded when status is "analyzed".
   */
  private async _saveCallEvent(body: any, conversationId: string, status: string) {
    const fs = this.container.feature('fs')
    const slug = body?.CallSid || conversationId || new Date().toISOString().replace(/[:.]/g, '-')
    const callDir = this.container.paths.resolve(`docs/calls/${slug}`)
    await fs.ensureFolder(callDir)

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const jsonPath = this.container.paths.join(callDir, `${status}-${timestamp}.json`)
    await fs.writeFile(jsonPath, JSON.stringify(body, null, 2))
    this._log(`[telnyx] Saved call event → ${jsonPath}`)

    if (status !== 'analyzed') return

    let recordings: any[] = []
    try { recordings = JSON.parse(body?.Recordings || '[]') } catch {}

    for (const rec of recordings) {
      const mp3Url = rec?.download_urls?.mp3
      if (!mp3Url) continue

      try {
        const resp = await fetch(mp3Url)
        if (!resp.ok) {
          this._log(`[telnyx] Failed to download recording: ${resp.status}`)
          continue
        }
        const buffer = Buffer.from(await resp.arrayBuffer())
        const mp3Path = this.container.paths.join(callDir, `recording.mp3`)
        await fs.writeFile(mp3Path, buffer)
        this._log(`[telnyx] Saved recording → ${mp3Path}`)
      } catch (err: any) {
        this._log(`[telnyx] Failed to download recording: ${err.message}`)
      }
    }
  }

  private async _findAvailablePort(preferred: number): Promise<number> {
    return this.container.feature('networking').findOpenPort(preferred)
  }

  private async _waitForTunnelReady(url: string): Promise<void> {
    const timeoutMs = 120000
    const start = Date.now()
    const deadline = start + timeoutMs
    let attempt = 0
    let lastLog = 0
    while (Date.now() < deadline) {
      attempt++
      try {
        const r = await fetch(`${url}/health`, { method: 'GET' })
        if (r.ok) {
          this._log(`[telnyx] tunnel ready after ${Date.now() - start}ms (attempt ${attempt})`)
          return
        }
      } catch {
        // not yet routable
      }
      const elapsed = Date.now() - start
      if (elapsed - lastLog >= 10000) {
        this._log(`[telnyx] tunnel not ready yet (${Math.round(elapsed / 1000)}s, attempt ${attempt})`)
        lastLog = elapsed
      }
      await new Promise((r) => setTimeout(r, 1500))
    }
    throw new Error(`Tunnel ${url} did not become reachable within ${timeoutMs / 1000}s`)
  }

  /**
   * Start a cloudflared quick tunnel and capture the public trycloudflare.com URL.
   * Each invocation gets a fresh ephemeral hostname — no config or login required.
   */
  private async _startTunnel(port: number): Promise<string> {
    const proc = this.container.feature('proc')

    const child = proc.spawn('cloudflared', [
      'tunnel',
      '--no-autoupdate',
      '--url', `http://localhost:${port}`,
    ])
    this._tunnelProcess = child
    this._log(`[telnyx] cloudflared tunneling :${port}`)

    return await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Failed to start cloudflared tunnel for :${port} within 90s`))
      }, 90000)

      const urlPattern = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i
      let publicUrl: string | null = null
      let registered = false
      let resolved = false

      const tryResolve = () => {
        if (resolved || !publicUrl || !registered) return
        resolved = true
        clearTimeout(timer)
        this._log(`[telnyx] tunnel registered with edge → ${publicUrl}`)
        resolve(publicUrl)
      }

      const onChunk = (chunk: any) => {
        const text = String(chunk)
        for (const line of text.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed) continue
          this._log(`[cloudflared:${port}] ${trimmed.slice(0, 500)}`)
          if (!publicUrl) {
            const match = trimmed.match(urlPattern)
            if (match) publicUrl = match[0]
          }
          if (!registered && /Registered tunnel connection/i.test(trimmed)) {
            registered = true
          }
          tryResolve()
        }
      }

      child.stdout?.on?.('data', onChunk)
      child.stderr?.on?.('data', onChunk)
    })
  }

  /**
   * Create a Telnyx assistant that mirrors the local assistant's prompt and tools.
   */
  private async _createTelnyxAssistant(publicUrl: string | null) {
    const webhookTools = []

    if (publicUrl) {
      const tools = this.assistant.tools
      for (const [name, tool] of Object.entries(tools) as [string, any][]) {
        webhookTools.push({
          type: 'webhook' as const,
          webhook: {
            name,
            description: tool.description || name,
            url: `${publicUrl}/tools/${name}`,
            method: 'POST' as const,
            body_parameters: tool.parameters || { type: 'object', properties: {} },
            timeout_ms: 10000,
          },
        })
      }

      webhookTools.push({
        type: 'webhook' as const,
        webhook: {
          name: 'hangup',
          description: 'End the current phone call. Call this when the conversation is complete or the caller should be disconnected.',
          url: `${publicUrl}/tools/hangup`,
          method: 'POST' as const,
          body_parameters: { type: 'object', properties: {} },
          timeout_ms: 5000,
        },
      })
    }

    const params: any = {
      name: `luca-${this.assistantName}`,
      instructions: this.assistant.effectiveSystemPrompt,
      model: this.options.model,
      enabled_features: ['telephony', 'messaging'],
    }

    const voiceConfig = this.assistant.voiceConfig
    const isElevenLabs = this.options.ttsProvider === 'elevenlabs' || voiceConfig?.provider === 'elevenlabs'
    const voiceId = this.options.voice || voiceConfig?.voiceId
    const apiKeyRef = this.options.apiKeyRef

    this._log('[telnyx] Voice resolution:', JSON.stringify({
      sources: {
        'options.voice': this.options.voice,
        'options.ttsProvider': this.options.ttsProvider,
        'options.apiKeyRef': this.options.apiKeyRef,
        'assistant.voiceConfig': voiceConfig,
      },
      resolved: { voiceId, isElevenLabs, apiKeyRef },
    }, null, 2))

    if (voiceId) {
      let resolvedVoice = voiceId
      if (isElevenLabs && !/^ElevenLabs\./i.test(voiceId)) {
        const supported = new Set([
          'eleven_flash_v2', 'eleven_flash_v2_5', 'eleven_multilingual_v1',
          'eleven_multilingual_v2', 'eleven_turbo_v2', 'eleven_turbo_v2_5',
          'eleven_v2_5_flash', 'eleven_v2_flash',
        ])
        const model = voiceConfig?.modelId
        resolvedVoice = model && supported.has(model)
          ? `ElevenLabs.${model}.${voiceId}`
          : `ElevenLabs.${voiceId}`
      }

      const voiceSettings: any = { voice: resolvedVoice }
      if (apiKeyRef && isElevenLabs) {
        voiceSettings.api_key_ref = apiKeyRef
      }
      if (isElevenLabs && typeof voiceConfig?.voiceSettings?.speed === 'number') {
        voiceSettings.voice_speed = voiceConfig.voiceSettings.speed
      }
      params.voice_settings = voiceSettings
      this._log('[telnyx] Sending voice_settings:', JSON.stringify(voiceSettings, null, 2))
    } else {
      this._log('[telnyx] No voiceId resolved — using Telnyx default voice')
    }

    if (this._messagingProfileId) {
      params.messaging_settings = {
        default_messaging_profile_id: this._messagingProfileId,
      }
    }

    if (webhookTools.length > 0) {
      params.tools = webhookTools
    }

    if (this.options.greeting) {
      params.greeting = this.options.greeting
    }

    this._log('[telnyx] Creating assistant with params:', JSON.stringify(params, null, 2))
    const result = await this._telnyxClient.ai.assistants.create(params)
    this._log('[telnyx] Assistant created:', JSON.stringify({
      id: result.id,
      name: result.name,
      enabled_features: result.enabled_features,
      telephony_settings: result.telephony_settings,
      messaging_settings: result.messaging_settings,
    }, null, 2))

    if (publicUrl) {
      const texmlAppId = result.telephony_settings?.default_texml_app_id
      if (texmlAppId) {
        try {
          await this._telnyxClient.texmlApplications.update(texmlAppId, {
            status_callback: `${publicUrl}/call/events`,
          })
          this._log(`[telnyx] Wired TeXML app status callback → ${publicUrl}/call/events`)
        } catch (err: any) {
          this._log(`[telnyx] Could not set TeXML status callback: ${err.message}`)
        }
      }
    }

    return result
  }

  /**
   * Find or create a single persistent messaging profile named after the assistant.
   */
  private async _ensureMessagingProfile(publicUrl: string | null): Promise<string> {
    const client = this._telnyxClient
    const profileName = `luca-${this.assistantName}`

    const profiles = await client.messagingProfiles.list()
    let existing: any = null

    for await (const profile of profiles) {
      if (profile.name === profileName) {
        existing = profile
        break
      }
    }

    if (existing) {
      this._log(`[telnyx] Found existing messaging profile "${profileName}" (${existing.id})`)
      if (existing.webhook_url) {
        await client.messagingProfiles.update(existing.id, { webhook_url: '' })
        this._log(`[telnyx] Cleared messaging profile webhook (letting Telnyx assistant handle SMS natively)`)
      }
      this._messagingProfileId = existing.id
      return existing.id
    }

    this._log(`[telnyx] Creating messaging profile "${profileName}"`)
    const created = await client.messagingProfiles.create({
      name: profileName,
      webhook_url: '',
      whitelisted_destinations: ['US'],
    })
    const profileId = created?.data?.id || created?.id
    this._log(`[telnyx] Created messaging profile "${profileName}" (${profileId})`)
    this._messagingProfileId = profileId
    return profileId
  }

  /**
   * Wire a phone number to the assistant's auto-created TeXML app and
   * the persistent messaging profile. Saves the previous connection_id
   * so stop() can restore it.
   */
  private async _wirePhoneNumber(telnyxAssistant: any) {
    const phoneNumber = this.options.phoneNumber!
    const client = this._telnyxClient

    const numbers = await client.phoneNumbers.list({ 'filter[phone_number]': phoneNumber })
    let phoneRecord: any = null

    for await (const num of numbers) {
      phoneRecord = num
      break
    }

    if (!phoneRecord) {
      throw new Error(`Phone number ${phoneNumber} not found in your Telnyx account`)
    }

    this._log('[telnyx] Phone record:', JSON.stringify({
      id: phoneRecord.id,
      phone_number: phoneRecord.phone_number,
      connection_id: phoneRecord.connection_id,
      messaging_profile_id: phoneRecord.messaging_profile_id,
    }, null, 2))

    this._previousConnectionId = phoneRecord.connection_id || null
    this.state.set('phoneNumberId', phoneRecord.id)

    const texmlAppId = telnyxAssistant.telephony_settings?.default_texml_app_id
    if (!texmlAppId) {
      throw new Error('Telnyx assistant did not create a TeXML app — is telephony enabled?')
    }

    this._log('[telnyx] Wiring voice connection_id:', texmlAppId)
    await client.phoneNumbers.update(phoneRecord.id, {
      connection_id: texmlAppId,
    })

    if (this._messagingProfileId) {
      this._log('[telnyx] Wiring messaging_profile_id:', this._messagingProfileId)
      await client.phoneNumbers.messaging.update(phoneRecord.id, {
        messaging_profile_id: this._messagingProfileId,
      })
    } else {
      this._log('[telnyx] WARNING: No messaging profile available — SMS will not work')
    }
  }
}

export default TelnyxAssistantConnector
