import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures, Feature } from '@soederpop/luca/feature'
import type { ContentDb } from '@/node.js'
import type Assistant from './assistant.js'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		docsReader: typeof DocsReader
	}
}

export const DocsReaderStateSchema = FeatureStateSchema.extend({
	started: z.boolean().describe('Whether the docs reader has been started'),
})

export const DocsReaderOptionsSchema = FeatureOptionsSchema.extend({
	contentDb: z.union([
		z.string(),
		z.any()
	]).describe('Either the contentDb instance or the path to the contentDb you want to load'),
	model: z.string().describe('The model to use for the conversation').default("gpt-5.4"),
	local: z.boolean().default(false).describe('Whether to use a local model for the conversation')
}).loose()

export const DocsReaderEventsSchema = FeatureEventsSchema.extend({
	loaded: z.tuple([]).describe('Fired after the docs reader has been started'),
}).describe('DocsReader events')

export type DocsReaderState = z.infer<typeof DocsReaderStateSchema>
export type DocsReaderOptions = z.infer<typeof DocsReaderOptionsSchema>

/**
 * The DocsReader feature is an AI Assisted wrapper around a ContentDB feature.
 *
 * You can ask it questions about the content, and it will use the ContentDB to find the answers
 * from the documents.
*/
export class DocsReader extends Feature<DocsReaderState, DocsReaderOptions> {
	static override stateSchema = DocsReaderStateSchema
	static override optionsSchema = DocsReaderOptionsSchema
	static override eventsSchema = DocsReaderEventsSchema
	static override shortcut = 'features.docsReader' as const

	static { Feature.register(this, 'docsReader') }

	/** @returns Default state with started=false. */
	override get initialState(): DocsReaderState {
		return {
			...super.initialState,
			started: false,
		}
	}

	/** Whether the docs reader has been started. */
	get isStarted(): boolean {
		return !!this.state.get('started')
	}

	calculateCacheKeyForQuestion(question: string) {
		return this.container.utils.hashObject({
			question,
			sha: this.container.git?.sha,
		})
	}

	get answerCache() {
		return this.container.feature('diskCache')
	}

	get contentDb() : ContentDb {
		return typeof this.options.contentDb === 'object' ?
			this.options.contentDb as ContentDb :
			this.container.feature('contentDb', { rootPath: this.options.contentDb })
	}

	async ask(question: string) {
		if (!this.isStarted) {
			await this.start()
		}

		if (!this.assistant) {
			throw new Error('DocsReader not started')
		}

		return this.assistant.ask(question)
	}

	async askCached(question: string) {
		if (!this.isStarted) {
			await this.start()
		}

		if (!this.assistant) {
			throw new Error('DocsReader not started')
		}

		const cacheKey = this.calculateCacheKeyForQuestion(question)
		const cached = await this.answerCache.get(cacheKey)
		if (cached) {
			return cached
		}

		const answer = await this.assistant.ask(question)
		await this.answerCache.set(cacheKey, answer)
		return answer
	}

	assistant?: Assistant


	private generateSpecificCollectionExplainer() {
		const { contentDb } = this
		const fileTree = contentDb.fileTree
		const modelDefinitionTable = contentDb.modelDefinitionTable
		const modelNames = contentDb.modelNames
		
		const domainTermSummary = this.container.feature('ui').endent(`
		## Domain Specific Terms 
		
		When the user is referring to one of the following nouns: ${modelNames.join(', ')} they are likely
		referencing one of the documents defined by the following content models:

		${Object.entries(modelDefinitionTable).map(([name, { description, glob, routePatterns }]) => `
		- **${name}**: ${description}
		Glob: ${glob}
		Route Patterns: ${routePatterns.join(', ')}
		`).join('\n')}
		`)

		return domainTermSummary
	}

	/** Start the docs reader by loading the contentDb and wiring its tools into an assistant. */
	async start(): Promise<DocsReader> {
		if (this.isStarted) return this

		const contentDb = this.contentDb
		if (!contentDb.isLoaded) await contentDb.load()
			

		this.assistant = this.container.feature('assistant', {
			systemPrompt: [CONTENT_DB_SYSTEM_PROMPT, this.generateSpecificCollectionExplainer()].filter(Boolean).join('\n\n'),
			model: this.options.model,
			local: this.options.local,
		}).use(contentDb)


		this.state.set('started', true)
		this.emit('started')

		return this
	}
}

export default DocsReader

export const CONTENT_DB_SYSTEM_PROMPT = `You answer questions using a collection of structured documents. Follow this workflow:

1. Start with getCollectionOverview to understand the collection structure, available models, and document counts
2. Use listDocuments or queryDocuments to find relevant documents by model, glob pattern, or metadata filters
3. Use searchContent for text/regex search or semanticSearch for natural language queries
4. Use readDocument to read specific documents — use include/exclude to focus on relevant sections and avoid loading unnecessary content
5. Synthesize your answer from the documents you've read

Be precise: read only what you need, use section filtering to stay focused, and cite document IDs in your answers.`
