import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { publishRelease } from '../scripts/lib/local-release'
import releaseCommand, { argsSchema } from '../commands/release'

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
      os: { tmpdir: '/tmp' }, utils: { uuid: () => 'test' },
    } as unknown as NodeContainer,
  }
}

describe('local release publishing', () => {
  it('builds the temporary directory path using the real container OS getter', async () => {
    const real = new NodeContainer()
    const f = fixture()
    const fs = f.container.feature('fs') as any
    let created = ''
    fs.ensureFolder = (path: string) => { created = path }
    await publishRelease({ ...f.container, os: real.os, paths: real.paths } as unknown as NodeContainer, 'v3.12.1', true)
    expect(created).toBe(real.paths.resolve(real.os.tmpdir, 'luca-release-test', 'source'))
    expect(f.removed).toBe(true)
  })

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
      await expect(publishRelease(f.container, 'v3.12.1', false, { waitTimeout: 0 })).rejects.toThrow()
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

  it('waits through a missing tag, workflow startup, and binary uploads before publishing', async () => {
    const f = fixture()
    const proc = f.container.feature('proc') as any
    const spawn = proc.spawnAndCapture
    let fetched = false
    let remoteChecks = 0
    let workflowChecks = 0
    let releaseChecks = 0
    proc.spawnAndCapture = async (command: string, args: string[], options: any) => {
      if (command === 'git' && args[0] === 'show-ref' && !fetched) return { exitCode: 1, error: new Error('exit 1') }
      if (command === 'git' && args[0] === 'fetch') { fetched = true; return { exitCode: 0, stdout: '' } }
      if (command === 'gh' && args[0] === 'api' && remoteChecks++ === 0) return { exitCode: 1, stderr: 'HTTP 404: Not Found' }
      if (command === 'gh' && args[0] === 'run') {
        workflowChecks++
        if (workflowChecks === 1) return { exitCode: 0, stdout: '[]' }
        if (workflowChecks === 2) return { exitCode: 0, stdout: JSON.stringify([{ headSha: 'abc123', status: 'in_progress' }]) }
      }
      if (command === 'gh' && args[1] === 'view' && args[0] === 'release') {
        releaseChecks++
        if (releaseChecks === 1) return { exitCode: 1, stderr: 'release not found' }
        if (releaseChecks === 2) return { exitCode: 0, stdout: JSON.stringify({ tagName: 'v3.12.1', assets: [] }) }
      }
      return spawn(command, args, options)
    }
    await publishRelease(f.container, 'v3.12.1', false, { pollInterval: 0.001, waitTimeout: 2 })
    expect(fetched).toBe(true)
    expect(workflowChecks).toBe(5)
    expect(releaseChecks).toBe(3)
    expect(f.calls.filter(c => c.args[0] === 'publish')).toHaveLength(1)
  })

  it('retries temporary GitHub outages', async () => {
    const f = fixture()
    const proc = f.container.feature('proc') as any
    const spawn = proc.spawnAndCapture
    let attempts = 0
    proc.spawnAndCapture = async (command: string, args: string[], options: any) => {
      if (command === 'gh' && args[0] === 'repo' && attempts++ === 0) return { exitCode: 1, stderr: 'HTTP 503: Service Unavailable' }
      return spawn(command, args, options)
    }
    await publishRelease(f.container, 'v3.12.1', true, { pollInterval: 0.001, waitTimeout: 2 })
    expect(attempts).toBe(2)
    expect(f.calls.some(c => c.args[0] === 'publish')).toBe(false)
  })

  it('times out without starting a build or publishing when assets never arrive', async () => {
    const f = fixture({ assets: false })
    await expect(publishRelease(f.container, 'v3.12.1', false, { waitTimeout: 0.005, pollInterval: 0.001 })).rejects.toThrow('Timed out waiting')
    expect(f.calls.some(c => c.command === 'bun' || c.args[0] === 'publish')).toBe(false)
  })

  it('does not retry authentication failures', async () => {
    const f = fixture()
    const proc = f.container.feature('proc') as any
    let attempts = 0
    proc.spawnAndCapture = async () => { attempts++; return { exitCode: 1, stderr: 'HTTP 401: Bad credentials' } }
    await expect(publishRelease(f.container, 'v3.12.1')).rejects.toThrow('Bad credentials')
    expect(attempts).toBe(1)
  })

  it('continues from creating a tag through publishing without another command', async () => {
    const f = fixture()
    const fs = f.container.feature('fs') as any
    fs.readFileAsync = async () => JSON.stringify({ version: '3.12.1' })
    fs.banner = () => {}
    await releaseCommand.handler(argsSchema.parse({ skipTests: true }), { container: f.container } as any)
    const push = f.calls.findIndex(c => c.command === 'git' && c.args[0] === 'push')
    const publish = f.calls.findIndex(c => c.command === 'npm' && c.args[0] === 'publish')
    expect(push).toBeGreaterThan(-1)
    expect(publish).toBeGreaterThan(push)
  })

  it('resumes an existing version tag without trying to recreate it', async () => {
    const f = fixture()
    const fs = f.container.feature('fs') as any
    fs.readFileAsync = async () => JSON.stringify({ version: '3.12.1' })
    fs.banner = () => {}
    const proc = f.container.feature('proc') as any
    const spawn = proc.spawnAndCapture
    proc.spawnAndCapture = async (command: string, args: string[], options: any) => {
      if (command === 'git' && args[0] === 'tag' && args[1] === '-l') return { exitCode: 0, stdout: 'v3.12.1' }
      return spawn(command, args, options)
    }
    await releaseCommand.handler(argsSchema.parse({}), { container: f.container } as any)
    expect(f.calls.some(c => c.command === 'git' && c.args[0] === 'tag')).toBe(false)
    expect(f.calls.some(c => c.command === 'npm' && c.args[0] === 'publish')).toBe(true)
  })
})
