import { z } from 'zod'
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'
import type { NodeContainer } from '../../node/container'

/**
 * Support module for mcpBridge: an OAuthClientProvider that keeps one login
 * per MCP server URL in a machine-scoped store, so every project and every
 * luca process on this machine shares it.
 */

/**
 * Probe by binding the exact address the callback uses. networking.isPortOpen
 * checks a different address and reports a port held on 127.0.0.1 as free.
 */
function canBindCallback(port: number): boolean {
	try {
		Bun.serve({ port, hostname: CALLBACK_HOST, fetch: () => new Response() }).stop(true)
		return true
	} catch {
		return false
	}
}

export const McpOAuthConfigSchema = z.object({
	clientId: z.string().optional().describe('Pre-registered OAuth client id. Omit to use dynamic client registration, which most MCP servers support.'),
	clientSecret: z.string().optional().describe('Client secret for a pre-registered confidential client. Use ${VAR} in config files rather than committing it.'),
	callbackPort: z
		.number()
		.optional()
		.describe('Fixed localhost port for the OAuth redirect. Needed when a pre-registered client only allows one redirect URI. Defaults to a free port chosen on first login.'),
	scopes: z.array(z.string()).optional().describe('Scopes to request. Defaults to what the server advertises.'),
})

export type McpOAuthConfig = z.infer<typeof McpOAuthConfigSchema>

/** What one server's login looks like on disk. */
interface McpOAuthEntry {
	serverName?: string
	redirectUrl?: string
	clientInformation?: OAuthClientInformationMixed
	tokens?: OAuthTokens
	tokensSavedAt?: string
}

type McpOAuthStoreShape = { servers: Record<string, McpOAuthEntry> }

export const MCP_OAUTH_STORE = 'mcp-oauth'
const DEFAULT_CALLBACK_PORT = 33418
const CALLBACK_PATH = '/callback'
// Not "localhost": on macOS Bun lets a second process bind the same localhost
// port, so two concurrent logins would split each other's callbacks. An
// explicit 127.0.0.1 bind fails with EADDRINUSE instead (and RFC 8252 prefers it).
const CALLBACK_HOST = '127.0.0.1'
const LOGIN_TIMEOUT_MS = 5 * 60 * 1000

/** The store handle that holds every server's login. 0600 because it holds bearer tokens. */
export function mcpOAuthStore(container: NodeContainer) {
	return (container as any).store(MCP_OAUTH_STORE, {
		scope: 'machine',
		fileMode: 0o600,
		initial: { servers: {} },
	}) as {
		read(): Promise<McpOAuthStoreShape>
		update(fn: (draft: McpOAuthStoreShape) => void): Promise<McpOAuthStoreShape>
		path: string
	}
}

/** Logins are keyed by URL, not server name, so two projects that name a server differently still share one login. */
export function mcpOAuthKey(serverUrl: string): string {
	const url = new URL(serverUrl)
	url.hash = ''
	return url.toString()
}

export interface McpOAuthProviderOptions {
	serverName: string
	serverUrl: string
	config?: McpOAuthConfig
	/** Open a browser and wait for the redirect when a login is needed. False fails fast instead. */
	interactive: boolean
	/** Called with the authorization URL before the browser opens, so callers can print it. */
	onAuthorizationUrl?: (url: URL) => void
}

export class McpOAuthProvider implements OAuthClientProvider {
	private _redirectUrl?: string
	private _dropStoredClient = false
	private _codeVerifier?: string
	private _state?: string
	private _lastReadTokens?: OAuthTokens
	private _codePromise?: Promise<string>
	private _stopCallbackServer?: () => void

	/** Set when the SDK asked for a browser login during the last connect attempt. */
	authorizationUrl?: URL

	constructor(
		private container: NodeContainer,
		private opts: McpOAuthProviderOptions,
	) {}

	get key() {
		return mcpOAuthKey(this.opts.serverUrl)
	}

	private get store() {
		return mcpOAuthStore(this.container)
	}

	private async entry(): Promise<McpOAuthEntry> {
		return (await this.store.read()).servers?.[this.key] || {}
	}

