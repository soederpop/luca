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
    expect(providers.defaults.openai).toBe('gpt-5.4-mini')
    expect(providers.hasProfile('ollama')).toBe(true)
    expect(providers.hasTransport('openai-responses')).toBe(true)
  })

  it('returns cloned profiles keyed by id', () => {
    const providers = new AGIContainer().feature('modelProviders')
    const profiles = providers.profiles

    profiles.openai!.defaultModel = 'mutated'

    expect(providers.get('openai')?.defaultModel).toBe('gpt-5.4-mini')
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
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'hi' },
      ],
      instructions: 'Answer in one sentence.',
      tools: [{ function: { name: 'lookup', parameters: { type: 'object' } } }],
    }, resolved)) {
      events.push(event)
    }

    expect(calls[0].model).toBe('local-model')
    expect(calls[0].messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      {
        role: 'user',
        content: 'hi\n\nInstructions for this request only:\nAnswer in one sentence.',
      },
    ])
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

  it('merges extraBody into the chat-completions request body, request keys winning over profile keys', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const calls: any[] = []
    const fakeClient = {
      chat: {
        completions: {
          create: async (request: any) => {
            calls.push(request)
            return { choices: [{ message: { content: 'ok' }, finish_reason: 'stop' }] }
          },
        },
      },
    }

    providers.registerProfile({
      id: 'extra-body',
      apiMode: 'openai-chat-completions',
      auth: 'none',
      baseURL: 'http://localhost:9999/v1',
      defaultModel: 'local-model',
      providerOptions: {
        client: fakeClient,
        extraBody: { chat_template_kwargs: { enable_thinking: true }, profile_only: 1 },
      },
    })

    const resolved = await providers.resolve({ provider: 'extra-body' })
    for await (const _event of resolved.transport.stream({
      model: resolved.model,
      messages: [{ role: 'user', content: 'hi' }],
      extraBody: { chat_template_kwargs: { enable_thinking: false } },
    }, resolved)) { /* drain */ }

    // Request-level extraBody replaces the profile's key wholesale; untouched profile keys survive.
    expect(calls[0].chat_template_kwargs).toEqual({ enable_thinking: false })
    expect(calls[0].profile_only).toBe(1)
    expect(calls[0].extraBody).toBeUndefined()
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
      instructions: 'Use one spoken sentence.',
      tools: [{ function: { name: 'lookup', description: 'Lookup', parameters: { type: 'object', properties: {} } } }],
      stream: true,
    }, resolved)) {
      events.push(event)
    }

    expect(calls[0].instructions).toBe('Be terse.\n\nUse one spoken sentence.')
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

