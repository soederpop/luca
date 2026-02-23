import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import { AGIContainer } from '../src/agi/container.server.js'
import { __INTROSPECTION__ } from '../src/introspection/index.js'
import { presentIntrospectionAsMarkdown } from '../src/helper.js'

export const argsSchema = CommandOptionsSchema.extend({
  clean: z.boolean().default(false).describe('Remove existing docs/apis folder before generating'),
})

/** Parse setBuildTimeData shortcut IDs from a generated introspection file */
function parseGeneratedIds(content: string): { features: string[]; servers: string[]; clients: string[] } {
  const features: string[] = []
  const servers: string[] = []
  const clients: string[] = []

  for (const match of content.matchAll(/setBuildTimeData\('([^']+)'/g)) {
    const id = match[1]
    if (id.startsWith('features.')) features.push(id.replace('features.', ''))
    else if (id.startsWith('servers.')) servers.push(id.replace('servers.', ''))
    else if (id.startsWith('clients.')) clients.push(id.replace('clients.', ''))
  }

  return { features, servers, clients }
}

async function generateApiDocs(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const fs = context.container.feature('fs')
  const baseDir = 'docs/apis'

  if (options.clean) {
    try { await fs.rmdir(baseDir) } catch {}
  }

  // Parse the generated introspection files to determine which helpers belong to which container
  const nodeContent = fs.readFile('src/introspection/generated.node.ts')
  const agiContent = fs.readFile('src/introspection/generated.agi.ts')
  const webContent = fs.readFile('src/introspection/generated.web.ts')

  const nodeIds = parseGeneratedIds(nodeContent)
  const agiIds = parseGeneratedIds(agiContent)
  const webIds = parseGeneratedIds(webContent)

  // AGI-only features = features in agi that aren't in node
  const nodeFeatureSet = new Set(nodeIds.features)
  const agiOnlyFeatures = agiIds.features.filter(f => !nodeFeatureSet.has(f))

  // Load web build-time data so __INTROSPECTION__ has web entries
  await import('../src/introspection/generated.web.js')

  // Use AGIContainer for rendering — it has all node+agi registries loaded
  const agiContainer = new AGIContainer()

  const groups: { dir: string; registryName: string; ids: string[] }[] = [
    { dir: `${baseDir}/features/node`, registryName: 'features', ids: nodeIds.features },
    { dir: `${baseDir}/features/agi`, registryName: 'features', ids: agiOnlyFeatures },
    { dir: `${baseDir}/features/web`, registryName: 'features', ids: webIds.features },
    { dir: `${baseDir}/servers`, registryName: 'servers', ids: agiIds.servers },
    // Clients are registered at runtime, not in generated files — use live registry
    { dir: `${baseDir}/clients`, registryName: 'clients', ids: agiContainer.clients.available },
  ]

  let totalFiles = 0

  for (const group of groups) {
    fs.ensureFolder(group.dir)
    console.log(`\n📁 ${group.dir}`)

    const registry = (agiContainer as any)[group.registryName]

    for (const id of group.ids) {
      try {
        let markdown: string | undefined

        if (registry.has(id)) {
          markdown = registry.describe(id)
        } else {
          // Fallback: render from __INTROSPECTION__ map directly (e.g. web-only features)
          const introspectionKey = `${group.registryName}.${id}`
          const data = __INTROSPECTION__.get(introspectionKey)
          if (data) {
            markdown = presentIntrospectionAsMarkdown(data)
          }
        }

        if (!markdown || !markdown.trim()) {
          console.log(`   ⏭  ${id} (no introspection data)`)
          continue
        }

        const fileName = toKebab(id) + '.md'
        await fs.writeFileAsync(`${group.dir}/${fileName}`, markdown)
        console.log(`   📄 ${fileName}`)
        totalFiles++
      } catch (err: any) {
        console.log(`   ⚠️  ${id}: ${err.message}`)
      }
    }
  }

  console.log(`\n✨ Generated ${totalFiles} API docs in ${baseDir}/`)
}

/** Convert camelCase shortcut to kebab-case filename */
function toKebab(str: string): string {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()
}

export default {
  description: 'Generate API reference docs from introspection data for all registries.',
  argsSchema,
  handler: generateApiDocs,
}
