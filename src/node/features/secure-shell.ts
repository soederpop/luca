import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'

export const SecureShellStateSchema = FeatureStateSchema.extend({
	/** Whether an SSH connection is currently active */
	connected: z.boolean().describe('Whether an SSH connection is currently active'),
})
export type SecureShellState = z.infer<typeof SecureShellStateSchema>

export const SecureShellOptionsSchema = FeatureOptionsSchema.extend({
	/** Remote host address */
	host: z.string().optional().describe('Remote host address'),
	/** SSH port number (default: 22) */
	port: z.number().optional().describe('SSH port number (default: 22)'),
	/** Username for SSH authentication */
	username: z.string().optional().describe('Username for SSH authentication'),
	/** Password for SSH authentication */
	password: z.string().optional().describe('Password for SSH authentication'),
	/** Path to SSH private key file */
	key: z.string().optional().describe('Path to SSH private key file'),
})
export type SecureShellOptions = z.infer<typeof SecureShellOptionsSchema>

/**
 * SecureShell Feature -- SSH command execution and SCP file transfers.
 *
 * Uses the system `ssh` and `scp` binaries to run commands on remote hosts
 * and transfer files, through the container's `proc` feature.
 *
 * All connections run with `BatchMode=yes`, so a command that would require an
 * interactive prompt fails immediately instead of hanging. In practice this
 * means authentication must be non-interactive: a `key` option pointing at a
 * private key file, or an already-loaded ssh-agent identity. (A `password`
 * option exists in the schema but is not wired into the ssh/scp command line —
 * BatchMode suppresses password prompts.)
 *
 * Connection state is tracked on the feature: `testConnection()` and `exec()`
 * update `state.connected` based on whether the remote host responded.
 *
 * @example
 * ```typescript
 * // (no-run) requires a reachable SSH host
 * const ssh = container.feature('secureShell', {
 *   host: '192.168.1.100',
 *   port: 22,                  // default: 22
 *   username: 'deploy',
 *   key: '~/.ssh/id_ed25519',
 * })
 *
 * // Verify reachability before doing real work — never throws
 * if (await ssh.testConnection()) {
 *   console.log('connected:', ssh.state.get('connected')) // true
 *
 *   // exec() returns the command's trimmed stdout
 *   const uptime = await ssh.exec('uptime')
 *   console.log(uptime)
 *
 *   // SCP round-trip. Remote paths are absolute, or relative to
 *   // the remote user's home directory.
 *   await ssh.upload('./build/app.tar.gz', '/opt/releases/app.tar.gz')
 *   await ssh.download('/var/log/app.log', './logs/app.log')
 * }
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
		sshExec: {
			description: 'Run a shell command on the remote host over SSH and return its stdout. The command string reaches the remote shell verbatim — $VARS and $(...) expand on the remote host. Fails (never hangs) if authentication would require an interactive prompt.',
			schema: z.object({
				command: z.string().describe('The command to run on the remote host, e.g. "uptime" or "tail -n 50 /var/log/app.log"'),
			}).describe('Run a shell command on the remote host over SSH and return its stdout.'),
			handler: (args: { command: string }, ssh: SecureShell) => ssh.exec(args.command),
		},
		sshTestConnection: {
			description: 'Check whether the remote host is reachable and authentication works. Returns "connected" or "not connected" — never throws. Use this before a batch of sshExec calls.',
			schema: z.object({}).describe('Check whether the remote host is reachable and authentication works.'),
			handler: async (_args: {}, ssh: SecureShell) =>
				(await ssh.testConnection()) ? 'connected' : 'not connected',
		},
		sshUpload: {
			description: 'Upload a local file to the remote host via SCP. Remote paths are absolute, or relative to the remote user\'s home directory.',
			schema: z.object({
				source: z.string().describe('Local file path to upload'),
				target: z.string().describe('Destination path on the remote host'),
			}).describe('Upload a local file to the remote host via SCP.'),
			handler: (args: { source: string; target: string }, ssh: SecureShell) => ssh.upload(args.source, args.target),
		},
		sshDownload: {
			description: 'Download a file from the remote host to the local machine via SCP. Remote paths are absolute, or relative to the remote user\'s home directory.',
			schema: z.object({
				source: z.string().describe('File path on the remote host'),
				target: z.string().describe('Local destination path'),
			}).describe('Download a file from the remote host to the local machine via SCP.'),
			handler: (args: { source: string; target: string }, ssh: SecureShell) => ssh.download(args.source, args.target),
		},
	}

	/**
	 * When an assistant consumes these tools, tell it which host it is talking
	 * to — the connection is fixed by the feature's options, not tool arguments.
	 */
	override setupToolsConsumer(consumer: Helper) {
		if (typeof (consumer as any).addSystemPromptExtension === 'function') {
			const { host, port = 22, username } = this.options
			;(consumer as any).addSystemPromptExtension('secureShell', [
				'## SSH Tools',
				'',
				`All ssh tools operate on a single pre-configured remote host: ${username ?? '?'}@${host ?? '?'} (port ${port}). You cannot change the target host — it is fixed by configuration.`,
				'',
				'Commands run non-interactively (BatchMode). Anything that would prompt — sudo passwords, host key confirmations, interactive editors — fails immediately instead of hanging. Prefer flags like `-y`/`--no-pager` and avoid interactive programs.',
				'',
				'`sshExec` returns stdout only; a non-zero exit code surfaces as an error with stderr attached. Use `sshTestConnection` first when reachability is uncertain.',
			].join('\n'))
		}
	}

	override get initialState(): SecureShellState {
		return {
			...super.initialState,
			connected: false
		}
	}

	private _resolvedSshPath: string | null = null
	private _resolvedScpPath: string | null = null

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

	/**
	 * Validate that required options are provided
	 */
	private validateOptions(): void {
		const { host, username, key } = this.options
		
		if (!host) {
			throw new Error('SecureShell feature requires "host" option')
		}
		
		if (!username) {
			throw new Error('SecureShell feature requires "username" option')
		}
	}

	/**
	 * Build the ssh argv (flags + user@host) with authentication options.
	 * Argv arrays go straight to the binary — no local shell, no quoting layer.
	 */
	private buildSshArgs(): string[] {
		this.validateOptions()
		const { host, port = 22, username, key } = this.options
		const args = ['-p', String(port)]

		if (key) {
			args.push('-i', key)
		}

		// Batch mode fails immediately instead of hanging on interactive prompts
		args.push('-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no')
		args.push(`${username}@${host}`)

		return args
	}

	/**
	 * Build the scp flag argv for file transfers (no source/target — callers append those).
	 * Argv arrays go straight to the binary — no local shell, no quoting layer.
	 */
	private buildScpArgs(): string[] {
		this.validateOptions()
		const { port = 22, key } = this.options
		const args = ['-P', String(port)]

		if (key) {
			args.push('-i', key)
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
	 * @throws {Error} When the SSH command exits with a non-zero code
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
		const { host, username } = this.options
		const argv = [...this.buildScpArgs(), `${username}@${host}:${source}`, target]

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
		const { host, username } = this.options
		const argv = [...this.buildScpArgs(), source, `${username}@${host}:${target}`]

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