describe('ModelProviders default provider selection', () => {
  const ENV_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'LUCA_DEFAULT_PROVIDER', 'LUCA_HOME', 'XDG_CACHE_HOME'] as const

  function withEnv(overrides: Partial<Record<(typeof ENV_KEYS)[number], string>>, fn: () => void | Promise<void>) {
    const saved: Record<string, string | undefined> = {}
    for (const key of ENV_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    for (const [key, value] of Object.entries(overrides)) process.env[key] = value
    const restore = () => {
      for (const key of ENV_KEYS) {
        if (saved[key] === undefined) delete process.env[key]
        else process.env[key] = saved[key]!
      }
    }
    try {
      const result = fn()
      if (result instanceof Promise) return result.finally(restore)
      restore()
    } catch (err) {
      restore()
      throw err
    }
  }

  /** Point LUCA_HOME/XDG_CACHE_HOME at a temp dir, optionally faking an installed local stack. */
  function fakeLocalInstall(tmp: string, installed: boolean) {
    const { mkdirSync, writeFileSync } = require('node:fs')
    const { join } = require('node:path')
    if (!installed) return
    const binDir = join(tmp, 'luca-home', 'llama-cpp', 'b10076', 'build', 'bin')
    mkdirSync(binDir, { recursive: true })
    writeFileSync(join(binDir, 'llama-server'), '#!/bin/sh\n')
    const modelDir = join(tmp, 'cache', 'luca', 'models')
    mkdirSync(modelDir, { recursive: true })
    writeFileSync(join(modelDir, 'hf_unsloth_gemma-4-E2B-it-Q4_K_M.gguf'), 'fake-gguf')
  }

  function tmpDir(): string {
    const { mkdtempSync } = require('node:fs')
    const { tmpdir } = require('node:os')
    const { join } = require('node:path')
    return mkdtempSync(join(tmpdir(), 'luca-mp-test-'))
  }

  it('prefers openai when OPENAI_API_KEY is set', () => {
    return withEnv({ OPENAI_API_KEY: 'sk-test' }, () => {
      const providers = new AGIContainer().feature('modelProviders')
      expect(providers.resolveDefaultId()).toBe('openai')
    })
  })

  it('falls back to local when no API key but the local stack is installed', () => {
    const tmp = tmpDir()
    const { join } = require('node:path')
    fakeLocalInstall(tmp, true)
    return withEnv({ LUCA_HOME: join(tmp, 'luca-home'), XDG_CACHE_HOME: join(tmp, 'cache') }, () => {
      const providers = new AGIContainer().feature('modelProviders')
      expect(providers.resolveDefaultId()).toBe('local')
    })
  })

  it('openai still wins over an installed local stack', () => {
    const tmp = tmpDir()
    const { join } = require('node:path')
    fakeLocalInstall(tmp, true)
    return withEnv({ OPENAI_API_KEY: 'sk-test', LUCA_HOME: join(tmp, 'luca-home'), XDG_CACHE_HOME: join(tmp, 'cache') }, () => {
      const providers = new AGIContainer().feature('modelProviders')
      expect(providers.resolveDefaultId()).toBe('openai')
    })
  })

  it('falls back to anthropic only when an anthropic-messages transport is registered', () => {
    const tmp = tmpDir()
    const { join } = require('node:path')
    return withEnv({ ANTHROPIC_API_KEY: 'sk-ant', LUCA_HOME: join(tmp, 'luca-home'), XDG_CACHE_HOME: join(tmp, 'cache') }, () => {
      const providers = new AGIContainer().feature('modelProviders')
      // No transport registered for anthropic-messages out of the box — never
      // pick a default that would route into NotImplementedTransport.
      expect(providers.resolveDefaultId()).toBeUndefined()
      providers.registerTransport('anthropic-messages', { apiMode: 'anthropic-messages', stream: async function* () {} } as any)
      expect(providers.resolveDefaultId()).toBe('anthropic')
    })
  })

  it('falls back to a user-registered custom provider', () => {
    const tmp = tmpDir()
    const { join } = require('node:path')
    return withEnv({ LUCA_HOME: join(tmp, 'luca-home'), XDG_CACHE_HOME: join(tmp, 'cache') }, () => {
      const providers = new AGIContainer().feature('modelProviders')
      providers.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')
      expect(providers.resolveDefaultId()).toBe('chief')
    })
  })

  it('returns undefined / throws actionably when nothing is available', () => {
    const tmp = tmpDir()
    const { join } = require('node:path')
    return withEnv({ LUCA_HOME: join(tmp, 'luca-home'), XDG_CACHE_HOME: join(tmp, 'cache') }, async () => {
      const providers = new AGIContainer().feature('modelProviders')
      expect(providers.resolveDefaultId()).toBeUndefined()
      expect(() => providers.requireDefaultId()).toThrow(/No model provider is available/)
      expect(() => providers.requireDefaultId()).toThrow(/luca setup/)
      await expect(providers.resolve()).rejects.toThrow(/No model provider is available/)
    })
  })

  it('setDefault pins the default over the automatic selection', () => {
    return withEnv({ OPENAI_API_KEY: 'sk-test' }, () => {
      const providers = new AGIContainer().feature('modelProviders')
      providers.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')
      providers.setDefault('chief')
      expect(providers.resolveDefaultId()).toBe('chief')
      providers.setDefault(undefined)
      expect(providers.resolveDefaultId()).toBe('openai')
    })
  })

  it('LUCA_DEFAULT_PROVIDER env var pins the default', () => {
    return withEnv({ OPENAI_API_KEY: 'sk-test', LUCA_DEFAULT_PROVIDER: 'ollama' }, () => {
      const providers = new AGIContainer().feature('modelProviders')
      expect(providers.resolveDefaultId()).toBe('ollama')
    })
  })

  it('resolve() with no provider routes through the default', () => {
    const tmp = tmpDir()
    const { join } = require('node:path')
    return withEnv({ LUCA_HOME: join(tmp, 'luca-home'), XDG_CACHE_HOME: join(tmp, 'cache') }, async () => {
      const providers = new AGIContainer().feature('modelProviders')
      providers.registerLocal('chief', 'http://chief:1234/v1', 'qwen2.5-32b')
      const resolved = await providers.resolve()
      expect(resolved.id).toBe('chief')
      expect(resolved.model).toBe('qwen2.5-32b')
    })
  })
})

