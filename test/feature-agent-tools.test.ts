import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * secureShell and docker expose agent tools via the static `tools` convention.
 * These tests verify the toTools() bundle wiring — schemas present, handlers
 * bound, and handlers delegating to the underlying feature methods — without
 * needing a reachable SSH host or a docker daemon.
 */

describe('secureShell agent tools', () => {
	const makeSsh = () => new NodeContainer().feature('secureShell', {
		host: 'example.test',
		username: 'deploy',
		key: '/keys/id_test',
	})

	it('exposes the ssh tool surface with matching schemas and handlers', () => {
		const bundle = makeSsh().toTools()
		const expected = ['sshListHosts', 'sshUseHost', 'sshExec', 'sshTestConnection', 'sshUpload', 'sshDownload']
		for (const name of expected) {
			expect(Object.keys(bundle.schemas)).toContain(name)
			expect(typeof bundle.handlers[name]).toBe('function')
		}
	})

	it('sshExec handler delegates the command string to exec()', async () => {
		const ssh = makeSsh()
		let seen: string | null = null
		;(ssh as any).exec = async (command: string) => { seen = command; return 'ok' }
		const result = await makeBundleHandler(ssh, 'sshExec')({ command: 'uptime' })
		expect(seen).toBe('uptime')
		expect(result).toBe('ok')
	})

	it('sshUpload handler delegates source/target positionally', async () => {
		const ssh = makeSsh()
		let seen: string[] = []
		;(ssh as any).upload = async (source: string, target: string) => { seen = [source, target]; return 'done' }
		await makeBundleHandler(ssh, 'sshUpload')({ source: './a.txt', target: '/tmp/a.txt' })
		expect(seen).toEqual(['./a.txt', '/tmp/a.txt'])
	})

	it('setupToolsConsumer injects the current host into the prompt extension', () => {
		const ssh = makeSsh()
		const extensions: Record<string, string> = {}
		const consumer: any = {
			addSystemPromptExtension: (name: string, text: string) => { extensions[name] = text },
		}
		ssh.setupToolsConsumer(consumer)
		expect(extensions.secureShell).toContain('The current target host is: example.test')
		expect(extensions.secureShell).toContain('sshUseHost')
	})

	it('setupToolsConsumer tells the assistant to pick a host when none is configured', () => {
		const ssh = new NodeContainer().feature('secureShell')
		const extensions: Record<string, string> = {}
		const consumer: any = {
			addSystemPromptExtension: (name: string, text: string) => { extensions[name] = text },
		}
		ssh.setupToolsConsumer(consumer)
		expect(extensions.secureShell).toContain('No target host is selected yet')
		expect(extensions.secureShell).toContain('sshListHosts')
	})
})

describe('docker agent tools', () => {
	const makeDocker = () => new NodeContainer().feature('docker')

	it('exposes the docker tool surface with matching schemas and handlers', () => {
		const bundle = makeDocker().toTools()
		const expected = [
			'listContainers', 'listImages', 'runContainer', 'execInContainer',
			'getContainerLogs', 'startContainer', 'stopContainer', 'removeContainer',
			'pullImage', 'removeImage', 'buildImage',
		]
		for (const name of expected) {
			expect(Object.keys(bundle.schemas)).toContain(name)
			expect(typeof bundle.handlers[name]).toBe('function')
		}
	})

	it('listContainers handler returns JSON from the feature method', async () => {
		const docker = makeDocker()
		;(docker as any).listContainers = async (opts: any) => [{ id: 'abc', all: opts.all }]
		const result = await makeBundleHandler(docker, 'listContainers')({ all: true })
		expect(JSON.parse(result)).toEqual([{ id: 'abc', all: true }])
	})

	it('runContainer handler splits image from the remaining options', async () => {
		const docker = makeDocker()
		let seen: any = null
		;(docker as any).runContainer = async (image: string, options: any) => { seen = { image, options }; return 'cid' }
		const result = await makeBundleHandler(docker, 'runContainer')({
			image: 'nginx:latest', detach: true, ports: ['8080:80'],
		})
		expect(result).toBe('cid')
		expect(seen.image).toBe('nginx:latest')
		expect(seen.options).toEqual({ detach: true, ports: ['8080:80'] })
	})

	it('execInContainer handler wraps the command in sh -c and stringifies the result', async () => {
		const docker = makeDocker()
		let seen: any = null
		;(docker as any).execCommand = async (target: string, command: string[], opts: any) => {
			seen = { target, command, opts }
			return { stdout: 'hi', stderr: '', exitCode: 0 }
		}
		const result = await makeBundleHandler(docker, 'execInContainer')({ container: 'web', command: 'ls -la' })
		expect(seen.target).toBe('web')
		expect(seen.command).toEqual(['sh', '-c', 'ls -la'])
		expect(JSON.parse(result).exitCode).toBe(0)
	})

	it('setupToolsConsumer registers a docker prompt extension', () => {
		const docker = makeDocker()
		const extensions: Record<string, string> = {}
		const consumer: any = {
			addSystemPromptExtension: (name: string, text: string) => { extensions[name] = text },
		}
		docker.setupToolsConsumer(consumer)
		expect(extensions.docker).toContain('exitCode')
	})
})

