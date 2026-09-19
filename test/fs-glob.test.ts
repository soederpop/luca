import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { rmSync } from 'fs'

const container = new NodeContainer()
const fs = container.feature('fs')
const base = join(os.tmpdir(), `luca-fs-glob-${Date.now()}-${Math.random().toString(36).slice(2)}`)

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

const setup = () => {
  fs.ensureFile(join(base, 'top.ts'), '')
  fs.ensureFile(join(base, 'top.md'), '')
  fs.ensureFile(join(base, '.hidden.ts'), '')
  fs.ensureFile(join(base, 'src/deep/nested.ts'), '')
  fs.ensureFile(join(base, 'src/deep/nested.test.ts'), '')
  fs.ensureFile(join(base, 'node_modules/pkg/index.ts'), '')
}

describe('fs.glob', () => {
  it('matches recursively and returns sorted cwd-relative paths', () => {
    setup()
    const files = fs.glob('**/*.ts', { cwd: base, exclude: ['node_modules'] })
    expect(files).toEqual([
      'src/deep/nested.test.ts',
      'src/deep/nested.ts',
      'top.ts',
    ])
  })

  it('slash-free excludes match any segment, like walk', () => {
    setup()
    const files = fs.glob('**/*.ts', { cwd: base, exclude: ['node_modules', '*.test.ts'] })
    expect(files).toEqual(['src/deep/nested.ts', 'top.ts'])
  })

  it('excludes containing / match the relative path', () => {
    setup()
    const files = fs.glob('**/*.ts', { cwd: base, exclude: ['node_modules/**', 'src/deep/*.test.ts'] })
    expect(files).toEqual(['src/deep/nested.ts', 'top.ts'])
  })

  it('accepts multiple patterns and dedupes', () => {
    setup()
    const files = fs.glob(['*.ts', '*.md', 'top.*'], { cwd: base })
    expect(files).toEqual(['top.md', 'top.ts'])
  })

  it('skips dotfiles unless dot: true', () => {
    setup()
    expect(fs.glob('*.ts', { cwd: base })).toEqual(['top.ts'])
    expect(fs.glob('*.ts', { cwd: base, dot: true })).toEqual(['.hidden.ts', 'top.ts'])
  })

  it('absolute: true returns absolute paths', () => {
    setup()
    const files = fs.glob('*.md', { cwd: base, absolute: true })
    expect(files).toEqual([join(base, 'top.md')])
  })

  it('cwd defaults to the container cwd', () => {
    setup()
    const scoped = new NodeContainer({ cwd: base })
    const files = scoped.feature('fs').glob('*.md')
    expect(files).toEqual(['top.md'])
  })

  it('globAsync agrees with glob', async () => {
    setup()
    const files = await fs.globAsync('**/*.ts', { cwd: base, exclude: ['node_modules', '*.test.ts'] })
    expect(files).toEqual(['src/deep/nested.ts', 'top.ts'])
  })
})
