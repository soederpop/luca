import type { Container } from '@/container';
import { type AvailableFeatures, type FeatureOptions, type FeatureState } from '@/feature'
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

export interface IdentityState extends FeatureState {
	systemPrompt: string
	memories: Memory[]
}

export interface IdentityOptions extends FeatureOptions {
	basePath?: string;
	name?: string;
	description?: string;	
}

/** 
 * This feature is used to manage the perceived identity of our AGI.  It consists of a system prompt, as well as any
 * accumulated memories it stores over its lifetime.
*/
export class Identity extends Feature<IdentityState, IdentityOptions> {
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
			memories: []
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

	async load() {
		const systemPrompt = await this.container.fs.readFileAsync(
			this.container.paths.resolve(this.options.basePath!, 'SYSTEM-PROMPT.md')
		)

		const memories = await this.container.fs.readJson(
			this.container.paths.resolve(this.options.basePath!, 'memories.json')
		)

		this.state.set('systemPrompt', systemPrompt.toString())
		this.state.set('memories', memories as any)

		return this
	}

}

export default features.register('identity', Identity)