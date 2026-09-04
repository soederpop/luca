import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'

export const SecureShellStateSchema = FeatureStateSchema.extend({
	/** Whether an SSH connection is currently active */
	connected: z.boolean().describe('Whether an SSH connection is currently active'),
	/** The host currently targeted by exec/upload/download — a config alias or literal destination */
	currentHost: z.string().optional().describe('The host currently targeted by exec/upload/download — a config alias or literal destination'),
})
export type SecureShellState = z.infer<typeof SecureShellStateSchema>

export const SecureShellOptionsSchema = FeatureOptionsSchema.extend({
	/** Remote host address */
	host: z.string().optional().describe('Remote host address, or a Host alias from the ssh config'),
	/** SSH port number (default: 22) */
	port: z.number().optional().describe('SSH port number (default: 22)'),
	/** Username for SSH authentication */
	username: z.string().optional().describe('Username for SSH authentication'),
	/** Path to SSH private key file */
	key: z.string().optional().describe('Path to SSH private key file'),
	/** Path to the ssh client config file (default: ~/.ssh/config) */
	configPath: z.string().optional().describe('Path to the ssh client config file to parse for host definitions (default: ~/.ssh/config)'),
})
export type SecureShellOptions = z.infer<typeof SecureShellOptionsSchema>

/** One `Host` entry parsed from the ssh client config */
export interface SshConfigHost {
	/** The Host alias — what you pass to `useHost()` or on the ssh command line */
	host: string
	/** The real address ssh connects to (HostName directive) */
	hostname?: string
	/** Username (User directive) */
	user?: string
	/** Port (Port directive) */
	port?: number
	/** Private key path (IdentityFile directive) */
	identityFile?: string
}

interface SecureShellConnection {
	host?: string
	port?: number
	username?: string
	key?: string
	/**
	 * True when the host is an alias picked from the ssh config via useHost().
	 * In that case we pass ONLY the alias to ssh/scp and let the real ssh
	 * config resolution supply user/port/key — our parser is a listing aid,
	 * not a reimplementation of ssh_config semantics (Match, wildcards, etc.)
	 */
	fromConfig: boolean
}

/**
 * SecureShell Feature -- SSH command execution and SCP file transfers.
 *
 * Uses the system `ssh` and `scp` binaries to run commands on remote hosts
 * and transfer files, through the container's `proc` feature.
 *
 * All connections run with `BatchMode=yes`, so a command that would require an
 * interactive prompt fails immediately instead of hanging. In practice this
 * means authentication must be non-interactive: a `key` option pointing at a
 * private key file, an IdentityFile in the ssh config, or an already-loaded
 * ssh-agent identity.
 *
 * The feature can be created with no host at all. The `hosts` getter parses
 * the ssh client config (`~/.ssh/config` by default, including `Include`d
 * files) and lists every concrete Host entry, and `useHost()` switches the
 * active target at any time — to a config alias, or to a literal
 * `user@host` destination. When the target is a config alias, only the alias
 * is passed to ssh/scp so the user's real config resolution (User, Port,
 * IdentityFile, ProxyJump, ...) applies in full.
 *
 * Connection state is tracked on the feature: `testConnection()` and `exec()`
 * update `state.connected`, and `state.currentHost` reflects the active target.
 *
 * @example
 * ```typescript
 * // (no-run) requires a reachable SSH host
 * // No host needed up front — discover targets from ~/.ssh/config
 * const ssh = container.feature('secureShell')
 * console.log(ssh.hosts) // [{ host: 'chief', hostname: '10.0.0.5', user: 'jon', ... }]
 *
 * ssh.useHost('chief')             // config alias — ssh config resolves the rest
 * const uptime = await ssh.exec('uptime')
 *
 * ssh.useHost('deploy@192.168.1.100') // or a literal destination
 * await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
 * await ssh.download('/var/log/app.log', './logs/app.log')
 * ```
 *
 * @extends Feature
 */
export class SecureShell extends Feature<SecureShellState, SecureShellOptions> {
  static override shortcut = 'features.secureShell' as const
  static override stability = 'stable' as const
  static override category = 'process' as const
  static override stateSchema = SecureShellStateSchema
  static override optionsSchema = SecureShellOptionsSchema
  static { Feature.register(this, 'secureShell') }

