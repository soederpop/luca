import { typesBundle, typesBundleVersion } from './generated-types.js'

/** Relative directory (from the project root) where the type declarations are written. */
export const TYPES_DIR = '.luca/types'

/**
 * The tsconfig.json content written into consumer projects. `paths` mirrors
 * luca's package.json exports map so `import ... from 'luca'` (and subpaths)
 * plus `import { z } from 'zod'` resolve against the shipped declaration tree
 * — no npm install, no node_modules.
 */
export function defaultTsconfig(): Record<string, any> {
	// Paths are relative to the tsconfig (no baseUrl — removed in TypeScript 6)
	const t = (p: string) => [`./${TYPES_DIR}/${p}`]
	return {
		compilerOptions: {
			target: 'esnext',
			module: 'esnext',
			moduleResolution: 'bundler',
			strict: true,
			noEmit: true,
			skipLibCheck: true,
			allowImportingTsExtensions: true,
			// process/console/Buffer globals come from the vendored @types/node
			typeRoots: [`./${TYPES_DIR}/deps/@types`],
			types: ['node'],
			paths: {
				'luca': t('node.d.ts'),
				'luca/node': t('node.d.ts'),
				'luca/web': t('browser.d.ts'),
				'luca/agi': t('agi/index.d.ts'),
				'luca/schemas': t('schemas/base.d.ts'),
				'luca/commands': t('commands/index.d.ts'),
				'luca/container': t('container.d.ts'),
				'luca/client': t('client.d.ts'),
				'luca/server': t('server.d.ts'),
				'luca/feature': t('feature.d.ts'),
				'luca/react': t('react/index.d.ts'),
				'luca/introspection': t('introspection/index.d.ts'),
				'luca/cli/runner': t('cli/runner.d.ts'),
				'luca/*': t('*'),
				'zod': t('deps/zod/index.d.ts'),
				'zod/*': t('deps/zod/*'),
				'contentbase': t('deps/contentbase/dist/index.d.ts'),
				'contentbase/*': t('deps/contentbase/dist/*'),
			},
		},
		include: ['**/*.ts', '**/*.tsx'],
		exclude: ['node_modules', TYPES_DIR],
	}
}

export interface WriteTypesResult {
	filesWritten: number
	typesDir: string
	tsconfigWritten: boolean
	version: string
}

/**
 * Write the embedded declaration tree into `<projectRoot>/.luca/types/` and a
 * `tsconfig.json` (only when missing) so the project gets IDE autocomplete for
 * luca and zod straight from the binary. Idempotent — re-running refreshes the
 * declaration tree in place.
 *
 * @param fs - the container's `fs` feature
 * @param projectRoot - absolute path to the consumer project root
 */
export async function writeProjectTypes(fs: any, projectRoot: string): Promise<WriteTypesResult> {
	const typesRoot = `${projectRoot}/${TYPES_DIR}`

	const dirs = new Set<string>()
	for (const relPath of Object.keys(typesBundle)) {
		const dir = relPath.includes('/') ? relPath.slice(0, relPath.lastIndexOf('/')) : ''
		if (dir) dirs.add(dir)
	}
	await fs.ensureFolderAsync(typesRoot)
	for (const dir of [...dirs].sort()) {
		await fs.ensureFolderAsync(`${typesRoot}/${dir}`)
	}
	for (const [relPath, content] of Object.entries(typesBundle)) {
		await fs.writeFileAsync(`${typesRoot}/${relPath}`, content)
	}

	const tsconfigPath = `${projectRoot}/tsconfig.json`
	let tsconfigWritten = false
	if (!fs.exists(tsconfigPath)) {
		await fs.writeFileAsync(tsconfigPath, JSON.stringify(defaultTsconfig(), null, 2) + '\n')
		tsconfigWritten = true
	}

	return {
		filesWritten: Object.keys(typesBundle).length,
		typesDir: typesRoot,
		tsconfigWritten,
		version: typesBundleVersion,
	}
}
