import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * A wide spread of the code shapes agents actually send to evalCode, run
 * through both evalCode (the assistant tool) and vm.run. Each case pins the
 * value it must produce. Many come straight from a chiefOfStaff session that
 * spent 78 calls bisecting failures: every one of its snippets ended in a
 * top-level `return`, which the transpiler rejects.
 */
type Case = { name: string; code: string; expected: any }

const cases: Case[] = [
  // Plain JS
  { name: 'bare expression', code: '1 + 2', expected: 3 },
  { name: 'final expression after statements', code: 'const a = 2\nconst b = 3\na * b', expected: 6 },
  { name: 'top-level return', code: 'const a = 2\nreturn a * 5', expected: 10 },
  { name: 'top-level await', code: 'const v = await Promise.resolve(4)\nv + 1', expected: 5 },
  { name: 'await then return', code: 'const v = await Promise.resolve(4)\nreturn { v }', expected: { v: 4 } },
  { name: 'async fn declared then awaited, return', code: 'async function f() { const y = await Promise.resolve(1); return y + 1 }\nconst v = await f()\nreturn { v }', expected: { v: 2 } },
  { name: 'early return inside if', code: 'const x = 3\nif (x > 2) return "big"\nreturn "small"', expected: 'big' },
  { name: 'bare return', code: 'globalThis.__ran = 1\nreturn', expected: undefined },
  { name: 'object literal final', code: '({ a: 1 })', expected: { a: 1 } },
  { name: 'multi-line final expression', code: 'const r = await Promise.resolve({ s: 200 })\nJSON.stringify({\n  s: r.s\n})', expected: '{"s":200}' },
  { name: 'brace-less for with await', code: 'const out = []\nfor (const x of [1, 2, 3]) out.push(await Promise.resolve(x))\nreturn out', expected: [1, 2, 3] },
  { name: 'brace-less if/else with await', code: 'let r\nif (false) r = 1\nelse r = await Promise.resolve(2)\nreturn r', expected: 2 },
  { name: 'for await over async generator', code: 'async function* g() { yield 1; yield 2 }\nconst out = []\nfor await (const x of g()) out.push(x)\nreturn out', expected: [1, 2] },
  { name: 'labeled loop', code: 'let n = 0\nouter: for (let i = 0; i < 3; i++) { for (let j = 0; j < 3; j++) { if (j === 1) continue outer; n++ } }\nn', expected: 3 },
  { name: 'switch then return', code: 'const k = "b"\nlet r\nswitch (k) { case "a": r = 1; break; case "b": r = 2; break }\nreturn r', expected: 2 },
  { name: 'try/catch then return', code: 'let r\ntry { JSON.parse("{") } catch (e) { r = e.name }\nreturn r', expected: 'SyntaxError' },
  { name: 'string containing return and types', code: 'const s = "return x: number"\ns.length', expected: 16 },
  { name: 'template literal with await', code: 'const n = await Promise.resolve(3);\n`n=${n}`', expected: 'n=3' },
  { name: 'regex literal', code: 'return /a+b/.test("aaab")', expected: true },
  { name: 'comment that looks like an import', code: '// import x from "nope"\nreturn 1', expected: 1 },
  { name: 'optional chaining, nullish assign', code: 'const o = {}\no.a ??= 5\nreturn o?.a ?? 0', expected: 5 },
  { name: 'class with private # field and static block', code: 'class C { #n = 1; static s; static { C.s = 9 } get n() { return this.#n } }\nreturn [new C().n, C.s]', expected: [1, 9] },
  { name: 'generator', code: 'function* g() { yield 1; yield 2 }\nreturn [...g()]', expected: [1, 2] },
  { name: 'Promise.all', code: 'return await Promise.all([1, 2].map(async n => n * 2))', expected: [2, 4] },
  { name: 'ends in declaration', code: 'const x = 1', expected: undefined },
  { name: 'await identifier-like call', code: 'const v = await (async () => 7)()\nv', expected: 7 },

  // TypeScript
  { name: 'TS annotation with final expression', code: 'const x: number = 2\nx * 3', expected: 6 },
  { name: 'TS annotation with return', code: 'const x: number = 2\nreturn x * 3', expected: 6 },
  { name: 'TS typed const with await and return', code: 'const v: number = await Promise.resolve(1)\nreturn { v }', expected: { v: 1 } },
  { name: 'TS Record annotation', code: 'const o: Record<string, number> = { a: 1 }\nreturn Object.keys(o) as string[]', expected: ['a'] },
  { name: 'TS interface', code: 'interface X { a: number }\nconst o: X = { a: 1 }\nconst v = await Promise.resolve(1)\nreturn { o, v }', expected: { o: { a: 1 }, v: 1 } },
  { name: 'TS type alias', code: 'type Fn = (a: number) => string\nconst g: Fn = (a: number) => String(a)\nreturn g(9)', expected: '9' },
  { name: 'TS generic function', code: 'function id<T>(v: T): T { return v }\nreturn id<string>("ok")', expected: 'ok' },
  { name: 'TS generic async function with constraint', code: 'async function first<T extends { length: number }>(q: T): Promise<number> { return q.length }\nreturn await first([1, 2, 3])', expected: 3 },
  { name: 'TS generic arrow', code: 'const id = <T,>(v: T): T => v\nreturn id(4)', expected: 4 },
  { name: 'TS typed async arrow', code: 'const f = async (): Promise<number> => 1\nconst v = await f()\nreturn { v }', expected: { v: 1 } },
  { name: 'TS async fn return type, called later', code: 'async function run(): Promise<{ count: number }> { const c: number = await Promise.resolve(2); return { count: c } }\nconst out: { count: number } = await run()\nreturn out', expected: { count: 2 } },
  { name: 'TS enum', code: "enum Mode { A = 'a', B = 'b' }\nconst m: Mode = Mode.A\nreturn m", expected: 'a' },
  { name: 'TS numeric enum reverse map', code: 'enum E { X, Y }\nreturn E[1]', expected: 'Y' },
  { name: 'TS const enum', code: 'const enum D { Up = 1 }\nreturn D.Up', expected: 1 },
  { name: 'TS class field modifiers', code: 'class Counter { private n = 0; readonly tag: string = "c"; inc(): number { return ++this.n } }\nconst c = new Counter()\nc.inc()\nreturn c.inc()', expected: 2 },
  { name: 'TS parameter properties', code: 'class P { constructor(public x: number, private y: number = 2) {} sum() { return this.x + this.y } }\nreturn new P(1).sum()', expected: 3 },
  { name: 'TS abstract class', code: 'abstract class A { abstract v(): number; twice() { return this.v() * 2 } }\nclass B extends A { v() { return 4 } }\nreturn new B().twice()', expected: 8 },
  { name: 'TS satisfies', code: 'const cfg = { port: 80 } satisfies Record<string, number>\nreturn cfg.port', expected: 80 },
  { name: 'TS non-null assertion', code: 'const m = new Map<string, number>([["a", 1]])\nreturn m.get("a")! + 1', expected: 2 },
  { name: 'TS as assertion with await', code: 'const rows = {} as Record<string, { goal: string }>\nconst v = await Promise.resolve(1)\nreturn { rows, v }', expected: { rows: {}, v: 1 } },
  { name: 'TS angle-bracket cast', code: 'const v = <number>(<unknown>5)\nreturn v', expected: 5 },
  { name: 'TS definite assignment', code: 'let x!: number\nx = 3\nreturn x', expected: 3 },
  { name: 'TS optional params and unions', code: 'function f(a: string | number, b?: boolean): string { return `${a}${b ?? ""}` }\nreturn f(1)', expected: '1' },
  { name: 'TS overloads', code: 'function f(a: string): string\nfunction f(a: number): number\nfunction f(a: any) { return a }\nreturn f(2)', expected: 2 },
  { name: 'TS namespace', code: 'namespace NS { export const v = 6 }\nreturn NS.v', expected: 6 },
  { name: 'TS declare', code: 'declare const injected: number\nreturn typeof injected', expected: 'undefined' },
  { name: 'TS tuple and keyof/typeof', code: 'const t: [string, number] = ["x", 1]\nconst o = { a: 1 }\ntype K = keyof typeof o\nconst k: K = "a"\nreturn [t, o[k]]', expected: [['x', 1], 1] },
  { name: 'TS type in for loop with await', code: 'const out: Record<string, number> = {}\nfor (const i of [1, 2]) {\n  const s: string = String(i)\n  out[s] = await Promise.resolve(i)\n}\nreturn out', expected: { '1': 1, '2': 2 } },
  { name: 'TS IIFE with typed locals', code: 'const res = await (async () => {\n  const xs: any[] = [1, 2]\n  const out: Record<string, number> = {}\n  for (const x of xs) out[x] = x\n  return out\n})()\nreturn res', expected: { '1': 1, '2': 2 } },
  { name: 'TS with final expression and no return', code: 'interface P { a: number }\nconst p: P = { a: 7 }\np.a', expected: 7 },

  // Imports
  { name: 'named import + return', code: 'import { z } from "zod"\nreturn z.string().parse("hi")', expected: 'hi' },
  { name: 'named import + final expression', code: 'import { z } from "zod"\nz.number().parse(3)', expected: 3 },
  { name: 'import + TS + await + return', code: 'import { z } from "zod"\nconst S = z.object({ n: z.number() })\nconst v: number = await Promise.resolve(2)\nreturn S.parse({ n: v })', expected: { n: 2 } },
  { name: 'multi-line import + return', code: 'import {\n  z,\n} from "zod"\nreturn typeof z.string', expected: 'function' },
  { name: 'namespace import', code: 'import * as zod from "zod"\nreturn typeof zod.z', expected: 'object' },
  { name: 'import type is erased', code: 'import type { ZodType } from "zod"\nconst x: ZodType | null = null\nreturn x', expected: null },
  { name: 'dynamic import', code: 'const { z } = await import("zod")\nreturn z.boolean().parse(true)', expected: true },
]

