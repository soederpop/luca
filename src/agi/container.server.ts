import type { ContainerState } from '../container'
import { type NodeFeatures, NodeContainer } from '../node/container'
import '../introspection/generated.agi.js'
import { OpenAIClient } from '../clients/openai'
import { ElevenLabsClient } from '../clients/elevenlabs'
import { VoiceBoxClient } from '../clients/voicebox'
import { ClaudeSessionController } from './features/claude-session-controller'
import { SemanticSearch } from '../node/features/semantic-search'
import { ContentDb } from '../node/features/content-db'

// All agi feature imports, value re-exports, type re-exports, and the
// GeneratedAGIFeatures interface come from the generated barrel.
// Regenerate with `bun run build:feature-barrel` after adding a feature.
import { type GeneratedAGIFeatures, generatedAgiFeatureExports } from './features.generated'
export * from './features.generated'

import type { ConversationTool } from './features/conversation'
import type {
	ClaudeCode,
	ClaudeController,
	OpenAICodex,
	ConversationHistory,
	ModelProviders,
} from './features.generated'
import type { ZodType } from 'zod'

export {
	ClaudeSessionController,
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

export interface AGIFeatures extends NodeFeatures, GeneratedAGIFeatures {}

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
	.use(SemanticSearch)

for (const featureClass of Object.values(generatedAgiFeatureExports)) {
	container.use(featureClass as any)
}

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
		...generatedAgiFeatureExports,
		ClaudeSessionController,
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
