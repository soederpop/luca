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

class NotImplementedTransport implements ModelTransport {
  constructor(public apiMode: ModelProviderApiMode) {}
  async *stream(): AsyncIterable<ModelStreamEvent> {
    throw new Error(`No model transport is registered for api mode: ${this.apiMode}`)
  }
}

export class OpenAIChatCompletionsTransport implements ModelTransport {
  apiMode = 'openai-chat-completions'

  async *stream(request: ModelRequest, provider: ResolvedModelProvider): AsyncIterable<ModelStreamEvent> {
    if (!provider.baseURL) throw new Error(`Provider ${provider.id} requires baseURL for chat completions`)
    if (provider.auth !== 'none' && !provider.apiKey) throw new Error(`Provider ${provider.id} requires an API key`)

    const client = provider.providerOptions?.client ?? new OpenAI({
      apiKey: provider.apiKey ?? 'not-needed',
      baseURL: provider.baseURL,
      defaultHeaders: provider.headers,
    })

    const json = await client.chat.completions.create({
      model: request.model ?? provider.model,
      messages: request.messages,
      tools: request.tools?.length ? request.tools : undefined,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false,
    }) as any
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
          arguments: typeof call.function?.arguments === 'string'
            ? JSON.parse(call.function.arguments || '{}')
            : (call.function?.arguments ?? {}),
        })).filter((call: ModelToolCall) => !!call.name),
        usage: json.usage,
        finishReason: choice?.finish_reason,
        providerData: { id: json.id, model: json.model },
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
  static override optionsSchema = Feature.optionsSchema.extend({})
  static override stateSchema = Feature.stateSchema.extend({})

  private profiles = new Map<string, ModelProviderProfile>()
  private transports = new Map<ModelProviderApiMode, ModelTransport>()

  constructor(options: any, context: any) {
    super(options, context)
    for (const profile of BUILTIN_PROFILES) this.registerProfile(profile)
    this.registerTransport('openai-chat-completions', new OpenAIChatCompletionsTransport())
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
