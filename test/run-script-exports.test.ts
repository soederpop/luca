import { describe, it, expect, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'

const REPO_ROOT = join(import.meta.dir, '..')
const CLI = join(REPO_ROOT, 'src/cli/cli.ts')

function runScript(dir: string, name: string) {
  return spawnSync('bun', ['run', CLI, 'run', join(dir, name)], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 60000,
  })
}

/**
 * The entry-point contract for `luca run script.ts`:
 * top-level code runs first (module evaluation), then a function `default`
 * export (or named `main`) is called with the ContainerContext and its return
 * value is printed. Previously `export default function main(ctx) {}` was a
 * silent no-op — transpiled to a module.exports assignment nobody read.
 */
describe('luca run — script entry-point contract', () => {
  const dir = mkdtempSync(join(tmpdir(), 'luca-run-exports-'))

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('calls a default-exported function with the container context', () => {
    writeFileSync(join(dir, 'default-fn.ts'), `
export default function main(ctx) {
  console.log('HAS_CONTAINER=' + Boolean(ctx && ctx.container))
}
`)
    const result = runScript(dir, 'default-fn.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('HAS_CONTAINER=true')
  })

  it('awaits an async default export and prints its return value', () => {
    writeFileSync(join(dir, 'async-default.ts'), `
export default async function main({ container }) {
  await new Promise(r => setTimeout(r, 10))
  console.log('ENTRY_DONE')
  return { answer: 42 }
}
`)
    const result = runScript(dir, 'async-default.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('ENTRY_DONE')
    expect(result.stdout).toContain('answer')
    expect(result.stdout).toContain('42')
  })

  it('falls back to a named main export when there is no default', () => {
    writeFileSync(join(dir, 'named-main.ts'), `
export function main(ctx) {
  console.log('NAMED_MAIN_CALLED=' + Boolean(ctx.container))
}
`)
    const result = runScript(dir, 'named-main.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('NAMED_MAIN_CALLED=true')
  })

  it('prefers default over named main when both exist', () => {
    writeFileSync(join(dir, 'both.ts'), `
export function main() {
  console.log('NAMED_RAN')
}
export default function () {
  console.log('DEFAULT_RAN')
}
`)
    const result = runScript(dir, 'both.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('DEFAULT_RAN')
    expect(result.stdout).not.toContain('NAMED_RAN')
  })

  it('runs top-level code before the entry point', () => {
    writeFileSync(join(dir, 'order.ts'), `
console.log('TOP_LEVEL')
export default function main() {
  console.log('ENTRY')
}
`)
    const result = runScript(dir, 'order.ts')
    expect(result.status).toBe(0)
    const top = result.stdout.indexOf('TOP_LEVEL')
    const entry = result.stdout.indexOf('ENTRY')
    expect(top).toBeGreaterThanOrEqual(0)
    expect(entry).toBeGreaterThan(top)
  })

  it('lands named and default exports on the same exports object', () => {
    writeFileSync(join(dir, 'shared-exports.ts'), `
export const config = { port: 3123 }
export default function main() {
  // module.exports and exports must be one object: the entry reads the named
  // export back through module.exports, which only works if they were never split.
  console.log('CONFIG_PORT=' + module.exports.config.port)
}
`)
    const result = runScript(dir, 'shared-exports.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('CONFIG_PORT=3123')
  })

  it('finds the entry even when top-level await forces IIFE wrapping', () => {
    writeFileSync(join(dir, 'tla-entry.ts'), `
const setting = await Promise.resolve('ready')
console.log('TLA=' + setting)
export default function main() {
  console.log('ENTRY_AFTER_TLA')
}
`)
    const result = runScript(dir, 'tla-entry.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('TLA=ready')
    expect(result.stdout).toContain('ENTRY_AFTER_TLA')
  })

  it('prints a non-function default export as a value', () => {
    writeFileSync(join(dir, 'data-module.ts'), `
export default { service: 'api', port: 3000 }
`)
    const result = runScript(dir, 'data-module.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('service')
    expect(result.stdout).toContain('3000')
  })

  it('leaves scripts without exports behaving exactly as before', () => {
    writeFileSync(join(dir, 'plain.ts'), `
console.log('PLAIN_RAN')
`)
    const result = runScript(dir, 'plain.ts')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('PLAIN_RAN')
    // No entry, no default: nothing extra printed after the top-level output
    const after = result.stdout.slice(result.stdout.indexOf('PLAIN_RAN') + 'PLAIN_RAN'.length)
    expect(after.trim()).toBe('')
  })

  it('surfaces entry-point errors with a non-zero exit code', () => {
    writeFileSync(join(dir, 'throws.ts'), `
export default function main() {
  throw new Error('ENTRY_EXPLODED')
}
`)
    const result = runScript(dir, 'throws.ts')
    expect(result.status).toBe(1)
    expect(result.stderr + result.stdout).toContain('ENTRY_EXPLODED')
  })
})
