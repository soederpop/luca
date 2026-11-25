import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

/**
 * The container fills `options.name` with the registry id ("assistant") for
 * every helper, so every manager-created assistant used to be named
 * "assistant" and they all shared one memory namespace. These tests pin the
 * fix (an assistant is named after its folder) and the migration for the rows
 * that were written under the shared namespace.
 */

const stubEmbed = async (texts: string[]) => texts.map((t) => {
	// Stable, distinct-enough vectors with no network.
	let h = 0
	for (const ch of t) h = (h * 31 + ch.charCodeAt(0)) % 997
	return [1, (h % 13) / 13, (h % 7) / 7]
})

let counter = 0

describe('assistants get their own memory namespace', () => {
	let container: AGIContainer
	let manager: any
	let tmpDir: string
	let dbPath: string
	let originalCwd: string

	beforeEach(async () => {
		const boot = new AGIContainer()
		tmpDir = boot.paths.resolve(boot.os.tmpdir, `luca-memory-ns-${process.pid}-${Date.now()}-${counter++}`)
		for (const name of ['alpha', 'beta']) {
			boot.fs.mkdirSync(`${tmpDir}/assistants/${name}`, { recursive: true })
			boot.fs.writeFileSync(`${tmpDir}/assistants/${name}/CORE.md`, `You are ${name}.`)
		}
		originalCwd = process.cwd()
		process.chdir(tmpDir)
		container = new AGIContainer()
		// Keep the developer's real ~/.luca out of discovery and out of dbPath.
		Object.defineProperty(container.os, 'homedir', { value: tmpDir, configurable: true })
		dbPath = `${tmpDir}/memory.db`
		manager = container.feature('assistantsManager')
		await manager.discover()
	})

	afterEach(() => {
		process.chdir(originalCwd)
		try { container.fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
	})

	function sharedMem(extra: Record<string, any> = {}) {
		const mem = container.feature('memory', { dbPath, embeddingProvider: 'local', autoRecall: 0, ...extra }) as any
		mem.searcher.embed = stubEmbed
		return mem
	}

	async function namespacesOf(mem: any) {
		return (await mem.namespaceSummary()).filter((n: any) => n.memories > 0).map((n: any) => n.namespace)
	}

	it('a manager-created assistant is named after its folder', () => {
		expect(manager.create('alpha').name).toBe('alpha')
	})

	it('an explicit name option still wins', () => {
		expect(manager.create('alpha', { name: 'custom' }).name).toBe('custom')
	})

	it("a manager-created assistant's memory namespace is its folder name", async () => {
		const mem = sharedMem()
		const alpha = manager.create('alpha').use(mem)

		await alpha.tools.remember.handler({ category: 'facts', text: 'User prefers codex' })

		expect(await namespacesOf(mem)).toEqual(['alpha'])
	})

	it('two assistants in one cwd do not see each other\'s memories', async () => {
		const mem = sharedMem()
		const alpha = manager.create('alpha').use(mem)
		const beta = manager.create('beta').use(mem)

		await alpha.tools.remember.handler({ category: 'facts', text: 'User prefers codex' })
		await beta.tools.remember.handler({ category: 'facts', text: 'User drinks black coffee' })

		const alphaSees = await alpha.tools.recall.handler({ query: 'anything', n_results: 10 })
		const betaSees = await beta.tools.recall.handler({ query: 'anything', n_results: 10 })
		expect(alphaSees.map((m: any) => m.document)).toEqual(['User prefers codex'])
		expect(betaSees.map((m: any) => m.document)).toEqual(['User drinks black coffee'])
		expect(await namespacesOf(mem)).toEqual(['alpha', 'beta'])
	})

	it('warns once, and does not start empty in silence, when old shared rows exist', async () => {
		const legacy = sharedMem({ namespace: 'assistant' })
		await legacy.observe('facts', 'User prefers codex')

		const found: any[] = []
		const alpha = manager.create('alpha')
		const mem = sharedMem()
		const scoped = container.feature('memory', { ...mem.options, namespace: 'alpha' }) as any
		scoped.on('legacyNamespaceFound', (info: any) => found.push(info))

		const errors: string[] = []
		const original = console.error
		console.error = (...args: any[]) => { errors.push(args.join(' ')) }
		try {
			alpha.use(mem)
			await alpha.tools.listCategories.handler({})
			await alpha.tools.listCategories.handler({})
		} finally {
			console.error = original
		}

		expect(found.length).toBe(1)
		expect(found[0]).toMatchObject({ namespace: 'alpha', legacyNamespace: 'assistant', legacyRows: 1, pending: 1 })
		expect(errors.filter(e => e.includes('luca memory-namespaces')).length).toBe(1)
		expect(errors[0]).toContain('"alpha"')
	})

	it('an assistant with an explicit namespace is not warned', async () => {
		const legacy = sharedMem({ namespace: 'assistant' })
		await legacy.observe('facts', 'User prefers codex')

		const team = sharedMem({ namespace: 'team' })
		const found: any[] = []
		team.on('legacyNamespaceFound', (info: any) => found.push(info))
		const alpha = manager.create('alpha').use(team)
		await alpha.tools.listCategories.handler({})
		expect(found.length).toBe(0)
	})
})

describe('memory namespace migration', () => {
	function makeDb() {
		const c = new AGIContainer()
		const dbPath = c.paths.resolve(c.os.tmpdir, `luca-memory-migrate-${process.pid}-${Date.now()}-${counter++}.db`)
		const open = (namespace: string) => {
			const mem = c.feature('memory', { namespace, dbPath, embeddingProvider: 'local' }) as any
			mem.searcher.embed = stubEmbed
			return mem
		}
		return { c, dbPath, open }
	}

	/** Three rows under "assistant": one superseded by another, and a raised epoch. */
	async function seedLegacy(open: (ns: string) => any) {
		const legacy = open('assistant')
		const old = await legacy.observe('facts', 'User prefers codex')
		const replacement = await legacy.revise('facts', old.id, 'User prefers claude-code')
		await legacy.observe('facts', 'User drinks black coffee')
		await legacy.setEpoch(4)
		return { legacy, old, replacement }
	}

	const counts = (summary: any[]) => Object.fromEntries(summary.filter(n => n.memories > 0).map(n => [n.namespace, n.memories]))

	it('dry run reports counts and writes nothing', async () => {
		const { open } = makeDb()
		const { legacy } = await seedLegacy(open)

		const report = await legacy.migrateNamespace({ mode: 'copy', to: ['alpha', 'beta'], dryRun: true })

		expect(report.dryRun).toBe(true)
		expect(report.sourceRows).toBe(3)
		expect(report.targets.map((t: any) => [t.namespace, t.rows])).toEqual([['alpha', 3], ['beta', 3]])
		expect(counts(report.before)).toEqual({ assistant: 3 })
		expect(counts(await legacy.namespaceSummary())).toEqual({ assistant: 3 })
		// Not even the bookkeeping tables.
		expect(await legacy.tableExists('namespace_migration_rows')).toBe(false)
		expect(await legacy.tableExists('namespace_migrations')).toBe(false)
	})

	it('rename moves every row to one namespace and carries the epoch', async () => {
		const { open } = makeDb()
		const { legacy, old, replacement } = await seedLegacy(open)

		const report = await legacy.migrateNamespace({ mode: 'rename', to: ['alpha'] })

		expect(report.targets[0]).toMatchObject({ namespace: 'alpha', rows: 3, epoch: 4 })
		expect(counts(report.after)).toEqual({ alpha: 3 })
		expect(report.after.find((n: any) => n.namespace === 'alpha').epoch).toBe(4)

		const alpha = open('alpha')
		expect(alpha.getEpoch() >= 1).toBe(true)
		await alpha.initDb()
		expect(alpha.getEpoch()).toBe(4)
		// Same row ids, so the supersede link still holds.
		expect((await alpha.get('facts', old.id)).superseded_by).toBe(replacement.id)
		expect((await alpha.legacyNamespaceStatus()).needsMigration).toBe(false)
	})

	it('rename twice changes nothing the second time', async () => {
		const { open } = makeDb()
		const { legacy } = await seedLegacy(open)

		await legacy.migrateNamespace({ mode: 'rename', to: ['alpha'] })
		const again = await legacy.migrateNamespace({ mode: 'rename', to: ['alpha'] })

		expect(again.sourceRows).toBe(0)
		expect(again.targets[0].rows).toBe(0)
		expect(counts(again.after)).toEqual({ alpha: 3 })
	})

	it('rename keeps rows the assistant wrote after the upgrade', async () => {
		const { open } = makeDb()
		const { legacy } = await seedLegacy(open)
		await open('alpha').observe('facts', 'Written after the upgrade')

		const report = await legacy.migrateNamespace({ mode: 'rename', to: ['alpha'] })

		expect(report.targets[0]).toMatchObject({ rows: 3, alreadyThere: 1 })
		expect(counts(report.after)).toEqual({ alpha: 4 })
	})

	it('copy gives each assistant its own rows and keeps the originals', async () => {
		const { open } = makeDb()
		const { legacy, old } = await seedLegacy(open)

		const report = await legacy.migrateNamespace({ mode: 'copy', to: ['alpha', 'beta'] })

		expect(counts(report.after)).toEqual({ alpha: 3, assistant: 3, beta: 3 })
		expect(report.after.find((n: any) => n.namespace === 'beta').epoch).toBe(4)

		// The copies are separate rows: a change in one namespace stays there.
		const alpha = open('alpha')
		const beta = open('beta')
		const alphaRows = await alpha.getAll('facts', { limit: 10, sortOrder: 'asc' })
		const betaRows = await beta.getAll('facts', { limit: 10, sortOrder: 'asc' })
		expect(alphaRows.map((r: any) => r.document)).toEqual(betaRows.map((r: any) => r.document))
		expect(alphaRows.some((r: any) => betaRows.some((b: any) => b.id === r.id))).toBe(false)

		// The copied supersede link points at the copy, not at the original row.
		const copiedOld = alphaRows.find((r: any) => r.document === 'User prefers codex')
		const copiedNew = alphaRows.find((r: any) => r.document === 'User prefers claude-code')
		expect(copiedOld.status).toBe('superseded')
		expect(copiedOld.superseded_by).toBe(copiedNew.id)
		expect(copiedOld.id).not.toBe(old.id)

		// Embeddings came along, so search works without re-embedding.
		const hits = await alpha.search('facts', 'User prefers claude-code', 5)
		expect(hits.length).toBeGreaterThan(0)

		expect((await alpha.legacyNamespaceStatus()).needsMigration).toBe(false)
		expect((await open('gamma').legacyNamespaceStatus()).needsMigration).toBe(true)
	})

	it('copy twice adds nothing, and a later run copies only new rows', async () => {
		const { open } = makeDb()
		const { legacy } = await seedLegacy(open)

		await legacy.migrateNamespace({ mode: 'copy', to: ['alpha', 'beta'] })
		const again = await legacy.migrateNamespace({ mode: 'copy', to: ['alpha', 'beta'] })
		expect(again.targets.map((t: any) => t.rows)).toEqual([0, 0])
		expect(counts(again.after)).toEqual({ alpha: 3, assistant: 3, beta: 3 })

		// A process still on the old version writes one more shared row.
		await legacy.observe('facts', 'Written by an old process')
		const dry = await legacy.migrateNamespace({ mode: 'copy', to: ['alpha'], dryRun: true })
		expect(dry.targets[0].rows).toBe(1)
		const third = await legacy.migrateNamespace({ mode: 'copy', to: ['alpha'] })
		expect(third.targets[0].rows).toBe(1)
		expect(counts(third.after)).toEqual({ alpha: 4, assistant: 4, beta: 3 })
	})

	it('refuses a rename into a namespace that already holds copies', async () => {
		const { open } = makeDb()
		const { legacy } = await seedLegacy(open)
		await legacy.migrateNamespace({ mode: 'copy', to: ['alpha'] })

		await expect(legacy.migrateNamespace({ mode: 'rename', to: ['alpha'] })).rejects.toThrow(/duplicate/)
		expect(counts(await legacy.namespaceSummary())).toEqual({ alpha: 3, assistant: 3 })
	})

	it('leave changes no rows and stops the warning', async () => {
		const { open } = makeDb()
		const { legacy } = await seedLegacy(open)
		const alpha = open('alpha')
		expect((await alpha.legacyNamespaceStatus()).needsMigration).toBe(true)

		const report = await legacy.migrateNamespace({ mode: 'leave' })
		await legacy.migrateNamespace({ mode: 'leave' })

		expect(counts(report.after)).toEqual({ assistant: 3 })
		const status = await alpha.legacyNamespaceStatus()
		expect(status).toMatchObject({ legacyRows: 3, pending: 3, left: true, needsMigration: false })
	})

	it('rejects bad target lists', async () => {
		const { open } = makeDb()
		const { legacy } = await seedLegacy(open)

		await expect(legacy.migrateNamespace({ mode: 'rename', to: ['a', 'b'] })).rejects.toThrow(/exactly one/)
		await expect(legacy.migrateNamespace({ mode: 'copy', to: [] })).rejects.toThrow(/at least one/)
		await expect(legacy.migrateNamespace({ mode: 'copy', to: ['assistant'] })).rejects.toThrow(/source namespace/)
	})
})
