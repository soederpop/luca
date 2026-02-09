import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container';
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { HelperIntrospection } from '@/introspection';
import type { OpenAIClient } from '../openai-client';
import type OpenAI from 'openai';

declare module '@/feature' {
	interface AvailableFeatures {
		helperChat: typeof HelperChat
	}
}

export const HelperChatOptionsSchema = FeatureOptionsSchema.extend({
	host: z.any().optional().describe('The host helper instance to chat about'),
})

export const HelperChatStateSchema = FeatureStateSchema.extend({
	description: z.string().describe('Introspection text describing the host helper'),
	started: z.boolean().describe('Whether the chat session has been started'),
	messages: z.array(z.any()).describe('Chat message history'),
	systemPrompt: z.string().describe('Generated system prompt for the chat'),
})

export type HelperChatOptions = z.infer<typeof HelperChatOptionsSchema>
export type HelperChatState = z.infer<typeof HelperChatStateSchema>

/** 
 * The purpose of the `ServerInterfaces` feature is to provide an easy way to define either a Rest or Websocket server 
 * and iteratively add or subtract endpoints / message handlers as needed at runtime.  The primary actor who will be
 * doing this is a self-aware process that wants to define ways to communicate and gather data from other processes, and
 * expose mechanisms to trigger capabilities that it offers.
*/
export class HelperChat extends Feature<HelperChatState, HelperChatOptions> {
	static override stateSchema = HelperChatStateSchema
	static override optionsSchema = HelperChatOptionsSchema
	static override shortcut = "features.helperChat" as const

	static attach(container: Container<AvailableFeatures, any>) {
		container.features.register('helperChat', HelperChat)
		return container
	}

	openai!: OpenAIClient

	get isStarted() {
		return !!this.state.get('started')
	}

	async start() {
		if(this.state.get('started')) {
			return this
		}
	
		this.openai = (this.container as any).client('openai') as OpenAIClient
		this.state.set('description', this.options.host!.introspectAsText(3))

		this.state.set('started', true)

		this.state.set('messages', [{
			role: 'system',
			content: this.systemPrompt
		}])

		return this
	}

	get systemPrompt() {
		return this.container.feature('ui').endent(`
		# Helper Chat 

		You are an assistant designed to help communicate with a JavaScript object that is attached to a dependency injection container.

		The user is another AI process, or a person, that is speaking to you as if you ARE that object and what to learn what capabilities you have,
		what events you emit, what internal state you track, and things like that.

		Answer questions as if you ARE that object.

		The feature interface documentation describes methods that are available on you.

		## Feature Interface Documentation
		
		${this.state.get('description') || ''}
		`)	
	}

	async ask(question: string) {
		if(!this.isStarted) {
			await this.start()
		}

		const response = await this.openai.createChatCompletion(this.state.get('messages')!)
	
		this.state.set('messages', [...this.state.get('messages')!, response.choices[0]!.message])
		
		return response.choices[0]!.message.content || ''
	}

}

export default features.register('helperChat', HelperChat)

export interface IntrospectableHelper {
	introspect: () => HelperIntrospection | undefined;
	introspectAsText: (startHeadingDepth: number) => string
}

