import { describe, it, expect, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'
import { NodeContainer } from '../src/node/container'

const REPO_ROOT = join(import.meta.dir, '..')
const CLI = join(REPO_ROOT, 'src/cli/cli.ts')

/**
 * Regression tests: `luca run script.ts` used to fail on relative static imports
 * with an opaque `SyntaxError: Unexpected string literal "./x.ts". import call
 * expects one or two arguments.` Bun's transpiler emits side-effect imports with
 * no whitespace (`import"./x.ts";`), which the esmToCjs rewriter missed.
 */
describe('transpiler esmToCjs — relative static imports', () => {
  const container = new NodeContainer({ cwd: REPO_ROOT })
  const transpiler = container.feature('transpiler') as any

  it('rewrites side-effect imports (Bun emits them with no space)', () => {
    const { code } = transpiler.transformSync(`import './x.ts'\nconsole.log('ok')`, { format: 'cjs' })
    expect(code).toContain('require("./x.ts")')
    expect(code).not.toMatch(/^\s*import\b/m)
  })

  it('rewrites named, default, mixed, and namespace imports', () => {
    const source = [
      `import { a } from './named.ts'`,
      `import def from './default.ts'`,
      `import both, { c } from './mixed.ts'`,
      `import * as ns from './namespace.ts'`,
      `console.log(a, def, both, c, ns)`,
    ].join('\n')

    const { code } = transpiler.transformSync(source, { format: 'cjs' })
    expect(code).toContain('require("./named.ts")')
    expect(code).toContain('require("./default.ts")')
    expect(code).toContain('require("./mixed.ts")')
    expect(code).toContain('require("./namespace.ts")')
    expect(code).not.toMatch(/^\s*import\b/m)
  })
})

describe('luca run — script with relative static imports', () => {
  const dir = mkdtempSync(join(tmpdir(), 'luca-run-imports-'))

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('runs a script that uses named and side-effect relative imports', () => {
    writeFileSync(join(dir, 'dep.ts'), `export const hello = 'world'\nconsole.log('SIDE_EFFECT_RAN')\n`)
    writeFileSync(join(dir, 'main.ts'), `import './dep.ts'\nimport { hello } from './dep.ts'\nconsole.log('HELLO=' + hello)\n`)

    const result = spawnSync('bun', ['run', CLI, 'run', join(dir, 'main.ts')], {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      timeout: 60000,
    })

    const output = result.stdout + result.stderr
    expect(output).not.toContain('import call expects one or two arguments')
    expect(output).not.toContain('SyntaxError')
    expect(result.stdout).toContain('SIDE_EFFECT_RAN')
    expect(result.stdout).toContain('HELLO=world')
  }, 60000)
})
