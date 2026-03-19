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
	console: z.boolean().default(false).describe('Start an interactive REPL after executing a markdown file, with all accumulated context'),
	onlySections: z.string().optional().describe('Comma-separated list of section headings to run (case-insensitive, markdown only)'),
	dontInjectContext: z.boolean().default(false).describe('Skip auto-injecting container context into scripts (run with plain bun instead)'),
})

/**
 * Convert esbuild ESM output imports/exports to CJS require/module.exports
 * so the code can run in a vm context that provides `require`.
 */
function esmToCjs(code: string): string {
	return code
		// import { a, b } from 'x' → const { a, b } = require('x')
		.replace(/^import\s+\{([^}]+)\}\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
			'const {$1} = require($2);')
		// import x from 'y' → const x = require('y').default ?? require('y')
		.replace(/^import\s+(\w+)\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
			'const $1 = require($2).default ?? require($2);')
		// import * as x from 'y' → const x = require('y')
		.replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
			'const $1 = require($2);')
		// import 'y' → require('y')
		.replace(/^import\s+(['"][^'"]+['"])\s*;?$/gm,
			'require($1);')
		// export default → module.exports.default =
		.replace(/^export\s+default\s+/gm, 'module.exports.default = ')
		// export { ... } → strip (vars already in scope)
		.replace(/^export\s+\{[^}]*\}\s*;?$/gm, '')
		// export const/let/var → const/let/var
		.replace(/^export\s+(const|let|var)\s+/gm, '$1 ')
}

