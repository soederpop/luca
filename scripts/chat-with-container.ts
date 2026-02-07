import container from '@/agi/container.server'

async function main() {
	const containerChat = container.feature('containerChat')

	const response = await containerChat.generateSnippet('I want a script which will display a tree of the directories in the projects file manager.', ['fileManager', 'ui'])

	console.log(response)
}

main()