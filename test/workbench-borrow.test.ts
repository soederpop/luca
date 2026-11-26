import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { realpathSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, statSync, lstatSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { addBorrow, removeBorrow, borrowEntries, findUserMain, parseCliFile, CALL_MARK } from '../src/workbench/cli-file'
import { diffLines, envPlugins, setEnvPlugins } from '../src/workbench/changes'
import { importSpecifiers } from '../src/workbench/borrow'

const LUCA_ROOT = join(import.meta.dir, '..')
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const tempDirs: string[] = []

// --- pure parts ---

describe('luca.cli.ts block', () => {
	it('a new file gets a block that exports main', () => {
		const r = addBorrow(null, 'commands', '/x/a/commands')
		if ('error' in r) throw new Error(r.error)
		expect(r.mainMode).toBe('block')
		expect(r.text).toContain('export async function main(container: any)')
		expect(r.text).toContain('await container.helpers.discover("commands", { directory: "/x/a/commands" })')
		expect(borrowEntries(r.text)).toEqual([{ id: 'commands:/x/a/commands', type: 'commands', directory: '/x/a/commands', line: expect.any(String) }])
		const back = removeBorrow(r.text, 'commands:/x/a/commands')
		expect(back).toEqual({ text: null })
	})

	it('a file with its own main keeps every user line and gets one marked call', () => {
		const user = `import { z } from 'zod'\n\nexport async function main(container: any) {\n  container.feature('fs')\n  console.log('mine')\n}\n`
		const r = addBorrow(user, 'features', '/x/a/features')
		if ('error' in r) throw new Error(r.error)
		expect(r.mainMode).toBe('user')
		expect(r.text).not.toContain('export async function main(container: any) {\n\tawait')
		expect(r.text).toContain(`  await lucaDesktopBorrowed(container) ${CALL_MARK}\n  container.feature('fs')`)
		// Every user line is still there, in order.
		const kept = r.text.split('\n').filter((l) => user.split('\n').includes(l))
		expect(kept.join('\n')).toContain(user.trimEnd())
		const two = addBorrow(r.text, 'commands', '/x/a/commands')
		if ('error' in two) throw new Error(two.error)
		expect(two.text.split('\n').filter((l) => l.endsWith(CALL_MARK)).length).toBe(1)
		expect(borrowEntries(two.text).map((e) => e.type)).toEqual(['features', 'commands'])
		const one = removeBorrow(two.text, 'features:/x/a/features')
		if ('error' in one) throw new Error(one.error)
		expect(borrowEntries(one.text!).map((e) => e.id)).toEqual(['commands:/x/a/commands'])
		const none = removeBorrow(one.text!, 'commands:/x/a/commands')
		if ('error' in none) throw new Error(none.error)
		expect(none.text).toBe(user)
	})

	it('a file with no main gets the main in the block, and goes back byte for byte', () => {
		const user = `// my settings\nexport const onStart = () => {}\n`
		const r = addBorrow(user, 'commands', '/x/a/commands')
		if ('error' in r) throw new Error(r.error)
		expect(r.mainMode).toBe('block')
		expect(r.text.startsWith(user)).toBe(true)
		const back = removeBorrow(r.text, 'commands:/x/a/commands')
		if ('error' in back) throw new Error(back.error)
		expect(back.text).toBe(user)
	})

	it('refuses a folder borrowed twice and a main it cannot read', () => {
		const r = addBorrow(null, 'commands', '/x/a/commands')
		if ('error' in r) throw new Error(r.error)
		expect(addBorrow(r.text, 'commands', '/x/a/commands')).toEqual({ error: expect.stringContaining('borrowed already') })
		expect(addBorrow('export { main } from "./x"\n', 'commands', '/y')).toEqual({ error: expect.stringContaining('cannot edit') })
		expect(addBorrow('export async function main() {}\n', 'commands', '/y')).toEqual({ error: expect.stringContaining('no container parameter') })
	})

	it('reads arrow mains and return types', () => {
		const a = findUserMain('export const main = async (c: any) => {\n  x()\n}\n')
		expect(a && 'param' in a && a.param).toBe('c')
		const b = findUserMain('export async function main(container: { x: (a: number) => void }): Promise<void> {\n}\n')
		expect(b && 'param' in b && b.param).toBe('container')
	})

	it('parses the user\'s own discover and usePlugin calls too', () => {
		const text = `export async function main(container) {\n  await container.helpers.discover('features', { directory: '/z/features' })\n  await container.helpers.usePlugin('agentic-loop')\n}\n`
		expect(parseCliFile(text).calls).toEqual([
			{ kind: 'discover', type: 'features', directory: '/z/features', managed: false },
			{ kind: 'usePlugin', name: 'agentic-loop', managed: false },
		])
	})
})

describe('.env LUCA_PLUGINS line', () => {
	it('changes exactly one line', () => {
		const env = 'A=1\nLUCA_PLUGINS=one\nB=2\n'
		expect(envPlugins(env)).toEqual(['one'])
		expect(setEnvPlugins(env, ['one', 'two'])).toBe('A=1\nLUCA_PLUGINS=one,two\nB=2\n')
		expect(setEnvPlugins(env, [])).toBe('A=1\nB=2\n')
		expect(setEnvPlugins('A=1', ['x'])).toBe('A=1\nLUCA_PLUGINS=x\n')
		expect(setEnvPlugins(null, ['x'])).toBe('LUCA_PLUGINS=x\n')
		expect(envPlugins('A=1\n')).toBeNull()
		expect(envPlugins('LUCA_PLUGINS="a, b"\n')).toEqual(['a', 'b'])
	})
})

describe('diffLines and imports', () => {
	it('marks added and removed lines with context gaps', () => {
		const before = Array.from({ length: 20 }, (_, i) => `l${i}`).join('\n') + '\n'
		const after = before.replace('l10\n', 'l10b\n')
		const d = diffLines(before, after)
		expect(d.added).toBe(1)
		expect(d.removed).toBe(1)
		expect(d.lines.map((l) => l.kind)).toEqual(['gap', 'same', 'same', 'same', 'del', 'add', 'same', 'same', 'same', 'gap'])
		expect(diffLines(null, 'a\nb\n').added).toBe(2)
	})

	it('finds import specifiers', () => {
		const text = `import { z } from 'zod'\nimport x from './x'\nimport './side.js'\nexport * from "../y"\nconst q = await import('./lazy')\nconst r = require('./req')\n`
		expect(importSpecifiers(text)).toEqual(['zod', './x', './side.js', '../y', './lazy', './req'])
	})
})

// --- through a real host on scratch projects ---

// realpath: macOS tmpdir is /var/…, a link to /private/var/…, and the host reports real paths.
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())

