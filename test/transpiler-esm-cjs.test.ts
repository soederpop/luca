import { describe, it, expect } from 'bun:test'
import { esmToCjs, computeNonCodeMask } from '../src/node/features/transpiler'

describe('esmToCjs', () => {
	describe('real ESM statements still convert', () => {
		it('converts named imports', () => {
			const out = esmToCjs(`import { z } from 'zod'\nconsole.log(z)`)
			expect(out).toContain(`const { z } = require('zod');`)
			expect(out).not.toContain('import')
		})

		it('converts default imports', () => {
			const out = esmToCjs(`import foo from 'bar'`)
			expect(out).toContain(`const foo = require('bar').default ?? require('bar');`)
		})

		it('converts default + named imports', () => {
			const out = esmToCjs(`import foo, { a, b } from 'bar'`)
			expect(out).toContain(`const foo = require('bar').default ?? require('bar'); const { a, b } = require('bar');`)
		})

		it('converts namespace imports', () => {
			const out = esmToCjs(`import * as ns from 'bar'`)
			expect(out).toContain(`const ns = require('bar');`)
		})

		it('converts side-effect imports with no space (Bun output style)', () => {
			const out = esmToCjs(`import"./x.ts";`)
			expect(out).toContain(`require("./x.ts");`)
		})

		it('converts export default', () => {
			const out = esmToCjs(`export default class Foo {}`)
			expect(out).toContain('module.exports.default = class Foo {}')
		})

		it('tracks and appends named exports', () => {
			const out = esmToCjs(`export const alpha = 1\nexport function beta() {}\nexport async function gamma() {}\nexport class Delta {}`)
			expect(out).toContain(`exports['alpha'] = alpha;`)
			expect(out).toContain(`exports['beta'] = beta;`)
			expect(out).toContain(`exports['gamma'] = gamma;`)
			expect(out).toContain(`exports['Delta'] = Delta;`)
			expect(out).not.toContain('export const')
		})

		it('still converts multi-line named imports', () => {
			const out = esmToCjs(`import {\n  a,\n  b\n} from 'x'`)
			expect(out).toContain(`require('x');`)
			expect(out).not.toContain('import')
		})
	})

	describe('import/export-looking lines inside strings are left alone', () => {
		it('preserves template literal content verbatim and appends no phantom exports', () => {
			const src = "const s = `\nexport const description = 'x'\nexport default class Foo {}\n`\nconsole.log(s)"
			const out = esmToCjs(src)
			expect(out).toContain("export const description = 'x'")
			expect(out).toContain('export default class Foo {}')
			expect(out).not.toContain("exports['description']")
			expect(out).not.toContain('module.exports.default')
		})

		it('preserves import-looking lines inside template literals', () => {
			const src = "const featureSource = `\nimport { z } from 'zod'\nimport Feature from 'luca'\n`"
			const out = esmToCjs(src)
			expect(out).toContain("import { z } from 'zod'")
			expect(out).toContain("import Feature from 'luca'")
			expect(out).not.toContain('require(')
		})

		it('handles template interpolations without losing track of the template boundary', () => {
			const src = 'const s = `before ${name} after\nexport const inner = 1\n`\nexport const outer = 2'
			const out = esmToCjs(src)
			expect(out).toContain('export const inner = 1')       // inside template: untouched
			expect(out).not.toContain("exports['inner']")
			expect(out).toContain('const outer = 2')              // real code: converted
			expect(out).toContain("exports['outer'] = outer;")
		})

		it('handles nested templates inside interpolations', () => {
			const src = 'const s = `outer ${wrap(`\nexport const nested = 1\n`)} tail\nexport const stillInner = 2\n`'
			const out = esmToCjs(src)
			expect(out).toContain('export const nested = 1')
			expect(out).toContain('export const stillInner = 2')
			expect(out).not.toContain('exports[')
		})

		it('leaves single- and double-quoted strings alone even when a line starts with them', () => {
			const src = `const lines = [\n"export function login() {",\n"}"\n].join("\\n")`
			const out = esmToCjs(src)
			expect(out).toContain('"export function login() {"')
			expect(out).not.toContain('exports[')
		})

		it('ignores import/export inside block comments', () => {
			const src = `/*\nexport const commented = 1\nimport { x } from 'y'\n*/\nconst real = 2`
			const out = esmToCjs(src)
			expect(out).toContain('export const commented = 1')
			expect(out).toContain("import { x } from 'y'")
			expect(out).not.toContain('exports[')
			expect(out).not.toContain('require(')
		})

		it('handles escaped backticks inside templates', () => {
			const src = 'const s = `emits a \\`scanned\\` event\nexport const doc = 1\n`'
			const out = esmToCjs(src)
			expect(out).toContain('export const doc = 1')
			expect(out).not.toContain('exports[')
		})

		it('converts real statements that follow a template containing fakes', () => {
			const src = "const tpl = `\nexport const fake = 1\n`\nexport const real = 2"
			const out = esmToCjs(src)
			expect(out).toContain('export const fake = 1')
			expect(out).toContain('const real = 2')
			expect(out).toContain("exports['real'] = real;")
			expect(out).not.toContain("exports['fake']")
		})
	})
})

describe('computeNonCodeMask', () => {
	it('masks string/template/comment interiors and not code', () => {
		const code = `const a = 'str'; // note\nconst b = 1`
		const mask = computeNonCodeMask(code)
		expect(mask[code.indexOf("'str'") + 1]).toBe(1)   // inside the string
		expect(mask[code.indexOf('// note') + 3]).toBe(1) // inside the comment
		expect(mask[code.indexOf('const b')]).toBe(0)     // code after the comment's newline
	})

	it('treats interpolation bodies as code but template text as non-code', () => {
		const code = 'const s = `text ${expr} more`'
		const mask = computeNonCodeMask(code)
		expect(mask[code.indexOf('text')]).toBe(1)
		expect(mask[code.indexOf('expr')]).toBe(0)
		expect(mask[code.indexOf('more')]).toBe(1)
	})
})
