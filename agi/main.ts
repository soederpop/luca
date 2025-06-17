import type { OpenAIClient } from '@/ai'
import container from './container' 

const openai = container.client('openai' as any) as OpenAIClient

const response = await openai.createChatCompletion([{
		role: 'user',
		content: 'Hello, how are you?'
	}], {
		model: 'gpt-4o-mini',
	}
)

console.log(response!.choices[0]!.message.content)