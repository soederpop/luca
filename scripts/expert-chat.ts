import container from '@/agi/container.server'
import { c } from '@/console.context'

const ui = container.feature('ui')
const requestedExpert = container.argv._[0] || container.argv.expert || 'core'

async function main() {
	const expert = container.feature('identity', {
		name: requestedExpert,
		basePath: container.paths.resolve('experts', requestedExpert)
	})

	await expert.load()

	await expert.ask('How should I go about building a new Client that can work on the server in the browser with luca?')

}

main().catch(console.error)