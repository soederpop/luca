import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		run: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	safe: z.boolean().default(false).describe('Require approval before each code block (markdown mode)'),
})

function resolveScript(ref: string, context: ContainerContext): string | null {
	const container = context.container as any
	const candidates = [
		ref,
		`${ref}.ts`,
		`${ref}.js`,
		`${ref}.md`,
	]

	for (const candidate of candidates) {
		const resolved = container.paths.resolve(candidate)
		if (container.fs.exists(resolved)) return resolved
	}

	return null
}

async function runMarkdown(scriptPath: string, options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const requireApproval = options.safe
	await container.docs.load()

	const doc = await container.docs.parseMarkdownAtPath(scriptPath)

	const vm = container.feature('vm')
	const shared = vm.createContext({ console, ...container.context })

	for (const node of doc.ast.children) {
		if (node.type === 'code') {
			const { value, lang, meta } = node

			if (lang !== 'ts' && lang !== 'js') continue

			if (meta && typeof meta === 'string' && meta.toLowerCase().includes('skip')) continue

			console.log(container.ui.markdown(['```' + lang, value, '```'].join('\n')))

			if (requireApproval) {
				const answer = await container.ui.askQuestion('Run this block? (y/n)')
				if (answer.question.toLowerCase() !== 'y') continue
			}

			await vm.run(`(async function() { ${value} })()`, shared)
		} else {
			const md = doc.stringify({ type: 'root', children: [node] })
			console.log(container.ui.markdown(md))
		}
	}
}

async function runScript(scriptPath: string, context: ContainerContext) {
	const container = context.container as any

	const { exitCode, stderr } = await container.proc.runScript(scriptPath)

	if (exitCode === 0) return

	console.log(`\nScript failed with exit code ${exitCode}. Asking codebase expert to diagnose...\n`)

	const expert = container.feature('expert', {
		folder: 'codebase',
		name: 'luca-codebase-expert',
	})

	await expert.start()

	expert.conversation!.on('preview', (chunk: string) => {
		console.clear()
		console.log(container.ui.markdown(chunk))
	})

	expert.conversation!.on('toolCall', (name: string) => {
		console.log(container.ui.markdown(`\n> **Running skill:** \`${name}\`\n`))
	})

	const prompt = [
		`I ran the script \`${scriptPath}\` and it failed with exit code ${exitCode}.`,
		'',
		'Here is the error / stack trace (last 100 lines):',
		'```',
		stderr.join('\n'),
		'```',
		'',
		'Explain what likely caused this error and how to fix it.',
	].join('\n')

	const result = await expert.ask(prompt)
	console.clear()
	console.log(container.ui.markdown(result))
}

async function diagnoseError(scriptPath: string, error: Error, context: ContainerContext) {
	const container = context.container as any

	console.error(`\n${error.stack || error.message}\n`)
	console.log(`Asking codebase expert to diagnose...\n`)

	const expert = container.feature('expert', {
		folder: 'codebase',
		name: 'luca-codebase-expert',
	})

	await expert.start()

	expert.conversation!.on('preview', (chunk: string) => {
		console.clear()
		console.log(container.ui.markdown(chunk))
	})

	expert.conversation!.on('toolCall', (name: string) => {
		console.log(container.ui.markdown(`\n> **Running skill:** \`${name}\`\n`))
	})

	const prompt = [
		`I ran the script \`${scriptPath}\` and it threw an error.`,
		'',
		'Here is the error / stack trace:',
		'```',
		error.stack || error.message,
		'```',
		'',
		'Explain what likely caused this error and how to fix it.',
	].join('\n')

	const result = await expert.ask(prompt)
	console.clear()
	console.log(container.ui.markdown(result))
}

export default async function run(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fileRef = container.argv._[1] as string

	if (!fileRef) {
		console.error('Usage: luca run <file>')
		process.exit(1)
	}

	const scriptPath = resolveScript(fileRef, context)

	if (!scriptPath) {
		console.error(`Could not find script: ${fileRef}`)
		process.exit(1)
	}

	try {
		if (scriptPath.endsWith('.md')) {
			await runMarkdown(scriptPath, options, context)
		} else {
			await runScript(scriptPath, context)
		}
	} catch (err: any) {
		await diagnoseError(scriptPath, err instanceof Error ? err : new Error(String(err)), context)
	}
}

commands.registerHandler('run', {
	description: 'Run a script file with auto-error-diagnosis',
	argsSchema,
	handler: run,
})
