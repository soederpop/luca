import { z } from 'zod'
import type { ContainerContext } from 'luca'
import { CommandOptionsSchema } from 'luca/schemas'
import {
	buildRuntimePackage,
	buildRuntimeBlobIndex,
	expandVendorPackages,
	generateEmbeddedRuntimeModule,
} from '../src/cli/bundle-utils.js'

export const argsSchema = CommandOptionsSchema.extend({})

/**
 * Prebundles the consumer runtime (runtime-barrel.ts plus specifier shims and
 * vendored native packages) into a single artifacts.blob and regenerates
 * embedded.generated.ts, so the compiled luca binary carries everything
 * `luca bundle` needs to produce new binaries without any package
 * installation. Runs as part of `bun compile`.
 */
async function buildRuntime(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')
	const ui = container.feature('ui')

	const barrelPath = container.paths.resolve('src/bundle-runtime/runtime-barrel.ts')
	const artifactsDir = container.paths.resolve('src/bundle-runtime/artifacts')
	const blobPath = container.paths.resolve('src/bundle-runtime/artifacts.blob')
	const generatedPath = container.paths.resolve('src/bundle-runtime/embedded.generated.ts')
	const pkg = JSON.parse(String(fs.readFile(container.paths.resolve('package.json'))))

	ui.print.info('Prebundling consumer runtime...')
	fs.rmdirSync(artifactsDir)

	// Reset to the stub before bundling: the runtime includes the bundle
	// command, and prebundling it against a populated embedded module would
	// recursively pull the previous blob in as an asset.
	fs.writeFile(generatedPath, generateEmbeddedRuntimeModule([]))

	const { files } = await buildRuntimePackage(container, {
		barrelPath,
		outDir: artifactsDir,
		version: pkg.version,
	})
	const vendorPackages = expandVendorPackages(container, container.paths.resolve('node_modules'))

	// Collect blob entries: the synthesized luca package, then each vendored
	// package's original npm files under a __vendor/ prefix.
	const blobFiles: Array<{ path: string; absPath: string }> = files.map((f: string) => ({
		path: f,
		absPath: container.paths.resolve(artifactsDir, f),
	}))

	for (const vendorName of vendorPackages) {
		const vendorDir = container.paths.resolve('node_modules', vendorName)
		if (!fs.existsSync(vendorDir)) {
			throw new Error(`Vendored package ${vendorName} not found at ${vendorDir}`)
		}
		const { files: vendorFiles } = fs.walk(vendorDir, { relative: true })
		for (const vf of vendorFiles as string[]) {
			const rel = vf.split('\\').join('/')
			blobFiles.push({
				path: `__vendor/${vendorName}/${rel}`,
				absPath: container.paths.resolve(vendorDir, vf),
			})
		}
	}

	const buffers: Buffer[] = []
	const sizes: Array<{ path: string; size: number }> = []
	for (const entry of blobFiles) {
		const buf = fs.readFile(entry.absPath, null) as Buffer
		buffers.push(buf)
		sizes.push({ path: entry.path, size: buf.length })
	}
	const blob = Buffer.concat(buffers)
	fs.writeFile(blobPath, blob)
	fs.writeFile(generatedPath, generateEmbeddedRuntimeModule(buildRuntimeBlobIndex(sizes)))

	ui.print.success(`Prebundled ${blobFiles.length} runtime file(s) (${Math.round(blob.length / 1024 / 1024)} MB blob)`)
	ui.print.dim(`  wrote ${blobPath}`)
	ui.print.dim(`  wrote ${generatedPath}`)
}

export default buildRuntime
export const description = 'Prebundle the consumer runtime artifacts embedded by luca bundle'
