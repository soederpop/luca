import { describe, it, expect } from 'bun:test'
import { join } from 'path'
import { spawnSync } from 'child_process'

const REPO_ROOT = join(import.meta.dir, '..')
const CLI = join(REPO_ROOT, 'src/cli/cli.ts')

function runDescribe(...targets: string[]) {
  return spawnSync('bun', ['run', CLI, 'describe', ...targets], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 60000,
  })
}

/**
 * Regression tests: a `luca describe <unknown>` lookup miss used to escape as an
 * uncaught DescribeError, printing a bundled-source excerpt and a stack trace
 * before the helpful "Available:" list. Known lookup misses must print only the
 * friendly message + suggestions; unexpected errors keep their stacks.
 */
describe('luca describe — unknown target error output', () => {
  it('prints the friendly message and suggestions without a stack trace', () => {
    const result = runDescribe('definitelyNotAThing')
    const output = result.stdout + result.stderr

    expect(output).toContain('"definitelyNotAThing" was not found in any registry.')
    expect(output).toContain('Available:')

    // No stack frames or source dump
    expect(output).not.toMatch(/at new DescribeError/)
    expect(output).not.toMatch(/container-describer\.ts:\d+/)
    expect(output).not.toContain('class DescribeError')

    // A lookup miss is a user error — non-zero exit
    expect(result.status).toBe(1)
  }, 60000)

  it('prints member misses cleanly too', () => {
    const result = runDescribe('ui.definitelyNotAMember')
    const output = result.stdout + result.stderr

    expect(output).toContain('"definitelyNotAMember" is not a known method or getter on ui.')
    expect(output).toContain('Available members:')
    expect(output).not.toMatch(/at new DescribeError/)
    expect(output).not.toMatch(/container-describer\.ts:\d+/)
    expect(result.status).toBe(1)
  }, 60000)
})