describe('VM pattern barrage', () => {
  const container = new NodeContainer()
  const vm = container.feature('vm')

  describe('evalCode (assistant tool path)', () => {
    for (const c of cases) {
      it(c.name, async () => {
        const out: any = await vm.evalCode({ code: c.code })
        expect(out.error).toBeUndefined()
        // evalCode serializes results for the model, and undefined becomes null.
        expect(out.result).toEqual(c.expected === undefined ? null : c.expected)
      })
    }
  })

  describe('vm.run', () => {
    for (const c of cases) {
      it(c.name, async () => {
        const result = await vm.run(c.code, { require })
        expect(result).toEqual(c.expected)
      })
    }
  })

  describe('error handling', () => {
    it('reports a genuine syntax error instead of a transpiler error', async () => {
      const out: any = await vm.evalCode({ code: 'const = ;\nreturn 1' })
      expect(out.error).toBeString()
    })

    it('reports a runtime throw', async () => {
      const out: any = await vm.evalCode({ code: 'const x: number = 1\nthrow new Error("boom " + x)' })
      expect(out.error).toContain('boom 1')
    })

    it('runs side effects once on the TS + return path', async () => {
      const counter = { n: 0 }
      await vm.run('const step: number = 1\ncounter.n += step\nreturn counter.n', { counter })
      expect(counter.n).toBe(1)
    })

    it('does not re-run when user code throws a SyntaxError from JSON.parse', async () => {
      const counter = { n: 0 }
      await expect(vm.run('counter.n++\nJSON.parse("{")', { counter })).rejects.toThrow()
      expect(counter.n).toBe(1)
    })

    it('captures console output from TypeScript snippets', async () => {
      const out: any = await vm.evalCode({ code: 'const m: string = "hi"\nconsole.log(m)\nreturn m' })
      expect(out.result).toBe('hi')
      expect(out.console[0].args).toEqual(['hi'])
    })
  })
})
