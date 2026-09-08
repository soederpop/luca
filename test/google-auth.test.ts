import { afterEach, beforeEach, describe, expect, it, spyOn, mock, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import type { GoogleAuth } from '../src/node/features/google-auth'
let c: NodeContainer
type AsyncOAuthClient = { getToken(code: string): Promise<any>; refreshAccessToken(): Promise<any>; request(...args: any[]): Promise<any>; revokeCredentials(): Promise<any> }
let auth: GoogleAuth
let spies: Array<{ mockRestore(): void }>
let savedEnv: Record<string, string | undefined>
const envKeys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_SERVICE_ACCOUNT_KEY', 'GOOGLE_OAUTH_REDIRECT_PORT']
const track = <T extends { mockRestore(): void }>(spy: T): T => { spies.push(spy); return spy }
beforeEach(() => {
  savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]))
  for (const key of envKeys) delete process.env[key]
  c = new NodeContainer(); spies = []
  auth = c.feature('googleAuth', { clientId: 'test-id', clientSecret: 'test-secret', tokenCacheKey: `test-${c.utils.uuid()}` })
  const cache = c.feature('diskCache')
  track(spyOn(cache, 'has').mockResolvedValue(false))
  track(spyOn(cache, 'get').mockResolvedValue(null))
  track(spyOn(cache, 'rm').mockResolvedValue(undefined as any))
})
afterEach(() => {
  for (const spy of spies.reverse()) spy.mockRestore()
  for (const key of envKeys) { if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key] }
})

