import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({})

async function buildPythonBridge(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')

	const sourcePath = 'src/python/bridge.py'
	const outputPath = 'src/python/generated.ts'

	if (!fs.exists(sourcePath)) {
		console.error(`   ❌ ${sourcePath} not found`)
		process.exit(1)
	}

	const content = fs.readFile(sourcePath)
	console.log(`   📄 bridge.py: ${content.length} chars`)

	const escapeForTemplate = (s: string) =>
		s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

	const output = `// Auto-generated Python bridge script
// Generated at: ${new Date().toISOString()}
// Source: src/python/bridge.py
//
// Do not edit manually. Run: luca build-python-bridge

export const bridgeScript = \`${escapeForTemplate(content)}\`
`

	fs.ensureFolder('src/python')
	await fs.writeFileAsync(outputPath, output)
	console.log(`\n✨ Generated ${outputPath}`)
}

export default {
	description: 'Bundle the Python bridge script into src/python/generated.ts',
	argsSchema,
	handler: buildPythonBridge,
}
