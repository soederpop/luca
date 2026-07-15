import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

describe('contentDb virtual module seeding', () => {
  it("does not clobber the full 'luca' virtual module barrel", async () => {
    // Regression: contentDb's seeding used to defineModule('luca', container),
    // overwriting the barrel helpers.seedVirtualModules() registers. Any VM
    // feature load after contentDb initialization (e.g. plugin workflows
    // parsing ABOUT.md before project discovery) then failed on
    // `import { FeatureStateSchema } from 'luca'`.
    const root = join(os.tmpdir(), `luca-contentdb-seed-${Date.now()}`)
    mkdirSync(join(root, 'docs'), { recursive: true })
    writeFileSync(
      join(root, 'docs', 'models.ts'),
      `import { defineModel } from 'contentbase'\nexport const Post = defineModel('Post', {})\n`
    )

    const container = new NodeContainer({ cwd: root })
    const helpers = container.feature('helpers') as any
    helpers.seedVirtualModules()

    const docs = container.feature('contentDb', { rootPath: join(root, 'docs') }) as any
    await docs.load()

    const vm = container.feature('vm') as any
    const luca = vm.modules.get('luca')
    expect(luca.FeatureStateSchema).toBeTruthy()
    expect(typeof luca.Feature).toBe('function')
  })
})
