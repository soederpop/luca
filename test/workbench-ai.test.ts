import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { envNames, setEnvValue } from '../src/workbench/ai'

const CLI = join('/Users/jonathansoeder/@luca', 'src/cli/cli.ts')
type Proc = ReturnType<typeof Bun.spawn>
let dir: string
let home: string
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

const headers = () => ({ Authorization: `Bearer ${token}`, 'content-type': 'application/json' })
const post = async (path: string, body: any = {}) => {
  const res = await fetch(base + path, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  return { status: res.status, body: (await res.json()) as any }
}
const view = async () => (await (await fetch(base + '/ai', { headers: headers() })).json()) as any

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'luca-workbench-ai-'))
  home = mkdtempSync(join(tmpdir(), 'luca-workbench-ai-home-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-ai', version: '0.0.0' }))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'docs', 'task.md'), '# Task\n\nSay hi.\n')
  // Its own luca home and no keys, so the developer's machine does not change what this asserts.
  const env: Record<string, string> = { ...(process.env as any), LUCA_HOME: home }
  for (const k of ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'LUCA_DEFAULT_PROVIDER', 'LUCA_PLUGINS']) delete env[k]
  proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd: dir, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore', env })
  const info = JSON.parse(await firstLine(proc))
  base = `http://127.0.0.1:${info.port}`
  token = info.token
}, 120000)