	// Tool names are ssh-prefixed so they stay unambiguous when an assistant
	// combines this bundle with other exec-shaped tools (docker, proc, etc.)
	static override tools: Record<string, { schema: z.ZodType; description?: string; handler?: Function }> = {
		sshListHosts: {
			description: 'List the hosts defined in the local ssh config (~/.ssh/config). The current target host is marked with *. Use sshUseHost to switch to one of them.',
			schema: z.object({}).describe('List the hosts defined in the local ssh config.'),
			handler: (_args: {}, ssh: SecureShell) => {
				const hosts = ssh.hosts
				if (hosts.length === 0) return 'No hosts found in the ssh config.'
				const current = ssh.state.get('currentHost')
				return hosts.map(h => {
					const details = [
						h.hostname && `hostname=${h.hostname}`,
						h.user && `user=${h.user}`,
						h.port && `port=${h.port}`,
					].filter(Boolean).join(' ')
					return `${h.host === current ? '* ' : '  '}${h.host}${details ? `  (${details})` : ''}`
				}).join('\n')
			},
		},
		sshUseHost: {
			description: 'Switch the target host for all subsequent ssh tools. Accepts a Host alias from the ssh config (see sshListHosts) or a literal destination like "deploy@10.0.0.5". Verify with sshTestConnection afterwards.',
			schema: z.object({
				host: z.string().describe('A Host alias from the ssh config, or a literal destination like "deploy@10.0.0.5"'),
			}).describe('Switch the target host for all subsequent ssh tools.'),
			handler: (args: { host: string }, ssh: SecureShell) => {
				ssh.useHost(args.host)
				return `Now targeting ${ssh.state.get('currentHost')}`
			},
		},
		sshExec: {
			description: 'Run a shell command on the current target host over SSH and return its stdout. The command string reaches the remote shell verbatim — $VARS and $(...) expand on the remote host. Fails (never hangs) if authentication would require an interactive prompt.',
			schema: z.object({
				command: z.string().describe('The command to run on the remote host, e.g. "uptime" or "tail -n 50 /var/log/app.log"'),
			}).describe('Run a shell command on the remote host over SSH and return its stdout.'),
			handler: (args: { command: string }, ssh: SecureShell) => ssh.exec(args.command),
		},
		sshTestConnection: {
			description: 'Check whether the current target host is reachable and authentication works. Returns "connected" or "not connected" — never throws. Use this before a batch of sshExec calls, and after sshUseHost.',
			schema: z.object({}).describe('Check whether the remote host is reachable and authentication works.'),
			handler: async (_args: {}, ssh: SecureShell) =>
				(await ssh.testConnection()) ? 'connected' : 'not connected',
		},
		sshUpload: {
			description: 'Upload a local file to the current target host via SCP. Remote paths are absolute, or relative to the remote user\'s home directory.',
			schema: z.object({
				source: z.string().describe('Local file path to upload'),
				target: z.string().describe('Destination path on the remote host'),
			}).describe('Upload a local file to the remote host via SCP.'),
			handler: (args: { source: string; target: string }, ssh: SecureShell) => ssh.upload(args.source, args.target),
		},
		sshDownload: {
			description: 'Download a file from the current target host to the local machine via SCP. Remote paths are absolute, or relative to the remote user\'s home directory.',
			schema: z.object({
				source: z.string().describe('File path on the remote host'),
				target: z.string().describe('Local destination path'),
			}).describe('Download a file from the remote host to the local machine via SCP.'),
			handler: (args: { source: string; target: string }, ssh: SecureShell) => ssh.download(args.source, args.target),
		},
	}

	/**
	 * When an assistant consumes these tools, tell it what the current target
	 * is (if any) and that it can list and switch hosts itself.
	 */
	override setupToolsConsumer(consumer: Helper) {
		if (typeof (consumer as any).addSystemPromptExtension === 'function') {
			const current = this.state.get('currentHost')
			const targetLine = current
				? `The current target host is: ${current}. Use sshListHosts to see every host defined in the local ssh config, and sshUseHost to switch the target at any time.`
				: 'No target host is selected yet. Call sshListHosts to see the hosts defined in the local ssh config, then sshUseHost to pick one (or pass a literal "user@host") before using any other ssh tool.'
			;(consumer as any).addSystemPromptExtension('secureShell', [
				'## SSH Tools',
				'',
				targetLine,
				'',
				'Commands run non-interactively (BatchMode). Anything that would prompt — sudo passwords, host key confirmations, interactive editors — fails immediately instead of hanging. Prefer flags like `-y`/`--no-pager` and avoid interactive programs.',
				'',
				'`sshExec` returns stdout only; a non-zero exit code surfaces as an error with stderr attached. Use `sshTestConnection` first when reachability is uncertain, and after every sshUseHost.',
			].join('\n'))
		}
	}

	override get initialState(): SecureShellState {
		return {
			...super.initialState,
			connected: false,
			currentHost: this.options?.host,
		}
	}

