import type { Assistant } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
}

export function started() {
	console.log('Luca Expert assistant started')
}
