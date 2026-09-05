import { Feature } from '../feature'
import { z } from 'zod'
import { FeatureStateSchema } from '../../schemas/base'
import OpenAI from 'openai'

declare module 'luca/feature' {
  interface AvailableFeatures {
    modelProviders: typeof ModelProviders
  }
}

export type ModelProviderApiMode =
  | 'openai-responses'
  | 'openai-chat-completions'
  | 'anthropic-messages'
  | 'claude-session'
  | string

export type ModelProviderAuth = 'apiKey' | 'codex' | 'claudeSessionController' | 'none' | string

export interface ModelProviderProfile {
  id: string
  label?: string
  apiMode: ModelProviderApiMode
  auth: ModelProviderAuth
  baseURL?: string
  apiKey?: string
  apiKeyEnv?: string
  defaultModel?: string
  headers?: Record<string, string>
  providerOptions?: Record<string, any>
  capabilities?: Record<string, any>
}

export interface ModelProviderSummary {
  id: string
  label?: string
  apiMode: ModelProviderApiMode
  auth: ModelProviderAuth
  defaultModel?: string
  baseURL?: string
  hasApiKey: boolean
  apiKeyEnv?: string
  transportAvailable: boolean
}

export interface ModelProviderInlineInput {
  id?: string
  preset?: string
  baseURL: string
  model?: string
  apiKey?: string
  apiKeyEnv?: string
  headers?: Record<string, string>
  auth?: 'apiKey' | 'none'
  apiMode?: ModelProviderApiMode
}

export type ModelProviderInput = string | ModelProviderProfile | ModelProviderInlineInput

/** Options for `registerLocal` beyond the required baseURL and default model. */
export interface LocalProviderOptions {
  /** Human-friendly label. Defaults to the profile id. */
  label?: string
  /** API key value. When set (or apiKeyEnv is), auth defaults to 'apiKey'. */
  apiKey?: string
  /** Env var name to read the API key from at resolve() time. */
  apiKeyEnv?: string
  /** Extra request headers to send to the endpoint. */
  headers?: Record<string, string>
  /** Override the wire dialect. Defaults to 'openai-chat-completions'. */
  apiMode?: ModelProviderApiMode
  /** Force auth mode. Defaults to 'apiKey' when a key is supplied, else 'none'. */
  auth?: ModelProviderAuth
}

/**
 * Ports commonly used by local OpenAI-compatible LLM servers, probed by
 * `discover()`. The hint is a human-readable guess at what usually listens there.
 */
export const KNOWN_LLM_PORTS: Array<{ port: number; hint: string }> = [
  { port: 1234, hint: 'LM Studio' },
  { port: 11434, hint: 'Ollama' },
  { port: 8080, hint: 'llama.cpp llama-server' },
  { port: 8000, hint: 'vLLM' },
  { port: 8143, hint: 'luca local llama-server' },
  { port: 8888, hint: 'OpenAI-compatible server' },
  { port: 5000, hint: 'text-generation-webui' },
  { port: 4891, hint: 'GPT4All' },
]

/** A live OpenAI-compatible LLM server found by `discover()`. */
export interface DiscoveredModelServer {
  /** OpenAI-compatible base URL, e.g. http://127.0.0.1:1234/v1 */
  baseURL: string
  /** Host or IP the server was reached at. */
  host: string
  port: number
  /** Where the host came from: the local machine or a tailscale peer. */
  source: 'localhost' | 'tailscale'
  /** Tailscale node hostname, when the host is a tailscale peer. */
  hostname?: string
  /** Best guess at which server usually listens on this port. */
  hint?: string
  /** Model ids reported by GET /v1/models. */
  models: string[]
  /** Round-trip time of the /v1/models probe. */
  latencyMs: number
  /** Provider profile id serving this baseURL — an existing profile that matched, or the one created by `register: true`. */
  profileId?: string
}

export const ModelProvidersStateSchema = FeatureStateSchema.extend({
  discoveredServers: z.array(z.object({
    baseURL: z.string(),
    host: z.string(),
    port: z.number(),
    source: z.enum(['localhost', 'tailscale']),
    hostname: z.string().optional(),
    hint: z.string().optional(),
    models: z.array(z.string()),
    latencyMs: z.number(),
    profileId: z.string().optional(),
  })).default([]).describe('Servers from the most recently completed discovery'),
  discoveryKey: z.string().optional().describe('Scan options identifying the cached discovery'),
  discoveredAt: z.number().optional().describe('Time of the cached scan in milliseconds since epoch'),
})

export type ModelProvidersState = z.infer<typeof ModelProvidersStateSchema>

/** Options for `discover()`. */
export interface ModelProviderDiscoverOptions {
  /** Ports to probe on every host. Defaults to KNOWN_LLM_PORTS. */
  ports?: number[]
  /** Extra hosts to probe in addition to localhost (IPs or hostnames). */
  hosts?: string[]
  /** Probe localhost. Default true. */
  localhost?: boolean
  /** Look for online tailscale peers and probe them too. Default true; silently skipped when tailscale isn't installed or running. */
  tailscale?: boolean
  /** Per-probe timeout in milliseconds. Default 1500. */
  timeoutMs?: number
  /** Register each discovered server as a provider profile (via registerLocal) unless one with the same baseURL already exists. Default false. */
  register?: boolean
  /** Bypass cached results and scan again. Concurrent scans with the same options are shared. */
  refresh?: boolean
  /** Injectable fetch used for probes — for tests. Defaults to global fetch. */
  probe?: (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<any> }>
}

export interface ModelProviderResolveOptions {
  provider?: ModelProviderInput
  model?: string
  providerOptions?: Record<string, any>
}

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | string
  content: any
  name?: string
  tool_call_id?: string
}

export interface ModelToolCall {
  id?: string
  name: string
  arguments: Record<string, any>
  /** The raw, unparsed arguments string from the model — preserved so callers can surface JSON parse errors themselves. */
  rawArguments?: string
}

export interface ModelTool {
  type?: 'function'
  function: {
    name: string
    description?: string
    parameters?: Record<string, any>
  }
}

export interface ModelRequest {
  model?: string
  messages: ModelMessage[]
  /** Additional instructions for this request only; callers need not persist them as a message. */
  instructions?: string
  tools?: ModelTool[]
  temperature?: number
  maxTokens?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  /** OpenAI structured-output config ({ name, schema, strict }) — mapped to response_format / text.format by transports that support it. */
  responseFormat?: { name: string; schema: Record<string, any>; strict: true }
  /** Abort signal forwarded to the underlying network request. */
  signal?: AbortSignal
  /** When true, transports that support incremental streaming from the underlying API should stream (emitting chunk events per delta). */
  stream?: boolean
  /** Extra keys merged verbatim into the chat-completions request body — the escape hatch for server-specific params the schema doesn't model (e.g. llama-server/vLLM's `chat_template_kwargs`). Request-level keys win over `providerOptions.extraBody` from the provider profile. */
  extraBody?: Record<string, any>
  providerOptions?: Record<string, any>
}

export interface ModelResponse {
  content: string
  toolCalls?: ModelToolCall[]
  usage?: Record<string, any>
  finishReason?: string
  providerData?: Record<string, any>
}

export type ModelStreamEvent =
  | { type: 'chunk'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'toolCall'; toolCall: ModelToolCall }
  | { type: 'response'; response: ModelResponse }
  | { type: 'rawEvent'; event: any }

