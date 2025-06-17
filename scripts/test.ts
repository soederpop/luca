import container from '@/node'
import bootstrapper from '@/identities/bootstrapper'

const diskCache = container.feature('diskCache')

bootstrapper.feature('diskCache', {
	path: container.paths.resolve('node_modules', '.cache', 'agi-bootstrapper-cache')	
})

const chat = bootstrapper.feature('helperChat', {
	host: diskCache
})

async function main() {
	const response = await chat.ask('What is your purpose?')	
	console.log(response)
}
