import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { rmSync } from 'fs'

const container = new NodeContainer()
const fs = container.feature('fs')
const base = join(os.tmpdir(), `luca-fs-aliases-${Date.now()}-${Math.random().toString(36).slice(2)}`)

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('fs node/fs-extra compat aliases', () => {
  it('mkdir / mkdirSync / mkdirAsync / ensureDir all create recursively', async () => {
    expect(fs.mkdir(join(base, 'a/deep/one'))).toContain('a/deep/one')
    expect(fs.mkdirSync(join(base, 'a/deep/two'), { recursive: true })).toContain('a/deep/two')
    expect(await fs.mkdirAsync(join(base, 'a/deep/three'))).toContain('a/deep/three')
    expect(fs.ensureDir(join(base, 'a/deep/four'))).toContain('a/deep/four')
    expect(await fs.ensureDirAsync(join(base, 'a/deep/five'))).toContain('a/deep/five')
    expect(fs.isDirectory(join(base, 'a/deep/five'))).toBe(true)
  })

  it('writeFileSync / appendFileSync / writeJsonSync delegate to the sync methods', () => {
    const file = join(base, 'write/log.txt')
    fs.ensureFolder(join(base, 'write'))
    fs.writeFileSync(file, 'hello')
    fs.appendFileSync(file, ' world')
    expect(fs.readFile(file)).toBe('hello world')

    fs.writeJsonSync(join(base, 'write/data.json'), { ok: true })
    expect(fs.readJson(join(base, 'write/data.json'))).toEqual({ ok: true })
  })

  it('readDir / readDirSync / readdirAsync list directory contents', async () => {
    const dir = join(base, 'listing')
    fs.ensureFile(join(dir, 'one.txt'), '1')
    fs.ensureFile(join(dir, 'two.txt'), '2')
    expect((await fs.readDir(dir)).sort()).toEqual(['one.txt', 'two.txt'])
    expect(fs.readDirSync(dir).sort()).toEqual(['one.txt', 'two.txt'])
    expect((await fs.readdirAsync(dir)).sort()).toEqual(['one.txt', 'two.txt'])
  })

  it('deleteFile / deleteFileAsync / unlink / unlinkSync / rmAsync remove files', async () => {
    const dir = join(base, 'deleting')
    for (const name of ['a', 'b', 'c', 'd', 'e']) fs.ensureFile(join(dir, name), 'x')

    fs.deleteFile(join(dir, 'a'))
    await fs.deleteFileAsync(join(dir, 'b'))
    await fs.unlink(join(dir, 'c'))
    fs.unlinkSync(join(dir, 'd'))
    await fs.rmAsync(join(dir, 'e'))

    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('rm and rmSync honor node-style { recursive, force }', async () => {
    const dir = join(base, 'rm-options')
    fs.ensureFile(join(dir, 'nested/file.txt'), 'x')
    await fs.rm(join(dir, 'nested'), { recursive: true, force: true })
    expect(fs.exists(join(dir, 'nested'))).toBe(false)

    fs.ensureFile(join(dir, 'nested2/file.txt'), 'x')
    fs.rmSync(join(dir, 'nested2'), { recursive: true })
    expect(fs.exists(join(dir, 'nested2'))).toBe(false)

    // force: doesn't throw on a missing path
    await fs.rm(join(dir, 'never-existed'), { force: true })
    fs.rmSync(join(dir, 'never-existed'))
  })

  it('rm without options still throws on a missing file (unlink semantics)', async () => {
    await expect(fs.rm(join(base, 'nope-missing'))).rejects.toThrow()
  })

  it('rmdir / rmdirAsync accept and ignore node-style options', async () => {
    const dir = join(base, 'rmdir-compat')
    fs.ensureFile(join(dir, 'one/file.txt'), 'x')
    fs.ensureFile(join(dir, 'two/file.txt'), 'x')
    fs.rmdirSync(join(dir, 'one'), { recursive: true })
    await fs.rmdirAsync(join(dir, 'two'))
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('remove / removeSync delete files and directories alike', async () => {
    const dir = join(base, 'removing')
    fs.ensureFile(join(dir, 'sub/file.txt'), 'x')
    fs.ensureFile(join(dir, 'plain.txt'), 'x')
    await fs.remove(join(dir, 'sub'))
    fs.removeSync(join(dir, 'plain.txt'))
    await fs.remove(join(dir, 'never-existed')) // no throw
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('pathExists / pathExistsSync / statSync behave like their targets', async () => {
    const file = join(base, 'stats/file.txt')
    fs.ensureFile(file, 'content')
    expect(await fs.pathExists(file)).toBe(true)
    expect(fs.pathExistsSync(file)).toBe(true)
    expect(await fs.pathExists(join(base, 'nope'))).toBe(false)
    expect(fs.statSync(file).isFile()).toBe(true)
  })

  it('cp / cpSync / copySync copy files and directories', async () => {
    const dir = join(base, 'copying')
    fs.ensureFile(join(dir, 'src/file.txt'), 'data')
    await fs.cp(join(dir, 'src'), join(dir, 'dest-async'))
    fs.cpSync(join(dir, 'src'), join(dir, 'dest-sync'))
    fs.copySync(join(dir, 'src/file.txt'), join(dir, 'file-copy.txt'))
    expect(fs.readFile(join(dir, 'dest-async/file.txt'))).toBe('data')
    expect(fs.readFile(join(dir, 'dest-sync/file.txt'))).toBe('data')
    expect(fs.readFile(join(dir, 'file-copy.txt'))).toBe('data')
  })

  it('rename / renameSync / moveSync move files', async () => {
    const dir = join(base, 'renaming')
    fs.ensureFile(join(dir, 'a.txt'), 'a')
    fs.ensureFile(join(dir, 'b.txt'), 'b')
    fs.ensureFile(join(dir, 'c.txt'), 'c')
    await fs.rename(join(dir, 'a.txt'), join(dir, 'a2.txt'))
    fs.renameSync(join(dir, 'b.txt'), join(dir, 'b2.txt'))
    fs.moveSync(join(dir, 'c.txt'), join(dir, 'c2.txt'))
    expect(fs.readdirSync(dir).sort()).toEqual(['a2.txt', 'b2.txt', 'c2.txt'])
  })

  it('every alias resolves through container.feature("fs") with awaitable sync methods', async () => {
    // awaiting a sync method is harmless — agents that guess async never break
    const file = join(base, 'awaitable/data.json')
    await fs.mkdir(join(base, 'awaitable'))
    await fs.writeFileSync(file, '{"n":1}')
    expect(await fs.readJsonSync(file)).toEqual({ n: 1 })
  })
})
