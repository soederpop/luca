export async function main(container: any) {
	container.addContext('luca', container)

	try {
		container.onMissingCommand(handleMissingCommand)
	} catch(error) {

	}


	async function handleMissingCommand({ words, phrase } : { words: string[], phrase: string }) {
		const { ui } = container
		container.command('help').dispatch()
	}
}
