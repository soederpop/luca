import container from "../src/node"
import { OpenAIClient } from "../src/ai/openai-client"
import { McpServer } from "../src/servers/mcp"

// Use container.use() which works for anything with an attach method
container
.use(OpenAIClient)
.use(McpServer)

const openai = container.client("openai", {
	apiKey: process.env.OPENAI_API_KEY
})

async function main() {
	const mcp = container.server("mcp")
	
	await mcp.start()
}

main()
