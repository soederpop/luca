import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node'

const container: any = await new NodeContainer({ cwd: process.cwd() }).start()
const vm = container.feature('vm')

describe('vm top-level return recovery', () => {
  it('run(): a top-level return produces the returned value', async () => {
    expect(await vm.run('return 42')).toBe(42)
  })

  it('run(): return with preceding statements and context vars', async () => {
    expect(await vm.run('const doubled = n * 2\nreturn doubled + 1', { n: 20 })).toBe(41)
  })

  it('run(): top-level await and return together', async () => {
    expect(await vm.run('const x = await Promise.resolve(21)\nreturn x * 2')).toBe(42)
  })

  it('runSync(): a top-level return produces the returned value', () => {
    expect(vm.runSync('return 1 + 1')).toBe(2)
  })

  it('perform(): return works and resolves the result', async () => {
    const { result } = await vm.perform('return "hi"')
    expect(result).toBe('hi')
  })

  it('performSync(): return works', () => {
    expect(vm.performSync('return [1, 2, 3]').result).toEqual([1, 2, 3])
  })

  it('runCaptured(): return value and console capture coexist', async () => {
    const { result, console: calls } = await vm.runCaptured('console.log("before"); return 7')
    expect(result).toBe(7)
    expect(calls).toEqual([{ method: 'log', args: ['before'] }])
  })

  it('genuine syntax errors still surface unchanged', async () => {
    // instanceof SyntaxError fails across realms — the error is constructed
    // inside the vm context — so assert on the name instead.
    let caught: any = null
    try { await vm.run('const = broken') } catch (err) { caught = err }
    expect(caught?.name).toBe('SyntaxError')
    expect(caught?.message).not.toMatch(/return/i)
  })

  it('a return inside a string does not trigger recovery semantics', async () => {
    // no top-level return here — final expression value is preserved as before
    expect(await vm.run('const s = "return 99"; s.length')).toBe(9)
  })

  it('final-expression completion values keep working (no regression)', async () => {
    expect(await vm.run('2 + 2')).toBe(4)
    expect(vm.runSync('"a" + "b"')).toBe('ab')
  })

  it('runSync(): return + await stays an error (cannot wrap sync)', () => {
    expect(() => vm.runSync('const x = await Promise.resolve(1)\nreturn x')).toThrow()
  })
})