export interface ModelTransport {
  apiMode: ModelProviderApiMode
  stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelStreamEvent>
}

export interface ResolvedModelProvider extends ModelProviderProfile {
  model: string
  transport: ModelTransport
}

const BUILTIN_PROFILES: ModelProviderProfile[] = [
  {
    id: 'local',
    label: 'Local llama-server',
    apiMode: 'openai-chat-completions',
    auth: 'none',
    baseURL: 'http://127.0.0.1:8143/v1',
    defaultModel: 'gemma-4-E2B-it-Q4_K_M',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5.4-mini',
  },
  {
    id: 'openai-responses',
    label: 'OpenAI Responses API',
    apiMode: 'openai-responses',
    auth: 'apiKey',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5.4-mini',
  },
  {
    id: 'openai-chat',
    label: 'OpenAI Chat Completions',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5.4-mini',
  },
  {
    id: 'openai-compatible',
    label: 'OpenAI-compatible endpoint',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
    defaultModel: 'local-model',
  },
  {
    id: 'lmstudio',
    label: 'LM Studio',
    apiMode: 'openai-chat-completions',
    auth: 'none',
    baseURL: 'http://localhost:1234/v1',
    defaultModel: 'local-model',
  },
  {
    id: 'ollama',
    label: 'Ollama OpenAI-compatible endpoint',
    apiMode: 'openai-chat-completions',
    auth: 'none',
    baseURL: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
  },
  {
    id: 'openai-codex',
    label: 'OpenAI Codex auth',
    apiMode: 'openai-codex',
    auth: 'codex',
    defaultModel: 'gpt-5-codex',
  },
  {
    id: 'codex',
    label: 'OpenAI Codex auth',
    apiMode: 'openai-codex',
    auth: 'codex',
    defaultModel: 'gpt-5-codex',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    apiMode: 'anthropic-messages',
    auth: 'apiKey',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    defaultModel: 'claude-sonnet-4-5',
  },
  {
    id: 'claude-code',
    label: 'Claude Code interactive session',
    apiMode: 'claude-session',
    auth: 'claudeSessionController',
    defaultModel: 'claude-code',
  },
]

const BUILTIN_PROFILE_IDS = new Set(BUILTIN_PROFILES.map(profile => profile.id))

function cloneProfile(profile: ModelProviderProfile): ModelProviderProfile {
  return {
    ...profile,
    headers: profile.headers ? { ...profile.headers } : undefined,
    providerOptions: profile.providerOptions ? { ...profile.providerOptions } : undefined,
    capabilities: profile.capabilities ? { ...profile.capabilities } : undefined,
  }
}

/** Parse a tool-call arguments string, returning {} instead of throwing on malformed JSON. */
function safeParseArguments(raw: any): Record<string, any> {
  if (raw == null) return {}
  if (typeof raw !== 'string') return raw
  try {
    return JSON.parse(raw || '{}')
  } catch {
    return {}
  }
}

/**
 * Returns the correct parameter name for limiting output tokens on OpenAI-style
 * chat completions. Newer OpenAI models require max_completion_tokens; local and
 * legacy models use max_tokens.
 */
export function resolveMaxTokensParam(model: string): 'max_tokens' | 'max_completion_tokens' {
  const needsCompletionTokens = ['gpt-4o', 'gpt-4.1', 'gpt-5', 'o1', 'o3', 'o4']
  return needsCompletionTokens.some((prefix) => model.startsWith(prefix)) ? 'max_completion_tokens' : 'max_tokens'
}

/** Convert user content (string or content parts) into a Responses API input message item. */
export function toResponsesUserMessage(content: string | any[]): OpenAI.Responses.ResponseInputItem.Message {
  if (typeof content === 'string') {
    return {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: content }],
    }
  }

  const parts = content.map((part: any) => {
    if (part.type === 'text') {
      return { type: 'input_text' as const, text: part.text }
    }
    if (part.type === 'input_audio') {
      return { type: 'input_audio' as const, data: part.data, format: part.format }
    }
    if (part.type === 'input_file') {
      return { type: 'input_file' as const, file_data: part.file_data, filename: part.filename }
    }

    return {
      type: 'input_image' as const,
      image_url: part.image_url?.url ?? part.image_url,
      detail: part.image_url?.detail || 'auto',
    }
  }) as OpenAI.Responses.ResponseInputMessageContentList

  return {
    type: 'message',
    role: 'user',
    content: parts,
  }
}

/**
 * Convert Chat Completions-style message history into Responses API input items.
 * System/developer messages are skipped (they travel via the instructions param),
 * and tool results are skipped since replayed assistant tool_calls won't have
 * matching server-side IDs.
 */
export function messagesToResponsesInput(messages: ModelMessage[]): OpenAI.Responses.ResponseInput {
  const input: OpenAI.Responses.ResponseInput = []

  for (const msg of messages) {
    if (msg.role === 'system' || msg.role === 'developer') continue

    if (msg.role === 'user') {
      if (typeof msg.content === 'string') {
        input.push({
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: msg.content }],
        })
      } else if (Array.isArray(msg.content)) {
        input.push(toResponsesUserMessage(msg.content))
      }
      continue
    }

    if (msg.role === 'assistant') {
      const content = typeof msg.content === 'string' ? msg.content : (msg.content || []).map((p: any) => p.text || '').join('')
      if (content) {
        input.push({
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: content, annotations: [] }],
          id: `msg_replay-${input.length}`,
          status: 'completed',
        } as any)
      }
      continue
    }
  }

  return input
}

/** Extract system/developer message text to use as Responses API instructions. */
function responsesInstructionsFrom(messages: ModelMessage[]): string | undefined {
  for (const message of messages) {
    if ((message.role === 'system' || message.role === 'developer') && typeof message.content === 'string') {
      return message.content
    }
  }
  return undefined
}

function combineInstructions(...values: Array<string | undefined>): string | undefined {
  const combined = values.map(value => value?.trim()).filter(Boolean).join('\n\n')
  return combined || undefined
}

function withRequestInstructions(messages: ModelMessage[], instructions?: string): ModelMessage[] {
  const trimmed = instructions?.trim()
  if (!trimmed) return messages

  const userIndex = messages.findLastIndex(message => message.role === 'user')
  if (userIndex >= 0) {
    return messages.map((message, index) => {
      if (index !== userIndex) return message
      const suffix = `\n\nInstructions for this request only:\n${trimmed}`
      if (typeof message.content === 'string') {
        return { ...message, content: `${message.content}${suffix}` }
      }
      if (Array.isArray(message.content)) {
        return {
          ...message,
          content: [...message.content, { type: 'text', text: suffix.trimStart() }],
        }
      }
      return message
    })
  }

  const insertionIndex = messages.findIndex(message => message.role !== 'system' && message.role !== 'developer')
  const index = insertionIndex < 0 ? messages.length : insertionIndex
  return [
    ...messages.slice(0, index),
    { role: 'system', content: trimmed },
    ...messages.slice(index),
  ]
}

function abortError(): Error {
  const error = new Error('The operation was aborted')
  error.name = 'AbortError'
  return error
}

async function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise
  if (signal.aborted) throw abortError()
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError())
    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
  })
}

