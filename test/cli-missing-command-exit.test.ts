import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { spawnSync } from 'child_process'
import os from 'os'
import { mkdirSync, writeFileSync, symlinkSync } from 'fs'

/**
 * End-to-end regression for the incident this feature fixes: a project
 * command whose import failed (a missing `lib/` file) used to warn during
 * discovery, fall through to the help listing, and exit 0 — so a build
 * agent or CI job reading the exit code took that as success.
 *
 * Helper discovery has two loader paths depending on whether `luca` is
 * resolvable natively from the project's own `node_modules` (see
 * `Helpers.useNativeImport` in src/node/features/helpers.ts): a plain
 * `bun run cli.ts` with no `node_modules/luca` takes the VM path (what a
 * compiled binary must always use), and a project with a `node_modules/luca`
 * symlink takes the native `import()` path (`lucadev`-style). Both must
 * behave identically, so the broken-command case runs against both fixtures.
 */

const REPO_ROOT = join(import.meta.dir, '..')
const CLI = join(REPO_ROOT, 'src/cli/cli.ts')

function makeFixture(options: { native: boolean }): string {
  const root = join(
    os.tmpdir(),
    `luca-cli-missing-command-${options.native ? 'native' : 'vm'}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  )
  mkdirSync(join(root, 'commands'), { recursive: true })

  writeFileSync(
    join(root, 'commands', 'hello.ts'),
    `export default async function hello() { console.log('hi from hello'); return 'hi' }\n`,
  )
  writeFileSync(
    join(root, 'commands', 'broken.ts'),
    `import { nothing } from '../lib/does-not-exist'\nexport default async function broken() { return nothing }\n`,
  )

  if (options.native) {
    mkdirSync(join(root, 'node_modules'), { recursive: true })
    symlinkSync(REPO_ROOT, join(root, 'node_modules', 'luca'), 'dir')
  }

  return root
}

function runCli(cwd: string, ...args: string[]) {
  return spawnSync('bun', ['run', CLI, ...args], {
    cwd,
    encoding: 'utf-8',
    timeout: 60000,
    env: { ...process.env, LUCA_COMMAND_DISCOVERY: undefined },
  })
}

describe.each([
  { label: 'VM loader path (no node_modules/luca)', native: false },
  { label: 'native loader path (node_modules/luca symlink)', native: true },
])('luca CLI — broken command exit code, $label', ({ native }) => {
  it('exits 1 and prints the path and the real error, not the help listing', () => {
    const root = makeFixture({ native })
    const result = runCli(root, 'broken')
    const output = result.stdout + result.stderr

    expect(result.status).toBe(1)
    expect(output).toContain("command 'broken' failed to load")
    expect(output).toContain(join(root, 'commands', 'broken.ts'))
    expect(output).toMatch(/does-not-exist/)
    expect(output).not.toContain('Usage:')
  }, 60000)
})

describe('luca CLI — commands unaffected by a broken sibling', () => {
  it('a working command still exits 0 and runs, even with a broken sibling in the same directory', () => {
    const root = makeFixture({ native: false })
    const result = runCli(root, 'hello')

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('hi from hello')
  }, 60000)

  it('bare luca with no command still exits 0', () => {
    const root = makeFixture({ native: false })
    const result = runCli(root)

    expect(result.status).toBe(0)
  }, 60000)
})
