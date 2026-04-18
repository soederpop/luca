import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('FileTools', () => {
	let tmpDir: string
	let allowedDir: string
	let secretDir: string

	beforeAll(() => {
		tmpDir = mkdtempSync(join(tmpdir(), 'file-tools-test-'))
		allowedDir = join(tmpDir, 'workspace')
		secretDir = join(tmpDir, 'secrets')

		mkdirSync(allowedDir, { recursive: true })
		mkdirSync(secretDir, { recursive: true })
		mkdirSync(join(allowedDir, 'sub'), { recursive: true })

		writeFileSync(join(allowedDir, 'hello.txt'), 'hello world')
		writeFileSync(join(allowedDir, 'sub', 'nested.txt'), 'nested content')
		writeFileSync(join(secretDir, 'creds.env'), 'SECRET=abc')
		writeFileSync(join(tmpDir, 'outside.txt'), 'outside content')
	})

	afterAll(() => {
		rmSync(tmpDir, { recursive: true, force: true })
	})

	describe('lockToFolder', () => {
		it('allows reads inside the locked folder', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			const content = await ft.readFile({ path: join(allowedDir, 'hello.txt') })
			expect(content).toBe('hello world')
		})

		it('allows reads in nested subdirectories', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			const content = await ft.readFile({ path: join(allowedDir, 'sub', 'nested.txt') })
			expect(content).toBe('nested content')
		})

		it('blocks reads outside the locked folder', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.readFile({ path: join(tmpDir, 'outside.txt') })).rejects.toThrow('Access denied')
		})

		it('blocks writes outside the locked folder', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.writeFile({ path: join(tmpDir, 'nope.txt'), content: 'bad' })).rejects.toThrow('Access denied')
		})

		it('blocks directory listing outside the locked folder', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.listDirectory({ path: secretDir })).rejects.toThrow('Access denied')
		})

		it('blocks delete outside the locked folder', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.deleteFile({ path: join(tmpDir, 'outside.txt') })).rejects.toThrow('Access denied')
		})

		it('blocks fileInfo outside the locked folder', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.fileInfo({ path: join(secretDir, 'creds.env') })).rejects.toThrow('Access denied')
		})

		it('blocks move when source is outside', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.moveFile({ source: join(tmpDir, 'outside.txt'), destination: join(allowedDir, 'moved.txt') })).rejects.toThrow('Access denied')
		})

		it('blocks move when destination is outside', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.moveFile({ source: join(allowedDir, 'hello.txt'), destination: join(tmpDir, 'escaped.txt') })).rejects.toThrow('Access denied')
		})

		it('blocks copy when destination is outside', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir })
			expect(ft.copyFile({ source: join(allowedDir, 'hello.txt'), destination: join(tmpDir, 'escaped.txt') })).rejects.toThrow('Access denied')
		})
	})

	describe('forbid', () => {
		it('blocks access to paths matching a string pattern', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { forbid: ['.env'] })
			expect(ft.readFile({ path: join(secretDir, 'creds.env') })).rejects.toThrow('Access denied')
		})

		it('blocks access to paths matching a RegExp pattern', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { forbid: [/secrets/] })
			expect(ft.readFile({ path: join(secretDir, 'creds.env') })).rejects.toThrow('Access denied')
		})

		it('allows access to paths that do not match any forbid pattern', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { forbid: ['.env', /secrets/] })
			const content = await ft.readFile({ path: join(allowedDir, 'hello.txt') })
			expect(content).toBe('hello world')
		})

		it('blocks writes to forbidden paths', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { forbid: ['secrets'] })
			expect(ft.writeFile({ path: join(secretDir, 'new.txt'), content: 'bad' })).rejects.toThrow('Access denied')
		})
	})

	describe('lockToFolder + forbid combined', () => {
		it('allows a path inside the folder that does not match forbid', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir, forbid: ['.env'] })
			const content = await ft.readFile({ path: join(allowedDir, 'hello.txt') })
			expect(content).toBe('hello world')
		})

		it('blocks a path inside the folder that matches forbid', async () => {
			// Create a .env file inside the allowed folder
			writeFileSync(join(allowedDir, 'config.env'), 'DB_URL=localhost')
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir, forbid: ['.env'] })
			expect(ft.readFile({ path: join(allowedDir, 'config.env') })).rejects.toThrow('Access denied')
		})

		it('blocks a path outside the folder even if it does not match forbid', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools', { lockToFolder: allowedDir, forbid: ['.env'] })
			expect(ft.readFile({ path: join(tmpDir, 'outside.txt') })).rejects.toThrow('Access denied')
		})
	})

	describe('no restrictions', () => {
		it('works normally without lockToFolder or forbid', async () => {
			const container = new AGIContainer({ cwd: tmpDir })
			const ft = container.feature('fileTools')
			const content = await ft.readFile({ path: join(allowedDir, 'hello.txt') })
			expect(content).toBe('hello world')
		})
	})
})
