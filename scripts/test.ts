import container from "../src/node"
import { OpenAIClient } from "../src/ai/openai-client"

// Use container.use() which works for anything with an attach method
container.use(OpenAIClient)

const openai = container.client("openai", {
	apiKey: process.env.OPENAI_API_KEY
})

async function main() {
	console.log(container.feature('proc'))
}

main()
