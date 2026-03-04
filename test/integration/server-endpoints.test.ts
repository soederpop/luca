import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'

const openaiKey = requireEnv('OPENAI_API_KEY')

describeWithRequirements('Server & Endpoints Integration', [openaiKey], () => {
  let container: any
  let server: any
  let port: number

  beforeAll(async () => {
    container = createAGIContainer()

    server = container.server('express', {
      port: 0,
      cors: true,
      create: (app: any) => {
        app.get('/health', (_req: any, res: any) => {
          res.json({ status: 'ok' })
        })
        return app
      },
    })

    await server.start()
    port = server.port
  }, API_TIMEOUT)

  afterAll(async () => {
    if (server?.isListening) {
      await server.stop()
    }
  })

  it('server starts and reports listening', () => {
    expect(server.isListening).toBe(true)
    expect(port).toBeGreaterThan(0)
  })

  it(
    'health endpoint returns OK',
    async () => {
      const res = await fetch(`http://localhost:${port}/health`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.status).toBe('ok')
    },
    API_TIMEOUT
  )

  it(
    'loads AGI endpoints directory',
    async () => {
      const agiEndpointsDir = container.paths.resolve(
        'src',
        'agi',
        'endpoints'
      )

      if (container.fs.exists(agiEndpointsDir)) {
        await server.useEndpoints(agiEndpointsDir)
        // After loading endpoints, the /ask endpoint should be available
        const res = await fetch(`http://localhost:${port}/ask`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: 'Reply with exactly: ENDPOINT_TEST_OK',
            model: 'gpt-4o-mini',
          }),
        })
        // The endpoint may stream SSE or return JSON
        expect(res.status).toBeLessThan(500)
      }
    },
    API_TIMEOUT
  )

  it(
    'server shuts down cleanly',
    async () => {
      const testServer = container.server('express', {
        port: 0,
        cors: true,
      })
      await testServer.start()
      expect(testServer.isListening).toBe(true)

      await testServer.stop()
      expect(testServer.isStopped).toBe(true)
    },
    API_TIMEOUT
  )
})
