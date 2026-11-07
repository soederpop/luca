// Builds the generated parts of the local-inference demo suite:
//   luca.mjs            the browser bundle (copied from dist, gitignored, publish it with the folder)
//   describe-index.json the corpus the search demo embeds, from the same introspection data as `luca describe`
//   og.png              the social card, rendered from og.svg with resvg
//
//   bun run design/marketing/local/build.ts
import { Resvg } from '@resvg/resvg-js'
import container from '../../../src/node'
import '../../../src/introspection/generated.node.js'
import { __INTROSPECTION__ } from '../../../src/introspection/index.js'

const { fs, paths, proc } = container
const here = paths.resolve('design/marketing/local')

// 1. Browser bundle
console.log(proc.execSync('bun run build:web').trim())
fs.copy(paths.resolve('dist/browser.mjs'), paths.resolve(here, 'luca.mjs'), { overwrite: true })
console.log('luca.mjs copied from dist/browser.mjs')

// 2. Describe index: one entry per helper and one per documented method/getter.
const entries: Array<{ id: string; text: string }> = []
for (const [key, helper] of __INTROSPECTION__) {
  if (!key.startsWith('features.') && !key.startsWith('clients.') && !key.startsWith('servers.')) continue
  const id = key.replace(/^(features|clients|servers)\./, '')
  if (helper.description) entries.push({ id, text: helper.description.replace(/\s+/g, ' ').trim() })
  for (const [name, method] of Object.entries(helper.methods ?? {})) {
    const text = (method as any).description?.replace(/\s+/g, ' ').trim()
    if (text) entries.push({ id: `${id}.${name}`, text })
  }
  for (const [name, getter] of Object.entries((helper as any).getters ?? {})) {
    const text = (getter as any).description?.replace(/\s+/g, ' ').trim()
    if (text) entries.push({ id: `${id}.${name}`, text })
  }
}
fs.writeFile(paths.resolve(here, 'describe-index.json'), JSON.stringify(entries))
console.log(`describe-index.json: ${entries.length} entries`)

// 3. Social card
const svg = fs.readFile(paths.resolve(here, 'og.svg'), 'utf8') as string
const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica Neue' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng()
fs.writeFile(paths.resolve(here, 'og.png'), Buffer.from(png))
console.log(`og.png: ${(png.length / 1024).toFixed(0)} KB`)
