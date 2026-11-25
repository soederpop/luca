import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { persistDeclarations, valueTree } from '../src/workbench/console'
import { buildArgs, splitWords, childPrefix, stripAnsi, statusText, displayArgv, type CommandField } from '../src/workbench/runs'

const LUCA_ROOT = '/Users/jonathansoeder/@luca'
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')

const tempDirs: string[] = []

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'luca-workbench-run-'))
  tempDirs.push(dir)
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-run-project', version: '0.0.0' }))
  mkdirSync(join(dir, 'commands'), { recursive: true })
  writeFileSync(
    join(dir, 'commands', 'greet.ts'),
    `import { z } from 'zod'
export const description = 'Greet someone'
export const positionals = ['who']
export const argsSchema = z.object({
  who: z.string().describe('Who to greet'),
  loud: z.boolean().default(false).describe('Shout it'),
  times: z.number().default(1).describe('How many times'),
  mood: z.enum(['happy', 'grumpy']).optional().describe('The mood'),
})
export default async function greet(options: any) {
  for (let i = 0; i < options.times; i++) console.log((options.loud ? 'HELLO ' : 'hello ') + options.who + (options.mood ? ' ' + options.mood : ''))
  console.error('greeted')
}
`,
  )
  writeFileSync(
    join(dir, 'commands', 'sleepy.ts'),
    `import { z } from 'zod'
export const description = 'Print a tick each 200 ms, forever'
export const argsSchema = z.object({})
export default async function sleepy() {
  let n = 0
  console.log('started ' + process.pid)
  setInterval(() => console.log('tick ' + (++n)), 200)
  await new Promise(() => {})
}
`,
  )
  writeFileSync(
    join(dir, 'commands', 'crash.ts'),
    `import { z } from 'zod'
export const description = 'Exit 3 at once'
export const argsSchema = z.object({})
export default async function crash() { console.log('bye'); process.exit(3) }
`,
  )
  return dir
}

type Proc = ReturnType<typeof Bun.spawn>
interface Running { proc: Proc; port: number; token: string; base: string }

async function readFirstLine(proc: Proc, timeoutMs = 60000): Promise<string> {
  const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader()
  const dec = new TextDecoder()
  let buf = ''
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const r = await Promise.race([
      reader.read(),
      new Promise<null>((res) => setTimeout(() => res(null), Math.max(1, deadline - Date.now()))),
    ])
    if (r === null || r.done) break
    buf += dec.decode(r.value)
    const i = buf.indexOf('\n')
    if (i >= 0) { reader.releaseLock(); return buf.slice(0, i) }
  }
  throw new Error('no first line on stdout; got: ' + JSON.stringify(buf))
}

async function start(cwd: string): Promise<Running> {
  const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore' })
  const info = JSON.parse(await readFirstLine(proc))
  return { proc, port: info.port, token: info.token, base: `http://127.0.0.1:${info.port}` }
}

function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true } catch { return false }
}

let proj: string
let wb: Running

