import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseServerOptions } from '../src/workbench/servers'

const CLI = join('/Users/jonathansoeder/@luca', 'src/cli/cli.ts')
type Proc = ReturnType<typeof Bun.spawn>
let dir: string
let proc: Proc
let base = ''
let token = ''
let wsPort = 0

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
const view = async () => (await (await fetch(base + '/servers', { headers: headers() })).json()) as any
async function until<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 20000): Promise<T> {
  const deadline = Date.now() + ms
  let v = await read()
  while (!ok(v) && Date.now() < deadline) { await Bun.sleep(80); v = await read() }
  return v
}
const reachable = async (url: string) => { try { await fetch(url); return true } catch { return false } }

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'luca-workbench-servers-'))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-servers', version: '0.0.0' }))
  proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd: dir, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore' })
  const info = JSON.parse(await firstLine(proc))
  base = `http://127.0.0.1:${info.port}`
  wsPort = info.port
  token = info.token
}, 120000)

afterAll(() => {
  try { proc?.kill() } catch {}
  try { rmSync(dir, { recursive: true, force: true }) } catch {}
})

describe('parseServerOptions', () => {
  it('reads what a person types', () => {
    expect(parseServerOptions('')).toEqual({})
    expect(parseServerOptions('  3100 ')).toEqual({ port: 3100 })
    expect(parseServerOptions('{"port":3100,"cors":false}')).toEqual({ port: 3100, cors: false })
    expect(parseServerOptions('port=3100 cors=false host=0.0.0.0')).toEqual({ port: 3100, cors: false, host: '0.0.0.0' })
    expect(parseServerOptions({ port: 1 })).toEqual({ port: 1 })
    expect(() => parseServerOptions('{bad')).toThrow('not valid JSON')
    expect(() => parseServerOptions('[1]')).toThrow()
    expect(() => parseServerOptions('fast')).toThrow('Cannot read "fast"')
  })
})

describe('servers', () => {
  it('needs the token', async () => {
    expect((await fetch(base + '/servers')).status).toBe(401)
  })

  it('lists the registry with nothing running', async () => {
    const v = await view()
    const express = v.kinds.find((k: any) => k.id === 'express')
    expect(express.title).toBe('servers.express')
    expect(express.summary.length).toBeGreaterThan(10)
    expect(express.options.map((o: any) => o.name)).toContain('port')
    expect(express.options.map((o: any) => o.name)).not.toContain('beforeStart')
    expect(express.address).toBe('helper/servers/express')
    expect(express.running).toBe(0)
    expect(v.instances).toEqual([])
    expect(v.text).toBe('none listening')
  })

  it('starts express on 127.0.0.1, shows it, and stops it', async () => {
    const started = await post('/servers/start', { id: 'express', options: '' })
    expect(started.status).toBe(200)
    expect(started.body.instance.by).toBe('workbench')
    const key = started.body.instance.key
    const v = await until(view, (x) => x.instances[0]?.status === 'listening')
    const row = v.instances[0]
    expect(row.status).toBe('listening')
    expect(row.host).toBe('127.0.0.1')
    expect(row.port).toBeGreaterThan(0)
    expect(row.url).toBe(`http://localhost:${row.port}`)
    expect(row.title).toBe(`express :${row.port}`)
    expect(v.kinds.find((k: any) => k.id === 'express').running).toBe(1)
    expect(v.text).toBe('1 listening')
    expect(await reachable(`http://127.0.0.1:${row.port}/`)).toBe(true)

    // A second one takes another port.
    const second = await post('/servers/start', { id: 'express', options: '' })
    const two = await until(view, (x) => x.instances.length === 2 && x.instances.every((i: any) => i.status === 'listening'))
    expect(new Set(two.instances.map((i: any) => i.port)).size).toBe(2)
    expect((await post(`/servers/${second.body.instance.key}/stop`)).status).toBe(200)

    expect((await post(`/servers/${key}/stop`)).status).toBe(200)
    expect((await view()).instances).toEqual([])
    expect(await reachable(`http://127.0.0.1:${row.port}/`)).toBe(false)
    expect((await post(`/servers/${key}/stop`)).status).toBe(404)
  }, 30000)

  it('reports a port that is taken, and lets the row be cleared', async () => {
    const started = await post('/servers/start', { id: 'express', options: String(wsPort) })
    const v = await until(view, (x) => x.instances[0]?.status === 'failed')
    expect(v.instances[0].status).toBe('failed')
    expect(v.instances[0].error.length).toBeGreaterThan(3)
    expect(v.instances[0].url).toBeNull()
    expect((await post(`/servers/${started.body.instance.key}/stop`)).status).toBe(200)
    expect((await view()).instances).toEqual([])
  })

  it('refuses what it cannot run', async () => {
    expect((await post('/servers/start', { id: 'nope' })).status).toBe(404)
    expect((await post('/servers/start', {})).status).toBe(400)
    expect((await post('/servers/start', { id: 'express', options: 'fast' })).status).toBe(400)
    const stdio = await post('/servers/start', { id: 'mcp', options: 'transport=stdio' })
    expect(stdio.status).toBe(400)
    expect(stdio.body.error).toContain('stdio')
  })

  it('sees a server the console started, and can stop it', async () => {
    await post('/console', { code: "const mine = container.server('websocket', { cached: false }); await mine.start({ host: '127.0.0.1' }); mine.port", session: 'sv' })
    const v = await until(view, (x) => x.instances.length === 1)
    expect(v.instances[0]).toMatchObject({ id: 'websocket', by: 'project', status: 'listening' })
    expect(v.instances[0].url).toStartWith('ws://localhost:')
    expect((await post(`/servers/${v.instances[0].key}/stop`)).status).toBe(200)
    expect((await until(view, (x) => x.instances.length === 0)).instances).toEqual([])
  })

  it('sends a servers frame when something changes', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${wsPort}/ws?token=${token}`)
    const got: any[] = []
    await new Promise<void>((resolve) => { ws.onopen = () => resolve() })
    ws.onmessage = (e) => got.push(JSON.parse(String(e.data)))
    const started = await post('/servers/start', { id: 'express', options: '' })
    await until(async () => got, (g) => g.some((f) => f.type === 'servers'))
    expect(got.some((f) => f.type === 'servers')).toBe(true)
    await until(view, (x) => x.instances[0]?.status === 'listening')
    await post(`/servers/${started.body.instance.key}/stop`)
    ws.close()
  }, 30000)
})