/**
 * Incremental `<think>…</think>` segmenter for models whose chat template
 * leaves reasoning inline in the content stream (qwen3, DeepSeek-R1 via
 * llama-server without --reasoning-format, etc.).
 *
 * Feed it content deltas; it routes text inside the tags to `reasoning` and
 * everything else to `content`, holding back a partial tag split across chunk
 * boundaries until the next delta resolves it. An opening tag only counts
 * while the turn has produced nothing but whitespace — a literal `<think>`
 * mentioned mid-answer stays in the content.
 */
export class ThinkTagSplitter {
  private inside = false
  private pending = ''
  private sawContent = false

  push(text: string): { content: string; reasoning: string } {
    this.pending += text
    let content = ''
    let reasoning = ''

    while (true) {
      if (!this.inside && this.sawContent) {
        // Past the point where an opening tag is plausible — pass through.
        content += this.pending
        this.pending = ''
        break
      }
      const tag = this.inside ? '</think>' : '<think>'
      const idx = this.pending.indexOf(tag)
      if (idx === -1) {
        const keep = partialTagSuffix(this.pending, tag)
        const emit = this.pending.slice(0, this.pending.length - keep)
        if (this.inside) reasoning += emit
        else {
          content += emit
          if (emit.trim()) this.sawContent = true
        }
        this.pending = this.pending.slice(this.pending.length - keep)
        break
      }
      const emit = this.pending.slice(0, idx)
      if (this.inside) reasoning += emit
      else {
        content += emit
        if (emit.trim()) this.sawContent = true
      }
      this.pending = this.pending.slice(idx + tag.length)
      if (!this.inside && this.sawContent) {
        // The tag opened after real content — it was literal text, put it back.
        content += tag
      } else {
        this.inside = !this.inside
      }
    }

    return { content, reasoning }
  }

  /** Emit whatever is still held back (call once, at stream end). */
  flush(): { content: string; reasoning: string } {
    const emit = this.pending
    this.pending = ''
    return this.inside ? { content: '', reasoning: emit } : { content: emit, reasoning: '' }
  }
}

/** Length of the longest suffix of `s` that is a proper prefix of `tag`. */
function partialTagSuffix(s: string, tag: string): number {
  const max = Math.min(s.length, tag.length - 1)
  for (let len = max; len > 0; len--) {
    if (tag.startsWith(s.slice(s.length - len))) return len
  }
  return 0
}

class NotImplementedTransport implements ModelTransport {
  constructor(public apiMode: ModelProviderApiMode) {}
  async *stream(): AsyncIterable<ModelStreamEvent> {
    throw new Error(`No model transport is registered for api mode: ${this.apiMode}`)
  }
}

export class OpenAIChatCompletionsTransport implements ModelTransport {
  apiMode = 'openai-chat-completions'

  private resolveClient(request: ModelRequest, provider: ResolvedModelProvider): OpenAI {
    const providerOptions = { ...(provider.providerOptions ?? {}), ...(request.providerOptions ?? {}) }
    const injected = providerOptions.client ?? providerOptions.clientFactory?.()
    if (injected) return injected

    if (!provider.baseURL) throw new Error(`Provider ${provider.id} requires baseURL for chat completions`)
    if (provider.auth !== 'none' && !provider.apiKey) throw new Error(`Provider ${provider.id} requires an API key`)

    return new OpenAI({
      apiKey: provider.apiKey ?? 'not-needed',
      baseURL: provider.baseURL,
      defaultHeaders: provider.headers,
    })
  }

  private buildParams(request: ModelRequest, provider: ResolvedModelProvider): Record<string, any> {
    const providerOptions = { ...(provider.providerOptions ?? {}), ...(request.providerOptions ?? {}) }
    const model = request.model ?? provider.model
    const maxTokensParam = providerOptions.maxTokensParam ?? resolveMaxTokensParam(model)

    return {
      model,
      messages: withRequestInstructions(request.messages, request.instructions),
      tools: request.tools?.length ? request.tools : undefined,
      ...(request.tools?.length ? { tool_choice: 'auto' } : {}),
      temperature: request.temperature,
      ...(request.maxTokens != null ? { [maxTokensParam]: request.maxTokens } : {}),
      ...(request.topP != null ? { top_p: request.topP } : {}),
      ...(request.topK != null ? { top_k: request.topK } : {}),
      ...(request.frequencyPenalty != null ? { frequency_penalty: request.frequencyPenalty } : {}),
      ...(request.presencePenalty != null ? { presence_penalty: request.presencePenalty } : {}),
      ...(request.stop ? { stop: request.stop } : {}),
      ...(request.responseFormat ? { response_format: { type: 'json_schema', json_schema: request.responseFormat } } : {}),
      ...(request.stream && providerOptions.includeUsage !== false ? { stream_options: { include_usage: true } } : {}),
      // Escape hatch for params the schema doesn't model (chat_template_kwargs, …).
      // Profile-level extraBody applies to every request; request-level wins per key.
      ...(providerOptions.extraBody ?? {}),
      ...(request.extraBody ?? {}),
    }
  }

  async *stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelStreamEvent> {
    const client = this.resolveClient(request, provider)
    const params = this.buildParams(request, provider)
    const requestOptions = request.signal ? { signal: request.signal } : undefined

    if (request.stream) {
      yield* this.streamCompletion(client, params, requestOptions)
      return
    }

    const json = await client.chat.completions.create({ ...params, stream: false } as any, requestOptions) as any
    yield { type: 'rawEvent', event: json }
    const choice = json.choices?.[0]
    const message = choice?.message ?? {}
    // llama-server/vLLM/DeepSeek surface reasoning as reasoning_content;
    // OpenRouter as reasoning; some templates leave it inline in <think> tags
    const messageReasoning = message.reasoning_content ?? message.reasoning
    if (typeof messageReasoning === 'string' && messageReasoning) {
      yield { type: 'reasoning', text: messageReasoning }
    }
    let content = typeof message.content === 'string' ? message.content : ''
    if (content) {
      const splitter = new ThinkTagSplitter()
      const split = splitter.push(content)
      const tail = splitter.flush()
      const inlineReasoning = split.reasoning + tail.reasoning
      if (inlineReasoning) yield { type: 'reasoning', text: inlineReasoning }
      content = split.content + tail.content
    }
    if (content) yield { type: 'chunk', text: content }
    yield {
      type: 'response',
      response: {
        content,
        toolCalls: (message.tool_calls ?? []).map((call: any) => ({
          id: call.id,
          name: call.function?.name,
          arguments: safeParseArguments(call.function?.arguments),
          rawArguments: typeof call.function?.arguments === 'string' ? call.function.arguments : JSON.stringify(call.function?.arguments ?? {}),
        })).filter((call: ModelToolCall) => !!call.name),
        usage: json.usage,
        finishReason: choice?.finish_reason,
        providerData: { id: json.id, model: json.model },
      },
    }
  }

