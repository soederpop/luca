/**
 * Minimal stdio MCP server for testing the McpBridge feature.
 * The server itself is built in mcp-test-server-core.ts so the HTTP
 * transport tests can reuse it in-process.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createTestMcpServer } from './mcp-test-server-core'

const server = createTestMcpServer()
const transport = new StdioServerTransport()
await server.connect(transport)