	private async updateEntry(fn: (entry: McpOAuthEntry) => void) {
		await this.store.update((draft) => {
			draft.servers ||= {}
			const entry = (draft.servers[this.key] ||= {})
			entry.serverName = this.opts.serverName
			fn(entry)
		})
	}

	/**
	 * Settle the redirect URL before the SDK reads it (its getter is sync).
	 * A dynamically registered client is bound to its redirect URI, so reuse
	 * the stored one. If an interactive login finds that port taken, ignore
	 * the stored client so the SDK registers a new one on a free port.
	 * Writes nothing: servers that never ask for auth leave no trace.
	 */
	async prepare(): Promise<void> {
		const entry = await this.entry()
		const fixedPort = this.opts.config?.callbackPort

		if (fixedPort) {
			this._redirectUrl = `http://${CALLBACK_HOST}:${fixedPort}${CALLBACK_PATH}`
			return
		}

		const stored = entry.redirectUrl ? new URL(entry.redirectUrl) : undefined
		if (stored && stored.hostname === CALLBACK_HOST) {
			const port = Number(stored.port)
			if (!this.opts.interactive || canBindCallback(port)) {
				this._redirectUrl = entry.redirectUrl
				return
			}
			if (this.opts.config?.clientId) {
				throw new Error(`OAuth callback port ${port} for MCP server "${this.opts.serverName}" is in use. Free it, or set oauth.callbackPort.`)
			}
		}

		let port = DEFAULT_CALLBACK_PORT
		while (!canBindCallback(port)) {
			if (++port > DEFAULT_CALLBACK_PORT + 100) throw new Error('No free localhost port for the OAuth callback')
		}
		this._redirectUrl = `http://${CALLBACK_HOST}:${port}${CALLBACK_PATH}`
		this._dropStoredClient = !!entry.clientInformation
	}

	get redirectUrl(): string | undefined {
		return this._redirectUrl
	}

	get clientMetadata(): OAuthClientMetadata {
		return {
			client_name: 'Luca',
			client_uri: 'https://github.com/soederpop/luca',
			redirect_uris: this._redirectUrl ? [this._redirectUrl] : [],
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: this.opts.config?.clientSecret ? 'client_secret_post' : 'none',
			...(this.opts.config?.scopes?.length ? { scope: this.opts.config.scopes.join(' ') } : {}),
		}
	}

	state(): string {
		this._state = this.container.utils.uuid()
		return this._state
	}

