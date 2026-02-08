import container from '@/node'
import { resolve } from 'path'
import type { BunPlugin } from 'bun'

const { ui } = container

const browserShims: BunPlugin = {
  name: 'browser-shims',
  setup(build) {
    build.onResolve({ filter: /^(isomorphic-ws|mdx-bundler\/client|mdx-bundler|esbuild-wasm)$/ }, (args) => ({
      path: args.path,
      namespace: 'browser-shim',
    }))
    build.onLoad({ filter: /.*/, namespace: 'browser-shim' }, (args) => {
      const shims: Record<string, string> = {
        'isomorphic-ws': 'export default WebSocket',
        'mdx-bundler/client': 'export function getMDXComponent() { throw new Error("mdx-bundler is not available in the browser bundle") }',
        'mdx-bundler': 'export default {}',
        'esbuild-wasm': 'export default {}',
      }
      return { contents: shims[args.path] || 'export default {}', loader: 'js' }
    })
  },
}

const server = container.server('express', {
  port: 3000,
  create(app) {
    app.get('/luca.js', async (_req, res) => {
      try {
        const result = await Bun.build({
          entrypoints: [resolve(import.meta.dirname!, '..', 'src', 'browser.ts')],
          format: 'esm',
          target: 'browser',
          minify: false,
          plugins: [browserShims],
        })

        const output = result.outputs[0]

        if (!output) {
          res.status(500).send('Build produced no output')
          return
        }

        const preamble = `var global = globalThis; var process = { env: {}, browser: true, version: '', versions: {} }; var Buffer = { isBuffer: function() { return false } };\n`
        const code = preamble + await output.text()
        res.type('application/javascript').send(code)
      } catch (err: any) {
        console.error('Bundle error:', err)
        res.status(500).send(`// Build error: ${err.message}`)
      }
    })

    app.get('/', (_req, res) => {
      res.sendFile(resolve(import.meta.dirname!, 'serve', 'index.html'))
    })

    return app
  }
})

await server.start()

ui.print.green(`Serving at http://localhost:${server.port}`)
ui.print.cyan(`Open your browser and check window.luca in the console`)
