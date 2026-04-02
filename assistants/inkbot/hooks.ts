import type { Assistant } from "@/agi"

declare global {
	var assistant: Assistant
}

export function started() {
}
