import container from '@/agi/container.server'

async function main() {
	const expert = container.feature('expert', {
		name: 'core',
		folder: 'core'
	})

	await expert.load()
}

main()