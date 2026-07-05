import { describe, it, expect, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { spawnSync } from 'child_process'

const REPO_ROOT = join(import.meta.dir, '..')
const CLI = join(REPO_ROOT, 'src/cli/cli.ts')

function runMd(dir: string, name: string) {
  return spawnSync('bun', ['run', CLI, 'run', join(dir, name)], {
    cwd: REPO_ROOT,
    encoding: 'utf-8',
    timeout: 60000,
  })
}

/**
 * Literate-eval contract for `luca run doc.md`: each block's final expression
 * value is displayed beneath the block (prefixed ⇒), declarations print
 * nothing, and a `silent` meta suppresses the display for setup blocks.
 */
describe('luca run — markdown block result display', () => {
  const dir = mkdtempSync(join(tmpdir(), 'luca-run-md-results-'))

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('displays an expression block value and stays quiet for declaration blocks', () => {
    writeFileSync(join(dir, 'values.md'), `
# Values

\`\`\`ts
const base = 40
\`\`\`

\`\`\`ts
base + 2
\`\`\`
`)
    const result = runMd(dir, 'values.md')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('⇒')
    expect(result.stdout).toContain('42')
    // The declaration block contributes no result line of its own
    expect(result.stdout.match(/⇒/g)?.length).toBe(1)
  })

  it('suppresses the value for blocks marked silent', () => {
    writeFileSync(join(dir, 'silent.md'), `
# Silent

\`\`\`ts silent
'noisy setup value'
\`\`\`

\`\`\`ts
'shown value'
\`\`\`
`)
    const result = runMd(dir, 'silent.md')
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('shown value')
    expect(result.stdout.match(/⇒/g)?.length).toBe(1)
  })

  it('keeps skip blocks unexecuted and shared context accumulation intact', () => {
    writeFileSync(join(dir, 'shared.md'), `
# Shared

\`\`\`ts skip
throw new Error('SHOULD_NOT_RUN')
\`\`\`

\`\`\`ts
const items = ['a', 'b']
\`\`\`

\`\`\`ts
items.length
\`\`\`
`)
    const result = runMd(dir, 'shared.md')
    // Skip blocks are ECHOED (their source renders in the doc flow) but never
    // executed — exit 0 proves the throw didn't run.
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('⇒')
    expect(result.stdout).toContain('2')
  })
})
