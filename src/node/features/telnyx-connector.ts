import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

export const TelnyxConnectorStateSchema = FeatureStateSchema.extend({
  publicUrl: z.string().optional().describe('The public URL for tool webhooks (tunnel or pre-configured domain)'),
  telnyxAssistantId: z.string().optional().describe('The Telnyx assistant ID created for this session'),
  phoneNumberId: z.string().optional().describe('The Telnyx phone number ID wired to the assistant'),
  port: z.number().optional().describe('The port the express server is listening on'),
  running: z.boolean().default(false).describe('Whether the connector is actively running'),
})
export type TelnyxConnectorState = z.infer<typeof TelnyxConnectorStateSchema>

export const TelnyxConnectorOptionsSchema = FeatureOptionsSchema.extend({
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
  pronunciationDictId: z.string().optional().describe('UUID of a Telnyx pronunciation dictionary to attach to the assistant voice. Falls back to pronunciationDictId in the assistant\'s voice.yml. Survives redeploys — without this, a manually-attached dictionary is lost every time the assistant is recreated.'),
  toolSecret: z.string().optional().describe('Shared secret Telnyx must present on tool webhook calls. Auto-generated per deploy if omitted.'),
  allowedCallers: z.array(z.string()).optional().describe('E.164 numbers allowed past the caller restriction. Omit for a fully open line. How the restriction is enforced is set by callerPolicy.'),
  callerPolicy: z.enum(['screen', 'tools']).default('screen').describe("How allowedCallers is enforced. 'screen': unlisted callers hear rejectMessage and the call ends before the assistant answers (SMS from unlisted senders gets rejectMessage back). 'tools': anyone can converse, but unlisted callers cannot trigger tool calls. Tool webhooks are secret-gated in both modes."),
  rejectMessage: z.string().default("Hey, sorry, can't talk right now.").describe("What unlisted callers hear (or receive via SMS) under callerPolicy 'screen'."),
  persist: z.boolean().default(false).describe('Leave the Telnyx assistant, screening app, and number wiring in place on stop() so the next start() can reuse them. For supervised deployments that restart with the loop.'),
  transferTargets: z.array(z.object({
    name: z.string().describe('Label the assistant uses to pick this target (e.g. "Jon\'s cell")'),
    to: z.string().describe('Destination number (+E.164) or SIP URI'),
  })).optional().describe("Named targets for the native transfer tool. Telnyx executes transfers itself (works in noTools mode too), so any caller who reaches the assistant can request one — under callerPolicy 'tools' the only guard is prompt instructions. Requires phoneNumber: transfers originate from the deployed number."),
  dtmf: z.boolean().default(false).describe("Attach the native send_dtmf tool so the assistant can press keypad digits — navigating phone trees and extension menus on outbound calls. Telnyx executes it natively (works in noTools mode too). Pair it with prompt instructions telling the assistant which extensions to use."),
  warmTransferInstructions: z.string().optional().describe('Natural-language instructions for how the assistant briefs the transfer recipient before connecting the caller. Omit for a cold transfer.'),
})
export type TelnyxConnectorOptions = z.infer<typeof TelnyxConnectorOptionsSchema>

