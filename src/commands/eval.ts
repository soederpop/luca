import { z } from 'zod'
import { commands } from '../command.js'
import { displayResult } from '../node/features/display-result.js'
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
	let code = args.slice(1).join(' ')

	// Read from stdin if no inline code was provided
	if (!code.trim()) {
		code = await Bun.stdin.text()
	}

	if (!code.trim()) {
		console.error('Usage: luca eval "<code>" [--json]')
		return
	}

	const vm = container.feature('vm')

	// The command promises TypeScript: strip TS syntax before evaluating.
	// Valid JS passes through semantically unchanged, and the normalized
	// output makes the top-level-await boundary scan more reliable.
	try {
		code = container.feature('transpiler').transformSync(code, { loader: 'ts' }).code
	} catch {
		// Leave the input as written — vm.run will surface the real syntax
		// error with the user's own code in the message, not the transpiler's.
	}

	// HACK
	Array(container.argv.enable).filter(Boolean).map((id) => {
		container.feature(id, { ...container.argv, enable: true }).enable()
	})

	// Build context with container and all enabled feature instances.
	// `z` is in scope like it is in runnable markdown blocks — eval is where
	// schemas get prototyped (container.store, argsSchema, tool schemas).
	// `require` resolves virtual modules first ('luca', 'zod', 'react', …),
	// matching what commands and scripts see.
	container.helpers.seedVirtualModules()
	const ctx: Record<string, any> = {
		container,
		z,
		require: vm.createRequireFor(container.paths.resolve('__eval__.ts')),
	}
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

export { displayResult } from '../node/features/display-result.js'

export const positionals = [
	{ name: 'expression', description: 'JS/TS code to evaluate — the value of the final expression is printed' },
]

export const examples = [
	'luca eval "container.features.available"',
	{ command: 'luca eval "await container.feature(\'fs\').readFileAsync(\'package.json\')" --json', description: 'Top-level await works; --json serializes the result' },
	{ command: 'luca eval "diskCache.keys()" --enable diskCache', description: 'Enable a feature before evaluating' },
	{ command: 'luca eval "z.object({ port: z.number() }).parse({ port: 3000 })"', description: 'z (zod) is in scope — prototype schemas directly' },
]

commands.registerHandler('eval', {
	description: 'Evaluate JS/TS with the container in scope — prints the value of the final expression; top-level await works',
	argsSchema,
	positionals,
	examples,
	handler: evalCommand,
})
