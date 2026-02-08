import { describe, it, expect, vi } from 'vitest'
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
})
