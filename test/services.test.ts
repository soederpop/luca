import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { NodeContainer } from '../src/node/container'
import { parseLaunchctlPrint, parseSystemctlShow, renderSystemdUnit, type Services } from '../src/node/features/services'

const ok = (stdout = '') => ({ stdout, stderr: '', exitCode: 0 })
const fail = (stderr = 'nope', exitCode = 1) => ({ stdout: '', stderr, exitCode })

let dir: string
let services: Services
let exec: Mock<Services['exec']>

function make(platform: string) {
  services = new NodeContainer().feature('services', { platform, unitDir: join(dir, 'units'), homeDir: join(dir, 'home') })
  exec = spyOn(services, 'exec').mockImplementation(async (cmd, args) => {
    // `command -v` lookups resolve to a fake absolute path; everything else succeeds silently.
    if (cmd === '/bin/sh') return ok(`/usr/local/bin/${args[1]!.match(/"(.+)"/)![1]}\n`)
    return ok()
  })
}
const calls = () => exec.mock.calls.filter(c => c[0] !== '/bin/sh').map(c => [c[0], ...c[1]].join(' '))

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'luca-services-')) })
afterEach(() => { exec?.mockRestore(); rmSync(dir, { recursive: true, force: true }) })

describe('Services', () => {
  it('picks the backend from the platform', () => {
    make('darwin'); expect(services.backend).toBe('launchd')
    make('linux'); expect(services.backend).toBe('systemd')
    make('win32'); expect(services.isSupported).toBe(false)
  })

  it('throws a clear error on unsupported platforms', async () => {
    make('win32')
    await expect(services.install({ name: 'x', command: 'echo' })).rejects.toThrow('not supported yet')
  })

  it('rejects names that would break unit file names', async () => {
    make('darwin')
    await expect(services.install({ name: '../evil', command: 'echo' })).rejects.toThrow('invalid name')
  })

  it('resolves bare commands, cwd, and PATH before writing anything', async () => {
    make('darwin')
    const spec = await services.resolveSpec({ name: 'api', command: 'luca', args: ['serve'], cwd: dir })
    expect(spec.command).toBe('/usr/local/bin/luca')
    expect(spec.cwd).toBe(dir)
    expect(spec.env.PATH).toBe(process.env.PATH!)
    expect(spec.restart).toBe('on-failure')
  })

  it('installs a launchd agent: unloads any old copy, writes the plist, bootstraps it', async () => {
    make('darwin')
    await services.install({ name: 'api', command: '/bin/echo', args: ['a & b'], env: { FOO: '<x>' }, restart: 'always', inheritPath: false })
    const plist = readFileSync(services.unitPath('api'), 'utf8')
    expect(services.unitPath('api')).toEndWith('units/com.luca.api.plist')
    expect(plist).toContain('<string>com.luca.api</string>')
    expect(plist).toContain('<string>a &amp; b</string>')
    expect(plist).toContain('<key>FOO</key>')
    expect(plist).toContain('<string>&lt;x&gt;</string>')
    expect(plist).toContain('<key>KeepAlive</key>\n  <true/>')
    expect(plist).toContain(services.logPaths('api').stderrLog)
    const uid = process.getuid!()
    expect(calls()).toEqual([
      `launchctl bootout gui/${uid}/com.luca.api`,
      `launchctl bootstrap gui/${uid} ${services.unitPath('api')}`,
      `launchctl print gui/${uid}/com.luca.api`,
    ])
    expect(services.getSpec('api')?.args).toEqual(['a & b'])
  })

  it('maps on-failure to KeepAlive SuccessfulExit=false and never to no KeepAlive', async () => {
    make('darwin')
    const base = await services.resolveSpec({ name: 'w', command: '/bin/echo' })
    expect(services.render(base)).toContain('<key>SuccessfulExit</key>\n    <false/>')
    expect(services.render({ ...base, restart: 'never' })).not.toContain('KeepAlive')
  })

  it('installs a systemd unit: writes, reloads, enables, starts', async () => {
    make('linux')
    await services.install({ name: 'api', command: '/bin/echo', args: ['50%', '$HOME'] })
    expect(services.unitPath('api')).toEndWith('units/luca-api.service')
    const unit = readFileSync(services.unitPath('api'), 'utf8')
    expect(unit).toContain('ExecStart="/bin/echo" "50%%" "$$HOME"')
    expect(unit).toContain('Restart=on-failure')
    expect(unit).toContain('WantedBy=default.target')
    expect(calls().slice(0, 3)).toEqual([
      'systemctl --user daemon-reload',
      'systemctl --user enable luca-api.service',
      'systemctl --user restart luca-api.service',
    ])
  })

  it('surfaces supervisor failures from install', async () => {
    make('linux')
    exec.mockImplementation(async (cmd) => cmd === 'systemctl' ? fail('Failed to connect to bus') : ok('/bin/echo'))
    await expect(services.install({ name: 'api', command: '/bin/echo' })).rejects.toThrow('Failed to connect to bus')
  })

  it('stops a launchd job by unloading it, because killing a KeepAlive job restarts it', async () => {
    make('darwin')
    await services.install({ name: 'api', command: '/bin/echo' })
    exec.mockClear()
    await services.stop('api')
    expect(calls()[0]).toBe(`launchctl bootout gui/${process.getuid!()}/com.luca.api`)
  })

  it('refuses to start or stop a service that is not installed', async () => {
    make('linux')
    await expect(services.start('ghost')).rejects.toThrow('not installed')
  })

  it('uninstalls: unloads, removes unit and record, keeps logs unless asked', async () => {
    make('linux')
    await services.install({ name: 'api', command: '/bin/echo' })
    const { stdoutLog } = services.logPaths('api')
    writeFileSync(stdoutLog, 'hello\n')
    await services.uninstall('api')
    expect(existsSync(services.unitPath('api'))).toBe(false)
    expect(services.getSpec('api')).toBeUndefined()
    expect(existsSync(stdoutLog)).toBe(true)
    expect(calls()).toContain('systemctl --user disable --now luca-api.service')
  })

  it('lists only units with its own prefix', async () => {
    make('darwin')
    mkdirSync(join(dir, 'units'), { recursive: true })
    for (const f of ['com.luca.b.plist', 'com.luca.a.plist', 'com.apple.thing.plist', 'homebrew.mxcl.redis.plist']) {
      writeFileSync(join(dir, 'units', f), '')
    }
    exec.mockResolvedValue(fail('Could not find service', 113))
    const list = await services.list()
    expect(list.map(s => s.name)).toEqual(['a', 'b'])
    expect(list[0]).toMatchObject({ installed: true, loaded: false, running: false })
  })

  it('tails the log files', async () => {
    make('darwin')
    const { stdoutLog } = services.logPaths('api')
    mkdirSync(join(dir, 'home', 'logs'), { recursive: true })
    writeFileSync(stdoutLog, '1\n2\n3\n')
    expect((await services.logs('api', { lines: 2 })).stdout).toBe('2\n3')
  })
})

