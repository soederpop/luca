import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AGIContainer } from '../src/agi/container.server'
import { Conversation } from '../src/agi/features/conversation'

describe('Assistant provider wiring', () => {
  it('uses the OpenAI conversation loops by default (no provider)', async () => {
    const c = new AGIContainer()
    const assistant = c.feature('assistant', { systemPrompt: 'You are concise.' })

    await assistant.start()

    // Always the unified Conversation feature now.
    expect(assistant.conversation).toBeInstanceOf(Conversation)
    // With no provider configured, turns run through the OpenAI chat loop.
    expect((assistant.conversation as any).usesGenericTransportLoop).toBe(false)
  })

  it('routes asks through modelProviders when a non-OpenAI provider is configured', async () => {
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
      provider: 'assistant-fake',
    } as any)

    await assistant.start()
    expect((assistant.conversation as any).usesGenericTransportLoop).toBe(true)

    const answer = await assistant.ask('Ping')

    expect(answer).toBe('v2 answer')
    // No explicit model → the provider's default model wins.
    expect(requests[0].model).toBe('assistant-model')
    expect(requests[0].messages).toEqual([
      { role: 'system', content: 'You are concise.' },
      { role: 'user', content: 'Ping' },
    ])
    expect(assistant.state.get('lastResponse')).toBe('v2 answer')
  })

  it('passes CORE.md content as the system prompt through the provider', async () => {
    const root = mkdtempSync(join(tmpdir(), 'luca-assistant-core-provider-'))
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

  it('configures CORE.md frontmatter provider + providerOptions (claude-code style)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'luca-assistant-fm-provider-'))
    const folder = join(root, 'assistant')
    mkdirSync(folder, { recursive: true })
    writeFileSync(join(folder, 'CORE.md'), [
      '---',
      'provider: fm-fake',
      'providerOptions:',
      '  cwd: /tmp/repo',
      '---',
      'System from frontmatter.',
    ].join('\n'))

    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const requests: any[] = []
    providers.registerProfile({ id: 'fm-fake', apiMode: 'fm-fake', auth: 'none', defaultModel: 'fm-model' })
    providers.registerTransport('fm-fake', {
      apiMode: 'fm-fake',
      async *stream(request) {
        requests.push(request)
        yield { type: 'response', response: { content: 'fm ok', toolCalls: [] } } as const
      },
    })

    const assistant = c.feature('assistant', { folder } as any)
    await assistant.start()
    const answer = await assistant.ask('Ping')

    expect(answer).toBe('fm ok')
    // providerOptions from frontmatter reached the transport; the assistant name
    // is injected as the default `assistant` providerOption for MCP wiring.
    expect(requests[0].providerOptions.cwd).toBe('/tmp/repo')
    expect(requests[0].providerOptions.assistant).toBe(assistant.name)
  })
})
