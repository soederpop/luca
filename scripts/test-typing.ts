import container from "../src/node"
import { OpenAIClient } from "../src/ai/openai-client"

// Use container.use() for the OpenAI client
container.use(OpenAIClient)

const openai = container.client("openai", {
	apiKey: process.env.OPENAI_API_KEY
})

// TypeScript should now correctly infer that openai is of type OpenAIClient
// This means all these methods should be properly typed:

async function testTyping() {
	// Method from OpenAIClient - should work
	const response = await openai.ask("Hello!")
	
	// Another method from OpenAIClient - should work  
	const models = await openai.listModels()
	
	// Access to state (from Client base class) - should work
	const connected = openai.isConnected
	
	// Method specific to OpenAI - should work
	const embeddings = await openai.createEmbedding("test")
	
	console.log("All methods are properly typed!")
}

testTyping().catch(console.error) 