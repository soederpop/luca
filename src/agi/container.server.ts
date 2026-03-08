import type { ContainerState } from '../container'
import { type NodeFeatures, NodeContainer } from '../node/container'
import '@/introspection/generated.agi.js'
import { OpenAIClient } from '../clients/openai'
import { ElevenLabsClient } from '../clients/elevenlabs'
import { ClaudeCode } from './features/claude-code'
import { OpenAICodex } from './features/openai-codex'
import { Conversation } from './features/conversation'
import { SkillsLibrary } from './features/skills-library'
import { ConversationHistory } from './features/conversation-history'
import { Assistant } from './features/assistant'
import { AssistantsManager } from './features/assistants-manager'
import { SemanticSearch } from '@soederpop/luca/node/features/semantic-search'
import { ContentDb } from '@soederpop/luca/node/features/content-db'

import type { ConversationTool } from './features/conversation'
import type { ZodType } from 'zod'

export {
	ClaudeCode,
	OpenAICodex,
	Conversation,
	SkillsLibrary,
	ConversationHistory,
	Assistant,
	AssistantsManager,
	SemanticSearch,
	ContentDb,
	NodeContainer,
	OpenAIClient,
	ElevenLabsClient,
}

export type {
	ConversationTool,
	ZodType,
	ContainerState,
	NodeFeatures,
}

export interface AGIFeatures extends NodeFeatures {
	conversation: typeof Conversation
	claudeCode: typeof ClaudeCode
	openaiCodex: typeof OpenAICodex
	skillsLibrary: typeof SkillsLibrary
	conversationHistory: typeof ConversationHistory
	assistant: typeof Assistant
	assistantsManager: typeof AssistantsManager
}

export interface ConversationFactoryOptions {
	tools?: {
		handlers: Record<string, ConversationTool['handler']>
		schemas: Record<string, ZodType>
	}
	systemPrompt?: string
	model?: string
	id?: string
	title?: string
	thread?: string
	tags?: string[]
	metadata?: Record<string, any>
}

/**
 * AGI-specific container that extends NodeContainer with AI capabilities including
 * OpenAI conversations, code generation, and self-modifying agent features.
 */
export class AGIContainer<
	Features extends AGIFeatures = AGIFeatures,
	K extends ContainerState = ContainerState
> extends NodeContainer<Features, K> {
	openai!: OpenAIClient
	claudeCode?: ClaudeCode
	openaiCodex?: OpenAICodex
	skillsLibrary?: SkillsLibrary
	conversationHistory?: ConversationHistory
	docs!: ContentDb

	async conversation(options: ConversationFactoryOptions = {}) {
		const tools: Record<string, ConversationTool> = {}

		if (options.tools) {
			for (const [name, schema] of Object.entries(options.tools.schemas)) {
				const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
				tools[name] = {
					handler: options.tools.handlers[name]!,
					description: jsonSchema.description || name,
					parameters: jsonSchema,
				}
			}
		}

		const history = options.systemPrompt
			? [{ role: 'system' as const, content: options.systemPrompt }]
			: undefined

		return this.feature('conversation', {
			tools,
			history,
			model: options.model,
			id: options.id,
			title: options.title,
			thread: options.thread,
			tags: options.tags,
			metadata: options.metadata,
		})
	}
}

const container = new AGIContainer()
	.use(OpenAIClient)
	.use(ElevenLabsClient)
	.use(ClaudeCode)
	.use(OpenAICodex)
	.use(Conversation)
	.use(SkillsLibrary)
	.use(ConversationHistory)
	.use(Assistant)
	.use(AssistantsManager)
	.use(SemanticSearch)

container.docs = container.feature('contentDb', {
	rootPath: container.paths.resolve('docs')
})

export default container