	private _resolvedSshPath: string | null = null
	private _resolvedScpPath: string | null = null
	private _connection: SecureShellConnection | null = null

	/**
	 * Get the proc feature for executing shell commands
	 */
	private get proc() {
		return this.container.feature('proc')
	}

	/** Resolved path to the ssh binary */
	get sshPath(): string {
		if (this._resolvedSshPath) return this._resolvedSshPath
		this._resolvedSshPath = this.container.feature('os').whichCommand('ssh')
		return this._resolvedSshPath
	}

	/** Resolved path to the scp binary */
	get scpPath(): string {
		if (this._resolvedScpPath) return this._resolvedScpPath
		this._resolvedScpPath = this.container.feature('os').whichCommand('scp')
		return this._resolvedScpPath
	}

	/** Path to the ssh client config file being parsed (default: ~/.ssh/config) */
	get configPath(): string {
		if (this.options.configPath) return this.options.configPath
		const home = this.container.feature('os').homedir
		return this.container.paths.resolve(home, '.ssh', 'config')
	}

	/**
	 * The hosts defined in the ssh client config. Re-parses the config on every
	 * access so edits to ~/.ssh/config are picked up immediately.
	 */
	get hosts(): SshConfigHost[] {
		return this.parseSshConfig()
	}

	/**
	 * Parse the ssh client config into a list of concrete Host entries.
	 *
	 * Follows `Include` directives (with simple `*` globs, resolved relative to
	 * the config file's directory). Wildcard/negated Host patterns (`*`, `?`,
	 * `!`) are skipped — they are pattern defaults, not connectable hosts, and
	 * ssh applies them itself when we connect by alias. This parser is a
	 * listing aid; it does not replicate full ssh_config semantics (no `Match`,
	 * no cross-block option merging).
	 *
	 * @param configPath - Config file to parse (default: the feature's `configPath`)
	 * @returns One entry per concrete Host alias, in file order
	 *
	 * @example
	 * ```typescript
	 * const ssh = container.feature('secureShell')
	 * for (const h of ssh.parseSshConfig()) {
	 *   console.log(h.host, h.hostname ?? '', h.user ?? '')
	 * }
	 * ```
	 */
	parseSshConfig(configPath?: string): SshConfigHost[] {
		const hosts: SshConfigHost[] = []
		this.parseConfigFile(configPath ?? this.configPath, hosts, 0)
		return hosts
	}

	private parseConfigFile(path: string, hosts: SshConfigHost[], depth: number): void {
		if (depth > 5) return // guard against Include cycles
		const fs = this.container.feature('fs')
		if (!fs.exists(path)) return

		const content = String(fs.readFile(path))
		// Aliases of the currently open Host block that we are collecting for
		let openEntries: SshConfigHost[] = []

		for (const rawLine of content.split('\n')) {
			const line = rawLine.trim()
			if (!line || line.startsWith('#')) continue

			// "Key value" or "Key=value"; keys are case-insensitive
			const match = line.match(/^(\S+?)(?:\s+|\s*=\s*)(.+)$/)
			if (!match || !match[1] || !match[2]) continue
			const keyword = match[1].toLowerCase()
			const value = match[2].trim().replace(/^"(.*)"$/, '$1')

			if (keyword === 'include') {
				for (const includePath of value.split(/\s+/)) {
					for (const resolved of this.resolveIncludePaths(includePath, path)) {
						this.parseConfigFile(resolved, hosts, depth + 1)
					}
				}
				continue
			}

			if (keyword === 'host') {
				openEntries = []
				for (const alias of value.split(/\s+/)) {
					// Wildcards and negations are pattern defaults, not real hosts
					if (/[*?]/.test(alias) || alias.startsWith('!')) continue
					const entry: SshConfigHost = { host: alias }
					openEntries.push(entry)
					hosts.push(entry)
				}
				continue
			}

			if (keyword === 'match') {
				// Match blocks are conditional — beyond this parser's scope
				openEntries = []
				continue
			}

			for (const entry of openEntries) {
				if (keyword === 'hostname') entry.hostname = value
				else if (keyword === 'user') entry.user = value
				else if (keyword === 'port') entry.port = Number(value)
				else if (keyword === 'identityfile' && !entry.identityFile) entry.identityFile = value
			}
		}
	}

