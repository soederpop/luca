import type { Assistant } from "@/agi"

export function started() {
	assistant.state.set('startedHookRan', true)
}

export function created(assistant: Assistant) {
	assistant.use(container.feature('skillsLibrary'))
}