function scratch(prefix: string): string {
	const dir = mkdtempSync(join(base, prefix))
	tempDirs.push(dir)
	return dir
}

const feature = (name: string, extra = '') => `import { z } from 'zod'
import { Feature } from 'luca'
${extra}
/** ${name} for the borrow tests. */
export class ${name[0]!.toUpperCase() + name.slice(1)} extends Feature<any, any> {
  static override shortcut = 'features.${name}' as const
  static { Feature.register(this, '${name}') }
  hello() { return '${name}' }
}
export default ${name[0]!.toUpperCase() + name.slice(1)}
`

function makeSource(): string {
	const dir = scratch('wb-borrow-a-')
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'borrow-a' }))
	mkdirSync(join(dir, 'features', 'lib'), { recursive: true })
	writeFileSync(join(dir, 'features', 'lib', 'shout.ts'), `export const shout = (s: string) => s.toUpperCase()\n`)
	writeFileSync(join(dir, 'features', 'greeter.ts'), feature('greeter', `import { shout } from './lib/shout'\nimport leftPad from 'left-pad-not-installed'`))
	mkdirSync(join(dir, 'commands'), { recursive: true })
	writeFileSync(join(dir, 'commands', 'wave.ts'), `import { z } from 'zod'\nexport const description = 'Wave from A'\nexport const argsSchema = z.object({})\nexport default async function wave() { console.log('wave from A') }\n`)
	writeFileSync(join(dir, 'luca.plugin.ts'), `export async function attach() {}\n`)
	return dir
}

function makeTarget(): string {
	const dir = scratch('wb-borrow-b-')
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'borrow-b' }))
	mkdirSync(join(dir, 'features'), { recursive: true })
	writeFileSync(join(dir, 'features', 'local.ts'), feature('local'))
	writeFileSync(join(dir, '.env'), 'FOO=1\n# a comment\nBAR=2\n')
	writeFileSync(join(dir, 'luca.cli.ts'), `export async function main(container: any) {\n  container.state.set('mine', true)\n}\n`)
	return dir
}

