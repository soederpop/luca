import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync } from 'fs'

describe('contentDb validation tools', () => {
  const makeCollection = () => {
    const root = join(os.tmpdir(), `luca-contentdb-validate-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    mkdirSync(join(root, 'docs', 'articles'), { recursive: true })
    writeFileSync(
      join(root, 'docs', 'models.ts'),
      [
        "import { defineModel, z, section } from 'contentbase'",
        "export const Article = defineModel('Article', {",
        "  prefix: 'articles',",
        "  description: 'A published article',",
        "  meta: z.object({ status: z.enum(['draft', 'published']) }),",
        "  sections: {",
        "    summary: section('Summary', {",
        "      schema: z.number().min(1),",
        "      extract: (q) => q.selectAll('paragraph').length,",
        "    }),",
        "  },",
        "})",
      ].join('\n')
    )
    writeFileSync(
      join(root, 'docs', 'articles', 'good.md'),
      '---\nstatus: published\n---\n\n# Good\n\n## Summary\n\nA valid article.\n'
    )
    return root
  }

  const makeDocs = (root: string) => {
    const container = new NodeContainer({ cwd: root })
    return container.feature('contentDb', { rootPath: join(root, 'docs') }) as any
  }

  it('reports a valid document as valid', async () => {
    const root = makeCollection()
    try {
      const docs = makeDocs(root)
      const result = await docs.validateDocument({ id: 'articles/good' })
      expect(result.valid).toBe(true)
      expect(result.model).toBe('Article')
      expect(result.errors).toEqual([])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('humanizes missing frontmatter and missing section errors', async () => {
    const root = makeCollection()
    try {
      writeFileSync(join(root, 'docs', 'articles', 'bad.md'), '# Bad\n\nNo status, no summary.\n')
      const docs = makeDocs(root)
      const result = await docs.validateDocument({ id: 'articles/bad' })
      expect(result.valid).toBe(false)
      expect(result.model).toBe('Article')
      expect(result.errors.some((e: string) => e.includes('frontmatter field "status"'))).toBe(true)
      expect(result.errors.some((e: string) => e.includes('"## Summary"'))).toBe(true)
      // No raw Zod formatting leaks through
      expect(result.errors.join(' ')).not.toContain('invalid_type')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('picks up a document written after the collection was loaded', async () => {
    const root = makeCollection()
    try {
      const docs = makeDocs(root)
      await docs.load()
      writeFileSync(
        join(root, 'docs', 'articles', 'late.md'),
        '---\nstatus: draft\n---\n\n# Late\n\n## Summary\n\nWritten after load.\n'
      )
      const result = await docs.validateDocument({ id: 'articles/late' })
      expect(result.valid).toBe(true)
      expect(result.model).toBe('Article')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('tolerates a .md suffix and reports unknown ids clearly', async () => {
    const root = makeCollection()
    try {
      const docs = makeDocs(root)
      const withSuffix = await docs.validateDocument({ id: 'articles/good.md' })
      expect(withSuffix.valid).toBe(true)

      const missing = await docs.validateDocument({ id: 'articles/nope' })
      expect(missing.valid).toBe(false)
      expect(missing.errors[0]).toContain('not found')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('treats unmodeled documents as nothing-to-validate', async () => {
    const root = makeCollection()
    try {
      mkdirSync(join(root, 'docs', 'notes'), { recursive: true })
      writeFileSync(join(root, 'docs', 'notes', 'scratch.md'), '# Scratch\n\nFreeform.\n')
      const docs = makeDocs(root)
      const result = await docs.validateDocument({ id: 'notes/scratch' })
      expect(result.valid).toBe(true)
      expect(result.note).toContain('No content model matched')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('validateAllDocuments summarizes invalid documents across the collection', async () => {
    const root = makeCollection()
    try {
      writeFileSync(join(root, 'docs', 'articles', 'bad.md'), '# Bad\n\nNothing required here.\n')
      mkdirSync(join(root, 'docs', 'notes'), { recursive: true })
      writeFileSync(join(root, 'docs', 'notes', 'scratch.md'), '# Scratch\n\nFreeform.\n')

      const docs = makeDocs(root)
      const report = await docs.validateAllDocuments()

      expect(report.valid).toBe(false)
      expect(report.checked).toBe(2) // good + bad; scratch is skipped
      expect(report.skipped).toBeGreaterThanOrEqual(1)
      expect(report.invalid).toHaveLength(1)
      expect(report.invalid[0].id).toBe('articles/bad')
      expect(report.invalid[0].model).toBe('Article')
      expect(report.invalid[0].errors.length).toBeGreaterThan(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('validateAllDocuments rejects an unknown model filter', async () => {
    const root = makeCollection()
    try {
      const docs = makeDocs(root)
      const report = await docs.validateAllDocuments({ model: 'Nope' })
      expect(report.valid).toBe(false)
      expect(report.invalid[0].errors[0]).toContain('Unknown model "Nope"')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('exposes both validators as tools via toTools()', async () => {
    const root = makeCollection()
    try {
      const docs = makeDocs(root)
      const { schemas, handlers } = docs.toTools()
      expect(Object.keys(schemas)).toContain('validateDocument')
      expect(Object.keys(schemas)).toContain('validateAllDocuments')
      expect(typeof handlers.validateDocument).toBe('function')
      expect(typeof handlers.validateAllDocuments).toBe('function')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
