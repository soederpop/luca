import { describe, it, expect } from 'bun:test'
import { ensureGitignore, GITIGNORE_ENTRIES } from '../src/commands/bootstrap'

// In-memory fs and silent ui: ensureGitignore only needs exists/readFile/writeFileAsync.
const run = async (initial?: string) => {
  const files: Record<string, string> = initial === undefined ? {} : { '.gitignore': initial }
  const fs = {
    exists: (p: string) => p in files,
    readFile: (p: string) => files[p],
    writeFileAsync: async (p: string, c: string) => { files[p] = c },
  }
  const ui = { print: { cyan: () => {}, dim: () => {} } }
  await ensureGitignore(fs, ui, '.gitignore')
  return files['.gitignore']!
}

describe('ensureGitignore', () => {
  it('ignores .luca by allowlist, so the vault ID file is committed', async () => {
    const content = await run()
    expect(content.split('\n')).toEqual([...GITIGNORE_ENTRIES, ''])
    expect(content.indexOf('.luca/*')).toBeLessThan(content.indexOf('!.luca/vault.json'))
  })

  it.each(['.luca', '.luca/', '/.luca'])('replaces a legacy %j line in place', async (legacy) => {
    const content = await run(`dist\n${legacy}\n# mine\n`)
    const lines = content.split('\n')
    expect(lines).not.toContain(legacy)
    expect(lines.slice(0, 3)).toEqual(['dist', '.luca/*', '!.luca/vault.json'])
    expect(lines).toContain('# mine')
  })

  it('leaves an up-to-date file alone', async () => {
    const current = GITIGNORE_ENTRIES.join('\n') + '\n'
    expect(await run(current)).toBe(current)
  })
})