describe('sqlite agent tools', () => {
	const makeDb = () => new NodeContainer().feature('sqlite') // in-memory

	it('exposes the sqlite tool surface', () => {
		const bundle = makeDb().toTools()
		for (const name of ['sqliteQuery', 'sqliteExecute', 'sqliteListTables', 'sqliteDescribeTable']) {
			expect(Object.keys(bundle.schemas)).toContain(name)
			expect(typeof bundle.handlers[name]).toBe('function')
		}
	})

	it('supports a full write-then-read round trip against a real database', async () => {
		const db = makeDb()
		const { handlers } = db.toTools()

		const created = await handlers.sqliteExecute!({ sql: 'CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)' })
		expect(JSON.parse(created).changes).toBe(0)

		const inserted = await handlers.sqliteExecute!({ sql: 'INSERT INTO users (email) VALUES (?)', params: ['hello@example.com'] })
		expect(JSON.parse(inserted).lastInsertRowid).toBe(1)

		const rows = JSON.parse(await handlers.sqliteQuery!({ sql: 'SELECT * FROM users WHERE email = ?', params: ['hello@example.com'] }))
		expect(rows).toEqual([{ id: 1, email: 'hello@example.com' }])

		const tables = JSON.parse(await handlers.sqliteListTables!({}))
		expect(tables.map((t: any) => t.name)).toEqual(['users'])

		const columns = JSON.parse(await handlers.sqliteDescribeTable!({ table: 'users' }))
		expect(columns.map((c: any) => c.name)).toEqual(['id', 'email'])
	})

	it('sqliteQuery rejects write statements instead of silently executing them', async () => {
		const db = makeDb()
		const { handlers } = db.toTools()
		await handlers.sqliteExecute!({ sql: 'CREATE TABLE t (id INTEGER)' })

		const result = await handlers.sqliteQuery!({ sql: 'INSERT INTO t (id) VALUES (1)' })
		expect(result).toContain('only accepts read statements')

		// The insert must NOT have happened
		const rows = JSON.parse(await handlers.sqliteQuery!({ sql: 'SELECT count(*) as n FROM t' }))
		expect(rows[0].n).toBe(0)
	})
})

describe('postgres agent tools', () => {
	const makePg = () => new NodeContainer().feature('postgres', { url: 'postgres://user@localhost:5432/testdb' })

	it('exposes the postgres tool surface', () => {
		const bundle = makePg().toTools()
		for (const name of ['pgQuery', 'pgExecute', 'pgListTables', 'pgDescribeTable']) {
			expect(Object.keys(bundle.schemas)).toContain(name)
			expect(typeof bundle.handlers[name]).toBe('function')
		}
	})

	it('pgQuery rejects write statements before touching the connection', async () => {
		const pg = makePg()
		const result = await makeBundleHandler(pg, 'pgQuery')({ sql: 'DELETE FROM users' })
		expect(result).toContain('only accepts read statements')
	})

	it('pgQuery delegates read statements with params', async () => {
		const pg = makePg()
		let seen: any = null
		;(pg as any).query = async (sql: string, params: any[]) => { seen = { sql, params }; return [{ id: 1 }] }
		const result = await makeBundleHandler(pg, 'pgQuery')({ sql: 'SELECT * FROM users WHERE id = $1', params: [1] })
		expect(seen.params).toEqual([1])
		expect(JSON.parse(result)).toEqual([{ id: 1 }])
	})

	it('pgListTables queries information_schema with the schema param', async () => {
		const pg = makePg()
		let seen: any = null
		;(pg as any).query = async (sql: string, params: any[]) => { seen = { sql, params }; return [] }
		await makeBundleHandler(pg, 'pgListTables')({})
		expect(seen.sql).toContain('information_schema.tables')
		expect(seen.params).toEqual(['public'])
	})

	it('readOnly instances mention it in the prompt extension', () => {
		const pg = new NodeContainer().feature('postgres', { url: 'postgres://user@localhost:5432/testdb', readOnly: true })
		const extensions: Record<string, string> = {}
		pg.setupToolsConsumer({ addSystemPromptExtension: (name: string, text: string) => { extensions[name] = text } } as any)
		expect(extensions.postgres).toContain('READ-ONLY')
	})
})

// Rebuild the bundle after stubbing an instance method, since handlers close
// over the helper instance at toTools() time
function makeBundleHandler(helper: any, name: string) {
	return helper.toTools().handlers[name]
}