describe('ModelProviders discover()', () => {
  function fakeProbe(live: Record<string, string[]>) {
    return async (url: string, _init: { signal: AbortSignal }) => {
      const models = live[url]
      if (!models) throw new Error(`ECONNREFUSED ${url}`)
      return { ok: true, json: async () => ({ object: 'list', data: models.map(id => ({ id, object: 'model' })) }) }
    }
  }

  it('finds live servers on known localhost ports and skips dead ones', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const found = await providers.discover({
      tailscale: false,
      probe: fakeProbe({
        'http://127.0.0.1:1234/v1/models': ['qwen2.5-32b'],
        'http://127.0.0.1:11434/v1/models': ['llama3.2'],
      }),
    })

    expect(found.length).toBe(2)
    const lmstudio = found.find(s => s.port === 1234)!
    expect(lmstudio.baseURL).toBe('http://127.0.0.1:1234/v1')
    expect(lmstudio.hint).toBe('LM Studio')
    expect(lmstudio.source).toBe('localhost')
    expect(lmstudio.models).toEqual(['qwen2.5-32b'])
    // localhost:1234 is the builtin lmstudio profile — matched, not duplicated
    expect(lmstudio.profileId).toBe('lmstudio')
    expect(found.find(s => s.port === 11434)!.profileId).toBe('ollama')
  })

  it('rejects responses that are not an OpenAI models list', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const found = await providers.discover({
      tailscale: false,
      probe: async () => ({ ok: true, json: async () => ({ hello: 'world' }) }),
    })
    expect(found).toEqual([])
  })

  it('never throws when nothing is listening', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const found = await providers.discover({
      tailscale: false,
      probe: async () => { throw new Error('ECONNREFUSED') },
    })
    expect(found).toEqual([])
  })

  it('register: true creates provider profiles for unknown servers', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const found = await providers.discover({
      tailscale: false,
      hosts: ['192.168.1.50'],
      ports: [8000],
      localhost: false,
      register: true,
      probe: fakeProbe({ 'http://192.168.1.50:8000/v1/models': ['llama-3.3-70b'] }),
    })

    expect(found.length).toBe(1)
    expect(found[0]!.profileId).toBe('192-168-1-50-8000')
    const profile = providers.get('192-168-1-50-8000')!
    expect(profile.baseURL).toBe('http://192.168.1.50:8000/v1')
    expect(profile.defaultModel).toBe('llama-3.3-70b')
    expect(profile.auth).toBe('none')
    expect(profile.apiMode).toBe('openai-chat-completions')

    // Discovering again matches the now-registered profile instead of duplicating
    const again = await providers.discover({
      tailscale: false,
      hosts: ['192.168.1.50'],
      ports: [8000],
      localhost: false,
      register: true,
      probe: fakeProbe({ 'http://192.168.1.50:8000/v1/models': ['llama-3.3-70b'] }),
    })
    expect(again[0]!.profileId).toBe('192-168-1-50-8000')
    expect(providers.profileIds.filter(id => id.startsWith('192-168-1-50')).length).toBe(1)
  })

  it('probes custom ports and hosts', async () => {
    const providers = new AGIContainer().feature('modelProviders')
    const found = await providers.discover({
      tailscale: false,
      localhost: false,
      hosts: ['gpubox'],
      ports: [9999],
      probe: fakeProbe({ 'http://gpubox:9999/v1/models': ['mixtral'] }),
    })
    expect(found.length).toBe(1)
    expect(found[0]!.baseURL).toBe('http://gpubox:9999/v1')
    expect(found[0]!.hint).toBeUndefined()
  })
})

