import { describe, it, expect, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, realpathSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { NodeContainer } from '../src/node/container'

/**
 * Regression test: watch excludes used to be dead. Relative globs were tested
 * against chokidar's absolute paths, so they never matched, and excludes passed
 * to a second watch() call were dropped because the watcher already existed.
 */
describe('fileManager.watch — excludes', () => {
  // realpath: macOS tmpdir is a symlink, and chokidar reports resolved paths
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-fm-exclude-')))
  for (const sub of ['src', 'tmp', 'logs', 'node_modules/pkg', 'src/node_modules', '.git', 'dist']) {
    mkdirSync(join(dir, sub), { recursive: true })
  }
  const container = new NodeContainer({ cwd: dir })
  const fm = container.feature('fileManager') as any
  const events: string[] = []

  afterAll(async () => {
    await fm.stopWatching()
    rmSync(dir, { recursive: true, force: true })
  })

  it('matches relative, depth-free and absolute patterns against absolute paths', async () => {
    await fm.watch({ paths: [dir], exclude: ['tmp/**'] })
    fm.on('file:change', (e: { path: string }) => events.push(e.path.slice(dir.length + 1)))
    await waitFor(() => fm.isWatching, 5000, 'watcher never became ready')

    expect(fm.isWatchExcluded(join(dir, 'tmp/a.log'))).toBe(true)
    expect(fm.isWatchExcluded('tmp/a.log')).toBe(true)
    expect(fm.isWatchExcluded(join(dir, 'src/tmp/a.log'))).toBe(false)
    expect(fm.isWatchExcluded(join(dir, 'node_modules/pkg/index.js'))).toBe(true)
    expect(fm.isWatchExcluded(join(dir, 'src/node_modules/x.js'))).toBe(true)
    expect(fm.isWatchExcluded(join(dir, '.git/HEAD'))).toBe(true)
    expect(fm.isWatchExcluded(join(dir, 'dist/out.js'))).toBe(true)
    expect(fm.isWatchExcluded(join(dir, 'src/index.ts'))).toBe(false)
  })

  it('applies excludes passed to a later watch() call', async () => {
    await fm.watch({ paths: [join(dir, 'src')], exclude: ['logs/**', `${dir}/src/generated/**`] })
    expect(fm.watchExcludes).toContain('logs/**')
    expect(fm.isWatchExcluded(join(dir, 'logs/a.log'))).toBe(true)
    expect(fm.isWatchExcluded(join(dir, 'src/generated/x.ts'))).toBe(true)
  })

  it('emits no events for excluded paths', async () => {
    writeFileSync(join(dir, 'tmp/a.log'), 'x')
    writeFileSync(join(dir, 'logs/a.log'), 'x')
    writeFileSync(join(dir, 'node_modules/pkg/index.js'), 'x')
    writeFileSync(join(dir, 'src/index.ts'), 'x')

    await waitFor(() => events.includes('src/index.ts'), 5000, 'included file never emitted')
    await new Promise((r) => setTimeout(r, 500))
    expect(events).toEqual(['src/index.ts'])
  }, 15000)
})

async function waitFor(cond: () => boolean, timeoutMs: number, message: string) {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out: ${message}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}
