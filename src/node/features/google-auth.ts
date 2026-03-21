import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

export const GoogleAuthStateSchema = FeatureStateSchema.extend({
  authMode: z.enum(['oauth2', 'service-account', 'none']).default('none')
    .describe('Current authentication mode'),
  isAuthenticated: z.boolean().default(false)
    .describe('Whether valid credentials are currently available'),
  email: z.string().optional()
    .describe('Authenticated user or service account email'),
  scopes: z.array(z.string()).default([])
    .describe('OAuth2 scopes that have been authorized'),
  tokenExpiry: z.string().optional()
    .describe('ISO timestamp when the current access token expires'),
  lastError: z.string().optional()
    .describe('Last authentication error message'),
})
export type GoogleAuthState = z.infer<typeof GoogleAuthStateSchema>

export const GoogleAuthOptionsSchema = FeatureOptionsSchema.extend({
  mode: z.enum(['oauth2', 'service-account']).optional()
    .describe('Authentication mode. Auto-detected if serviceAccountKeyPath is set'),
  clientId: z.string().optional()
    .describe('OAuth2 client ID (falls back to GOOGLE_CLIENT_ID env var)'),
  clientSecret: z.string().optional()
    .describe('OAuth2 client secret (falls back to GOOGLE_CLIENT_SECRET env var)'),
  serviceAccountKeyPath: z.string().optional()
    .describe('Path to service account JSON key file (falls back to GOOGLE_SERVICE_ACCOUNT_KEY env var)'),
  serviceAccountKey: z.record(z.string(), z.any()).optional()
    .describe('Service account key as a parsed JSON object (alternative to file path)'),
  scopes: z.array(z.string()).optional()
    .describe('OAuth2 scopes to request'),
  redirectPort: z.number().optional()
    .describe('Port for OAuth2 callback server (falls back to GOOGLE_OAUTH_REDIRECT_PORT env var, then 3000)'),
  tokenCacheKey: z.string().optional()
    .describe('DiskCache key for storing OAuth2 refresh token'),
})
export type GoogleAuthOptions = z.infer<typeof GoogleAuthOptionsSchema>

export const GoogleAuthEventsSchema = FeatureEventsSchema.extend({
  authenticated: z.tuple([z.object({
    mode: z.string().describe('Auth mode used'),
    email: z.string().optional().describe('User or service account email'),
  })]).describe('Authentication successful'),
  tokenRefreshed: z.tuple([]).describe('Access token was refreshed'),
  authorizationRequired: z.tuple([z.string().describe('Authorization URL to visit')])
    .describe('User must visit this URL to authorize'),
  error: z.tuple([z.any().describe('The error')]).describe('Authentication error occurred'),
})

/**
 * Google authentication feature supporting OAuth2 browser flow and service account auth.
 *
 * Handles the complete OAuth2 lifecycle: authorization URL generation, local callback server,
 * token exchange, refresh token storage (via diskCache), and automatic token refresh.
 * Also supports non-interactive service account authentication via JSON key files.
 *
 * Other Google features (drive, sheets, calendar, docs) depend on this feature
 * and access it lazily via `container.feature('googleAuth')`.
 *
 * @example
 * ```typescript
 * // OAuth2 flow — opens browser for consent
 * const auth = container.feature('googleAuth', {
 *   clientId: 'your-client-id.apps.googleusercontent.com',
 *   clientSecret: 'your-secret',
 *   scopes: ['https://www.googleapis.com/auth/drive.readonly'],
 * })
 * await auth.authorize()
 *
 * // Service account flow — no browser needed
 * const auth = container.feature('googleAuth', {
 *   serviceAccountKeyPath: '/path/to/key.json',
 *   scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
 * })
 * await auth.authenticateServiceAccount()
 * ```
 */
