import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { paramNames, rank, type CompletionItem } from '../src/workbench/complete'
import { docQuery } from '../src/workbench/console'

const CLI = join('/Users/jonathansoeder/@luca', 'src/cli/cli.ts')
type Proc = ReturnType<typeof Bun.spawn>
let dir: string
let proc: Proc
let base = ''
let token = ''

async function firstLine(p: Proc): Promise<string> {
  const reader = (p.stdout as ReadableStream<Uint8Array>).getReader()
  const dec = new TextDecoder()
  let buf = ''
  for (;;) {
    const r = await reader.read()
    if (r.done) break
    buf += dec.decode(r.value)
    const i = buf.indexOf('\n')
    if (i >= 0) { reader.releaseLock(); return buf.slice(0, i) }
  }
  throw new Error('no first line: ' + buf)
}

const post = async (path: string, body: any) => {
  const res = await fetch(base + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  return { status: res.status, body: (await res.json()) as any }
}
/** Completions with the caret at `|`. */
const at = async (text: string, session = 'c') => {
  const cursor = text.indexOf('|')
  return (await post('/console/complete', { code: text.replace('|', ''), cursor, session })).body
}
const labels = (answer: any): string[] => answer.items.map((i: any) => i.label)

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'luca-workbench-complete-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-complete', version: '0.0.0' }))
  proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd: dir, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore' })
  const info = JSON.parse(await firstLine(proc))
  base = `http://127.0.0.1:${info.port}`
  token = info.token
}, 120000)

afterAll(() => {
  try { proc?.kill() } catch {}
  try { rmSync(dir, { recursive: true, force: true }) } catch {}
})

describe('pure parts', () => {
  it('reads parameter names from a function', () => {
    expect(paramNames(function (a: any, b = 2, ...rest: any[]) {})).toEqual(['a', 'b?', '...rest'])
    expect(paramNames((x: any) => x)).toEqual(['x'])
    expect(paramNames(({ a }: any, [b]: any) => a + b)).toEqual(['options', 'items'])
    expect(paramNames(class { m(p: any, q: any) {} }.prototype.m)).toEqual(['p', 'q'])
  })
  it('ranks a start over a match inside, and drops what does not match', () => {
    const item = (label: string): CompletionItem => ({ label, kind: 'method', detail: '', insert: label, doc: { title: label, kind: 'method', summary: '', documented: true } })
    const out = rank([item('unreadable'), item('readFile'), item('ReadStream'), item('write'), item('_read')], 'read').map((i) => i.label)
    expect(out).toEqual(['readFile', 'ReadStream', 'unreadable', '_read'])
  })
  it('knows a question from code', () => {
    expect(docQuery('?fs')).toBe('fs')
    expect(docQuery('? fs.readFile')).toBe('fs.readFile')
    expect(docQuery('fs.readFile?')).toBe('fs.readFile')
    expect(docQuery("container.client('rest')?")).toBe("container.client('rest')")
    expect(docQuery('a ? b : c')).toBeUndefined()
    expect(docQuery('x?.y')).toBeUndefined()
    expect(docQuery('fs.exists("a")')).toBeUndefined()
  })
})

