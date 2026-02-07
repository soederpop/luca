// make sure container is assumed global to get rid of the typescript errors
// since these files will be evaluated in a vm

import type { AGIContainer } from '@/agi/container.server'

declare global {
	namespace NodeJS {
		interface Global {
			container: AGIContainer
		}
	}
	const container: AGIContainer
}