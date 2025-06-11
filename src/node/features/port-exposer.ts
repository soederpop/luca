import * as ngrok from '@ngrok/ngrok'
import { Feature, features, type FeatureOptions, type FeatureState } from '../../feature.js'

/**
 * State interface for the Port Exposer feature
 */
export interface PortExposerState extends FeatureState {
	/** Whether ngrok is currently connected */
	connected: boolean
	/** The public URL provided by ngrok */
	publicUrl?: string
	/** The local port being exposed */
	localPort?: number
	/** Ngrok session information */
	sessionInfo?: {
		authToken?: string
		region?: string
		subdomain?: string
	}
	/** Connection timestamp */
	connectedAt?: Date
	/** Any error that occurred */
	lastError?: string
}

/**
 * Options for configuring the Port Exposer feature
 */
export interface PortExposerOptions extends FeatureOptions {
	/** Local port to expose */
	port?: number
	/** Optional ngrok auth token for premium features */
	authToken?: string
	/** Preferred region (us, eu, ap, au, sa, jp, in) */
	region?: string
	/** Custom subdomain (requires paid plan) */
	subdomain?: string
	/** Domain to use (requires paid plan) */
	domain?: string
	/** Basic auth for the tunnel */
	basicAuth?: string
	/** OAuth provider for authentication */
	oauth?: string
	/** Additional ngrok configuration */
	config?: any
}

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

