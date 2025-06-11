import { OpenAIClient } from './openai-client.js'
export { OpenAIClient, type OpenAIClientOptions, type OpenAIClientState } from './openai-client.js';
export type { default as OpenAI } from 'openai'; 
import type { ClientsInterface } from '../client'
import type { Container } from '../container'

import { Feature, features } from '../feature.js'

export class AI extends Feature {
  static override shortcut = 'features.ai' as const
	
	static attach(container: Container & ClientsInterface) {
		container.use(OpenAIClient)		
	}
}

features.register('ai', AI)

export default AI
