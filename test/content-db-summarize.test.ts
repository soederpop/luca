import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs'

describe('contentDb.summarize', () => {
  const makeCollection = () => {
    const root = join(os.tmpdir(), `luca-contentdb-summarize-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    mkdirSync(join(root, 'docs', 'articles'), { recursive: true })
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
    writeFileSync(
      join(root, 'docs', 'articles', 'first.md'),
      '---\ntitle: First\n---\n\n# First\n\nHello.\n'
    )
    return root
  }

  it('writes README.md and TABLE-OF-CONTENTS.md to the collection root', async () => {
    const root = makeCollection()
    try {
      const container = new NodeContainer({ cwd: root })
      const docs = container.feature('contentDb', { rootPath: join(root, 'docs') }) as any

      const result = await docs.summarize({ includeIds: true })

      expect(result.readmePath).toBe(join(root, 'docs', 'README.md'))
      expect(result.tocPath).toBe(join(root, 'docs', 'TABLE-OF-CONTENTS.md'))

      const readme = readFileSync(result.readmePath, 'utf-8')
      expect(readme).toContain('## Summary')
      expect(readme).toContain('Model: Article')
      expect(readme).toContain('articles/first')

      const toc = readFileSync(result.tocPath, 'utf-8')
      expect(toc).toContain('# Table of Contents')
      expect(toc).toContain('[First](./articles/first.md)')

      expect(docs.state.get('modelSummary')).toBe(result.summary)
      expect(docs.state.get('tableOfContents')).toBe(result.toc)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('preserves an existing ## Overview section in README.md', async () => {
    const root = makeCollection()
    try {
      writeFileSync(
        join(root, 'docs', 'README.md'),
        '# Models\n\n## Overview\n\nHand-written overview text.\n\n## Summary\n\nstale summary\n'
      )
      const container = new NodeContainer({ cwd: root })
      const docs = container.feature('contentDb', { rootPath: join(root, 'docs') }) as any

      await docs.summarize()

      const readme = readFileSync(join(root, 'docs', 'README.md'), 'utf-8')
      expect(readme).toContain('Hand-written overview text.')
      expect(readme).not.toContain('stale summary')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('skips the table of contents when toc: false', async () => {
    const root = makeCollection()
    try {
      const container = new NodeContainer({ cwd: root })
      const docs = container.feature('contentDb', { rootPath: join(root, 'docs') }) as any

      const result = await docs.summarize({ toc: false })

      expect(result.tocPath).toBeUndefined()
      expect(existsSync(join(root, 'docs', 'TABLE-OF-CONTENTS.md'))).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