afterAll(() => {
  try { proc?.kill() } catch {}
  for (const d of [dir, home]) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('.env text', () => {
  it('lists the names that have a value', () => {
    expect(envNames('A=1\n# B=2\nexport C="x"\nD=\nE=""\n')).toEqual(['A', 'C'])
    expect(envNames(null)).toEqual([])
  })
  it('sets a value in place or at the end', () => {
    expect(setEnvValue(null, 'OPENAI_API_KEY', 'sk-1')).toBe('OPENAI_API_KEY=sk-1\n')
    expect(setEnvValue('A=1\n', 'OPENAI_API_KEY', 'sk-1')).toBe('A=1\nOPENAI_API_KEY=sk-1\n')
    expect(setEnvValue('A=1\nOPENAI_API_KEY=old\nB=2\n', 'OPENAI_API_KEY', 'sk-2')).toBe('A=1\nOPENAI_API_KEY=sk-2\nB=2\n')
    expect(setEnvValue('', 'K_EY', 'a b')).toBe('K_EY="a b"\n')
  })
})

describe('GET /ai', () => {
  it('needs the token', async () => {
    expect((await fetch(base + '/ai')).status).toBe(401)
  })

  it('shows providers, keys, local models, agents and config files', async () => {
    const v = await view()
    const openai = v.providers.find((p: any) => p.id === 'openai')
    expect(openai).toMatchObject({ status: 'needs key', statusText: 'needs OPENAI_API_KEY', source: 'built in' })
    const key = v.keys.find((k: any) => k.env === 'OPENAI_API_KEY')
    expect(key).toMatchObject({ label: 'OpenAI', set: false, where: null })
    expect(key.providers).toContain('openai')
    expect(v.local.map((c: any) => c.id)).toEqual(['binary', 'embeddings', 'chat', 'describe'])
    for (const c of v.local) expect(c.ok ? c.fix : typeof c.fix).toBe(c.ok ? null : 'string')
    expect(v.agents.map((a: any) => a.id)).toEqual(['claude', 'codex', 'hermes'])
    for (const a of v.agents) expect(typeof a.available).toBe('boolean')
    expect(v.configFiles.map((f: any) => f.kind)).toEqual(['machine', 'project'])
    expect(v.configFiles[0].path).toBe(join(home, 'model-providers.yml'))
    expect(v.configFiles[0].exists).toBe(false)
    expect(v.servers).toEqual([])
    expect(v.scannedAt).toBeNull()
    expect(v.envWarning).toBeNull()
  }, 30000)
})

describe('POST /ai/key', () => {
  it('writes the key to .env, makes it live, and never sends it back', async () => {
    const a = await post('/ai/key', { env: 'OPENAI_API_KEY', value: 'sk-test-not-a-real-key' })
    expect(a.status).toBe(200)
    expect(JSON.stringify(a.body)).not.toContain('sk-test-not-a-real-key')
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe('OPENAI_API_KEY=sk-test-not-a-real-key\n')
    const key = a.body.view.keys.find((k: any) => k.env === 'OPENAI_API_KEY')
    expect(key).toMatchObject({ set: true, where: "this project's .env" })
    expect(a.body.view.providers.find((p: any) => p.id === 'openai').status).toBe('ready')
    expect(a.body.view.defaultProvider).toBe('openai')
    expect(JSON.stringify(await view())).not.toContain('sk-test-not-a-real-key')
  }, 30000)

  it('takes only a key a provider reads, on one line', async () => {
    expect((await post('/ai/key', { env: 'PATH', value: 'x' })).status).toBe(400)
    expect((await post('/ai/key', { env: 'openai_api_key', value: 'x' })).status).toBe(400)
    expect((await post('/ai/key', { env: 'OPENAI_API_KEY', value: '' })).status).toBe(400)
    expect((await post('/ai/key', { env: 'OPENAI_API_KEY', value: 'a\nB=1' })).status).toBe(400)
    expect(readFileSync(join(dir, '.env'), 'utf8')).toBe('OPENAI_API_KEY=sk-test-not-a-real-key\n')
  })
})

describe('found servers', () => {
  const found = { baseURL: 'http://127.0.0.1:5555/v1', host: '127.0.0.1', port: 5555, source: 'localhost', hint: 'LM Studio', models: ['qwen3', 'gemma4'], latencyMs: 12.4 }

  it('shows a scan and adds a server to the machine file as a provider', async () => {
    // A scan result put in by hand: the test must not probe the network.
    await post('/console', { code: `const mp = container.feature('modelProviders'); mp.state.set('discoveredServers', [${JSON.stringify(found)}]); mp.state.set('discoveredAt', Date.now()); 1` })
    const v = await view()
    expect(v.servers[0]).toMatchObject({ title: 'LM Studio on this Mac', models: ['qwen3', 'gemma4'], latencyMs: 12 })
    expect(v.scannedAt).toBeGreaterThan(0)

    const bad = await post('/ai/providers/add', { baseURL: found.baseURL, target: 'machine', model: 'nope' })
    expect(bad.status).toBe(400)
    const a = await post('/ai/providers/add', { baseURL: found.baseURL, target: 'machine', model: 'gemma4' })
    expect(a.status).toBe(200)
    expect(a.body.added.length).toBe(1)
    const id = a.body.added[0]
    const file = join(home, 'model-providers.yml')
    expect(existsSync(file)).toBe(true)
    const text = readFileSync(file, 'utf8')
    expect(text).toContain('http://127.0.0.1:5555/v1')
    expect(text).toContain('gemma4')
    const provider = a.body.view.providers.find((p: any) => p.id === id)
    expect(provider).toMatchObject({ source: 'machine', model: 'gemma4', status: 'ready' })
    expect(a.body.view.servers[0].profileId).toBe(id)
    expect(a.body.view.configFiles[0].providers).toContain(id)
  }, 30000)

  it('adds to the project file under providers:, keeping what is there', async () => {
    mkdirSync(join(dir, 'assistants'), { recursive: true })
    writeFileSync(join(dir, 'assistants', 'options.yml'), 'voice: alloy\n')
    const a = await post('/ai/providers/add', { baseURL: found.baseURL, target: 'project' })
    expect(a.status).toBe(200)
    const text = readFileSync(join(dir, 'assistants', 'options.yml'), 'utf8')
    expect(text).toContain('voice: alloy')
    expect(text).toContain('providers:')
    expect((await post('/ai/providers/add', { baseURL: 'http://127.0.0.1:9/v1', target: 'project' })).status).toBe(404)
    expect((await post('/ai/providers/add', { baseURL: found.baseURL, target: 'elsewhere' })).status).toBe(400)
  }, 30000)
})

describe('POST /prompt/targets', () => {
  it('gives the file to pass and what can run it', async () => {
    const a = await post('/prompt/targets', { file: 'docs/task.md' })
    expect(a.status).toBe(200)
    expect(a.body.file).toBe('docs/task.md')
    expect(a.body.targets.filter((t: any) => t.kind === 'agent').map((t: any) => t.id)).toEqual(['claude', 'codex', 'hermes'])
    expect(typeof a.body.defaultTarget).toBe('string')
    const doc = await post('/prompt/targets', { doc: 'task' })
    expect(doc.body.file).toBe('docs/task.md')
  }, 30000)
  it('refuses a file outside the project and an unknown doc', async () => {
    expect((await post('/prompt/targets', { file: '../x.md' })).status).toBe(400)
    expect((await post('/prompt/targets', { doc: 'nope' })).status).toBe(404)
    expect((await post('/prompt/targets', {})).status).toBe(400)
  })
})

describe('a provider named by hostname', () => {
  it('is ready when the scan found that machine by its IP', async () => {
    await post('/console', { code: `const mp2 = container.feature('modelProviders'); mp2.registerLocal('boxy', 'http://Spark-Box:8888/v1', 'm1'); mp2.state.set('discoveredServers', [{ baseURL: 'http://100.64.0.9:8888/v1', host: '100.64.0.9', port: 8888, source: 'tailscale', hostname: 'spark-box.tail1.ts.net', hint: 'vLLM', models: ['m1'], latencyMs: 30 }]); mp2.state.set('discoveredAt', Date.now()); 1` })
    const v = await view()
    expect(v.providers.find((p: any) => p.id === 'boxy')).toMatchObject({ status: 'ready', statusText: 'answers with 1 model' })
    expect(v.servers[0].profileId).toBe('boxy')
    expect(v.servers[0].title).toBe('vLLM on spark-box.tail1.ts.net')
  }, 30000)
})
