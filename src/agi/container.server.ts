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
import { Oracle } from './features/oracle'
import { Planner } from './features/planner'
import { SkillsLibrary } from './features/skills-library'
import { ConversationHistory } from './features/conversation-history'

import type { ContentDb } from '@/node/features/content-db'

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
	skillsLibrary?: SkillsLibrary
	conversationHistory?: ConversationHistory
	docs!: ContentDb

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
	.use(Oracle)
	.use(Planner)
	.use(SkillsLibrary)
	.use(ConversationHistory)

container.docs = container.feature('contentDb', {
	rootPath: container.paths.resolve('docs')
})

const { z } = container

export default container