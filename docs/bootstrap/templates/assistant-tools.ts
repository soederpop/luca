// The luca container is a global inside tools.ts — no import needed.
declare const container: any

// The default assistant learns the framework the same way you would: by driving
// the `luca` CLI and reading the bundled skill docs on demand. That keeps its
// tool surface tiny — just processManager's runCommand — which matters most on
// local models with small context windows.
//
// processManager provides:
//   - runCommand   run a shell command to completion (luca describe, rg, cat, builds, tests)
//   - spawnProcess / listProcesses / getProcessOutput / killProcess
//                  start and manage long-running background processes (servers, watchers)
//
// The system prompt (CORE.md) tells the assistant to search with
// `luca describe --query "..."`, read full API docs with `luca describe <name>`,
// and grep/read the tutorials under .claude/skills/luca-framework/ — no heavy
// document-Q&A tool surface required.
export const use = [
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
//
// Prefer CLI-driven discovery over hard-wired tools. If you truly need rich,
// synthesized document Q&A, `container.feature('docsReader', { contentDb:
// '.claude/skills/luca-framework' })` adds an askDocs tool — but it spins up a
// nested assistant and a larger tool surface, so reach for it only when the
// model has a generous context window.
