import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'

const container = new NodeContainer()
const cachePath = join(os.tmpdir(), `luca-disk-cache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
const cache = container.feature('diskCache', { path: cachePath })

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms))

describe('diskCache TTL', () => {
  it('stores and reads a value without ttl as before', async () => {
    await cache.set('plain', 'hello')
    expect(await cache.get('plain')).toBe('hello')
    expect(await cache.has('plain')).toBe(true)
  })

  it('preserves user meta alongside ttl', async () => {
    await cache.set('with-meta', 'v', { ttl: 60, kind: 'test' })
    const info = await cache.cache.get.info('with-meta')
    expect(info.metadata.kind).toBe('test')
    expect(typeof info.metadata.expiresAt).toBe('number')
    expect(info.metadata.ttl).toBeUndefined()
  })

  it('returns the value before the ttl elapses', async () => {
    await cache.set('fresh', 'still here', { ttl: 60 })
    expect(await cache.get('fresh')).toBe('still here')
  })

  it('treats an expired entry as a cache miss on get()', async () => {
    await cache.set('expiring', 'gone soon', { ttl: 0.05 })
    expect(await cache.get('expiring')).toBe('gone soon')
    await sleep(80)
    await expect(cache.get('expiring')).rejects.toThrow()
  })

  it('has() returns false for an expired entry', async () => {
    await cache.set('expiring-has', 'x', { ttl: 0.05 })
    expect(await cache.has('expiring-has')).toBe(true)
    await sleep(80)
    expect(await cache.has('expiring-has')).toBe(false)
  })

  it('applies the feature-level ttl default', async () => {
    const ttlCache = container.feature('diskCache', {
      path: join(cachePath, 'ttl-default'),
      ttl: 0.05,
    })
    await ttlCache.set('auto-expire', 'x')
    expect(await ttlCache.get('auto-expire')).toBe('x')
    await sleep(80)
    expect(await ttlCache.has('auto-expire')).toBe(false)
  })

  it('per-set ttl overrides the feature-level default', async () => {
    const ttlCache = container.feature('diskCache', {
      path: join(cachePath, 'ttl-override'),
      ttl: 0.05,
    })
    await ttlCache.set('long-lived', 'x', { ttl: 60 })
    await sleep(80)
    expect(await ttlCache.get('long-lived')).toBe('x')
  })
})
