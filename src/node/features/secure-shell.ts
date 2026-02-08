import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'

export const SecureShellStateSchema = FeatureStateSchema.extend({
	connected: z.boolean(),
})
export type SecureShellState = z.infer<typeof SecureShellStateSchema>

export const SecureShellOptionsSchema = FeatureOptionsSchema.extend({
	host: z.string().optional(),
	port: z.number().optional(),
	username: z.string().optional(),
	password: z.string().optional(),
	key: z.string().optional(),
})
export type SecureShellOptions = z.infer<typeof SecureShellOptionsSchema>

/**
 * Uses ssh to run commands, or scp to transfer files between a remote host. 
 * 
 */
export class SecureShell extends Feature<SecureShellState, SecureShellOptions> {
  static override shortcut = 'features.secureShell' as const
  static override stateSchema = SecureShellStateSchema
  static override optionsSchema = SecureShellOptionsSchema

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
	 * Test the SSH connection
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
	 * @param command - The command to execute.
	 * @returns The output of the command.
	 */
	async exec(command: string): Promise<string> {
		const sshCmd = `${this.buildSSHConnectionString()} "${command}"`
		
		try {
			const result = await this.proc.execAndCapture(sshCmd)
			
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
	 * Downloads a file from the remote host.
	 * 
	 * @param source - The source file path on the remote host.
	 * @param target - The target file path on the local machine.
	 * @returns The output of the scp command.
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
	 * Uploads a file to the remote host.
	 * 
	 * @param source - The source file path on the local machine.
	 * @param target - The target file path on the remote host.
	 * @returns The output of the scp command.
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

export default features.register('secureShell', SecureShell)