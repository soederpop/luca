import { describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { ConversationV2 } from '../src/agi/features/conversation-v2'

describe('Assistant conversation v2 wiring', () => {
  it('keeps the existing v1 conversation backend by default', async () => {
    const c = new AGIContainer()
    const assistant = c.feature('assistant', { systemPrompt: 'You are concise.' })

    await assistant.start()

    expect(assistant.conversation).not.toBeInstanceOf(ConversationV2)
  })

  it('opts into ConversationV2 and routes asks through modelProviders', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const requests: any[] = []
    providers.registerProfile({ id: 'assistant-fake', apiMode: 'assistant-fake', auth: 'none', defaultModel: 'assistant-model' })
    providers.registerTransport('assistant-fake', {
      apiMode: 'assistant-fake',
      async *stream(request) {
        requests.push(request)
        yield { type: 'chunk', text: 'v2 ' } as const
        yield { type: 'chunk', text: 'answer' } as const
        yield { type: 'response', response: { content: 'v2 answer', toolCalls: [] } } as const
      },
    })

    const assistant = c.feature('assistant', {
      systemPrompt: 'You are concise.',
      v2: true,
      provider: 'assistant-fake',
    } as any)

    await assistant.start()
    expect(assistant.conversation).toBeInstanceOf(ConversationV2)

    const answer = await assistant.ask('Ping')

    expect(answer).toBe('v2 answer')
    expect(requests[0].model).toBe('assistant-model')
    expect(requests[0].messages).toEqual([
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Ping' },
    ])
    expect(assistant.state.get('lastResponse')).toBe('v2 answer')
  })
})
