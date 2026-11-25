import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs, displayText } from '../src/workbench/views'

const LUCA_ROOT = '/Users/jonathansoeder/@luca'
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')

const tempDirs: string[] = []

function makeProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'luca-workbench-'))
  tempDirs.push(dir)
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-test-project', version: '0.0.0' }))
  mkdirSync(join(dir, 'commands'), { recursive: true })
  writeFileSync(
    join(dir, 'commands', 'hello.ts'),
    `import { z } from 'zod'
export const description = 'Say hello'
export const argsSchema = z.object({})
export default async function hello() { console.log('hello') }
`,
  )
  mkdirSync(join(dir, 'features'), { recursive: true })
  writeFileSync(
    join(dir, 'features', 'counter.ts'),
    `import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'

export const CounterStateSchema = FeatureStateSchema.extend({
  count: z.number().default(0).describe('How many bumps so far'),
})
export const CounterOptionsSchema = FeatureOptionsSchema.extend({
  step: z.number().default(1).describe('How much one bump adds'),
})
export const CounterEventsSchema = FeatureEventsSchema.extend({
  bumped: z.tuple([z.number().describe('The new count')]).describe('After each bump'),
})

/** Counts bumps, for the workbench inspector tests. */
export class Counter extends Feature<any, any> {
  static override shortcut = 'features.counter' as const
  static override stateSchema = CounterStateSchema
  static override optionsSchema = CounterOptionsSchema
  static override eventsSchema = CounterEventsSchema
  static { Feature.register(this, 'counter') }

  override get initialState() { return { enabled: false, count: 0 } }

  /** Add to the count. */
  bump(by: number = 1) {
    const count = (this.state.get('count') || 0) + by
    this.setState({ count })
    this.emit('bumped', count)
    return count
  }

  /** Join two words. */
  join(a: string, b: string) { return a + ' ' + b }

  hang() { return new Promise(() => {}) }
}

export default Counter
`,
  )
  return dir
}

type Proc = ReturnType<typeof Bun.spawn>
interface Running { proc: Proc; port: number; token: string; firstLine: string; base: string; stderr: () => string }

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
    if (r === null) break
    if (r.done) break
    buf += dec.decode(r.value)
    const i = buf.indexOf('\n')
    if (i >= 0) { reader.releaseLock(); return buf.slice(0, i) }
  }
  throw new Error('no first line on stdout; got: ' + JSON.stringify(buf))
}

async function start(cwd: string): Promise<Running> {
  const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' })
  let err = ''
  ;(async () => {
    const dec = new TextDecoder()
    for await (const c of proc.stderr as any) err += dec.decode(c)
  })()
  const firstLine = await readFirstLine(proc)
  const info = JSON.parse(firstLine)
  return { proc, port: info.port, token: info.token, firstLine, base: `http://127.0.0.1:${info.port}`, stderr: () => err }
}

async function waitForImpl() {
  const f = join(LUCA_ROOT, 'src/commands/workbench.ts')
  const deadline = Date.now() + 10 * 60 * 1000
  while (!existsSync(f) && Date.now() < deadline) await Bun.sleep(5000)
  if (!existsSync(f)) throw new Error('workbench.ts never appeared')
  await Bun.sleep(3000)
}

let proj: string
let wb: Running

const authed = (extra: Record<string, string> = {}) => ({ Authorization: `Bearer ${wb.token}`, ...extra })
const post = (path: string, body: any) =>
  fetch(wb.base + path, { method: 'POST', headers: authed({ 'content-type': 'application/json' }), body: JSON.stringify(body) })
const evalCode = async (code: string) => (await post('/eval', { code })).json() as Promise<any>

beforeAll(async () => {
  await waitForImpl()
  proj = makeProject()
  wb = await start(proj)
}, 11 * 60 * 1000)

