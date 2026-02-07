import type { ContainerState } from '@/container'
import { type NodeFeatures, NodeContainer } from '@/node/container'
import { OpenAIClient } from '@/agi/openai-client'
import { Identity } from './features/identity'
import { HelperChat } from './features/helper-chat'
import { ContainerChat } from './features/container-chat'
import { Snippets } from './features/snippets'
import { ClaudeCode } from './features/claude-code'
import { Conversation } from './features/conversation'

export class AGIContainer extends NodeContainer {
	identity!: Identity
	openai!: OpenAIClient
	snippets!: Snippets
	claudeCode?: ClaudeCode

	expert(name: string) {
		return this.container.feature('identity', {
			name
		})
	}
}

const container = new AGIContainer()
	.use(OpenAIClient)
	.use(Identity)
	.use(HelperChat)
	.use(ContainerChat)
	.use(Snippets)
	.use(ClaudeCode)
	.use(Conversation)

export default container