  private async *streamCompletion(client: OpenAI, params: Record<string, any>, requestOptions?: { signal?: AbortSignal }): AsyncIterable<ModelStreamEvent> {
    const stream = await client.chat.completions.create({ ...params, stream: true } as any, requestOptions) as any

    let content = ''
    let finishReason: string | undefined
    let usage: Record<string, any> | undefined
    let responseId: string | undefined
    let responseModel: string | undefined
    const toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = []

    const splitter = new ThinkTagSplitter()

    for await (const chunk of stream) {
      yield { type: 'rawEvent', event: chunk }

      const choice = chunk.choices?.[0]
      const delta = choice?.delta

      // Structured reasoning deltas (llama-server/vLLM: reasoning_content,
      // OpenRouter: reasoning) stream separately from content
      const reasoningDelta = (delta as any)?.reasoning_content ?? (delta as any)?.reasoning
      if (typeof reasoningDelta === 'string' && reasoningDelta) {
        yield { type: 'reasoning', text: reasoningDelta }
      }

      if (delta?.content) {
        // Inline <think> tags (template-dependent) are segmented out so
        // reasoning never lands in the visible content or message history
        const split = splitter.push(delta.content)
        if (split.reasoning) yield { type: 'reasoning', text: split.reasoning }
        if (split.content) {
          content += split.content
          yield { type: 'chunk', text: split.content }
        }
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!toolCalls[tc.index]) {
            toolCalls[tc.index] = { id: tc.id || '', function: { name: '', arguments: '' } }
          }
          if (tc.id) toolCalls[tc.index]!.id = tc.id
          if (tc.function?.name) toolCalls[tc.index]!.function.name += tc.function.name
          if (tc.function?.arguments) toolCalls[tc.index]!.function.arguments += tc.function.arguments
        }
      }

      if (choice?.finish_reason) finishReason = choice.finish_reason
      if (chunk.id) responseId = chunk.id
      if (chunk.model) responseModel = chunk.model

      if (chunk.usage) {
        usage = {
          prompt_tokens: (usage?.prompt_tokens ?? 0) + (chunk.usage.prompt_tokens || 0),
          completion_tokens: (usage?.completion_tokens ?? 0) + (chunk.usage.completion_tokens || 0),
          total_tokens: (usage?.total_tokens ?? 0) + (chunk.usage.total_tokens || 0),
          prompt_tokens_details: {
            cached_tokens: (usage?.prompt_tokens_details?.cached_tokens ?? 0) + (chunk.usage.prompt_tokens_details?.cached_tokens || 0),
          },
          completion_tokens_details: {
            reasoning_tokens: (usage?.completion_tokens_details?.reasoning_tokens ?? 0) + (chunk.usage.completion_tokens_details?.reasoning_tokens || 0),
          },
        }
      }
    }

    const tail = splitter.flush()
    if (tail.reasoning) yield { type: 'reasoning', text: tail.reasoning }
    if (tail.content) {
      content += tail.content
      yield { type: 'chunk', text: tail.content }
    }

    yield {
      type: 'response',
      response: {
        content,
        toolCalls: toolCalls
          .filter(call => !!call?.function?.name)
          .map(call => ({
            id: call.id,
            name: call.function.name,
            arguments: safeParseArguments(call.function.arguments),
            rawArguments: call.function.arguments || '{}',
          })),
        usage,
        finishReason,
        providerData: { id: responseId, model: responseModel },
      },
    }
  }
}

export class OpenAIResponsesTransport implements ModelTransport {
  apiMode = 'openai-responses'

  private resolveClient(providerOptions: Record<string, any>, provider: ResolvedModelProvider): OpenAI {
    const injected = providerOptions.client ?? providerOptions.clientFactory?.()
    if (injected) return injected
    if (provider.auth !== 'none' && !provider.apiKey) throw new Error(`Provider ${provider.id} requires an API key`)

    return new OpenAI({
      apiKey: provider.apiKey ?? 'not-needed',
      baseURL: provider.baseURL ?? 'https://api.openai.com/v1',
      defaultHeaders: provider.headers,
    })
  }

  /**
   * Build the Responses API tools array: local function tools from the request
   * (strict mode, additionalProperties: false) plus remote MCP servers from
   * providerOptions.mcpServers keyed by server label.
   */
  private buildTools(request: ModelRequest, providerOptions: Record<string, any>): OpenAI.Responses.Tool[] {
    const functionTools = (request.tools ?? []).map(tool => ({
      type: 'function' as const,
      name: tool.function.name,
      description: tool.function.description,
      parameters: { ...(tool.function.parameters ?? { type: 'object', properties: {} }), additionalProperties: false },
      strict: true,
    }))

    const mcpTools = Object.entries((providerOptions.mcpServers ?? {}) as Record<string, any>)
      .filter(([, server]) => !!server?.url)
      .map(([serverLabel, server]) => ({
        type: 'mcp' as const,
        server_label: serverLabel,
        server_url: server.url,
        ...(server.headers ? { headers: server.headers } : {}),
        ...(server.allowedTools ? { allowed_tools: server.allowedTools } : {}),
        ...(server.requireApproval ? { require_approval: server.requireApproval } : {}),
      }))

    return [...functionTools, ...mcpTools] as OpenAI.Responses.Tool[]
  }

  async *stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelStreamEvent> {
    const providerOptions = { ...(provider.providerOptions ?? {}), ...(request.providerOptions ?? {}) }
    const client = this.resolveClient(providerOptions, provider)

    const tools = this.buildTools(request, providerOptions)
    const instructions = combineInstructions(
      providerOptions.instructions ?? responsesInstructionsFrom(request.messages),
      request.instructions,
    )
    const input: OpenAI.Responses.ResponseInput = providerOptions.input ?? messagesToResponsesInput(request.messages)
    const previousResponseId = providerOptions.previousResponseId ?? providerOptions.previousProviderData?.responseId

    const stream: AsyncIterable<any> = await (client.responses.create as any)({
      model: (request.model ?? provider.model) as OpenAI.Responses.ResponseCreateParams['model'],
      input,
      stream: true,
      previous_response_id: previousResponseId,
      ...(tools.length ? { tools, tool_choice: 'auto' as const, parallel_tool_calls: true } : {}),
      ...(instructions ? { instructions } : {}),
      ...(request.maxTokens != null ? { max_output_tokens: request.maxTokens } : {}),
      ...(request.temperature != null ? { temperature: request.temperature } : {}),
      ...(request.topP != null ? { top_p: request.topP } : {}),
      ...(request.topK != null ? { top_k: request.topK } : {}),
      ...(request.frequencyPenalty != null ? { frequency_penalty: request.frequencyPenalty } : {}),
      ...(request.presencePenalty != null ? { presence_penalty: request.presencePenalty } : {}),
      ...(request.stop ? { stop: request.stop } : {}),
      ...(request.responseFormat ? { text: { format: { type: 'json_schema' as const, ...request.responseFormat } } } : {}),
    }, request.signal ? { signal: request.signal } : undefined)

    let content = ''
    let finalResponse: OpenAI.Responses.Response | undefined

    for await (const event of stream) {
      yield { type: 'rawEvent', event }

      if (event.type === 'response.output_text.delta') {
        const delta = event.delta || ''
        content += delta
        yield { type: 'chunk', text: delta }
      }

      // OpenAI never returns raw chain-of-thought — these are the reasoning
      // summaries (requested via reasoning.summary on o-series/gpt-5 models)
      if (event.type === 'response.reasoning_summary_text.delta' || event.type === 'response.reasoning_text.delta') {
        if (event.delta) yield { type: 'reasoning', text: event.delta }
      }

      if (event.type === 'response.completed') {
        finalResponse = event.response
      }
    }

    if (!finalResponse) {
      throw new Error('Responses stream ended without a completed response')
    }

    const functionCalls = (finalResponse.output || []).filter((item) => item.type === 'function_call') as OpenAI.Responses.ResponseFunctionToolCall[]

    yield {
      type: 'response',
      response: {
        content: content || finalResponse.output_text || '',
        toolCalls: functionCalls.map(call => ({
          id: call.call_id,
          name: call.name,
          arguments: safeParseArguments(call.arguments),
          rawArguments: call.arguments || '{}',
        })),
        usage: finalResponse.usage as Record<string, any> | undefined,
        finishReason: finalResponse.status,
        providerData: { responseId: finalResponse.id, response: finalResponse },
      },
    }
  }
}

