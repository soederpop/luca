import type { Expert } from "@/agi/features/expert"

export function start(expert: Expert) {
	console.log(`[excalidraw] Expert started`)
}

export function preview(expert: Expert) {
	// streaming preview - could pipe to terminal UI
}

export function toolCall(expert: Expert, toolName: string, args: any) {
	console.log(`[excalidraw] Calling ${toolName}`)
}

export function toolResult(expert: Expert, toolName: string, result: string) {
	const parsed = JSON.parse(result)
	if (parsed.pngPath) {
		console.log(`[excalidraw] Rendered: ${parsed.pngPath}`)
	}
	if (parsed.overall) {
		console.log(`[excalidraw] Evaluation score: ${parsed.overall}/5`)
	}
}
