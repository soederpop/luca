import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export function started() {
	assistant.intercept('beforeAsk', async function runOnceBeforeChat(ctx, next) {
		const claudeMd = await container.fs.readFileAsync('CLAUDE.md').then(r => String(r))

		assistant.state.set('loadedClaudeMd', true)

		assistant.addSystemPromptExtension('code-context', claudeMd)

		assistant.interceptors.beforeAsk.remove(runOnceBeforeChat)

		await next()
	})

}
