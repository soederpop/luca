import { z } from 'zod'
import type { ContainerContext } from '../src/node'
import { CommandOptionsSchema } from '../src/schemas/base'

export const argsSchema = CommandOptionsSchema.extend({})

/**
 * Bundle the embedding worker daemon (src/embeddings/worker.ts) into
 * src/embeddings/generated.ts as a string constant, so the compiled luca binary
 * can materialize it to disk and spawn it under an external bun.
 *
 * Mirrors build-python-bridge. Run as part of the compile chain.
 */
async function buildEmbeddingWorker(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')

	const sourcePath = 'src/embeddings/worker.ts'
	const outputPath = 'src/embeddings/generated.ts'

	if (!fs.exists(sourcePath)) {
		console.error(`   ❌ ${sourcePath} not found`)
		process.exit(1)
	}

	const content = fs.readFile(sourcePath)
	console.log(`   📄 worker.ts: ${content.length} chars`)

	const escapeForTemplate = (s: string) =>
		s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

	const output = `// Auto-generated embedding worker script
// Source: src/embeddings/worker.ts
//
// Do not edit manually. Run: luca build-embedding-worker

export const embeddingWorkerScript = \`${escapeForTemplate(content)}\`
`

	fs.ensureFolder('src/embeddings')
	await fs.writeFileAsync(outputPath, output)
	console.log(`\n✨ Generated ${outputPath}`)
}

export default {
	description: 'Bundle the embedding worker daemon into src/embeddings/generated.ts',
	argsSchema,
	handler: buildEmbeddingWorker,
}