describe('status parsers', () => {
  it('parses launchctl print', () => {
    const out = 'com.luca.api = {\n\tactive count = 1\n\tstate = running\n\tpid = 4242\n\tlast exit code = 0\n}'
    expect(parseLaunchctlPrint(out)).toEqual({ loaded: true, running: true, pid: 4242, lastExitCode: 0 })
    expect(parseLaunchctlPrint('\tstate = not running\n\tlast exit code = (never exited)')).toEqual({ loaded: true, running: false, pid: undefined, lastExitCode: undefined })
  })

  it('parses systemctl show', () => {
    const out = 'ActiveState=active\nMainPID=99\nExecMainStatus=0\nUnitFileState=enabled\nLoadState=loaded\n'
    expect(parseSystemctlShow(out)).toEqual({ loaded: true, running: true, pid: 99, lastExitCode: 0 })
    expect(parseSystemctlShow('ActiveState=inactive\nMainPID=0\nExecMainStatus=0\nLoadState=not-found\nUnitFileState=\n')).toEqual({ loaded: false, running: false, pid: undefined, lastExitCode: undefined })
  })

  it('renders a description into the systemd unit', () => {
    const unit = renderSystemdUnit({ name: 'x', command: '/bin/x', args: [], cwd: '/', env: {}, inheritPath: false, restart: 'never', startNow: true, description: 'My X' }, { stdoutLog: '/o', stderrLog: '/e' })
    expect(unit).toContain('Description=My X')
    expect(unit).toContain('Restart=no')
  })
})
