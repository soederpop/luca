import { z } from 'zod'
import { FeatureEventsSchema, FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

export const ServiceRestartPolicySchema = z.enum(['always', 'on-failure', 'never'])
  .describe("When the OS restarts the process: 'always', 'on-failure' (a non-zero exit or a crash), or 'never'")
export type ServiceRestartPolicy = z.infer<typeof ServiceRestartPolicySchema>

export const ServiceSpecSchema = z.object({
  name: z.string().describe('Unique service name: letters, digits, dot, dash, underscore. Becomes part of the OS unit name'),
  command: z.string().describe('The program to run. A bare name is resolved to an absolute path at install time, because the OS supervisor has a minimal PATH'),
  args: z.array(z.string()).default([]).describe('Arguments passed to the command'),
  cwd: z.string().optional().describe('Working directory. Defaults to container.cwd at install time'),
  env: z.record(z.string(), z.string()).default({}).describe('Extra environment variables for the process'),
  inheritPath: z.boolean().default(true).describe("Copy the installer's PATH into the unit, so child processes find the same tools you do"),
  restart: ServiceRestartPolicySchema.default('on-failure'),
  startNow: z.boolean().default(true).describe('Start the service right after install, not only at the next login'),
  description: z.string().optional().describe('Human readable description stored in the unit'),
}).describe('What to run at login, and how the OS should supervise it')
export type ServiceSpec = z.input<typeof ServiceSpecSchema>
export type ResolvedServiceSpec = z.output<typeof ServiceSpecSchema> & { cwd: string }

export const ServiceStatusSchema = z.object({
  name: z.string().describe('The service name'),
  installed: z.boolean().describe('Whether the unit file exists'),
  loaded: z.boolean().describe('Whether the OS supervisor has the unit loaded (launchd: bootstrapped; systemd: enabled or active)'),
  running: z.boolean().describe('Whether the process is running right now'),
  pid: z.number().optional().describe('PID of the running process'),
  lastExitCode: z.number().optional().describe('Exit code of the last run, when the OS reports one'),
  unitPath: z.string().describe('Absolute path of the unit file'),
  stdoutLog: z.string().describe('Absolute path of the stdout log file'),
  stderrLog: z.string().describe('Absolute path of the stderr log file'),
  spec: z.any().optional().describe('The spec it was installed with, when the sidecar record exists'),
}).describe('The state of one installed service')
export type ServiceStatus = z.infer<typeof ServiceStatusSchema> & { spec?: ResolvedServiceSpec }

export const ServicesBackendSchema = z.enum(['launchd', 'systemd', 'unsupported'])
  .describe('Which OS supervisor this machine uses')
export type ServicesBackend = z.infer<typeof ServicesBackendSchema>

export const ServicesStateSchema = FeatureStateSchema.extend({
  backend: ServicesBackendSchema,
  services: z.array(z.string()).describe('Service names found by the last list() call'),
})
export type ServicesState = z.infer<typeof ServicesStateSchema>

export const ServicesOptionsSchema = FeatureOptionsSchema.extend({
  prefix: z.string().default('luca').describe('Namespace for unit names. launchd labels become com.<prefix>.<name>, systemd units <prefix>-<name>.service. Only units with this prefix are ever listed or touched'),
  unitDir: z.string().optional().describe('Override where unit files are written. Defaults to ~/Library/LaunchAgents (macOS) or ~/.config/systemd/user (Linux)'),
  homeDir: z.string().optional().describe('Override the luca home for logs and sidecar records. Defaults to ~/.luca/services'),
  platform: z.string().optional().describe('Override the detected platform (darwin, linux, win32). Mostly for tests'),
})
export type ServicesOptions = z.infer<typeof ServicesOptionsSchema>

export const ServicesEventsSchema = FeatureEventsSchema.extend({
  installed: z.tuple([z.string().describe('Service name')]).describe('Emitted after a unit is written and loaded'),
  uninstalled: z.tuple([z.string().describe('Service name')]).describe('Emitted after a unit is unloaded and removed'),
  started: z.tuple([z.string().describe('Service name')]).describe('Emitted after start()'),
  stopped: z.tuple([z.string().describe('Service name')]).describe('Emitted after stop()'),
  restarted: z.tuple([z.string().describe('Service name')]).describe('Emitted after restart()'),
}).describe('Services events')

export interface ServicesExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/

// ─── Pure renderers (exported for tests and for people who want the text) ────

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

/**
 * Render a launchd LaunchAgent plist for a resolved spec.
 *
 * @param spec - A spec with an absolute command and cwd
 * @param paths - The label and log file paths
 * @returns The plist XML
 */
export function renderLaunchdPlist(spec: ResolvedServiceSpec, paths: { label: string; stdoutLog: string; stderrLog: string }): string {
  const str = (v: string) => `<string>${xmlEscape(v)}</string>`
  const program = [spec.command, ...spec.args].map(arg => `    ${str(arg)}`).join('\n')
  const envEntries = Object.entries(spec.env)
  const env = envEntries.length
    ? `  <key>EnvironmentVariables</key>\n  <dict>\n${envEntries.map(([k, v]) => `    <key>${xmlEscape(k)}</key>\n    ${str(v)}`).join('\n')}\n  </dict>\n`
    : ''
  // KeepAlive=true restarts on any exit; SuccessfulExit=false restarts only on a non-zero exit or a crash.
  const keepAlive = spec.restart === 'always'
    ? '  <key>KeepAlive</key>\n  <true/>\n'
    : spec.restart === 'on-failure'
      ? '  <key>KeepAlive</key>\n  <dict>\n    <key>SuccessfulExit</key>\n    <false/>\n  </dict>\n'
      : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  ${str(paths.label)}
  <key>ProgramArguments</key>
  <array>
${program}
  </array>
  <key>WorkingDirectory</key>
  ${str(spec.cwd)}
${env}  <key>RunAtLoad</key>
  <true/>
${keepAlive}  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  ${str(paths.stdoutLog)}
  <key>StandardErrorPath</key>
  ${str(paths.stderrLog)}
</dict>
</plist>
`
}

/** Quote one word for a systemd ExecStart= or Environment= line. */
function systemdQuote(value: string): string {
  // systemd expands %specifiers and $VARS inside ExecStart, so both must be doubled to stay literal.
  const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/%/g, '%%').replace(/\$/g, '$$$$')
  return `"${escaped}"`
}

/**
 * Render a systemd user unit for a resolved spec.
 *
 * @param spec - A spec with an absolute command and cwd
 * @param paths - The log file paths
 * @returns The unit file text
 */
export function renderSystemdUnit(spec: ResolvedServiceSpec, paths: { stdoutLog: string; stderrLog: string }): string {
  const restart = spec.restart === 'always' ? 'always' : spec.restart === 'on-failure' ? 'on-failure' : 'no'
  const env = Object.entries(spec.env).map(([k, v]) => `Environment=${systemdQuote(`${k}=${v}`)}`).join('\n')
  return `[Unit]
Description=${(spec.description || `luca service ${spec.name}`).replace(/\n/g, ' ')}
StartLimitIntervalSec=0

[Service]
Type=simple
ExecStart=${[spec.command, ...spec.args].map(systemdQuote).join(' ')}
WorkingDirectory=${spec.cwd}
${env ? env + '\n' : ''}Restart=${restart}
RestartSec=10
StandardOutput=append:${paths.stdoutLog}
StandardError=append:${paths.stderrLog}

[Install]
WantedBy=default.target
`
}

// ─── Services ───────────────────────────────────────────────────────────────

/**
 * Register programs to start at login and stay running, using the OS's own supervisor.
 *
 * On macOS it writes a launchd LaunchAgent to `~/Library/LaunchAgents/com.luca.<name>.plist`.
 * On Linux it writes a systemd user unit to `~/.config/systemd/user/luca-<name>.service`.
 * The OS does the supervising, so a service keeps running if luca itself exits or crashes.
 * Windows is not supported yet; every method throws there.
 *
 * Logs go to `~/.luca/services/logs/<name>.out.log` and `.err.log` on both platforms, and the
 * spec you installed with is kept in `~/.luca/services/<name>.json` so `list()` can return it.
 * Only units with this feature's prefix are ever listed or changed.
 *
 * GOTCHAS:
 * - "At login" is not "at boot". User units start when the user logs in. On Linux,
 *   `enableLinger()` makes them start at boot without a login. macOS has no user-level equivalent;
 *   a boot-time LaunchDaemon needs root and is out of scope.
 * - The supervisor has a minimal PATH and does not read your shell profile. `install()` resolves
 *   a bare command to an absolute path and, by default, copies your PATH into the unit.
 * - Do not manage these units with `brew services`; it rewrites plists. Use this feature or launchctl.
 *
 * @example
 * ```ts
 * const services = container.feature('services')
 * await services.install({ name: 'api', command: 'luca', args: ['serve', '--port', '3000'] })
 * const status = await services.status('api')   // { running: true, pid: 4242, ... }
 * const { stderr } = await services.logs('api', { lines: 20 })
 * await services.uninstall('api')
 * ```
 */
export class Services extends Feature<ServicesState, ServicesOptions> {
  static override shortcut = 'features.services' as const
  static override stability = 'experimental' as const
  static override category = 'process' as const
  static override stateSchema = ServicesStateSchema
  static override optionsSchema = ServicesOptionsSchema
  static override eventsSchema = ServicesEventsSchema
  static { Feature.register(this, 'services') }

  override get initialState(): ServicesState {
    return {
      ...super.initialState,
      backend: Services.backendFor(this.options.platform || process.platform),
      services: [],
    }
  }

  /** Map a platform id to the supervisor it uses. */
  static backendFor(platform: string): ServicesBackend {
    if (platform === 'darwin') return 'launchd'
    if (platform === 'linux') return 'systemd'
    return 'unsupported'
  }

  /** Which OS supervisor this machine uses: 'launchd', 'systemd', or 'unsupported'. */
  get backend(): ServicesBackend {
    return this.state.get('backend') ?? 'unsupported'
  }

  /** Whether this platform is supported. False on Windows for now. */
  get isSupported(): boolean {
    return this.backend !== 'unsupported'
  }

  private get prefix(): string {
    return this.options.prefix || 'luca'
  }

  private get home(): string {
    return this.container.feature('os').homedir
  }

  /** Directory holding the unit files for this backend. */
  get unitDir(): string {
    if (this.options.unitDir) return this.container.paths.resolve(this.options.unitDir)
    return this.backend === 'launchd'
      ? this.container.paths.resolve(this.home, 'Library', 'LaunchAgents')
      : this.container.paths.resolve(this.home, '.config', 'systemd', 'user')
  }

  /** Directory holding logs and the sidecar spec records. */
  get servicesHome(): string {
    return this.options.homeDir
      ? this.container.paths.resolve(this.options.homeDir)
      : this.container.paths.resolve(this.home, '.luca', 'services')
  }

  /** The OS-level unit id: `com.luca.api` for launchd, `luca-api.service` for systemd. */
  unitId(name: string): string {
    return this.backend === 'launchd' ? `com.${this.prefix}.${name}` : `${this.prefix}-${name}.service`
  }

  /** Absolute path of the unit file for a service. */
  unitPath(name: string): string {
    const file = this.backend === 'launchd' ? `${this.unitId(name)}.plist` : this.unitId(name)
    return this.container.paths.resolve(this.unitDir, file)
  }

  /** Absolute paths of the stdout and stderr log files for a service. */
  logPaths(name: string): { stdoutLog: string; stderrLog: string } {
    const dir = this.container.paths.resolve(this.servicesHome, 'logs')
    return {
      stdoutLog: this.container.paths.resolve(dir, `${name}.out.log`),
      stderrLog: this.container.paths.resolve(dir, `${name}.err.log`),
    }
  }

  private recordPath(name: string): string {
    return this.container.paths.resolve(this.servicesHome, `${name}.json`)
  }

  /**
   * Run a supervisor command (launchctl, systemctl, loginctl). Never throws on a non-zero exit.
   * The single seam every OS call goes through, so tests can stub it.
   */
  async exec(command: string, args: string[]): Promise<ServicesExecResult> {
    const result = await this.container.feature('proc').spawnAndCapture(command, args)
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }
  }

  private async execOrThrow(command: string, args: string[]): Promise<string> {
    const result = await this.exec(command, args)
    if (result.exitCode !== 0) {
      throw new Error(`${command} ${args.join(' ')} failed (exit ${result.exitCode}): ${(result.stderr || result.stdout).trim()}`)
    }
    return result.stdout
  }

  private assertSupported(): void {
    if (!this.isSupported) {
      throw new Error(`services: platform "${this.options.platform || process.platform}" is not supported yet (macOS launchd and Linux systemd only)`)
    }
  }

  private assertName(name: string): void {
    if (!NAME_RE.test(name)) {
      throw new Error(`services: invalid name "${name}". Use letters, digits, dot, dash, underscore, starting with a letter or digit`)
    }
  }

  private get launchdDomain(): string {
    return `gui/${process.getuid?.() ?? 0}`
  }

  /**
   * Turn a bare command into an absolute path, the way your shell would find it.
   * Returns the input unchanged when it already contains a slash.
   */
  async resolveCommand(command: string): Promise<string> {
    if (command.includes('/')) return this.container.paths.resolve(command)
    const result = await this.exec('/bin/sh', ['-c', `command -v ${JSON.stringify(command)}`])
    const found = result.stdout.trim().split('\n')[0]
    if (result.exitCode !== 0 || !found || !found.startsWith('/')) {
      throw new Error(`services: could not find "${command}" on PATH. Pass an absolute path instead`)
    }
    return found
  }

  /**
   * Validate a spec and fill in the defaults: absolute command, absolute cwd, PATH.
   * Does not touch the OS beyond resolving the command.
   */
  async resolveSpec(spec: ServiceSpec): Promise<ResolvedServiceSpec> {
    const parsed = ServiceSpecSchema.parse(spec)
    this.assertName(parsed.name)
    const env = { ...parsed.env }
    if (parsed.inheritPath && !env.PATH && process.env.PATH) env.PATH = process.env.PATH
    return {
      ...parsed,
      env,
      command: await this.resolveCommand(parsed.command),
      cwd: this.container.paths.resolve(parsed.cwd || this.container.cwd),
    }
  }

  /** The unit file text this spec would produce on this backend. Useful for previews. */
  render(spec: ResolvedServiceSpec): string {
    this.assertSupported()
    const logs = this.logPaths(spec.name)
    return this.backend === 'launchd'
      ? renderLaunchdPlist(spec, { label: this.unitId(spec.name), ...logs })
      : renderSystemdUnit(spec, logs)
  }

  /**
   * Install a service so it starts at every login, and (by default) start it now.
   * Installing a name that already exists replaces it: the old unit is unloaded first.
   *
   * @param spec - What to run and how to supervise it
   * @returns The status after install
   *
   * @example
   * ```ts
   * await services.install({
   *   name: 'worker',
   *   command: 'bun',
   *   args: ['run', 'worker.ts'],
   *   cwd: '/Users/me/app',
   *   env: { NODE_ENV: 'production' },
   *   restart: 'always',
   * })
   * ```
   */
  async install(spec: ServiceSpec): Promise<ServiceStatus> {
    this.assertSupported()
    const resolved = await this.resolveSpec(spec)
    const { name } = resolved
    const fs = this.container.feature('fs')
    const unitPath = this.unitPath(name)
    const logs = this.logPaths(name)

    fs.ensureFolder(this.unitDir)
    fs.ensureFolder(this.container.paths.dirname(logs.stdoutLog))

    if (this.backend === 'launchd') {
      // bootstrap refuses a label that is already loaded, so unload the old one first.
      await this.exec('launchctl', ['bootout', `${this.launchdDomain}/${this.unitId(name)}`])
      fs.writeFile(unitPath, this.render(resolved))
      if (resolved.startNow) {
        await this.execOrThrow('launchctl', ['bootstrap', this.launchdDomain, unitPath])
      }
      // Without startNow the plist sits in LaunchAgents and launchd loads it at the next login.
    } else {
      fs.writeFile(unitPath, this.render(resolved))
      await this.execOrThrow('systemctl', ['--user', 'daemon-reload'])
      await this.execOrThrow('systemctl', ['--user', 'enable', this.unitId(name)])
      if (resolved.startNow) await this.execOrThrow('systemctl', ['--user', 'restart', this.unitId(name)])
    }

    fs.writeJson(this.recordPath(name), { ...resolved, installedAt: new Date().toISOString(), backend: this.backend })
    this.emit('installed', name)
    return this.status(name)
  }

  /**
   * Stop a service, remove its unit, and forget it. Log files are kept.
   * Does nothing for a name that is not installed.
   *
   * @param name - The service name
   * @param options.removeLogs - Also delete the log files
   */
  async uninstall(name: string, options: { removeLogs?: boolean } = {}): Promise<void> {
    this.assertSupported()
    this.assertName(name)
    const fs = this.container.feature('fs')
    if (this.backend === 'launchd') {
      await this.exec('launchctl', ['bootout', `${this.launchdDomain}/${this.unitId(name)}`])
    } else {
      await this.exec('systemctl', ['--user', 'disable', '--now', this.unitId(name)])
    }
    fs.rmSync(this.unitPath(name), { force: true })
    if (this.backend === 'systemd') await this.exec('systemctl', ['--user', 'daemon-reload'])
    fs.rmSync(this.recordPath(name), { force: true })
    if (options.removeLogs) {
      const logs = this.logPaths(name)
      fs.rmSync(logs.stdoutLog, { force: true })
      fs.rmSync(logs.stderrLog, { force: true })
    }
    this.emit('uninstalled', name)
  }

  private assertInstalled(name: string): void {
    this.assertSupported()
    this.assertName(name)
    if (!this.isInstalled(name)) throw new Error(`services: "${name}" is not installed`)
  }

  /** Whether a unit file exists for this name. */
  isInstalled(name: string): boolean {
    return this.container.feature('fs').exists(this.unitPath(name))
  }

  /**
   * Start an installed service. On launchd this loads the unit, which runs it.
   *
   * @param name - The service name
   */
  async start(name: string): Promise<ServiceStatus> {
    this.assertInstalled(name)
    if (this.backend === 'launchd') {
      const current = await this.status(name)
      if (!current.loaded) await this.execOrThrow('launchctl', ['bootstrap', this.launchdDomain, this.unitPath(name)])
      else if (!current.running) await this.execOrThrow('launchctl', ['kickstart', `${this.launchdDomain}/${this.unitId(name)}`])
    } else {
      await this.execOrThrow('systemctl', ['--user', 'start', this.unitId(name)])
    }
    this.emit('started', name)
    return this.status(name)
  }

  /**
   * Stop a running service until the next start() or login. The unit stays installed.
   * On launchd this unloads the unit, because killing a KeepAlive job just restarts it.
   *
   * @param name - The service name
   */
  async stop(name: string): Promise<ServiceStatus> {
    this.assertInstalled(name)
    if (this.backend === 'launchd') {
      await this.exec('launchctl', ['bootout', `${this.launchdDomain}/${this.unitId(name)}`])
    } else {
      await this.execOrThrow('systemctl', ['--user', 'stop', this.unitId(name)])
    }
    this.emit('stopped', name)
    return this.status(name)
  }

  /**
   * Restart a service: kill the process and start it again, loading it first if needed.
   *
   * @param name - The service name
   */
  async restart(name: string): Promise<ServiceStatus> {
    this.assertInstalled(name)
    if (this.backend === 'launchd') {
      const current = await this.status(name)
      if (!current.loaded) await this.execOrThrow('launchctl', ['bootstrap', this.launchdDomain, this.unitPath(name)])
      else await this.execOrThrow('launchctl', ['kickstart', '-k', `${this.launchdDomain}/${this.unitId(name)}`])
    } else {
      await this.execOrThrow('systemctl', ['--user', 'restart', this.unitId(name)])
    }
    this.emit('restarted', name)
    return this.status(name)
  }

  /** The spec a service was installed with, from its sidecar record. Undefined when missing. */
  getSpec(name: string): ResolvedServiceSpec | undefined {
    const fs = this.container.feature('fs')
    const path = this.recordPath(name)
    if (!fs.exists(path)) return undefined
    try { return fs.readJson(path) } catch { return undefined }
  }

  /**
   * Ask the OS for the live state of one service.
   *
   * @param name - The service name
   *
   * @example
   * ```ts
   * const { running, pid, lastExitCode } = await services.status('api')
   * ```
   */
  async status(name: string): Promise<ServiceStatus> {
    this.assertSupported()
    this.assertName(name)
    const base = {
      name,
      installed: this.isInstalled(name),
      unitPath: this.unitPath(name),
      ...this.logPaths(name),
      spec: this.getSpec(name),
    }
    return { ...base, ...(this.backend === 'launchd' ? await this.launchdStatus(name) : await this.systemdStatus(name)) }
  }

  private async launchdStatus(name: string): Promise<Pick<ServiceStatus, 'loaded' | 'running' | 'pid' | 'lastExitCode'>> {
    const result = await this.exec('launchctl', ['print', `${this.launchdDomain}/${this.unitId(name)}`])
    if (result.exitCode !== 0) return { loaded: false, running: false }
    return parseLaunchctlPrint(result.stdout)
  }

  private async systemdStatus(name: string): Promise<Pick<ServiceStatus, 'loaded' | 'running' | 'pid' | 'lastExitCode'>> {
    const result = await this.exec('systemctl', ['--user', 'show', this.unitId(name), '--property=ActiveState,MainPID,ExecMainStatus,UnitFileState,LoadState'])
    if (result.exitCode !== 0) return { loaded: false, running: false }
    return parseSystemctlShow(result.stdout)
  }

  /**
   * Every service this feature's prefix owns, with live status. Reads the unit directory,
   * so units installed by another luca process or binary show up too.
   *
   * @example
   * ```ts
   * for (const s of await services.list()) console.log(s.name, s.running ? 'up' : 'down')
   * ```
   */
  async list(): Promise<ServiceStatus[]> {
    this.assertSupported()
    const fs = this.container.feature('fs')
    if (!fs.exists(this.unitDir)) {
      this.setState({ services: [] })
      return []
    }
    const [head, tail] = this.backend === 'launchd'
      ? [`com.${this.prefix}.`, '.plist']
      : [`${this.prefix}-`, '.service']
    const names = fs.readdirSync(this.unitDir)
      .filter(file => file.startsWith(head) && file.endsWith(tail))
      .map(file => file.slice(head.length, file.length - tail.length))
      .filter(name => NAME_RE.test(name))
      .sort()
    this.setState({ services: names })
    return Promise.all(names.map(name => this.status(name)))
  }

  /**
   * The last lines of a service's stdout and stderr logs.
   *
   * @param name - The service name
   * @param options.lines - How many lines from the end of each file. Default 50
   */
  async logs(name: string, options: { lines?: number } = {}): Promise<{ stdout: string; stderr: string }> {
    this.assertName(name)
    const lines = options.lines ?? 50
    const fs = this.container.feature('fs')
    const { stdoutLog, stderrLog } = this.logPaths(name)
    const tail = (path: string) => {
      if (!fs.exists(path)) return ''
      const all = String(fs.readFile(path)).split('\n')
      if (all[all.length - 1] === '') all.pop()
      return all.slice(-lines).join('\n')
    }
    return { stdout: tail(stdoutLog), stderr: tail(stderrLog) }
  }

  /**
   * Linux only: let this user's services start at boot, without anyone logging in.
   * Runs `loginctl enable-linger`, which may need polkit or sudo on some distros.
   */
  async enableLinger(): Promise<void> {
    if (this.backend !== 'systemd') throw new Error('services: enableLinger() is Linux only. macOS user agents always start at login')
    const user = (await this.execOrThrow('id', ['-un'])).trim()
    await this.execOrThrow('loginctl', ['enable-linger', user])
  }
}

/** Parse the bits of `launchctl print gui/<uid>/<label>` output that status() needs. */
export function parseLaunchctlPrint(output: string): Pick<ServiceStatus, 'loaded' | 'running' | 'pid' | 'lastExitCode'> {
  const field = (key: string) => output.match(new RegExp(`^\\s*${key} = (.+)$`, 'm'))?.[1]?.trim()
  const state = field('state')
  const pid = Number(field('pid'))
  const lastExit = field('last exit code')
  const lastExitCode = lastExit !== undefined && /^-?\d+$/.test(lastExit) ? Number(lastExit) : undefined
  const hasPid = Number.isFinite(pid) && pid > 0
  return {
    loaded: true,
    // Just after bootstrap or kickstart, state is briefly a spawn state while the pid already exists.
    running: state === 'running' || hasPid,
    pid: hasPid ? pid : undefined,
    lastExitCode,
  }
}

/** Parse `systemctl --user show --property=...` output that status() needs. */
export function parseSystemctlShow(output: string): Pick<ServiceStatus, 'loaded' | 'running' | 'pid' | 'lastExitCode'> {
  const props: Record<string, string> = {}
  for (const line of output.split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0) props[line.slice(0, eq)] = line.slice(eq + 1).trim()
  }
  const pid = Number(props.MainPID)
  // systemd reports ExecMainStatus=0 for units it has never seen, which would read as a clean exit.
  const exit = props.LoadState === 'loaded' ? props.ExecMainStatus : undefined
  return {
    loaded: props.LoadState === 'loaded' && (props.UnitFileState === 'enabled' || props.ActiveState === 'active'),
    running: props.ActiveState === 'active',
    pid: pid > 0 ? pid : undefined,
    lastExitCode: exit !== undefined && /^\d+$/.test(exit) ? Number(exit) : undefined,
  }
}

export default Services
