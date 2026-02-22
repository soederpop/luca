import container from '@soederpop/luca/agi'

async function main() {
	const reader = container.feature('docsReader', {
		cached: false,
		contentDb: container.docs,
	})

	reader.on('preview', (chunk: string) => {
		console.clear()
		console.log(container.ui.markdown(chunk))
	})

	const answer = await reader.ask('What ideas are in the backlog? Give me a summary of each one.')

	console.log('\n\n' + answer)
}

main().catch(console.error)
