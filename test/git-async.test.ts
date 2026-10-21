import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

// Runs against the luca repo itself. Each async variant must return what its
// sync counterpart returns, apart from the documented empty-list difference.
const container = new NodeContainer()
const git = container.feature('git')

describe('git async variants', () => {
  it('getBranch and getSha match the sync getters', async () => {
    expect(await git.getBranch()).toBe(git.branch)
    expect(await git.getSha()).toBe(git.sha)
  })

  it('lsFilesAsync matches lsFiles for tracked files', async () => {
    expect(await git.lsFilesAsync()).toEqual(await git.lsFiles())
  })

  it('lsFilesAsync matches lsFiles for untracked files with excludes', async () => {
    const opts = { others: true, exclude: ['node_modules', 'dist'] }
    const sync = (await git.lsFiles(opts)).filter(Boolean)
    expect(await git.lsFilesAsync(opts)).toEqual(sync)
  })

  it('lsFilesAsync returns [] when git lists nothing', async () => {
    const files = await git.lsFilesAsync({ baseDir: 'no-such-dir-for-git-async-test' })
    expect(files).toEqual([])
  })

  it('fileLogAsync and getLatestChangesAsync match the sync versions', async () => {
    expect(await git.fileLogAsync('package.json')).toEqual(git.fileLog('package.json'))
    expect(await git.getLatestChangesAsync(5)).toEqual(await git.getLatestChanges(5))
  })

  it('diffAsync matches diff', async () => {
    const [, older] = git.fileLog('package.json')
    expect(older).toBeDefined()
    expect(await git.diffAsync('package.json', older!.sha)).toBe(git.diff('package.json', older!.sha))
  })

  it('getChangeHistoryForFilesAsync matches the sync version', async () => {
    const path = 'src/node/features/git.ts'
    expect(await git.getChangeHistoryForFilesAsync(path)).toEqual(git.getChangeHistoryForFiles(path))
  })

  it('execAsync rejects when git fails', async () => {
    await expect(git.execAsync(['rev-parse', 'no-such-ref-for-git-async-test'])).rejects.toThrow(/exit code/)
  })

  it('lsFilesAsync does not block the event loop', async () => {
    let ticks = 0
    const timer = setInterval(() => { ticks++ }, 1)
    await git.lsFilesAsync()
    await git.lsFilesAsync()
    clearInterval(timer)
    expect(ticks).toBeGreaterThan(0)
  })
})
