import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		console: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	enable: z.string().optional().describe('Enable a feature before starting the REPL (e.g. --enable diskCache)'),
	eval: z.string().optional().describe('Evaluate code, a script, or markdown file before dropping into the REPL'),
})

function resolveEvalTarget(ref: string, container: any): { type: 'code' | 'script' | 'markdown', value: string } {
	const candidates = [ref, `${ref}.ts`, `${ref}.js`, `${ref}.md`]

	for (const candidate of candidates) {
		const resolved = container.paths.resolve(candidate)
		if (container.fs.exists(resolved)) {
			if (resolved.endsWith('.md')) return { type: 'markdown', value: resolved }
			return { type: 'script', value: resolved }
		}
	}

	// Not a file — treat as inline code
	return { type: 'code', value: ref }
}

async function evalBeforeRepl(evalArg: string, container: any, featureContext: Record<string, any>): Promise<Record<string, any>> {
	const target = resolveEvalTarget(evalArg, container)
	const vm = container.feature('vm')
	const ui = container.feature('ui')
	const extraContext: Record<string, any> = {}

	if (target.type === 'markdown') {
		await container.docs.load()
		const doc = await container.docs.parseMarkdownAtPath(target.value)
		const esbuild = container.feature('esbuild')
		const shared = vm.createContext({
			console, fetch, URL, URLSearchParams,
			setTimeout, clearTimeout, setInterval, clearInterval,
			...featureContext,
			...container.context,
		})

		const children = doc.ast.children
		for (let i = 0; i < children.length; i++) {
			const node = children[i]
			if (node.type === 'code') {
				const { value, lang, meta } = node
				if (lang !== 'ts' && lang !== 'js' && lang !== 'tsx' && lang !== 'jsx') continue
				if (meta && typeof meta === 'string' && meta.toLowerCase().includes('skip')) continue

				console.log(ui.markdown(['```' + lang, value, '```'].join('\n')))

				const needsTransform = lang === 'tsx' || lang === 'jsx'
				let code = value
				if (needsTransform) {
					const { code: transformed } = esbuild.transformSync(value, { loader: lang as 'tsx' | 'jsx', format: 'cjs' })
					code = transformed
				}

				await vm.run(code, shared)
				Object.assign(shared, container.context)
			} else {
				const md = doc.stringify({ type: 'root', children: [node] })
				console.log(ui.markdown(md))
			}
		}

		Object.assign(extraContext, shared)
	} else if (target.type === 'script') {
		const code = container.fs.readFile(target.value, 'utf8')
		const ctx = vm.createContext({
			console, fetch, URL, URLSearchParams,
			setTimeout, clearTimeout, setInterval, clearInterval,
			...featureContext,
			...container.context,
		})
		await vm.run(code, ctx)
		Object.assign(extraContext, ctx)
	} else {
		const ctx = vm.createContext({
			console, fetch, URL, URLSearchParams,
			setTimeout, clearTimeout, setInterval, clearInterval,
			...featureContext,
			...container.context,
		})
		await vm.run(target.value, ctx)
		Object.assign(extraContext, ctx)
	}

	return extraContext
}

export default async function lucaConsole(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')

	await container.helpers.discoverAll()

	// make it easy to create features
	container.addContext('feature', (...args: any) => container.feature(...args))

	//this is a hack to make it so we can enable things before the console starts
	if (container.argv.enable) {
		for (const id of Array(container.argv.enable)) {
			try {
				container.feature(id, { ...container.argv, enable: true }).enable()
			} catch(error: any) {
				console.error(`Error enabling feature`, error.message)
			}
		}
	}

	const featureContext: Record<string, any> = {}
	for (const name of container.features.available) {
		try {
			featureContext[name] = container.feature(name)
		} catch {}
	}

	// Load user console module if present
	const consoleModulePath = container.paths.resolve('luca.console.ts')
	let consoleModuleLoaded = false
	let consoleModuleError: Error | null = null

	if (container.fs.exists(consoleModulePath)) {
		try {
			const vmFeature = container.feature('vm')
			const userExports = vmFeature.loadModule(consoleModulePath, { container, console })
			Object.assign(featureContext, userExports)
			consoleModuleLoaded = true
		} catch (err: any) {
			consoleModuleError = err
		}
	}

	// Run --eval target before starting the REPL
	let evalContext: Record<string, any> = {}
	if (options.eval) {
		try {
			evalContext = await evalBeforeRepl(options.eval, container, featureContext)
		} catch (err: any) {
			console.error(ui.colors.red(`  Error evaluating: ${err.message}`))
		}
	}

	const prompt = ui.colors.cyan('luca') + ui.colors.dim(' > ')

	console.log()
	console.log(ui.colors.dim('  Luca REPL — all container features in scope. Tab to autocomplete.'))
	if (options.eval) {
		console.log(ui.colors.dim(`  Evaluated: ${options.eval}`))
	}
	if (consoleModuleLoaded) {
		console.log(ui.colors.dim('  Loaded luca.console.ts exports into scope.'))
	} else if (consoleModuleError) {
		console.log(ui.colors.yellow('  ⚠ Failed to load luca.console.ts:'))
		console.log(ui.colors.yellow(`    ${consoleModuleError.message}`))
		console.log(ui.colors.dim('  The REPL will start without your custom exports.'))
	}
	console.log(ui.colors.dim('  Type .exit to quit.'))
	console.log()

	const repl = container.feature('repl', { prompt })
	await repl.start({
		context: {
			...featureContext,
			...evalContext,
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

commands.registerHandler('console', {
	description: 'Start an interactive REPL with all container features in scope',
	argsSchema,
	handler: lucaConsole,
})
