import { describe, it, expect } from 'bun:test'
import container, { Feature } from '../src/node'
import { FeaturesRegistry } from '../src/feature'
import { FileTools } from '../src/agi/features/file-tools'

describe('registry IDs copied from introspection', () => {
  it('accepts bare and qualified names for lookup, has, describe, and introspect', () => {
    const registry = new FeaturesRegistry()
    class Probe extends Feature {
      static override shortcut = 'features.dxSweepProbe' as const
    }
    registry.register('features.dxSweepProbe', Probe)
    expect(registry.available).toEqual(['dxSweepProbe'])
    expect(registry.has('dxSweepProbe')).toBe(true)
    expect(registry.has('features.dxSweepProbe')).toBe(true)
    expect(registry.lookup('features.dxSweepProbe')).toBe(Probe)
    expect(registry.describe('features.dxSweepProbe')).toBe(registry.describe('dxSweepProbe'))
    expect(registry.introspect('dxSweepProbe')).toBeDefined()
    expect(registry.introspect('features.dxSweepProbe')).toEqual(registry.introspect('dxSweepProbe'))
    expect(registry.introspect('absent')).toBeUndefined()
    expect(registry.unregister('features.dxSweepProbe')).toBe(true)
    expect(registry.has('dxSweepProbe')).toBe(false)
  })

  it('preserves scope-like text inside an ID and introspects aliases', () => {
    const registry = new FeaturesRegistry()
    class Probe extends Feature {
      static override shortcut = 'features.dxAliasTarget' as const
    }
    registry.register('prefixfeatures.child', Probe)
    expect(registry.available).toEqual(['prefixfeatures.child'])
    expect(registry.lookup('prefixfeatures.child')).toBe(Probe)
    expect(registry.introspect('prefixfeatures.child')?.shortcut).toBe('features.dxAliasTarget')
    expect(registry.unregister('features.prefixfeatures.child')).toBe(true)
  })
})

describe('process environment options', () => {
  it('merges overrides into the inherited environment without changing the parent', async () => {
    const key = `LUCA_DX_${container.utils.uuid().replaceAll('-', '')}`
    process.env[key] = 'parent'
    try {
      const result = await container.proc.spawnAndCapture(process.execPath, ['-e', `console.log(JSON.stringify({ value: process.env[${JSON.stringify(key)}], path: process.env.PATH }))`], {
        environment: { [key]: 'child value with spaces' },
      })
      expect(result.exitCode).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ value: 'child value with spaces', path: process.env.PATH })
      expect(process.env[key]).toBe('parent')
      const shell = await container.proc.tryExec(`printenv ${key}`, { environment: { [key]: 'shell value' } })
      expect(shell.stdout.trim()).toBe('shell value')
    } finally { delete process.env[key] }
  })
})

describe('describe default target', () => {
  const cli = container.paths.resolve('src/cli/cli.ts')
  it('returns machine-readable container introspection without requiring a target', async () => {
    const result = await container.proc.spawnAndCapture(process.execPath, [cli, 'describe', '--json'])
    expect(result.exitCode).toBe(0)
    const data = JSON.parse(result.stdout)
    expect(data.className).toContain('Container')
    expect(data.registries).toBeDefined()
    expect(data.factories).toBeDefined()
  }, 30_000)
  it('keeps explicit help available without changing its meaning', async () => {
    const result = await container.proc.spawnAndCapture(process.execPath, [cli, 'describe', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('Usage:')
    expect(result.stdout).toContain('--json')
  }, 30_000)
})

describe('file tool input contracts', () => {
  it('rejects empty edit matches at both tool-schema and direct-call boundaries', async () => {
    const folder = container.paths.resolve('attempts', `dx-edit-${container.utils.uuid()}`)
    container.fs.ensureFolder(folder)
    const file = container.paths.resolve(folder, 'source.txt')
    const tools = new FileTools({}, { container })
    try {
      for (const content of ['abc', '']) {
        container.fs.writeFile(file, content)
        for (const replaceAll of [false, true]) {
          const args = { path: file, oldString: '', newString: 'inserted', replaceAll }
          expect(FileTools.tools.editFile!.schema.safeParse(args).success).toBe(false)
          expect(await tools.editFile(args)).toContain('oldString must be nonempty')
          expect(container.fs.readFile(file)).toBe(content)
        }
      }
      container.fs.writeFile(file, 'a  b')
      expect(await tools.editFile({ path: file, oldString: '  ', newString: ' ' })).toContain('Edited')
      expect(container.fs.readFile(file)).toBe('a b')
    } finally { container.fs.remove(folder) }
  })

  it('rejects invalid line ranges rather than silently returning the whole file', async () => {
    const folder = container.paths.resolve('attempts', `dx-read-${container.utils.uuid()}`)
    container.fs.ensureFolder(folder)
    const file = container.paths.resolve(folder, 'source.txt')
    container.fs.writeFile(file, 'one\ntwo\nthree')
    const tools = new FileTools({}, { container })
    try {
      for (const key of ['offset', 'limit']) {
        for (const value of [0, -1, 1.5]) {
          const args = { path: file, [key]: value }
          expect(FileTools.tools.readFile!.schema.safeParse(args).success).toBe(false)
          await expect(tools.readFile(args)).rejects.toThrow(`${key} must be a positive integer`)
        }
      }
      expect(await tools.readFile({ path: file, offset: 2, limit: 1 })).toBe('2\ttwo')
      expect(await tools.writeFile({ path: file, content: 'é🙂' })).toBe(`Wrote 6 bytes to ${file}`)
    } finally { container.fs.remove(folder) }
  })
})
