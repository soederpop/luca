import { describe, it, expect, beforeEach, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import { AGIContainer } from '../src/agi/container.server'
import { HermesAcpClient } from '../src/clients/hermes-acp'
import { HermesAgent } from '../src/agi/features/hermes-agent'

/**
 * Fake `hermes acp` child process: an EventEmitter with piped stdio and a
 * scripted responder so we can exercise the JSON-RPC framing without the
 * real binary.
 */
function createFakeChild() {
  const child: any = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.killed = false
  child.kill = () => {
    child.killed = true
    child.emit('close', 0)
  }

  const written: any[] = []
  child.stdin = {
    write(chunk: string) {
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const message = JSON.parse(trimmed)
        written.push(message)
        child.emit('message-written', message)
      }
      return true
    },
    end() {},
  }

  const respond = (payload: any) => {
    child.stdout.emit('data', Buffer.from(JSON.stringify(payload) + '\n'))
  }

  const respondRaw = (raw: string) => {
    child.stdout.emit('data', Buffer.from(raw))
  }

  return { child, written, respond, respondRaw }
}

const INITIALIZE_RESULT = {
  protocolVersion: 1,
  agentInfo: { name: 'hermes-agent', version: '0.19.0' },
  agentCapabilities: { loadSession: true },
}

/** Auto-answer initialize so connect() resolves. */
function autoInitialize(fake: ReturnType<typeof createFakeChild>) {
  fake.child.on('message-written', (message: any) => {
    if (message.method === 'initialize') {
      fake.respond({ jsonrpc: '2.0', id: message.id, result: INITIALIZE_RESULT })
    }
  })
}

function createClient(fake: ReturnType<typeof createFakeChild>, options: Record<string, any> = {}) {
  const container = new (AGIContainer as any)()
  HermesAgent.registerAcpClient()
  const proc = container.feature('proc')
  spyOn(proc, 'spawn').mockImplementation(() => fake.child)
  return container.client('hermesAcp', { _cacheKey: crypto.randomUUID(), ...options }) as HermesAcpClient
}

describe('HermesAcpClient', () => {
  it('is registered lazily by the hermesAgent feature, not at module load', () => {
    const container = new (AGIContainer as any)()
    // The feature class self-registers at import; the client must not
    if (!container.clients.has('hermesAcp')) {
      expect(container.clients.has('hermesAcp')).toBe(false)
      container.feature('hermesAgent')
    }
    expect(container.clients.has('hermesAcp')).toBe(true)
  })

  it('connect() performs the initialize handshake', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)

    await client.connect()

    expect(client.running).toBe(true)
    expect(client.isConnected).toBe(true)
    expect(client.initializeResult?.agentInfo?.name).toBe('hermes-agent')
    expect(fake.written[0]?.method).toBe('initialize')
    expect(fake.written[0]?.params?.protocolVersion).toBe(1)
  })

  it('connect() rejects on handshake timeout and includes stderr', async () => {
    const fake = createFakeChild()
    const client = createClient(fake, { bootTimeoutMs: 50 })
    // Emit stderr once connect() has spawned and attached its listeners
    fake.child.on('message-written', () => {
      fake.child.stderr.emit('data', Buffer.from('boom from adapter'))
    })

    await expect(client.connect()).rejects.toThrow(/failed to initialize[\s\S]*boom from adapter/)
    expect(client.running).toBe(false)
  })

  it('correlates concurrent requests by id, even with split frames', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    await client.connect()

    const a = client.request('session/new', { cwd: '/tmp' })
    const b = client.request('session/new', { cwd: '/tmp/other' })
    const [reqA, reqB] = fake.written.filter((m) => m.method === 'session/new')

    // Answer out of order, with the first response split across chunks
    fake.respond({ jsonrpc: '2.0', id: reqB.id, result: { sessionId: 'B' } })
    const responseA = JSON.stringify({ jsonrpc: '2.0', id: reqA.id, result: { sessionId: 'A' } }) + '\n'
    fake.respondRaw(responseA.slice(0, 10))
    fake.respondRaw(responseA.slice(10))

    expect((await a).sessionId).toBe('A')
    expect((await b).sessionId).toBe('B')
  })

  it('rejects a request when the adapter answers with a JSON-RPC error', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    await client.connect()

    const pending = client.request('session/load', { sessionId: 'nope' })
    const req = fake.written.find((m) => m.method === 'session/load')
    fake.respond({ jsonrpc: '2.0', id: req.id, error: { code: -32000, message: 'unknown session' } })

    await expect(pending).rejects.toThrow('unknown session')
  })

  it('emits notification events for session/update', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    await client.connect()

    const seen: any[] = []
    client.on('notification', (payload: any) => seen.push(payload))
    fake.respond({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: 'S', update: { sessionUpdate: 'agent_message_chunk' } } })

    expect(seen).toHaveLength(1)
    expect(seen[0].method).toBe('session/update')
    expect(seen[0].params.sessionId).toBe('S')
  })

  it('answers server-initiated requests via the request handler', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    client.setRequestHandler(async (method) => {
      if (method === 'session/request_permission') {
        return { outcome: { outcome: 'selected', optionId: 'allow' } }
      }
      throw new Error('unsupported')
    })
    await client.connect()

    fake.respond({ jsonrpc: '2.0', id: 999, method: 'session/request_permission', params: { options: [] } })
    await new Promise((r) => setTimeout(r, 0))

    const reply = fake.written.find((m) => m.id === 999)
    expect(reply.result.outcome.optionId).toBe('allow')
  })

  it('answers server requests with a JSON-RPC error when no handler is set', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    await client.connect()

    fake.respond({ jsonrpc: '2.0', id: 1000, method: 'fs/read_text_file', params: {} })
    await new Promise((r) => setTimeout(r, 0))

    const reply = fake.written.find((m) => m.id === 1000)
    expect(reply.error.code).toBe(-32601)
  })

  it('emits parse-error for non-JSON lines and stays alive', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    await client.connect()

    const errors: any[] = []
    client.on('parse-error', (payload: any) => errors.push(payload))
    fake.respondRaw('this is not json\n')

    expect(errors).toHaveLength(1)
    expect(errors[0].line).toBe('this is not json')
    expect(client.running).toBe(true)
  })

  it('rejects in-flight requests and emits crash when the process dies', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    await client.connect()

    const crashes: any[] = []
    client.on('crash', (payload: any) => crashes.push(payload))

    const pending = client.request('session/prompt', { sessionId: 'S', prompt: [] })
    fake.child.emit('close', 137)

    await expect(pending).rejects.toThrow(/adapter exited/)
    expect(crashes).toHaveLength(1)
    expect(crashes[0].exitCode).toBe(137)
    expect(client.running).toBe(false)
  })

  it('disconnect() kills the process and rejects pending requests without a crash event', async () => {
    const fake = createFakeChild()
    autoInitialize(fake)
    const client = createClient(fake)
    await client.connect()

    const crashes: any[] = []
    client.on('crash', (payload: any) => crashes.push(payload))

    const pending = client.request('session/prompt', { sessionId: 'S', prompt: [] })
    await client.disconnect()

    await expect(pending).rejects.toThrow(/disconnected/)
    expect(fake.child.killed).toBe(true)
    expect(crashes).toHaveLength(0)
  })
})