afterAll(() => {
  try { wb?.proc.kill() } catch {}
  for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('workbench startup', () => {
  it('first stdout line is only the JSON {port, token}', () => {
    const parsed = JSON.parse(wb.firstLine)
    expect(Object.keys(parsed).sort()).toEqual(['port', 'token'])
    expect(typeof parsed.port).toBe('number')
    expect(parsed.port).toBeGreaterThan(0)
    expect(typeof parsed.token).toBe('string')
    expect(parsed.token.length).toBeGreaterThan(8)
  })
})

describe('auth', () => {
  const routes: [string, string, any?][] = [
    ['GET', '/project'],
    ['GET', '/registry/features'],
    ['GET', '/helper/features/fs'],
    ['POST', '/eval', { code: '1' }],
  ]
  for (const [method, path, body] of routes) {
    it(`401 without token: ${method} ${path}`, async () => {
      const res = await fetch(wb.base + path, { method, body: body ? JSON.stringify(body) : undefined, headers: body ? { 'content-type': 'application/json' } : {} })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    })
    it(`401 with wrong token: ${method} ${path}`, async () => {
      const res = await fetch(wb.base + path, {
        method,
        body: body ? JSON.stringify(body) : undefined,
        headers: { Authorization: 'Bearer nope', ...(body ? { 'content-type': 'application/json' } : {}) },
      })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    })
  }

  it('wrong token via query and x-workbench-token is 401', async () => {
    expect((await fetch(`${wb.base}/project?token=bad`)).status).toBe(401)
    expect((await fetch(`${wb.base}/project`, { headers: { 'x-workbench-token': 'bad' } })).status).toBe(401)
  })

  it('accepts Bearer header', async () => {
    expect((await fetch(`${wb.base}/project`, { headers: { Authorization: `Bearer ${wb.token}` } })).status).toBe(200)
  })
  it('accepts x-workbench-token header', async () => {
    expect((await fetch(`${wb.base}/project`, { headers: { 'x-workbench-token': wb.token } })).status).toBe(200)
  })
  it('accepts ?token= query', async () => {
    expect((await fetch(`${wb.base}/project?token=${wb.token}`)).status).toBe(200)
  })
  it('no wildcard CORS', async () => {
    const res = await fetch(`${wb.base}/project`, { headers: authed({ Origin: 'http://evil.example' }) })
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*')
  })
})

describe('GET /project', () => {
  it('returns name, cwd, lucaVersion, registries', async () => {
    const res = await fetch(`${wb.base}/project`, { headers: authed() })
    const j: any = await res.json()
    expect(j.name).toBe('wb-test-project')
    expect(j.cwd.endsWith(proj.split('/').pop()!)).toBe(true)
    expect(typeof j.lucaVersion).toBe('string')
    expect(Array.isArray(j.registries)).toBe(true)
    expect(j.registries.length).toBeGreaterThan(0)
    for (const r of j.registries) {
      expect(typeof r.name).toBe('string')
      expect(r.count).toBeGreaterThan(0)
    }
    expect(j.registries.map((r: any) => r.name)).toContain('features')
  })
})

describe('GET /registry/:name', () => {
  it('features: stack shape', async () => {
    const res = await fetch(`${wb.base}/registry/features`, { headers: authed() })
    expect(res.status).toBe(200)
    const j: any = await res.json()
    expect(Array.isArray(j.stacks)).toBe(true)
    expect(j.stacks.length).toBeGreaterThan(0)
    for (const s of j.stacks) {
      expect(typeof s.id).toBe('string')
      expect(typeof s.title).toBe('string')
      expect(s.cards.length).toBeGreaterThan(0)
      for (const c of s.cards) {
        expect(typeof c.id).toBe('string')
        expect(c.title).toBe(c.id)
        expect(typeof c.subtitle).toBe('string')
        expect(typeof c.preview).toBe('string')
        expect(c.open).toEqual({ tool: 'helper', registry: 'features', id: c.id })
      }
    }
    const builtIn = j.stacks.find((s: any) => s.title === 'Built in')
    expect(builtIn).toBeTruthy()
    expect(builtIn.cards.map((c: any) => c.id)).toContain('fs')
  })

  it('commands: Project stack contains the project command', async () => {
    const res = await fetch(`${wb.base}/registry/commands`, { headers: authed() })
    expect(res.status).toBe(200)
    const j: any = await res.json()
    const p = j.stacks.find((s: any) => s.title === 'Project')
    expect(p).toBeTruthy()
    expect(p.cards.map((c: any) => c.id)).toContain('hello')
  })

  it('404 for unknown registry', async () => {
    const res = await fetch(`${wb.base}/registry/nonsense`, { headers: authed() })
    expect(res.status).toBe(404)
    expect(typeof ((await res.json()) as any).error).toBe('string')
  })
})

describe('GET /helper/:registry/:id', () => {
  it('returns docs for features/fs', async () => {
    const res = await fetch(`${wb.base}/helper/features/fs`, { headers: authed() })
    expect(res.status).toBe(200)
    const j: any = await res.json()
    expect(j.registry).toBe('features')
    expect(j.id).toBe('fs')
    expect(typeof j.markdown).toBe('string')
    expect(j.markdown.length).toBeGreaterThan(0)
    expect('options' in j).toBe(true)
    expect('state' in j).toBe(true)
    expect(Array.isArray(j.events)).toBe(true)
  })
  it('404 for unknown helper id', async () => {
    const res = await fetch(`${wb.base}/helper/features/does-not-exist-xyz`, { headers: authed() })
    expect(res.status).toBe(404)
  })
  it('404 for unknown registry', async () => {
    const res = await fetch(`${wb.base}/helper/nonsense/fs`, { headers: authed() })
    expect(res.status).toBe(404)
  })
})

describe('POST /eval', () => {
  it('returns value', async () => {
    const j = await evalCode('1 + 2')
    expect(j.ok).toBe(true)
    expect(j.result).toBe(3)
    expect(typeof j.type).toBe('string')
  })
  it('supports async/await', async () => {
    const j = await evalCode('const x = await Promise.resolve(41); x + 1')
    expect(j.ok).toBe(true)
    expect(j.result).toBe(42)
  })
  it('has container in scope', async () => {
    const j = await evalCode('typeof container.feature')
    expect(j.ok).toBe(true)
    expect(j.result).toBe('function')
  })
  it('thrown error => ok:false', async () => {
    const res = await post('/eval', { code: "throw new Error('boom')" })
    expect(res.status).toBe(200)
    const j: any = await res.json()
    expect(j.ok).toBe(false)
    expect(String(j.error)).toContain('boom')
  })
  it('circular result does not crash', async () => {
    const j = await evalCode('const a: any = {n: 1}; a.self = a; a')
    expect(j.ok).toBe(true)
    expect((await fetch(`${wb.base}/project`, { headers: authed() })).status).toBe(200)
  })
  it('function and bigint results do not crash', async () => {
    const f = await evalCode('(() => 1)')
    expect(f.ok).toBe(true)
    const b = await evalCode('10n')
    expect(b.ok).toBe(true)
    const m = await evalCode('({ f() {}, b: 5n, s: Symbol("x"), u: undefined })')
    expect(m.ok).toBe(true)
    expect((await fetch(`${wb.base}/project`, { headers: authed() })).status).toBe(200)
  })
  it('400 on missing code', async () => {
    expect((await post('/eval', {})).status).toBe(400)
    expect((await post('/eval', { code: '' })).status).toBe(400)
  })
})

describe('WS /ws', () => {
  function open(url: string) {
    return new Promise<{ ok: boolean; msgs: any[]; ws: WebSocket }>((resolve) => {
      const ws = new WebSocket(url)
      const msgs: any[] = []
      let done = false
      const fin = (ok: boolean) => { if (!done) { done = true; resolve({ ok, msgs, ws }) } }
      ws.onmessage = (e) => { try { msgs.push(JSON.parse(String(e.data))) } catch {} ; fin(true) }
      ws.onerror = () => fin(false)
      ws.onclose = () => fin(false)
      setTimeout(() => fin(false), 8000)
    })
  }
  it('rejects without token', async () => {
    const r = await open(`ws://127.0.0.1:${wb.port}/ws`)
    expect(r.ok).toBe(false)
    try { r.ws.close() } catch {}
  })
  it('rejects wrong token', async () => {
    const r = await open(`ws://127.0.0.1:${wb.port}/ws?token=bad`)
    expect(r.ok).toBe(false)
    try { r.ws.close() } catch {}
  })
  it('sends hello with token', async () => {
    const r = await open(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
    expect(r.ok).toBe(true)
    expect(r.msgs[0].type).toBe('hello')
    r.ws.close()
  })
})

describe('lifecycle', () => {
  it('exits when stdin closes', async () => {
    const dir = makeProject()
    const r = await start(dir)
    ;(r.proc.stdin as any).end()
    const code = await Promise.race([
      r.proc.exited,
      new Promise<string>((res) => setTimeout(() => res('timeout'), 8000)),
    ])
    if (code === 'timeout') r.proc.kill()
    expect(code).toBe(0)
  }, 90000)
})

describe('GET /registries', () => {
  it('one stack per registry, cards with an address', async () => {
    const res = await fetch(`${wb.base}/registries`, { headers: authed() })
    expect(res.status).toBe(200)
    const j: any = await res.json()
    const ids = j.stacks.map((s: any) => s.id)
    expect(ids[0]).toBe('features')
    expect(ids).toContain('commands')
    for (const s of j.stacks) {
      expect(s.cards.length).toBeGreaterThan(0)
      for (const c of s.cards) {
        expect(c.id).toBe(`${s.id}.${c.title}`)
        // A command card opens the command runner; the rest open the inspector.
        expect(c.address).toBe(s.id === 'commands' ? `command/${encodeURIComponent(c.title)}` : `helper/${s.id}/${encodeURIComponent(c.title)}`)
        expect(c.open).toEqual({ tool: 'helper', registry: s.id, id: c.title })
      }
    }
    const features = j.stacks.find((s: any) => s.id === 'features')
    expect(features.cards[0].title).toBe('counter')
    expect(features.cards[0].badge).toBe('project')
    expect(features.cards.find((c: any) => c.title === 'fs').badge).toBeUndefined()
  })
})

describe('GET /helper/:registry/:id inspector fields', () => {
  it('fs: methods with signatures, fields, live state text', async () => {
    const j: any = await (await fetch(`${wb.base}/helper/features/fs`, { headers: authed() })).json()
    expect(j.title).toBe('features.fs')
    expect(typeof j.summary).toBe('string')
    expect(j.live).toBe(true)
    expect(j.callable).toBe(true)
    expect(typeof j.stateText).toBe('string')
    expect(JSON.parse(j.stateText).enabled).toBe(true)
    expect(j.liveNote).toBeNull()
    const exists = j.methods.find((m: any) => m.name === 'exists')
    expect(exists).toBeTruthy()
    expect(exists.signature.startsWith('exists(')).toBe(true)
    expect(exists.params[0].name).toBe('path')
    expect(typeof exists.argsHint).toBe('string')
    expect(exists.askArgs).toBe(true)
    const names = j.methods.map((m: any) => m.name)
    expect([...names].sort((a: string, b: string) => a.localeCompare(b))).toEqual(names)
    expect(j.stateFields.map((f: any) => f.name)).toContain('enabled')
    expect(Array.isArray(j.optionFields)).toBe(true)
    expect(Array.isArray(j.getters)).toBe(true)
  })

  it('a project feature with no instance: not live, but callable', async () => {
    const j: any = await (await fetch(`${wb.base}/helper/features/counter`, { headers: authed() })).json()
    expect(j.live).toBe(false)
    expect(j.stateText).toBeNull()
    expect(typeof j.liveNote).toBe('string')
    expect(j.callable).toBe(true)
    expect(j.methods.map((m: any) => m.name)).toEqual(expect.arrayContaining(['bump', 'join']))
    // bump(by = 1) has length 0, but it takes an argument: undocumented methods always ask.
    expect(j.methods.find((m: any) => m.name === 'bump').askArgs).toBe(true)
    expect(j.optionFields.map((f: any) => f.name)).toContain('step')
    expect(j.events).toContain('bumped')
  })

  it('a command is not callable without an instance', async () => {
    const j: any = await (await fetch(`${wb.base}/helper/commands/hello`, { headers: authed() })).json()
    expect(j.live).toBe(false)
    expect(j.callable).toBe(false)
  })
})

describe('POST /helper/:registry/:id/call', () => {
  const call = (registry: string, id: string, body: any) => post(`/helper/${registry}/${id}/call`, body)

  it('fs.exists with plain text is one string argument', async () => {
    const res = await call('features', 'fs', { method: 'exists', args: 'package.json' })
    expect(res.status).toBe(200)
    const j: any = await res.json()
    expect(j.ok).toBe(true)
    expect(j.result).toBe(true)
    expect(j.text).toBe('true')
    expect(j.type).toBe('boolean')
    expect(typeof j.ms).toBe('number')
    expect(j.call).toBe('fs.exists("package.json")')
  })

  it('a JSON array spreads for a method with two arguments', async () => {
    const j: any = await (await call('features', 'counter', { method: 'join', args: '["a", "b"]' })).json()
    expect(j.ok).toBe(true)
    expect(j.result).toBe('a b')
  })

  it('creates a feature, then state and events reach the socket', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
    const frames: any[] = []
    await new Promise<void>((resolve) => { ws.onmessage = (e) => { frames.push(JSON.parse(String(e.data))); resolve() } })
    ws.onmessage = (e) => frames.push(JSON.parse(String(e.data)))
    ws.send(JSON.stringify({ type: 'subscribe', registry: 'features', id: 'counter' }))
    const j: any = await (await call('features', 'counter', { method: 'bump', args: '2' })).json()
    expect(j.ok).toBe(true)
    expect(j.result).toBeGreaterThanOrEqual(2)
    const deadline = Date.now() + 5000
    while (Date.now() < deadline && !frames.some((f) => f.type === 'event' && f.name === 'bumped')) await Bun.sleep(50)
    const event = frames.find((f) => f.type === 'event' && f.name === 'bumped')
    expect(event).toBeTruthy()
    expect(event.registry).toBe('features')
    expect(event.id).toBe('counter')
    expect(event.text).toBe(String(j.result))
    expect(typeof event.at).toBe('number')
    const state = frames.find((f) => f.type === 'state' && f.id === 'counter')
    expect(state).toBeTruthy()
    expect(JSON.parse(state.text).count).toBe(j.result)
    ws.close()

    const view: any = await (await fetch(`${wb.base}/helper/features/counter`, { headers: authed() })).json()
    expect(view.live).toBe(true)
    expect(JSON.parse(view.stateText).count).toBe(j.result)
  })

  it('a thrown error is ok:false with the message', async () => {
    const j: any = await (await call('features', 'fs', { method: 'readFile', args: '"/no/such/file/xyz"' })).json()
    expect(j.ok).toBe(false)
    expect(typeof j.error).toBe('string')
  })

  it('refuses unknown helpers, unknown methods, missing method, no instance', async () => {
    expect((await call('features', 'nope-xyz', { method: 'x' })).status).toBe(404)
    expect((await call('features', 'fs', { method: 'notAMethodXyz' })).status).toBe(404)
    expect((await call('features', 'fs', {})).status).toBe(400)
    expect((await call('commands', 'hello', { method: 'run' })).status).toBe(409)
  })

  it('needs the token', async () => {
    const res = await fetch(`${wb.base}/helper/features/fs/call`, { method: 'POST', body: JSON.stringify({ method: 'exists', args: 'x' }) })
    expect(res.status).toBe(401)
  })
})

describe('parseArgs and displayText', () => {
  it('reads what the user typed as an argument list', () => {
    expect(parseArgs('', 1)).toEqual([])
    expect(parseArgs('  ', 2)).toEqual([])
    expect(parseArgs('package.json', 1)).toEqual(['package.json'])
    expect(parseArgs('"a b"', 1)).toEqual(['a b'])
    expect(parseArgs('42', 1)).toEqual([42])
    expect(parseArgs('[1, 2]', 2)).toEqual([1, 2])
    expect(parseArgs('[1, 2]', 1)).toEqual([[1, 2]])
    expect(parseArgs('{"a":1}', 2)).toEqual([{ a: 1 }])
    expect(parseArgs(['x', 1], 1)).toEqual(['x', 1])
    expect(parseArgs(undefined, 1)).toEqual([])
  })
  it('shows strings as is and the rest as pretty JSON', () => {
    expect(displayText('hi')).toBe('hi')
    expect(displayText(true)).toBe('true')
    expect(displayText({ a: 1 })).toBe('{\n  "a": 1\n}')
    expect(displayText(null)).toBe('null')
  })
})
