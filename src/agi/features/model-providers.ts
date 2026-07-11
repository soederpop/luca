import { Feature, features } from '../feature'
import OpenAI from 'openai'
import type { ClaudeSessionController } from './claude-session-controller'

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
    id: 'openai',
    label: 'OpenAI',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5',
  },
  {
    id: 'openai-responses',
    label: 'OpenAI Responses API',
    apiMode: 'openai-responses',
    auth: 'apiKey',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5',
  },
  {
    id: 'openai-chat',
    label: 'OpenAI Chat Completions',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
    baseURL: 'https://api.openai.com/v1',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5',
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
  controllerClass?: typeof ClaudeSessionController
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
  private controllers = new Map<string, any>()

  constructor(private container: any, private options: ClaudeSessionTransportOptions = {}) {}

  async *stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelStreamEvent> {
    const providerOptions = { ...(provider.providerOptions ?? {}), ...(request.providerOptions ?? {}) }
    const key = providerOptions.id ?? providerOptions.name ?? 'main'
    const controller = await this.controllerFor(key, providerOptions)
    const prompt = this.promptFromMessages(request.messages)
    const response = await controller.ask(prompt, providerOptions.askOptions ?? {})
    const snapshot = controller.snapshot ?? (typeof response === 'object' ? response : undefined) ?? (typeof controller.refresh === 'function' ? await controller.refresh() : undefined)
    const content = this.contentFromControllerResponse(response, snapshot)

    if (content) yield { type: 'chunk', text: content }
    yield {
      type: 'response',
      response: {
        content,
        toolCalls: [],
        providerData: { snapshot },
      },
    }
  }

  private async controllerFor(key: string, providerOptions: Record<string, any>) {
    if (providerOptions.controller) return providerOptions.controller
    if (this.controllers.has(key)) return this.controllers.get(key)

    const args = await this.resolveClaudeArgs(providerOptions)

    const Controller = this.options.controllerClass ?? (await import('./claude-session-controller')).ClaudeSessionController
    const controller = new Controller({
      container: this.container,
      id: key,
      cwd: providerOptions.cwd ?? this.container.cwd ?? process.cwd(),
      name: providerOptions.name,
      command: providerOptions.command,
      args,
      width: providerOptions.width,
      height: providerOptions.height,
      reuse: providerOptions.reuse ?? true,
      settleMs: providerOptions.settleMs,
      claudePath: providerOptions.claudePath,
      sessionPrefix: providerOptions.sessionPrefix,
    })
    this.controllers.set(key, controller)
    if (typeof controller.start === 'function') await controller.start()
    return controller
  }

  /**
   * Build the args list for the Claude CLI, bootstrapping an MCP config when
   * providerOptions.assistant is set so the spawned Claude process can call
   * back into a `luca mcp --assistant <name>` subprocess for tool execution.
   * Honors `providerOptions.mcpServers` for extra MCP servers, `lucaBin` for
   * the luca binary path, `askOnly` for `--ask-only`, `mcpServerName` for the
   * server label, and `strictMcp` (default true) for `--strict-mcp-config`.
   */
  private async resolveClaudeArgs(providerOptions: Record<string, any>): Promise<string[]> {
    const args = [...(providerOptions.args ?? [])]
    const assistant = providerOptions.assistant
    const extraServers = providerOptions.mcpServers as Record<string, any> | undefined
    if ((!assistant || assistant === false) && !extraServers) return args

    const servers: Record<string, any> = { ...(extraServers ?? {}) }

    if (typeof assistant === 'string' && assistant.length > 0) {
      const lucaBin = providerOptions.lucaBin ?? 'luca'
      const mcpArgs = ['mcp', '--assistant', assistant, '--transport', 'stdio']
      if (providerOptions.askOnly) mcpArgs.push('--ask-only')
      const serverName = providerOptions.mcpServerName ?? `luca-${assistant}`
      servers[serverName] = { command: lucaBin, args: mcpArgs }
    }

    if (Object.keys(servers).length === 0) return args

    const claudeCode = this.container.feature('claudeCode') as any
    const configPath = await claudeCode.writeMcpConfig(servers)
    args.push('--mcp-config', configPath)
    if (providerOptions.strictMcp !== false) args.push('--strict-mcp-config')
    return args
  }

  private contentFromControllerResponse(response: any, snapshot: any): string {
    if (typeof response === 'string') return response
    const direct = response?.response ?? response?.text ?? response?.content
    if (typeof direct === 'string') return direct
    return this.latestAssistantText(snapshot?.history ?? response?.history ?? [])
  }

  private latestAssistantText(history: any[]): string {
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i]
      const role = entry?.role ?? entry?.message?.role ?? entry?.type
      if (role !== 'assistant') continue
      const text = this.textFromClaudeContent(entry?.content ?? entry?.message?.content ?? entry?.text)
      if (text) return text
    }
    return ''
  }

  private textFromClaudeContent(content: any): string {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map(part => typeof part === 'string' ? part : part?.text ?? part?.content ?? '')
        .filter(Boolean)
        .join('\n')
    }
    return content == null ? '' : String(content)
  }

  private promptFromMessages(messages: ModelMessage[]): string {
    const lastUser = [...messages].reverse().find(message => message.role === 'user')
    const content = lastUser?.content ?? messages[messages.length - 1]?.content ?? ''
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content.map(part => typeof part === 'string' ? part : part.text ?? part.content ?? '').filter(Boolean).join('\n')
    }
    return String(content ?? '')
  }
}

export class ModelProviders extends Feature {
  static override description = 'Resolve model provider profiles and route requests to provider transports.'
  static override stability = 'core' as const
  static override optionsSchema = Feature.optionsSchema.extend({})
  static override stateSchema = Feature.stateSchema.extend({})

  private profiles = new Map<string, ModelProviderProfile>()
  private transports = new Map<ModelProviderApiMode, ModelTransport>()

  constructor(options: any, context: any) {
    super(options, context)
    for (const profile of BUILTIN_PROFILES) this.registerProfile(profile)
    this.registerTransport('openai-chat-completions', new OpenAIChatCompletionsTransport())
    this.registerTransport('openai-responses', new OpenAIResponsesTransport())
    this.registerTransport('openai-codex', new OpenAICodexTransport(this.container))
    this.registerTransport('claude-session', new ClaudeSessionTransport(this.container))
  }

  registerProfile(profile: ModelProviderProfile) {
    this.profiles.set(profile.id, cloneProfile(profile))
    return this
  }

  registerTransport(apiMode: ModelProviderApiMode, transport: ModelTransport) {
    this.transports.set(apiMode, transport)
    return this
  }

  get(id: string): ModelProviderProfile | undefined {
    const profile = this.profiles.get(id)
    return profile ? cloneProfile(profile) : undefined
  }

  list(): ModelProviderProfile[] {
    return Array.from(this.profiles.values()).map(cloneProfile)
  }

  async resolve(options: ModelProviderResolveOptions = {}): Promise<ResolvedModelProvider> {
    const input = options.provider ?? 'openai'
    const profile = this.profileFromInput(input)
    const providerOptions = { ...(profile.providerOptions ?? {}), ...(options.providerOptions ?? {}) }
    const apiKey = this.resolveApiKey(profile)
    const transport = this.transports.get(profile.apiMode) ?? new NotImplementedTransport(profile.apiMode)

    return {
      ...profile,
      apiKey,
      providerOptions,
      model: options.model ?? (typeof input === 'object' && input && 'model' in input ? input.model : undefined) ?? profile.defaultModel ?? 'gpt-5',
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
}

export default features.register('modelProviders', ModelProviders)
