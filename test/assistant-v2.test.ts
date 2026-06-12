import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

  it('passes CORE.md content as the system prompt when using ConversationV2', async () => {
    const root = mkdtempSync(join(tmpdir(), 'luca-assistant-core-v2-'))
    const folder = join(root, 'assistant')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, 'CORE.md'), [
      '---',
      'name: core-backed-assistant',
      '---',
      'You are reading this from CORE.md.',
      'Always answer with CORE_CONTEXT_OK.',
    ].join('\n'))

    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const requests: any[] = []
    providers.registerProfile({ id: 'core-fake', apiMode: 'core-fake', auth: 'none', defaultModel: 'core-model' })
    providers.registerTransport('core-fake', {
      apiMode: 'core-fake',
      async *stream(request) {
        requests.push(request)
        yield { type: 'response', response: { content: 'ok', toolCalls: [] } } as const
      },
    })

    const assistant = c.feature('assistant', {
      folder,
      v2: true,
      provider: 'core-fake',
    } as any)

    expect(assistant.systemPrompt).toBe('You are reading this from CORE.md.\nAlways answer with CORE_CONTEXT_OK.')
    expect(assistant.meta).toEqual({ name: 'core-backed-assistant' })

    await assistant.start()
    await assistant.ask('Ping')

    expect(requests[0].messages).toEqual([
      { role: 'system', content: 'You are reading this from CORE.md.\nAlways answer with CORE_CONTEXT_OK.' },
      { role: 'user', content: 'Ping' },
    ])
  })
})
