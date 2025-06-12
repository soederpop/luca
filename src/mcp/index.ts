import container, { ui } from '@/node'
import '@/introspection/generated'
import { McpServer } from '@/servers/mcp'
import { __INTROSPECTION__ } from '@/introspection'

container.use(McpServer)

const INSTRUCTIONS = `
# LUCA MCP

Luca MCP allows you to interact with a batteries included container object in typescript that has a lot of features
that can be used to develop and run software for the purposes of gathering data to power itself. 

What is a Luca container? It is a single global process that runs inside the context of a project folder on a Mac machine,
it is a Bun typescript process.  The container has various features available to it such as:

- proc
- fs
- fileManager
- git
- downloader
- ipc-socket
- port-exposer
- python
- vault
- vm

It also has a global state machine, and an event bus.

Each of these features provide access to a subset of functions and can be composed together to run programs.

The container is running inside of the process that is running this MCP server.
`

const server = container.server('mcp', {
	serverName: 'Luca MCP',
	version: '0.0.1',
	instructions: INSTRUCTIONS  
})

const { z } = server

async function main() {
	setup()
	await server.start()
}

main()

function setup() {
	server.tool("evaluate_code", server.z.object({
		code: server.z.string().describe("JavaScript Code to run inside the Luca VM, which will have the container available as a variable.")
	}), "Evaluate code in the Luca VM, a typescript runtime that has access to the global container object provided by the luca runtime.", async ({ code }) => {
		const result = await container.features.vm.run(code)

		return {
			content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
		}
	})

	server.resource("docs://introduction", "Introduction to Luca MCP", async() => ({
		uri: "docs://introduction",
		name: "Introduction to Luca MCP",
		mimeType: "text/plain",
		text: INSTRUCTIONS
	}))

	server.resourceTemplate("features://{id}", "Luca VM Feature Documentation", async(uri: any, { id }: any) => {
		const docs = __INTROSPECTION__.get(`features.${id}`)
		return {
			uri: "features://{id}",
			name: "Documentation for " + id,
			mimeType: "text/plain",
			text: JSON.stringify(docs, null, 2)
		}
	})

	server.completion("features://{id}", async (argName: string, argValue: string) => {
		const values : string[] = server.container.features.available
		return values.filter(value => !argValue || argValue === '' || String(value).toLowerCase().startsWith(argValue.toLowerCase()))
	}) 


}

