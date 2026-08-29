import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { rmSync, symlinkSync } from 'fs'

const container = new NodeContainer()
const fs = container.feature('fs')
const base = join(os.tmpdir(), `luca-fs-walk-links-${Date.now()}-${Math.random().toString(36).slice(2)}`)

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

describe('fs.walk gitignore-ish pattern semantics', () => {
  const tree = join(base, 'walk-tree')

  const setup = () => {
    fs.ensureFile(join(tree, 'top.ts'), '')
    fs.ensureFile(join(tree, 'top.js'), '')
    fs.ensureFile(join(tree, 'src/deep/nested.ts'), '')
    fs.ensureFile(join(tree, 'src/deep/nested.md'), '')
    fs.ensureFile(join(tree, 'node_modules/pkg/index.ts'), '')
    fs.ensureFile(join(tree, 'packages/app/node_modules/dep/index.ts'), '')
    fs.ensureFile(join(tree, 'packages/app/main.ts'), '')
  }

  it("include: ['*.ts'] matches nested files, not just top-level", () => {
    setup()
    const { files } = fs.walk(tree, { include: ['*.ts'], exclude: ['node_modules'], relative: true })
    expect(files.sort()).toEqual([
      'packages/app/main.ts',
      'src/deep/nested.ts',
      'top.ts',
    ])
  })

  it("exclude: ['node_modules'] prunes nested node_modules directories too", () => {
    setup()
    const { files, directories } = fs.walk(tree, { exclude: ['node_modules'], relative: true })
    expect(files.some(f => f.includes('node_modules'))).toBe(false)
    expect(directories.some(d => d.includes('node_modules'))).toBe(false)
    // Non-excluded siblings survive
    expect(files).toContain('packages/app/main.ts')
  })

  it('patterns containing / keep relative-path matching', () => {
    setup()
    const { files } = fs.walk(tree, { include: ['src/**/*.ts'], relative: true })
    expect(files).toEqual(['src/deep/nested.ts'])
  })

  it('walkAsync agrees with walk on both semantics', async () => {
    setup()
    const { files } = await fs.walkAsync(tree, { include: ['*.ts'], exclude: ['node_modules'], relative: true })
    expect(files.sort()).toEqual([
      'packages/app/main.ts',
      'src/deep/nested.ts',
      'top.ts',
    ])
  })
})

describe('fs.linkExists', () => {
  it('returns true for a dangling symlink where exists() returns false', async () => {
    const dir = join(base, 'links')
    fs.ensureFolder(dir)
    const link = join(dir, 'dangling')
    symlinkSync(join(dir, 'missing-target.txt'), link)

    expect(fs.exists(link)).toBe(false) // stats through to the missing target
    expect(fs.linkExists(link)).toBe(true)
    expect(await fs.linkExistsAsync(link)).toBe(true)
  })

  it('returns true for regular files and false for genuinely missing paths', async () => {
    const dir = join(base, 'links-regular')
    const file = join(dir, 'real.txt')
    fs.ensureFile(file, 'hi')

    expect(fs.linkExists(file)).toBe(true)
    expect(await fs.linkExistsAsync(file)).toBe(true)
    expect(fs.linkExists(join(dir, 'nope'))).toBe(false)
    expect(await fs.linkExistsAsync(join(dir, 'nope'))).toBe(false)
  })
})
