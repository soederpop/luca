import { describe, expect, it } from 'bun:test'
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import '../src/commands/setup'
import '../src/commands/bootstrap'
import { commands } from '../src/command'
import container from '../src/agi'
import { lucaHome, lucaHomeNodeModules } from '../src/setup/paths'
import { selectInstallCommand, sharedModulePath } from '../src/setup/native-install'
import { writeProjectTypes, defaultTsconfig, TYPES_DIR } from '../src/setup/write-types'
import { typesBundle, typesBundleVersion } from '../src/setup/generated-types'
import { ensureGitignore, GITIGNORE_ENTRIES, DEFAULT_ENV } from '../src/commands/bootstrap'

const uiStub = (() => {
	const noop = () => {}
	const print: any = noop
	for (const c of ['cyan', 'green', 'yellow', 'red', 'dim', 'info', 'success', 'error']) print[c] = noop
	return { print }
})()

describe('setup command', () => {
	it('registers as a built-in command', () => {
		expect(commands.has('setup')).toBe(true)
		const Setup = commands.lookup('setup') as any
		expect(Setup.commandDescription).toContain('One-time machine setup')
	})

	it('does not change anything when non-interactive with no flags', async () => {
		const cmd = container.command('setup' as any)
		await cmd.dispatch({}, 'headless')
	})
})

describe('setup paths', () => {
	it('respects the LUCA_HOME override', () => {
		const prev = process.env.LUCA_HOME
		try {
			process.env.LUCA_HOME = '/custom/home'
			expect(lucaHome()).toBe('/custom/home')
			expect(lucaHomeNodeModules()).toBe('/custom/home/node_modules')
			expect(sharedModulePath('node-llama-cpp')).toBe('/custom/home/node_modules/node-llama-cpp')
		} finally {
			if (prev === undefined) delete process.env.LUCA_HOME
			else process.env.LUCA_HOME = prev
		}
	})

	it('defaults to ~/.luca', () => {
		const prev = process.env.LUCA_HOME
		try {
			delete process.env.LUCA_HOME
			expect(lucaHome().endsWith('/.luca')).toBe(true)
		} finally {
			if (prev !== undefined) process.env.LUCA_HOME = prev
		}
	})
})

describe('native install command selection', () => {
	it('prefers bun, falls back to npm, and reports when neither is available', () => {
		const pkg = 'node-llama-cpp@3.17.1'
		expect(selectInstallCommand(pkg, { bun: true, npm: true })).toBe(`bun add --optional ${pkg}`)
		expect(selectInstallCommand(pkg, { bun: false, npm: true })).toBe(`npm install --save-optional ${pkg}`)
		expect(selectInstallCommand(pkg, { bun: false, npm: false })).toBeNull()
	})
})

describe('types bundle', () => {
	it('contains the luca entry points and vendored zod declarations', () => {
		expect(typesBundle['node.d.ts']).toBeDefined()
		expect(typesBundle['schemas/base.d.ts']).toBeDefined()
		expect(typesBundle['deps/zod/index.d.ts']).toBeDefined()
		expect(typesBundleVersion.length).toBeGreaterThan(0)
	})

	it('writeProjectTypes writes the tree and a tsconfig, preserving an existing tsconfig', async () => {
		const fs = container.feature('fs')
		const root = mkdtempSync(join(tmpdir(), 'luca-setup-types-'))

		const first = await writeProjectTypes(fs, root)
		expect(first.filesWritten).toBe(Object.keys(typesBundle).length)
		expect(first.tsconfigWritten).toBe(true)
		expect(existsSync(join(root, TYPES_DIR, 'node.d.ts'))).toBe(true)
		expect(existsSync(join(root, TYPES_DIR, 'deps/zod/index.d.ts'))).toBe(true)

		const tsconfig = JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'))
		expect(tsconfig.compilerOptions.paths['luca'][0]).toBe(`./${TYPES_DIR}/node.d.ts`)
		expect(tsconfig.compilerOptions.paths['zod'][0]).toBe(`./${TYPES_DIR}/deps/zod/index.d.ts`)

		// A user-customized tsconfig must survive a re-run
		writeFileSync(join(root, 'tsconfig.json'), '{"custom": true}\n')
		const second = await writeProjectTypes(fs, root)
		expect(second.tsconfigWritten).toBe(false)
		expect(JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8')).custom).toBe(true)
	})

	it('defaultTsconfig maps every luca subpath export used by bundled files', () => {
		const paths = defaultTsconfig().compilerOptions.paths
		for (const [alias, [target]] of Object.entries(paths) as [string, string[]][]) {
			if (alias.endsWith('/*')) continue
			const rel = target!.replace(`./${TYPES_DIR}/`, '')
			expect(typesBundle[rel]).toBeDefined()
		}
	})
})

describe('bootstrap .env and .gitignore', () => {
	it('DEFAULT_ENV seeds an OPENAI_API_KEY placeholder', () => {
		expect(DEFAULT_ENV).toContain('OPENAI_API_KEY=set-your-own')
	})

	it('creates .gitignore with the standard entries', async () => {
		const fs = container.feature('fs')
		const root = mkdtempSync(join(tmpdir(), 'luca-gitignore-'))
		const path = join(root, '.gitignore')

		await ensureGitignore(fs, uiStub, path)
		const content = readFileSync(path, 'utf8')
		for (const entry of GITIGNORE_ENTRIES) {
			expect(content.split('\n')).toContain(entry)
		}
	})

	it('appends only missing entries to an existing .gitignore', async () => {
		const fs = container.feature('fs')
		const root = mkdtempSync(join(tmpdir(), 'luca-gitignore-merge-'))
		const path = join(root, '.gitignore')
		writeFileSync(path, '# mine\nnode_modules\ndist\n')

		await ensureGitignore(fs, uiStub, path)
		const lines = readFileSync(path, 'utf8').split('\n')
		expect(lines).toContain('# mine')
		expect(lines).toContain('dist')
		expect(lines.filter(l => l === 'node_modules')).toHaveLength(1)
		for (const entry of GITIGNORE_ENTRIES) {
			expect(lines).toContain(entry)
		}

		// Re-running is a no-op
		const before = readFileSync(path, 'utf8')
		await ensureGitignore(fs, uiStub, path)
		expect(readFileSync(path, 'utf8')).toBe(before)
	})
})
