import type { ContainerState } from '@/container'
import { type NodeFeatures, NodeContainer } from '@/node/container'
import '@/introspection/generated.agi.js'
import { OpenAIClient } from '@/agi/openai-client'
import { Identity } from './features/identity'
import { HelperChat } from './features/helper-chat'
import { ContainerChat } from './features/container-chat'
import { Snippets } from './features/snippets'
import { ClaudeCode } from './features/claude-code'
import { OpenAICodex } from './features/openai-codex'
import { Conversation } from './features/conversation'
import { Expert } from './features/expert'
import { Oracle } from './features/oracle'
import { Planner } from './features/planner'
import { Crew } from './features/crew'
import { SkillsLibrary } from './features/skills-library'

import type { ContentDb } from '@/node/features/content-db'
import type { ExpressServer } from '@/servers/express'

/**
 * AGI-specific container that extends NodeContainer with AI capabilities including
 * identity management, OpenAI conversations, code generation, and self-modifying agent features.
 */
export class AGIContainer extends NodeContainer {
	identity!: Identity
	openai!: OpenAIClient
	snippets!: Snippets
	claudeCode?: ClaudeCode
	openaiCodex?: OpenAICodex
	planner?: Planner
	crew?: Crew
	skillsLibrary?: SkillsLibrary
	docs!: ContentDb

	async startAPI(options: { port?: number; staticDir?: string; endpointsDir?: string } = {}): Promise<ExpressServer> {
		const expressServer = this.server('express', {
			port: options.port || 3000,
			cors: true,
			static: options.staticDir || this.paths.resolve('public'),
		}) as ExpressServer

		const endpointsDir = options.endpointsDir || this.paths.resolve('src/agi/endpoints')
		await expressServer.useEndpoints(endpointsDir)
		expressServer.serveOpenAPISpec({
			title: 'Luca AGI API',
			version: '1.0.0',
			description: 'AGI container endpoints',
		})
		await expressServer.start({ port: options.port || 3000 })

		return expressServer
	}
}

const container = new AGIContainer()
	.use(OpenAIClient)
	.use(Identity)
	.use(HelperChat)
	.use(ContainerChat)
	.use(Snippets)
	.use(ClaudeCode)
	.use(OpenAICodex)
	.use(Conversation)
	.use(Expert)
	.use(Oracle)
	.use(Planner)
	.use(Crew)
	.use(SkillsLibrary)

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