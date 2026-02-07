import type { Container } from '@/container';
import { type AvailableFeatures, type FeatureOptions, type FeatureState } from '@/feature'
import { features, Feature } from '@/feature'
import type { HelperIntrospection } from '@/introspection';
import type { OpenAIClient } from '../openai-client';
import type OpenAI from 'openai';

declare module '@/feature' {
	interface AvailableFeatures {
		ContainerChat: typeof ContainerChat 
	}
}

export interface ContainerChatOptions extends FeatureOptions { }

export interface ContainerChatState extends FeatureState {
	description: string;
	started: boolean;
	messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
	systemPrompt: string;
}

/** 
 * The purpose of the `ServerInterfaces` feature is to provide an easy way to define either a Rest or Websocket server 
 * and iteratively add or subtract endpoints / message handlers as needed at runtime.  The primary actor who will be
 * doing this is a self-aware process that wants to define ways to communicate and gather data from other processes, and
 * expose mechanisms to trigger capabilities that it offers.
*/
export class ContainerChat extends Feature<ContainerChatState, ContainerChatOptions> {
	static override shortcut = "features.containerChat" as const

	static attach(container: Container<AvailableFeatures, any>) {
		container.features.register('containerChat', ContainerChat)
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

		this.state.set('started', true)

		this.state.set('messages', [{
			role: 'system',
			content: this.systemPrompt
		}])

		return this
	}

	buildFeatureDocumentation() {
		const availableFeatures = this.container.features.available

		return availableFeatures.map(f => {
			const feature = this.container.features.lookup(f) as any
			return feature.introspectAsText(3)
		}).join('\n\n')
	}

	get systemPrompt() {
		return this.container.feature('ui').endent(`
			# Container Chat

			The user will be speaking to you as if you are a JavaScript object they want to learn about. 

			You are attached to that object, an instance of a Container class.

			You have been attached to a global singleton container, that also acts as a global state machine, event bus, and provider of different registries
			that contains Helper classes that you can create instances of and interact with.  For example, you have the following:

			- this.features - a registry of all feature classes that have been registered
			- this.clients - a registry of all client classes that have been registered
			- this.servers - a registry of all server classes that have been registered
		
			You also have a this.state object that is observable that can be used to track state.

			You also have standard event bus methods that people can use to listen to events.

			For each of the features, clients, servers, you can see the ones that are available, e.g.

			this.clients.available // string[] - ids

			this.client(oneOfthoseAvailableIds, whateverOptions) // returns a client instance

			same for featurs, servers, etc.

			the point of the helper class is to provide a standard interface and API on top of different things that these things can do.

			## Environment Specific

			A container is specific to the environment it is running in, e.g. it could be in node or in the browser.

			This one in particular is running on a server using the bun.js runtime.

			### Available Features

			${this.container.features.available.map(f => `- ${f}`).join('\n')}

			## Available Clients

			${(this.container as any).clients.available.map((c: any) => `- ${c}`).join('\n')}

			## Available Servers

			${(this.container as any).servers.available.map((s: any) => `- ${s}`).join('\n')}

			## Feature Documentation

			${this.buildFeatureDocumentation()}
		`)	
	}

	async generateSnippet(question: string, usingFeatures: string[]) {
		const snippets = this.container.features.snippets

		const featureDocs = usingFeatures.map(f => {
			const feature = this.container.features.lookup(f) as any
			return feature.introspectAsText(3)
		}).join('\n\n')

		const prompt = this.container.feature('ui').endent(`
			# Javascript Snippet Generation

			Generate a snippet of code that can be run inside of the container's VM.

			Your snippet can use any of the ${usingFeatures.join(", ")} features which can be created with "container.feature(whatever, options), if theyre not already defined in the global scope"

			## Feature Documentation
			
			## REQUIREMENTS
			- no importing modules or exporting
			- no external dependencies period
			- NO TYPESCRIPT, this is pure JS at runtime
			- your code will be evaluated inside a node vm runScript function with context already defined
			- write your snippet as a SELF EXECUTING ASYNC FUNCTION that returns a json serializable object
			- The following objects are already defined as global variables in the scope:
				- 'container' - the container object 
				- ${usingFeatures.join(", ")} - all instances of the feature objects	

			## GOAL: 

			${question}
		`)

		return this.ask(prompt)
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

export default features.register('containerChat', ContainerChat)
