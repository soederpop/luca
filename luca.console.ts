import type { AGIContainer } from '@/agi'

declare global {
	var container: AGIContainer 
}

export const ass = container.feature('assistant', {
	folder: 'assistants/project-owner',
})