import container from '@soederpop/luca/agi'

const { ui } = container

async function main() {
	const conversation = container.feature('conversation', {
		model: 'gpt-4o-mini',
	})

	conversation.on('preview', (chunk: string) => {
		console.clear()
		console.log(
			ui.markdown(chunk)
		)
	})

	const result = await conversation.ask("Explain typescript module augmentation")
}

main()