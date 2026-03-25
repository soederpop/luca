import { describe, it, expect, beforeAll, afterAll } from 'bun:test'

describe('Python Persistent Session', () => {
  let container: any
  let python: any

  beforeAll(async () => {
    const mod = await import('../src/node.js')
    container = mod.default
    python = container.feature('python', { dir: container.cwd })
    await python.enable()
    await python.startSession()
  })

  afterAll(async () => {
    if (python?.state?.get('sessionActive')) {
      await python.stopSession()
    }
  })

  it('session is active after start', () => {
    expect(python.state.get('sessionActive')).toBe(true)
    expect(python.state.get('sessionId')).toBeTruthy()
  })

  it('run() executes code and captures stdout', async () => {
    const result = await python.run('print("hello from bridge")')
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('hello from bridge')
  })

  it('state persists across calls', async () => {
    await python.run('x = 42')
    const result = await python.eval('x + 1')
    expect(result).toBe(43)
  })

  it('variables are injected', async () => {
    const result = await python.run('print(name)', { name: 'luca' })
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('luca')
  })

  it('importModule() works', async () => {
    await python.importModule('json')
    const result = await python.eval('json.dumps({"a": 1})')
    expect(result).toBe('{"a": 1}')
  })

  it('call() invokes functions', async () => {
    await python.run('def add(a, b): return a + b')
    const result = await python.call('add', [3, 4])
    expect(result).toBe(7)
  })

  it('getLocals() returns namespace', async () => {
    await python.run('y = 99')
    const locals = await python.getLocals()
    expect(locals.y).toBe(99)
    expect(locals.x).toBe(42)
  })

  it('handles errors gracefully without crashing the session', async () => {
    const result = await python.run('raise ValueError("test error")')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('test error')
    // Session should still be alive
    const check = await python.run('print("still alive")')
    expect(check.ok).toBe(true)
    expect(check.stdout).toContain('still alive')
  })

  it('resetSession() clears state', async () => {
    await python.run('z = 123')
    await python.resetSession()
    const result = await python.run('print(z)')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('is not defined')
  })

  it('stopSession() cleans up', async () => {
    await python.stopSession()
    expect(python.state.get('sessionActive')).toBe(false)
    expect(python.state.get('sessionId')).toBeNull()
  })

  it('can start a new session after stopping', async () => {
    await python.startSession()
    expect(python.state.get('sessionActive')).toBe(true)
    const result = await python.run('print("fresh session")')
    expect(result.ok).toBe(true)
    expect(result.stdout).toContain('fresh session')
  })
})

describe('Python backward compatibility', () => {
  it('execute() still works without a session', async () => {
    const mod = await import('../src/node.js')
    const container = mod.default
    const python = container.feature('python', { dir: container.cwd })
    await python.enable()
    const result = await python.execute('print("stateless")')
    expect(result.stdout).toContain('stateless')
  })
})
