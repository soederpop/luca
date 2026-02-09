import * as esbuild from 'esbuild'
import { resolve } from 'path'

const root = resolve(import.meta.dirname!, '..')
const entrypoint = resolve(root, 'src', 'browser.ts')
const outfile = resolve(root, 'dist', 'esbuild', 'browser.js')

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

  // Conditions tell esbuild to prefer "browser" exports in package.json
  // This makes isomorphic-ws resolve to its browser.js automatically
  conditions: ['browser', 'import'],

  // Define globals that some node-ish packages expect
  define: {
    'process.env.NODE_ENV': '"production"',
    'process.env.CI': '""',
    'process.browser': 'true',
    'process.version': '""',
    'process.versions': '{}',
    'global': 'globalThis',
  },

  // esbuild-wasm is loaded at runtime via unpkg, so we just need a type-safe stub.
  // mdx-bundler (not /client) is server-only and shouldn't be reachable,
  // but we guard against it just in case.
  plugins: [
    {
      name: 'browser-stubs',
      setup(build) {
        // esbuild-wasm: only used as a type import + loaded dynamically via unpkg
        build.onResolve({ filter: /^esbuild-wasm$/ }, (args) => ({
          path: args.path,
          namespace: 'browser-stub',
        }))

        // mdx-bundler and mdx-bundler/client — client uses CJS require("react") internally
        build.onResolve({ filter: /^mdx-bundler(\/client)?$/ }, (args) => ({
          path: args.path,
          namespace: 'browser-stub',
        }))

        build.onLoad({ filter: /.*/, namespace: 'browser-stub' }, (args) => {
          const stubs: Record<string, string> = {
            'mdx-bundler/client': 'export function getMDXComponent() { throw new Error("mdx-bundler/client requires React — load it separately") }; export function getMDXExport() { throw new Error("mdx-bundler/client requires React — load it separately") }',
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

const outputBytes = result.metafile.outputs[Object.keys(result.metafile.outputs)[0]!]?.bytes ?? 0
console.log(`\nWrote ${outfile}`)
console.log(`Bundle size: ${(outputBytes / 1024).toFixed(1)}KB`)
