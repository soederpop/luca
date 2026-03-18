import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import * as ngrok from '@ngrok/ngrok'
import { Feature } from '../../feature.js'

/**
 * Zod schema for the Port Exposer feature state
 */
export const PortExposerStateSchema = FeatureStateSchema.extend({
	/** Whether ngrok is currently connected */
	connected: z.boolean().describe('Whether ngrok is currently connected'),
	/** The public URL provided by ngrok */
	publicUrl: z.string().optional().describe('The public URL provided by ngrok'),
	/** The local port being exposed */
	localPort: z.number().optional().describe('The local port being exposed'),
	/** Ngrok session information */
	sessionInfo: z.object({
		authToken: z.string().optional().describe('Ngrok authentication token'),
		region: z.string().optional().describe('Ngrok region'),
		subdomain: z.string().optional().describe('Ngrok subdomain'),
	}).optional().describe('Ngrok session information'),
	/** Connection timestamp */
	connectedAt: z.coerce.date().optional().describe('Timestamp when the connection was established'),
	/** Any error that occurred */
	lastError: z.string().optional().describe('Last error message from an ngrok operation'),
})
export type PortExposerState = z.infer<typeof PortExposerStateSchema>

/**
 * Zod schema for Port Exposer feature options
 */
export const PortExposerOptionsSchema = FeatureOptionsSchema.extend({
	/** Local port to expose */
	port: z.number().optional().describe('Local port to expose'),
	/** Optional ngrok auth token for premium features */
	authToken: z.string().optional().describe('Ngrok auth token for premium features'),
	/** Preferred region (us, eu, ap, au, sa, jp, in) */
	region: z.string().optional().describe('Preferred ngrok region (us, eu, ap, au, sa, jp, in)'),
	/** Custom subdomain (requires paid plan) */
	subdomain: z.string().optional().describe('Custom subdomain (requires paid plan)'),
	/** Domain to use (requires paid plan) */
	domain: z.string().optional().describe('Domain to use (requires paid plan)'),
	/** Basic auth for the tunnel */
	basicAuth: z.string().optional().describe('Basic auth credentials for the tunnel'),
	/** OAuth provider for authentication */
	oauth: z.string().optional().describe('OAuth provider for authentication'),
	/** Additional ngrok configuration */
	config: z.any().describe('Additional ngrok configuration'),
})
export type PortExposerOptions = z.infer<typeof PortExposerOptionsSchema>

export const PortExposerEventsSchema = FeatureEventsSchema.extend({
	exposed: z.tuple([z.object({
		publicUrl: z.string().optional().describe('The public ngrok URL'),
		localPort: z.number().describe('The local port being exposed'),
	}).describe('Exposure details')]).describe('When a local port is successfully exposed via ngrok'),
	closed: z.tuple([]).describe('When the ngrok tunnel is closed'),
	error: z.tuple([z.any().describe('The error object')]).describe('When an ngrok operation fails'),
}).describe('Port Exposer events')

/**
 * Port Exposer Feature
 * 
 * Exposes local HTTP services via ngrok with SSL-enabled public URLs.
 * Perfect for development, testing, and sharing local services securely.
 * 
 * Features:
 * - SSL-enabled public URLs for local services
 * - Custom subdomains and domains (with paid plans)
 * - Authentication options (basic auth, OAuth)
 * - Regional endpoint selection
 * - Connection state management
 * 
 * @example
 * ```typescript
 * // Basic usage
 * const exposer = container.feature('portExposer', { port: 3000 })
 * const url = await exposer.expose()
 * console.log(`Service available at: ${url}`)
 *
 * // With custom subdomain
 * const exposer = container.feature('portExposer', {
 *   port: 8080,
 *   subdomain: 'my-app',
 *   authToken: 'your-ngrok-token'
 * })
 * ```
 */
export class PortExposer extends Feature<PortExposerState, PortExposerOptions> {
	static override shortcut = 'portExposer' as const
	static override stateSchema = PortExposerStateSchema
	static override optionsSchema = PortExposerOptionsSchema
	static override eventsSchema = PortExposerEventsSchema
	static { Feature.register(this, 'portExposer') }

	private ngrokListener?: ngrok.Listener

	override get initialState(): PortExposerState {
		return {
			...super.initialState,
			connected: false
		}
	}

	/**
	 * Expose the local port via ngrok.
	 *
	 * Creates an ngrok tunnel to the specified local port and returns
	 * the SSL-enabled public URL. Emits `exposed` on success or `error` on failure.
	 *
	 * @param port - Optional port override; falls back to `options.port`
	 * @returns Promise resolving to the public URL string
	 * @throws {Error} When no port is specified in options or parameter
	 *
	 * @example
	 * ```typescript
	 * const exposer = container.feature('portExposer', { port: 3000 })
	 * const url = await exposer.expose()
	 * console.log(`Public URL: ${url}`)
	 *
	 * // Override port at call time
	 * const url2 = await exposer.expose(8080)
	 * ```
	 */
	async expose(port?: number): Promise<string> {
		const targetPort = port || this.options.port
		
		if (!targetPort) {
			throw new Error('Port must be specified either in options or as parameter')
		}

		try {
			// Set up ngrok configuration
			const config: any = {
				addr: targetPort,
				...this.options.config
			}

			// Add optional configuration
			if (this.options.authToken) {
				config.authtoken = this.options.authToken
			}
			if (this.options.region) {
				config.region = this.options.region
			}
			if (this.options.subdomain) {
				config.subdomain = this.options.subdomain
			}
			if (this.options.domain) {
				config.domain = this.options.domain
			}
			if (this.options.basicAuth) {
				config.basic_auth = this.options.basicAuth
			}
			if (this.options.oauth) {
				config.oauth = this.options.oauth
			}

			// Start ngrok listener
			this.ngrokListener = await ngrok.forward(config)
			const publicUrl = this.ngrokListener.url() || undefined

			// Update state
			this.setState({
				connected: true,
				publicUrl,
				localPort: targetPort,
				sessionInfo: {
					authToken: this.options.authToken,
					region: this.options.region,
					subdomain: this.options.subdomain
				},
				connectedAt: new Date(),
				lastError: undefined
			})

			this.emit('exposed', { publicUrl, localPort: targetPort })
			
			return publicUrl!

		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error'
			
			this.setState({
				connected: false,
				lastError: errorMessage
			})

			this.emit('error', error)
			throw error
		}
	}

