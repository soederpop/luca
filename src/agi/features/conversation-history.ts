import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '@soederpop/luca/feature'
import { NodeContainer, type DiskCache, type NodeFeatures } from '@soederpop/luca/node/container'
import type { Message } from './conversation'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		conversationHistory: typeof ConversationHistory
	}
}

export interface ConversationRecord {
	id: string
	title: string
	model: string
	messages: Message[]
	tags: string[]
	thread: string
	createdAt: string
	updatedAt: string
	messageCount: number
	metadata: Record<string, any>
}

export type ConversationMeta = Omit<ConversationRecord, 'messages'>

export interface SearchOptions {
	tag?: string
	tags?: string[]
	thread?: string
	model?: string
	before?: string | Date
	after?: string | Date
	query?: string
	limit?: number
	offset?: number
}

export const ConversationHistoryOptionsSchema = FeatureOptionsSchema.extend({
	cachePath: z.string().optional().describe('Custom cache directory for conversation storage'),
	namespace: z.string().optional().describe('Namespace prefix for cache keys to isolate datasets'),
})

export const ConversationHistoryStateSchema = FeatureStateSchema.extend({
	conversationCount: z.number().describe('Total number of stored conversations'),
	lastSaved: z.string().optional().describe('ISO timestamp of the last save operation'),
})

export const ConversationHistoryEventsSchema = FeatureEventsSchema.extend({
	saved: z.tuple([z.string().describe('The conversation ID that was saved')]).describe('Fired after a conversation record is persisted'),
	deleted: z.tuple([z.string().describe('The conversation ID that was deleted')]).describe('Fired after a conversation record is deleted'),
}).describe('ConversationHistory events')

export type ConversationHistoryOptions = z.infer<typeof ConversationHistoryOptionsSchema>
export type ConversationHistoryState = z.infer<typeof ConversationHistoryStateSchema>

/**
 * Persists conversations to disk using the diskCache feature (cacache).
 * Each conversation is stored as a JSON blob keyed by ID, with metadata
 * stored alongside for efficient listing and search without loading full message arrays.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const history = container.feature('conversationHistory', {
 *   namespace: 'my-app',
 *   cachePath: '/tmp/conversations'
 * })
 *
 * // Create and retrieve conversations
 * const record = await history.create({ messages, title: 'My Chat' })
 * const loaded = await history.load(record.id)
 *
 * // Search and filter
 * const results = await history.search({ tag: 'important', limit: 10 })
 * ```
 */
export class ConversationHistory extends Feature<ConversationHistoryState, ConversationHistoryOptions> {
	static override stateSchema = ConversationHistoryStateSchema
	static override optionsSchema = ConversationHistoryOptionsSchema
	static override eventsSchema = ConversationHistoryEventsSchema
	static override shortcut = 'features.conversationHistory' as const

	static { Feature.register(this, 'conversationHistory') }

	/** @returns Default state with zero conversations and no last-saved timestamp. */
	override get initialState(): ConversationHistoryState {
		return {
			...super.initialState,
			conversationCount: 0,
			lastSaved: undefined,
		}
	}

	/** @returns The parent NodeContainer, narrowed from the base Container type. */
	override get container() {
		return super.container as NodeContainer<NodeFeatures, any>
	}

	/** @returns The diskCache feature instance used for persistence, configured with the optional cachePath. */
	get diskCache(): DiskCache {
		const opts: Record<string, any> = {}
		if (this.options.cachePath) {
			opts.path = this.options.cachePath
		}
		return this.container.feature('diskCache', opts) as DiskCache
	}

	/** @returns The namespace prefix used for all cache keys, defaults to 'conversation-history'. */
	get namespace(): string {
		return this.options.namespace || 'conversation-history'
	}

	private buildCacheKey(id: string): string {
		return `${this.namespace}:${id}`
	}

	private metaKey(id: string): string {
		return `${this.namespace}:meta:${id}`
	}

	private indexKey(): string {
		return `${this.namespace}:__index__`
	}

	/**
	 * Save a conversation. Creates or overwrites by ID.
	 *
	 * @param {ConversationRecord} record - The full conversation record to persist
	 * @returns {Promise<void>}
	 */
	async save(record: ConversationRecord): Promise<void> {
		record.updatedAt = new Date().toISOString()
		record.messageCount = record.messages.length

		// store the full conversation (messages included)
		await this.diskCache.set(this.buildCacheKey(record.id), record)

		// store lightweight metadata separately for fast listing
		const meta: ConversationMeta = { ...record }
		delete (meta as any).messages
		await this.diskCache.set(this.metaKey(record.id), meta)

		// update the index
		await this.addToIndex(record.id)

		this.state.set('lastSaved', record.updatedAt)
		this.emit('saved', record.id)
	}

