/**
 * Excalidraw Expert Demo
 *
 * Generates diagrams using the Excalidraw expert, which can:
 * - Generate Excalidraw JSON diagrams from natural language
 * - Render them to PNG images
 * - Evaluate quality using OpenAI vision
 * - Iterate to improve
 *
 * Usage:
 *   bun run scripts/examples/excalidraw-expert.ts
 *   bun run scripts/examples/excalidraw-expert.ts "a microservices architecture with api gateway"
 *   bun run scripts/examples/excalidraw-expert.ts "user auth flow" --style blueprint
 */
import container from '@soederpop/luca/agi/container.server'

const args = process.argv.slice(2)
const styleFlag = args.indexOf('--style')
const style = styleFlag !== -1 ? args[styleFlag + 1] : undefined
const prompt = args.filter((a, i) => a !== '--style' && (styleFlag === -1 || i !== styleFlag + 1)).join(' ')

const description = prompt || 'A simple flowchart showing a user login process: user enters credentials, system validates, if valid show dashboard, if invalid show error and retry'

async function main() {
	const ui = container.feature('ui')

	ui.banner('Excalidraw Expert', { font: 'Small', colors: ['cyan', 'blue'] })
	console.log()

	const expert = container.feature('expert', { name: 'excalidraw', folder: 'excalidraw' })

	// Listen to events for live feedback
	expert.on('preview' as any, (chunk: string) => {
		process.stdout.write('.')
	})

	expert.on('toolCall' as any, (name: string, args: any) => {
		console.log(`\n${ui.colors.cyan(`> ${name}`)}`)
	})

	expert.on('toolResult' as any, (name: string, result: string) => {
		try {
			const parsed = JSON.parse(result)
			if (parsed.pngPath) {
				console.log(ui.colors.green(`  Rendered: ${parsed.pngPath}`))
			}
			if (parsed.overall !== undefined) {
				const score = parsed.overall
				const color = score >= 4 ? 'green' : score >= 3 ? 'yellow' : 'red'
				console.log(ui.colors[color](`  Quality score: ${score}/5`))
			}
		} catch {}
	})

	const styleStr = style ? ` Use the "${style}" style.` : ''
	const question = `Create a diagram for: ${description}.${styleStr}

After generating it, evaluate the diagram and if it needs improvement, revise it. Aim for a quality score of 4 or higher on all dimensions.`

	console.log(ui.colors.dim(`Prompt: ${question}\n`))
	console.log(ui.colors.dim('Generating'))

	const answer = await expert.ask(question)

	console.log('\n')
	console.log(answer)
	console.log()

	const outputDir = container.paths.resolve('experts', 'excalidraw', 'output')
	console.log(ui.colors.dim(`\nOutput files in: ${outputDir}`))
	console.log(ui.colors.dim('Open diagram.excalidraw in https://excalidraw.com to edit'))
	console.log(ui.colors.dim('View diagram.png for the rendered image'))
}

main().catch(console.error)
