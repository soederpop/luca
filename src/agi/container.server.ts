import type { ContainerState } from '@/container'
import { type NodeFeatures, NodeContainer } from '@/node/container'
import '@/introspection/generated.agi.js'
import { OpenAIClient } from '@/agi/openai-client'
import { Identity } from './features/identity'
import { HelperChat } from './features/helper-chat'
import { ContainerChat } from './features/container-chat'
import { Snippets } from './features/snippets'
import { ClaudeCode } from './features/claude-code'
import { Conversation } from './features/conversation'
import { Expert } from './features/expert'

import type { ContentDb } from '@/node/features/content-db'

export class AGIContainer extends NodeContainer {
	identity!: Identity
	openai!: OpenAIClient
	snippets!: Snippets
	claudeCode?: ClaudeCode
	docs!: ContentDb
}

const container = new AGIContainer()
	.use(OpenAIClient)
	.use(Identity)
	.use(HelperChat)
	.use(ContainerChat)
	.use(Snippets)
	.use(ClaudeCode)
	.use(Conversation)
	.use(Expert)

container.docs = container.feature('contentDb', {
	rootPath: container.paths.resolve('docs')
})

container.docs.defineModel(({ defineModel, section, toString }: any) => {
	const { z } = container
	const Idea = defineModel('Idea', {
		meta: z.object({
			stage: z.string(),
			term: z.enum(['short', 'medium', 'long']).default('long'),
		})
	})

	container.docs.collection.register(Idea)

	return Idea
})

const { z } = container

export default container