import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const root = join(os.tmpdir(), `luca-tree-missing-${Date.now()}-${Math.random().toString(36).slice(2)}`)
mkdirSync(root, { recursive: true })

afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('jsonTree.loadTree missing base path', () => {
  it('throws an error naming the missing path', async () => {
    const container = new NodeContainer({ cwd: root })
    const jsonTree = container.feature('jsonTree', { enable: true })
    await expect(jsonTree.loadTree('no-such-dir-xyz')).rejects.toThrow(/no-such-dir-xyz/)
    await expect(jsonTree.loadTree('no-such-dir-xyz')).rejects.toThrow(/does not exist/)
  })

  it('loadTreeIfExists yields an empty tree for a missing path', async () => {
    const container = new NodeContainer({ cwd: root })
    const jsonTree = container.feature('jsonTree', { enable: true })
    const tree = await jsonTree.loadTreeIfExists('no-such-dir-xyz', 'optional')
    expect((tree as any).optional).toEqual({})
  })

  it('loadTreeIfExists loads normally when the path exists', async () => {
    const dir = join(root, 'json-data', 'nested')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'config.json'), JSON.stringify({ ok: true }))

    const container = new NodeContainer({ cwd: root })
    const jsonTree = container.feature('jsonTree', { enable: true })
    const tree = await jsonTree.loadTreeIfExists('json-data', 'data')
    expect((tree as any).data.nested.config).toEqual({ ok: true })
  })
})

describe('yamlTree.loadTree missing base path', () => {
  it('throws an error naming the missing path', async () => {
    const container = new NodeContainer({ cwd: root })
    const yamlTree = container.feature('yamlTree', { enable: true })
    await expect(yamlTree.loadTree('nope-yaml-dir')).rejects.toThrow(/nope-yaml-dir/)
    await expect(yamlTree.loadTree('nope-yaml-dir')).rejects.toThrow(/does not exist/)
  })

  it('loadTreeIfExists yields an empty tree for a missing path', async () => {
    const container = new NodeContainer({ cwd: root })
    const yamlTree = container.feature('yamlTree', { enable: true })
    const tree = await yamlTree.loadTreeIfExists('nope-yaml-dir', 'optional')
    expect((tree as any).optional).toEqual({})
  })

  it('loadTreeIfExists loads normally when the path exists', async () => {
    const dir = join(root, 'yaml-data')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'settings.yml'), 'host: db.example.com\n')

    const container = new NodeContainer({ cwd: root })
    const yamlTree = container.feature('yamlTree', { enable: true })
    const tree = await yamlTree.loadTreeIfExists('yaml-data', 'cfg')
    expect((tree as any).cfg.settings.host).toBe('db.example.com')
  })
})
