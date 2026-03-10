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
 * and transfer files. Supports key-based and password-based authentication
 * through the container's `proc` feature.
 *
 * @example
 * ```typescript
 * const ssh = container.feature('secureShell', {
 *   host: '192.168.1.100',
 *   username: 'deploy',
 *   key: '~/.ssh/id_ed25519',
 * })
 *
 * if (await ssh.testConnection()) {
 *   const uptime = await ssh.exec('uptime')
 *   console.log(uptime)
 * }
 * ```
 *
 * @extends Feature
 */
export class SecureShell extends Feature<SecureShellState, SecureShellOptions> {
  static override shortcut = 'features.secureShell' as const
  static override stateSchema = SecureShellStateSchema
  static override optionsSchema = SecureShellOptionsSchema
  static { Feature.register(this, 'secureShell') }

	override get initialState(): SecureShellState {
		return {
			...super.initialState,
			connected: false
		}
	}

	/**
	 * Get the proc feature for executing shell commands
	 */
	private get proc() {
		return this.container.feature('proc')
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
		let sshCmd = `ssh -p ${port}`
		
		if (key) {
			sshCmd += ` -i "${key}"`
		}
		
		// Disable host key checking for automation (optional - you may want to remove this for security)
		sshCmd += ` -o StrictHostKeyChecking=no`
		
		sshCmd += ` ${username}@${host}`
		
		return sshCmd
	}

	/**
	 * Build SCP connection string for file transfers
	 */
	private buildSCPConnectionString(): string {
		this.validateOptions()
		const { host, port = 22, username, key } = this.options
		let scpCmd = `scp -P ${port}`
		
		if (key) {
			scpCmd += ` -i "${key}"`
		}
		
		// Disable host key checking for automation
		scpCmd += ` -o StrictHostKeyChecking=no`
		
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
	 * const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
	 * const ok = await ssh.testConnection()
	 * if (!ok) console.error('SSH connection failed')
	 * ```
	 */
	async testConnection(): Promise<boolean> {
		try {
			const testCmd = `${this.buildSSHConnectionString()} "echo 'connection_test'"`
			const result = await this.proc.execAndCapture(testCmd)
			
			if (result.exitCode === 0 && result.stdout.trim() === 'connection_test') {
				this.setState({ connected: true })
				return true
			} else {
				this.setState({ connected: false })
				return false
			}
		} catch (error) {
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
	 * const ssh = container.feature('secureShell', { host: 'example.com', username: 'admin', key: '~/.ssh/id_rsa' })
	 * const listing = await ssh.exec('ls -la /var/log')
	 * console.log(listing)
	 * ```
	 */
	async exec(command: string): Promise<string> {
		const sshCmd = `${this.buildSSHConnectionString()} "${command}"`

		try {
			// Use bash -c to avoid execAndCapture splitting the command on spaces
			const result = await this.proc.spawnAndCapture('bash', ['-c', sshCmd])

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
	 * @param source - The source file path on the remote host
	 * @param target - The target file path on the local machine
	 * @returns A confirmation message or the scp stdout output
	 * @throws {Error} When the SCP transfer fails
	 *
	 * @example
	 * ```typescript
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
	 * @param source - The source file path on the local machine
	 * @param target - The target file path on the remote host
	 * @returns A confirmation message or the scp stdout output
	 * @throws {Error} When the SCP transfer fails
	 *
	 * @example
	 * ```typescript
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