import { z } from 'zod'
import { FeatureOptionsSchema, FeatureStateSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature'
import type { ModelMessage, ModelProviderInput, ModelTool } from './model-providers'

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
  tools: z.array(z.any()).optional().describe('Normalized model tools'),
  temperature: z.number().optional().describe('Sampling temperature'),
  maxTokens: z.number().optional().describe('Maximum output tokens'),
})

export const ConversationV2StateSchema = FeatureStateSchema.extend({
  messages: z.array(z.any()).describe('Normalized message history'),
  lastResponse: z.string().describe('Last assistant response text'),
})

export type ConversationV2Options = z.infer<typeof ConversationV2OptionsSchema> & {
  provider?: ModelProviderInput
  tools?: ModelTool[]
  history?: ModelMessage[]
}

export type ConversationV2State = z.infer<typeof ConversationV2StateSchema>

export class ConversationV2 extends Feature<ConversationV2State, ConversationV2Options> {
  static override description = 'Provider-native conversation feature backed by modelProviders.'
  static override optionsSchema = ConversationV2OptionsSchema
  static override stateSchema = ConversationV2StateSchema

  override get initialState(): ConversationV2State {
    return {
      ...super.initialState,
      messages: this.options.history ?? [],
      lastResponse: '',
    }
  }

  async ask(content: string): Promise<string> {
    const message: ModelMessage = { role: 'user', content }
    const messages = [...this.state.messages, message]
    const provider = await this.container.feature('modelProviders').resolve({
      provider: this.options.provider,
      model: this.options.model,
      providerOptions: this.options.providerOptions,
    })

    let responseText = ''
    for await (const event of provider.transport.stream({
      model: provider.model,
      messages,
      tools: this.options.tools,
      temperature: this.options.temperature,
      maxTokens: this.options.maxTokens,
    }, provider)) {
      if (event.type === 'chunk') responseText += event.text
      if (event.type === 'response') responseText = event.response.content
    }

    this.setState({
      messages: [...messages, { role: 'assistant', content: responseText }],
      lastResponse: responseText,
    })

    return responseText
  }
}

export default features.register('conversationv2', ConversationV2)