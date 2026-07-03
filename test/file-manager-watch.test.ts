import { describe, it, expect, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, renameSync, rmSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { NodeContainer } from '../src/node/container'

/**
 * Regression test: fileManager.watch must finish its own internal bookkeeping
 * (statSync via updateFile) BEFORE emitting `file:change`, and the internal stat
 * must be resilient to the file vanishing. Previously, a handler that
 * synchronously moved/deleted the file could make the watcher's internal
 * statSync crash with ENOENT.
 */
describe('fileManager.watch — handler moves file during file:change', () => {
  const dir = mkdtempSync(join(tmpdir(), 'luca-fm-watch-'))
  const outside = mkdtempSync(join(tmpdir(), 'luca-fm-outside-'))
  const container = new NodeContainer({ cwd: dir })
  const fm = container.feature('fileManager') as any

  afterAll(async () => {
    await fm.stopWatching()
    rmSync(dir, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  })

  it('does not crash and still delivers events when the handler moves the file away', async () => {
    await fm.watch({ paths: [dir] })

    // Wait for chokidar to be ready
    await waitFor(() => fm.isWatching, 5000, 'watcher never became ready')

    const events: Array<{ type: string; path: string }> = []
    let indexedBeforeEmit: boolean | null = null

    fm.on('file:change', (event: { type: string; path: string }) => {
      events.push(event)
      if (event.type === 'add') {
        // Internal bookkeeping must have completed BEFORE the event was emitted
        indexedBeforeEmit = fm.files.has(event.path)
        // Synchronously move the file out of the watched dir — this used to
        // crash the watcher's internal statSync with ENOENT
        renameSync(event.path, join(outside, 'moved.txt'))
      }
    })

    writeFileSync(join(dir, 'victim.txt'), 'hello')

    // The add event must arrive without crashing the process
    await waitFor(() => events.some((e) => e.type === 'add'), 5000, 'add event never delivered')

    expect(events.find((e) => e.type === 'add')!.path).toContain('victim.txt')
    expect(indexedBeforeEmit).toBe(true)

    // The move produces an unlink — the watcher must survive and deliver it too
    await waitFor(() => events.some((e) => e.type === 'delete'), 5000, 'delete event never delivered')
    expect(fm.files.has(join(dir, 'victim.txt'))).toBe(false)

    // Watcher is still alive and functional after the mid-handler move
    writeFileSync(join(dir, 'survivor.txt'), 'still watching')
    await waitFor(() => events.some((e) => e.type === 'add' && e.path.includes('survivor.txt')), 5000, 'watcher stopped delivering events after the move')
  }, 20000)

  it('updateFile tolerates a path that no longer exists (ENOENT)', async () => {
    const ghost = join(dir, 'ghost.txt')
    // Seed the index, then make the file vanish before updateFile stats it
    mkdirSync(dir, { recursive: true })
    writeFileSync(ghost, 'x')
    await fm.updateFile(ghost)
    expect(fm.files.has(ghost)).toBe(true)

    rmSync(ghost)
    // Must not throw — and must drop the vanished file from the index
    await fm.updateFile(ghost)
    expect(fm.files.has(ghost)).toBe(false)
  })
})

async function waitFor(cond: () => boolean, timeoutMs: number, message: string) {
  const start = Date.now()
  while (!cond()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out: ${message}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}
