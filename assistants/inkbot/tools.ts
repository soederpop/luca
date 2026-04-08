import container from '@soederpop/luca/agi'
import { z } from 'zod'

export const use = [
	container.describer,
	container.feature('skillsLibrary'),
]

export const schemas = {
	README: z.object({}).describe('Call this tool first to learn how your canvas tools work.')
}

export function README() {
	return README_CONTENT
}

const README_CONTENT = `
# Inkbot Canvas Tools

You have the following tools registered on you for controlling the canvas:

## draw
Write TypeScript code that runs as a bun subprocess. stdout appears in the canvas.
- \`code\`: string — the TypeScript to execute
- \`sceneId\`: string (optional) — defaults to "default"

## create_scene
Create a named scene without running it.
- \`id\`: string — unique scene name
- \`code\`: string — TypeScript code

## run_scene
Run an existing scene by id.
- \`id\`: string

## run_all
Run every scene in order. Returns array of results.

## activate_scene
Switch the canvas to display a different scene.
- \`id\`: string

## get_canvas
Returns the current canvas state: output, error, code, status, and scene list.

## Tips
- Use console.log() for output — that is what renders in the canvas.
- If your code errors, you get stderr back. Fix it and draw again.
- You can use ANSI escape codes for colors and formatting.
- Scenes persist — update them with draw using the same sceneId.
- You also have luca framework inspection tools (luca_describe, etc.) to look up APIs.
`
