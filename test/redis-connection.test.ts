import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'

// Redis connection-state fixes — verified against a DEAD port on purpose, so
// no live redis server is required:
// - the 'connect' event owns state.connected (no more connected: true lies)
// - ping() is timeout-safe and never hangs
// - ensureConnected() throws a descriptive error instead of hanging
// - a default commandTimeout is passed to ioredis

describe('Redis connection state (no live server required)', () => {
  const container = new NodeContainer()
  const deadUrl = 'redis://localhost:59987'
  const features: any[] = []

  const deadRedis = (opts: Record<string, any> = {}) => {
    const redis = container.feature('redis', { url: deadUrl, ...opts })
    features.push(redis)
    return redis
  }

  afterAll(async () => {
    for (const redis of features) {
      try { await redis.close() } catch {}
    }
  })

  it('does NOT claim connected before a connection exists', () => {
    const redis = deadRedis()
    // the old constructor unconditionally set connected: true here
    expect(redis.state.get('connected')).toBe(false)
    expect(redis.state.get('url')).toBe(deadUrl)
  })

  it('ping() resolves false against a dead server and respects its timeout', async () => {
    const redis = deadRedis({ _cacheKey: 'ping-test' })
    const started = Date.now()
    const alive = await redis.ping(500)
    const elapsed = Date.now() - started

    expect(alive).toBe(false)
    expect(elapsed).toBeLessThan(3000)   // never hangs
  })

  it('ensureConnected() throws a descriptive error naming the url', async () => {
    const redis = deadRedis({ _cacheKey: 'ensure-test' })

    let caught: any
    try {
      await redis.ensureConnected(500)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught.message).toContain(deadUrl)
    expect(caught.message).toContain('500ms')
  })

  it('passes a default commandTimeout to ioredis (overridable via options)', () => {
    const redis = deadRedis({ _cacheKey: 'timeout-default' })
    expect((redis.client as any).options.commandTimeout).toBe(10000)

    const custom = deadRedis({ _cacheKey: 'timeout-custom', commandTimeout: 1234 })
    expect((custom.client as any).options.commandTimeout).toBe(1234)
  })
})
