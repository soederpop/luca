import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import * as ngrok from '@ngrok/ngrok'
import { Feature, features } from '../../feature.js'

/**
 * Zod schema for the Port Exposer feature state
 */
export const PortExposerStateSchema = FeatureStateSchema.extend({
	/** Whether ngrok is currently connected */
	connected: z.boolean(),
	/** The public URL provided by ngrok */
	publicUrl: z.string().optional(),
	/** The local port being exposed */
	localPort: z.number().optional(),
	/** Ngrok session information */
	sessionInfo: z.object({
		authToken: z.string().optional(),
		region: z.string().optional(),
		subdomain: z.string().optional(),
	}).optional(),
	/** Connection timestamp */
	connectedAt: z.coerce.date().optional(),
	/** Any error that occurred */
	lastError: z.string().optional(),
})
export type PortExposerState = z.infer<typeof PortExposerStateSchema>

/**
 * Zod schema for Port Exposer feature options
 */
export const PortExposerOptionsSchema = FeatureOptionsSchema.extend({
	/** Local port to expose */
	port: z.number().optional(),
	/** Optional ngrok auth token for premium features */
	authToken: z.string().optional(),
	/** Preferred region (us, eu, ap, au, sa, jp, in) */
	region: z.string().optional(),
	/** Custom subdomain (requires paid plan) */
	subdomain: z.string().optional(),
	/** Domain to use (requires paid plan) */
	domain: z.string().optional(),
	/** Basic auth for the tunnel */
	basicAuth: z.string().optional(),
	/** OAuth provider for authentication */
	oauth: z.string().optional(),
	/** Additional ngrok configuration */
	config: z.any(),
})
export type PortExposerOptions = z.infer<typeof PortExposerOptionsSchema>

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
 * const exposer = container.use('portExposer', { port: 3000 })
 * const url = await exposer.expose()
 * console.log(`Service available at: ${url}`)
 * 
 * // With custom subdomain
 * const exposer = container.use('portExposer', { 
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

	private ngrokListener?: ngrok.Listener

	override get initialState(): PortExposerState {
		return {
			...super.initialState,
			connected: false
		}
	}

	/**
	 * Expose the local port via ngrok
	 * 
	 * @param port Optional port override
	 * @returns Promise resolving to the public URL
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
	 * Stop exposing the port and close the ngrok tunnel
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
	 * Get the current public URL if connected
	 */
	getPublicUrl(): string | undefined {
		return this.ngrokListener?.url() || undefined
	}

	/**
	 * Check if currently connected
	 */
	isConnected(): boolean {
		return this.state.get('connected') ?? false
	}

	/**
	 * Get connection information
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
	 * Reconnect with new options
	 */
	async reconnect(newOptions?: Partial<PortExposerOptions>): Promise<string> {
		await this.close()
		
		if (newOptions) {
			Object.assign(this.options, newOptions)
		}

		return this.expose()
	}

	/**
	 * Override disable to ensure cleanup
	 */
	async disable(): Promise<this> {
		await this.close()
		return this
	}
}

// Register the feature with the features registry
export default features.register('portExposer', PortExposer)

// Module augmentation for type safety
declare module '../../feature.js' {
	interface AvailableFeatures {
		portExposer: typeof PortExposer
	}
}

