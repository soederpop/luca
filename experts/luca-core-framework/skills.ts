export async function askContainerQuestion(question: string) {
	const containerChat = container.feature('containerChat')
	return containerChat.ask(question)
}

export async function runScript(script: string) {
	return container.feature('vm').run(script)
}