	async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
		const { clientId, clientSecret } = this.opts.config || {}
		if (clientId) return { client_id: clientId, ...(clientSecret ? { client_secret: clientSecret } : {}) }
		if (this._dropStoredClient) return undefined
		return (await this.entry()).clientInformation
	}

	async saveClientInformation(info: OAuthClientInformationMixed): Promise<void> {
		if (this.opts.config?.clientId) return
		// The client is registered against this exact redirect URI; keep them together.
		await this.updateEntry((e) => {
			e.clientInformation = info
			e.redirectUrl = this._redirectUrl
		})
		this._dropStoredClient = false
	}

	async tokens(): Promise<OAuthTokens | undefined> {
		// Re-read every time: another luca process may have refreshed since.
		this._lastReadTokens = (await this.entry()).tokens
		return this._lastReadTokens
	}

	async saveTokens(tokens: OAuthTokens): Promise<void> {
		await this.updateEntry((e) => {
			// A refresh response may omit refresh_token, meaning "keep using the old one".
			const refresh_token = tokens.refresh_token || e.tokens?.refresh_token
			e.tokens = { ...tokens, ...(refresh_token ? { refresh_token } : {}) }
			e.tokensSavedAt = new Date().toISOString()
		})
		this._lastReadTokens = tokens
	}

	async invalidateCredentials(scope: 'all' | 'client' | 'tokens' | 'verifier'): Promise<void> {
		if (scope === 'verifier') {
			this._codeVerifier = undefined
			return
		}
		await this.updateEntry((e) => {
			// Two processes can refresh with the same rotating token at once. The
			// loser gets invalid_grant; don't let it erase the winner's new tokens.
			const stale = !e.tokens || e.tokens.access_token === this._lastReadTokens?.access_token
			if ((scope === 'all' || scope === 'tokens') && stale) {
				delete e.tokens
				delete e.tokensSavedAt
			}
			if (scope === 'all' || scope === 'client') delete e.clientInformation
		})
	}

	saveCodeVerifier(codeVerifier: string): void {
		this._codeVerifier = codeVerifier
	}

	codeVerifier(): string {
		if (!this._codeVerifier) throw new Error(`No PKCE code verifier for MCP server "${this.opts.serverName}". Start the login again.`)
		return this._codeVerifier
	}

	async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
		this.authorizationUrl = authorizationUrl
		if (!this.opts.interactive) return

		// The listener must be up before the browser can redirect to it.
		this._codePromise = this.listenForCallback()
		// Nobody awaits until connect() fails; keep an early rejection from going unhandled.
		this._codePromise.catch(() => {})
		this.opts.onAuthorizationUrl?.(authorizationUrl)
		try {
			await this.container.feature('opener').open(authorizationUrl.toString())
		} catch {
			console.log(`\nOpen this URL in your browser to log in to "${this.opts.serverName}":\n${authorizationUrl}\n`)
		}
	}

	/** Resolve with the authorization code from the browser redirect. Only valid after redirectToAuthorization in interactive mode. */
	async waitForAuthorizationCode(): Promise<string> {
		if (!this._codePromise) throw new Error(`No login in progress for MCP server "${this.opts.serverName}"`)
		try {
			return await this._codePromise
		} finally {
			this._stopCallbackServer?.()
			this._codePromise = undefined
			this.authorizationUrl = undefined
		}
	}

	private listenForCallback(): Promise<string> {
		const redirect = new URL(this._redirectUrl!)
		const expectedState = this._state
		const page = (title: string) =>
			new Response(`<html><body style="font-family: system-ui; padding: 3rem"><h2>${title}</h2><p>You can close this window.</p></body></html>`, { headers: { 'Content-Type': 'text/html', Connection: 'close' } })

		return new Promise<string>((resolve, reject) => {
			let timeout: ReturnType<typeof setTimeout> | undefined
			let server: ReturnType<typeof Bun.serve>
			try {
				server = Bun.serve({
					port: Number(redirect.port),
					hostname: CALLBACK_HOST,
					fetch: (req) => {
						const url = new URL(req.url)
						if (url.pathname !== redirect.pathname) return new Response('Not found', { status: 404 })

						const error = url.searchParams.get('error')
						if (error) {
							reject(new Error(`OAuth login for MCP server "${this.opts.serverName}" was denied: ${url.searchParams.get('error_description') || error}`))
							return page('Login denied.')
						}
						if (expectedState && url.searchParams.get('state') !== expectedState) {
							reject(new Error(`OAuth login for MCP server "${this.opts.serverName}" returned a mismatched state; ignoring it.`))
							return page('Login failed: state mismatch.')
						}
						const code = url.searchParams.get('code')
						if (!code) return new Response('Missing code', { status: 400 })
						resolve(code)
						return page(`Logged in to ${this.opts.serverName}.`)
					},
				})
			} catch (err: any) {
				const busy = err?.code === 'EADDRINUSE'
				reject(
					new Error(
						busy
							? `OAuth callback port ${redirect.port} for MCP server "${this.opts.serverName}" is in use. Is another login running? Try again when it finishes.`
							: `Could not start the OAuth callback server for MCP server "${this.opts.serverName}": ${err?.message || err}`,
					),
				)
				return
			}

			timeout = setTimeout(() => {
				reject(new Error(`OAuth login for MCP server "${this.opts.serverName}" timed out after 5 minutes`))
			}, LOGIN_TIMEOUT_MS)

			this._stopCallbackServer = () => {
				if (timeout) clearTimeout(timeout)
				// Force-close, or a browser keep-alive socket would carry the next
				// login's callback to this finished server. The delay lets the
				// success page (sent with Connection: close) flush first.
				setTimeout(() => server.stop(true), 250)
				this._stopCallbackServer = undefined
			}
		})
	}
}
