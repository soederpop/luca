import { z } from 'zod'
import { commands } from '../command.js'
import { selectors } from '../selector.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		select: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	json: z.boolean().default(false).describe('Output result as raw JSON (data only, no metadata)'),
	noCache: z.boolean().default(false).describe('Skip cache lookup and force a fresh run'),
})

export default async function selectCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')
	const args = container.argv._ as string[]
	const name = args[1]

	// Discover project selectors
	await container.helpers.discoverAll()

	if (!name) {
		const available = selectors.available
		if (available.length === 0) {
			ui.print('No selectors available.')
			ui.print.dim('Create one: luca scaffold selector <name>')
		} else {
			ui.print.cyan('\n  luca select <name> [--json] [--no-cache]\n')
			ui.print('  Available selectors:\n')
			for (const s of available) {
				ui.print.green(`    ${s}`)
			}
			ui.print('')
		}
		return
	}

	const instance = container.select(name)

	// Pass remaining args (after command name and selector name) as input
	const selectorArgs: Record<string, any> = { ...options }
	delete selectorArgs._
	delete selectorArgs.json
	delete selectorArgs.noCache
	delete selectorArgs.cache
	delete selectorArgs.dispatchSource

	// minimist turns --no-cache into { cache: false }
	const skipCache = options.noCache || (container.argv.cache === false)

	if (skipCache) {
		// Bypass cache by calling run() directly with proper lifecycle
		const Cls = instance.constructor as any
		const parsed = Cls.argsSchema.parse(selectorArgs)
		instance.state.set('running', true)
		instance.emit('started')
		let data: any
		try {
			data = await instance.run(parsed, instance.context)
			instance.state.set('running', false)
			instance.state.set('lastRanAt', Date.now())
			instance.emit('completed', data)
		} catch (err: any) {
			instance.state.set('running', false)
			instance.emit('failed', err)
			throw err
		}
		if (options.json) {
			console.log(JSON.stringify(data, null, 2))
		} else {
			console.log(JSON.stringify({ data, cached: false }, null, 2))
		}
		return
	}

	const result = await instance.select(selectorArgs)

	if (options.json) {
		console.log(JSON.stringify(result.data, null, 2))
	} else {
		console.log(JSON.stringify(result, null, 2))
	}
}

commands.registerHandler('select', {
	description: 'Run a selector and display its cached or fresh data',
	argsSchema,
	handler: selectCommand,
})
