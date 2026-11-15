import { describe, it, expect, afterEach } from 'bun:test'
import { z } from 'zod'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { AGIContainer } from '../src/agi/container.server'

describe('MCPServer.requestHandler', () => {
	let httpServer: ReturnType<typeof createServer> | undefined
	let bridge: any
	let mcp: any

	afterEach(async () => {
		if (bridge) { await bridge.disconnectAll(); bridge = undefined }
		if (mcp) { await mcp.stop(); mcp = undefined }
		httpServer?.closeAllConnections()
		await new Promise<void>(resolve => httpServer ? httpServer.close(() => resolve()) : resolve())
		httpServer = undefined
	})

	async function host(options: { preParse: boolean }) {
		const c = new AGIContainer()
		mcp = c.server('mcp', { serverName: 'mounted' })
		mcp.tool('add', {
			schema: z.object({ a: z.number(), b: z.number() }),
			description: 'Add two numbers',
			handler: async ({ a, b }: { a: number; b: number }) => String(a + b),
		})
		const handle = await mcp.requestHandler()

		httpServer = createServer(async (req: any, res) => {
			if (!req.url?.startsWith('/custom/mcp')) { res.writeHead(404); res.end(); return }
			if (options.preParse && req.method === 'POST') {
				// Mimic express.json: drain the stream and flag the body as parsed.
				const chunks: Buffer[] = []
				for await (const chunk of req) chunks.push(chunk as Buffer)
				req.body = JSON.parse(Buffer.concat(chunks).toString())
				req._body = true
			}
			await handle(req, res)
		})
		await new Promise<void>(resolve => httpServer!.listen(0, resolve))
		const port = (httpServer!.address() as AddressInfo).port
		bridge = c.feature('mcpBridge', { servers: { mounted: { url: `http://localhost:${port}/custom/mcp` } } })
		await bridge.connectAll()
	}

	it('serves tools on a host-chosen path without opening its own port', async () => {
		await host({ preParse: false })
		expect(bridge.connectedServers).toContain('mounted')
		expect(await bridge.useMcpTool({ server: 'mounted', tool: 'add', arguments: '{"a":2,"b":3}' })).toBe('5')
		expect(mcp.state.get('listening')).toBe(false)
	}, 15_000)

	it('accepts a body the host already parsed', async () => {
		await host({ preParse: true })
		expect(await bridge.useMcpTool({ server: 'mounted', tool: 'add', arguments: '{"a":4,"b":5}' })).toBe('9')
	}, 15_000)

	it('closes open sessions on stop', async () => {
		await host({ preParse: false })
		expect(mcp._httpSessions.size).toBe(1)
		await mcp.stop()
		expect(mcp._httpSessions.size).toBe(0)
		mcp = undefined
	}, 15_000)
})
