import container from '../../src/node'

const server = container.server('express', {
  static: container.paths.resolve('design/marketing'),
  historyFallback: false,
  cors: false,
})

await server.start({ port: 4317, host: '127.0.0.1' })
console.log('Luca marketing design: http://127.0.0.1:4317')