function treeHash(dir: string): string {
	const h = createHash('sha256')
	const walk = (d: string) => {
		for (const name of readdirSync(d).sort()) {
			const p = join(d, name)
			const st = lstatSync(p)
			h.update(p.slice(dir.length)).update('\0')
			if (st.isDirectory()) walk(p)
			else h.update(readFileSync(p))
		}
	}
	walk(dir)
	return h.digest('hex')
}

/** The test's env, without a LUCA_PLUGINS from the shell: Bun reads it from .env only when it is unset. */
function childEnv(extra: Record<string, string>): Record<string, string> {
	const e: Record<string, string> = { ...(process.env as any), ...extra }
	delete e.LUCA_PLUGINS
	return e
}

type Proc = ReturnType<typeof Bun.spawn>
type Host = { proc: Proc; base: string; token: string }

async function startHost(cwd: string, env: Record<string, string>): Promise<Host> {
	const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe', env: childEnv(env) })
	const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader()
	let buf = ''
	const deadline = Date.now() + 60000
	while (!buf.includes('\n') && Date.now() < deadline) {
		const r = await reader.read()
		if (r.done) break
		buf += new TextDecoder().decode(r.value)
	}
	reader.releaseLock()
	const info = JSON.parse(buf.split('\n')[0]!)
	return { proc, base: `http://127.0.0.1:${info.port}`, token: info.token }
}

async function stopHost(h?: Host) {
	if (!h) return
	try { h.proc.kill() } catch {}
	await h.proc.exited.catch(() => {})
}

let A: string, B: string, plugins: string, aHash: string
let a: Host | undefined, b: Host | undefined
let env: Record<string, string>

