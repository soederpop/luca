// Builds the social card for /desktop/.
//
//   og.png   rendered from og.svg with resvg. og.svg points at og-shot.png
//            (a 1400px crop of shots/hero); it is inlined as a data URI here
//            because resvg does not load relative images by itself.
//
// Run from the repository root: bun run design/marketing/desktop/build.ts
import { Resvg } from '@resvg/resvg-js'
import container from '../../../src/node'

const { fs, paths } = container
const here = paths.resolve('design/marketing/desktop')

const shot = fs.readFile(paths.resolve(here, 'og-shot.png'), null) as Buffer
const svg = (fs.readFile(paths.resolve(here, 'og.svg'), 'utf8') as string)
  .replace('xlink:href="og-shot.png"', `xlink:href="data:image/png;base64,${shot.toString('base64')}"`)

const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Helvetica Neue' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng()
fs.writeFile(paths.resolve(here, 'og.png'), Buffer.from(png))
console.log(`og.png: ${(png.length / 1024).toFixed(0)} KB`)
