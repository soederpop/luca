import { describe, it, expect, afterAll } from 'bun:test'
import { z } from 'zod'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'fs'
import { NodeContainer } from '../src/node/container'

/**
 * The store feature: durable cross-process JSON state (round-3 finding #3).
 *
 * The load-bearing guarantee is update() — locked read-modify-write — which
 * makes the caching-proxy stats-corruption bug (concurrent siblings clobbering
 * each other's counters) impossible by construction. The cross-process test
 * below is that bug, re-staged.
 */

const container = new NodeContainer()
const stores = container.feature('store')
const opened: any[] = []

const openTmp = (opts: any = {}) => {
  const handle = container.store(`test-${container.utils.uuid().slice(0, 8)}`, { scope: 'tmp', ...opts })
  opened.push(handle)
  return handle
}

afterAll(async () => {
  for (const h of opened) {
    try { await h.delete() } catch {}
  }
})

describe('store — basics', () => {
  it('reads a missing file as initial (default {})', async () => {
    const s = openTmp()
    expect(await s.read()).toEqual({})
    expect(s.exists).toBe(false)
  })

  it('applies schema defaults to a missing file', async () => {
    const s = openTmp({ schema: z.object({ hits: z.number().default(0), tags: z.array(z.string()).default([]) }) })
    expect(await s.read()).toEqual({ hits: 0, tags: [] })
  })

  it('honors an explicit initial value', async () => {
    const s = openTmp({ initial: { mode: 'idle' } })
    expect(await s.read()).toEqual({ mode: 'idle' })
  })

  it('round-trips write → read, and the file is human-readable JSON', async () => {
    const s = openTmp()
    await s.write({ widgets: 12, nested: { ok: true } })
    expect(await s.read()).toEqual({ widgets: 12, nested: { ok: true } })
    // it's a real, pretty-printed file — the cat-ability is the point
    const onDisk = readFileSync(s.path, 'utf8')
    expect(onDisk).toContain('\n  "widgets": 12')
  })

  it('update() mutates a draft in place', async () => {
    const s = openTmp()
    await s.update((d: any) => { d.count = 1 })
    await s.update((d: any) => { d.count++ })
    expect((await s.read()).count).toBe(2)
  })

  it('update() accepts a returned replacement', async () => {
    const s = openTmp()
    await s.write({ a: 1 })
    const result = await s.update(() => ({ b: 2 }))
    expect(result).toEqual({ b: 2 })
    expect(await s.read()).toEqual({ b: 2 })
  })

  it('delete() removes the file; next read starts fresh', async () => {
    const s = openTmp({ initial: { fresh: true } })
    await s.write({ fresh: false })
    await s.delete()
    expect(s.exists).toBe(false)
    expect(await s.read()).toEqual({ fresh: true })
  })
})

describe('store — validation and errors', () => {
  it('schema rejects a bad write', async () => {
    const s = openTmp({ schema: z.object({ port: z.number() }) })
    await expect(s.write({ port: 'not-a-number' } as any)).rejects.toThrow()
  })

  it('invalid JSON on disk produces an actionable error naming the path', async () => {
    const s = openTmp()
    container.fs.ensureFolder(container.paths.dirname(s.path))
    writeFileSync(s.path, '{ definitely not json')
    await expect(s.read()).rejects.toThrow(/invalid JSON/)
  })

  it('rejects path-traversal names', () => {
    expect(() => container.store('../evil', { scope: 'tmp' })).toThrow(/Invalid store name/)
  })
})

describe('store — scopes and discovery', () => {
  it('project scope resolves under <cwd>/.luca/store', () => {
    const s = container.store('project-scoped-probe')
    expect(s.path).toBe(resolve(container.cwd, '.luca', 'store', 'project-scoped-probe.json'))
  })

  it('tmp scope resolves under the OS tmpdir', () => {
    const s = openTmp()
    expect(s.path.startsWith(resolve(tmpdir()))).toBe(true)
  })

  it('list() reports existing stores in a scope', async () => {
    const s = openTmp()
    await s.write({ present: true })
    expect(stores.list('tmp')).toContain(s.name)
  })
})

describe('store — concurrency (the reason this feature exists)', () => {
  it('same-process concurrent updates are serialized: no lost increments', async () => {
    const s = openTmp({ schema: z.object({ count: z.number().default(0) }) })
    await Promise.all(
      Array.from({ length: 20 }, () => s.update((d: any) => { d.count++ }))
    )
    expect((await s.read()).count).toBe(20)
  })

  it('cross-process concurrent updates are serialized: no lost increments', async () => {
    const s = openTmp({ schema: z.object({ count: z.number().default(0) }) })

    // Each worker is a genuinely separate bun process hammering update()
    const workerDir = mkdtempSync(join(tmpdir(), 'luca-store-worker-'))
    const workerPath = join(workerDir, 'worker.ts')
    const containerPath = resolve(import.meta.dir, '../src/node/container')
    writeFileSync(workerPath, `
      import { NodeContainer } from ${JSON.stringify(containerPath)}
      const container = new NodeContainer()
      const s = container.store(${JSON.stringify(s.name)}, { scope: 'tmp' })
      for (let i = 0; i < 15; i++) {
        await s.update((d) => { d.count = (d.count ?? 0) + 1 })
      }
    `)

    const procs = Array.from({ length: 3 }, () =>
      Bun.spawn({ cmd: ['bun', workerPath], stdout: 'pipe', stderr: 'pipe' })
    )
    const exits = await Promise.all(procs.map(p => p.exited))
    for (const [i, code] of exits.entries()) {
      if (code !== 0) {
        console.error(await new Response(procs[i].stderr).text())
      }
      expect(code).toBe(0)
    }

    // 3 processes × 15 increments — a single lost update makes this < 45
    expect((await s.read()).count).toBe(45)
  }, 30_000)

  it('a stale lock left by a dead process is stolen, not fatal', async () => {
    const s = openTmp()
    container.fs.ensureFolder(container.paths.dirname(s.path))
    // pid 3999999 is far above macOS/Linux pid ranges — guaranteed dead
    writeFileSync(`${s.path}.lock`, JSON.stringify({ pid: 3_999_999, at: Date.now() - 60_000 }))

    await s.update((d: any) => { d.survived = true })
    expect((await s.read()).survived).toBe(true)
    expect(existsSync(`${s.path}.lock`)).toBe(false)
  })

  it('a held lock times out with an actionable error', async () => {
    const s = openTmp({ lockTimeout: 300 })
    container.fs.ensureFolder(container.paths.dirname(s.path))
    // A live pid (our own) with a fresh timestamp — legitimately held
    writeFileSync(`${s.path}.lock`, JSON.stringify({ pid: process.pid, at: Date.now() }))

    await expect(s.update((d: any) => d)).rejects.toThrow(/timed out .* waiting for lock/)
    await container.fs.rm(`${s.path}.lock`, { force: true })
  })
})