describe('POST /console/complete', () => {
  it('needs the token', async () => {
    const res = await fetch(base + '/console/complete', { method: 'POST', body: '{"code":"fs."}' })
    expect(res.status).toBe(401)
  })

  it('completes a helper member with its docs', async () => {
    const a = await at('fs.readF|')
    expect(a.from).toBe(3)
    expect(a.to).toBe(8)
    expect(labels(a).slice(0, 3)).toContain('readFile')
    const item = a.items.find((i: any) => i.label === 'readFile')
    expect(item.kind).toBe('method')
    expect(item.doc.documented).toBe(true)
    expect(item.doc.signature).toContain('readFile(path: string')
    expect(item.doc.params[0]).toMatchObject({ name: 'path', type: 'string', required: true })
    expect(item.doc.summary.length).toBeGreaterThan(20)
    expect(item.doc.owner).toMatchObject({ registry: 'features', id: 'fs', address: 'helper/features/fs' })
    expect(item.doc.examples.length).toBeGreaterThan(0)
  })

  it('lists every member after a dot', async () => {
    const a = await at('fs.|')
    expect(labels(a)).toContain('readFile')
    expect(labels(a)).toContain('exists')
    expect(a.from).toBe(3)
  })

  it('completes names in scope, features first-class', async () => {
    const a = await at('conta|')
    expect(labels(a)[0]).toBe('container')
    expect(a.items[0].kind).toBe('container')
    const f = await at('f|')
    const fs = f.items.find((i: any) => i.label === 'fs')
    expect(fs.kind).toBe('helper')
    expect(fs.doc.title).toBe('features.fs')
    expect(fs.doc.members.some((m: any) => m.name === 'readFile')).toBe(true)
  })

  it('sees names the session defined, and plain objects', async () => {
    await post('/console', { code: 'const mine = { alpha: 1, beta: { deep: "x" }, go(a, b) {} }', session: 'c' })
    expect(labels(await at('mi|'))).toContain('mine')
    const a = await at('mine.|')
    expect(labels(a).sort()).toEqual(['alpha', 'beta', 'go'])
    expect(a.items.find((i: any) => i.label === 'alpha').detail).toBe('1')
    expect(a.items.find((i: any) => i.label === 'go').doc.signature).toBe('go(a, b)')
    expect(labels(await at('mine.beta.d|'))).toEqual(['deep'])
    // Another session does not see it.
    expect(labels(await at('mi|', 'other'))).not.toContain('mine')
  })

  it('follows the container factories without a call', async () => {
    const a = await at("container.feature('fs').ex|")
    expect(labels(a)).toContain('exists')
    const c = await at("container.client('rest').|")
    expect(c.items.length).toBeGreaterThan(3)
    // No client instance was made for it.
    const made = await post('/console', { code: "Object.values(container.helperCache ?? {}).length", session: 'x' })
    expect(made.status).toBe(200)
  })

  it('completes helper ids inside a factory string', async () => {
    const a = await at("container.feature('f|')")
    expect(labels(a)).toContain('fs')
    expect(a.from).toBe(19)
    const fs = a.items.find((i: any) => i.label === 'fs')
    expect(fs.doc.kind).toBe('helper')
    const c = await at('container.client("|")')
    expect(labels(c)).toContain('rest')
    // Any other string completes nothing.
    expect((await at("fs.readFile('pa|')")).items).toEqual([])
  })

  it('gives the signature of the call the caret is in', async () => {
    const a = await at("fs.readFile('a.txt', |")
    expect(a.signature.doc.title).toBe('fs.readFile')
    expect(a.signature.active).toBe(1)
    expect(a.signature.doc.params[1].name).toBe('encoding')
    const first = await at('fs.readFile(|')
    expect(first.signature.active).toBe(0)
    // A nested call: the inner one.
    const inner = await at("fs.readFile(fs.exists('x', |")
    expect(inner.signature.doc.title).toBe('fs.exists')
    // After the call closes: none.
    expect((await at("fs.readFile('a') |")).signature).toBeUndefined()
    // Commas inside an array argument do not move the argument.
    expect((await at('fs.readFile([1, 2, |')).signature.active).toBe(0)
  })

  it('gives the docs of the name the caret is on', async () => {
    const a = await at('fs.read|File("x")')
    expect(a.hover.title).toBe('fs.readFile')
    expect(a.to).toBe(11)
    const h = await at('container.pat|hs')
    expect(h.hover.kind).toBe('getter')
  })

  it('never runs code: a call in the chain stops it', async () => {
    await post('/console', { code: 'globalThis.__hits = 0; const bump = () => { globalThis.__hits++; return { a: 1 } }', session: 'c' })
    const a = await at('bump().|')
    expect(a.items).toEqual([])
    const hits = await post('/console', { code: 'globalThis.__hits', session: 'c' })
    expect(hits.body.text).toBe('0')
  })

  it('completes nothing in a number or a comment', async () => {
    expect((await at('12.|')).items).toEqual([])
    expect((await at('// fs.|')).items).toEqual([])
  })
})

describe('docs in the console', () => {
  it('answers ?name with a doc card', async () => {
    const a = (await post('/console', { code: '?fs.readFile', session: 'd' })).body
    expect(a.ok).toBe(true)
    expect(a.type).toBe('docs')
    expect(a.doc.title).toBe('fs.readFile')
    expect(a.doc.params.length).toBe(2)
    const helper = (await post('/console', { code: 'fs?', session: 'd' })).body
    expect(helper.doc.kind).toBe('helper')
    expect(helper.doc.members.length).toBeGreaterThan(10)
  })
  it('finds a helper by id when it is not in scope', async () => {
    const a = (await post('/console', { code: '?rest', session: 'd' })).body
    expect(a.doc.title).toBe('clients.rest')
    const m = (await post('/console/describe', { target: 'features.fs.exists', session: 'd' })).body
    expect(m.doc.kind).toBe('method')
  })
  it('says so when there are none', async () => {
    const a = (await post('/console', { code: '?nothingHere', session: 'd' })).body
    expect(a.ok).toBe(false)
    expect(a.error).toBe('No docs for nothingHere')
    expect((await post('/console/describe', { target: 'nothingHere' })).status).toBe(404)
  })
  it('sends a helper result with its docs, and keeps the last result in _', async () => {
    const a = (await post('/console', { code: "container.feature('fs')", session: 'd' })).body
    expect(a.doc.title).toBe('features.fs')
    await post('/console', { code: '40 + 2', session: 'd' })
    expect((await post('/console', { code: '_ + 1', session: 'd' })).body.text).toBe('43')
  })
})

describe('scope', () => {
  it('tells the names the user set from what the context starts with', async () => {
    await post('/console', { code: 'const cart = [1, 2]', session: 's' })
    const a = (await post('/console/complete', { code: '', cursor: 0, session: 's' })).body
    const kind = (label: string) => a.items.find((i: any) => i.label === label)?.kind
    expect(kind('cart')).toBe('value')
    expect(kind('fs')).toBe('helper')
    expect(kind('container')).toBe('container')
    expect(a.items.filter((i: any) => i.kind === 'value' || i.kind === 'function').map((i: any) => i.label)).toEqual(['cart', '_'])
  })
})
