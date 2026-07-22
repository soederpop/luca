import { Feature } from '../feature'
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
      messages: request.messages,
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
    const content = typeof message.content === 'string' ? message.content : ''
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

    for await (const chunk of stream) {
      yield { type: 'rawEvent', event: chunk }

      const choice = chunk.choices?.[0]
      const delta = choice?.delta

      if (delta?.content) {
        content += delta.content
        yield { type: 'chunk', text: delta.content }
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
    const instructions = providerOptions.instructions ?? responsesInstructionsFrom(request.messages)
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
    const prompt = previousThreadId
      ? this.lastUserMessage(request.messages)
      : this.promptFromMessages(request.messages)
    const config = {
      ...(providerOptions.config ?? {}),
      ...(systemText && !previousThreadId ? { developer_instructions: systemText } : {}),
    }
    const result = await codex.run(prompt, {
      ...providerOptions,
      previousProviderData: undefined,
      config: Object.keys(config).length ? config : undefined,
      model: request.model ?? provider.model,
      ...(previousThreadId ? { resumeSessionId: previousThreadId } : {}),
    })
    const content = typeof result === 'string' ? result : (result?.result ?? result?.content ?? '')
    const status = typeof result === 'object' ? result?.status : undefined
    if (status === 'error') {
      const errorPayload = typeof result === 'object' ? (result?.error ?? result?.messages ?? result) : result
      throw new Error(`codex session failed: ${typeof errorPayload === 'string' ? errorPayload : JSON.stringify(errorPayload)}`)
    }
    const threadId = typeof result === 'object' ? result?.threadId : undefined
    const baseProviderData = typeof result === 'object' ? { ...result, result: undefined, content: undefined, usage: undefined } : undefined
    if (content) yield { type: 'chunk', text: content }
    yield {
      type: 'response',
      response: {
        content,
        toolCalls: [],
        usage: typeof result === 'object' ? result?.usage : undefined,
        providerData: {
          ...(baseProviderData ?? {}),
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
      ...(systemText && !previousSessionId ? { appendSystemPrompt: systemText } : {}),
      ...(Object.keys(mcpServers).length ? { mcpServers } : {}),
      ...(previousSessionId ? { resumeSessionId: previousSessionId } : {}),
      ...(providerOptions.permissionMode ? { permissionMode: providerOptions.permissionMode } : {}),
      ...(providerOptions.allowedTools ? { allowedTools: providerOptions.allowedTools } : {}),
      ...(providerOptions.runOptions ?? {}),
    }

    const session = await claudeCode.run(prompt, runOptions)

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

export class ModelProviders extends Feature {
  static override description = 'Resolve model provider profiles and route requests to provider transports.'
  static override shortcut = 'features.modelProviders' as const
  static override stability = 'core' as const
  static override category = 'ai-assistants' as const
  static override optionsSchema = Feature.optionsSchema.extend({})
  static override stateSchema = Feature.stateSchema.extend({})
  static { Feature.register(this, 'modelProviders') }

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

    if (process.env.OPENAI_API_KEY) return 'openai'
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
