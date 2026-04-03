import type { AGIContainer, Assistant } from "@soederpop/luca/agi"

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export function started() {
	assistant
		// this will give it the ability to read documentation from the various feature
		.use(container.describer)
		// use the documentation from the various available skils
		.use(container.feature('skillsLibrary'))
}
