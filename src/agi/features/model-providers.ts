import { Feature, features } from '../feature'
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
    apiMode: 'openai-responses',
    auth: 'apiKey',
    apiKeyEnv: 'OPENAI_API_KEY',
    defaultModel: 'gpt-5',
  },
  {
    id: 'openai-chat',
    label: 'OpenAI Chat Completions',
    apiMode: 'openai-chat-completions',
    auth: 'apiKey',
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
    apiMode: 'openai-responses',
    auth: 'codex',
    defaultModel: 'gpt-5',
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

    const response = await fetch(`${provider.baseURL.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {}),
        ...(provider.headers ?? {}),
      },
      body: JSON.stringify({
        model: request.model ?? provider.model,
        messages: request.messages,
        tools: request.tools?.length ? request.tools : undefined,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
        stream: false,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI-compatible request failed (${response.status}): ${await response.text()}`)
    }

    const json = await response.json() as any
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
    const content = typeof response === 'string' ? response : (response?.response ?? response?.text ?? '')
    const snapshot = controller.snapshot ?? (typeof controller.refresh === 'function' ? await controller.refresh() : undefined)

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

    const Controller = this.options.controllerClass ?? (await import('./claude-session-controller')).ClaudeSessionController
    const controller = new Controller({
      container: this.container,
      id: key,
      cwd: providerOptions.cwd ?? this.container.cwd ?? process.cwd(),
      name: providerOptions.name,
      command: providerOptions.command,
      args: providerOptions.args,
      width: providerOptions.width,
      height: providerOptions.height,
      reuse: providerOptions.reuse ?? true,
      settleMs: providerOptions.settleMs,
      claudePath: providerOptions.claudePath,
      sessionPrefix: providerOptions.sessionPrefix,
    })
    this.controllers.set(key, controller)
    return controller
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