export interface ClaudeSessionTransportOptions {
  /** Inject a claudeCode-like backend (with a `run()` method) — used by tests. */
  claudeCode?: { run: (prompt: string, options?: any) => Promise<any> }
}

export class OpenAICodexTransport implements ModelTransport {
  apiMode = 'openai-codex'

  constructor(private container: any) {}

  async *stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelStreamEvent> {
    const codex = this.container.feature('openaiCodex') as any
    const providerOptions = { ...(provider.providerOptions ?? {}), ...(request.providerOptions ?? {}) }
    const previousThreadId = providerOptions.previousProviderData?.codexThreadId
    const systemText = this.systemInstructions(request.messages)
    const developerInstructions = combineInstructions(
      previousThreadId ? undefined : systemText,
      request.instructions,
    )
    const prompt = previousThreadId
      ? this.lastUserMessage(request.messages)
      : this.promptFromMessages(request.messages)
    const config = {
      ...(providerOptions.config ?? {}),
      ...(developerInstructions ? { developer_instructions: developerInstructions } : {}),
    }
    const result = await withAbort<any>(codex.run(prompt, {
      ...providerOptions,
      previousProviderData: undefined,
      config: Object.keys(config).length ? config : undefined,
      model: request.model ?? provider.model,
      ...(previousThreadId ? { resumeSessionId: previousThreadId } : {}),
      ...(request.signal ? { signal: request.signal } : {}),
    }), request.signal)
    const content = typeof result === 'string' ? result : (result?.result ?? result?.content ?? '')
    const status = typeof result === 'object' ? result?.status : undefined
    if (status === 'error') {
      const errorPayload = typeof result === 'object' ? (result?.error ?? result?.messages ?? result) : result
      throw new Error(`codex session failed: ${typeof errorPayload === 'string' ? errorPayload : JSON.stringify(errorPayload)}`)
    }
    const threadId = typeof result === 'object' ? result?.threadId : undefined
    if (content) yield { type: 'chunk', text: content }
    yield {
      type: 'response',
      response: {
        content,
        toolCalls: [],
        usage: typeof result === 'object' ? result?.usage : undefined,
        providerData: {
          ...(threadId ? { codexThreadId: threadId } : {}),
        },
      },
    }
  }

  private systemInstructions(messages: ModelMessage[]): string {
    return messages
      .filter(message => message.role === 'system' || message.role === 'developer')
      .map(message => this.contentToText(message.content))
      .filter(Boolean)
      .join('\n\n')
  }

  private promptFromMessages(messages: ModelMessage[]): string {
    return messages
      .filter(message => message.role !== 'assistant' && message.role !== 'tool' && message.role !== 'system' && message.role !== 'developer')
      .map(message => this.contentToText(message.content))
      .filter(Boolean)
      .join('\n\n')
  }

  private lastUserMessage(messages: ModelMessage[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m && m.role === 'user') return this.contentToText(m.content)
    }
    return ''
  }

  private contentToText(content: any): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) return content.map(part => typeof part === 'string' ? part : part.text ?? part.content ?? '').filter(Boolean).join('\n')
    return String(content ?? '')
  }
}

export class ClaudeSessionTransport implements ModelTransport {
  apiMode = 'claude-session'

  constructor(private container: any, private options: ClaudeSessionTransportOptions = {}) {}

  /**
   * Drive the claude-code backend headlessly via `claudeCode.run()` (which runs
   * `claude -p --output-format stream-json`). Claude runs its own agentic loop
   * with its own tools/MCP, so it returns a final text answer — no tool calls
   * are surfaced to the conversation loop. Multi-turn continuity is handled by
   * resuming claude's own session id, captured as providerData.
   */
  async *stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelStreamEvent> {
    const providerOptions = { ...(provider.providerOptions ?? {}), ...(request.providerOptions ?? {}) }
    const claudeCode = this.options.claudeCode ?? (this.container.feature('claudeCode') as any)

    const prompt = this.promptFromMessages(request.messages)
    const previousSessionId = providerOptions.previousProviderData?.claudeSessionId
    const systemText = this.systemInstructions(request.messages)
    const appendSystemPrompt = combineInstructions(
      previousSessionId ? undefined : systemText,
      request.instructions,
    )
    const mcpServers = this.resolveMcpServers(providerOptions)

    // provider.defaultModel is the 'claude-code' placeholder — don't pass that
    // as --model. Only forward a real model name when one was explicitly set.
    const requestedModel = request.model ?? provider.model
    const model = requestedModel && requestedModel !== 'claude-code' ? requestedModel : undefined

    const runOptions: Record<string, any> = {
      cwd: providerOptions.cwd ?? this.container.cwd ?? process.cwd(),
      ...(model ? { model } : {}),
      // The system prompt only needs to go over on the first turn; resuming a
      // session carries it (and the history) server-side.
      ...(appendSystemPrompt ? { appendSystemPrompt } : {}),
      ...(Object.keys(mcpServers).length ? { mcpServers } : {}),
      ...(previousSessionId ? { resumeSessionId: previousSessionId } : {}),
      ...(providerOptions.permissionMode ? { permissionMode: providerOptions.permissionMode } : {}),
      ...(providerOptions.allowedTools ? { allowedTools: providerOptions.allowedTools } : {}),
      ...(providerOptions.runOptions ?? {}),
    }

    const session = await withAbort<any>(claudeCode.run(prompt, {
      ...runOptions,
      ...(request.signal ? { signal: request.signal } : {}),
    }), request.signal)

    if (session?.status === 'error') {
      throw new Error(`claude session failed: ${session.error ?? session.result ?? 'unknown error'}`)
    }

    const content = typeof session?.result === 'string' ? session.result : ''
    if (content) yield { type: 'chunk', text: content }
    yield {
      type: 'response',
      response: {
        content,
        toolCalls: [],
        usage: { costUsd: session?.costUsd, turns: session?.turns },
        providerData: { claudeSessionId: session?.sessionId },
      },
    }
  }

  /**
   * Build the MCP servers map for the claude run. When providerOptions.assistant
   * is a name, register a `luca mcp --assistant <name>` stdio server so the
   * spawned Claude can call back into luca for tool execution. Honors
   * `mcpServers` (extra servers), `lucaBin`, `askOnly`, and `mcpServerName`.
   */
  private resolveMcpServers(providerOptions: Record<string, any>): Record<string, any> {
    const servers: Record<string, any> = { ...(providerOptions.mcpServers ?? {}) }
    const assistant = providerOptions.assistant

    if (typeof assistant === 'string' && assistant.length > 0) {
      const lucaBin = providerOptions.lucaBin ?? 'luca'
      const mcpArgs = ['mcp', '--assistant', assistant, '--transport', 'stdio']
      if (providerOptions.askOnly) mcpArgs.push('--ask-only')
      const filters = providerOptions.assistantToolFilters ?? {}
      for (const pattern of filters.allowTools ?? []) mcpArgs.push('--allow-tool', pattern)
      for (const pattern of filters.forbidTools ?? []) mcpArgs.push('--forbid-tool', pattern)
      for (const name of filters.toolNames ?? []) mcpArgs.push('--tool-name', name)
      const serverName = providerOptions.mcpServerName ?? `luca-${assistant}`
      servers[serverName] = { command: lucaBin, args: mcpArgs }
    }

    return servers
  }

