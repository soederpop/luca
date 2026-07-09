import type { ContainerState } from '../container'
import { type NodeFeatures, NodeContainer } from '../node/container'
import '../introspection/generated.agi.js'
import { OpenAIClient } from '../clients/openai'
import { ElevenLabsClient } from '../clients/elevenlabs'
import { VoiceBoxClient } from '../clients/voicebox'
import { ClaudeCode } from './features/claude-code'
import { ClaudeController } from './features/claude-controller'
import { ClaudeSessionController } from './features/claude-session-controller'
import { OpenAICodex } from './features/openai-codex'
import { Conversation } from './features/conversation'
import { ConversationV2 } from './features/conversation-v2'
import { ModelProviders } from './features/model-providers'
import { ConversationHistory } from './features/conversation-history'
import { Assistant } from './features/assistant'
import { AssistantsManager } from './features/assistants-manager'
import { DocsReader } from './features/docs-reader'
import { SkillsLibrary } from './features/skills-library'
import { BrowserUse } from './features/browser-use'
import { SemanticSearch } from '../node/features/semantic-search'
import { ContentDb } from '../node/features/content-db'
import { FileTools } from './features/file-tools'
import { LucaCoder } from './features/luca-coder'
import { Memory } from './features/agent-memory'
import { CodingTools } from './features/coding-tools'
import { McpBridge } from './features/mcp-bridge'
import { VoiceMode } from './features/voice-mode'

import type { ConversationTool } from './features/conversation'
import type { ZodType } from 'zod'

export {
	ClaudeCode,
	ClaudeController,
	ClaudeSessionController,
	OpenAICodex,
	Conversation,
	ConversationV2,
	ModelProviders,
	ConversationHistory,
	Assistant,
	AssistantsManager,
	DocsReader,
	SkillsLibrary,
	BrowserUse,
	FileTools,
	LucaCoder,
	Memory,
	CodingTools,
	McpBridge,
	VoiceMode,
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
	conversationv2: typeof ConversationV2
	modelProviders: typeof ModelProviders
	claudeCode: typeof ClaudeCode
	claudeController: typeof ClaudeController
	openaiCodex: typeof OpenAICodex
	conversationHistory: typeof ConversationHistory
	assistant: typeof Assistant
	assistantsManager: typeof AssistantsManager
	docsReader: typeof DocsReader
	skillsLibrary: typeof SkillsLibrary
	browserUse: typeof BrowserUse
	fileTools: typeof FileTools
	lucaCoder: typeof LucaCoder
	memory: typeof Memory
	codingTools: typeof CodingTools
	mcpBridge: typeof McpBridge
	voiceMode: typeof VoiceMode
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
	claudeController?: ClaudeController
	openaiCodex?: OpenAICodex
	conversationHistory?: ConversationHistory
	conversationv2?: ConversationV2
	modelProviders?: ModelProviders
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
	.use(VoiceBoxClient)
	.use(ClaudeCode)
	.use(ClaudeController)
	.use(OpenAICodex)
	.use(Conversation)
	.use(ConversationV2)
	.use(ModelProviders)
	.use(ConversationHistory)
	.use(Assistant)
	.use(AssistantsManager)
	.use(DocsReader)
	.use(SkillsLibrary)
	.use(BrowserUse)
	.use(FileTools)
	.use(LucaCoder)
	.use(Memory)
	.use(CodingTools)
	.use(McpBridge)
	.use(SemanticSearch)

container.docs = container.feature('contentDb', {
	rootPath: container.paths.resolve('docs')
})

// Seed the VM's virtual module map with the agi barrel so VM-executed project
// code can `import`/`require('luca/agi')`. Inside the compiled binary the
// virtual modules are the only working resolution path (see
// helpers.useNativeImport), and the node-layer seeding in
// features/helpers.ts covers 'luca' and its node-level subpaths but cannot
// reference this layer.
try {
	const vm = container.feature('vm') as any
	const agiExports: Record<string, any> = {
		ClaudeCode,
		ClaudeController,
		ClaudeSessionController,
		OpenAICodex,
		Conversation,
		ConversationV2,
		ModelProviders,
		ConversationHistory,
		Assistant,
		AssistantsManager,
		DocsReader,
		SkillsLibrary,
		BrowserUse,
		FileTools,
		LucaCoder,
		Memory,
		CodingTools,
		McpBridge,
		VoiceMode,
		SemanticSearch,
		ContentDb,
		NodeContainer,
		OpenAIClient,
		ElevenLabsClient,
		AGIContainer,
		default: container,
	}
	vm.defineModule('luca/agi', agiExports)
	vm.defineModule('@soederpop/luca/agi', agiExports)
} catch {}

export default container
