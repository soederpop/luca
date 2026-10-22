import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * The run methods accept TypeScript without being told: code that fails to
 * parse as JS is transpiled, valid JS runs untouched.
 */
describe('VM — TypeScript accepted by the run methods', () => {
  const vm = () => new NodeContainer().feature('vm')

  it('run strips type annotations and returns the final expression', async () => {
    expect(await vm().run('const x: number = 2\nx * 3')).toBe(6)
  })

  it('runSync accepts interfaces, generics, and casts', () => {
    const code = [
      'interface P { a: number }',
      'function id<T>(v: T): T { return v }',
      'const p: P = { a: (5 as unknown) as number }',
      'id<number>(p.a)',
    ].join('\n')
    expect(vm().runSync(code)).toBe(5)
  })

  it('run handles TypeScript with top-level await', async () => {
    expect(await vm().run('const r: number = await Promise.resolve(7)\nr')).toBe(7)
  })

  it('perform and performSync accept TypeScript', async () => {
    expect((await vm().perform('const s: string = "a"\ns + "b"')).result).toBe('ab')
    expect(vm().performSync('const n: number = 1\nn + 1').result).toBe(2)
  })

  it('runCaptured accepts TypeScript', async () => {
    const { result, console: calls } = await vm().runCaptured('const m: string = "hi"\nconsole.log(m)\nm')
    expect(result).toBe('hi')
    expect(calls[0]!.args).toEqual(['hi'])
  })

  it('rewrites import to require', async () => {
    const result = await vm().run('import { join } from "path"\njoin("a", "b")', { require })
    expect(result).toBe('a/b')
  })

  it('reports the caller\'s own syntax error when the code is broken either way', async () => {
    await expect(vm().run('const = ;')).rejects.toThrow()
  })

  it('leaves valid JS alone, so declarations still land on a shared context', async () => {
    const v = vm()
    const ctx = v.createContext({})
    await v.run('var counter = 1', ctx)
    expect(await v.run('counter + 1', ctx)).toBe(2)
  })
})
