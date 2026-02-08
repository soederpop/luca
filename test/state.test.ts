import { describe, it, expect, vi } from 'vitest'
import { State } from '../src/state'

describe('State', () => {
  it('initializes with empty state by default', () => {
    const state = new State()
    expect(state.current).toEqual({})
    expect(state.version).toBe(0)
  })

  it('initializes with provided initial state', () => {
    const state = new State({ initialState: { count: 0, name: 'test' } })
    expect(state.get('count')).toBe(0)
    expect(state.get('name')).toBe('test')
  })

  it('set and get', () => {
    const state = new State<{ x: number; y: string }>()
    state.set('x', 42)
    state.set('y', 'hello')
    expect(state.get('x')).toBe(42)
    expect(state.get('y')).toBe('hello')
  })

  it('increments version on set', () => {
    const state = new State<{ a: number }>()
    expect(state.version).toBe(0)
    state.set('a', 1)
    expect(state.version).toBe(1)
    state.set('a', 2)
    expect(state.version).toBe(2)
  })

  it('does not increment version when setting same value', () => {
    const state = new State<{ a: number }>()
    state.set('a', 1)
    expect(state.version).toBe(1)
    state.set('a', 1)
    expect(state.version).toBe(1)
  })

  it('has', () => {
    const state = new State<{ a: number }>()
    expect(state.has('a')).toBe(false)
    state.set('a', 1)
    expect(state.has('a')).toBe(true)
  })

  it('delete', () => {
    const state = new State<{ a: number }>()
    state.set('a', 1)
    expect(state.has('a')).toBe(true)
    state.delete('a')
    expect(state.has('a')).toBe(false)
    expect(state.get('a')).toBeUndefined()
  })

  it('keys, entries, values', () => {
    const state = new State<{ a: number; b: string }>()
    state.set('a', 1).set('b', 'two')
    expect(state.keys()).toEqual(['a', 'b'])
    expect(state.entries()).toEqual([['a', 1], ['b', 'two']])
    expect(state.values()).toEqual([1, 'two'])
  })

  it('clear', () => {
    const state = new State<{ a: number; b: string }>()
    state.set('a', 1).set('b', 'two')
    state.clear()
    expect(state.keys()).toEqual([])
    expect(state.current).toEqual({})
  })

  it('setState with partial object', () => {
    const state = new State<{ a: number; b: string }>({ initialState: { a: 0, b: '' } })
    state.setState({ a: 10, b: 'updated' })
    expect(state.get('a')).toBe(10)
    expect(state.get('b')).toBe('updated')
  })

  it('setState with function', () => {
    const state = new State<{ count: number }>({ initialState: { count: 5 } })
    state.setState((current) => ({ count: current.count + 1 }))
    expect(state.get('count')).toBe(6)
  })

  it('observers are notified on add', () => {
    const state = new State<{ a: number }>()
    const observer = vi.fn()
    state.observe(observer)
    state.set('a', 1)
    expect(observer).toHaveBeenCalledWith('add', 'a', 1)
  })

  it('observers are notified on update', () => {
    const state = new State<{ a: number }>({ initialState: { a: 0 } })
    const observer = vi.fn()
    state.observe(observer)
    state.set('a', 5)
    expect(observer).toHaveBeenCalledWith('update', 'a', 5)
  })

  it('observers are notified on delete', () => {
    const state = new State<{ a: number }>({ initialState: { a: 1 } })
    const observer = vi.fn()
    state.observe(observer)
    state.delete('a')
    expect(observer).toHaveBeenCalledWith('delete', 'a', 1)
  })

  it('unsubscribe stops notifications', () => {
    const state = new State<{ a: number }>()
    const observer = vi.fn()
    const unsubscribe = state.observe(observer)
    state.set('a', 1)
    expect(observer).toHaveBeenCalledTimes(1)
    unsubscribe()
    state.set('a', 2)
    expect(observer).toHaveBeenCalledTimes(1)
  })
})
