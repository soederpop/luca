import type { Container } from '@/container';
import { type AvailableFeatures, type FeatureOptions, type FeatureState } from '@/feature'
import { features, Feature } from '@/feature'
import type { Identity } from './identity'
import type { OpenAIClient } from '../openai-client';
import type OpenAI from 'openai';

declare module '@/feature' {
	interface AvailableFeatures {
		expert: typeof Expert
	}
}

// 1. State interface
export interface ExpertState extends FeatureState {
	name: string
	folder: string
	started: boolean
	messages: any[]	
}

// 2. Options interface
export interface ExpertOptions extends FeatureOptions {
	/** Name of this expert, used as an identifier */
	name?: string
	/** Path to the expert's identity folder (e.g. experts/core) */
	folder?: string
}

/**
 * An Expert is a chat agent backed by an Identity loaded from a folder on disk.
 * Experts are coordinated by the container to perform specialized tasks.
 *
 * Each expert's folder contains a SYSTEM-PROMPT.md, memories.json, and optional skills.
 *
 * @extends Feature
 */
export class Expert extends Feature<ExpertState, ExpertOptions> {
	static override shortcut = 'features.expert' as const

	openai!: OpenAIClient
	
	static attach(container: Container<AvailableFeatures, any>) {
		features.register('expert', Expert)
		return container
	}

	override get initialState(): ExpertState {
		return {
			...super.initialState,
			name: '',
			folder: ''
		}
	}

	get identity() : Identity {
		return this.container.feature('identity', {
			name: this.options.name,
			basePath: (this.container as any).paths.resolve('experts', this.options.folder)
		})
	}

	get isStarted() {
		return !!this.state.get('started')
	}

	async start() {
		this.openai = (this.container as any).client('openai') as OpenAIClient
		await this.identity.load()
		this.state.set('started', true)
		this.state.set('messages', [{
			role: 'system',
			content: this.identity.generatePrompt()
		}])
		return this
	}

	async ask(question: string) {
		if(!this.isStarted) {
			await this.start()
		}

		this.state.set('messages', [
			...this.state.get('messages')!,
			{
				role: 'user',
				content: question
			}
		])

		const response = await this.openai.createChatCompletion(this.state.get('messages')!, {
			model: "o3-mini"
		})
		
		return response.choices[0]!.message.content || ''
	}
	
}

export default features.register('expert', Expert)
