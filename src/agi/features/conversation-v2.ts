import { z } from 'zod'
import { FeatureEventsSchema, FeatureOptionsSchema, FeatureStateSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature'
import type { AskOptions, ContentPart, Message } from './conversation'
import type { ModelMessage, ModelProviderInput, ModelTool, ModelToolCall } from './model-providers'

export type ConversationV2Tool = ModelTool & {
  handler?: (args: Record<string, any>) => any | Promise<any>
}

declare module 'luca/feature' {
  interface AvailableFeatures {
    conversationv2: typeof ConversationV2
  }
}

export const ConversationV2OptionsSchema = FeatureOptionsSchema.extend({
  provider: z.any().optional().describe('Model provider preset or inline provider config'),
  providerOptions: z.record(z.string(), z.any()).optional().describe('Provider-specific transport options'),
  model: z.string().optional().describe('Model name for the selected provider'),
  history: z.array(z.any()).optional().describe('Initial normalized message history'),
  tools: z.union([z.array(z.any()), z.record(z.string(), z.any())]).optional().describe('Normalized model tools or Assistant tool map'),
  mcpServers: z.record(z.string(), z.any()).optional().describe('Reserved for compatibility with Conversation options; not consumed by v2 yet'),
  temperature: z.number().optional().describe('Sampling temperature'),
  maxTokens: z.number().optional().describe('Maximum output tokens'),
  maxTurns: z.number().optional().default(8).describe('Maximum provider/tool turns before aborting'),
})

export const ConversationV2StateSchema = FeatureStateSchema.extend({
  messages: z.array(z.any()).describe('Normalized message history'),
  lastResponse: z.string().describe('Last assistant response text'),
  lastProviderData: z.any().optional().describe('Provider-specific continuation data from the most recent response (e.g. session ids for resume)'),
})

export const ConversationV2EventsSchema = FeatureEventsSchema.extend({
  turnStart: z.tuple([z.object({ turn: z.number(), isFollowUp: z.boolean() })]).describe('Fired at the start of each provider/tool turn'),
  turnEnd: z.tuple([z.object({ turn: z.number(), hasToolCalls: z.boolean() })]).describe('Fired at the end of each provider/tool turn'),
  chunk: z.tuple([z.string()]).describe('Fired for each text chunk'),
  preview: z.tuple([z.string()]).describe('Fired with accumulated preview text for the current turn'),
  response: z.tuple([z.string()]).describe('Fired with the final response text'),
  rawEvent: z.tuple([z.any()]).describe('Fired with raw provider events'),
  mcpEvent: z.tuple([z.any()]).describe('Reserved MCP event compatibility channel'),
  toolCall: z.tuple([z.string(), z.any()]).describe('Fired before invoking a model-requested tool'),
  toolResult: z.tuple([z.string(), z.any()]).describe('Fired after a tool returns'),
  toolError: z.tuple([z.string(), z.any()]).describe('Fired when a tool throws'),
})

export type ConversationV2Options = z.infer<typeof ConversationV2OptionsSchema> & {
  provider?: ModelProviderInput
  tools?: ConversationV2Tool[]
  history?: ModelMessage[]
}

export type ConversationV2State = z.infer<typeof ConversationV2StateSchema>
export type ConversationV2Events = {
  [event: string]: any[]
  turnStart: [{ turn: number; isFollowUp: boolean }]
  turnEnd: [{ turn: number; hasToolCalls: boolean }]
  chunk: [string]
  preview: [string]
  response: [string]
  rawEvent: [any]
  mcpEvent: [any]
  toolCall: [string, any]
  toolResult: [string, any]
  toolError: [string, any]
}

export class ConversationV2 extends Feature<ConversationV2State, ConversationV2Options> {
  static override description = 'Provider-native conversation feature backed by modelProviders.'
  static override stability = 'core' as const
  static override optionsSchema = ConversationV2OptionsSchema
  static override stateSchema = ConversationV2StateSchema
  static override eventsSchema = ConversationV2EventsSchema

  toolExecutor: ((name: string, args: Record<string, any>, handler: (...args: any[]) => Promise<any>) => Promise<string>) | null = null

  override get initialState(): ConversationV2State {
    return {
      ...super.initialState,
      messages: this.options.history ?? [],
      lastResponse: '',
      lastProviderData: undefined,
    }
  }

  get messages(): ModelMessage[] {
    return (this.state.get('messages') as ModelMessage[] | undefined) ?? []
  }

  get lastResponse(): string {
    return (this.state.get('lastResponse') as string | undefined) ?? ''
  }

  get tools(): ConversationV2Tool[] {
    const tools = this.options.tools ?? []
    return Array.isArray(tools) ? tools : this.normalizeAssistantTools(tools as Record<string, any>)
  }

  updateTools(tools: Record<string, any> | ConversationV2Tool[]) {
    this.options.tools = Array.isArray(tools) ? tools : this.normalizeAssistantTools(tools)
    return this
  }

  pushMessage(message: Message | ModelMessage) {
    const normalized = this.normalizeMessage(message)
    this.state.set('messages', [...this.messages, normalized])
    return this
  }

  async ask(content: string | ContentPart[], options: any = {}): Promise<string> {
    const userMessage: ModelMessage = { role: 'user', content }
    let messages = [...this.messages, userMessage]
    const previousProviderData = this.state.get('lastProviderData')
    const baseProviderOptions = {
      ...(this.options.providerOptions ?? {}),
      ...(options.providerOptions ?? {}),
      ...(previousProviderData ? { previousProviderData } : {}),
    }
    const provider = await this.container.feature('modelProviders').resolve({
      provider: options.provider ?? this.options.provider,
      model: options.model ?? this.options.model,
      providerOptions: baseProviderOptions,
    })

    const tools = this.tools.map(tool => ({
      type: 'function' as const,
      function: tool.function,
    }))
    const toolHandlers = new Map(this.tools.map(tool => [tool.function.name, tool.handler]).filter(([, handler]) => typeof handler === 'function') as [string, ConversationV2Tool['handler']][])

    this.emit('turnStart', { turn: 1, isFollowUp: false })
    let finalText = ''
    let finalProviderData: any = undefined
    const maxTurns = options.maxTurns ?? this.options.maxTurns ?? 8

    for (let turn = 1; turn <= maxTurns; turn++) {
      if (turn > 1) this.emit('turnStart', { turn, isFollowUp: true })
      let responseText = ''
      let toolCalls: ModelToolCall[] = []

      for await (const event of provider.transport.stream({
        model: provider.model,
        messages,
        tools: tools.length ? tools : undefined,
        temperature: options.temperature ?? this.options.temperature,
        maxTokens: options.maxTokens ?? this.options.maxTokens,
        providerOptions: baseProviderOptions,
      }, provider)) {
        if (event.type === 'chunk') {
          responseText += event.text
          this.emit('chunk', event.text)
          this.emit('preview', responseText)
        } else if (event.type === 'toolCall') {
          toolCalls.push(event.toolCall)
        } else if (event.type === 'rawEvent') {
          this.emit('rawEvent', event.event)
        } else if (event.type === 'response') {
          responseText = event.response.content
          toolCalls = event.response.toolCalls ?? toolCalls
          if (event.response.providerData !== undefined) finalProviderData = event.response.providerData
        }
      }

      messages = [...messages, { role: 'assistant', content: responseText, ...(toolCalls.length ? { toolCalls } : {}) }]
      this.emit('turnEnd', { turn, hasToolCalls: toolCalls.length > 0 })

      if (!toolCalls.length) {
        finalText = responseText
        break
      }

      for (const call of toolCalls) {
        const handler = toolHandlers.get(call.name)
        if (!handler) throw new Error(`No handler registered for tool call: ${call.name}`)
        try {
          const content = await this.executeTool(call.name, call.arguments ?? {}, handler)
          messages = [...messages, { role: 'tool', tool_call_id: call.id, name: call.name, content }]
        } catch (error: any) {
          const content = JSON.stringify({ error: error?.message ?? String(error) })
          messages = [...messages, { role: 'tool', tool_call_id: call.id, name: call.name, content }]
          this.emit('toolError', call.name, error)
        }
      }
    }

    this.setState({ messages, lastResponse: finalText, lastProviderData: finalProviderData })
    this.emit('response', finalText)
    return finalText
  }

  fork(options: { history?: 'full' | 'none' | number } & Partial<ConversationV2Options> = {}) {
    const history = options.history === 'none'
      ? this.messages.filter(message => message.role === 'system' || message.role === 'developer')
      : typeof options.history === 'number'
        ? this.messages.slice(-options.history)
        : [...this.messages]

    return this.container.feature('conversationv2', {
      ...this.options,
      ...options,
      history,
    })
  }

  async save(_opts?: Record<string, any>) {
    throw new Error('ConversationV2 persistence is not implemented yet')
  }

  private normalizeMessage(message: Message | ModelMessage): ModelMessage {
    const anyMessage = message as any
    return {
      role: anyMessage.role,
      content: anyMessage.content ?? anyMessage.text ?? '',
      ...(anyMessage.name ? { name: anyMessage.name } : {}),
      ...(anyMessage.tool_call_id ? { tool_call_id: anyMessage.tool_call_id } : {}),
      ...(anyMessage.toolCalls ? { toolCalls: anyMessage.toolCalls } : {}),
      ...(anyMessage.tool_calls ? { toolCalls: anyMessage.tool_calls } : {}),
    } as ModelMessage
  }

  private async executeTool(toolName: string, args: Record<string, any>, handler: (...args: any[]) => Promise<any>): Promise<string> {
    if (this.toolExecutor) {
      return this.toolExecutor(toolName, args, handler)
    }

    this.emit('toolCall', toolName, args)
    try {
      const output = await handler(args)
      const result = typeof output === 'string' ? output : JSON.stringify(output)
      this.emit('toolResult', toolName, result)
      return result
    } catch (error: any) {
      this.emit('toolError', toolName, error)
      return JSON.stringify({ error: error?.message ?? String(error) })
    }
  }

  private normalizeAssistantTools(tools: Record<string, any>): ConversationV2Tool[] {
    return Object.entries(tools).map(([name, tool]) => ({
      type: 'function' as const,
      function: {
        name,
        description: tool.description ?? name,
        parameters: tool.parameters ?? { type: 'object', properties: {} },
      },
      handler: tool.handler,
    }))
  }
}

export default features.register('conversationv2', ConversationV2)