describe('ThinkTagSplitter', () => {
  const { ThinkTagSplitter } = require('../src/agi/features/model-providers')

  function run(chunks: string[]) {
    const splitter = new ThinkTagSplitter()
    let content = ''
    let reasoning = ''
    for (const chunk of chunks) {
      const out = splitter.push(chunk)
      content += out.content
      reasoning += out.reasoning
    }
    const tail = splitter.flush()
    content += tail.content
    reasoning += tail.reasoning
    return { content, reasoning }
  }

  it('passes plain content through untouched', () => {
    expect(run(['hello ', 'world'])).toEqual({ content: 'hello world', reasoning: '' })
  })

  it('routes a leading think block to reasoning', () => {
    expect(run(['<think>hmm, 2+2</think>4'])).toEqual({ content: '4', reasoning: 'hmm, 2+2' })
  })

  it('handles tags split across chunk boundaries', () => {
    expect(run(['<thi', 'nk>deep ', 'thought</th', 'ink>answer'])).toEqual({ content: 'answer', reasoning: 'deep thought' })
  })

  it('treats a think tag after real content as literal text', () => {
    expect(run(['the tag is <think> ok'])).toEqual({ content: 'the tag is <think> ok', reasoning: '' })
  })

  it('allows leading whitespace before the opening tag', () => {
    expect(run(['\n  <think>x</think>y'])).toEqual({ content: '\n  y', reasoning: 'x' })
  })

  it('flushes an unterminated think block as reasoning', () => {
    expect(run(['<think>never closed'])).toEqual({ content: '', reasoning: 'never closed' })
  })

  it('does not hold back angle brackets that cannot start a tag', () => {
    const splitter = new ThinkTagSplitter()
    const out = splitter.push('a < b')
    expect(out.content).toBe('a < b')
  })
})

describe('reasoning stream events', () => {
  const makeFakeClient = () => ({ chat: { completions: { create: async () => {
    async function* chunks() {
      yield { choices: [{ delta: { reasoning_content: 'let me think. ' } }] }
      yield { choices: [{ delta: { content: '<think>more tho' } }] }
      yield { choices: [{ delta: { content: 'ughts</think>the answer' } }] }
      yield { choices: [{ delta: { content: ' is 4' }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }
    }
    return chunks()
  } } } })

  it('chat transport emits reasoning from reasoning_content deltas and inline think tags, keeping content clean', async () => {
    const container = new AGIContainer()
    const providers = container.feature('modelProviders')
    const provider = await providers.resolve({
      provider: { id: 'test-think', apiMode: 'openai-chat-completions', auth: 'none' },
      providerOptions: { client: makeFakeClient() },
    })
    const events: any[] = []
    for await (const event of provider.transport.stream({ model: 'm', messages: [], stream: true }, provider)) events.push(event)
    const reasoning = events.filter(e => e.type === 'reasoning').map(e => e.text).join('')
    const content = events.filter(e => e.type === 'chunk').map(e => e.text).join('')
    expect(reasoning).toBe('let me think. more thoughts')
    expect(content).toBe('the answer is 4')
    expect(events.at(-1).response.content).toBe('the answer is 4')
  })

  it('conversation re-emits reasoning and keeps it out of the response and history', async () => {
    const container = new AGIContainer()
    const conv = container.feature('conversation', {
      cached: false,
      provider: { id: 'test-think-conv', apiMode: 'openai-chat-completions', auth: 'none' },
      providerOptions: { client: makeFakeClient() },
      history: [{ role: 'system', content: 'sys' }],
    }) as any
    const reasoning: string[] = []
    conv.on('reasoning', (text: string) => reasoning.push(text))
    const answer = await conv.ask('2+2?')
    expect(answer).toBe('the answer is 4')
    expect(reasoning.join('')).toBe('let me think. more thoughts')
    expect(conv.messages.at(-1).content).toBe('the answer is 4')
    expect(JSON.stringify(conv.messages)).not.toContain('more thoughts')
  })
})
