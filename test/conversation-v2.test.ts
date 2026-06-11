import { describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { ConversationV2 } from '../src/agi/features/conversation-v2'

describe('ConversationV2', () => {
  it('is registered in the AGI container', () => {
    const c = new AGIContainer()
    expect(c.features.has('conversationv2')).toBe(true)
    expect(c.feature('conversationv2')).toBeInstanceOf(ConversationV2)
  })

  it('sends normalized messages through the selected provider transport and records history', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const requests: any[] = []
    providers.registerProfile({ id: 'fake-chat', apiMode: 'fake-chat', auth: 'none', defaultModel: 'fake-model' })
    providers.registerTransport('fake-chat', {
      apiMode: 'fake-chat',
      async *stream(request) {
        requests.push(request)
        yield { type: 'chunk', text: 'hel' } as const
        yield { type: 'chunk', text: 'lo' } as const
        yield { type: 'response', response: { content: 'hello', toolCalls: [] } } as const
      },
    })

    const conversation = c.feature('conversationv2', {
      provider: 'fake-chat',
      model: 'fake-model',
      history: [{ role: 'system', content: 'You are concise.' }],
    })

    const answer = await conversation.ask('Ping')

    expect(answer).toBe('hello')
    expect(requests[0].messages).toEqual([
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Ping' },
    ])
    expect(conversation.messages).toEqual([
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Ping' },
      { role: 'assistant', content: 'hello' },
    ])
    expect(conversation.lastResponse).toBe('hello')
  })

  it('executes model tool calls and continues until a final answer', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const requests: any[] = []
    providers.registerProfile({ id: 'tool-loop', apiMode: 'tool-loop', auth: 'none', defaultModel: 'fake-model' })
    providers.registerTransport('tool-loop', {
      apiMode: 'tool-loop',
      async *stream(request) {
        requests.push(request)
        if (requests.length === 1) {
          yield { type: 'response', response: { content: '', toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { id: 42 } }] } } as const
          return
        }
        yield { type: 'response', response: { content: 'The answer is found.', toolCalls: [] } } as const
      },
    })

    const conversation = c.feature('conversationv2', {
      provider: 'tool-loop',
      tools: [{
        function: {
          name: 'lookup',
          description: 'Lookup a value',
          parameters: { type: 'object', properties: { id: { type: 'number' } } },
        },
        handler: async (args: any) => ({ ok: true, id: args.id }),
      } as any],
    })

    const answer = await conversation.ask('Use the tool')

    expect(answer).toBe('The answer is found.')
    expect(requests.length).toBe(2)
    expect(requests[1].messages).toContainEqual({ role: 'assistant', content: '', toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { id: 42 } }] })
    expect(requests[1].messages).toContainEqual({ role: 'tool', tool_call_id: 'call_1', name: 'lookup', content: JSON.stringify({ ok: true, id: 42 }) })
  })
})
