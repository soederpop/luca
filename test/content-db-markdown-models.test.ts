import { describe, it, expect, afterEach } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync, rmSync } from 'fs'

// Workspace models (docs/models.md, docs/models/*.md|ts) load in every
// project through contentDb, next to docs/models.ts.
const roots: string[] = []
afterEach(() => { for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }) })

function project(files: Record<string, string>) {
  const root = join(os.tmpdir(), `luca-md-models-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  roots.push(root)
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(root, 'docs', rel)
    mkdirSync(join(abs, '..'), { recursive: true })
    writeFileSync(abs, text)
  }
  const container = new NodeContainer({ cwd: root })
  const docs = container.feature('contentDb', { rootPath: join(root, 'docs') }) as any
  return { root, container, docs, models: container.feature('markdownModels' as any) as any }
}

const CRM = `# CRM

## Customer

A company we sell to.

\`\`\`ts
({
  prefix: 'customers',
  meta: z.object({ tier: z.enum(['free', 'paid']).default('free').describe('Billing tier') }),
  sections: {
    notes: section('Notes', { extract: extract.text, schema: z.string().optional() }),
    steps: section('Steps', { extract: extract.list }),
  },
})
\`\`\`

## Sales lead

\`\`\`ts
({ prefix: 'leads' })
\`\`\`
`

describe('contentDb workspace models', () => {
  it('registers every ## of docs/models/*.md and records its file', async () => {
    const { root, docs, models } = project({
      'models/crm.md': CRM,
      'customers/acme.md': '---\ntier: paid\n---\n\n# Acme\n\n## Notes\n\nGood people.\n\n## Steps\n\n- call\n- sign\n',
    })
    await docs.load()
    expect(models.state.get('errors')).toEqual([])
    expect(models.state.get('models')).toEqual(['Customer', 'SalesLead'])
    expect(models.state.get('sources').Customer).toBe(join(root, 'docs/models/crm.md'))

    const def = docs.collection.findModelDefinition('customers/acme')
    expect(def.name).toBe('Customer')
    expect(def.description).toBe('A company we sell to.')
    expect(models.extractorKind(def.sections.notes.extract)).toBe('text')
    expect(models.extractorKind(def.sections.steps.extract)).toBe('list')

    const [acme] = await docs.query(def).fetchAll()
    expect(acme.sections.notes).toBe('Good people.')
    expect(acme.sections.steps).toEqual(['call', 'sign'])
  })

  it('skips <Model>.template.md, as a model file and as a document', async () => {
    const { docs, models } = project({
      'models/crm.md': CRM,
      'models/Customer.template.md': '---\ntier: free\n---\n\n# New customer\n',
    })
    await docs.load()
    expect(models.state.get('errors')).toEqual([])
    expect(docs.collection.available).not.toContain('models/Customer.template')
    expect((await docs.collection.readTemplate('Customer'))?.content).toContain('# New customer')
  })

  it('works alongside docs/models.ts, which wins a name clash', async () => {
    const { docs, models } = project({
      'models.ts': "import { defineModel, z } from 'contentbase'\nexport const Customer = defineModel('Customer', { prefix: 'customers', meta: z.object({}) })\n",
      'models/crm.md': CRM,
    })
    await docs.load()
    expect(models.state.get('models')).toEqual(['SalesLead'])
    expect(models.state.get('errors')[0].model).toBe('Customer')
  })

  it('picks up an edit on reload', async () => {
    const { root, docs, models } = project({ 'models/crm.md': CRM })
    await docs.load()
    writeFileSync(join(root, 'docs/models/crm.md'), "## Account\n\n```ts\n({ prefix: 'customers' })\n```\n")
    await docs.reload()
    expect(models.state.get('models')).toEqual(['Account'])
  })
})