  private systemInstructions(messages: ModelMessage[]): string {
    return messages
      .filter(message => message.role === 'system' || message.role === 'developer')
      .map(message => this.contentToText(message.content))
      .filter(Boolean)
      .join('\n\n')
  }

  private contentToText(content: any): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) return content.map(part => typeof part === 'string' ? part : part?.text ?? part?.content ?? '').filter(Boolean).join('\n')
    return String(content ?? '')
  }

  private promptFromMessages(messages: ModelMessage[]): string {
    const lastUser = [...messages].reverse().find(message => message.role === 'user')
    const content = lastUser?.content ?? messages[messages.length - 1]?.content ?? ''
    return this.contentToText(content)
  }
}

export class ModelProviders extends Feature<ModelProvidersState> {
  static override stateSchema = ModelProvidersStateSchema
  static override description = 'Resolve model provider profiles and route requests to provider transports.'
  static override shortcut = 'features.modelProviders' as const
  static override stability = 'core' as const
  static override category = 'ai-assistants' as const
  static override optionsSchema = Feature.optionsSchema.extend({})
  static { Feature.register(this, 'modelProviders') }

  private discoveryPending = new Map<string, Promise<DiscoveredModelServer[]>>()
  private probeIds = new WeakMap<NonNullable<ModelProviderDiscoverOptions['probe']>, number>()
  private nextProbeId = 0

  override get initialState(): ModelProvidersState {
    return { ...super.initialState, discoveredServers: [] }
  }

  /** Servers from the last completed discovery, cloned for safe synchronous access. Empty before discovery. */
  get discoveredServers(): DiscoveredModelServer[] {
    return (this.state.get('discoveredServers') ?? []).map(server => ({ ...server, models: [...server.models] }))
  }

  /** Unique model ids advertised by the last discovered servers. Empty before discovery. */
  get discoveredModels(): string[] {
    return [...new Set(this.discoveredServers.flatMap(server => server.models))]
  }

  /** Whether discovery has completed, including a scan that found no servers. */
  get hasDiscovered(): boolean {
    return this.discoveredAt !== undefined
  }

  /** Time of the last completed scan in milliseconds since epoch, or undefined before discovery. */
  get discoveredAt(): number | undefined {
    return this.state.get('discoveredAt')
  }

  private transports = new Map<ModelProviderApiMode, ModelTransport>()

  private get profileMap(): Map<string, ModelProviderProfile> {
    let profiles = this.state.get('profiles' as any) as Map<string, ModelProviderProfile> | undefined
    if (!profiles) {
      profiles = new Map<string, ModelProviderProfile>()
      this.state.set('profiles' as any, profiles as any)
    }
    return profiles
  }

  constructor(options: any, context: any) {
    super(options, context)
    for (const profile of BUILTIN_PROFILES) this.registerProfile(profile)
    this.registerTransport('openai-chat-completions', new OpenAIChatCompletionsTransport())
    this.registerTransport('openai-responses', new OpenAIResponsesTransport())
    this.registerTransport('openai-codex', new OpenAICodexTransport(this.container))
    this.registerTransport('claude-session', new ClaudeSessionTransport(this.container))
  }

  registerProfile(profile: ModelProviderProfile) {
    const profiles = new Map(this.profileMap)
    profiles.set(profile.id, cloneProfile(profile))
    this.state.set('profiles' as any, profiles as any)
    return this
  }

  /**
   * Register a self-hosted, OpenAI-compatible endpoint with sensible defaults —
   * the common case for local LLM servers (LM Studio, Ollama, vLLM, llama.cpp,
   * a LAN GPU box). Defaults to the `openai-chat-completions` dialect and no
   * auth, since most local servers ignore the API key. You just provide a
   * `baseURL` and a default `model`.
   *
   * Pass `apiKey` or `apiKeyEnv` when a server does require a bearer token —
   * `auth` flips to `'apiKey'` automatically. Override `apiMode`, `label`, or
   * `headers` through the same options object for anything unusual.
   *
   * @example
   * // In luca.cli.ts main(container), seed once at startup:
   * const mp = container.feature('modelProviders')
   * mp.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')
   * mp.registerLocal('dgx', 'http://192.168.1.50:8000/v1', 'llama-3.3-70b')
   * // Then an assistant's CORE.md frontmatter: `provider: chief`
   *
   * @example
   * // A server that does want a key, read from the environment:
   * mp.registerLocal('secure-box', 'http://10.0.0.5:8000/v1', 'mixtral', {
   *   apiKeyEnv: 'BOX_API_KEY',
   * })
   */
  registerLocal(id: string, baseURL: string, model: string, options: LocalProviderOptions = {}) {
    const hasKey = !!(options.apiKey || options.apiKeyEnv)
    return this.registerProfile({
      id,
      label: options.label ?? id,
      apiMode: options.apiMode ?? 'openai-chat-completions',
      auth: options.auth ?? (hasKey ? 'apiKey' : 'none'),
      baseURL,
      defaultModel: model,
      apiKey: options.apiKey,
      apiKeyEnv: options.apiKeyEnv,
      headers: options.headers,
    })
  }

  registerTransport(apiMode: ModelProviderApiMode, transport: ModelTransport) {
    this.transports.set(apiMode, transport)
    return this
  }

  /** Returns true when a provider profile with this id is registered. */
  hasProfile(id: string): boolean {
    return this.profileMap.has(id)
  }

  /** Returns true when a transport is registered for this API mode. */
  hasTransport(apiMode: ModelProviderApiMode): boolean {
    return this.transports.has(apiMode)
  }

  /** The transport registered for this API mode, if any. */
  getTransport(apiMode: ModelProviderApiMode): ModelTransport | undefined {
    return this.transports.get(apiMode)
  }

  get(id: string): ModelProviderProfile | undefined {
    const profile = this.profileMap.get(id)
    return profile ? cloneProfile(profile) : undefined
  }

  list(): ModelProviderProfile[] {
    return Array.from(this.profileMap.values()).map(cloneProfile)
  }

  /** Provider profile ids available for `provider: "..."` lookups. */
  get available(): string[] {
    return this.profileIds
  }

  /** Provider profile ids available for `provider: "..."` lookups. */
  get profileIds(): string[] {
    return Array.from(this.profileMap.keys())
  }

  /** Registered profiles keyed by provider id. Returned profiles are cloned. */
  get profiles(): Record<string, ModelProviderProfile> {
    return Object.fromEntries(this.list().map(profile => [profile.id, profile]))
  }

  /** API modes with registered transports. */
  get transportsAvailable(): string[] {
    return Array.from(this.transports.keys())
  }

  /** API modes referenced by profiles or directly registered as transports. */
  get apiModes(): string[] {
    return this.container.utils.lodash.uniq([
      ...this.list().map(profile => profile.apiMode),
      ...this.transportsAvailable,
    ])
  }

  /** Default model by provider id. */
  get defaults(): Record<string, string | undefined> {
    return Object.fromEntries(this.list().map(profile => [profile.id, profile.defaultModel]))
  }

