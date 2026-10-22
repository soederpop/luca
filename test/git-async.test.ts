import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { execSync } from 'child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { NodeContainer } from '../src/node/container'

// Each async variant must return what its sync counterpart returns, apart from
// the documented empty-list difference. Uses a purpose-built repo, not the luca
// checkout: `luca release` runs the suite from a `git archive` snapshot with no .git.
let repoDir: string
let git: any

beforeAll(() => {
  repoDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-git-async-')))
  mkdirSync(join(repoDir, 'src'), { recursive: true })
  writeFileSync(join(repoDir, 'package.json'), JSON.stringify({ name: 'git-fixture', version: '1.0.0' }))
  writeFileSync(join(repoDir, 'src', 'index.ts'), 'export const answer = 42\n')

  const run = (args: string) => execSync(`git ${args}`, { cwd: repoDir, stdio: 'pipe' })
  run('init -q -b main')
  run('config user.email fixture@example.com')
  run('config user.name Fixture')
  run('add -A')
  run('commit -q -m "seed the fixture repo"')
  writeFileSync(join(repoDir, 'package.json'), JSON.stringify({ name: 'git-fixture', version: '1.0.1' }))
  writeFileSync(join(repoDir, 'src', 'index.ts'), 'export const answer = 43\n')
  run('commit -q -am "bump the fixture version"')
  // Untracked files, one of them excluded, for the --others listing.
  writeFileSync(join(repoDir, 'notes.txt'), 'untracked\n')
  mkdirSync(join(repoDir, 'dist'), { recursive: true })
  writeFileSync(join(repoDir, 'dist', 'out.js'), '// build output\n')

  git = new NodeContainer({ cwd: repoDir }).feature('git')
})

afterAll(() => {
  rmSync(repoDir, { recursive: true, force: true })
})

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
    const path = 'src/index.ts'
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
