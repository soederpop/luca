import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

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
  static override stateSchema = SecureShellStateSchema
  static override optionsSchema = SecureShellOptionsSchema
  static { Feature.register(this, 'secureShell') }

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
	 * Build SSH connection string with authentication options
	 */
	private buildSSHConnectionString(): string {
		this.validateOptions()
		const { host, port = 22, username, key } = this.options
		let sshCmd = `${this.sshPath} -p ${port}`
		
		if (key) {
			sshCmd += ` -i "${key}"`
		}
		
		// Batch mode fails immediately instead of hanging on interactive prompts
		sshCmd += ` -o BatchMode=yes -o StrictHostKeyChecking=no`
		
		sshCmd += ` ${username}@${host}`
		
		return sshCmd
	}

	/**
	 * Build SCP connection string for file transfers
	 */
	private buildSCPConnectionString(): string {
		this.validateOptions()
		const { host, port = 22, username, key } = this.options
		let scpCmd = `${this.scpPath} -P ${port}`
		
		if (key) {
			scpCmd += ` -i "${key}"`
		}
		
		// Batch mode fails immediately instead of hanging on interactive prompts
		scpCmd += ` -o BatchMode=yes -o StrictHostKeyChecking=no`
		
		return scpCmd
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
	 * @param command - The command to execute on the remote shell
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
	 * const listing = await ssh.exec('ls -la /var/log')
	 * console.log(listing)
	 * ```
	 */
	async exec(command: string): Promise<string> {
		const sshCmd = `${this.buildSSHConnectionString()} "${command}"`

		try {
			// Use the platform shell to avoid execAndCapture splitting the command on spaces
			const osFeature = this.container.feature('os')
			const result = await this.proc.spawnAndCapture(osFeature.shell, [osFeature.shellFlag, sshCmd])

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
		const scpCmd = `${this.buildSCPConnectionString()} ${username}@${host}:"${source}" "${target}"`
		
		try {
			const result = await this.proc.execAndCapture(scpCmd)
			
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
		const scpCmd = `${this.buildSCPConnectionString()} "${source}" ${username}@${host}:"${target}"`
		
		try {
			const result = await this.proc.execAndCapture(scpCmd)
			
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
