import { z } from 'zod'
import { inspect } from 'util'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		eval: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	json: z.boolean().default(false).describe('Serialize output as JSON'),
	enable: z.string().optional().describe('Enable a feature before evaluating (e.g. --enable diskCache)'),
})

export default async function evalCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	container.addContext('feature', (...args: any) => container.feature(...args))

	await container.helpers.discoverAll()
	
	const args = container.argv._ as string[]
	// args[0] is "eval", the rest is the code snippet
	const code = args.slice(1).join(' ')

	if (!code.trim()) {
		console.error('Usage: luca eval "<code>" [--json]')
		return
	}

	const vm = container.feature('vm')

	// HACK
	Array(container.argv.enable).filter(Boolean).map((id) => {
		container.feature(id, { ...container.argv, enable: true }).enable()
	})

	// Build context with container and all enabled feature instances
	const ctx: Record<string, any> = { container }
	for (const [name, instance] of Object.entries(container.enabledFeatures ?? {})) {
		ctx[name] = instance
	}

	const result = await vm.run(code, ctx)

	if (options.json) {
		console.log(JSON.stringify(result, null, 2))
	} else {
		displayResult(result)
	}
}

const BUILTIN_TYPES = new Set(['Object', 'Array', 'Map', 'Set', 'Date', 'RegExp', 'Promise', 'Error', 'Number', 'String', 'Boolean'])

export function displayResult(value: any) {
	if (typeof value !== 'object' || value === null) {
		console.log(value)
		return
	}

	const hasCustomInspect = typeof value[Symbol.for('nodejs.util.inspect.custom')] === 'function'
	const ctorName = value.constructor?.name
	const isClassInstance = ctorName && !BUILTIN_TYPES.has(ctorName)

	// Objects with custom inspect or builtins: use standard inspect
	if (hasCustomInspect || !isClassInstance) {
		console.log(inspect(value, { colors: true, depth: 4 }))
		return
	}

	// Class instances: show clean data (no _ props, no functions)
	const data: Record<string, any> = {}
	for (const [k, v] of Object.entries(value)) {
		if (k.startsWith('_') || typeof v === 'function') continue
		data[k] = v
	}
	const body = inspect(data, { colors: true, depth: 3 })
	console.log(`${ctorName} ${body}`)

	// Collect methods and getters from own + prototype chain
	const methods: string[] = []
	const getters: string[] = []

	for (const [k, v] of Object.entries(value)) {
		if (k.startsWith('_')) continue
		if (typeof v === 'function') methods.push(k)
	}

	let proto = Object.getPrototypeOf(value)
	while (proto && proto !== Object.prototype) {
		for (const k of Object.getOwnPropertyNames(proto)) {
			if (k === 'constructor' || k.startsWith('_')) continue
			const desc = Object.getOwnPropertyDescriptor(proto, k)
			if (!desc) continue
			if (desc.get && !getters.includes(k)) getters.push(k)
			else if (typeof desc.value === 'function' && !methods.includes(k)) methods.push(k)
		}
		proto = Object.getPrototypeOf(proto)
	}

	if (getters.length || methods.length) {
		const parts: string[] = []
		if (getters.length) parts.push(`  \x1b[36mgetters:\x1b[0m ${getters.sort().join(', ')}`)
		if (methods.length) parts.push(`  \x1b[36mmethods:\x1b[0m ${methods.sort().map(m => m + '()').join(', ')}`)
		console.log(parts.join('\n'))
	}
}

commands.registerHandler('eval', {
	description: 'Evaluate a JavaScript/TypeScript expression with the container in scope',
	argsSchema,
	handler: evalCommand,
})
