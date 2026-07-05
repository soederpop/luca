import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * Behavior tests for the boundary-scan + parse-probe rewrite of
 * VM.wrapTopLevelAwait. The old implementation injected `return` by splitting
 * the last LINE on `;`, which mangled multi-line final expressions and
 * semicolons inside strings. These tests pin the new contract:
 *
 * - top-level-await code returns the value of its final expression
 * - code whose `await` is not top-level runs UNWRAPPED (declarations persist)
 * - declaration/loop-final programs resolve undefined but still execute fully
 */
describe('VM.wrapTopLevelAwait — return injection', () => {
  const vm = () => new NodeContainer().feature('vm')

  it('returns the full value of a multi-line final expression (round-3 agent repro)', async () => {
    const result = await vm().run(`
const r = await Promise.resolve({ status: 200, ok: true })
JSON.stringify({
  status: r.status,
  ok: r.ok
}, null, 2)
`)
    expect(JSON.parse(result as string)).toEqual({ status: 200, ok: true })
  })

  it('is not confused by semicolons inside string literals on the final line', async () => {
    const result = await vm().run(
      `const names = await Promise.resolve(['a', 'b']); names.join("; ")`
    )
    expect(result).toBe('a; b')
  })

  it('returns a multi-line method chain as one expression', async () => {
    const result = await vm().run(`
const arr = await Promise.resolve([1, 2, 3])
arr
  .map(x => x * 2)
  .join(',')
`)
    expect(result).toBe('2,4,6')
  })

  it('respects ASI hazards: a continuation line is not split off', async () => {
    const result = await vm().run(`
const a = await Promise.resolve(1)
a
+ 2
`)
    expect(result).toBe(3)
  })

  it('returns the value of a bare single await expression', async () => {
    expect(await vm().run(`await Promise.resolve(42)`)).toBe(42)
  })

  it('leaves code unchanged when await only appears inside a string', async () => {
    const feature = vm()
    const code = `const note = "we await the results"; note.length`
    expect(feature.wrapTopLevelAwait(code)).toBe(code)
  })

  it('does not wrap a nested async function, so its declaration persists in a shared context', async () => {
    const feature = vm()
    const shared = feature.createContext({})
    await feature.run(`const go = async () => { await Promise.resolve(1); return 'went' }`, shared)
    // If the nested-async code had been IIFE-wrapped, `go` would be scoped to
    // the wrapper and invisible here.
    expect(await feature.run(`await go()`, shared)).toBe('went')
  })

  it('runs an await-loop ending in `}` to completion, resolving undefined', async () => {
    const feature = vm()
    const shared = feature.createContext({ hits: [] as number[] })
    const result = await feature.run(`
for (const n of [1, 2, 3]) {
  hits.push(await Promise.resolve(n))
}
`, shared)
    expect(result).toBeUndefined()
    expect(shared.hits).toEqual([1, 2, 3])
  })

  it('resolves undefined for a declaration-final program but keeps its side effects', async () => {
    const feature = vm()
    const shared = feature.createContext({ out: {} as any })
    const result = await feature.run(`
out.value = 'before'
const y = await Promise.resolve('after')
out.value = y
const z = y.toUpperCase()
`, shared)
    expect(result).toBeUndefined()
    expect(shared.out.value).toBe('after')
  })

  it('returns the assigned value when the final statement is an assignment', async () => {
    const feature = vm()
    const shared = feature.createContext({ out: {} as any })
    const result = await feature.run(
      `const v = await Promise.resolve(7); out.total = v * 2`,
      shared
    )
    expect(result).toBe(14)
    expect(shared.out.total).toBe(14)
  })

  it('is not confused by template literals spanning lines with ; and }', async () => {
    const result = await vm().run(`
const who = await Promise.resolve('world')
const msg = \`hello;
{ not a block }
\${who}\`
msg.includes('world')
`)
    expect(result).toBe(true)
  })

  it('treats sloppy-mode-ambiguous `await (expr)` as top-level await', async () => {
    expect(await vm().run(`const x = await (Promise.resolve(5))\nx + 1`)).toBe(6)
  })

  it('still executes when nothing is returnable and syntax is unusual (regex literal with braces)', async () => {
    const feature = vm()
    const shared = feature.createContext({ out: {} as any })
    await feature.run(`
const s = await Promise.resolve('a{1}b')
const re = /{\\d}/
out.matched = re.test(s)
`, shared)
    expect(shared.out.matched).toBe(true)
  })

  it('returns a final expression that ends with a semicolon (transpiler-normalized input)', async () => {
    const result = await vm().run(`const r = await Promise.resolve(3);\nJSON.stringify({\n  r\n}, null, 2);\n`)
    expect(JSON.parse(result as string)).toEqual({ r: 3 })
  })

  it('handles the single-line multi-statement CLI shape', async () => {
    const result = await vm().run(
      `const a = await Promise.resolve(2); const b = a * 3; JSON.stringify({ a, b })`
    )
    expect(JSON.parse(result as string)).toEqual({ a: 2, b: 6 })
  })
})
