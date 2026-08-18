import { describe, it, expect, afterEach } from 'bun:test'
import { McpBridge } from '../src/agi/features/mcp-bridge'
import { AGIContainer } from '../src/agi/container.server'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createTestMcpServer } from './fixtures/mcp-test-server-core'

// Path to a tiny MCP server used for testing (ships with the SDK examples)
const TEST_SERVER_SCRIPT = new URL('./fixtures/mcp-test-server.ts', import.meta.url).pathname

describe('McpBridge', () => {
	let bridge: InstanceType<typeof McpBridge> | undefined

	afterEach(async () => {
		if (bridge) {
			await bridge.disconnectAll()
			bridge = undefined
		}
	})

	describe('registration', () => {
		it('is registered in the AGI container', () => {
			const c = new AGIContainer()
			expect(c.features.has('mcpBridge')).toBe(true)
		})

		it('can be instantiated with default options', () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge')
			expect(bridge).toBeInstanceOf(McpBridge)
		})
	})

	describe('connectAll', () => {
		it('connects to a stdio MCP server and discovers tools', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()

			expect(bridge.connectedServers).toContain('test')
			const server = bridge.getServer('test')
			expect(server).toBeDefined()
			expect(server!.tools.length).toBeGreaterThan(0)
		}, 15_000)

		it('discovers tools with correct schemas', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()

			const server = bridge.getServer('test')!
			const echoTool = server.tools.find(t => t.name === 'echo')
			expect(echoTool).toBeDefined()
			expect(echoTool!.inputSchema).toBeDefined()
			expect(echoTool!.inputSchema.type).toBe('object')
		}, 15_000)

		it('updates state with connection status', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()

			const servers = bridge.state.get('servers') as Record<string, any>
			expect(servers.test).toBeDefined()
			expect(servers.test.status).toBe('connected')
			expect(servers.test.toolCount).toBeGreaterThan(0)
		}, 15_000)

		it('handles connection failures gracefully', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					broken: {
						command: 'nonexistent-binary-that-does-not-exist',
						args: [],
					},
				},
			})

			// Should not throw — partial connectivity is allowed
			await bridge.connectAll()

			const servers = bridge.state.get('servers') as Record<string, any>
			expect(servers.broken.status).toBe('error')
			expect(servers.broken.error).toBeDefined()
		}, 15_000)
	})

	describe('include/exclude filters', () => {
		it('filters tools by include pattern', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
						include: ['echo'],
					},
				},
			})

			await bridge.connectAll()

			const server = bridge.getServer('test')!
			expect(server.tools.length).toBe(1)
			expect(server.tools[0]!.name).toBe('echo')
		}, 15_000)

		it('filters tools by exclude pattern', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
						exclude: ['echo'],
					},
				},
			})

			await bridge.connectAll()

			const server = bridge.getServer('test')!
			expect(server.tools.every(t => t.name !== 'echo')).toBe(true)
		}, 15_000)
	})

	describe('generic tool handlers', () => {
		it('listMcpCapabilities returns connected server info', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()

			const result = await bridge.listMcpCapabilities({})
			expect(result.test).toBeDefined()
			expect(result.test.status).toBe('connected')
			expect(result.test.tools.length).toBeGreaterThan(0)
		}, 15_000)

		it('listMcpCapabilities filters by server name', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()

			const result = await bridge.listMcpCapabilities({ server: 'nonexistent' })
			expect(result.error).toBeDefined()
		}, 15_000)

		it('useMcpTool calls a tool and returns the result', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()

			const result = await bridge.useMcpTool({
				server: 'test',
				tool: 'echo',
				arguments: JSON.stringify({ message: 'hello from bridge' }),
			})

			expect(result).toContain('hello from bridge')
		}, 15_000)

		it('useMcpTool returns error for unknown server', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', { servers: {} })
			await bridge.connectAll()

			const result = await bridge.useMcpTool({ server: 'nope', tool: 'echo' })
			expect(result.error).toBeDefined()
		}, 15_000)
	})

	describe('materialized tools', () => {
		it('allTools returns prefixed tool entries', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()

			const all = bridge.allTools
			expect(all.length).toBeGreaterThan(0)
			expect(all[0]!.materializedName).toMatch(/^test__/)
			expect(all[0]!.server).toBe('test')
		}, 15_000)

		it('toTools includes generic bridge tools', () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', { servers: {} })

			const { schemas, handlers } = bridge.toTools()
			expect(schemas.listMcpCapabilities).toBeDefined()
			expect(schemas.useMcpTool).toBeDefined()
			expect(schemas.readMcpResource).toBeDefined()
			expect(schemas.getMcpPrompt).toBeDefined()
			expect(handlers.listMcpCapabilities).toBeDefined()
			expect(handlers.useMcpTool).toBeDefined()
		})
	})

	describe('disconnection', () => {
		it('disconnectAll cleans up connections', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()
			expect(bridge.connectedServers.length).toBe(1)

			await bridge.disconnectAll()
			expect(bridge.connectedServers.length).toBe(0)

			const servers = bridge.state.get('servers') as Record<string, any>
			expect(servers.test.status).toBe('disconnected')
		}, 15_000)

		it('disconnectServer removes a single server', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					test: {
						command: 'bun',
						args: ['run', TEST_SERVER_SCRIPT],
					},
				},
			})

			await bridge.connectAll()
			await bridge.disconnectServer('test')
			expect(bridge.connectedServers.length).toBe(0)
		}, 15_000)
	})

	describe('http transport', () => {
		let httpServer: ReturnType<typeof createServer> | undefined
		let seenAuthHeaders: Array<string | undefined> = []

		afterEach(async () => {
			// The bridge client is still connected here (its afterEach runs later),
			// so force keep-alive sockets closed or close() never resolves
			httpServer?.closeAllConnections()
			await new Promise<void>(resolve => httpServer ? httpServer.close(() => resolve()) : resolve())
			httpServer = undefined
			seenAuthHeaders = []
		})

		/** Stateless Streamable HTTP host: fresh server + transport per request. */
		async function startHttpMcpServer(): Promise<string> {
			httpServer = createServer(async (req, res) => {
				seenAuthHeaders.push(req.headers.authorization)
				const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
				const server = createTestMcpServer()
				await server.connect(transport)
				res.on('close', () => { transport.close(); server.close() })
				await transport.handleRequest(req, res)
			})
			await new Promise<void>(resolve => httpServer!.listen(0, resolve))
			const port = (httpServer!.address() as AddressInfo).port
			return `http://localhost:${port}/mcp`
		}

		it('connects to a url server over Streamable HTTP and calls tools', async () => {
			const url = await startHttpMcpServer()
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', {
				servers: {
					remote: { url, headers: { Authorization: 'Bearer sekrit' } },
				},
			})

			await bridge.connectAll()

			expect(bridge.connectedServers).toContain('remote')
			expect(bridge.getServer('remote')!.tools.map(t => t.name)).toContain('echo')

			const result = await bridge.useMcpTool({ server: 'remote', tool: 'add', arguments: '{"a":2,"b":3}' })
			expect(result).toBe('5')

			// Config headers ride on every request
			expect(seenAuthHeaders.length).toBeGreaterThan(0)
			expect(seenAuthHeaders.every(h => h === 'Bearer sekrit')).toBe(true)
		}, 15_000)

		it('rejects a server config with neither command nor url', async () => {
			const c = new AGIContainer()
			bridge = c.feature('mcpBridge', { servers: { broken: {} as any } })

			await bridge.connectAll() // swallows per-server failures

			expect(bridge.connectedServers).not.toContain('broken')
			const servers = bridge.state.get('servers') as Record<string, any>
			expect(servers.broken.status).toBe('error')
			expect(servers.broken.error).toContain('command')
		})
	})
})
