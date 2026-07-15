import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { requireBinary, describeWithRequirements } from './helpers'

/**
 * Boots a real LiteLLM container and checks the proxy comes up healthy.
 * Requires the docker CLI (and a running daemon — the availability check
 * inside start() surfaces a clear error if the daemon is down).
 */
const docker = requireBinary('docker')

describeWithRequirements('llmProxy integration', [docker], () => {
  const container = new NodeContainer()
  const proxy = container.server('llmProxy', {
    port: 19420,
    masterKey: 'sk-integration-test',
    healthCheckTimeoutMs: 120000, // first run may pull the image
    models: [
      // No real backend needed: the proxy boots and serves /health/liveliness
      // regardless of whether upstream models are reachable.
      { modelName: 'test-model', provider: 'openai', model: 'gpt-4o', apiBase: 'http://localhost:9', apiKey: 'not-a-real-key' },
    ],
  })

  afterAll(async () => {
    await proxy.stop()
  })

  it('starts, becomes healthy, and serves /health/liveliness', async () => {
    await proxy.start()
    expect(proxy.isListening).toBe(true)
    expect(proxy.state.get('containerId')).toBeTruthy()

    const response = await fetch(`${proxy.baseURL}/health/liveliness`)
    expect(response.ok).toBe(true)
  }, 180000)

  it('lists the configured model through the OpenAI-compatible API', async () => {
    const response = await fetch(`${proxy.baseURL}/v1/models`, {
      headers: { Authorization: 'Bearer sk-integration-test' },
    })
    expect(response.ok).toBe(true)
    const body: any = await response.json()
    expect(body.data.map((m: any) => m.id)).toContain('test-model')
  }, 30000)

  it('stop() removes the container', async () => {
    await proxy.stop()
    expect(proxy.isStopped).toBe(true)

    const dockerFeature = container.feature('docker')
    const remaining = await dockerFeature.listContainers({ all: true })
    expect(remaining.some((c) => c.name === 'luca-llm-proxy-19420')).toBe(false)
  }, 60000)
})
