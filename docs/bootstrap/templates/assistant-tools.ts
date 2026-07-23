// The luca container is a global inside tools.ts — no import needed.
declare const container: any

// Attach container features as tools:
// - docsReader answers questions about the luca framework using the bundled
//   skill docs in .claude/skills/luca-framework (askDocs tool)
// - processManager runs shell commands and manages background processes
//   (runCommand, spawnProcess, listProcesses, getProcessOutput, killProcess)
export const use = [
	container.feature('docsReader', {
		contentDb: container.paths.resolve('.claude', 'skills', 'luca-framework'),
	}),
	container.feature('processManager'),
]

// Add your own tools by exporting functions plus a matching `schemas` object:
//
// import { z } from 'zod'
// export const schemas = {
// 	greet: z.object({ name: z.string().describe('Who to greet') }).describe('Say hello'),
// }
// export function greet(options: { name: string }) {
// 	return `Hello, ${options.name}!`
// }
