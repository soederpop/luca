import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Bus } from '../src/bus'

describe('Bus', () => {
  it('emits events to listeners', () => {
    const bus = new Bus()
    const listener = vi.fn()
    bus.on('test', listener)
    bus.emit('test', 'arg1', 'arg2')
    expect(listener).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('supports multiple listeners', () => {
    const bus = new Bus()
    const a = vi.fn()
    const b = vi.fn()
    bus.on('event', a)
    bus.on('event', b)
    bus.emit('event', 42)
    expect(a).toHaveBeenCalledWith(42)
    expect(b).toHaveBeenCalledWith(42)
  })

  it('off removes a specific listener', () => {
    const bus = new Bus()
    const listener = vi.fn()
    bus.on('test', listener)
    bus.off('test', listener)
    bus.emit('test')
    expect(listener).not.toHaveBeenCalled()
  })

  it('off without listener removes all listeners for event', () => {
    const bus = new Bus()
    const a = vi.fn()
    const b = vi.fn()
    bus.on('test', a)
    bus.on('test', b)
    bus.off('test')
    bus.emit('test')
    expect(a).not.toHaveBeenCalled()
    expect(b).not.toHaveBeenCalled()
  })

  it('once fires only once', () => {
    const bus = new Bus()
    const listener = vi.fn()
    bus.once('test', listener)
    bus.emit('test', 'first')
    bus.emit('test', 'second')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener).toHaveBeenCalledWith('first')
  })

  it('waitFor returns a promise that resolves on emit', async () => {
    const bus = new Bus()
    const promise = bus.waitFor('done')
    bus.emit('done', 'result')
    const value = await promise
    expect(value).toBe('result')
  })

  it('emit with no listeners does not throw', () => {
    const bus = new Bus()
    expect(() => bus.emit('nope')).not.toThrow()
  })

  describe('event stats tracking', () => {
    it('tracks fire count for events', () => {
      const bus = new Bus()
      bus.emit('click')
      bus.emit('click')
      bus.emit('click')
      const stats = bus.getEventStats('click')
      expect(stats.fireCount).toBe(3)
      expect(stats.event).toBe('click')
    })

    it('tracks lastFiredAt timestamp', () => {
      const bus = new Bus()
      const before = Date.now()
      bus.emit('ping')
      const after = Date.now()
      const stats = bus.getEventStats('ping')
      expect(stats.lastFiredAt).toBeGreaterThanOrEqual(before)
      expect(stats.lastFiredAt).toBeLessThanOrEqual(after)
    })

    it('returns zero stats for events that never fired', () => {
      const bus = new Bus()
      const stats = bus.getEventStats('ghost')
      expect(stats.fireCount).toBe(0)
      expect(stats.lastFiredAt).toBeNull()
      expect(stats.firesPerMinute).toBe(0)
    })

    it('history returns stats for all fired events', () => {
      const bus = new Bus()
      bus.emit('a')
      bus.emit('b')
      bus.emit('b')
      bus.emit('c')
      const history = bus.history
      expect(history).toHaveLength(3)
      expect(history.find(s => s.event === 'a')?.fireCount).toBe(1)
      expect(history.find(s => s.event === 'b')?.fireCount).toBe(2)
      expect(history.find(s => s.event === 'c')?.fireCount).toBe(1)
    })

    it('firedEvents lists all event names that have been emitted', () => {
      const bus = new Bus()
      bus.emit('x')
      bus.emit('y')
      bus.emit('x')
      expect(bus.firedEvents).toEqual(['x', 'y'])
    })

    it('tracks events even with no listeners', () => {
      const bus = new Bus()
      bus.emit('orphan')
      bus.emit('orphan')
      expect(bus.getEventStats('orphan').fireCount).toBe(2)
    })

    it('computes firesPerMinute for recent events', () => {
      const bus = new Bus()
      bus.emit('rapid')
      bus.emit('rapid')
      bus.emit('rapid')
      const stats = bus.getEventStats('rapid')
      expect(stats.firesPerMinute).toBe(3)
    })
  })
})