	/**
	 * Create a new conversation from messages, returning the saved record.
	 *
	 * @param {object} opts - Creation options including messages, optional title, model, tags, thread, and metadata
	 * @returns {Promise<ConversationRecord>} The newly created and persisted conversation record
	 */
	async create(opts: {
		id?: string
		title?: string
		model?: string
		messages: Message[]
		tags?: string[]
		thread?: string
		metadata?: Record<string, any>
	}): Promise<ConversationRecord> {
		const now = new Date().toISOString()
		const record: ConversationRecord = {
			id: opts.id || crypto.randomUUID(),
			title: opts.title || 'Untitled',
			model: opts.model || 'unknown',
			messages: opts.messages,
			tags: opts.tags || [],
			thread: opts.thread || 'default',
			createdAt: now,
			updatedAt: now,
			messageCount: opts.messages.length,
			metadata: opts.metadata || {},
		}

		await this.save(record)
		return record
	}

	/**
	 * Load a full conversation by ID, including all messages.
	 *
	 * @param {string} id - The conversation ID
	 * @returns {Promise<ConversationRecord | null>} The full record, or null if not found
	 */
	async load(id: string): Promise<ConversationRecord | null> {
		const exists = await this.diskCache.has(this.buildCacheKey(id))
		if (!exists) return null
		return this.diskCache.get(this.buildCacheKey(id), true)
	}

	/**
	 * Load just the metadata for a conversation (no messages).
	 *
	 * @param {string} id - The conversation ID
	 * @returns {Promise<ConversationMeta | null>} The lightweight metadata record, or null if not found
	 */
	async getMeta(id: string): Promise<ConversationMeta | null> {
		const exists = await this.diskCache.has(this.metaKey(id))
		if (!exists) return null
		return this.diskCache.get(this.metaKey(id), true)
	}

	/**
	 * Append messages to an existing conversation.
	 *
	 * @param {string} id - The conversation ID to append to
	 * @param {Message[]} messages - The messages to append
	 * @returns {Promise<ConversationRecord | null>} The updated record, or null if the conversation was not found
	 */
	async append(id: string, messages: Message[]): Promise<ConversationRecord | null> {
		const record = await this.load(id)
		if (!record) return null

		record.messages.push(...messages)
		await this.save(record)
		return record
	}

	/**
	 * Delete a conversation by ID.
	 *
	 * @param {string} id - The conversation ID to delete
	 * @returns {Promise<boolean>} True if the conversation existed and was deleted
	 */
	async delete(id: string): Promise<boolean> {
		const exists = await this.diskCache.has(this.buildCacheKey(id))
		if (!exists) return false

		await this.diskCache.rm(this.buildCacheKey(id))
		await this.diskCache.rm(this.metaKey(id)).catch(() => {})
		await this.removeFromIndex(id)

		this.emit('deleted', id)
		return true
	}

	/**
	 * List all conversation metadata, with optional search/filter.
	 * Loads only the lightweight meta records, never the full messages.
	 *
	 * @param {SearchOptions} [options] - Optional filters for tag, thread, model, date range, and text query
	 * @returns {Promise<ConversationMeta[]>} Filtered and sorted metadata records (newest first)
	 */
	async list(options?: SearchOptions): Promise<ConversationMeta[]> {
		const ids = await this.getIndex()
		const metas: ConversationMeta[] = []

		for (const id of ids) {
			const meta = await this.getMeta(id)
			if (meta) metas.push(meta)
		}

		return this.applyFilters(metas, options)
	}

	/**
	 * Search conversations by text query across titles, tags, and metadata.
	 * Also supports filtering by tag, thread, model, and date range.
	 *
	 * @param {SearchOptions} options - Search and filter criteria
	 * @returns {Promise<ConversationMeta[]>} Matching metadata records (newest first)
	 */
	async search(options: SearchOptions): Promise<ConversationMeta[]> {
		return this.list(options)
	}

	/**
	 * Get all unique tags across all conversations.
	 *
	 * @returns {Promise<string[]>} Sorted array of unique tag strings
	 */
	async allTags(): Promise<string[]> {
		const metas = await this.list()
		const tags = new Set<string>()
		for (const meta of metas) {
			for (const tag of meta.tags) {
				tags.add(tag)
			}
		}
		return [...tags].sort()
	}

	/**
	 * Get all unique threads across all conversations.
	 *
	 * @returns {Promise<string[]>} Sorted array of unique thread identifiers
	 */
	async allThreads(): Promise<string[]> {
		const metas = await this.list()
		const threads = new Set<string>()
		for (const meta of metas) {
			threads.add(meta.thread)
		}
		return [...threads].sort()
	}

	/**
	 * Tag a conversation. Adds tags without duplicates.
	 *
	 * @param {string} id - The conversation ID
	 * @param {...string} tags - One or more tags to add
	 * @returns {Promise<boolean>} True if the conversation was found and updated
	 */
	async tag(id: string, ...tags: string[]): Promise<boolean> {
		const record = await this.load(id)
		if (!record) return false

		const tagSet = new Set(record.tags)
		for (const t of tags) tagSet.add(t)
		record.tags = [...tagSet]

		await this.save(record)
		return true
	}

