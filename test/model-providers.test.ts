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

  it('bootstraps an MCP server for claude-session when providerOptions.assistant is set', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')

    const constructed: any[] = []
    const writtenConfigs: any[] = []
    class FakeController {
      args: string[]
      constructor(options: any) {
        this.args = options.args ?? []
        constructed.push(options)
      }
      ask = async () => 'mcp-wired response'
      get snapshot() { return undefined }
    }

    const claudeCode = c.feature('claudeCode') as any
    claudeCode.writeMcpConfig = async (servers: Record<string, any>) => {
      writtenConfigs.push(servers)
      return '/tmp/luca-mcp-fake.json'
    }

    providers.registerTransport('claude-session', new ClaudeSessionTransport(c, { controllerClass: FakeController as any }))

    const resolved = await providers.resolve({
      provider: 'claude-code',
      providerOptions: { id: 'reviewer', cwd: '/tmp/repo', assistant: 'reviewer', lucaBin: '/usr/local/bin/luca' },
    })

    const events = []
    for await (const event of resolved.transport.stream({
      model: 'claude-code',
      messages: [{ role: 'user', content: 'review the diff' }],
    }, resolved)) {
      events.push(event)
    }

    expect(constructed.length).toBe(1)
    const args: string[] = constructed[0].args
    expect(args).toContain('--mcp-config')
    expect(args).toContain('/tmp/luca-mcp-fake.json')
    expect(args).toContain('--strict-mcp-config')

    expect(writtenConfigs.length).toBe(1)
    const server = writtenConfigs[0]['luca-reviewer']
    expect(server.command).toBe('/usr/local/bin/luca')
    expect(server.args).toEqual(['mcp', '--assistant', 'reviewer', '--transport', 'stdio'])

    expect((events.at(-1) as any).response.content).toBe('mcp-wired response')
  })

  it('skips MCP wiring when providerOptions.assistant is false', async () => {
    const c = new AGIContainer()
    const providers = c.feature('modelProviders')

    const constructed: any[] = []
    class FakeController {
      args: string[]
      constructor(options: any) {
        this.args = options.args ?? []
        constructed.push(options)
      }
      ask = async () => 'plain response'
      get snapshot() { return undefined }
    }

    let writeCalled = false
    const claudeCode = c.feature('claudeCode') as any
    claudeCode.writeMcpConfig = async () => {
      writeCalled = true
      return '/tmp/should-not-be-used.json'
    }

    providers.registerTransport('claude-session', new ClaudeSessionTransport(c, { controllerClass: FakeController as any }))

    const resolved = await providers.resolve({
      provider: 'claude-code',
      providerOptions: { id: 'plain', assistant: false },
    })

    for await (const _event of resolved.transport.stream({
      model: 'claude-code',
      messages: [{ role: 'user', content: 'hi' }],
    }, resolved)) {
      // drain
    }

    expect(writeCalled).toBe(false)
    expect(constructed[0].args).toEqual([])
  })
})