	/** Expand an Include path: `~`, relative-to-config-dir, and simple `*` globs */
	private resolveIncludePaths(includePath: string, parentConfigPath: string): string[] {
		const paths = this.container.paths
		const home = this.container.feature('os').homedir
		let expanded = includePath.startsWith('~')
			? paths.resolve(home, includePath.slice(1).replace(/^\//, ''))
			: includePath
		if (!expanded.startsWith('/')) {
			// Relative includes resolve against the including file's directory
			const parentDir = parentConfigPath.split('/').slice(0, -1).join('/')
			expanded = paths.resolve(parentDir, expanded)
		}
		if (!expanded.includes('*')) return [expanded]

		const dir = expanded.split('/').slice(0, -1).join('/')
		const pattern = expanded.split('/').pop() as string
		const fs = this.container.feature('fs')
		if (!fs.exists(dir)) return []
		const regex = new RegExp(`^${pattern.split('*').map(s => s.replace(/[.+^${}()|[\]\\?]/g, '\\$&')).join('.*')}$`)
		return fs.readdirSync(dir)
			.filter((name: string) => regex.test(name))
			.map((name: string) => this.container.paths.resolve(dir, name))
	}

	/**
	 * Switch the target host for all subsequent exec/upload/download calls.
	 *
	 * If the name matches a Host alias in the ssh config, only the alias is
	 * passed to ssh/scp from then on — the user's real ssh config resolution
	 * supplies User, Port, IdentityFile, ProxyJump, etc. Otherwise the name is
	 * treated as a literal destination (`host` or `user@host`), keeping the
	 * feature's `port` and `key` options as defaults.
	 *
	 * Updates `state.currentHost`. Does not test reachability — call
	 * `testConnection()` after switching.
	 *
	 * @param name - A Host alias from the ssh config, or a literal `host` / `user@host`
	 * @returns The config entry when the name matched one, else the literal parts used
	 *
	 * @example
	 * ```typescript
	 * // (no-run) requires a reachable SSH host
	 * const ssh = container.feature('secureShell')
	 * ssh.useHost('chief')                 // alias from ~/.ssh/config
	 * ssh.useHost('deploy@192.168.1.100')  // literal destination
	 * if (await ssh.testConnection()) console.log(await ssh.exec('hostname'))
	 * ```
	 */
	useHost(name: string): SshConfigHost | { host: string; username?: string } {
		const entry = this.hosts.find(h => h.host === name)
		if (entry) {
			this._connection = { host: entry.host, fromConfig: true }
			this.setState({ currentHost: entry.host, connected: false })
			return entry
		}

		let username: string | undefined
		let host = name
		const at = name.lastIndexOf('@')
		if (at > 0) {
			username = name.slice(0, at)
			host = name.slice(at + 1)
		}
		this._connection = {
			host,
			username: username ?? this.options.username,
			port: this.options.port,
			key: this.options.key,
			fromConfig: false,
		}
		this.setState({ currentHost: name, connected: false })
		return { host, username }
	}

	/** The active connection target — options until useHost() overrides them */
	private get connection(): SecureShellConnection {
		if (!this._connection) {
			const { host, port, username, key } = this.options
			this._connection = { host, port, username, key, fromConfig: false }
		}
		return this._connection
	}

	/** The destination argument for ssh, and the prefix for scp remote paths */
	private get remoteDestination(): string {
		const conn = this.connection
		if (!conn.host) {
			throw new Error('secureShell: no host selected — pass a "host" option or call useHost() (see the hosts getter for what is defined in the ssh config)')
		}
		if (conn.fromConfig || !conn.username) return conn.host
		return `${conn.username}@${conn.host}`
	}

	/**
	 * Build the ssh argv (flags + destination) with authentication options.
	 * Argv arrays go straight to the binary — no local shell, no quoting layer.
	 */
	private buildSshArgs(): string[] {
		const conn = this.connection
		const destination = this.remoteDestination
		const args: string[] = []

		// Config aliases get no explicit flags — ssh resolves them from the config
		if (!conn.fromConfig) {
			args.push('-p', String(conn.port ?? 22))
			if (conn.key) args.push('-i', conn.key)
		}

		// Batch mode fails immediately instead of hanging on interactive prompts
		args.push('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no')
		args.push(destination)

		return args
	}

	/**
	 * Build the scp flag argv for file transfers (no source/target — callers append those).
	 * Argv arrays go straight to the binary — no local shell, no quoting layer.
	 */
	private buildScpArgs(): string[] {
		const conn = this.connection
		this.remoteDestination // validates a host is selected
		const args: string[] = []

		if (!conn.fromConfig) {
			args.push('-P', String(conn.port ?? 22))
			if (conn.key) args.push('-i', conn.key)
		}

		// Batch mode fails immediately instead of hanging on interactive prompts
		args.push('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no')

		return args
	}

	/**
	 * Test the SSH connection by running a simple echo command on the remote host.
	 *
	 * Updates `state.connected` based on the result.
	 *
	 * @returns `true` if the connection succeeds, `false` otherwise (never throws)
	 *
	 * @example
	 * ```typescript
	 * // (no-run) requires a reachable SSH host
	 * const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
	 * const ok = await ssh.testConnection()
	 * if (!ok) console.error('SSH connection failed')
	 * console.log('state connected:', ssh.state.get('connected'))
	 * ```
	 */
	async testConnection(): Promise<boolean> {
		const result = await this.exec(`echo 'connected'`).catch(e => '')

		if (String(result).trim() === 'connected') {
			this.setState({ connected: true })
			return true
		} else {
			this.setState({ connected: false })
			return false
		}
	}

	/**
	 * Executes a command on the remote host.
	 *
	 * The command string is passed to ssh as a single argv element — it never
	 * touches the LOCAL shell, so `$VARS`, backticks, and `$(...)` are expanded
	 * on the remote host (by the remote shell), exactly as written.
	 *
	 * @param command - The command to execute on the remote shell — the string reaches the remote shell verbatim
	 * @returns The trimmed stdout output of the command
	 * @throws {Error} When the SSH command exits with a non-zero code, or no host is selected
	 *
	 * @example
	 * ```typescript
	 * // (no-run) requires a reachable SSH host
	 * const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
	 * const uptime = await ssh.exec('uptime')
	 * console.log('Remote uptime:', uptime)
	 *
	 * // $HOME expands on the REMOTE host, not locally
	 * const remoteHome = await ssh.exec('echo "$HOME"')
	 * ```
	 */
	async exec(command: string): Promise<string> {
		const argv = [...this.buildSshArgs(), command]

		try {
			// argv array — the command string reaches the remote shell verbatim,
			// with no local shell interpolation or quoting layer in between
			const result = await this.proc.spawnAndCapture(this.sshPath, argv)

			if (result.exitCode !== 0) {
				throw new Error(`SSH command failed with exit code ${result.exitCode}: ${result.stderr}`)
			}

			this.setState({ connected: true })
			return result.stdout.trim()
		} catch (error) {
			this.setState({ connected: false })
			throw new Error(`Failed to execute SSH command: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Downloads a file from the remote host via SCP.
	 *
	 * Uses the same authentication credentials configured on the feature instance.
	 * Remote paths are absolute, or relative to the remote user's home directory.
	 * Paths are passed as argv elements (no local shell), so local paths with
	 * spaces work as-is.
	 *
	 * @param source - The source file path on the remote host
	 * @param target - The target file path on the local machine
	 * @returns A confirmation message or the scp stdout output
	 * @throws {Error} When the SCP transfer fails
	 *
	 * @example
	 * ```typescript
	 * // (no-run) requires a reachable SSH host
	 * const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
	 * await ssh.download('/var/log/app.log', './logs/app.log')
	 * ```
	 */
	async download(source: string, target: string): Promise<string> {
		const argv = [...this.buildScpArgs(), `${this.remoteDestination}:${source}`, target]

		try {
			const result = await this.proc.spawnAndCapture(this.scpPath, argv)

			if (result.exitCode !== 0) {
				throw new Error(`SCP download failed with exit code ${result.exitCode}: ${result.stderr}`)
			}

			return result.stdout.trim() || `Successfully downloaded ${source} to ${target}`
		} catch (error) {
			throw new Error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Uploads a file to the remote host via SCP.
	 *
	 * Uses the same authentication credentials configured on the feature instance.
	 * Remote paths are absolute, or relative to the remote user's home directory.
	 * Paths are passed as argv elements (no local shell), so local paths with
	 * spaces work as-is.
	 *
	 * @param source - The source file path on the local machine
	 * @param target - The target file path on the remote host
	 * @returns A confirmation message or the scp stdout output
	 * @throws {Error} When the SCP transfer fails
	 *
	 * @example
	 * ```typescript
	 * // (no-run) requires a reachable SSH host
	 * const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
	 * await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
	 * ```
	 */
	async upload(source: string, target: string): Promise<string> {
		const argv = [...this.buildScpArgs(), source, `${this.remoteDestination}:${target}`]

		try {
			const result = await this.proc.spawnAndCapture(this.scpPath, argv)

			if (result.exitCode !== 0) {
				throw new Error(`SCP upload failed with exit code ${result.exitCode}: ${result.stderr}`)
			}

			return result.stdout.trim() || `Successfully uploaded ${source} to ${target}`
		} catch (error) {
			throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`)
		}
	}
}

export default SecureShell
