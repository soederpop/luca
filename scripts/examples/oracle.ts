import container from '@/agi'

async function main() {
	const oracle = container.feature('oracle', {
		model: 'gpt-4o',
	})

	await oracle.start()
}

main().catch(console.error)
