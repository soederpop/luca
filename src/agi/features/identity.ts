import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container';
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import { NodeContainer, type DiskCache, type NodeFeatures } from '@/node/container'

declare module '@/feature' {
	interface AvailableFeatures {
		identity: typeof Identity
	}
}

export interface Memory {
	type: 'biographical' | 'procedural' | 'longterm-goal' | 'shortterm-goal' | 'notes' | 'capability'
	content: string
	importance: number
	metadata?: Record<string, any>
}

export const IdentityStateSchema = FeatureStateSchema.extend({
	systemPrompt: z.string(),
	memories: z.array(z.any()),
	/** Memories loaded from memories.json (read-only seed data) */
	hardcodedMemories: z.array(z.any()),
})

export const IdentityOptionsSchema = FeatureOptionsSchema.extend({
	basePath: z.string().optional(),
	name: z.string().optional(),
	description: z.string().optional(),
})

export type IdentityState = z.infer<typeof IdentityStateSchema>
export type IdentityOptions = z.infer<typeof IdentityOptionsSchema>

/** 
 * This feature is used to manage the perceived identity of our AGI.  It consists of a system prompt, as well as any
 * accumulated memories it stores over its lifetime.
*/
export class Identity extends Feature<IdentityState, IdentityOptions> {
	static override stateSchema = IdentityStateSchema
	static override optionsSchema = IdentityOptionsSchema
	static override shortcut = "features.identity" as const

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('identity', Identity)
		container.feature('identity').enable()
		return container
	}

	override get initialState(): IdentityState {
		return {
			systemPrompt: '',
			enabled: true,
			memories: [],
			hardcodedMemories: []
		}
	}

	generatePrompt() {
		return this.state.get('systemPrompt') + '\n\n' + this.buildMemoryText(['biographical', 'procedural', 'longterm-goal', 'shortterm-goal', 'notes', 'capability'])
	}

	buildMemoryText(memoryTypes: Memory['type'][]) {
		return this.state.get('memories')!.filter(m => memoryTypes.includes(m.type)).map(m => `
			# ${m.type}
			${m.content}
		`).join('\n\n')
	}

	get diskCache() {
		return this.container.feature('diskCache') as DiskCache
	}

	override get container() {
		return super.container as NodeContainer<NodeFeatures, any>
	}

	/**
	 * Cache key used to namespace this identity's saved memories in diskCache.
	 *
	 * @returns {string} The namespaced cache key
	 */
	get memoryCacheKey(): string {
		const name = this.options.name || this.options.basePath || 'default'
		return `identity:${name}:memories`
	}

	/**
	 * Load the identity from disk. Reads the system prompt and hardcoded memories from the basePath,
	 * then loads any saved memories from diskCache and merges them together.
	 *
	 * @returns {Promise<this>} This identity instance
	 */
	async load() {
		const systemPrompt = await this.container.fs.readFileAsync(
			this.container.paths.resolve(this.options.basePath!, 'SYSTEM-PROMPT.md')
		)

		const hardcodedMemories: Memory[] = await this.container.fs.readJson(
			this.container.paths.resolve(this.options.basePath!, 'memories.json')
		)

		const savedMemories = await this.loadSavedMemories()

		this.state.set('systemPrompt', systemPrompt.toString())
		this.state.set('hardcodedMemories', hardcodedMemories)
		this.state.set('memories', [...hardcodedMemories, ...savedMemories])

		return this
	}

	/**
	 * Load saved memories from diskCache.
	 *
	 * @returns {Promise<Memory[]>} The saved memories, or empty array if none exist
	 */
	async loadSavedMemories(): Promise<Memory[]> {
		const exists = await this.diskCache.has(this.memoryCacheKey)
		if (!exists) return []
		return this.diskCache.get(this.memoryCacheKey, true)
	}

	/**
	 * Save a new memory. Persists to diskCache and updates state.
	 *
	 * @param {Memory} memory - The memory to save
	 * @returns {Promise<Memory[]>} The updated list of all memories
	 * @example
	 * ```typescript
	 * await identity.remember({
	 *   type: 'procedural',
	 *   content: 'Use bun instead of node for running scripts',
	 *   importance: 0.8
	 * })
	 * ```
	 */
	async remember(memory: Memory): Promise<Memory[]> {
		const saved = await this.loadSavedMemories()
		saved.push(memory)
		await this.diskCache.set(this.memoryCacheKey, saved)

		const hardcoded = this.state.get('hardcodedMemories')!
		const all = [...hardcoded, ...saved]
		this.state.set('memories', all)

		return all
	}

	/**
	 * Remove memories that match a predicate. Only affects saved memories (not hardcoded ones).
	 * Persists the change to diskCache and updates state.
	 *
	 * @param {(memory: Memory) => boolean} predicate - Function that returns true for memories to remove
	 * @returns {Promise<Memory[]>} The memories that were removed
	 * @example
	 * ```typescript
	 * await identity.forget(m => m.type === 'shortterm-goal')
	 * await identity.forget(m => m.content.includes('outdated info'))
	 * ```
	 */
	async forget(predicate: (memory: Memory) => boolean): Promise<Memory[]> {
		const saved = await this.loadSavedMemories()
		const removed = saved.filter(predicate)
		const remaining = saved.filter(m => !predicate(m))

		await this.diskCache.set(this.memoryCacheKey, remaining)

		const hardcoded = this.state.get('hardcodedMemories')!
		this.state.set('memories', [...hardcoded, ...remaining])

		return removed
	}

	/**
	 * Recall memories, optionally filtered by type.
	 *
	 * @param {Memory['type']} [type] - Optional memory type to filter by
	 * @returns {Memory[]} Matching memories from the current state
	 * @example
	 * ```typescript
	 * const all = identity.recall()
	 * const goals = identity.recall('longterm-goal')
	 * ```
	 */
	recall(type?: Memory['type']): Memory[] {
		const memories = this.state.get('memories')!
		if (!type) return memories
		return memories.filter(m => m.type === type)
	}

}

export default features.register('identity', Identity)