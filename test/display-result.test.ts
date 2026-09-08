import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test'
import { displayResult } from '../src/node/features/display-result'

let log: Mock<typeof console.log>
beforeEach(() => { log = spyOn(console, 'log').mockImplementation(() => {}) })
afterEach(() => log.mockRestore())
const output = () => log.mock.calls.map(args => String(args[0]).replace(/\x1b\[[0-9;]*m/g, '')).join('\n')

describe('displayResult', () => {
  it.each([undefined, null, false, 0, 'text'])('prints primitive %j directly', (value) => {
    displayResult(value)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log).toHaveBeenCalledWith(value)
  })

  it('retains private-looking fields on plain data objects', () => {
    displayResult({ _id: 'database-id', nested: { value: 3 } })
    expect(output()).toContain("_id: 'database-id'")
    expect(output()).toContain('value: 3')
  })

  it('honors custom inspection', () => {
    displayResult({ [Symbol.for('nodejs.util.inspect.custom')]: () => 'custom view' })
    expect(output()).toBe('custom view')
  })

  it('shows public instance data and sorted inherited methods without evaluating getters', () => {
    class Base {
      inherited() {}
      duplicate() {}
      get expensive() { throw new Error('must not invoke getters') }
      _privateMethod() {}
    }
    class Example extends Base {
      name = 'visible'
      _secret = 'hidden'
      action = () => {}
      override duplicate() {}
      get alpha() { return 1 }
    }
    displayResult(new Example())
    expect(output()).toContain("Example { name: 'visible' }")
    expect(output()).toContain('getters: alpha, expensive')
    expect(output()).toContain('methods: action(), duplicate(), inherited()')
    expect(output()).not.toContain('hidden')
    expect(output()).not.toContain('_privateMethod')
    expect(log).toHaveBeenCalledTimes(2)
  })

  it('does not print an empty method section for data-only instances', () => {
    class Data { value = 42 }
    displayResult(new Data())
    expect(output()).toBe('Data { value: 42 }')
    expect(log).toHaveBeenCalledTimes(1)
  })

  it('handles null-prototype and circular data', () => {
    const data = Object.assign(Object.create(null), { value: 7 })
    data.self = data
    displayResult(data)
    expect(output()).toContain('value: 7')
    expect(output()).toContain('[Circular')
  })
})
