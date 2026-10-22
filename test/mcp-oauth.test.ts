import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { mkdtempSync, rmSync, statSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { AGIContainer } from '../src/agi/container.server'
import { McpAuthRequiredError } from '../src/agi/features/mcp-bridge'
import { McpOAuthProvider, mcpOAuthKey, mcpOAuthStore } from '../src/agi/features/mcp-oauth'
import { createTestMcpServer } from './fixtures/mcp-test-server-core'

/**
 * A fake OAuth-protected MCP server: protected resource metadata, an
 * authorization server with dynamic client registration, PKCE-free token
 * endpoint (the bridge still sends a verifier), and a bearer-checked /mcp.
 */
function startOAuthMcpServer(opts: { requireAuth?: boolean } = {}) {
	const requireAuth = opts.requireAuth ?? true
	const valid = new Set<string>()
	const log = { registrations: 0, authorizations: 0, refreshes: 0 }
	let issued = 0
	let base = ''

	const json = (res: any, status: number, body: unknown, headers: Record<string, string> = {}) => {
		res.writeHead(status, { 'content-type': 'application/json', ...headers })
		res.end(JSON.stringify(body))
	}
	const readBody = (req: any) => new Promise<string>(resolve => {
		let data = ''
		req.on('data', (c: Buffer) => { data += c })
		req.on('end', () => resolve(data))
	})

	const server = createServer(async (req, res) => {
		const url = new URL(req.url!, base)
		if (url.pathname.startsWith('/.well-known/oauth-protected-resource')) {
			return json(res, 200, { resource: `${base}/mcp`, authorization_servers: [base] })
		}
		if (url.pathname === '/.well-known/oauth-authorization-server') {
			return json(res, 200, {
				issuer: base,
				authorization_endpoint: `${base}/authorize`,
				token_endpoint: `${base}/token`,
				registration_endpoint: `${base}/register`,
				response_types_supported: ['code'],
				grant_types_supported: ['authorization_code', 'refresh_token'],
				code_challenge_methods_supported: ['S256'],
				token_endpoint_auth_methods_supported: ['none'],
			})
		}
		if (url.pathname === '/register') {
			log.registrations++
			const body = JSON.parse(await readBody(req))
			return json(res, 201, { ...body, client_id: `client-${log.registrations}` })
		}
		if (url.pathname === '/authorize') {
			log.authorizations++
			const redirect = new URL(url.searchParams.get('redirect_uri')!)
			redirect.searchParams.set('code', 'code-1')
			redirect.searchParams.set('state', url.searchParams.get('state') || '')
			res.writeHead(302, { location: redirect.toString() })
			return res.end()
		}
		if (url.pathname === '/token') {
			const form = new URLSearchParams(await readBody(req))
			const access_token = `at-${++issued}`
			valid.add(access_token)
			if (form.get('grant_type') === 'refresh_token') {
				log.refreshes++
				// No refresh_token in the response: the client must keep the old one.
				return json(res, 200, { access_token, token_type: 'Bearer', expires_in: 3600 })
			}
			return json(res, 200, { access_token, refresh_token: 'rt-1', token_type: 'Bearer', expires_in: 3600 })
		}
		if (url.pathname === '/mcp') {
			const token = req.headers.authorization?.replace(/^Bearer /, '')
			if (requireAuth && (!token || !valid.has(token))) {
				return json(res, 401, { error: 'invalid_token' }, {
					'www-authenticate': `Bearer resource_metadata="${base}/.well-known/oauth-protected-resource"`,
				})
			}
			const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
			const mcp = createTestMcpServer()
			await mcp.connect(transport)
			res.on('close', () => { transport.close(); mcp.close() })
			return transport.handleRequest(req, res)
		}
		res.writeHead(404).end()
	})

	return new Promise<{ url: string; log: typeof log; valid: Set<string>; close: () => Promise<void> }>(resolve => {
		server.listen(0, () => {
			base = `http://localhost:${(server.address() as AddressInfo).port}`
			resolve({
				url: `${base}/mcp`,
				log,
				valid,
				close: () => {
					server.closeAllConnections()
					return new Promise<void>(r => server.close(() => r()))
				},
			})
		})
	})
}

describe('mcpBridge OAuth', () => {
	let home: string
	let fake: Awaited<ReturnType<typeof startOAuthMcpServer>>
	let bridges: any[] = []
	let browserOpens = 0

	/** A container whose machine-scoped store lives in a temp home, with a scripted "browser". */
	function makeContainer() {
		const c = new AGIContainer()
		Object.defineProperty(c.feature('os'), 'homedir', { get: () => home, configurable: true })
		;(c.feature('opener') as any).open = async (target: string) => {
			browserOpens++
			// Play the user: follow /authorize to its redirect, which hits the bridge's callback.
			const r = await fetch(target, { redirect: 'manual' })
			await fetch(r.headers.get('location')!)
		}
		return c
	}

	function makeBridge(c = makeContainer(), extra: Record<string, any> = {}) {
		const bridge = c.feature('mcpBridge', { servers: { remote: { url: fake.url, ...extra } } }) as any
		bridges.push(bridge)
		return bridge
	}

	beforeEach(async () => {
		home = mkdtempSync(join(tmpdir(), 'luca-mcp-oauth-'))
		fake = await startOAuthMcpServer()
		browserOpens = 0
	})

	afterEach(async () => {
		for (const b of bridges) await b.disconnectAll()
		bridges = []
		await fake.close()
		rmSync(home, { recursive: true, force: true })
	})

	it('marks an unauthenticated OAuth server auth-required without opening a browser', async () => {
		const bridge = makeBridge()
		const errors: string[] = []
		bridge.on('serverError', (_: string, msg: string) => errors.push(msg))

		await bridge.connectAll()

		expect(bridge.connectedServers).not.toContain('remote')
		expect(bridge.state.get('servers').remote.status).toBe('auth-required')
		expect(errors[0]).toContain('luca mcp-auth login remote')
		expect(browserOpens).toBe(0)
		expect(fake.log.authorizations).toBe(0)
	}, 15_000)

	it('throws McpAuthRequiredError from connectServer', async () => {
		const bridge = makeBridge()
		await expect(bridge.connectServer('remote', { url: fake.url, args: [] })).rejects.toBeInstanceOf(McpAuthRequiredError)
	}, 15_000)

	it('logs in through the browser, stores tokens 0600, and calls tools', async () => {
		const bridge = makeBridge()
		const results = await bridge.login('remote')

		expect(results.remote.status).toBe('connected')
		expect(browserOpens).toBe(1)
		expect(fake.log.registrations).toBe(1)
		expect(await bridge.useMcpTool({ server: 'remote', tool: 'add', arguments: '{"a":2,"b":3}' })).toBe('5')

		const store = mcpOAuthStore(bridge.container)
		const entry = (await store.read()).servers[mcpOAuthKey(fake.url)]
		expect(entry.tokens.access_token).toBe('at-1')
		expect(entry.tokens.refresh_token).toBe('rt-1')
		expect(entry.clientInformation.client_id).toBe('client-1')
		expect(statSync(store.path).mode & 0o777).toBe(0o600)
	}, 15_000)

	it('reuses a stored login in a later process without a browser', async () => {
		await makeBridge().login('remote')
		browserOpens = 0

		const second = makeBridge()
		await second.connectAll()

		expect(second.connectedServers).toContain('remote')
		expect(browserOpens).toBe(0)
		expect(fake.log.registrations).toBe(1)
	}, 15_000)

	it('refreshes an expired token and keeps the refresh token the server did not resend', async () => {
		await makeBridge().login('remote')
		fake.valid.clear() // every issued access token is now rejected

		const second = makeBridge()
		await second.connectAll()

		expect(second.connectedServers).toContain('remote')
		expect(fake.log.refreshes).toBe(1)
		expect(browserOpens).toBe(1) // only the original login
		const entry = (await mcpOAuthStore(second.container).read()).servers[mcpOAuthKey(fake.url)]
		expect(entry.tokens.access_token).toBe('at-2')
		expect(entry.tokens.refresh_token).toBe('rt-1')
	}, 15_000)

	it('logout forgets the login', async () => {
		const bridge = makeBridge()
		await bridge.login('remote')
		await bridge.logout('remote')

		expect((await bridge.authStatus()).remote.loggedIn).toBe(false)
		const again = makeBridge()
		await again.connectAll()
		expect(again.state.get('servers').remote.status).toBe('auth-required')
	}, 15_000)

	it('skips OAuth when the config sends its own Authorization header', async () => {
		const bridge = makeBridge(undefined, { headers: { Authorization: 'Bearer nope' } })
		await bridge.connectAll()
		expect(bridge.state.get('servers').remote.status).toBe('error')
		expect(fake.log.registrations).toBe(0)
	}, 15_000)

	it('leaves no store file for an http server that never asks for auth', async () => {
		await fake.close()
		fake = await startOAuthMcpServer({ requireAuth: false })
		const bridge = makeBridge()
		await bridge.connectAll()

		expect(bridge.connectedServers).toContain('remote')
		expect(existsSync(mcpOAuthStore(bridge.container).path)).toBe(false)
	}, 15_000)

	it('does not erase tokens another process saved after a failed refresh', async () => {
		const c = makeContainer()
		const provider = new McpOAuthProvider(c as any, { serverName: 'remote', serverUrl: fake.url, interactive: false })
		await provider.saveTokens({ access_token: 'old', token_type: 'Bearer', refresh_token: 'r-old' })
		await provider.tokens() // this process read "old"

		// Another process wins a refresh race and stores new tokens.
		const other = new McpOAuthProvider(makeContainer() as any, { serverName: 'remote', serverUrl: fake.url, interactive: false })
		await other.saveTokens({ access_token: 'new', token_type: 'Bearer', refresh_token: 'r-new' })

		// Our refresh with r-old got invalid_grant; the SDK asks us to drop tokens.
		await provider.invalidateCredentials('tokens')
		expect((await provider.tokens())?.access_token).toBe('new')

		// With nothing newer on disk, the same call does clear them.
		await provider.invalidateCredentials('tokens')
		expect(await provider.tokens()).toBeUndefined()
	})
})

describe('mcpBridge skipServers', () => {
	it('leaves named servers out of the merged config', async () => {
		const c = new AGIContainer()
		const bridge = c.feature('mcpBridge', {
			servers: { keep: { url: 'http://localhost:1/mcp' }, drop: { command: 'nope' } },
			skipServers: ['drop'],
		}) as any
		expect(Object.keys(await bridge.loadServerConfigs())).toEqual(['keep'])
	})
})