	/**
	 * Stop exposing the port and close the ngrok tunnel.
	 *
	 * Tears down the ngrok listener, resets connection state, and emits `closed`.
	 * Safe to call when no tunnel is active (no-op).
	 *
	 * @returns Promise that resolves when the tunnel is fully closed
	 * @throws {Error} When the ngrok listener fails to close
	 *
	 * @example
	 * ```typescript
	 * const exposer = container.feature('portExposer', { port: 3000 })
	 * await exposer.expose()
	 * // ... later
	 * await exposer.close()
	 * console.log(exposer.isConnected()) // false
	 * ```
	 */
	async close(): Promise<void> {
		if (this.ngrokListener) {
			try {
				await this.ngrokListener.close()
				this.ngrokListener = undefined

				this.setState({
					connected: false,
					publicUrl: undefined,
					localPort: undefined,
					connectedAt: undefined
				})

				this.emit('closed')
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error'
				this.setState({ lastError: errorMessage })
				this.emit('error', error)
				throw error
			}
		}
	}

	/**
	 * Get the current public URL if connected.
	 *
	 * Returns the live URL from the ngrok listener, or `undefined` if no tunnel is active.
	 *
	 * @returns The public HTTPS URL string, or undefined when disconnected
	 *
	 * @example
	 * ```typescript
	 * const exposer = container.feature('portExposer', { port: 3000 })
	 * await exposer.expose()
	 * console.log(exposer.getPublicUrl()) // 'https://abc123.ngrok.io'
	 * ```
	 */
	getPublicUrl(): string | undefined {
		return this.ngrokListener?.url() || undefined
	}

	/**
	 * Check if the ngrok tunnel is currently connected.
	 *
	 * @returns `true` when an active tunnel exists, `false` otherwise
	 *
	 * @example
	 * ```typescript
	 * const exposer = container.feature('portExposer', { port: 3000 })
	 * console.log(exposer.isConnected()) // false
	 * await exposer.expose()
	 * console.log(exposer.isConnected()) // true
	 * ```
	 */
	isConnected(): boolean {
		return this.state.get('connected') ?? false
	}

	/**
	 * Get a snapshot of the current connection information.
	 *
	 * Returns an object with the tunnel's connected status, public URL,
	 * local port, connection timestamp, and session metadata.
	 *
	 * @returns An object containing `connected`, `publicUrl`, `localPort`, `connectedAt`, and `sessionInfo`
	 *
	 * @example
	 * ```typescript
	 * const exposer = container.feature('portExposer', { port: 3000 })
	 * await exposer.expose()
	 * const info = exposer.getConnectionInfo()
	 * console.log(info.publicUrl, info.localPort, info.connectedAt)
	 * ```
	 */
	getConnectionInfo() {
		const state = this.state.current
		return {
			connected: state.connected,
			publicUrl: state.publicUrl,
			localPort: state.localPort,
			connectedAt: state.connectedAt,
			sessionInfo: state.sessionInfo
		}
	}

	/**
	 * Close the existing tunnel and re-expose with optionally updated options.
	 *
	 * Calls `close()` first, merges any new options, then calls `expose()`.
	 *
	 * @param newOptions - Optional partial options to merge before reconnecting
	 * @returns Promise resolving to the new public URL string
	 *
	 * @example
	 * ```typescript
	 * const exposer = container.feature('portExposer', { port: 3000 })
	 * await exposer.expose()
	 * // Switch to a different port
	 * const newUrl = await exposer.reconnect({ port: 8080 })
	 * ```
	 */
	async reconnect(newOptions?: Partial<PortExposerOptions>): Promise<string> {
		await this.close()
		
		if (newOptions) {
			Object.assign(this.options, newOptions)
		}

		return this.expose()
	}

	/**
	 * Disable the feature, ensuring the ngrok tunnel is closed first.
	 *
	 * Overrides the base `disable()` to guarantee that the tunnel is
	 * torn down before the feature is marked as disabled.
	 *
	 * @returns This PortExposer instance
	 *
	 * @example
	 * ```typescript
	 * const exposer = container.feature('portExposer', { port: 3000 })
	 * await exposer.expose()
	 * await exposer.disable()
	 * ```
	 */
	async disable(): Promise<this> {
		await this.close()
		return this
	}
}

export default PortExposer
// Module augmentation for type safety
declare module '../../feature.js' {
	interface AvailableFeatures {
		portExposer: typeof PortExposer
	}
}