export class GoogleAuth extends Feature<GoogleAuthState, GoogleAuthOptions> {
  static override shortcut = 'features.googleAuth' as const
  static override envVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_SERVICE_ACCOUNT_KEY',
    'GOOGLE_OAUTH_REDIRECT_PORT',
  ]
  static override stateSchema = GoogleAuthStateSchema
  static override optionsSchema = GoogleAuthOptionsSchema
  static override eventsSchema = GoogleAuthEventsSchema
  static { Feature.register(this, 'googleAuth') }

  private _oauth2Client?: OAuth2Client
  private _redirectUri?: string

  override get initialState(): GoogleAuthState {
    return {
      ...super.initialState,
      authMode: 'none',
      isAuthenticated: false,
      scopes: [],
    }
  }

  /** OAuth2 client ID from options or GOOGLE_CLIENT_ID env var. */
  get clientId(): string {
    const id = this.options.clientId || process.env.GOOGLE_CLIENT_ID
    if (!id) throw new Error('Google client ID required. Set options.clientId or GOOGLE_CLIENT_ID env var.')
    return id
  }

  /** OAuth2 client secret from options or GOOGLE_CLIENT_SECRET env var. */
  get clientSecret(): string {
    const secret = this.options.clientSecret || process.env.GOOGLE_CLIENT_SECRET
    if (!secret) throw new Error('Google client secret required. Set options.clientSecret or GOOGLE_CLIENT_SECRET env var.')
    return secret
  }

  /** Resolved authentication mode based on options. */
  get authMode(): 'oauth2' | 'service-account' {
    if (this.options.mode) return this.options.mode
    if (this.options.serviceAccountKeyPath || this.options.serviceAccountKey || process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return 'service-account'
    }
    return 'oauth2'
  }

  /** Whether valid credentials are currently available. */
  get isAuthenticated(): boolean {
    return this.state.get('isAuthenticated') || false
  }

  /** Default scopes covering Drive, Sheets, Calendar, and Docs read access. */
  get defaultScopes(): string[] {
    return [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/documents.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
    ]
  }

  /** Resolved redirect port from options, GOOGLE_OAUTH_REDIRECT_PORT env var, or default 3000. */
  get redirectPort(): number {
    return this.options.redirectPort
      || (process.env.GOOGLE_OAUTH_REDIRECT_PORT ? parseInt(process.env.GOOGLE_OAUTH_REDIRECT_PORT, 10) : undefined)
      || 3000
  }

  /** DiskCache key used for storing the refresh token. */
  get tokenCacheKey(): string {
    return this.options.tokenCacheKey || `google-auth:refresh:${this.clientId}`
  }

  /**
   * Get the OAuth2Client instance, creating it lazily.
   * After authentication, this client has valid credentials set.
   *
   * @returns The OAuth2Client instance
   */
  getOAuth2Client(): OAuth2Client {
    if (this._oauth2Client) return this._oauth2Client

    const redirectUri = this._redirectUri || `http://localhost:${this.redirectPort}/oauth2callback`
    this._oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri)
    return this._oauth2Client
  }

  /**
   * Get the authenticated auth client for passing to googleapis service constructors.
   * Handles token refresh automatically for OAuth2. For service accounts, returns
   * the JWT auth client.
   *
   * @returns An auth client suitable for `google.drive({ version: 'v3', auth })`
   */
  async getAuthClient(): Promise<OAuth2Client | ReturnType<typeof google.auth.fromJSON>> {
    if (!this.isAuthenticated) {
      // Try restoring from cache first
      const restored = await this.tryRestoreTokens()
      if (!restored) {
        throw new Error('Not authenticated. Call authorize() or authenticateServiceAccount() first.')
      }
    }

    if (this.state.get('authMode') === 'service-account') {
      const key = this.getServiceAccountKey()
      const auth = google.auth.fromJSON(key) as any
      auth.scopes = this.options.scopes || this.defaultScopes
      return auth
    }

    const client = this.getOAuth2Client()

    // Check if token needs refresh
    const expiry = this.state.get('tokenExpiry')
    if (expiry && new Date(expiry).getTime() < Date.now() + 60_000) {
      try {
        const { credentials } = await client.refreshAccessToken()
        client.setCredentials(credentials)
        if (credentials.expiry_date) {
          this.setState({ tokenExpiry: new Date(credentials.expiry_date).toISOString() })
        }
        this.emit('tokenRefreshed')
      } catch (err: any) {
        this.setState({ lastError: err.message, isAuthenticated: false })
        this.emit('error', err)
        throw err
      }
    }

    return client
  }

  /**
   * Start the OAuth2 authorization flow.
   *
   * 1. Spins up a temporary Express callback server on a free port
   * 2. Generates the Google authorization URL
   * 3. Opens the browser to the consent page
   * 4. Waits for the callback with the authorization code
   * 5. Exchanges the code for access + refresh tokens
   * 6. Stores the refresh token in diskCache
   * 7. Shuts down the callback server
   *
   * @param scopes - OAuth2 scopes to request (defaults to options.scopes or defaultScopes)
   */
  async authorize(scopes?: string[]): Promise<this> {
    const requestedScopes = scopes || this.options.scopes || this.defaultScopes
    const port = this.redirectPort
    const redirectUri = `http://localhost:${port}/oauth2callback`
    this._redirectUri = redirectUri

    const oauth2Client = new google.auth.OAuth2(this.clientId, this.clientSecret, redirectUri)
    this._oauth2Client = oauth2Client

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: requestedScopes,
      prompt: 'consent',
    })

    this.emit('authorizationRequired', authUrl)

    // Create a promise that resolves when the callback is received
    const codePromise = new Promise<string>((resolve, reject) => {
      const server = Bun.serve({
        port,
        fetch(req) {
          const url = new URL(req.url)
          if (url.pathname === '/oauth2callback') {
            const code = url.searchParams.get('code')
            const error = url.searchParams.get('error')

            if (error) {
              reject(new Error(`OAuth2 authorization denied: ${error}`))
              return new Response(
                '<html><body><h2>Authorization denied.</h2><p>You can close this window.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              )
            }

            if (code) {
              resolve(code)
              return new Response(
                '<html><body><h2>Authorization successful!</h2><p>You can close this window.</p></body></html>',
                { headers: { 'Content-Type': 'text/html' } }
              )
            }

            reject(new Error('No authorization code received'))
            return new Response('Missing code', { status: 400 })
          }
          return new Response('Not found', { status: 404 })
        },
      })

      // Store server reference for cleanup
      ;(this as any)._callbackServer = server

      // Timeout after 5 minutes
      setTimeout(() => {
        reject(new Error('OAuth2 authorization timed out (5 minutes)'))
      }, 5 * 60 * 1000)
    })

    // Open the browser
    try {
      const opener = this.container.feature('opener')
      await opener.open(authUrl)
    } catch {
      // If opener fails, log the URL for manual opening
      console.log(`\nOpen this URL in your browser to authorize:\n${authUrl}\n`)
    }

    try {
      const code = await codePromise
      const { tokens } = await oauth2Client.getToken(code)
      oauth2Client.setCredentials(tokens)

      // Store refresh token
      if (tokens.refresh_token) {
        await this.storeRefreshToken(tokens.refresh_token)
      }

      // Fetch user info
      let email: string | undefined
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        const userInfo = await oauth2.userinfo.get()
        email = userInfo.data.email || undefined
      } catch {
        // Non-critical — email is optional
      }

      this.setState({
        authMode: 'oauth2',
        isAuthenticated: true,
        email,
        scopes: requestedScopes,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : undefined,
        lastError: undefined,
      })

      this.emit('authenticated', { mode: 'oauth2', email })
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    } finally {
      // Shut down callback server
      const server = (this as any)._callbackServer
      if (server) {
        server.stop()
        delete (this as any)._callbackServer
      }
    }

    return this
  }

  /**
   * Authenticate using a service account JSON key file.
   * Reads the key from options.serviceAccountKeyPath, options.serviceAccountKey,
   * or the GOOGLE_SERVICE_ACCOUNT_KEY env var.
   *
   * @returns This feature instance for chaining
   */
  async authenticateServiceAccount(): Promise<this> {
    try {
      const key = this.getServiceAccountKey()
      const scopes = this.options.scopes || this.defaultScopes
      const auth = google.auth.fromJSON(key) as any
      auth.scopes = scopes

      // Test the auth by getting an access token
      const token = await auth.getAccessToken()
      if (!token) {
        throw new Error('Failed to obtain access token from service account')
      }

      this.setState({
        authMode: 'service-account',
        isAuthenticated: true,
        email: key.client_email,
        scopes,
        lastError: undefined,
      })

      this.emit('authenticated', { mode: 'service-account', email: key.client_email })
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }

    return this
  }

  /**
   * Attempt to restore authentication from a cached refresh token.
   * Called automatically by getAuthClient() if not yet authenticated.
   *
   * @returns true if tokens were restored successfully
   */
  async tryRestoreTokens(): Promise<boolean> {
    if (this.authMode === 'service-account') {
      try {
        await this.authenticateServiceAccount()
        return true
      } catch {
        return false
      }
    }

    try {
      const refreshToken = await this.loadRefreshToken()
      if (!refreshToken) return false

      const oauth2Client = this.getOAuth2Client()
      oauth2Client.setCredentials({ refresh_token: refreshToken })

      const { credentials } = await oauth2Client.refreshAccessToken()
      oauth2Client.setCredentials(credentials)

      let email: string | undefined
      try {
        const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
        const userInfo = await oauth2.userinfo.get()
        email = userInfo.data.email || undefined
      } catch {
        // Non-critical
      }

      this.setState({
        authMode: 'oauth2',
        isAuthenticated: true,
        email,
        tokenExpiry: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : undefined,
        lastError: undefined,
      })

      this.emit('authenticated', { mode: 'oauth2', email })
      return true
    } catch {
      return false
    }
  }

  /**
   * Revoke the current credentials and clear cached tokens.
   *
   * @returns This feature instance for chaining
   */
  async revoke(): Promise<this> {
    try {
      if (this.state.get('authMode') === 'oauth2' && this._oauth2Client) {
        await this._oauth2Client.revokeCredentials()
      }
    } catch {
      // Best effort revocation
    }

    // Clear cached refresh token
    try {
      const cache = this.container.feature('diskCache')
      await cache.rm(this.tokenCacheKey)
    } catch {
      // Cache may not exist
    }

    this._oauth2Client = undefined
    this.setState({
      authMode: 'none',
      isAuthenticated: false,
      email: undefined,
      scopes: [],
      tokenExpiry: undefined,
    })

    return this
  }

  /** Store a refresh token in diskCache. */
  private async storeRefreshToken(token: string): Promise<void> {
    const cache = this.container.feature('diskCache')
    await cache.set(this.tokenCacheKey, token)
  }

  /** Load a refresh token from diskCache. */
  private async loadRefreshToken(): Promise<string | null> {
    try {
      const cache = this.container.feature('diskCache')
      const exists = await cache.has(this.tokenCacheKey)
      if (!exists) return null
      return await cache.get(this.tokenCacheKey)
    } catch {
      return null
    }
  }

  /** Resolve the service account key from options or env var. */
  private getServiceAccountKey(): any {
    if (this.options.serviceAccountKey) return this.options.serviceAccountKey

    const keyPath = this.options.serviceAccountKeyPath || process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!keyPath) {
      throw new Error('Service account key required. Set options.serviceAccountKeyPath, options.serviceAccountKey, or GOOGLE_SERVICE_ACCOUNT_KEY env var.')
    }

    const resolved = this.container.paths.resolve(keyPath)
    return this.container.fs.readJson(resolved)
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    googleAuth: typeof GoogleAuth
  }
}

export default GoogleAuth