import type { AGIContainer, Assistant } from "luca/agi"

declare global {
	var assistant: Assistant
	var container: AGIContainer
}
