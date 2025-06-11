import container, { ui } from '@/node'
import '@/introspection/generated'
import { McpServer } from '@/servers/mcp'

container.use(McpServer)

const server = container.server('mcp', {
	serverName: 'Luca MCP',
	version: '0.0.1',
	instructions: ''  
})

async function main() {
	setup()
	await server.start()
	console.log(container.cwd)
	console.log(container.paths.resolve('src'))

}

main()

function setup() {
	server.resource("available-features", new server.ResourceTemplate("features://available", {
		list: undefined
	}), () => ({
		contents: [{
			uri: "features://available",
			text: `The following features are available: ${container.features.available.join(', ')}` 
		}]
	}))
}