const call = async (h: Host, method: string, path: string, body?: any) => {
	const r = await fetch(h.base + path, { method, headers: { Authorization: `Bearer ${h.token}`, 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
	return { status: r.status, json: (await r.json()) as any }
}

function runLuca(cwd: string, args: string[]) {
	const r = Bun.spawnSync(['bun', 'run', CLI, ...args], { cwd, env: childEnv(env), stdout: 'pipe', stderr: 'pipe' })
	return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() }
}

beforeAll(async () => {
	A = makeSource()
	B = makeTarget()
	plugins = scratch('wb-plugins-')
	// An installed plugin with one feature, the way ~/.luca/plugins holds them.
	const pluginSrc = scratch('wb-plugin-src-')
	mkdirSync(join(pluginSrc, 'features'), { recursive: true })
	writeFileSync(join(pluginSrc, 'features', 'plugged.ts'), feature('plugged'))
	writeFileSync(join(pluginSrc, 'luca.plugin.ts'), `export async function attach() {}\n`)
	symlinkSync(pluginSrc, join(plugins, 'plugged'))
	env = { LUCA_WORKBENCH_PLUGINS_DIR: plugins }
	aHash = treeHash(A)
	;[a, b] = await Promise.all([startHost(A, env), startHost(B, env)])
}, 120000)

afterAll(async () => {
	await Promise.all([stopHost(a), stopHost(b)])
	for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('origins', () => {
	it('registry cards and the helper view say where a helper comes from', async () => {
		const { json } = await call(a!, 'GET', '/registries')
		const features = json.stacks.find((s: any) => s.id === 'features')
		const greeter = features.cards.find((c: any) => c.title === 'greeter')
		expect(greeter.origin).toMatchObject({ kind: 'own', tag: 'own', file: join(A, 'features', 'greeter.ts'), dir: join(A, 'features'), root: A })
		expect(features.cards.find((c: any) => c.title === 'fs').origin.kind).toBe('builtin')
		const helper = await call(a!, 'GET', '/helper/features/greeter')
		expect(helper.json.origin.kind).toBe('own')
		const cmd = await call(a!, 'GET', '/command/wave')
		expect(cmd.json.origin.file).toBe(join(A, 'commands', 'wave.ts'))
	})
})

describe('hard copy', () => {
	it('previews files, imports and packages; writes only on a matching apply', async () => {
		const req = { op: 'copy', registry: 'features', id: 'greeter', file: join(A, 'features', 'greeter.ts'), root: A }
		const { json: view } = await call(b!, 'POST', '/borrow/preview', req)
		expect(view.ok).toBe(true)
		expect(view.files.map((f: any) => [f.path, f.action])).toEqual([[join(B, 'features', 'greeter.ts'), 'create']])
		expect(view.imports).toEqual([expect.objectContaining({ spec: './lib/shout', path: join(B, 'features', 'lib', 'shout.ts'), action: 'create' })])
		expect(view.notes.join('\n')).toContain('left-pad-not-installed')
		expect(existsSync(join(B, 'features', 'greeter.ts'))).toBe(false)

		const stale = await call(b!, 'POST', '/borrow/apply', { ...req, digest: 'nope' })
		expect(stale.status).toBe(409)

		const withImports = await call(b!, 'POST', '/borrow/preview', { ...req, withImports: true })
		expect(withImports.json.files.length).toBe(2)
		const applied = await call(b!, 'POST', '/borrow/apply', { ...req, withImports: true, digest: withImports.json.digest })
		expect(applied.json.ok).toBe(true)
		expect(readFileSync(join(B, 'features', 'greeter.ts'), 'utf8')).toBe(readFileSync(join(A, 'features', 'greeter.ts'), 'utf8'))
		expect(existsSync(join(B, 'features', 'lib', 'shout.ts'))).toBe(true)
		expect(treeHash(A)).toBe(aHash)

		const described = runLuca(B, ['describe', 'greeter'])
		expect(described.code).toBe(0)
		expect(described.out).toContain('greeter')
	}, 60000)

	it('reports a name clash before any write', async () => {
		writeFileSync(join(A, 'features', 'local.ts'), feature('local', '// A\'s version'))
		const req = { op: 'copy', registry: 'features', id: 'local', file: join(A, 'features', 'local.ts'), root: A }
		const before = readFileSync(join(B, 'features', 'local.ts'), 'utf8')
		const { json: view } = await call(b!, 'POST', '/borrow/preview', req)
		expect(view.ok).toBe(false)
		expect(view.needsOverwrite).toBe(true)
		expect(view.clashes.join('\n')).toContain('local.ts exists in this project')
		expect(view.files[0].action).toBe('overwrite')
		const refused = await call(b!, 'POST', '/borrow/apply', { ...req, digest: view.digest })
		expect(refused.status).toBe(409)
		expect(readFileSync(join(B, 'features', 'local.ts'), 'utf8')).toBe(before)
		rmSync(join(A, 'features', 'local.ts'))
		aHash = treeHash(A)
	})

	it('a built-in name is blocked', async () => {
		const { json: view } = await call(b!, 'POST', '/borrow/preview', { op: 'copy', registry: 'features', id: 'fs', file: join(A, 'features', 'greeter.ts'), root: A })
		expect(view.blocked).toContain('built into Luca')
	})
})

describe('borrow through luca.cli.ts', () => {
	it('adds a marked block; the command runs in B; removing takes only the block out', async () => {
		const userCli = readFileSync(join(B, 'luca.cli.ts'), 'utf8')
		const req = { op: 'borrow', registry: 'commands', dir: join(A, 'commands') }
		const { json: view } = await call(b!, 'POST', '/borrow/preview', req)
		expect(view.ok).toBe(true)
		expect(view.helpers).toEqual(['commands.wave'])
		expect(view.notes.join(' ')).toContain('every command in it')
		expect(view.files[0].action).toBe('edit')
		expect(view.files[0].removed).toBe(0)
		const applied = await call(b!, 'POST', '/borrow/apply', { ...req, digest: view.digest })
		expect(applied.json.ok).toBe(true)

		const ran = runLuca(B, ['wave'])
		expect(ran.out).toContain('wave from A')
		expect(treeHash(A)).toBe(aHash)

		// A fresh host shows it as borrowed, and lists the block.
		await stopHost(b)
		b = await startHost(B, env)
		const { json: stacks } = await call(b, 'GET', '/registries')
		const wave = stacks.stacks.find((s: any) => s.id === 'commands').cards.find((c: any) => c.title === 'wave')
		expect(wave.origin.kind).toBe('borrowed')
		expect(wave.origin.tag).toContain('borrowed · ')
		const { json: pv } = await call(b, 'GET', '/plugins')
		expect(pv.borrowed).toEqual([expect.objectContaining({ type: 'commands', directory: join(A, 'commands'), helpers: ['wave'] })])

		const again = await call(b, 'POST', '/borrow/preview', req)
		expect(again.json.blocked).toContain('borrowed already')

		const un = await call(b, 'POST', '/borrow/preview', { op: 'unborrow', id: pv.borrowed[0].id })
		expect(un.json.files[0].added).toBe(0)
		const done = await call(b, 'POST', '/borrow/apply', { op: 'unborrow', id: pv.borrowed[0].id, digest: un.json.digest })
		expect(done.json.ok).toBe(true)
		expect(readFileSync(join(B, 'luca.cli.ts'), 'utf8')).toBe(userCli)
	}, 90000)

	it('refuses endpoints and a folder inside the project', async () => {
		const e = await call(b!, 'POST', '/borrow/preview', { op: 'borrow', registry: 'endpoints', dir: join(A, 'commands') })
		expect(e.json.blocked).toContain('Hard copy')
		const own = await call(b!, 'POST', '/borrow/preview', { op: 'borrow', registry: 'features', dir: join(B, 'features') })
		expect(own.json.blocked).toContain('inside this project')
	})
})

describe('plugins', () => {
	it('lists installed plugins and what they add', async () => {
		const { json } = await call(b!, 'GET', '/plugins')
		expect(json.pluginsDirIsDefault).toBe(false)
		const p = json.plugins.find((x: any) => x.name === 'plugged')
		expect(p).toMatchObject({ link: true, on: false, entry: 'luca.plugin.ts', entryValue: join(plugins, 'plugged') })
		expect(p.adds).toEqual([{ type: 'features', names: ['plugged'] }])
	})

	it('on and off change one line of .env', async () => {
		const envBefore = readFileSync(join(B, '.env'), 'utf8')
		const on = await call(b!, 'POST', '/plugins/preview', { op: 'on', name: 'plugged' })
		expect(on.json.files[0]).toMatchObject({ added: 1, removed: 0 })
		expect((await call(b!, 'POST', '/plugins/apply', { op: 'on', name: 'plugged', digest: on.json.digest })).json.ok).toBe(true)
		const envOn = readFileSync(join(B, '.env'), 'utf8')
		expect(envOn).toBe(envBefore + `LUCA_PLUGINS=${join(plugins, 'plugged')}\n`)

		// The CLI loads it from that line.
		const described = runLuca(B, ['describe', 'plugged'])
		expect(described.code).toBe(0)

		await stopHost(b)
		b = await startHost(B, env)
		const { json: stacks } = await call(b, 'GET', '/registries')
		const plugged = stacks.stacks.find((s: any) => s.id === 'features').cards.find((c: any) => c.title === 'plugged')
		expect(plugged.origin).toMatchObject({ kind: 'plugin', plugin: 'plugged' })
		const pv = await call(b, 'GET', '/plugins')
		expect(pv.json.plugins.find((x: any) => x.name === 'plugged')).toMatchObject({ on: true, loaded: true })

		const off = await call(b, 'POST', '/plugins/preview', { op: 'off', name: 'plugged' })
		expect(off.json.files[0]).toMatchObject({ added: 0, removed: 1 })
		expect((await call(b, 'POST', '/plugins/apply', { op: 'off', name: 'plugged', digest: off.json.digest })).json.ok).toBe(true)
		expect(readFileSync(join(B, '.env'), 'utf8')).toBe(envBefore)
	}, 90000)

	it('links a folder with luca.plugin.ts, and refuses one without', async () => {
		const bad = await call(b!, 'POST', '/plugins/preview', { op: 'link', folder: B })
		expect(bad.json.blocked).toContain('no luca.plugin.ts')
		const view = await call(b!, 'POST', '/plugins/preview', { op: 'link', folder: A, name: 'borrow-a' })
		expect(view.json.ok).toBe(true)
		expect(view.json.files[0]).toMatchObject({ action: 'link', path: join(plugins, 'borrow-a') })
		const done = await call(b!, 'POST', '/plugins/apply', { op: 'link', folder: A, name: 'borrow-a', digest: view.json.digest })
		expect(done.json.ok).toBe(true)
		expect(lstatSync(join(plugins, 'borrow-a')).isSymbolicLink()).toBe(true)
		const twice = await call(b!, 'POST', '/plugins/preview', { op: 'link', folder: A, name: 'borrow-a' })
		expect(twice.json.blocked).toContain('Linked already')
		expect(treeHash(A)).toBe(aHash)
	})
})
