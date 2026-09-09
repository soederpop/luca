import { describe, it, expect } from 'bun:test'
import { publishRelease } from '../scripts/lib/local-release'

function fixture(overrides: { version?: string; workflow?: string; remoteSha?: string; published?: string; fail?: string; assets?: boolean; corruptPublish?: boolean } = {}) {
  const version = overrides.version ?? '3.12.1'
  const calls: Array<{ command: string; args: string[]; options: any }> = []
  let removed = false
  let published = overrides.published
  const proc = {
    async spawnAndCapture(command: string, args: string[], options: any) {
      calls.push({ command, args, options })
      if (`${command} ${args[0]}` === overrides.fail) return { exitCode: 1, stderr: 'deliberate failure', stdout: '' }
      let value: any = ''
      if (command === 'git' && args[0] === 'rev-parse') value = 'abc123'
      if (command === 'gh') {
        if (args[0] === 'repo') value = { nameWithOwner: 'soederpop/luca' }
        if (args[0] === 'api') value = { sha: overrides.remoteSha ?? 'abc123' }
        if (args[0] === 'run') value = [{ headSha: 'abc123', status: 'completed', conclusion: overrides.workflow ?? 'success' }]
        if (args[0] === 'release' && args[1] === 'view') value = {
          tagName: `v${version}`, isPrerelease: version.includes('-'),
          assets: overrides.assets === false ? [] : ['linux-x64', 'linux-arm64', 'darwin-x64', 'darwin-arm64', 'windows-x64.exe'].map(name => ({ name: `luca-${name}`, size: 100 })),
        }
      }
      if (command === 'npm') {
        if (args[0] === 'pack') value = [{ name: 'luca', version, filename: 'luca.tgz', integrity: 'sha512-match', files: [{ path: 'dist/node.d.ts' }] }]
        if (args[0] === 'publish') published = overrides.corruptPublish ? 'sha512-wrong' : 'sha512-match'
        if (args[0] === 'view') {
          if (!published) return { exitCode: 1, stdout: JSON.stringify({ error: { code: 'E404' } }), stderr: '' }
          return { exitCode: 0, stdout: JSON.stringify(published), stderr: '' }
        }
      }
      return { exitCode: 0, stdout: typeof value === 'string' ? value : JSON.stringify(value), stderr: '' }
    },
  }
  const fs = {
    ensureFolder() {}, writeFile() {},
    readJson() { return { name: 'luca', version } },
    async remove() { removed = true },
  }
  return {
    calls, get removed() { return removed },
    container: {
      feature: (name: string) => name === 'proc' ? proc : fs,
      paths: { resolve: (...parts: string[]) => parts.join('/') },
      os: { tmpdir: () => '/tmp' }, utils: { uuid: () => 'test' },
    },
  }
}

describe('local release publishing', () => {
  it('publishes the verified tarball before promoting GitHub', async () => {
    const f = fixture()
    await publishRelease(f.container, 'v3.12.1')
    const publish = f.calls.findIndex(c => c.command === 'npm' && c.args[0] === 'publish')
    const promote = f.calls.findIndex(c => c.command === 'gh' && c.args[1] === 'edit')
    expect(publish).toBeGreaterThan(-1)
    expect(promote).toBeGreaterThan(publish)
    expect(f.calls[promote]!.args).toContain('--latest=true')
    expect(f.calls[publish]!.args).toContain('/tmp/luca-release-test/luca.tgz')
    expect(f.calls.some(c => c.command === 'bun' && c.args[1] === 'test')).toBe(true)
    expect(f.removed).toBe(true)
  })

  it('builds and validates in dry-run mode without external writes', async () => {
    const f = fixture()
    await publishRelease(f.container, 'v3.12.1', true)
    expect(f.calls.some(c => ['publish', 'dist-tag'].includes(c.args[0]!) || c.args[1] === 'edit')).toBe(false)
    expect(f.calls.some(c => c.args[0] === 'pack')).toBe(true)
    expect(f.removed).toBe(true)
  })

  it('keeps prereleases off latest', async () => {
    const f = fixture({ version: '3.13.0-beta.1' })
    await publishRelease(f.container, 'v3.13.0-beta.1')
    expect(f.calls.find(c => c.args[0] === 'publish')!.args).toContain('next')
    expect(f.calls.find(c => c.args[1] === 'edit')!.args).toContain('--latest=false')
  })

  it('resumes a matching npm publication without publishing it again', async () => {
    const f = fixture({ published: 'sha512-match' })
    await publishRelease(f.container, 'v3.12.1')
    expect(f.calls.some(c => c.args[0] === 'publish')).toBe(false)
    expect(f.calls.some(c => c.args[0] === 'dist-tag')).toBe(true)
    expect(f.calls.some(c => c.args[1] === 'edit')).toBe(true)
  })

  for (const overrides of [{ workflow: 'failure' }, { remoteSha: 'different' }, { assets: false },
    { published: 'sha512-different' }, { fail: 'bun run' }, { fail: 'npm publish' }, { fail: 'npm view' }, { corruptPublish: true }]) {
    it(`refuses promotion when ${JSON.stringify(overrides)}`, async () => {
      const f = fixture(overrides)
      await expect(publishRelease(f.container, 'v3.12.1')).rejects.toThrow()
      expect(f.calls.some(c => c.args[1] === 'edit')).toBe(false)
    })
  }

  it('rejects a package version that differs from the tag before building', async () => {
    const f = fixture()
    const fs = f.container.feature('fs') as any
    fs.readJson = () => ({ name: 'luca', version: '3.12.0' })
    await expect(publishRelease(f.container, 'v3.12.1')).rejects.toThrow('Tag must match')
    expect(f.calls.some(c => c.command === 'bun')).toBe(false)
    expect(f.removed).toBe(true)
  })

  it('cleans up after GitHub promotion fails so the publication can be retried', async () => {
    const f = fixture()
    const proc = f.container.feature('proc') as any
    const spawn = proc.spawnAndCapture
    proc.spawnAndCapture = async (command: string, args: string[], options: any) => {
      if (command === 'gh' && args[1] === 'edit') return { exitCode: 1, stderr: 'unavailable' }
      return spawn(command, args, options)
    }
    await expect(publishRelease(f.container, 'v3.12.1')).rejects.toThrow('unavailable')
    expect(f.calls.some(c => c.args[0] === 'publish')).toBe(true)
    expect(f.removed).toBe(true)
  })

  it('rejects a malformed tag before running commands', async () => {
    const f = fixture()
    await expect(publishRelease(f.container, '--help')).rejects.toThrow()
    expect(f.calls).toHaveLength(0)
  })
})
