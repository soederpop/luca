import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync } from 'fs'

const makeRoot = () => {
  const root = join(os.tmpdir(), `luca-contentdb-model-errors-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(join(root, 'docs', 'note.md'), '# Note\n\nHello.\n')
  return root
}

const makeDocs = (root: string) => {
  const container = new NodeContainer({ cwd: root })
  return container.feature('contentDb', { rootPath: join(root, 'docs') }) as any
}

describe('contentDb broken models.ts surfacing', () => {
  it('load() throws a descriptive error when models.ts fails to evaluate', async () => {
    const root = makeRoot()
    try {
      writeFileSync(join(root, 'docs', 'models.ts'), "throw new Error('boom in models')\n")
      const docs = makeDocs(root)
      let error: any
      try {
        await docs.load()
      } catch (err) {
        error = err
      }
      expect(error).toBeDefined()
      expect(error.message).toContain('models.ts')
      expect(error.message).toContain('boom in models')
      expect(error.message).toContain('ignoreModelErrors')
      // the failure is recorded either way
      expect(docs.modelLoadError).toContain('boom in models')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('load({ ignoreModelErrors: true }) records the error but loads', async () => {
    const root = makeRoot()
    try {
      writeFileSync(join(root, 'docs', 'models.ts'), "throw new Error('boom in models')\n")
      const docs = makeDocs(root)
      await docs.load({ ignoreModelErrors: true })
      expect(docs.isLoaded).toBe(true)
      expect(docs.modelNames).toEqual(['Base'])
      expect(docs.modelLoadError).toContain('boom in models')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('load() succeeds cleanly with a healthy models.ts and clears modelLoadError', async () => {
    const root = makeRoot()
    try {
      writeFileSync(
        join(root, 'docs', 'models.ts'),
        [
          "import { defineModel, z } from 'contentbase'",
          "export const Article = defineModel('Article', {",
          "  prefix: 'articles',",
          "  description: 'A published article',",
          "  meta: z.object({ title: z.string().optional() }),",
          "})",
        ].join('\n')
      )
      mkdirSync(join(root, 'docs', 'articles'), { recursive: true })
      writeFileSync(join(root, 'docs', 'articles', 'a.md'), '---\ntitle: A\n---\n\n# A\n\nBody.\n')
      const docs = makeDocs(root)
      await docs.load()
      expect(docs.modelNames).toContain('Article')
      expect(docs.modelLoadError).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('load() succeeds when no models file exists at all', async () => {
    const root = makeRoot()
    try {
      const docs = makeDocs(root)
      await docs.load()
      expect(docs.isLoaded).toBe(true)
      expect(docs.modelLoadError).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('contentDb query()/queries pre-load ergonomics', () => {
  it('query(undefined) throws a descriptive error instead of an opaque TypeError', async () => {
    const root = makeRoot()
    try {
      const docs = makeDocs(root)
      // The classic pre-load mistake: docs.models.Whatever is undefined
      expect(() => docs.query(docs.models.Whatever)).toThrow(/expects a model definition/)
      expect(() => docs.query(docs.models.Whatever)).toThrow(/load\(\)/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('queries throws a descriptive error before load()', async () => {
    const root = makeRoot()
    try {
      const docs = makeDocs(root)
      expect(() => docs.queries).toThrow(/not loaded/)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('query with a valid definition auto-loads on fetch', async () => {
    const root = makeRoot()
    try {
      const docs = makeDocs(root)
      await docs.load()
      const results = await docs.query(docs.models.Base).fetchAll()
      expect(results.length).toBeGreaterThan(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