	/**
	 * Remove tags from a conversation.
	 *
	 * @param {string} id - The conversation ID
	 * @param {...string} tags - One or more tags to remove
	 * @returns {Promise<boolean>} True if the conversation was found and updated
	 */
	async untag(id: string, ...tags: string[]): Promise<boolean> {
		const record = await this.load(id)
		if (!record) return false

		const removeSet = new Set(tags)
		record.tags = record.tags.filter(t => !removeSet.has(t))

		await this.save(record)
		return true
	}

	/**
	 * Update metadata on a conversation without touching messages.
	 *
	 * @param {string} id - The conversation ID
	 * @param {object} updates - Partial updates for title, tags, thread, and/or metadata
	 * @returns {Promise<boolean>} True if the conversation was found and updated
	 */
	async updateMeta(id: string, updates: Partial<Pick<ConversationRecord, 'title' | 'tags' | 'thread' | 'metadata'>>): Promise<boolean> {
		const record = await this.load(id)
		if (!record) return false

		if (updates.title !== undefined) record.title = updates.title
		if (updates.tags !== undefined) record.tags = updates.tags
		if (updates.thread !== undefined) record.thread = updates.thread
		if (updates.metadata !== undefined) record.metadata = { ...record.metadata, ...updates.metadata }

		await this.save(record)
		return true
	}

	/**
	 * Find the most recent conversation for an exact thread ID.
	 *
	 * @param {string} thread - The exact thread ID to match
	 * @returns {Promise<ConversationRecord | null>} The full record with messages, or null if none found
	 */
	async findByThread(thread: string): Promise<ConversationRecord | null> {
		const metas = await this.list({ thread })
		if (!metas.length) return null
		return this.load(metas[0]!.id)
	}

	/**
	 * Find all conversations whose thread starts with a prefix.
	 *
	 * @param {string} prefix - The thread prefix to match
	 * @returns {Promise<ConversationMeta[]>} Matching metadata records (newest first)
	 */
	async findByThreadPrefix(prefix: string): Promise<ConversationMeta[]> {
		const all = await this.list()
		return all.filter(m => m.thread.startsWith(prefix))
	}

	/**
	 * Delete all conversations for an exact thread.
	 *
	 * @param {string} thread - The exact thread ID
	 * @returns {Promise<number>} Number of conversations deleted
	 */
	async deleteThread(thread: string): Promise<number> {
		const metas = await this.list({ thread })
		let count = 0
		for (const meta of metas) {
			if (await this.delete(meta.id)) count++
		}
		return count
	}

	/**
	 * Delete all conversations matching a thread prefix.
	 *
	 * @param {string} prefix - The thread prefix to match
	 * @returns {Promise<number>} Number of conversations deleted
	 */
	async deleteByThreadPrefix(prefix: string): Promise<number> {
		const metas = await this.findByThreadPrefix(prefix)
		let count = 0
		for (const meta of metas) {
			if (await this.delete(meta.id)) count++
		}
		return count
	}

	// -- index management --

	private async getIndex(): Promise<string[]> {
		const exists = await this.diskCache.has(this.indexKey())
		if (!exists) return []
		return this.diskCache.get(this.indexKey(), true)
	}

	private async setIndex(ids: string[]): Promise<void> {
		await this.diskCache.set(this.indexKey(), ids)
		this.state.set('conversationCount', ids.length)
	}

	private async addToIndex(id: string): Promise<void> {
		const ids = await this.getIndex()
		if (!ids.includes(id)) {
			ids.push(id)
			await this.setIndex(ids)
		}
	}

	private async removeFromIndex(id: string): Promise<void> {
		const ids = await this.getIndex()
		await this.setIndex(ids.filter(i => i !== id))
	}

	// -- filtering --

	private applyFilters(metas: ConversationMeta[], options?: SearchOptions): ConversationMeta[] {
		if (!options) return metas

		let results = metas

		if (options.tag) {
			results = results.filter(m => m.tags.includes(options.tag!))
		}

		if (options.tags && options.tags.length) {
			results = results.filter(m => options.tags!.every(t => m.tags.includes(t)))
		}

		if (options.thread) {
			results = results.filter(m => m.thread === options.thread)
		}

		if (options.model) {
			results = results.filter(m => m.model === options.model)
		}

		if (options.after) {
			const after = new Date(options.after).getTime()
			results = results.filter(m => new Date(m.createdAt).getTime() >= after)
		}

		if (options.before) {
			const before = new Date(options.before).getTime()
			results = results.filter(m => new Date(m.createdAt).getTime() <= before)
		}

		if (options.query) {
			const q = options.query.toLowerCase()
			results = results.filter(m =>
				m.title.toLowerCase().includes(q) ||
				m.tags.some(t => t.toLowerCase().includes(q)) ||
				m.thread.toLowerCase().includes(q) ||
				JSON.stringify(m.metadata).toLowerCase().includes(q)
			)
		}

		// sort newest first
		results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

		if (options.offset) {
			results = results.slice(options.offset)
		}

		if (options.limit) {
			results = results.slice(0, options.limit)
		}

		return results
	}
}

export default ConversationHistory
