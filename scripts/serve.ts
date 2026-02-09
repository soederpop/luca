import container from '@/node'
import { resolve } from 'path'
import express from 'express'

const { ui } = container

const distDir = resolve(import.meta.dirname!, '..', 'dist', 'esbuild')

const server = container.server('express', {
  port: 3000,
  create(app) {
    app.use(express.static(distDir))

    app.get('/', (_req, res) => {
      res.sendFile(resolve(import.meta.dirname!, 'serve', 'index.html'))
    })

    return app
  }
})

await server.start()

ui.print.green(`Serving at http://localhost:${server.port}`)
ui.print.cyan(`Open your browser and check window.luca in the console`)
