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
	model: z.string().default('gpt-4o').describe('The model to use for the oracle'),
	'no-ai': z.boolean().optional().describe('Start a plain REPL without AI'),
})

export default async function oracleConsole(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	if (options['no-ai'] || container.argv['no-ai']) {
		await startPlainRepl(container)
		return
	}

	const model = options.model || container.argv.model || 'gpt-4o'
	const oracle = container.feature('oracle', { model })
	await oracle.start()
}

async function startPlainRepl(container: any) {
	const ui = container.feature('ui')
	const vmFeature = container.feature('vm')

	const featureContext: Record<string, any> = {}
	for (const name of container.features.available) {
		try {
			featureContext[name] = container.feature(name)
		} catch {}
	}

	const vmContext = vmFeature.createContext({
		...featureContext,
		console,
		setTimeout,
		setInterval,
		clearTimeout,
		clearInterval,
		fetch,
		Bun,
	})

	const readlineModule = await import('readline')
	const rl = readlineModule.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: true,
	})

	const prompt = ui.colors.cyan('luca') + ui.colors.dim(' > ')

	console.log()
	console.log(ui.colors.dim('  Luca REPL — all container features in scope.'))
	console.log(ui.colors.dim('  Type .exit to quit.'))
	console.log()

	const ask = (): void => {
		rl.question(prompt, async (input) => {
			const trimmed = input.trim()
			if (!trimmed) { ask(); return }
			if (trimmed === '.exit' || trimmed === 'exit') { rl.close(); return }

			try {
				const result = await vmFeature.run(trimmed, vmContext)
				if (result !== undefined) {
					if (typeof result === 'object' && result !== null) {
						console.log(Bun.inspect(result, { colors: true, depth: 4 }))
					} else {
						console.log(result)
					}
				}
			} catch (err: any) {
				console.log(ui.colors.red(`Error: ${err.message}`))
			}

			ask()
		})
	}

	ask()
}

commands.registerHandler('console', {
	description: 'Start an interactive oracle console',
	argsSchema,
	handler: oracleConsole,
})