export const TelnyxConnectorEventsSchema = FeatureEventsSchema.extend({
  started: z.tuple([z.object({
    publicUrl: z.string(),
    telnyxAssistantId: z.string(),
    port: z.number(),
  })]).describe('Emitted when the connector is fully running'),
  toolCall: z.tuple([z.string(), z.any()]).describe('Emitted when a tool is called via webhook'),
  toolError: z.tuple([z.string(), z.instanceof(Error)]).describe('Emitted when a tool call throws'),
  toolDenied: z.tuple([z.string(), z.string()]).describe('Emitted when a tool call is refused: (toolName, reason)'),
  callScreened: z.tuple([z.string()]).describe('Emitted when an unlisted caller is turned away before reaching the assistant: (callerNumber)'),
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
 * const connector = container.feature('telnyxConnector', { assistant: chief })
 * await connector.start()
 * ```
 *
 * @extends Feature
 */
export class TelnyxConnector extends Feature<TelnyxConnectorState, TelnyxConnectorOptions> {
  static override shortcut = 'features.telnyxConnector' as const
  static override stability = 'experimental' as const
  static override category = 'ai-assistants' as const
  static override stateSchema = TelnyxConnectorStateSchema
  static override optionsSchema = TelnyxConnectorOptionsSchema
  static override eventsSchema = TelnyxConnectorEventsSchema
  static { Feature.register(this, 'telnyxConnector') }

  private _log(...args: any[]) {
    if (this.options.debug) console.log(...args)
  }

  private _server: any = null
  private _tunnelProcess: any = null
  private _telnyxClient: any = null
  private _previousConnectionId: string | null = null
  private _messagingProfileId: string | null = null
  private _toolSecret: string | null = null
  private _toolSecretId: string | null = null
  private _screeningAppId: string | null = null

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

  // ── Conversation history (read API — source of truth for call history) ──────
  //
  // Telnyx AI Conversations are the canonical record of every phone call the
  // assistant has handled. Rather than reconstructing calls from webhook events
  // saved to disk, these methods read straight from the account:
  //
  //   - listConversations()       → the call list (metadata carries from/to/session)
  //   - getConversationMessages() → the transcript
  //   - getConversationInsights() → the post-call AI summary
  //   - getConversationCost()     → cost + duration + model metadata (from the CDR)
  //   - listAssistantCosts()      → batch of CDRs, indexed by conversation_id
  //   - getRecordingUrl()         → a fresh signed MP3 URL for playback

  /**
   * List recent AI conversations (phone calls) newest-first.
   *
   * Each conversation's `metadata` carries `from`, `to`, `call_session_id`,
   * `call_control_id`, and `assistant_id` — everything needed to join to
   * recordings and detail records.
   *
   * @example
   * ```ts
   * const convos = await connector.listConversations({ limit: 50 })
   * ```
   */
  async listConversations(opts: { limit?: number; assistantId?: string; order?: string } = {}) {
    const client = await this._getClient()
    const params: any = {
      limit: opts.limit ?? 50,
      order: opts.order ?? 'last_message_at.desc',
    }
    if (opts.assistantId) params['metadata->assistant_id'] = `eq.${opts.assistantId}`
    const page = await client.ai.conversations.list(params)
    return page?.data ?? []
  }

  /**
   * Retrieve a single conversation by id, or null if not found.
   */
  async getConversation(conversationId: string) {
    const client = await this._getClient()
    const resp = await client.ai.conversations.retrieve(conversationId)
    return resp?.data ?? resp ?? null
  }

  /**
   * Full transcript for a conversation, oldest message first.
   * Telnyx message `text` may contain inline `<emotion .../>` control tags —
   * callers that display transcripts should strip them.
   */
  async getConversationMessages(conversationId: string) {
    const client = await this._getClient()
    const page = await client.ai.conversations.messages.list(conversationId)
    return page?.data ?? []
  }

  /**
   * Post-call AI insights (summary) for a conversation. Returns the raw insight
   * records; the human-readable summary is `result` on each.
   */
  async getConversationInsights(conversationId: string) {
    const client = await this._getClient()
    const resp = await client.ai.conversations.retrieveConversationsInsights(conversationId)
    return resp?.data ?? []
  }

  /**
   * The `ai-voice-assistant` detail record for a single conversation — one row
   * carrying `cost`, `currency`, `duration_sec`, `billed_sec`, `llm_model`,
   * `tts_provider`, `tts_voice_id`, and `stt_model`. Returns null if no CDR has
   * been generated yet (billing can lag a completed call by a few minutes).
   */
  async getConversationCost(conversationId: string) {
    const client = await this._getClient()
    const resp = await client.detailRecords.list({
      'filter[record_type]': 'ai-voice-assistant',
      'filter[conversation_id]': conversationId,
    } as any)
    return (resp?.data ?? [])[0] ?? null
  }

  /**
   * A fresh, signed MP3 download URL for a call's recording, or null if none.
   * Telnyx signs these URLs with a short expiry, so fetch on demand rather than
   * persisting the link.
   */
  async getRecordingUrl(callSessionId: string): Promise<string | null> {
    if (!callSessionId) return null
    const client = await this._getClient()
    const resp = await client.recordings.list({ call_session_id: callSessionId } as any)
    const rec = (resp?.data ?? [])[0]
    return rec?.download_urls?.mp3 ?? null
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

  /**
   * List the inference models available to your Telnyx account. Model IDs
   * are `{source}/{model_name}` (e.g. `moonshotai/Kimi-K2.6`) — the same
   * strings the `model` option accepts.
   *
   * @example
   * ```ts
   * await connector.listModels()                     // everything
   * await connector.listModels({ filter: 'kimi' })   // just the Kimi family
   * ```
   */
  async listModels(opts: { filter?: string } = {}) {
    const client = await this._getClient()
    const resp = await client.ai.retrieveModels()
    let models: any[] = resp?.data || []
    if (opts.filter) {
      const needle = opts.filter.toLowerCase()
      models = models.filter((m: any) => (m.id || '').toLowerCase().includes(needle))
    }
    return models.map((m: any) => ({
      id: m.id,
      ownedBy: m.owned_by,
      created: m.created,
    }))
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
    this._log('[telnyx] 🎙️  Updating assistant voice_settings:', JSON.stringify(voiceSettings, null, 2))
    // Raw PATCH instead of client.ai.assistants.update(): the SDK's update
    // route has 404'd on live assistants, while PATCH /ai/assistants/{id}
    // is the verified-working path for voice_settings changes.
    const resp: any = await client.patch(`/ai/assistants/${assistantId}`, {
      body: { voice_settings: voiceSettings },
    })
    const updated = resp?.data || resp
    this._log('[telnyx] 🎙️  Assistant now has voice_settings:', JSON.stringify(updated?.voice_settings, null, 2))
    return updated
  }

  /**
   * Pronunciation dictionary to attach to the assistant voice: explicit option
   * first, then `pronunciationDictId` (or `pronunciation_dict_id`) from the
   * assistant's voice.yml.
   */
  private get _resolvedPronunciationDictId(): string | undefined {
    const voiceConfig = this.assistant?.voiceConfig
    return this.options.pronunciationDictId
      || voiceConfig?.pronunciationDictId
      || voiceConfig?.pronunciation_dict_id
      || undefined
  }

  /**
   * Make sure the deployed assistant actually carries the configured
   * pronunciation dictionary. Create can silently drop unknown fields on
   * older API versions, and reused assistants may predate the config — a
   * PATCH afterward is the verified-working attach path either way.
   */
  private async _ensurePronunciationDict(assistant: any) {
    const dictId = this._resolvedPronunciationDictId
    if (!dictId || !assistant?.id) return assistant
    if (!assistant?.voice_settings) {
      // Some responses omit voice_settings — re-fetch before deciding
      const full = await this.getAssistant(assistant.id).catch(() => null)
      if (full?.voice_settings) assistant = { ...assistant, voice_settings: full.voice_settings }
    }
    if (assistant?.voice_settings?.pronunciation_dict_id === dictId) return assistant
    if (!assistant?.voice_settings?.voice) {
      this._log(`[telnyx] 🗣️  Cannot attach pronunciation dict ${dictId}: assistant ${assistant.id} has no voice_settings.voice`)
      return assistant
    }
    this._log(`[telnyx] 🗣️  Attaching pronunciation dict ${dictId} to assistant ${assistant.id}`)
    try {
      const updated = await this.updateAssistantVoice(assistant.id, {
        ...assistant.voice_settings,
        pronunciation_dict_id: dictId,
      })
      return updated?.voice_settings ? updated : { ...assistant, voice_settings: { ...assistant.voice_settings, pronunciation_dict_id: dictId } }
    } catch (err: any) {
      this._log(`[telnyx] 🗣️  Could not attach pronunciation dict ${dictId}: ${err?.message || err}`)
      return assistant
    }
  }

  /**
   * Add or replace the native handoff tool on the deployed Telnyx assistant,
   * letting it hand the conversation to other Telnyx assistants mid-call.
   *
   * Handoff targets need Telnyx assistant IDs, which only exist once those
   * assistants are deployed — so this is a post-`start()` patch, not a
   * create-time option. Safe to call on every deploy: it replaces any
   * existing handoff tool, which also heals stale IDs after a target was
   * deleted and recreated.
   *
   * @example
   * ```ts
   * await connector.setHandoffTargets([
   *   { id: 'assistant-abc123', name: 'receptionist — greets and routes callers' },
   * ])
   * ```
   */
  async setHandoffTargets(
    targets: Array<{ id: string; name: string }>,
    voiceMode: 'unified' | 'distinct' = 'unified',
  ) {
    const assistantId = this.state.get('telnyxAssistantId')
    if (!assistantId) throw new Error('No deployed Telnyx assistant — call start() first')
    const client = await this._getClient()
    const current = await this.getAssistant(assistantId)
    const tools = (current?.tools || []).filter((t: any) => t?.type !== 'handoff')
    tools.push({
      type: 'handoff',
      handoff: {
        ai_assistants: targets.map(t => ({ id: t.id, name: t.name })),
        voice_mode: voiceMode,
      },
    })
    this._log(`[telnyx] 🤝 Setting handoff targets on ${assistantId}:`, JSON.stringify(targets))
    const resp = await client.ai.assistants.update(assistantId, { tools })
    return resp?.data || resp
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

    this._log('[telnyx] 🎙️  TTS generate:', JSON.stringify({ voice, text: text.slice(0, 60) }))
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
   * const chunks: Buffer[] = []
   * for await (const chunk of connector.streamSpeak('Hello world')) {
   *   chunks.push(chunk)
   * }
   * const audio = Buffer.concat(chunks)
   * ```
   */
  async *streamSpeak(text: string, opts: { voice?: string; voiceSettings?: any } = {}): AsyncGenerator<Buffer> {
    const client = await this._getClient()
    const voice = opts.voice || this.options.voice
    const query: any = {}
    if (voice) query.voice = voice

    const { TextToSpeechWS } = await import('telnyx/resources/text-to-speech') as any
    const ws = new TextToSpeechWS(client, query)

    this._log('[telnyx] 🎙️  TTS stream start:', JSON.stringify({ voice, text: text.slice(0, 60) }))

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

    this._log('[telnyx] 🎙️  Test TTS request:', JSON.stringify(body, null, 2))

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
      this._log('[telnyx] 🎙️  Test TTS failed:', resp.status, errText)
      return { ok: false, status: resp.status, error: errText }
    }

    const outputPath = opts.outputPath || 'docs/calls/voice-test.mp3'
    const fs = this.container.feature('fs')
    const absPath = this.container.paths.resolve(outputPath)
    const buffer = Buffer.from(await resp.arrayBuffer())
    await fs.writeFile(absPath, buffer)
    this._log(`[telnyx] 🎙️  Saved TTS output → ${absPath} (${buffer.length} bytes)`)
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
    this._log('[telnyx] 🎙️  Current voice_settings on assistant:', JSON.stringify(voice, null, 2))
    return voice
  }

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

    // Also grab messaging-specific config
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
   * Search Telnyx inventory for purchasable phone numbers.
   *
   * @example
   * ```ts
   * const telnyx = container.feature('telnyxConnector')
   * const available = await telnyx.searchNumbers({ areaCode: '312', features: ['sms', 'voice'] })
   * console.log(available.map(n => n.phone_number))
   * ```
   */
  async searchNumbers(opts: {
    /** Three-digit national destination code, e.g. '312' */
    areaCode?: string
    /** City name, e.g. 'Chicago' */
    locality?: string
    /** US state / CA province, e.g. 'IL' */
    administrativeArea?: string
    /** ISO country code; defaults to 'US' */
    countryCode?: string
    /** Required features, e.g. ['sms', 'voice'] */
    features?: Array<'sms' | 'mms' | 'voice' | 'fax' | 'emergency' | 'hd_voice' | 'international_sms' | 'local_calling'>
    /** Max results; defaults to 10 */
    limit?: number
  } = {}) {
    const client = await this._getClient()
    const resp = await client.availablePhoneNumbers.list({
      filter: {
        national_destination_code: opts.areaCode,
        locality: opts.locality,
        administrative_area: opts.administrativeArea,
        country_code: opts.countryCode ?? 'US',
        features: opts.features,
        limit: opts.limit ?? 10,
      },
    })
    return (resp.data ?? []).map((num: any) => ({
      phone_number: num.phone_number,
      features: (num.features ?? []).map((f: any) => f?.name ?? f),
      region_information: num.region_information,
      cost_information: num.cost_information,
      quickship: num.quickship,
      reservable: num.reservable,
      best_effort: num.best_effort,
    }))
  }

  /**
   * Purchase a phone number from Telnyx inventory. Creates a number order and,
   * by default, polls until Telnyx marks it complete (usually seconds for US
   * numbers). Pass wait: false to return the pending order immediately.
   *
   * @example
   * ```ts
   * const telnyx = container.feature('telnyxConnector')
   * const [candidate] = await telnyx.searchNumbers({ areaCode: '312', limit: 1 })
   * const order = await telnyx.purchaseNumber(candidate.phone_number)
   * console.log(order.status) // 'success'
   * ```
   */
  async purchaseNumber(phoneNumber: string, opts: {
    /** Wire the purchased number to this connection */
    connectionId?: string
    /** Attach this messaging profile to the purchased number */
    messagingProfileId?: string
    /** Free-form reference stored on the order */
    customerReference?: string
    /** Poll the order until it leaves 'pending'; defaults to true */
    wait?: boolean
    /** Max time to poll before giving up, in ms; defaults to 30000 */
    timeout?: number
  } = {}) {
    const client = await this._getClient()
    const resp = await client.numberOrders.create({
      phone_numbers: [{ phone_number: phoneNumber }],
      connection_id: opts.connectionId,
      messaging_profile_id: opts.messagingProfileId,
      customer_reference: opts.customerReference,
    })
    let order: any = (resp as any)?.data ?? resp
    this._log(`[telnyx] 🛒 Number order ${order?.id} created for ${phoneNumber} (status: ${order?.status})`)

    if (opts.wait !== false && order?.id && order?.status === 'pending') {
      const deadline = Date.now() + (opts.timeout ?? 30_000)
      while (order.status === 'pending' && Date.now() < deadline) {
        await this.container.utils.sleep(1000)
        const check = await client.numberOrders.retrieve(order.id)
        order = (check as any)?.data ?? check
      }
      this._log(`[telnyx] 🛒 Number order ${order.id} status: ${order.status}`)
    }

    return {
      id: order?.id,
      status: order?.status,
      phone_numbers: order?.phone_numbers,
      requirements_met: order?.requirements_met,
      connection_id: order?.connection_id,
      messaging_profile_id: order?.messaging_profile_id,
      created_at: order?.created_at,
    }
  }

  /**
   * Get the current status of a number order by ID.
   */
  async getNumberOrder(orderId: string) {
    const client = await this._getClient()
    const resp = await client.numberOrders.retrieve(orderId)
    return (resp as any)?.data ?? resp
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
   * Place an outbound call from the assistant to a phone number, with an
   * optional per-call greeting and purpose delivered as dynamic variables.
   * Deployed assistants template their greeting as `{{greeting_line}}` and
   * carry a `{{call_context}}` section in their instructions, so both can be
   * set per call without touching the deployment.
   *
   * Works standalone (assistant: null) as long as the `from` number is wired
   * to a Telnyx AI assistant — the assistant is resolved from the number.
   *
   * @example
   * ```ts
   * await connector.dial('+13125550000', {
   *   greeting: 'Hey Jon, calling with your morning brief.',
   *   context: 'You called Jon to deliver his morning brief. Keep it under two minutes.',
   *   machineDetection: 'DetectMessageEnd',
   * })
   * ```
   */
  async dial(to: string, opts: {
    /** Calling number in E.164; defaults to options.phoneNumber. */
    from?: string
    /** First thing the assistant says on answer. */
    greeting?: string
    /** Why the assistant is calling — injected into its instructions. */
    context?: string
    /** Extra dynamic variables for custom templates. */
    variables?: Record<string, string>
    /** Telnyx assistant ID; defaults to state, then the number's wiring. */
    assistantId?: string
    /**
     * Answering-machine detection. 'Enable' classifies human vs machine as
     * soon as possible; 'DetectMessageEnd' additionally waits for the
     * voicemail beep, so the assistant starts talking after it and the
     * greeting lands on the recording instead of being cut off.
     */
    machineDetection?: 'Enable' | 'Disable' | 'DetectMessageEnd'
    /** AMD engine: 'Premium' (ML-based) or 'Regular'. */
    detectionMode?: 'Premium' | 'Regular'
    /** Overall AMD window in milliseconds. */
    machineDetectionTimeout?: number
    /** Seconds to wait for an answer before canceling (5–120, Telnyx default 30). */
    timeoutSeconds?: number
  } = {}) {
    if (!/^\+\d{10,15}$/.test(to)) {
      throw new Error(`dial() needs an E.164 number, got "${to}"`)
    }
    const from = opts.from || this.options.phoneNumber
    if (!from) throw new Error('dial() needs opts.from or options.phoneNumber')

    const record = await this.getPhoneNumber(from)
    if (!record) throw new Error(`Phone number ${from} not found on this Telnyx account`)

    let assistantId = opts.assistantId || this.state.get('telnyxAssistantId')
    if (!assistantId) {
      // TeXML apps auto-created by assistants are named "ai-assistant-<uuid>"
      const connName = String(record.connection_name || '')
      if (connName.startsWith('ai-assistant-')) assistantId = connName.slice('ai-'.length)
    }
    if (!assistantId) {
      throw new Error(`Cannot resolve a Telnyx assistant for ${from} — deploy one or pass opts.assistantId`)
    }

    const dynamicVariables: Record<string, string> = { ...(opts.variables || {}) }
    if (opts.greeting) dynamicVariables.greeting_line = opts.greeting
    if (opts.context) dynamicVariables.call_context = opts.context

    const params: any = { AIAssistantId: assistantId, To: to, From: from }
    if (Object.keys(dynamicVariables).length > 0) {
      params.AIAssistantDynamicVariables = dynamicVariables
    }
    if (opts.machineDetection) params.MachineDetection = opts.machineDetection
    if (opts.detectionMode) params.DetectionMode = opts.detectionMode
    if (opts.machineDetectionTimeout) params.MachineDetectionTimeout = opts.machineDetectionTimeout
    if (opts.timeoutSeconds) params.timeout_seconds = opts.timeoutSeconds

    this._log('[telnyx] 📞 Dialing:', JSON.stringify({ to, from, assistantId, dynamicVariables }))
    const client = await this._getClient()
    const resp = await client.texml.initiateAICall(record.connection_id, params)
    const data = resp?.data || resp
    this._log('[telnyx] 📞 Call initiated:', JSON.stringify(data))
    return data
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

    // Tools contributed via tools.ts `use` entries (e.g. feature.toTools())
    // only materialize on assistant.start(). Mirroring an unstarted assistant
    // would silently drop them from the Telnyx deployment. start() is
    // idempotent, so this is safe when the caller already started it.
    if (typeof this.assistant?.start === 'function') {
      await this.assistant.start()
    }

    let publicUrl: string | null = null
    let port: number | null = null

    if (this.options.noTools) {
      // No-tools path: just create the Telnyx assistant directly, no server or tunnel
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

    // Full path: local server + tunnel + tools
    port = await this._findAvailablePort(this.options.port)
    // A pre-configured domain means a tunnel ingress points at the configured
    // port. Drifting to the next free port would silently strand it — the
    // tunnel keeps forwarding to a port nothing listens on. Fail loud instead.
    if (this.options.domain && port !== this.options.port) {
      throw new Error(
        `Port ${this.options.port} is busy — the tunnel ingress for ${this.options.domain} points at it, `
        + `so falling back to :${port} would break webhook delivery. Free the port or update both the phone config and tunnel service.`,
      )
    }
    const server = this.container.server('express', { port, cors: true })

    this._mountToolEndpoints(server)
    this._mountCallEventsEndpoint(server)
    this._mountInboundSmsEndpoint(server)
    this._mountVoiceScreeningEndpoint(server)

    await server.start()
    this._server = server

    if (this.options.domain) {
      // Pre-configured cloudflared tunnel — just use the domain directly
      publicUrl = `https://${this.options.domain}`
      this._log(`[telnyx] Using pre-configured domain: ${publicUrl}`)
      await this._waitForTunnelReady(publicUrl)
    } else {
      // Ephemeral cloudflared tunnel
      publicUrl = await this._startTunnel(port)
      await this._waitForTunnelReady(publicUrl)
    }

    await this._ensureToolSecret()
    await this._ensureMessagingProfile(publicUrl)
    const telnyxAssistant = await this._createTelnyxAssistant(publicUrl)

    // The screening webhook reads the assistant id from state, so it must be
    // set before the number is wired and calls can start arriving.
    this.state.set('publicUrl', publicUrl)
    this.state.set('telnyxAssistantId', telnyxAssistant.id)

    if (this.options.phoneNumber) {
      await this._wirePhoneNumber(telnyxAssistant, publicUrl)
    }

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
    // Supervised deployments restart with the loop: leave the Telnyx side
    // (assistant, screening app, wiring, secret) in place so the next start()
    // reuses it via the config fingerprint. Only local resources die.
    if (this.options.persist) {
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
      return
    }

    const phoneNumberId = this.state.get('phoneNumberId')
    if (phoneNumberId && this._telnyxClient) {
      try {
        // Restore voice connection to previous value
        if (this._previousConnectionId) {
          await this._telnyxClient.phoneNumbers.update(phoneNumberId, {
            connection_id: this._previousConnectionId,
          })
        }
        // Keep the persistent messaging profile on the phone number —
        // it survives across deploys and is named after the assistant.
        // Only clear it if we don't have a persistent profile.
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

    if (this._screeningAppId && this._telnyxClient) {
      try {
        await this._telnyxClient.texmlApplications.delete(this._screeningAppId)
      } catch {}
      this._screeningAppId = null
    }

    await this._deleteToolSecret()

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

  /**
   * Mount a POST endpoint for each tool on the assistant.
   */
  private _mountToolEndpoints(server: any) {
    const tools = this.assistant.tools

    for (const [name, tool] of Object.entries(tools) as [string, any][]) {
      server.app.post(`/tools/${name}`, async (req: any, res: any) => {
        // Shared secret: only Telnyx (holding our integration secret) may call
        // tool endpoints. Blocks anyone who discovers the public tunnel URL.
        if (this._toolSecret && req.headers['authorization'] !== `Bearer ${this._toolSecret}`) {
          this.emit('toolDenied', name, 'bad or missing tool secret')
          return res.status(401).json({ error: 'unauthorized' })
        }

        // Caller allowlist: identity comes from a Telnyx-injected header, so a
        // caller can't prompt the assistant into bypassing it. Return a spoken
        // refusal (not an error) so the assistant relays it gracefully.
        const allowed = this.options.allowedCallers
        const caller = String(req.headers['x-telnyx-caller'] || '')
        if (allowed?.length && !allowed.includes(caller)) {
          this.emit('toolDenied', name, `caller ${caller || 'unknown'} not in allowedCallers`)
          return res.json({ result: 'This action is restricted and not available for this caller. Do not retry it.' })
        }

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

    // health check
    server.app.get('/health', (_req: any, res: any) => {
      res.json({
        status: 'ok',
        assistant: this.assistantName,
        tools: Object.keys(tools),
      })
    })
  }

  /**
   * Mount the inbound-call screening webhook. When allowedCallers is set, the
   * phone number is wired to our own TeXML app instead of the assistant's, and
   * this endpoint decides per call: unlisted callers hear rejectMessage and the
   * call ends without the assistant ever answering; allowed callers are handed
   * off to the AI assistant via <Connect><AIAssistant>.
   */
  private _mountVoiceScreeningEndpoint(server: any) {
    server.app.post('/voice/inbound', (req: any, res: any) => {
      const from = String(req.body?.From || '')
      const allowed = this.options.allowedCallers
      const assistantId = this.state.get('telnyxAssistantId')

      res.type('text/xml')

      if (allowed?.length && !allowed.includes(from)) {
        this._log(`[telnyx] 🚫 Screened call from ${from || 'unknown'}`)
        this.emit('callScreened', from)
        const message = this.options.rejectMessage
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Say>${message}</Say><Hangup/></Response>`)
      }

      this._log(`[telnyx] 📞 Screening passed for ${from || 'unknown'} → assistant ${assistantId}`)
      res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Connect><AIAssistant id="${assistantId}"/></Connect></Response>`)
    })
  }

  /**
   * Mount a POST endpoint to receive call event webhooks (status callbacks from TeXML app).
   */
  private _mountCallEventsEndpoint(server: any) {
    server.app.post('/call/events', async (req: any, res: any) => {
      try {
        const body = req.body
        const status = body?.CallStatus || body?.DialCallStatus || 'unknown'
        const callSid = body?.CallSid || 'unknown'

        this._log(`[telnyx] 📞 Call event: ${status} (${callSid})`)

        // Parse insights if present
        let insights: string | null = null
        try {
          const parsed = JSON.parse(body?.ConversationInsights || '[]')
          insights = parsed?.[0]?.conversation_insights?.[0]?.result || null
        } catch {}

        if (insights) {
          this._log(`[telnyx] 📞 Summary: ${insights.slice(0, 200)}${insights.length > 200 ? '...' : ''}`)
        }

        // Parse cost
        let cost: any = null
        try { cost = JSON.parse(body?.Cost || '{}') } catch {}
        if (cost?.total) {
          this._log(`[telnyx] 📞 Cost: $${cost.total}`)
        }

        // Nothing to persist — the Telnyx AI Conversations API is the source of
        // truth for call history (see features/call-history.ts). This endpoint
        // now exists only to surface progress in the logs above.

        res.status(200).json({ status: 'ok' })
      } catch (err: any) {
        console.error('[telnyx] Call event error:', err.message)
        res.status(200).json({ status: 'ok' })
      }
    })
  }

  /**
   * Mount a POST endpoint to handle inbound SMS via the Telnyx AI assistant's chat API.
   * Receives the inbound message, chats with the AI assistant to get a reply,
   * then sends the reply back as an SMS.
   */
  private _mountInboundSmsEndpoint(server: any) {
    // Per-phone-number assistant instances for threaded SMS conversations
    const assistantsByPhone = new Map<string, any>()

    server.app.post('/messaging/inbound', async (req: any, res: any) => {
      // Respond immediately so Telnyx doesn't retry
      res.status(200).json({ status: 'ok' })

      try {
        const payload = req.body?.data?.payload || req.body
        const eventType = req.body?.data?.event_type || ''
        const direction = payload?.direction || ''

        // Only handle inbound messages
        if (!eventType.includes('inbound') && direction !== 'inbound') return

        const from = payload?.from?.phone_number || payload?.from || ''
        const to = (payload?.to?.[0]?.phone_number) || payload?.to || ''
        const text = payload?.text || ''
        if (!text || !from) return

        this._log(`[telnyx] 💬 Inbound SMS from ${from}: "${text}"`)

        // SMS tools run locally (not via Telnyx webhooks), so the caller
        // allowlist is enforced here. 'screen': unlisted senders get
        // rejectMessage back and never reach the assistant. 'tools': they can
        // converse with a tool-less instance.
        const allowed = this.options.allowedCallers
        const callerAllowed = !allowed?.length || allowed.includes(from)
        if (!callerAllowed && this.options.callerPolicy === 'screen') {
          this._log(`[telnyx] 🚫 Screened SMS from ${from}`)
          this.emit('callScreened', from)
          await this._telnyxClient.messages.send({
            from: to,
            to: from,
            text: this.options.rejectMessage,
            messaging_profile_id: this._messagingProfileId,
          })
          return
        }

        // Get or create a local assistant instance for this phone number.
        let smsAssistant = assistantsByPhone.get(from)
        if (!smsAssistant) {
          const mgr = this.container.feature('assistantsManager')
          smsAssistant = mgr.create(this.assistantName, {
            historyMode: 'lifecycle',
            ...(callerAllowed ? {} : { allowTools: [] }),
          })
          await smsAssistant.start()
          assistantsByPhone.set(from, smsAssistant)
          this._log(`[telnyx] 💬 Created local assistant for ${from}`)
        }

        // Ask the local assistant
        const reply = await smsAssistant.ask(text)

        if (!reply) {
          this._log('[telnyx] 💬 Assistant returned empty reply')
          return
        }

        this._log(`[telnyx] 💬 Reply to ${from}: "${reply.slice(0, 120)}${reply.length > 120 ? '...' : ''}"`)

        // Send the reply via Telnyx messaging
        this._log(`[telnyx] 💬 Sending SMS: from=${to}, to=${from}, profile=${this._messagingProfileId}`)
        const sendResult = await this._telnyxClient.messages.send({
          from: to,
          to: from,
          text: reply,
          messaging_profile_id: this._messagingProfileId,
        })
        const sendData = sendResult?.data || sendResult
        this._log(`[telnyx] 💬 SMS send response:`, JSON.stringify({
          id: sendData?.id,
          status: sendData?.to?.[0]?.status,
          from: sendData?.from?.phone_number,
          to: sendData?.to?.[0]?.phone_number,
          errors: sendData?.errors,
        }, null, 2))
        this._log(`[telnyx] 💬 SMS sent to ${from}`)
      } catch (err: any) {
        console.error('[telnyx] 💬 SMS handler error:', err.message)
      }
    })
  }

  /**
   * Check if a port is available by attempting to listen on it briefly.
   * If the preferred port is taken, scan upward until a free one is found.
   */
  private async _findAvailablePort(preferred: number): Promise<number> {
    return this.container.feature('networking').findOpenPort(preferred)
  }

  /**
   * Wait until the public tunnel URL responds to /health before handing it
   * off to Telnyx. Telnyx validates webhook URLs by pinging them, and
   * cloudflared edges can take a few seconds to propagate after the URL is
   * announced.
   */
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
   * Each invocation gets a fresh ephemeral hostname — no config or login required,
   * and concurrent deploys don't collide.
   */
  private async _startTunnel(port: number): Promise<string> {
    const proc = this.container.feature('proc')
    const os = this.container.feature('os')
    const emptyConfigPath = os.isWindows ? 'NUL' : '/dev/null'

    const child = proc.spawn('cloudflared', [
      'tunnel',
      '--config', emptyConfigPath,
      '--no-autoupdate',
      '--url', `http://localhost:${port}`,
    ])
    this._tunnelProcess = child
    this._log(`[telnyx] cloudflared tunneling :${port}`)

    // We need both the public URL (logged early in a banner) AND a sign that
    // the edge connection is actually live ("Registered tunnel connection").
    // Resolving on URL alone hands Telnyx a hostname that won't be routable
    // for ~30-60s, so it rejects the webhook.
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
   * Integration secret identifier for this assistant's tool webhook auth.
   */
  private get _toolSecretIdentifier() {
    // Telnyx only accepts lowercase letters, numbers, dashes, underscores here
    const slug = this.assistantName
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
    return `luca_tool_secret_${slug}`
  }

  private _telnyxHeaders() {
    return {
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Register a per-deploy shared secret as a Telnyx integration secret.
   * Telnyx injects it into tool webhook Authorization headers via mustache
   * templating; the local server rejects requests that don't carry it.
   * Secret values can't be read back from Telnyx, so any stale secret with
   * our identifier is deleted and replaced.
   */
  private async _ensureToolSecret() {
    this._toolSecret = this.options.toolSecret || globalThis.crypto.randomUUID()

    const listResp = await fetch('https://api.telnyx.com/v2/integration_secrets?page[size]=250', {
      headers: this._telnyxHeaders(),
    })
    const listBody: any = await listResp.json().catch(() => ({}))
    const stale = (listBody?.data || []).filter((s: any) => s.identifier === this._toolSecretIdentifier)
    for (const s of stale) {
      await fetch(`https://api.telnyx.com/v2/integration_secrets/${s.id}`, {
        method: 'DELETE',
        headers: this._telnyxHeaders(),
      })
    }

    const createResp = await fetch('https://api.telnyx.com/v2/integration_secrets', {
      method: 'POST',
      headers: this._telnyxHeaders(),
      body: JSON.stringify({
        identifier: this._toolSecretIdentifier,
        type: 'bearer',
        token: this._toolSecret,
      }),
    })
    if (!createResp.ok) {
      const text = await createResp.text().catch(() => '')
      throw new Error(`Failed to register tool secret with Telnyx (${createResp.status}): ${text}`)
    }
    const created: any = await createResp.json()
    this._toolSecretId = created?.data?.id || null
    this._log(`[telnyx] 🔐 Tool secret registered as ${this._toolSecretIdentifier}`)
  }

  /** Short stable SHA-256 of a config object, for change detection. */
  private async _configHash(input: any): Promise<string> {
    const data = new TextEncoder().encode(JSON.stringify(input))
    const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  }

  private async _deleteToolSecret() {
    if (!this._toolSecretId) return
    try {
      await fetch(`https://api.telnyx.com/v2/integration_secrets/${this._toolSecretId}`, {
        method: 'DELETE',
        headers: this._telnyxHeaders(),
      })
    } catch {}
    this._toolSecretId = null
    this._toolSecret = null
  }

  /**
   * Create a Telnyx assistant that mirrors the local assistant's prompt and tools.
   */
  private async _createTelnyxAssistant(publicUrl: string | null) {
    const webhookTools = []

    if (publicUrl) {
      // Telnyx fills these headers, not the model: the integration secret via
      // mustache templating, the caller identity via built-in dynamic
      // variables. A caller can't talk the assistant into forging them.
      const authHeaders = [
        { name: 'Authorization', value: `Bearer {{#integration_secret}}${this._toolSecretIdentifier}{{/integration_secret}}` },
        { name: 'X-Telnyx-Caller', value: '{{telnyx_end_user_target}}' },
        { name: 'X-Telnyx-Caller-Verified', value: '{{telnyx_end_user_target_verified}}' },
      ]

      const tools = this.assistant.tools
      for (const [name, tool] of Object.entries(tools) as [string, any][]) {
        webhookTools.push({
          type: 'webhook' as const,
          webhook: {
            name,
            description: tool.description || name,
            url: `${publicUrl}/tools/${name}`,
            method: 'POST' as const,
            headers: authHeaders,
            body_parameters: tool.parameters || { type: 'object', properties: {} },
            timeout_ms: 10000,
          },
        })
      }

    }

    // Telnyx executes this natively — works even when our tool server is down.
    const nativeTools: any[] = [{
      type: 'hangup' as const,
      hangup: {
        description: 'End the current phone call. Use this when the conversation is complete or the caller should be disconnected.',
      },
    }]

    if (this.options.transferTargets?.length) {
      if (!this.options.phoneNumber) {
        throw new Error('transferTargets requires phoneNumber — Telnyx transfers must originate from an owned number with an outbound voice profile')
      }
      const transfer: any = {
        from: this.options.phoneNumber,
        targets: this.options.transferTargets,
      }
      if (this.options.warmTransferInstructions) {
        transfer.warm_transfer_instructions = this.options.warmTransferInstructions
      }
      nativeTools.push({ type: 'transfer' as const, transfer })
    }

    if (this.options.dtmf) {
      nativeTools.push({ type: 'send_dtmf' as const, send_dtmf: {} })
    }

    // Greeting and instructions are templated with dynamic variables so
    // dial() can customize them per outbound call. The defaults reproduce
    // the plain inbound behavior exactly.
    const params: any = {
      name: `luca-${this.assistantName}`,
      instructions: this.assistant.effectiveSystemPrompt
        + '\n\n## Outbound Call Context\n\n'
        + 'If the section below is non-empty, YOU placed this call for the stated reason. '
        + 'Lead with that purpose and stay on it.\n\n{{call_context}}',
      model: this.options.model,
      enabled_features: ['telephony', 'messaging'],
      greeting: '{{greeting_line}}',
      dynamic_variables: {
        greeting_line: this.options.greeting || '',
        call_context: '',
      },
    }

    // Resolve voice settings: explicit options override, then fall back to assistant's voice.yml
    const voiceConfig = this.assistant.voiceConfig
    const isElevenLabs = this.options.ttsProvider === 'elevenlabs' || voiceConfig?.provider === 'elevenlabs'
    const voiceId = this.options.voice || voiceConfig?.voiceId
    const apiKeyRef = this.options.apiKeyRef

    this._log('[telnyx] 🎙️  Voice resolution:', JSON.stringify({
      sources: {
        'options.voice': this.options.voice,
        'options.ttsProvider': this.options.ttsProvider,
        'options.apiKeyRef': this.options.apiKeyRef,
        'assistant.voiceConfig': voiceConfig,
      },
      resolved: {
        voiceId,
        isElevenLabs,
        apiKeyRef,
      },
    }, null, 2))

    if (voiceId) {
      // Telnyx requires provider-prefixed voice strings: "ElevenLabs.<model>.<voice_id>"
      // or "Telnyx.<model>.<voice_id>". If the caller passed a raw UUID with provider=elevenlabs,
      // prefix it here using modelId from voice.yml (defaulting to eleven_v3).
      let resolvedVoice = voiceId
      if (isElevenLabs && !/^ElevenLabs\./i.test(voiceId)) {
        // Telnyx expects "ElevenLabs.<voice_id>" (Default model) or
        // "ElevenLabs.<model_id>.<voice_id>" for a specific model. Only the
        // model-less form populates the UI dropdown correctly. Include the
        // model segment only if explicitly provided and known-supported.
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
      const pronunciationDictId = this._resolvedPronunciationDictId
      if (pronunciationDictId) {
        voiceSettings.pronunciation_dict_id = pronunciationDictId
      }
      params.voice_settings = voiceSettings
      this._log('[telnyx] 🎙️  Sending voice_settings:', JSON.stringify(voiceSettings, null, 2))
      if (isElevenLabs && voiceConfig?.voiceSettings) {
        const unsupported = Object.keys(voiceConfig.voiceSettings).filter(k => k !== 'speed')
        if (unsupported.length) {
          this._log(`[telnyx] 🎙️  Note: voice.yml tuning params ${unsupported.join(', ')} are not supported on ai.assistants.create — only "speed" maps to voice_speed. Tune these in the ElevenLabs voice itself.`)
        }
      }
    } else {
      this._log('[telnyx] 🎙️  No voiceId resolved — using Telnyx default voice')
      if (this._resolvedPronunciationDictId) {
        this._log('[telnyx] 🗣️  pronunciationDictId is set but no voice is configured — Telnyx requires voice_settings.voice, so the dictionary cannot be attached. Set a voice.')
      }
    }

    // Use our persistent messaging profile instead of letting the assistant auto-create one
    if (this._messagingProfileId) {
      params.messaging_settings = {
        default_messaging_profile_id: this._messagingProfileId,
      }
    }

    params.tools = [...webhookTools, ...nativeTools]

    // Fingerprint everything we would send (tool URLs include the public URL,
    // so an ephemeral-tunnel deploy always differs) plus the wiring inputs.
    // A same-name assistant carrying this fingerprint is byte-for-byte what we
    // would create — reuse it instead of churning the Telnyx account.
    const fingerprint = await this._configHash({
      params,
      phoneNumber: this.options.phoneNumber || null,
      screening: !!(this.options.allowedCallers?.length && this.options.callerPolicy === 'screen'),
    })
    params.description = `luca-config:${fingerprint}`

    let existingMatch: any = null
    const staleIds: string[] = []
    try {
      const existing = await this._telnyxClient.ai.assistants.list()
      for (const candidate of (existing?.data || existing || [])) {
        if (candidate?.name !== params.name || !candidate?.id) continue
        if (!existingMatch && candidate?.description === params.description) {
          existingMatch = candidate
        } else {
          staleIds.push(candidate.id)
        }
      }
    } catch {}

    // Stale same-name assistants come from unclean exits (crash, SIGKILL,
    // process.exit racing async cleanup) or config changes — always ours.
    for (const id of staleIds) {
      this._log(`[telnyx] 🧹 Deleting stale assistant ${id} (${params.name})`)
      await this._telnyxClient.ai.assistants.delete(id).catch(() => {})
    }

    if (existingMatch) {
      this._log(`[telnyx] ♻️  Reusing assistant ${existingMatch.id} (config unchanged: ${fingerprint})`)
      const full = await this._telnyxClient.ai.assistants.retrieve(existingMatch.id)
      return await this._ensurePronunciationDict(full?.data || full)
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

    // Update the auto-created TeXML app's status callback so we get call events
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

    return await this._ensurePronunciationDict(result)
  }

  /**
   * Find or create a single persistent messaging profile named after the assistant.
   * Sets webhook_url to our inbound SMS handler so we can route messages through
   * the Telnyx AI assistant's chat API.
   */
  private async _ensureMessagingProfile(publicUrl: string | null): Promise<string> {
    const client = this._telnyxClient
    const profileName = `luca-${this.assistantName}`
    // Don't set a webhook URL — let the Telnyx AI assistant handle messaging
    // natively on their network. Manual messages.send() gets carrier-filtered (10DLC).
    const webhookUrl = ''

    // Search for an existing profile with this name
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
      webhook_url: webhookUrl,
      whitelisted_destinations: ['US'],
    })
    const profileId = created?.data?.id || created?.id
    this._log(`[telnyx] Created messaging profile "${profileName}" (${profileId})`)
    this._messagingProfileId = profileId
    return profileId
  }

  /**
   * Wire a phone number to the assistant's auto-created TeXML app and
   * the persistent messaging profile.
   * Saves the previous connection_id so stop() can restore it.
   */
  private async _wirePhoneNumber(telnyxAssistant: any, publicUrl: string | null = null) {
    const phoneNumber = this.options.phoneNumber!
    const client = this._telnyxClient

    // Find the phone number by its E.164 value
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

    // Save previous connection so we can restore on teardown
    this._previousConnectionId = phoneRecord.connection_id || null

    this.state.set('phoneNumberId', phoneRecord.id)

    // The assistant auto-creates a TeXML app when telephony is enabled
    const texmlAppId = telnyxAssistant.telephony_settings?.default_texml_app_id
    if (!texmlAppId) {
      throw new Error('Telnyx assistant did not create a TeXML app — is telephony enabled?')
    }

    // With allowedCallers, the number points at our screening TeXML app, not
    // the assistant's — unlisted callers are turned away before it answers.
    let voiceConnectionId = texmlAppId
    if (this.options.allowedCallers?.length && this.options.callerPolicy === 'screen') {
      if (publicUrl) {
        const friendlyName = `luca-screen-${this.assistantName}`
        const voiceUrl = `${publicUrl}/voice/inbound`

        // Reuse a screening app left by a previous (persist: true) deploy
        let app: any = null
        try {
          const resp = await client.texmlApplications.list()
          const items = resp?.data || resp
          if (Array.isArray(items)) {
            app = items.find((candidate: any) => candidate?.friendly_name === friendlyName) || null
          }
        } catch {}

        if (app && app.voice_url !== voiceUrl) {
          await client.texmlApplications.update(app.id, { voice_url: voiceUrl, voice_method: 'post' })
          this._log('[telnyx] 🚧 Updated screening app voice_url:', app.id)
        }
        if (!app) {
          const created = await client.texmlApplications.create({
            friendly_name: friendlyName,
            voice_url: voiceUrl,
            voice_method: 'post',
          })
          app = created?.data || created
        }
        this._screeningAppId = app?.id || null
        voiceConnectionId = this._screeningAppId || texmlAppId
        this._log('[telnyx] 🚧 Caller screening app:', this._screeningAppId)
      } else {
        console.warn('[telnyx] WARNING: allowedCallers is set but there is no public URL (noTools mode) — calls will NOT be screened')
      }
    }

    if (String(phoneRecord.connection_id || '') === String(voiceConnectionId)) {
      this._log('[telnyx] Number already wired to', voiceConnectionId, '— skipping update')
      this._previousConnectionId = null
    } else {
      this._log('[telnyx] Wiring voice connection_id:', voiceConnectionId)
      await client.phoneNumbers.update(phoneRecord.id, {
        connection_id: voiceConnectionId,
      })
    }

    // Wire the persistent messaging profile
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

export default TelnyxConnector