describe('Google authentication lifecycle', () => {
  it('requires credentials and permits environment defaults with explicit overrides', () => {
    const empty = new NodeContainer().feature('googleAuth')
    expect(() => empty.clientId).toThrow('client ID required')
    expect(() => empty.clientSecret).toThrow('client secret required')
    process.env.GOOGLE_CLIENT_ID = 'env-id'; process.env.GOOGLE_CLIENT_SECRET = 'env-secret'
    expect(empty.clientId).toBe('env-id'); expect(empty.clientSecret).toBe('env-secret')
    expect(auth.clientId).toBe('test-id'); expect(auth.clientSecret).toBe('test-secret')
  })
  it('detects auth mode while honoring an explicit mode', () => {
    expect(auth.authMode).toBe('oauth2')
    expect(c.feature('googleAuth', { serviceAccountKey: {} }).authMode).toBe('service-account')
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = '/test-only/key.json'
    expect(auth.authMode).toBe('service-account')
    expect(c.feature('googleAuth', { mode: 'oauth2' }).authMode).toBe('oauth2')
  })
  it('resolves callback ports and constructs a cached OAuth client', () => {
    expect(auth.redirectPort).toBe(3000)
    process.env.GOOGLE_OAUTH_REDIRECT_PORT = '4321'
    expect(auth.redirectPort).toBe(4321)
    const explicit = c.feature('googleAuth', { clientId: 'id', clientSecret: 'secret', redirectPort: 8765 })
    expect(explicit.redirectPort).toBe(8765)
    expect(explicit.tokenCacheKey).toBe('google-auth:refresh:id')
    expect(explicit.getOAuth2Client()).toBe(explicit.getOAuth2Client())
    const url = new URL(explicit.getOAuth2Client().generateAuthUrl({ scope: explicit.defaultScopes }))
    expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:8765/oauth2callback')
    expect(explicit.defaultScopes).toContain('https://www.googleapis.com/auth/drive.readonly')
  })
  it('requires authorization when there are no cached tokens', async () => {
    expect(await auth.tryRestoreTokens()).toBe(false)
    await expect(auth.getAuthClient()).rejects.toThrow('Not authenticated')
    expect(auth.isAuthenticated).toBe(false)
  })
  it('treats inaccessible token caches as unavailable tokens', async () => {
    const cache = c.feature('diskCache')
    ;(cache.has as Mock<any>).mockRejectedValue(new Error('cache unavailable'))
    expect(await auth.tryRestoreTokens()).toBe(false)
  })
  it('restores refresh tokens and authenticated user metadata', async () => {
    const cache = c.feature('diskCache')
    ;(cache.has as Mock<any>).mockResolvedValue(true)
    ;(cache.get as Mock<any>).mockResolvedValue('fake-refresh-token')
    const client = auth.getOAuth2Client() as unknown as AsyncOAuthClient
    const expiry = Date.now() + 3600000
    track(spyOn(client, 'refreshAccessToken').mockResolvedValue({ credentials: { access_token: 'fake-access-token', expiry_date: expiry } } as any))
    track(spyOn(client, 'request').mockResolvedValue({ data: { email: 'tester@example.test' } } as any))
    const authenticated = mock(() => {}); auth.on('authenticated', authenticated)
    expect(await auth.tryRestoreTokens()).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.state.get('email')).toBe('tester@example.test')
    expect(auth.state.get('tokenExpiry')).toBe(new Date(expiry).toISOString())
    expect(authenticated).toHaveBeenCalledWith({ mode: 'oauth2', email: 'tester@example.test' })
    expect(await auth.getAuthClient()).toBe(auth.getOAuth2Client())
  })
  it('restores authentication even when optional profile retrieval fails', async () => {
    const cache = c.feature('diskCache')
    ;(cache.has as Mock<any>).mockResolvedValue(true); (cache.get as Mock<any>).mockResolvedValue('fake-token')
    const client = auth.getOAuth2Client() as unknown as AsyncOAuthClient
    track(spyOn(client, 'refreshAccessToken').mockResolvedValue({ credentials: {} } as any))
    track(spyOn(client, 'request').mockRejectedValue(new Error('profile scope missing')))
    expect(await auth.tryRestoreTokens()).toBe(true)
    expect(auth.state.get('email')).toBeUndefined()
  })
  it('refreshes near-expiry credentials and emits refreshed metadata', async () => {
    auth.setState({ isAuthenticated: true, authMode: 'oauth2', tokenExpiry: new Date(Date.now() - 1000).toISOString() })
    const client = auth.getOAuth2Client() as unknown as AsyncOAuthClient; const expiry = Date.now() + 3600000
    const refresh = track(spyOn(client, 'refreshAccessToken').mockResolvedValue({ credentials: { access_token: 'new-test-token', expiry_date: expiry } } as any))
    const refreshed = mock(() => {}); auth.on('tokenRefreshed', refreshed)
    expect(await auth.getAuthClient()).toBe(auth.getOAuth2Client())
    expect(refresh).toHaveBeenCalledTimes(1); expect(refreshed).toHaveBeenCalledTimes(1)
    expect(auth.state.get('tokenExpiry')).toBe(new Date(expiry).toISOString())
  })
  it('clears authenticated state when token refresh fails', async () => {
    auth.setState({ isAuthenticated: true, authMode: 'oauth2', tokenExpiry: new Date(0).toISOString() })
    const error = new Error('refresh revoked')
    track(spyOn(auth.getOAuth2Client() as unknown as AsyncOAuthClient, 'refreshAccessToken').mockRejectedValue(error))
    const failed = mock(() => {}); auth.on('error', failed)
    await expect(auth.getAuthClient()).rejects.toBe(error)
    expect(auth.isAuthenticated).toBe(false); expect(auth.state.get('lastError')).toBe(error.message)
    expect(failed).toHaveBeenCalledWith(error)
  })
  it('revocation clears local state even if remote revocation fails', async () => {
    auth.setState({ isAuthenticated: true, authMode: 'oauth2', email: 'tester@example.test', scopes: ['scope'] })
    const client = auth.getOAuth2Client() as unknown as AsyncOAuthClient
    track(spyOn(client, 'revokeCredentials').mockRejectedValue(new Error('offline')))
    expect(await auth.revoke()).toBe(auth)
    expect(auth.isAuthenticated).toBe(false); expect(auth.state.get('authMode')).toBe('none')
    expect(auth.state.get('scopes')).toEqual([]); expect(auth.state.get('email')).toBeUndefined()
    expect(c.feature('diskCache').rm).toHaveBeenCalledWith(auth.tokenCacheKey)
    expect(auth.getOAuth2Client()).not.toBe(client)
  })
  it('reports missing service-account keys and failed restoration', async () => {
    const service = c.feature('googleAuth', { mode: 'service-account' })
    await expect(service.authenticateServiceAccount()).rejects.toThrow('Service account key required')
    expect(service.state.get('lastError')).toContain('Service account key required')
    expect(await service.tryRestoreTokens()).toBe(false)
  })
  it('authenticates a service account through its token boundary', async () => {
    const service = c.feature('googleAuth', { serviceAccountKey: { type: 'service_account', client_email: 'test@example.test', private_key: 'test-only-not-a-real-key' }, scopes: ['scope'] })
    service.setState({ isAuthenticated: true, authMode: 'service-account' })
    const client = await service.getAuthClient()
    const token = track(spyOn(Object.getPrototypeOf(client), 'getAccessToken').mockResolvedValue({ token: 'fake-token' }))
    service.state.set('isAuthenticated', false)
    expect(await service.authenticateServiceAccount()).toBe(service)
    expect(service.isAuthenticated).toBe(true)
    expect(service.state.get('email')).toBe('test@example.test')
    expect(service.state.get('scopes')).toEqual(['scope'])
    token.mockResolvedValue(null)
    await expect(service.authenticateServiceAccount()).rejects.toThrow('Failed to obtain access token')
  })
  describe('OAuth callback lifecycle', () => {
    let callback: (request: Request) => Response
    let stop: ReturnType<typeof mock>
    let timeoutCallback: () => void
    let clear: Mock<typeof clearTimeout>
    let token: Mock<any>
    let open: Mock<any>
    beforeEach(() => {
      stop = mock(() => {})
      track(spyOn(Bun, 'serve').mockImplementation(((options: any) => {
        callback = options.fetch
        return { stop }
      }) as any))
      const actualTimeout = globalThis.setTimeout
      track(spyOn(globalThis, 'setTimeout').mockImplementation(((fn: () => void, ms: number, ...args: any[]) => {
        if (ms === 300000) { timeoutCallback = fn; return 123456789 }
        return actualTimeout(fn, ms, ...args)
      }) as any))
      clear = track(spyOn(globalThis, 'clearTimeout'))
      const prototype = Object.getPrototypeOf(auth.getOAuth2Client()) as AsyncOAuthClient
      token = track(spyOn(prototype, 'getToken').mockImplementation(async () => ({ tokens: { access_token: 'fake-access', refresh_token: 'fake-refresh', expiry_date: Date.now() + 3600000 } })) as Mock<any>)
      track(spyOn(prototype, 'request').mockResolvedValue({ data: { email: 'tester@example.test' } }))
      track(spyOn(c.feature('diskCache'), 'set').mockResolvedValue(undefined as any))
      open = track(spyOn(c.feature('opener'), 'open').mockImplementation(async () => {
        expect(callback(new Request('http://localhost/oauth2callback?code=test-code')).status).toBe(200)
      }))
    })
    it('exchanges the callback code, stores refresh credentials and releases server and timeout', async () => {
      const required = mock((_url: string) => {}); auth.on('authorizationRequired', required)
      expect(await auth.authorize(['scope-a'])).toBe(auth)
      expect(auth.isAuthenticated).toBe(true)
      expect(auth.state.get('scopes')).toEqual(['scope-a'])
      expect(c.feature('diskCache').set).toHaveBeenCalledWith(auth.tokenCacheKey, 'fake-refresh')
      expect(token).toHaveBeenCalledWith('test-code')
      const url = new URL(String(required.mock.calls[0]?.[0]))
      expect(url.searchParams.get('access_type')).toBe('offline')
      expect(url.searchParams.get('prompt')).toBe('consent')
      expect(url.searchParams.get('scope')).toBe('scope-a')
      expect(stop).toHaveBeenCalledTimes(1)
      expect(clear).toHaveBeenCalledWith(123456789)
    })
    it.each([['?error=access_denied', 'authorization denied'], ['', 'No authorization code']])('rejects callback %s and releases resources', async (query, message) => {
      open.mockImplementation(async () => { callback(new Request('http://localhost/oauth2callback' + query)) })
      await expect(auth.authorize()).rejects.toThrow(message)
      expect(auth.isAuthenticated).toBe(false)
      expect(token).not.toHaveBeenCalled()
      expect(stop).toHaveBeenCalledTimes(1)
      expect(clear).toHaveBeenCalledWith(123456789)
    })
    it('ignores unrelated routes before receiving the callback', async () => {
      open.mockImplementation(async () => {
        expect(callback(new Request('http://localhost/unrelated')).status).toBe(404)
        callback(new Request('http://localhost/oauth2callback?code=test-code'))
      })
      await auth.authorize()
      expect(auth.isAuthenticated).toBe(true)
    })
    it('times out abandoned authorization and closes the callback server', async () => {
      open.mockImplementation(async () => { timeoutCallback() })
      await expect(auth.authorize()).rejects.toThrow('timed out')
      expect(stop).toHaveBeenCalledTimes(1)
      expect(clear).toHaveBeenCalledWith(123456789)
    })
    it('closes the server and records token exchange failure', async () => {
      token.mockRejectedValue(new Error('invalid code'))
      await expect(auth.authorize()).rejects.toThrow('invalid code')
      expect(auth.state.get('lastError')).toBe('invalid code')
      expect(stop).toHaveBeenCalledTimes(1)
      expect(clear).toHaveBeenCalledWith(123456789)
    })
  })

})
