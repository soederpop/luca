import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container';
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { Conversation, ConversationTool } from './conversation'
import type { AGIContainer } from '../container.server.js';
import type { ContentDb } from '@/node/features/content-db.js';

declare module '@/feature' {
	interface AvailableFeatures {
		docsReader: typeof DocsReader
	}
}

export const DocsReaderStateSchema = FeatureStateSchema.extend({
	started: z.boolean().describe('Whether the docs reader has been initialized'),
	docsLoaded: z.boolean().describe('Whether the content database has been loaded'),
})

export const DocsReaderOptionsSchema = FeatureOptionsSchema.extend({
	/** A ContentDb instance to read documents from */
	contentDb: z.any().optional().describe('A ContentDb instance to read documents from'),
	/** Optional system prompt prefix to prepend before the docs listing */
	systemPrompt: z.string().optional().describe('Optional system prompt to prepend before the docs listing'),
	/** OpenAI model to use for the conversation */
	model: z.string().optional().describe('OpenAI model to use for the conversation'),
})

export type DocsReaderState = z.infer<typeof DocsReaderStateSchema>
export type DocsReaderOptions = z.infer<typeof DocsReaderOptionsSchema>

/**
 * A docs reader that wraps a ContentDb and provides a Conversation
 * with tools to list, outline, and read documents. Ask it a question
 * and it will find and read the relevant docs to answer it.
 *
 * @extends Feature
 */
export class DocsReader extends Feature<DocsReaderState, DocsReaderOptions> {
	static override stateSchema = DocsReaderStateSchema
	static override optionsSchema = DocsReaderOptionsSchema
	static override shortcut = 'features.docsReader' as const

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('docsReader', DocsReader)
		return container
	}

	override get initialState(): DocsReaderState {
		return {
			...super.initialState,
			started: false,
			docsLoaded: false,
		}
	}

	override get container(): AGIContainer {
		return super.container as AGIContainer
	}

	/** The ContentDb instance this reader draws from. */
	get contentDb(): ContentDb {
		return this.options.contentDb as ContentDb
	}

	/** Whether the reader has been started and is ready to answer questions. */
	get isStarted() {
		return !!this.state.get('started')
	}

	conversation?: Conversation

	buildTools(): Record<string, ConversationTool> {
		const db = this.contentDb

		const listDocsSchema = z.object({}).describe('List all available document IDs in the content database')
		const readDocSchema = z.object({
			doc: z.string().describe('The document ID to read'),
		}).describe('Read the full content of a document')
		const readDocOutlineSchema = z.object({
			doc: z.string().describe('The document ID to get the outline for'),
		}).describe('Read just the heading outline of a document')
		const readDocsSchema = z.object({
			docs: z.array(z.string()).describe('The document IDs to read'),
		}).describe('Read the full content of multiple documents at once')

		const tools: Record<string, ConversationTool> = {}

		const schemas: Record<string, z.ZodType> = {
			listDocs: listDocsSchema,
			readDoc: readDocSchema,
			readDocOutline: readDocOutlineSchema,
			readDocs: readDocsSchema,
		}

		const handlers: Record<string, (...args: any[]) => Promise<any>> = {
			async listDocs() {
				return db.collection.available
			},
			async readDoc({ doc }: { doc: string }) {
				try {
					const document = db.collection.document(doc)
					return {
						id: doc,
						title: document.title,
						meta: document.meta,
						content: document.content,
					}
				} catch (err: any) {
					return { error: err.message }
				}
			},
			async readDocOutline({ doc }: { doc: string }) {
				try {
					const document = db.collection.document(doc)
					return {
						id: doc,
						title: document.title,
						outline: document.toOutline(),
					}
				} catch (err: any) {
					return { error: err.message }
				}
			},
			async readDocs({ docs }: { docs: string[] }) {
				return docs.map((doc) => {
					try {
						const document = db.collection.document(doc)
						return {
							id: doc,
							title: document.title,
							meta: document.meta,
							content: document.content,
						}
					} catch (err: any) {
						return { id: doc, error: err.message }
					}
				})
			},
		}

		for (const [name, handler] of Object.entries(handlers)) {
			const schema = schemas[name]!
			const jsonSchema = schema.toJSONSchema() as Record<string, any>

			tools[name] = {
				handler,
				description: jsonSchema.description || name,
				parameters: {
					type: jsonSchema.type || 'object',
					properties: jsonSchema.properties || {},
					...(jsonSchema.required ? { required: jsonSchema.required } : {}),
				}
			}
		}

		return tools
	}

	buildSystemPrompt(): string {
		const available = this.contentDb.collection.available
		const prefix = this.options.systemPrompt || 'You are a helpful documentation assistant. You have access to a library of documents. Use the provided tools to look up documents and answer the user\'s questions accurately based on what you find.'

		const docsList = available.length > 0
			? `\n\nAvailable documents:\n${available.map((id) => `- ${id}`).join('\n')}`
			: '\n\nNo documents are currently loaded.'

		return `${prefix}${docsList}\n\nUse the listDocs tool to see available documents, readDocOutline to scan a document's structure, and readDoc or readDocs to read the full content. Always read the relevant documents before answering.`
	}

	createConversation(): Conversation {
		const systemPrompt = this.buildSystemPrompt()
		const tools = this.buildTools()

		return this.container.feature('conversation', {
			model: this.options.model || 'gpt-4.1',
			tools,
			history: [
				{
					role: 'system',
					content: systemPrompt
				}
			]
		})
	}

	async start() {
		await this.contentDb.load()
		this.state.set('docsLoaded', true)

		this.conversation = this.createConversation()
		this.state.set('started', true)

		this.emit('start')

		return this
	}

	/**
	 * Ask the docs reader a question. It will read relevant documents
	 * and return an answer based on their content.
	 *
	 * @param {string} question - The question to ask
	 * @returns {Promise<string>} The answer
	 */
	async ask(question: string) {
		if (!this.isStarted) {
			await this.start()
		}

		if (!this.conversation) {
			return 'DocsReader is not started'
		}

		this.conversation.on('preview', (chunk: string) => {
			this.emit('preview', chunk)
		})

		const result = await this.conversation.ask(question)

		this.emit('answered', question, result)

		return result
	}
}

export default features.register('docsReader', DocsReader)
