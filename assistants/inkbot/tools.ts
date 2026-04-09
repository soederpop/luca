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

You render React Ink components directly in the canvas pane. No subprocesses.

## draw
Evaluate an async function body that returns a React component function. The component renders in the canvas.
- \`code\`: string — async function body, must return a component function
- \`sceneId\`: string (optional) — defaults to "default"
- \`interactive\`: boolean (optional) — when true, blocks until respond(data) is called

## create_scene
Create a named scene without activating it. Validates code immediately.
- \`id\`: string — unique scene name
- \`code\`: string — async function body returning a component

## activate_scene
Switch the canvas to display a different scene.
- \`id\`: string

## get_canvas
Returns the current canvas state: status, errors, and scene list.

## Key APIs in Scene Code
- \`h(Component, props, ...children)\` — React.createElement (no JSX available)
- \`useSceneInput(handler)\` — keyboard input, only active when canvas focused
- \`setMental(key, value)\` / \`getMental(key)\` — read/write your mental state
- \`respond(data)\` — complete an interactive scene, data becomes your tool result
- \`container\`, \`fs\`, \`proc\`, \`ui\`, \`yaml\`, \`grep\`, \`git\` — Luca container features

## Tips
- Every code body must end with \`return function SceneName() { ... }\`
- Use h() not JSX: \`h(Box, { flexDirection: 'column' }, h(Text, {}, "hello"))\`
- Use useSceneInput instead of useInput — it's focus-aware and error-safe
- Tab and Escape are reserved by the host app
- Errors are caught at multiple levels — if something breaks, you get the error back, fix and redraw
`
