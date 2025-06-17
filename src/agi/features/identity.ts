import type { Container } from '@/container';
import { type AvailableFeatures, type FeatureOptions, type FeatureState } from '@/feature'
import { features, Feature } from '@/feature'
import { type DiskCache } from '@/node/container'

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
	memoryFilePath?: string;
	systemPromptPath?: string;
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
			enabled: false,
			memories: []
		}
	}

	toChatCompletionMessages() {
		return [
			{
				role: 'system',
				content: this.state.get('systemPrompt'),
			},
		]
	}

	get diskCache() {
		return this.container.feature('diskCache') as DiskCache
	}

}

export default features.register('identity', Identity)