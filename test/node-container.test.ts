import { describe, it, expect, vi } from 'vitest'
import { NodeContainer } from '../src/node/container'

describe('NodeContainer', () => {
  it('creates a container with a uuid', () => {
    const c = new NodeContainer()
    expect(c.uuid).toBeDefined()
    expect(typeof c.uuid).toBe('string')
    expect(c.uuid.length).toBeGreaterThan(0)
  })

  it('has a cwd', () => {
    const c = new NodeContainer()
    expect(c.cwd).toBe(process.cwd())
  })

  it('accepts a custom cwd', () => {
    const c = new NodeContainer({ cwd: '/tmp' })
    expect(c.cwd).toBe('/tmp')
  })

  it('detects node environment', () => {
    const c = new NodeContainer()
    expect(c.isNode).toBe(true)
    expect(c.isBrowser).toBe(false)
  })

  it('has state with started=false initially', () => {
    const c = new NodeContainer()
    expect(c.currentState.started).toBe(false)
  })

  it('start() sets started state and emits event', async () => {
    const c = new NodeContainer()
    const listener = vi.fn()
    c.on('started', listener)
    await c.start()
    expect(c.currentState.started).toBe(true)
    expect(listener).toHaveBeenCalled()
  })

  it('has utils with hashObject, stringUtils, uuid, lodash', () => {
    const c = new NodeContainer()
    expect(typeof c.utils.hashObject).toBe('function')
    expect(typeof c.utils.stringUtils.camelCase).toBe('function')
    expect(typeof c.utils.stringUtils.kebabCase).toBe('function')
    expect(typeof c.utils.uuid).toBe('function')
    expect(typeof c.utils.lodash.uniq).toBe('function')
  })

  it('utils.hashObject produces deterministic results', () => {
    const c = new NodeContainer()
    const a = c.utils.hashObject({ x: 1, y: 2 })
    const b = c.utils.hashObject({ x: 1, y: 2 })
    expect(a).toBe(b)
  })

  it('paths.resolve works relative to cwd', () => {
    const c = new NodeContainer({ cwd: '/tmp' })
    expect(c.paths.resolve('foo')).toBe('/tmp/foo')
    expect(c.paths.resolve('foo', 'bar')).toBe('/tmp/foo/bar')
  })

  it('paths.join works relative to cwd', () => {
    const c = new NodeContainer({ cwd: '/tmp' })
    expect(c.paths.join('a', 'b')).toBe('/tmp/a/b')
  })

  it('bus() creates a new Bus instance', () => {
    const c = new NodeContainer()
    const bus = c.bus()
    expect(typeof bus.on).toBe('function')
    expect(typeof bus.emit).toBe('function')
  })

  it('newState() creates a new State instance', () => {
    const c = new NodeContainer()
    const state = c.newState({ count: 0 })
    expect(state.get('count')).toBe(0)
    state.set('count', 5)
    expect(state.get('count')).toBe(5)
  })

  it('event system works (on, emit, off)', () => {
    const c = new NodeContainer()
    const listener = vi.fn()
    c.on('custom', listener)
    c.emit('custom', 'hello')
    expect(listener).toHaveBeenCalledWith('hello')
    c.off('custom', listener)
    c.emit('custom', 'world')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('waitFor resolves when event fires', async () => {
    const c = new NodeContainer()
    const promise = c.waitFor('ready')
    c.emit('ready', 42)
    expect(await promise).toBe(42)
  })

  it('each container gets a unique uuid', () => {
    const a = new NodeContainer()
    const b = new NodeContainer()
    expect(a.uuid).not.toBe(b.uuid)
  })

  describe('plugin system', () => {
    it('use() with a plugin object calls attach', () => {
      const c = new NodeContainer()
      const plugin = { attach: vi.fn() }
      c.use(plugin)
      expect(plugin.attach).toHaveBeenCalledWith(c, {})
    })

    it('use() with an unknown feature string throws', () => {
      const c = new NodeContainer()
      expect(() => c.use('nonexistent_feature_xyz' as any)).toThrow()
    })
  })
})
