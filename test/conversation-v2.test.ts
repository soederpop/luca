import { describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { ConversationV2 } from '../src/agi/features/conversation-v2'
import { ClaudeSessionTransport } from '../src/agi/features/model-providers'

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

  it('routes asks through the openai-codex provider backend', async () => {
    const c = new AGIContainer()
    const codex = c.feature('openaiCodex') as any
    const runs: any[] = []
    codex.run = async (prompt: string, options: any) => {
      runs.push({ prompt, options })
      return { result: 'codex says ok', usage: { input_tokens: 2, output_tokens: 3 } }
    }

    const conversation = c.feature('conversationv2', {
      provider: 'openai-codex',
      providerOptions: { cwd: '/tmp/repo' },
      history: [{ role: 'system', content: 'Be terse.' }],
    })

    const answer = await conversation.ask('Fix the bug', { model: 'gpt-5-codex' })

    expect(answer).toBe('codex says ok')
    expect(runs).toEqual([{
      prompt: 'Fix the bug',
      options: {
        cwd: '/tmp/repo',
        model: 'gpt-5-codex',
        config: { developer_instructions: 'Be terse.' },
      },
    }])
    expect(conversation.messages).toEqual([
      { role: 'system', content: 'Be terse.' },
      { role: 'user', content: 'Fix the bug' },
      { role: 'assistant', content: 'codex says ok' },
    ])
  })

  it('routes asks through the claude-code provider backend', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const constructed: any[] = []
    const asked: any[] = []
    const started: any[] = []

    class FakeController {
      constructor(options: any) {
        constructed.push(options)
      }
      start = async () => {
        started.push(constructed[constructed.length - 1])
        return { state: 'ready', history: [] }
      }
      ask = async (prompt: string, options: any) => {
        asked.push({ prompt, options })
        return {
          state: 'ready',
          history: [
            { type: 'user', message: { role: 'user', content: prompt } },
            { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'claude says ok' }] } },
          ],
        }
      }
      get snapshot() { return { state: 'ready' } }
    }

    providers.registerTransport('claude-session', new ClaudeSessionTransport(c, { controllerClass: FakeController as any }))

    const conversation = c.feature('conversationv2', {
      provider: 'claude-code',
      providerOptions: { id: 'reviewer', cwd: '/tmp/repo', askOptions: { timeoutMs: 1000 } },
      history: [{ role: 'system', content: 'System text ignored by session prompt adapter.' }],
    })

    const answer = await conversation.ask('Review this diff')

    expect(answer).toBe('claude says ok')
    expect(started.length).toBe(1)
    expect(constructed[0].id).toBe('reviewer')
    expect(constructed[0].cwd).toBe('/tmp/repo')
    expect(asked).toEqual([{ prompt: 'Review this diff', options: { timeoutMs: 1000 } }])
    expect(conversation.messages).toEqual([
      { role: 'system', content: 'System text ignored by session prompt adapter.' },
      { role: 'user', content: 'Review this diff' },
      { role: 'assistant', content: 'claude says ok' },
    ])
  })

  it('keeps multi-turn claude-code asks in the same session controller', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const constructed: any[] = []
    const asked: any[] = []

    class FakeController {
      constructor(options: any) {
        constructed.push(options)
      }
      ask = async (prompt: string, options: any) => {
        asked.push({ prompt, options })
        return `claude turn ${asked.length}`
      }
      get snapshot() { return { state: 'ready' } }
    }

    providers.registerTransport('claude-session', new ClaudeSessionTransport(c, { controllerClass: FakeController as any }))

    const conversation = c.feature('conversationv2', {
      provider: 'claude-code',
      providerOptions: { id: 'pairing-session', cwd: '/tmp/repo', askOptions: { timeoutMs: 1000 } },
      history: [{ role: 'system', content: 'You are pairing on this repo.' }],
    })

    const first = await conversation.ask('First question')
    const second = await conversation.ask('Follow up question')

    expect(first).toBe('claude turn 1')
    expect(second).toBe('claude turn 2')
    expect(constructed.length).toBe(1)
    expect(constructed[0].id).toBe('pairing-session')
    expect(asked).toEqual([
      { prompt: 'First question', options: { timeoutMs: 1000 } },
      { prompt: 'Follow up question', options: { timeoutMs: 1000 } },
    ])
    expect(conversation.messages).toEqual([
      { role: 'system', content: 'You are pairing on this repo.' },
      { role: 'user', content: 'First question' },
      { role: 'assistant', content: 'claude turn 1' },
      { role: 'user', content: 'Follow up question' },
      { role: 'assistant', content: 'claude turn 2' },
    ])
  })
})