function hasTLA(code: string): boolean {
	// Quick check: contains await outside of async function bodies
	// This is a heuristic — wrapTopLevelAwait does the real work
	return /\bawait\b/.test(code) && !/^\s*\(?\s*async\b/.test(code)
}

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

/**
 * Find the ## Blocks section in the AST and return the indices to skip
 * plus the tsx/jsx code block values to register.
 */
function extractBlocksSection(children: any[]): { skipIndices: Set<number>, blockSources: string[] } {
	const skipIndices = new Set<number>()
	const blockSources: string[] = []

	let inBlocks = false
	for (let i = 0; i < children.length; i++) {
		const node = children[i]

		if (node.type === 'heading' && node.depth === 2) {
			const text = (node.children || []).map((c: any) => c.value || '').join('').trim()
			if (text === 'Blocks') {
				inBlocks = true
				skipIndices.add(i)
				continue
			} else if (inBlocks) {
				// hit the next ## heading — stop collecting
				break
			}
		}

		if (inBlocks) {
			skipIndices.add(i)
			if (node.type === 'code' && (node.lang === 'tsx' || node.lang === 'jsx')) {
				blockSources.push(node.value)
			}
		}
	}

	return { skipIndices, blockSources }
}

async function runMarkdown(scriptPath: string, options: z.infer<typeof argsSchema>, context: ContainerContext) {
	console.clear()
	const container = context.container as any
	const requireApproval = options.safe
	await container.docs.load()

	const doc = await container.docs.parseMarkdownAtPath(scriptPath)

	const esbuild = container.feature('esbuild')
	const ink = container.feature('ink', { enable: true })
	await ink.loadModules()

	const vm = container.feature('vm')
	const render = async (name: string, data?: any) => ink.renderBlock(name, data)
	const renderAsync = async (name: string, data?: any, options?: { timeout?: number }) => ink.renderBlockAsync(name, data, options)
	const shared = vm.createContext({
		console, ink, render, renderAsync,
		setTimeout, clearTimeout, setInterval, clearInterval,
		fetch, URL, URLSearchParams,
		...container.context,
		$doc: doc
	})

	// ─── Parse and register ## Blocks section ──────────────────────────
	const { skipIndices, blockSources } = extractBlocksSection(doc.ast.children)

	for (const source of blockSources) {
		const keysBefore = new Set(Object.keys(shared))
		const { code: transformed } = esbuild.transformSync(source, { loader: 'tsx', format: 'cjs' })

		await vm.run(transformed, shared)

		// auto-register any new functions as blocks
		for (const key of Object.keys(shared)) {
			if (!keysBefore.has(key) && typeof shared[key] === 'function') {
				ink.registerBlock(key, shared[key])
			}
		}
	}

	// ─── Build section filter from --only-sections ───────────────────
	let allowedIndices: Set<number> | null = null
	if (options.onlySections) {
		const requestedSections = options.onlySections.split(',').map(s => s.trim())
		allowedIndices = new Set<number>()
		for (const sectionName of requestedSections) {
			try {
				const sectionNodes = doc.extractSection(sectionName)
				for (const node of sectionNodes) {
					const idx = doc.ast.children.indexOf(node as any)
					if (idx !== -1) allowedIndices.add(idx)
				}
			} catch {
				// Section not found — skip silently
			}
		}
	}

	// ─── Execute document ──────────────────────────────────────────────
	const children = doc.ast.children
	for (let i = 0; i < children.length; i++) {
		if (skipIndices.has(i)) continue
		if (allowedIndices && !allowedIndices.has(i)) continue

		const node = children[i]
		if (node.type === 'code') {
			const { value, lang, meta } = node

			if (lang !== 'ts' && lang !== 'js' && lang !== 'tsx' && lang !== 'jsx') {
				console.log(container.ui.markdown(['```' + (lang || ''), value, '```'].join('\n')))
				continue
			}

			if (meta && typeof meta === 'string' && meta.toLowerCase().includes('skip')) continue

			console.log(container.ui.markdown(['```' + lang, value, '```'].join('\n')))

			if (requireApproval) {
				const answer = await container.ui.askQuestion('Run this block? (y/n)')
				if (answer.question.toLowerCase() !== 'y') continue
			}

			// Transform tsx/jsx through esbuild, and also ts for consistency
			const needsTransform = lang === 'tsx' || lang === 'jsx'
			let code = value

			if (needsTransform) {
				const { code: transformed } = esbuild.transformSync(value, {
					loader: lang as 'tsx' | 'jsx',
					format: 'cjs',
				})
				code = transformed
			}

			await vm.run(code, shared)

			// if we enabled any features, they will be in the context object
			Object.assign(shared, container.context)
		} else {
			const md = doc.stringify({ type: 'root', children: [node] })
			console.log(container.ui.markdown(md))
		}
	}

	return shared
}

async function runScript(scriptPath: string, context: ContainerContext, options: { dontInjectContext?: boolean } = {}) {
	const container = context.container as any

	if (options.dontInjectContext) {
		const { exitCode, stderr } = await container.proc.execAndCapture(`bun run ${scriptPath}`, {
			onOutput: (data: string) => process.stdout.write(data),
			onError: (data: string) => process.stderr.write(data),
		})

		if (exitCode === 0) return

		console.error(`\nScript failed with exit code ${exitCode}.\n`)
		if (stderr.length) {
			console.error(stderr)
		}
		return
	}

	const vm = container.feature('vm')
	const esbuild = container.feature('esbuild')
	const raw = container.fs.readFile(scriptPath)

	let code: string
	if (hasTLA(raw)) {
		// TLA is incompatible with CJS format, so transform as ESM (preserves await)
		// then convert import/export statements to require/module.exports for the vm
		const { code: esm } = esbuild.transformSync(raw, { format: 'esm' })
		code = esmToCjs(esm)
	} else {
		const { code: cjs } = esbuild.transformSync(raw, { format: 'cjs' })
		code = cjs
	}

	const ctx = {
		require: vm.createRequireFor(scriptPath),
		exports: {},
		module: { exports: {} },
		console,
		setTimeout, setInterval, clearTimeout, clearInterval,
		process, Buffer, URL, URLSearchParams,
		fetch,
		...container.context,
	}

	await vm.run(code, ctx)
}

async function diagnoseError(_scriptPath: string, error: Error, _context: ContainerContext) {
	console.error(`\n${error.stack || error.message}\n`)
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
			const shared = await runMarkdown(scriptPath, options, context)

			if (options.console) {
				const ui = container.feature('ui')
				const prompt = ui.colors.cyan('luca') + ui.colors.dim(' > ')

				console.log()
				console.log(ui.colors.dim('  Entering REPL with markdown context. Type .exit to quit.'))
				console.log()

				const repl = container.feature('repl', { prompt })
				await repl.start({
					context: {
						...shared,
						console,
						setTimeout,
						setInterval,
						clearTimeout,
						clearInterval,
						fetch,
						Bun,
					},
				})
			}
		} else {
			await runScript(scriptPath, context, { dontInjectContext: options.dontInjectContext })
		}
	} catch (err: any) {
		await diagnoseError(scriptPath, err instanceof Error ? err : new Error(String(err)), context)
	}
}

commands.registerHandler('run', {
	description: 'Run a script or markdown file (.ts, .js, .md)',
	argsSchema,
	handler: run,
})