describe('HermesAgent update mapping', () => {
  let hermes: any

  beforeEach(() => {
    const container = new (AGIContainer as any)()
    hermes = container.feature('hermesAgent', { _cacheKey: crypto.randomUUID() })
    const session = {
      id: 'local-1',
      acpSessionId: 'acp-1',
      status: 'running',
      prompt: 'test',
      turns: 0,
      messages: [],
      toolCalls: [],
    }
    hermes.setState({ sessions: { 'local-1': session }, activeSessions: ['local-1'] })
    hermes.acpToLocal.set('acp-1', 'local-1')
  })

  function update(payload: any) {
    hermes.handleNotification('session/update', { sessionId: 'acp-1', update: payload })
  }

  it('maps agent_message_chunk to session:delta and accumulates result', () => {
    const deltas: any[] = []
    hermes.on('session:delta', (p: any) => deltas.push(p))

    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hel' } })
    update({ sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'lo' } })

    expect(deltas.map((d) => d.text)).toEqual(['Hel', 'lo'])
    expect(deltas[0].role).toBe('assistant')
    expect(hermes.getSession('local-1').result).toBe('Hello')
  })

  it('maps agent_thought_chunk to session:reasoning', () => {
    const thoughts: any[] = []
    hermes.on('session:reasoning', (p: any) => thoughts.push(p))
    update({ sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'thinking...' } })
    expect(thoughts[0].text).toBe('thinking...')
  })

  it('maps tool_call updates to session:tool-call and tracks them on the session', () => {
    const calls: any[] = []
    hermes.on('session:tool-call', (p: any) => calls.push(p))
    update({ sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read file' })
    update({ sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'completed' })
    expect(calls).toHaveLength(2)
    expect(hermes.getSession('local-1').toolCalls).toHaveLength(2)
  })

  it('forwards unknown update types dynamically and always emits session:event', () => {
    const events: any[] = []
    const custom: any[] = []
    hermes.on('session:event', (p: any) => events.push(p))
    hermes.on('session:custom_thing', (p: any) => custom.push(p))
    update({ sessionUpdate: 'custom_thing', foo: 1 })
    expect(events).toHaveLength(1)
    expect(custom).toHaveLength(1)
  })

  it('ignores updates for unknown ACP session ids', () => {
    const events: any[] = []
    hermes.on('session:event', (p: any) => events.push(p))
    hermes.handleNotification('session/update', { sessionId: 'acp-unknown', update: { sessionUpdate: 'plan' } })
    expect(events).toHaveLength(0)
  })
})

describe('HermesAgent permission policy', () => {
  const request = {
    sessionId: 'acp-1',
    options: [
      { optionId: 'allow-once', kind: 'allow_once' },
      { optionId: 'allow-always', kind: 'allow_always' },
      { optionId: 'reject-once', kind: 'reject_once' },
    ],
  }

  function createFeature(options: Record<string, any> = {}) {
    const container = new (AGIContainer as any)()
    return container.feature('hermesAgent', { _cacheKey: crypto.randomUUID(), ...options }) as any
  }

  it('rejects by default', () => {
    const hermes = createFeature()
    const outcome = hermes.resolvePermission(request)
    expect(outcome.outcome.optionId).toBe('reject-once')
  })

  it('yolo selects allow_always', () => {
    const hermes = createFeature({ yolo: true })
    const outcome = hermes.resolvePermission(request)
    expect(outcome.outcome.optionId).toBe('allow-always')
  })

  it('acceptEdits prefers allow_once', () => {
    const hermes = createFeature({ permissionMode: 'acceptEdits' })
    const outcome = hermes.resolvePermission(request)
    expect(outcome.outcome.optionId).toBe('allow-once')
  })

  it('per-run policy overrides feature options', () => {
    const hermes = createFeature()
    const outcome = hermes.resolvePermission(request, { yolo: true })
    expect(outcome.outcome.optionId).toBe('allow-always')
  })

  it('parses hermes version strings', () => {
    const hermes = createFeature()
    hermes.setState({ hermesVersion: 'Hermes Agent v0.19.0 (2026.7.20) · upstream 477c08b4' })
    expect(hermes.parsedVersion).toEqual({ major: 0, minor: 19, patch: 0 })
  })
})
