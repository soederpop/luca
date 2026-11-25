import { describe, it, expect, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, symlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { projectPath, fileView, saveFile, listFiles } from '../src/workbench/files'
import { digestOf } from '../src/workbench/docs'

const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const root = mkdtempSync(join(base, 'luca-workbench-files-'))
const outside = mkdtempSync(join(base, 'luca-workbench-outside-'))
afterAll(() => {
	rmSync(root, { recursive: true, force: true })
	rmSync(outside, { recursive: true, force: true })
})

mkdirSync(join(root, 'src'))
mkdirSync(join(root, 'node_modules/x'), { recursive: true })
writeFileSync(join(root, 'src/a.ts'), 'export const a = 1\n')
writeFileSync(join(root, 'README.md'), '# hi\n')
writeFileSync(join(root, 'node_modules/x/index.js'), '')
writeFileSync(join(root, 'bin.dat'), Buffer.from([1, 0, 2]))
writeFileSync(join(outside, 'secret.txt'), 'no')
symlinkSync(outside, join(root, 'out'))

describe('workbench files', () => {
	it('keeps paths inside the project', () => {
		expect('error' in projectPath(root, '../x')).toBe(true)
		expect('error' in projectPath(root, '/etc/passwd')).toBe(true)
		expect('error' in projectPath(root, 'out/secret.txt')).toBe(true)
		expect('error' in projectPath(root, 'out/new.txt')).toBe(true)
		const ok = projectPath(root, 'src/../src/a.ts')
		expect('rel' in ok && ok.rel).toBe('src/a.ts')
	})

	it('reads a file as a doc-shaped view', () => {
		const { status, body } = fileView(root, 'src/a.ts')
		expect(status).toBe(200)
		expect(body.file).toBe('export const a = 1\n')
		expect(body.digest).toBe(digestOf('export const a = 1\n'))
		expect(body.pathDisplay).toBe('src/a.ts')
		expect(body.fields).toEqual([])
		expect(body.missing).toBe(false)
		expect(fileView(root, 'bin.dat').status).toBe(415)
		expect(fileView(root, 'src').status).toBe(400)
		const missing = fileView(root, 'new/b.txt')
		expect(missing.status).toBe(200)
		expect(missing.body.missing).toBe(true)
	})

	it('saves only over the file it loaded', () => {
		const view = fileView(root, 'src/a.ts').body
		const saved = saveFile(root, { path: 'src/a.ts', text: 'export const a = 2\n', digest: view.digest })
		expect(saved.status).toBe(200)
		expect(readFileSync(join(root, 'src/a.ts'), 'utf8')).toBe('export const a = 2\n')
		const stale = saveFile(root, { path: 'src/a.ts', text: 'x', digest: view.digest })
		expect(stale.status).toBe(409)
		expect(stale.body.view.file).toBe('export const a = 2\n')
		const same = saveFile(root, { path: 'src/a.ts', text: 'export const a = 2\n', digest: saved.body.view.digest })
		expect(same.body.unchanged).toBe(true)
		const made = saveFile(root, { path: 'new/b.txt', text: 'b', digest: digestOf('') })
		expect(made.status).toBe(200)
		expect(existsSync(join(root, 'new/b.txt'))).toBe(true)
		expect(saveFile(root, { path: '../x', text: '', digest: 'd' }).status).toBe(400)
	})

	it('lists files without package folders', () => {
		const { files, truncated } = listFiles(root)
		expect(files).toContain('src/a.ts')
		expect(files).toContain('README.md')
		expect(files.some((f) => f.startsWith('node_modules'))).toBe(false)
		expect(truncated).toBe(false)
		expect(listFiles(root, 1).truncated).toBe(true)
	})
})
