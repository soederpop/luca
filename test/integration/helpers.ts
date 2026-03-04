import { AGIContainer } from '../../src/agi/container.server'
import { NodeContainer } from '../../src/node/container'
import { mkdtempSync, rmSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { execSync } from 'child_process'

/**
 * Checks that an environment variable is set.
 * Returns its value, or calls describe.skip-style logic.
 * Use at the top of describe blocks — if missing, the value will be empty string
 * and `shouldSkip()` returns the skip reason.
 */
export function requireEnv(name: string): { value: string; skip?: string } {
  const value = process.env[name]
  if (!value) {
    return { value: '', skip: `${name} not set, skipping` }
  }
  return { value }
}

/**
 * Checks that a binary is available on PATH.
 * Returns the path or a skip reason.
 */
export function requireBinary(name: string): { path: string; skip?: string } {
  try {
    const result = execSync(`which ${name}`, { encoding: 'utf-8' }).trim()
    return { path: result }
  } catch {
    return { path: '', skip: `'${name}' binary not found in PATH, skipping` }
  }
}

/**
 * Creates a describe block that skips if any of the provided checks have skip reasons.
 */
export function describeWithRequirements(
  title: string,
  checks: Array<{ skip?: string }>,
  fn: () => void
) {
  const skipReason = checks.find((c) => c.skip)?.skip
  if (skipReason) {
    describe.skip(`${title} (${skipReason})`, fn)
  } else {
    describe(title, fn)
  }
}

/**
 * Creates an AGIContainer for integration tests.
 */
export function createAGIContainer(opts?: { cwd?: string }): any {
  const options = opts?.cwd ? { cwd: opts.cwd } : undefined
  return new (AGIContainer as any)(options)
}

/**
 * Creates a NodeContainer with an optional temp directory.
 * If useTempDir is true, creates a temp directory and cleans up on dispose.
 */
export function createNodeContainer(opts?: {
  cwd?: string
  useTempDir?: boolean
}): { container: NodeContainer; tempDir?: string; cleanup: () => void } {
  if (opts?.useTempDir) {
    const tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-integ-')))
    const container = new NodeContainer({ cwd: tempDir })
    return {
      container,
      tempDir,
      cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
    }
  }

  const container = new NodeContainer({ cwd: opts?.cwd || process.cwd() })
  return { container, cleanup: () => {} }
}

/**
 * Default timeout for API-calling tests (30 seconds).
 */
export const API_TIMEOUT = 30_000

/**
 * Extended timeout for slow operations like CLI subprocesses (60 seconds).
 */
export const CLI_TIMEOUT = 60_000