const authed = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${wb.token}`, ...extra })
const post = (path: string, body: any) =>
  fetch(wb.base + path, { method: 'POST', headers: authed({ 'content-type': 'application/json' }), body: JSON.stringify(body) })
const get = (path: string) => fetch(wb.base + path, { headers: authed() })
const consoleRun = async (code: string, session?: string) => (await post('/console', { code, session })).json() as Promise<any>

/** A socket that keeps every frame. */
async function frames() {
  const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
  const got: any[] = []
  await new Promise<void>((resolve) => { ws.onmessage = (e) => { got.push(JSON.parse(String(e.data))); resolve() } })
  ws.onmessage = (e) => got.push(JSON.parse(String(e.data)))
  return { ws, got }
}

async function until(test: () => boolean, ms = 30000) {
  const deadline = Date.now() + ms
  while (Date.now() < deadline && !test()) await Bun.sleep(50)
  return test()
}

beforeAll(async () => {
  proj = makeProject()
  wb = await start(proj)
}, 120000)

afterAll(() => {
  try { wb?.proc.kill() } catch {}
  for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('persistDeclarations', () => {
  it('turns top-level declarations into scope assignments', () => {
    expect(persistDeclarations('const a = 1')).toBe('a = 1')
    expect(persistDeclarations('let a = 1, b = 2;\na + b')).toBe('a = 1, b = 2;\na + b')
    expect(persistDeclarations('const x = await f();\nx')).toBe('x = await f();\nx')
    expect(persistDeclarations('var q = 3')).toBe('q = 3')
  })
  it('makes other top-level declarations var', () => {
    expect(persistDeclarations('const { p, q } = o')).toBe('var { p, q } = o')
    expect(persistDeclarations('let z;')).toBe('var z;')
  })
  it('leaves blocks, strings and comments alone', () => {
    expect(persistDeclarations('for (let i = 0; i < 2; i++) {}')).toBe('for (let i = 0; i < 2; i++) {}')
    expect(persistDeclarations('function f() { const y = 1; return y }')).toBe('function f() { const y = 1; return y }')
    expect(persistDeclarations('"const a = 1"')).toBe('"const a = 1"')
    expect(persistDeclarations('// const a = 1\nconst b = 2')).toBe('// const a = 1\nb = 2')
    expect(persistDeclarations('constant = 1')).toBe('constant = 1')
    expect(persistDeclarations('if (x) { let a = 1 }\nconst c = 2')).toBe('if (x) { let a = 1 }\nc = 2')
  })
})

describe('valueTree', () => {
  it('a leaf', () => {
    expect(valueTree(3)).toEqual({ type: 'number', text: '3' })
    expect(valueTree('hi')).toEqual({ type: 'string', text: '"hi"' })
    expect(valueTree(undefined)).toEqual({ type: 'undefined', text: 'undefined' })
    expect(valueTree(10n).text).toBe('10n')
  })
  it('an object opens at the root, with keys and previews', () => {
    const t = valueTree({ a: 1, b: [1, 2], c: { d: 'x' } })
    expect(t.open).toBe(true)
    expect(t.type).toBe('Object')
    expect(t.text).toBe('{a: 1, b: Array(2), c: {…}}')
    expect(t.children!.map((c) => c.key)).toEqual(['a', 'b', 'c'])
    expect(t.children![1]!.text).toBe('Array(2) [1, 2]')
    expect(t.children![1]!.children!.map((c) => c.key)).toEqual(['0', '1'])
    expect(t.children![1]!.open).toBeUndefined()
  })
  it('cycles, maps, sets, errors, long arrays', () => {
    const a: any = { n: 1 }
    a.self = a
    expect(valueTree(a).children!.find((c) => c.key === 'self')!.text).toBe('[Circular]')
    expect(valueTree(new Map([['k', 1]])).text).toBe('Map(1) {k: 1}')
    expect(valueTree(new Set([1])).children![0]!.text).toBe('1')
    expect(valueTree(new Error('boom')).text).toBe('Error: boom')
    const long = valueTree(Array.from({ length: 150 }, (_, i) => i))
    expect(long.children!.length).toBe(100)
    expect(long.more).toBe(50)
  })
})

describe('command arguments', () => {
  const fields: CommandField[] = [
    { name: 'who', flag: '--who', type: 'string', default: null, description: '', required: true, positional: true, position: 0 },
    { name: 'what', flag: '--what', type: 'string', default: null, description: '', required: false, positional: true, position: 1 },
    { name: 'loud', flag: '--loud', type: 'boolean', default: 'false', description: '', required: false, positional: false },
    { name: 'color', flag: '--color', type: 'boolean', default: 'true', description: '', required: false, positional: false },
    { name: 'dryRun', flag: '--dry-run', type: 'string', default: null, description: '', required: false, positional: false },
    { name: 'tags', flag: '--tags', type: 'array', default: null, description: '', required: false, positional: false },
    { name: '__extra__', flag: '', type: 'string', default: null, description: '', required: false, positional: false, extra: true },
  ]
  it('positionals first, then flags, then extra words', () => {
    expect(buildArgs(fields, { who: 'jon', what: 'hi there', loud: true, dryRun: 'yes', __extra__: '--x "a b"' }))
      .toEqual(['jon', 'hi there', '--loud', '--dry-run', 'yes', '--x', 'a b'])
  })
  it('a positional after a gap goes as its flag', () => {
    expect(buildArgs(fields, { what: 'later' })).toEqual(['--what', 'later'])
  })
  it('booleans only when they differ from the default; arrays repeat', () => {
    expect(buildArgs(fields, { loud: false, color: false })).toEqual(['--no-color'])
    expect(buildArgs(fields, { color: true, tags: 'a b' })).toEqual(['--tags', 'a', '--tags', 'b'])
  })
  it('splitWords reads quotes like a shell', () => {
    expect(splitWords(`a "b c" 'd e' f\\ g ""`)).toEqual(['a', 'b c', 'd e', 'f g', ''])
    expect(splitWords('   ')).toEqual([])
  })
  it('childPrefix: runtime and script from source, the binary alone when compiled', () => {
    expect(childPrefix('/b/bun', ['/b/bun', '/x/cli.ts', 'workbench'], () => true)).toEqual(['/b/bun', '/x/cli.ts'])
    expect(childPrefix('/usr/local/bin/luca', ['/usr/local/bin/luca', '/$bunfs/root/luca', 'workbench'], () => true)).toEqual(['/usr/local/bin/luca'])
    expect(childPrefix('/usr/local/bin/luca', ['/usr/local/bin/luca', 'workbench'], () => false)).toEqual(['/usr/local/bin/luca'])
  })
  it('stripAnsi, statusText, displayArgv', () => {
    expect(stripAnsi('\u001b[31mred\u001b[0m')).toBe('red')
    expect(statusText({ status: 'exited', code: 0, signal: null, stopped: false, ms: 1500 })).toBe('exit 0 · 1.5 s')
    expect(statusText({ status: 'exited', code: null, signal: 'SIGTERM', stopped: true, ms: 20 })).toBe('stopped · 20 ms')
    expect(displayArgv('describe', ['fs', 'a b'])).toBe("luca describe fs 'a b'")
  })
})

describe('POST /console', () => {
  it('evaluates with the container in scope', async () => {
    const j = await consoleRun('container.features.available.length')
    expect(j.ok).toBe(true)
    expect(j.type).toBe('number')
    expect(j.result).toBeUndefined()
    expect(Number(j.tree.text)).toBeGreaterThan(10)
    expect(typeof j.entry).toBe('number')
    expect(typeof j.ms).toBe('number')
  })
  it('an object comes back as a tree', async () => {
    const j = await consoleRun('({ a: 1, list: [1, 2, 3], nested: { b: "x" } })')
    expect(j.ok).toBe(true)
    expect(j.tree.open).toBe(true)
    expect(j.tree.children.map((c: any) => c.key)).toEqual(['a', 'list', 'nested'])
    expect(j.tree.children[1].text).toBe('Array(3) [1, 2, 3]')
    expect(j.text).toBe(j.tree.text)
  })
  it('a name set in one entry is there in the next, with and without await', async () => {
    expect((await consoleRun('const seven = 7')).ok).toBe(true)
    expect((await consoleRun('const later = await Promise.resolve(5)')).ok).toBe(true)
    const j = await consoleRun('seven + later')
    expect(j.ok).toBe(true)
    expect(j.tree.text).toBe('12')
    // Typing a declaration again does not throw.
    expect((await consoleRun('const seven = 8; seven')).tree.text).toBe('8')
  })
  it('sessions are separate, and reset drops one', async () => {
    await consoleRun('const mine = 1', 'other')
    expect((await consoleRun('typeof mine', 'third')).tree.text).toBe('"undefined"')
    expect((await consoleRun('mine', 'other')).tree.text).toBe('1')
    const r: any = await (await post('/console/reset', { session: 'other' })).json()
    expect(r).toEqual({ ok: true, session: 'other', existed: true })
    expect((await consoleRun('typeof mine', 'other')).tree.text).toBe('"undefined"')
  })
  it('a string result keeps its text', async () => {
    const j = await consoleRun('"line one\\nline two"')
    expect(j.text).toBe('line one\nline two')
  })
  it('a throw is ok:false with the name, message and stack', async () => {
    const j = await consoleRun('function deep() { throw new TypeError("boom") }\ndeep()')
    expect(j.ok).toBe(false)
    expect(j.name).toBe('TypeError')
    expect(j.error).toContain('boom')
    expect(j.stack).toContain('boom')
    expect(j.stack.split('\n').length).toBeGreaterThan(1)
  })
  it('console output is captured per entry', async () => {
    const j = await consoleRun('console.log("hi", { a: 1 }); console.warn("careful"); 1')
    expect(j.logs).toEqual([{ level: 'log', text: 'hi { a: 1 }' }, { level: 'warn', text: 'careful' }])
  })
  it('400 without code, 401 without the token', async () => {
    expect((await post('/console', {})).status).toBe(400)
    expect((await fetch(wb.base + '/console', { method: 'POST', body: '{"code":"1"}' })).status).toBe(401)
    expect((await fetch(wb.base + '/console/reset', { method: 'POST', body: '{}' })).status).toBe(401)
  })
})

describe('GET /command/:id', () => {
  it('the form of a project command: positional, flags, enum, extra', async () => {
    const res = await get('/command/greet')
    expect(res.status).toBe(200)
    const j: any = await res.json()
    expect(j.id).toBe('greet')
    expect(j.title).toBe('luca greet')
    expect(j.summary).toBe('Greet someone')
    expect(j.badge).toBe('project')
    expect(j.usage).toBe('luca greet <who> [flags]')
    const by = Object.fromEntries(j.fields.map((f: any) => [f.name, f]))
    expect(by.who).toMatchObject({ positional: true, position: 0, required: true, type: 'string', description: 'Who to greet' })
    expect(by.loud).toMatchObject({ positional: false, type: 'boolean', default: 'false', flag: '--loud' })
    expect(by.times).toMatchObject({ type: 'number', default: '1', required: false })
    expect(by.mood).toMatchObject({ type: 'enum', options: ['happy', 'grumpy'] })
    expect(by.__extra__.extra).toBe(true)
    expect(j.fields.map((f: any) => f.name)).not.toContain('_')
    expect(j.fields.map((f: any) => f.name)).not.toContain('dispatchSource')
  })
  it('a built-in command', async () => {
    const j: any = await (await get('/command/describe')).json()
    expect(j.badge).toBeNull()
    expect(j.fields.some((f: any) => f.positional)).toBe(true)
  })
  it('404 for an unknown command', async () => {
    expect((await get('/command/nope-xyz')).status).toBe(404)
  })
  it('registry cards of commands open the runner', async () => {
    const j: any = await (await get('/registries')).json()
    const commands = j.stacks.find((s: any) => s.id === 'commands')
    expect(commands.cards.find((c: any) => c.title === 'greet').address).toBe('command/greet')
    const features = j.stacks.find((s: any) => s.id === 'features')
    expect(features.cards[0].address.startsWith('helper/features/')).toBe(true)
  })
})

describe('command runs', () => {
  it('runs a child with a positional and flags, streams output, sends the exit', async () => {
    const { ws, got } = await frames()
    const res = await post('/command/greet/run', { values: { who: 'jon', loud: true, times: '2', mood: 'happy' } })
    expect(res.status).toBe(200)
    const run: any = await res.json()
    expect(run.status).toBe('running')
    expect(run.display).toBe('luca greet jon --loud --times 2 --mood happy')
    expect(typeof run.runId).toBe('string')
    expect(await until(() => got.some((f) => f.type === 'run-exit' && f.runId === run.runId))).toBe(true)
    const start = got.find((f) => f.type === 'run-start' && f.runId === run.runId)
    expect(start.display).toBe(run.display)
    const out = got.filter((f) => f.type === 'run-output' && f.runId === run.runId)
    expect(out.filter((f) => f.stream === 'stdout').map((f) => f.text).join('')).toBe('HELLO jon happy\nHELLO jon happy\n')
    expect(out.some((f) => f.stream === 'stderr' && f.text.includes('greeted'))).toBe(true)
    expect(out.map((f) => f.seq)).toEqual(out.map((_, i) => i))
    const exit = got.find((f) => f.type === 'run-exit' && f.runId === run.runId)
    expect(exit.code).toBe(0)
    expect(exit.stopped).toBe(false)
    expect(exit.text.startsWith('exit 0 · ')).toBe(true)
    ws.close()

    const view: any = await (await get(`/runs/${run.runId}`)).json()
    expect(view.status).toBe('exited')
    expect(view.code).toBe(0)
    expect(view.statusText).toBe(exit.text)
    expect(view.chunks.length).toBe(out.length)
  }, 60000)

  it('a crash or process.exit in the command leaves the host up', async () => {
    const run: any = await (await post('/command/crash/run', {})).json()
    let view: any
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      view = await (await get(`/runs/${run.runId}`)).json()
      if (view.status === 'exited') break
      await Bun.sleep(100)
    }
    expect(view.code).toBe(3)
    expect(view.statusText.startsWith('exit 3')).toBe(true)
    expect((await get('/project')).status).toBe(200)
  }, 60000)

  it('a running command can be stopped', async () => {
    const { ws, got } = await frames()
    const run: any = await (await post('/command/sleepy/run', {})).json()
    expect(await until(() => got.some((f) => f.type === 'run-output' && f.runId === run.runId && /tick 2/.test(f.text)))).toBe(true)
    const started = got.find((f) => f.type === 'run-output' && f.runId === run.runId && /started \d+/.test(f.text))
    const pid = Number(/started (\d+)/.exec(started.text)![1])
    expect(alive(pid)).toBe(true)
    const stop: any = await (await post(`/runs/${run.runId}/stop`, {})).json()
    expect(stop).toEqual({ ok: true, runId: run.runId })
    expect(await until(() => got.some((f) => f.type === 'run-exit' && f.runId === run.runId), 10000)).toBe(true)
    const exit = got.find((f) => f.type === 'run-exit' && f.runId === run.runId)
    expect(exit.stopped).toBe(true)
    expect(exit.text.startsWith('stopped')).toBe(true)
    expect(await until(() => !alive(pid), 5000)).toBe(true)
    ws.close()
  }, 60000)

  it('refuses a missing required field, unknown commands and runs', async () => {
    const res = await post('/command/greet/run', { values: {} })
    expect(res.status).toBe(400)
    expect(((await res.json()) as any).error).toContain('who')
    expect((await post('/command/nope-xyz/run', {})).status).toBe(404)
    expect((await get('/runs/nope')).status).toBe(404)
    expect((await post('/runs/nope/stop', {})).status).toBe(404)
    expect((await fetch(wb.base + '/command/greet/run', { method: 'POST', body: '{}' })).status).toBe(401)
    expect((await fetch(wb.base + '/command/greet')).status).toBe(401)
  })

  it('children die with the host', async () => {
    const dir = makeProject()
    const other = await start(dir)
    const ws = new WebSocket(`ws://127.0.0.1:${other.port}/ws?token=${other.token}`)
    const got: any[] = []
    ws.onmessage = (e) => got.push(JSON.parse(String(e.data)))
    await until(() => got.length > 0, 10000)
    await fetch(`${other.base}/command/sleepy/run`, { method: 'POST', headers: { Authorization: `Bearer ${other.token}` }, body: '{}' })
    expect(await until(() => got.some((f) => f.type === 'run-output' && /started \d+/.test(f.text)))).toBe(true)
    const pid = Number(/started (\d+)/.exec(got.find((f) => f.type === 'run-output' && /started/.test(f.text)).text)![1])
    expect(alive(pid)).toBe(true)
    ws.close()
    ;(other.proc.stdin as any).end()
    await Promise.race([other.proc.exited, Bun.sleep(10000)])
    expect(await until(() => !alive(pid), 5000)).toBe(true)
  }, 120000)
})
