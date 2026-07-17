import { describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { ClaudeSessionTransport, ModelProviders } from '../src/agi/features/model-providers'

describe('ModelProviders', () => {
  it('is registered in the AGI container', () => {
    const c = new AGIContainer()
    expect(c.features.has('modelProviders')).toBe(true)
    expect(c.feature('modelProviders')).toBeInstanceOf(ModelProviders)
  })

  it('resolves local OpenAI-compatible presets without API keys', async () => {
    const providers = new AGIContainer().feature('modelProviders')

    const lmstudio = await providers.resolve({ provider: 'lmstudio' })
    expect(lmstudio.id).toBe('lmstudio')
    expect(lmstudio.apiMode).toBe('openai-chat-completions')
    expect(lmstudio.baseURL).toBe('http://localhost:1234/v1')
    expect(lmstudio.apiKey).toBeUndefined()

    const ollama = await providers.resolve({ provider: 'ollama', model: 'llama3.2' })
    expect(ollama.id).toBe('ollama')
    expect(ollama.baseURL).toBe('http://localhost:11434/v1')
    expect(ollama.model).toBe('llama3.2')
  })

  it('registerLocal registers an OpenAI-compatible endpoint with no-auth defaults', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    providers.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')

    const resolved = await providers.resolve({ provider: 'chief' })
    expect(resolved.id).toBe('chief')
    expect(resolved.label).toBe('chief')
    expect(resolved.apiMode).toBe('openai-chat-completions')
    expect(resolved.auth).toBe('none')
    expect(resolved.baseURL).toBe('http://chief:1234/v1')
    expect(resolved.model).toBe('qwen2.5-32b')
    expect(resolved.apiKey).toBeUndefined()
  })

  it('registerLocal flips to apiKey auth and reads the key from the environment', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    process.env.TEST_BOX_KEY = 'sk-box-123'
    try {
      providers.registerLocal('secure-box', 'http://10.0.0.5:8000/v1', 'mixtral', { apiKeyEnv: 'TEST_BOX_KEY' })
      const resolved = await providers.resolve({ provider: 'secure-box' })
      expect(resolved.auth).toBe('apiKey')
      expect(resolved.apiKey).toBe('sk-box-123')
    } finally {
      delete process.env.TEST_BOX_KEY
    }
  })

  it('treats provider objects with a baseURL as OpenAI-compatible by default', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const resolved = await providers.resolve({
      provider: { baseURL: 'http://localhost:8000/v1', auth: 'none' },
      model: 'custom-local',
    })

    expect(resolved.id).toBe('custom')
    expect(resolved.apiMode).toBe('openai-chat-completions')
    expect(resolved.baseURL).toBe('http://localhost:8000/v1')
    expect(resolved.model).toBe('custom-local')
    expect(resolved.apiKey).toBeUndefined()
  })

  it('exposes a `codex` alias for the openai-codex provider', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const codex = await providers.resolve({ provider: 'codex' })
    expect(codex.id).toBe('codex')
    expect(codex.apiMode).toBe('openai-codex')
    expect(codex.model).toBe('gpt-5-codex')
  })

  it('resolves claude-code as a public provider backed by claude-session api mode', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const resolved = await providers.resolve({ provider: 'claude-code', providerOptions: { id: 'reviewer', cwd: '/tmp/repo' } })

    expect(resolved.id).toBe('claude-code')
    expect(resolved.apiMode).toBe('claude-session')
    expect(resolved.model).toBe('claude-code')
    expect(resolved.providerOptions?.id).toBe('reviewer')
    expect(resolved.providerOptions?.cwd).toBe('/tmp/repo')
  })

  it('allows tests and extensions to register fake transports', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    providers.registerProfile({ id: 'fake', apiMode: 'fake-mode', auth: 'none', defaultModel: 'fake-model' })
    providers.registerTransport('fake-mode', {
      apiMode: 'fake-mode',
      async *stream() {
        yield { type: 'chunk', text: 'hello' } as const
        yield { type: 'response', response: { content: 'hello', toolCalls: [] } } as const
      },
    })

    const resolved = await providers.resolve({ provider: 'fake' })
    const events = []
    for await (const event of resolved.transport.stream({ model: resolved.model, messages: [] }, resolved)) {
      events.push(event)
    }

    expect(events.map(e => e.type)).toEqual(['chunk', 'response'])
  })

  it('exposes REPL-friendly profile and transport inspection helpers', () => {
    const providers = new AGIContainer().feature('modelProviders')

    expect(providers.available).toContain('openai')
    expect(providers.profileIds).toContain('claude-code')
    expect(providers.transportsAvailable).toContain('openai-chat-completions')
    expect(providers.apiModes).toContain('claude-session')
    expect(providers.defaults.openai).toBe('gpt-5')
    expect(providers.hasProfile('ollama')).toBe(true)
    expect(providers.hasTransport('openai-responses')).toBe(true)
  })

  it('returns cloned profiles keyed by id', () => {
    const providers = new AGIContainer().feature('modelProviders')
    const profiles = providers.profiles

    profiles.openai!.defaultModel = 'mutated'

    expect(providers.get('openai')?.defaultModel).toBe('gpt-5')
  })

  it('summarizes providers without exposing raw API keys', () => {
    const providers = new AGIContainer().feature('modelProviders')
    providers.registerProfile({
      id: 'secret-box',
      apiMode: 'missing-mode',
      auth: 'apiKey',
      apiKey: 'sk-secret',
      defaultModel: 'secret-model',
    })

    const summary = providers.describe('secret-box') as any

    expect(summary).toEqual({
      id: 'secret-box',
      label: undefined,
      apiMode: 'missing-mode',
      auth: 'apiKey',
      defaultModel: 'secret-model',
      baseURL: undefined,
      hasApiKey: true,
      apiKeyEnv: undefined,
      transportAvailable: false,
    })
    expect('apiKey' in summary).toBe(false)
  })

  it('mutates registered profiles through explicit helpers', async () => {
    const providers = new AGIContainer().feature('modelProviders')

    providers.setDefaultModel('ollama', 'llama4')
    providers.setBaseURL('ollama', 'http://localhost:9999/v1')

    const resolved = await providers.resolve({ provider: 'ollama' })
    expect(resolved.model).toBe('llama4')
    expect(resolved.baseURL).toBe('http://localhost:9999/v1')
  })

  it('removes registered profiles and reports whether anything changed', () => {
    const providers = new AGIContainer().feature('modelProviders')
    providers.registerLocal('temporary', 'http://localhost:7777/v1', 'tmp-model')

    expect(providers.removeProfile('temporary')).toBe(true)
    expect(providers.hasProfile('temporary')).toBe(false)
    expect(providers.removeProfile('temporary')).toBe(false)
  })

  it('routes OpenAI-compatible chat through an OpenAI SDK style client', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const calls: any[] = []
    const fakeClient = {
      chat: {
        completions: {
          create: async (request: any) => {
            calls.push(request)
            return {
              choices: [{
                message: {
                  content: 'sdk hello',
                  tool_calls: [{ id: 'call_1', function: { name: 'lookup', arguments: '{"id":42}' } }],
                },
                finish_reason: 'tool_calls',
              }],
              usage: { total_tokens: 7 },
            }
          },
        },
      },
    }

    providers.registerProfile({
      id: 'sdk-compatible',
      apiMode: 'openai-chat-completions',
      auth: 'none',
      baseURL: 'http://localhost:9999/v1',
      defaultModel: 'local-model',
      providerOptions: { client: fakeClient },
    })

    const resolved = await providers.resolve({ provider: 'sdk-compatible' })
    const events = []
    for await (const event of resolved.transport.stream({
      model: resolved.model,
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ function: { name: 'lookup', parameters: { type: 'object' } } }],
    }, resolved)) {
      events.push(event)
    }

    expect(calls[0].model).toBe('local-model')
    expect(calls[0].messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(calls[0].tools[0].function.name).toBe('lookup')
    expect(events.at(-1)).toEqual({
      type: 'response',
      response: {
        content: 'sdk hello',
        toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { id: 42 }, rawArguments: '{"id":42}' }],
        usage: { total_tokens: 7 },
        finishReason: 'tool_calls',
        providerData: { id: undefined, model: undefined },
      },
    })
  })

  it('streams chat completions when request.stream is true', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const calls: any[] = []
    const fakeClient = {
      chat: {
        completions: {
          create: async (request: any) => {
            calls.push(request)
            async function* chunks() {
              yield { id: 'chatcmpl_1', model: 'local-model', choices: [{ delta: { content: 'hel' } }] }
              yield { id: 'chatcmpl_1', model: 'local-model', choices: [{ delta: { content: 'lo' } }] }
              yield {
                id: 'chatcmpl_1',
                model: 'local-model',
                choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'lookup', arguments: '{"id":' } }] } }],
              }
              yield {
                id: 'chatcmpl_1',
                model: 'local-model',
                choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '42}' } }] }, finish_reason: 'tool_calls' }],
                usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
              }
            }
            return chunks()
          },
        },
      },
    }

    providers.registerProfile({
      id: 'sdk-streaming',
      apiMode: 'openai-chat-completions',
      auth: 'none',
      baseURL: 'http://localhost:9999/v1',
      defaultModel: 'local-model',
      providerOptions: { client: fakeClient },
    })

    const resolved = await providers.resolve({ provider: 'sdk-streaming' })
    const events = []
    for await (const event of resolved.transport.stream({
      model: resolved.model,
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    }, resolved)) {
      events.push(event)
    }

    expect(calls[0].stream).toBe(true)
    expect(events.filter(e => e.type === 'chunk').map((e: any) => e.text)).toEqual(['hel', 'lo'])
    const response = (events.at(-1) as any).response
    expect(response.content).toBe('hello')
    expect(response.toolCalls).toEqual([{ id: 'call_1', name: 'lookup', arguments: { id: 42 }, rawArguments: '{"id":42}' }])
    expect(response.finishReason).toBe('tool_calls')
    expect(response.usage).toMatchObject({ prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 })
  })

  it('routes the openai-responses api mode through a Responses SDK style client', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const calls: any[] = []
    const finalResponse = {
      id: 'resp_1',
      output: [{ type: 'function_call', call_id: 'call_9', name: 'lookup', arguments: '{"id":7}' }],
      output_text: 'partial text',
      usage: { input_tokens: 4, output_tokens: 2, total_tokens: 6 },
      status: 'completed',
    }
    const fakeClient = {
      responses: {
        create: async (request: any) => {
          calls.push(request)
          async function* events() {
            yield { type: 'response.output_text.delta', delta: 'partial ' }
            yield { type: 'response.output_text.delta', delta: 'text' }
            yield { type: 'response.completed', response: finalResponse }
          }
          return events()
        },
      },
    }

    const resolved = await providers.resolve({
      provider: 'openai-responses',
      model: 'gpt-5',
      providerOptions: { client: fakeClient, instructions: 'Be terse.', mcpServers: { docs: { url: 'https://mcp.example.com' } } },
    })

    const events = []
    for await (const event of resolved.transport.stream({
      model: 'gpt-5',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [{ function: { name: 'lookup', description: 'Lookup', parameters: { type: 'object', properties: {} } } }],
      stream: true,
    }, resolved)) {
      events.push(event)
    }

    expect(calls[0].instructions).toBe('Be terse.')
    expect(calls[0].input).toEqual([{ type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] }])
    expect(calls[0].tools).toEqual([
      { type: 'function', name: 'lookup', description: 'Lookup', parameters: { type: 'object', properties: {}, additionalProperties: false }, strict: true },
      { type: 'mcp', server_label: 'docs', server_url: 'https://mcp.example.com' },
    ])
    expect(events.filter(e => e.type === 'chunk').map((e: any) => e.text)).toEqual(['partial ', 'text'])
    const response = (events.at(-1) as any).response
    expect(response.content).toBe('partial text')
    expect(response.toolCalls).toEqual([{ id: 'call_9', name: 'lookup', arguments: { id: 7 }, rawArguments: '{"id":7}' }])
    expect(response.providerData.responseId).toBe('resp_1')
  })

  it('routes openai-codex through the openaiCodex feature', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')
    const codex = c.feature('openaiCodex') as any
    const runs: any[] = []
    codex.run = async (prompt: string, options: any) => {
      runs.push({ prompt, options })
      return { result: 'codex answer', usage: { input_tokens: 3, output_tokens: 4 } }
    }

    const resolved = await providers.resolve({ provider: 'openai-codex', providerOptions: { cwd: '/tmp/repo' } })
    const events = []
    for await (const event of resolved.transport.stream({
      model: 'gpt-5-codex',
      messages: [{ role: 'system', content: 'Be brief.' }, { role: 'user', content: 'fix it' }],
    }, resolved)) {
      events.push(event)
    }

    expect(runs[0]).toEqual({
      prompt: 'fix it',
      options: {
        cwd: '/tmp/repo',
        model: 'gpt-5-codex',
        config: { developer_instructions: 'Be brief.' },
      },
    })
    expect(events.map(e => e.type)).toEqual(['chunk', 'response'])
    expect((events.at(-1) as any).response.content).toBe('codex answer')
  })

  it('runs claude headlessly and wires a luca MCP server when providerOptions.assistant is set', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')

    const runs: any[] = []
    const fakeClaudeCode = {
      run: async (prompt: string, options: any) => {
        runs.push({ prompt, options })
        return { status: 'completed', result: 'mcp-wired response', sessionId: 'claude-sess-1', costUsd: 0.01, turns: 1 }
      },
    }

    providers.registerTransport('claude-session', new ClaudeSessionTransport(c, { claudeCode: fakeClaudeCode }))

    const resolved = await providers.resolve({
      provider: 'claude-code',
      providerOptions: { id: 'reviewer', cwd: '/tmp/repo', assistant: 'reviewer', lucaBin: '/usr/local/bin/luca', permissionMode: 'bypassPermissions' },
    })

    const events = []
    for await (const event of resolved.transport.stream({
      model: 'claude-code',
      messages: [{ role: 'system', content: 'Be terse.' }, { role: 'user', content: 'review the diff' }],
    }, resolved)) {
      events.push(event)
    }

    expect(runs.length).toBe(1)
    expect(runs[0].prompt).toBe('review the diff')
    expect(runs[0].options.cwd).toBe('/tmp/repo')
    // 'claude-code' is the placeholder default model — it must not be forwarded.
    expect(runs[0].options.model).toBeUndefined()
    expect(runs[0].options.appendSystemPrompt).toBe('Be terse.')
    expect(runs[0].options.permissionMode).toBe('bypassPermissions')
    const server = runs[0].options.mcpServers['luca-reviewer']
    expect(server.command).toBe('/usr/local/bin/luca')
    expect(server.args).toEqual(['mcp', '--assistant', 'reviewer', '--transport', 'stdio'])

    const final = events.at(-1) as any
    expect(final.response.content).toBe('mcp-wired response')
    expect(final.response.providerData).toEqual({ claudeSessionId: 'claude-sess-1' })
  })

  it('resumes claude session across turns and skips MCP wiring when assistant is false', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')

    const runs: any[] = []
    const fakeClaudeCode = {
      run: async (prompt: string, options: any) => {
        runs.push({ prompt, options })
        return { status: 'completed', result: `turn ${runs.length}`, sessionId: 'sess-abc' }
      },
    }

    providers.registerTransport('claude-session', new ClaudeSessionTransport(c, { claudeCode: fakeClaudeCode }))

    const resolved = await providers.resolve({
      provider: 'claude-code',
      providerOptions: { id: 'plain', assistant: false },
    })

    // First turn — no resume, no MCP wiring.
    for await (const _e of resolved.transport.stream({ model: 'claude-code', messages: [{ role: 'user', content: 'hi' }] }, resolved)) { /* drain */ }
    // Second turn — carry the captured session id back in as previousProviderData.
    for await (const _e of resolved.transport.stream({
      model: 'claude-code',
      messages: [{ role: 'user', content: 'again' }],
      providerOptions: { previousProviderData: { claudeSessionId: 'sess-abc' } },
    }, resolved)) { /* drain */ }

    expect(runs.length).toBe(2)
    expect(runs[0].options.mcpServers).toBeUndefined()
    expect(runs[0].options.resumeSessionId).toBeUndefined()
    expect(runs[1].options.resumeSessionId).toBe('sess-abc')
  })
})