  /** REPL-friendly provider overview that never exposes raw API keys. */
  summary(): ModelProviderSummary[] {
    return this.list().map(profile => this.summarizeProfile(profile))
  }

  /**
   * Describe one provider or, when no id is supplied, all providers.
   * This is intentionally concise and safe for REPL output.
   */
  describe(id?: string): ModelProviderSummary | ModelProviderSummary[] {
    if (!id) return this.summary()
    const profile = this.get(id)
    if (!profile) throw new Error(`Unknown model provider: ${id}`)
    return this.summarizeProfile(profile)
  }

  /** Set a provider's default model. */
  setDefaultModel(providerId: string, model: string) {
    return this.updateProfile(providerId, { defaultModel: model })
  }

  /** Set a provider's base URL. */
  setBaseURL(providerId: string, baseURL: string) {
    return this.updateProfile(providerId, { baseURL })
  }

  /** Remove a registered provider profile. */
  removeProfile(id: string): boolean {
    if (!this.profileMap.has(id)) return false
    const profiles = new Map(this.profileMap)
    const removed = profiles.delete(id)
    this.state.set('profiles' as any, profiles as any)
    return removed
  }

  /**
   * Pin the default provider explicitly, overriding the automatic selection.
   * Pass a registered profile id; clear with `setDefault(undefined)`.
   *
   * @example
   * ```typescript
   * container.feature('modelProviders').setDefault('anthropic')
   * ```
   */
  setDefault(id: string | undefined) {
    if (id && !this.hasProfile(id)) throw new Error(`Unknown model provider: ${id}`)
    this.state.set('defaultProvider' as any, id as any)
    return this
  }

  /**
   * The provider a blank assistant/conversation uses when no `provider` option
   * is configured, or undefined when nothing usable is available. Selection
   * order, designed around a brand-new user of the framework:
   *
   *   1. An explicit `setDefault(id)` or the LUCA_DEFAULT_PROVIDER env var
   *   2. `openai` when OPENAI_API_KEY is set
   *   3. `local` when the llama-server binary and a chat model are installed (`luca setup`)
   *   4. `anthropic` when ANTHROPIC_API_KEY is set
   *   5. The first user-registered custom profile whose auth is satisfied
   */
  resolveDefaultId(): string | undefined {
    const pinned = (this.state.get('defaultProvider' as any) as string | undefined) || process.env.LUCA_DEFAULT_PROVIDER
    if (pinned && this.hasProfile(pinned)) return pinned

    // Older `luca bootstrap` wrote a live `OPENAI_API_KEY=set-your-own` into
    // .env; treat that placeholder as no key so those projects fall back to local.
    if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'set-your-own') return 'openai'
    if (this.localChatReady) return 'local'
    // Only a default candidate when an anthropic-messages transport has been registered
    if (process.env.ANTHROPIC_API_KEY && this.hasTransport('anthropic-messages')) return 'anthropic'

