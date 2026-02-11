import * as esbuild from 'esbuild'
import { resolve } from 'path'

const root = resolve(import.meta.dirname!, '..', '..')
const entrypoint = resolve(import.meta.dirname!, 'client.ts')
const outfile = resolve(import.meta.dirname!, 'dist', 'client.js')

const result = await esbuild.build({
  entryPoints: [entrypoint],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2020',
  outfile,
  minify: false,
  sourcemap: true,
  metafile: true,

  conditions: ['browser', 'import'],

  alias: {
    '@': resolve(root, 'src'),
  },

  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.CI': '""',
    'process.browser': 'true',
    'process.version': '""',
    'process.versions': '{}',
    'global': 'globalThis',
  },

  plugins: [
    {
      name: 'browser-stubs',
      setup(build) {
        build.onResolve({ filter: /^esbuild-wasm$/ }, (args) => ({
          path: args.path,
          namespace: 'browser-stub',
        }))

        build.onResolve({ filter: /^mdx-bundler(\/client)?$/ }, (args) => ({
          path: args.path,
          namespace: 'browser-stub',
        }))

        build.onLoad({ filter: /.*/, namespace: 'browser-stub' }, (args) => {
          const stubs: Record<string, string> = {
            'mdx-bundler/client':
              'export function getMDXComponent() { throw new Error("mdx-bundler/client requires React") }; export function getMDXExport() { throw new Error("mdx-bundler/client requires React") }',
          }
          return { contents: stubs[args.path] || 'export default {}', loader: 'js' }
        })
      },
    },
  ],

  external: [],
})

const text = await esbuild.analyzeMetafile(result.metafile)
console.log(text)

const outputBytes =
  result.metafile.outputs[Object.keys(result.metafile.outputs)[0]!]?.bytes ?? 0
console.log(`\nWrote ${outfile}`)
console.log(`Bundle size: ${(outputBytes / 1024).toFixed(1)}KB`)
