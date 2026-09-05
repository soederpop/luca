import { describe, it, expect } from 'bun:test'
import container from '../src/node'
import { bootstrapFiles, bootstrapReferences, bootstrapTutorials, bootstrapExamples } from '../src/bootstrap/generated'

describe('bootstrap learning bundle', () => {
  it('ships source instruction files and every authored reference/tutorial without drift', async () => {
    const root = container.paths.resolve(import.meta.dir, '..')
    for (const [folder, bundled] of [
      ['docs/bootstrap', bootstrapFiles],
      ['docs/bootstrap/references', bootstrapReferences],
      ['docs/tutorials', bootstrapTutorials],
      ['docs/examples', bootstrapExamples],
    ] as const) {
      const names = (await container.fs.readdir(container.paths.resolve(root, folder))).filter(name => name.endsWith('.md'))
      for (const name of names) {
        const key = folder === 'docs/bootstrap' ? name.slice(0, -3) : name
        expect(bundled[key]).toBe(await container.fs.readFileAsync(container.paths.resolve(root, folder, name)))
      }
    }
  })

  it('resolves onboarding routes inside the materialized skill bundle', () => {
    const files: Record<string, string> = { 'SKILL.md': bootstrapFiles.SKILL! }
    for (const [folder, docs] of Object.entries({ '': bootstrapReferences, tutorials: bootstrapTutorials, examples: bootstrapExamples })) {
      for (const [name, content] of Object.entries(docs)) files[`references/${folder ? `${folder}/` : ''}${name}`] = content
    }
    // Check the entry point and every newly routed guide, not unrelated legacy
    // tutorials that may intentionally link outside the skill directory.
    for (const name of ['SKILL.md', 'references/runtime-conventions.md', ...Object.keys(files).filter(n => /tutorials\/(27|28|29|30)-/.test(n))]) {
      expect(files[name]).toBeDefined()
      for (const link of files[name]!.matchAll(/\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
        if (/^https?:/.test(link[1]!)) continue
        const absolute = container.paths.resolve('/bootstrap-skill', container.paths.dirname(name), link[1]!)
        const target = container.paths.relative('/bootstrap-skill', absolute)
        expect({ from: name, target, exists: target in files }).toEqual({ from: name, target, exists: true })
      }
    }
  })
})