    for (const profile of this.list()) {
      if (BUILTIN_PROFILE_IDS.has(profile.id)) continue
      const keySatisfied = profile.auth === 'none' || !!this.resolveApiKey(profile)
      if (profile.baseURL && keySatisfied && this.hasTransport(profile.apiMode)) return profile.id
    }
    return undefined
  }

  /**
   * Like resolveDefaultId(), but throws an actionable error when no provider
   * is available — a brand-new user with no API key and no local model gets
   * told exactly how to fix it instead of a downstream auth failure.
   */
  requireDefaultId(): string {
    const id = this.resolveDefaultId()
    if (id) return id
    throw new Error(
      'No model provider is available. Luca needs at least one of:\n' +
      '  • OPENAI_API_KEY set in the environment (uses OpenAI)\n' +
      '  • a local model — run `luca setup` to download llama-server and a local chat model\n' +
      "  • a custom provider registered in luca.cli.ts, e.g. container.feature('modelProviders').registerLocal('mybox', 'http://host:port/v1', 'model-name')"
    )
  }

  /** Whether the local llama-server stack (binary + chat model weights) is installed on this machine. */
  get localChatReady(): boolean {
    try {
      return (this.container.feature('llamaServer') as any).chatReady === true
    } catch {
      return false
    }
  }

  /**
   * Scan for live OpenAI-compatible LLM servers by probing `GET /v1/models` on
   * well-known ports (LM Studio 1234, Ollama 11434, llama.cpp 8080, vLLM 8000,
   * and friends — see KNOWN_LLM_PORTS). Probes localhost by default, plus any
   * extra `hosts` you pass, plus every online tailscale peer when the
   * `tailscale` CLI is installed and running. Everything fails gracefully: a
   * host that isn't listening, times out, or answers with something that isn't
   * a models list is simply omitted, and a missing tailscale is skipped
   * silently — discover() never throws for an unreachable target.
   *
   * Results (including empty scans) are cached in state for the latest scan
   * options for this feature instance. Repeat calls reuse them; pass
   * `refresh: true` to rescan. Changed hosts, ports, timeout, tailscale settings,
   * or probe function trigger a new scan. Concurrent identical scans are shared.
   * Read discoveredServers, discoveredModels, hasDiscovered, and discoveredAt
   * synchronously after awaiting discovery.
   *
   * Pass `register: true` to turn each hit into a provider profile
   * (via registerLocal) so assistants can use it immediately; servers whose
   * baseURL already matches a registered profile are reported with that
   * profileId instead of creating a duplicate.
   *
   * @example
   * // What's running on this machine?
   * const found = await container.feature('modelProviders').discover()
   * // [{ baseURL: 'http://127.0.0.1:1234/v1', hint: 'LM Studio', models: ['qwen2.5-32b'], ... }]
   *
   * @example
   * // Sweep the tailnet and register everything found as usable providers
   * const servers = await container.feature('modelProviders').discover({ register: true })
   * for (const s of servers) console.log(s.profileId, s.baseURL, s.models)
   */
  async discover(options: ModelProviderDiscoverOptions = {}): Promise<DiscoveredModelServer[]> {
    if (options.probe && !this.probeIds.has(options.probe)) {
      this.probeIds.set(options.probe, ++this.nextProbeId)
    }
    const key = JSON.stringify({
      ports: [...new Set(options.ports ?? KNOWN_LLM_PORTS.map(entry => entry.port))].sort((a, b) => a - b),
      hosts: [...new Set(options.hosts ?? [])].sort(),
      localhost: options.localhost !== false,
      tailscale: options.tailscale !== false,
      timeoutMs: options.timeoutMs ?? 1500,
      probe: options.probe ? this.probeIds.get(options.probe) : 0,
    })
    let pending = this.discoveryPending.get(key)
    let found: DiscoveredModelServer[]
    let discoveredAt: number
    if (!pending && !options.refresh && this.state.get('discoveryKey') === key && this.hasDiscovered) {
      found = this.discoveredServers
      discoveredAt = this.discoveredAt!
    } else {
      if (!pending) {
        pending = this.scanServers(options)
        this.discoveryPending.set(key, pending)
      }
      try {
        found = (await pending).map(server => ({ ...server, models: [...server.models] }))
        discoveredAt = Date.now()
      } finally {
        if (this.discoveryPending.get(key) === pending) this.discoveryPending.delete(key)
      }
    }
    this.matchDiscoveredProfiles(found, options.register)
    this.setState({ discoveredServers: found, discoveryKey: key, discoveredAt })
    return this.discoveredServers
  }

  private async scanServers(options: ModelProviderDiscoverOptions): Promise<DiscoveredModelServer[]> {
    const ports = options.ports ?? KNOWN_LLM_PORTS.map(entry => entry.port)
    const timeoutMs = options.timeoutMs ?? 1500
    const probe = options.probe ?? ((url: string, init: { signal: AbortSignal }) => fetch(url, init))
    const hints = new Map(KNOWN_LLM_PORTS.map(entry => [entry.port, entry.hint]))

    const targets: Array<{ host: string; source: 'localhost' | 'tailscale'; hostname?: string }> = []
    if (options.localhost !== false) targets.push({ host: '127.0.0.1', source: 'localhost' })
    for (const host of options.hosts ?? []) targets.push({ host, source: 'localhost' })
    if (options.tailscale !== false) {
      for (const peer of await this.tailscalePeers()) {
        targets.push({ host: peer.host, source: 'tailscale', hostname: peer.hostname })
      }
    }

    const probes = targets.flatMap(target => ports.map(async (port): Promise<DiscoveredModelServer | null> => {
      const baseURL = `http://${target.host}:${port}/v1`
      const started = Date.now()
      try {
        const response = await probe(`${baseURL}/models`, { signal: AbortSignal.timeout(timeoutMs) })
        if (!response.ok) return null
        const body = await response.json()
        // Require the OpenAI models-list shape so a random HTTP server on a
        // known port doesn't read as an LLM endpoint.
        if (!body || !Array.isArray(body.data)) return null
        return {
          baseURL,
          host: target.host,
          port,
          source: target.source,
          hostname: target.hostname,
          hint: hints.get(port),
          models: body.data.map((model: any) => model?.id).filter((id: any) => typeof id === 'string'),
          latencyMs: Date.now() - started,
        }
      } catch {
        return null
      }
    }))

    return (await Promise.all(probes)).filter((server): server is DiscoveredModelServer => server !== null)
  }

  private matchDiscoveredProfiles(found: DiscoveredModelServer[], register = false): void {
    const byBaseURL = new Map(this.list().filter(profile => profile.baseURL).map(profile => [this.normalizeBaseURL(profile.baseURL!), profile.id]))
    for (const server of found) {
      const existing = byBaseURL.get(this.normalizeBaseURL(server.baseURL))
      if (existing) {
        server.profileId = existing
        continue
      }
      delete server.profileId
      if (register) {
        const name = (server.hostname ?? server.host).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
        const id = `${name}-${server.port}`
        this.registerLocal(id, server.baseURL, server.models[0] ?? 'local-model', {
          label: server.hint ? `${server.hint} @ ${server.hostname ?? server.host}` : id,
        })
        byBaseURL.set(this.normalizeBaseURL(server.baseURL), id)
        server.profileId = id
      }
    }
  }

  /** localhost/loopback aliases and trailing slashes all describe the same server. */
  private normalizeBaseURL(baseURL: string): string {
    return baseURL.replace(/\/+$/, '').replace('://localhost:', '://127.0.0.1:').replace('://0.0.0.0:', '://127.0.0.1:')
  }

  /**
   * Online tailscale peers as probe targets, or [] when tailscale isn't
   * installed, isn't running, or its output can't be parsed. Never throws.
   */
  private async tailscalePeers(): Promise<Array<{ host: string; hostname?: string }>> {
    // The mac app doesn't put `tailscale` on PATH — fall back to its bundled binary.
    const binaries = ['tailscale', '/Applications/Tailscale.app/Contents/MacOS/Tailscale']
    for (const bin of binaries) {
      try {
        const proc = this.container.feature('proc') as any
        const result = await proc.spawnAndCapture(bin, ['status', '--json'])
        if (result.exitCode !== 0 || !result.stdout) continue
        const status = JSON.parse(result.stdout)
        return Object.values((status?.Peer ?? {}) as Record<string, any>)
          .filter(peer => peer?.Online)
          .map(peer => ({
            host: (peer.TailscaleIPs ?? []).find((ip: string) => ip.includes('.')) ?? peer.TailscaleIPs?.[0],
            hostname: peer.HostName ?? peer.DNSName?.replace(/\.$/, ''),
          }))
          .filter(peer => !!peer.host)
      } catch {
        // tailscale missing or misbehaving — try the next binary, else skip
      }
    }
    return []
  }

  async resolve(options: ModelProviderResolveOptions = {}): Promise<ResolvedModelProvider> {
    const input = options.provider ?? this.requireDefaultId()
    const profile = this.profileFromInput(input)

    // The `local` provider is backed by a llama-server this machine may not have
    // running yet — make sure it is healthy (spawning it on first use) and let the
    // llamaServer feature's configuration win over the static profile defaults.
    if (profile.id === 'local') {
      const llama = this.container.feature('llamaServer') as any
      profile.baseURL = await llama.ensureChatServer()
      profile.defaultModel = llama.chatModel
    }
    const providerOptions = { ...(profile.providerOptions ?? {}), ...(options.providerOptions ?? {}) }
    const apiKey = this.resolveApiKey(profile)
    const transport = this.transports.get(profile.apiMode) ?? new NotImplementedTransport(profile.apiMode)

    return {
      ...profile,
      apiKey,
      providerOptions,
      model: options.model ?? (typeof input === 'object' && input && 'model' in input ? input.model : undefined) ?? profile.defaultModel ?? 'gpt-5.4-mini',
      transport,
    }
  }

  private profileFromInput(input: ModelProviderInput): ModelProviderProfile {
    if (typeof input === 'string') {
      const profile = this.get(input)
      if (!profile) throw new Error(`Unknown model provider: ${input}`)
      return profile
    }

    if ('baseURL' in input && !input.apiMode) {
      const inline = input as ModelProviderInlineInput
      return {
        id: inline.id ?? 'custom',
        apiMode: 'openai-chat-completions',
        auth: inline.auth ?? (inline.apiKey || inline.apiKeyEnv ? 'apiKey' : 'none'),
        baseURL: inline.baseURL,
        apiKey: inline.apiKey,
        apiKeyEnv: inline.apiKeyEnv,
        headers: inline.headers,
        defaultModel: inline.model,
      }
    }

    return cloneProfile(input as ModelProviderProfile)
  }

  private resolveApiKey(profile: ModelProviderProfile): string | undefined {
    if (profile.auth === 'none' || profile.auth === 'claudeSessionController') return undefined
    if (profile.apiKey) return profile.apiKey
    if (profile.apiKeyEnv) return process.env[profile.apiKeyEnv]
    return undefined
  }

  private updateProfile(id: string, updates: Partial<ModelProviderProfile>) {
    const profile = this.get(id)
    if (!profile) throw new Error(`Unknown model provider: ${id}`)
    this.registerProfile({ ...profile, ...updates, id })
    return this
  }

  private summarizeProfile(profile: ModelProviderProfile): ModelProviderSummary {
    return {
      id: profile.id,
      label: profile.label,
      apiMode: profile.apiMode,
      auth: profile.auth,
      defaultModel: profile.defaultModel,
      baseURL: profile.baseURL,
      hasApiKey: !!(profile.apiKey || (profile.apiKeyEnv && process.env[profile.apiKeyEnv])),
      apiKeyEnv: profile.apiKeyEnv,
      transportAvailable: this.hasTransport(profile.apiMode),
    }
  }
}

export default ModelProviders
