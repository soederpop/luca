import { z } from 'zod'
import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

const proc = () => container.feature('proc')
const fs = () => container.feature('fs')

// ---------------------------------------------------------------------------
// readSkill — Read the SKILL.md and progressively discover referenced docs
// ---------------------------------------------------------------------------

export const schemas = {
	readSkill: z.object({
		section: z.string().default('').describe(
			'Section to focus on (e.g. "Phase 1", "Phase 2", "Key Concepts"). Leave empty for the full SKILL.md.'
		),
	}).describe('Read the SKILL.md learning guide for the Luca framework. Use this to orient yourself or a user to how the framework is learned and used.'),

	readDoc: z.object({
		mode: z.enum(['list', 'read']).describe(
			'"list" to browse available documents in a category, "read" to get full content of a specific document'
		),
		category: z.string().default('').describe(
			'Document category: examples, tutorials, apis, apis/features/node, apis/features/agi, apis/features/web, apis/clients, apis/servers, challenges, prompts, scaffolds, sessions, bootstrap. Leave empty when using mode "read".'
		),
		path: z.string().default('').describe(
			'Relative path within docs/ to read (e.g. "examples/fs.md", "tutorials/00-bootstrap.md"). Required when mode is "read". Leave empty when using mode "list".'
		),
	}).describe('Browse and read documentation from the docs/ folder — examples, tutorials, API references, scaffolds, and more.'),

	lucaDescribe: z.object({
		args: z.string().describe(
			'Arguments to pass to luca describe. Examples: "fs", "git", "features", "clients", "servers", "fs.readFile", "ui.banner", "express --options", "fs --methods", "fs git --examples"'
		),
	}).describe('Run the luca describe CLI to get live, source-generated documentation for any feature, client, server, or specific method/getter. This is always current.'),

	lucaEval: z.object({
		code: z.string().describe(
			'JavaScript/TypeScript code to run in a live container. All features available as top-level vars (fs, git, proc, vm, etc). The last expression value is returned. For async: put the await expression on the last line.'
		),
	}).describe('Execute code in a live Luca container sandbox. Use this to test APIs, verify behavior, and prototype ideas. Top-level await is supported — put async calls as the last expression to capture their result.'),

	askCodingAssistant: z.object({
		question: z.string().describe(
			'A research question for the coding assistant. Be specific about what you want to find: file paths, function implementations, patterns, class hierarchies, etc.'
		),
	}).describe('Delegate deep codebase research to the coding assistant who has ripgrep, cat, ls, sed, and awk. Use for implementation details, tracing code paths, or finding patterns the docs do not cover.'),
}

export function readSkill({ section }: z.infer<typeof schemas.readSkill>): string {
	const skillPath = 'docs/bootstrap/SKILL.md'

	if (!fs().exists(skillPath)) {
		return 'SKILL.md not found at docs/bootstrap/SKILL.md'
	}

	const content = fs().readFile(skillPath)

	if (!section || !section.trim()) return content

	// Extract section by heading match
	const lines = content.split('\n')
	const sectionLines: string[] = []
	let capturing = false
	let sectionLevel = 0

	for (const line of lines) {
		const headingMatch = line.match(/^(#{1,6})\s+(.*)/)

		if (headingMatch) {
			const level = headingMatch[1].length
			const title = headingMatch[2]

			if (capturing && level <= sectionLevel) break

			if (title.toLowerCase().includes(section.toLowerCase())) {
				capturing = true
				sectionLevel = level
			}
		}

		if (capturing) sectionLines.push(line)
	}

	return sectionLines.length > 0
		? sectionLines.join('\n')
		: `Section "${section}" not found in SKILL.md. Available sections:\n${lines.filter(l => l.startsWith('#')).join('\n')}`
}

export function readDoc({ mode, category, path: docPath }: z.infer<typeof schemas.readDoc>): string {
	if (mode === 'list') {
		const dir = category ? `docs/${category}` : 'docs'

		if (!fs().exists(dir)) {
			return `Directory "${dir}" not found. Available top-level categories:\n${fs().readdirSync('docs').join('\n')}`
		}

		const entries = fs().readdirSync(dir)
		return `Contents of ${dir}/:\n${entries.join('\n')}`
	}

	// mode === 'read'
	if (!docPath) {
		return 'Error: path is required when mode is "read". Use mode "list" to browse available docs first.'
	}

	const fullPath = docPath.startsWith('docs/') ? docPath : `docs/${docPath}`

	if (!fs().exists(fullPath)) {
		return `Document not found: ${fullPath}`
	}

	return fs().readFile(fullPath)
}

export function lucaDescribe({ args }: z.infer<typeof schemas.lucaDescribe>): string {
	try {
		return proc().exec(`bun run src/cli/cli.ts describe ${args}`)
	} catch (err: any) {
		return `Error running luca describe ${args}: ${err.message || err}`
	}
}

export async function lucaEval({ code }: z.infer<typeof schemas.lucaEval>): Promise<string> {
	try {
		const vm = container.feature('vm')
		const { result, console: calls } = await vm.runCaptured(code, {
			container,
			fs: container.feature('fs'),
			git: container.feature('git'),
			proc: container.feature('proc'),
			vm,
			ui: container.feature('ui'),
			os: container.feature('os'),
			grep: container.feature('grep'),
			networking: container.feature('networking'),
		})

		const parts: string[] = []

		if (calls.length > 0) {
			const consoleLines = calls.map(c => {
				const prefix = c.method === 'log' ? '' : `[${c.method}] `
				return prefix + c.args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')
			})
			parts.push(consoleLines.join('\n'))
		}

		if (result === undefined) {
			parts.push('(undefined)')
		} else if (result === null) {
			parts.push('(null)')
		} else if (typeof result === 'string') {
			parts.push(result)
		} else {
			try { parts.push(JSON.stringify(result, null, 2)) } catch { parts.push(String(result)) }
		}

		return parts.join('\n')
	} catch (err: any) {
		return `Eval error: ${err.message || err}`
	}
}

export async function askCodingAssistant({ question }: z.infer<typeof schemas.askCodingAssistant>): Promise<string> {
	try {
		const sub = await assistant.subagent('codingAssistant')
		const answer = await sub.ask(question)
		return answer
	} catch (err: any) {
		return `Error asking coding assistant: ${err.message || err}`
	}
}
