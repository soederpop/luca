import { describe, it, expect, spyOn, beforeEach, afterEach } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { LlmProxyServer } from '../src/servers/llm-proxy'

const makeContainer = () => new NodeContainer()

/** Stub every docker method the server touches so no real docker is required. */
function mockDocker(server: LlmProxyServer, overrides: Record<string, any> = {}) {
  const docker = server.docker
  const spies = {
    availability: spyOn(docker, 'checkDockerAvailability').mockResolvedValue(
      overrides.available ?? true
    ),
    list: spyOn(docker, 'listContainers').mockResolvedValue(overrides.containers ?? []),
    listImages: spyOn(docker, 'listImages').mockResolvedValue(
      overrides.images ?? [{ id: 'img1', repository: 'ghcr.io/berriai/litellm', tag: 'main-stable', size: '1GB', created: '' }]
    ),
    pull: spyOn(docker, 'pullImage').mockResolvedValue(undefined),
    remove: spyOn(docker, 'removeContainer').mockResolvedValue(undefined),
    run: spyOn(docker, 'runContainer').mockResolvedValue(overrides.containerId ?? 'abc123'),
    stop: spyOn(docker, 'stopContainer').mockResolvedValue(undefined),
    logs: spyOn(docker, 'getLogs').mockResolvedValue(overrides.logs ?? 'litellm boot logs'),
  }
  return spies
}

describe('llmProxy registration', () => {
  it('is registered as a server', () => {
    const c = makeContainer()
    expect(c.servers.available).toContain('llmProxy')
  })

  it('has schemas defined', () => {
    expect(LlmProxyServer.optionsSchema).toBeDefined()
    expect(LlmProxyServer.stateSchema).toBeDefined()
    expect(LlmProxyServer.stability).toBe('experimental')
  })

  it('defaults: port 4000, litellm image, deterministic container name', () => {
    const c = makeContainer()
    const proxy = c.server('llmProxy')
    expect(proxy.port).toBe(4000)
    expect(proxy.image).toBe('ghcr.io/berriai/litellm:main-stable')
    expect(proxy.containerName).toBe('luca-llm-proxy-4000')
    expect(proxy.baseURL).toBe('http://localhost:4000')
  })
})

describe('llmProxy config generation', () => {
  let c: NodeContainer

  beforeEach(() => {
    c = makeContainer()
  })

  it('writes a LiteLLM config.yaml with model_list and env-var key references', async () => {
    const proxy = c.server('llmProxy', {
      port: 19400,
      masterKey: 'sk-test-master',
      models: [
        { modelName: 'local-qwen', provider: 'openai', model: 'qwen2.5', apiBase: 'http://192.168.1.50:8000/v1', apiKey: 'secret-key-a' },
        { modelName: 'claude', provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'secret-key-b' },
      ],
      litellmSettings: { drop_params: 'true' },
    })

    const configPath = await proxy.writeConfig()
    const yaml = c.feature('yaml')
    const fs = c.feature('fs')
    const config = yaml.parse(fs.readFile(configPath).toString())

    expect(config.model_list).toHaveLength(2)
    expect(config.model_list[0].model_name).toBe('local-qwen')
    expect(config.model_list[0].litellm_params.model).toBe('openai/qwen2.5')
    expect(config.model_list[0].litellm_params.api_base).toBe('http://192.168.1.50:8000/v1')
    expect(config.model_list[1].litellm_params.model).toBe('anthropic/claude-sonnet-5')
    expect(config.litellm_settings.drop_params).toBe('true')
    expect(config.general_settings.master_key).toBe('os.environ/LITELLM_MASTER_KEY')

    // secrets are env-var references, never raw values
    const rawYaml = fs.readFile(configPath).toString()
    expect(config.model_list[0].litellm_params.api_key).toBe('os.environ/LUCA_LLM_KEY_0')
    expect(config.model_list[1].litellm_params.api_key).toBe('os.environ/LUCA_LLM_KEY_1')
    expect(rawYaml).not.toContain('secret-key-a')
    expect(rawYaml).not.toContain('secret-key-b')
    expect(rawYaml).not.toContain('sk-test-master')
  })

  it('writes the real key values into a 0600 env file', async () => {
    const proxy = c.server('llmProxy', {
      port: 19401,
      masterKey: 'sk-test-master',
      models: [{ modelName: 'm', provider: 'openai', apiKey: 'secret-key-a' }],
    })
    await proxy.writeConfig()

    const fs = c.feature('fs')
    const envContent = fs.readFile(proxy.envFilePath).toString()
    expect(envContent).toContain('LUCA_LLM_KEY_0=secret-key-a')
    expect(envContent).toContain('LITELLM_MASTER_KEY=sk-test-master')

    if (process.platform !== 'win32') {
      const { statSync } = await import('fs')
      const mode = statSync(proxy.envFilePath).mode & 0o777
      expect(mode).toBe(0o600)
    }
  })

  it('rewrites localhost apiBase to the host gateway', () => {
    const c2 = makeContainer()
    const proxy = c2.server('llmProxy')
    expect(proxy.rewriteApiBase('http://localhost:1234/v1')).toBe('http://host.docker.internal:1234/v1')
    expect(proxy.rewriteApiBase('http://127.0.0.1:8000/v1')).toBe('http://host.docker.internal:8000/v1')
    expect(proxy.rewriteApiBase('http://0.0.0.0:9000/v1')).toBe('http://host.docker.internal:9000/v1')
    // non-local hosts untouched
    expect(proxy.rewriteApiBase('http://192.168.1.50:8000/v1')).toBe('http://192.168.1.50:8000/v1')
    expect(proxy.rewriteApiBase('https://api.openai.com/v1')).toBe('https://api.openai.com/v1')
  })

  it('honors hostGatewayOverride', () => {
    const c2 = makeContainer()
    const proxy = c2.server('llmProxy', { hostGatewayOverride: '192.168.64.1' })
    expect(proxy.rewriteApiBase('http://localhost:1234/v1')).toBe('http://192.168.64.1:1234/v1')
  })

  it('model defaults to modelName and provider is optional', async () => {
    const proxy = c.server('llmProxy', {
      port: 19402,
      models: [{ modelName: 'openai/gpt-4o' }],
    })
    const configPath = await proxy.writeConfig()
    const config = c.feature('yaml').parse(c.feature('fs').readFile(configPath).toString())
    expect(config.model_list[0].litellm_params.model).toBe('openai/gpt-4o')
    expect(config.model_list[0].litellm_params.api_key).toBeUndefined()
  })
})

describe('llmProxy lifecycle', () => {
  let c: NodeContainer

  beforeEach(() => {
    c = makeContainer()
  })

  it('start() throws a clear error when docker is unavailable', async () => {
    const proxy = c.server('llmProxy', { port: 19410 })
    spyOn(proxy.docker, 'checkDockerAvailability').mockResolvedValue(false)
    expect(proxy.start()).rejects.toThrow(/llmProxy requires docker/)
  })

  it('start() runs the container with port publish, config mount, and env file', async () => {
    const proxy = c.server('llmProxy', {
      port: 19411,
      models: [{ modelName: 'm', provider: 'openai', apiBase: 'http://localhost:1234/v1', apiKey: 'k' }],
    })
    const spies = mockDocker(proxy)
    spyOn(proxy, 'checkHealth').mockResolvedValue(true)
    // pin the port so networking.findOpenPort doesn't shift it
    spyOn(proxy, 'configure').mockImplementation(async () => {
      proxy.state.set('configured', true)
      return proxy
    })

    await proxy.start()

    expect(spies.run).toHaveBeenCalledTimes(1)
    const [image, runOptions] = spies.run.mock.calls[0]
    expect(image).toBe('ghcr.io/berriai/litellm:main-stable')
    expect(runOptions.detach).toBe(true)
    expect(runOptions.name).toBe('luca-llm-proxy-19411')
    expect(runOptions.ports).toEqual(['19411:4000'])
    expect(runOptions.volumes[0]).toMatch(/config\.yaml:\/app\/config\.yaml$/)
    expect(runOptions.envFile).toMatch(/\.env$/)
    expect(runOptions.addHostGateway).toBe(true)
    expect(runOptions.command).toEqual(['--config', '/app/config.yaml', '--port', '4000'])

    expect(proxy.isListening).toBe(true)
    expect(proxy.state.get('containerId')).toBe('abc123')
    expect(proxy.state.get('healthy')).toBe(true)
  })

  it('start() pulls the image when it is not present locally', async () => {
    const proxy = c.server('llmProxy', { port: 19416 })
    const spies = mockDocker(proxy, { images: [] })
    spyOn(proxy, 'checkHealth').mockResolvedValue(true)
    spyOn(proxy, 'configure').mockImplementation(async () => {
      proxy.state.set('configured', true)
      return proxy
    })

    await proxy.start()
    expect(spies.pull).toHaveBeenCalledWith('ghcr.io/berriai/litellm:main-stable')
  })

  it('start() skips the pull when the image is already local', async () => {
    const proxy = c.server('llmProxy', { port: 19417 })
    const spies = mockDocker(proxy)
    spyOn(proxy, 'checkHealth').mockResolvedValue(true)
    spyOn(proxy, 'configure').mockImplementation(async () => {
      proxy.state.set('configured', true)
      return proxy
    })

    await proxy.start()
    expect(spies.pull).not.toHaveBeenCalled()
  })

  it('start() force-removes a stale container with the same name', async () => {
    const proxy = c.server('llmProxy', { port: 19412 })
    const spies = mockDocker(proxy, {
      containers: [{ id: 'stale', name: 'luca-llm-proxy-19412', image: 'x', status: 'Exited', ports: [], created: '' }],
    })
    spyOn(proxy, 'checkHealth').mockResolvedValue(true)
    spyOn(proxy, 'configure').mockImplementation(async () => {
      proxy.state.set('configured', true)
      return proxy
    })

    await proxy.start()
    expect(spies.remove).toHaveBeenCalledWith('luca-llm-proxy-19412', { force: true })
  })

  it('start() fails with log tail when the health check never passes', async () => {
    const proxy = c.server('llmProxy', { port: 19413, healthCheckTimeoutMs: 1 })
    const spies = mockDocker(proxy, { logs: 'boom: config invalid' })
    spyOn(proxy, 'checkHealth').mockResolvedValue(false)
    spyOn(proxy, 'configure').mockImplementation(async () => {
      proxy.state.set('configured', true)
      return proxy
    })

    expect(proxy.start()).rejects.toThrow(/did not become healthy[\s\S]*boom: config invalid/)
  })

  it('stop() stops and removes the container and deletes the env file', async () => {
    const proxy = c.server('llmProxy', {
      port: 19414,
      models: [{ modelName: 'm', provider: 'openai', apiKey: 'k' }],
    })
    const spies = mockDocker(proxy)
    spyOn(proxy, 'checkHealth').mockResolvedValue(true)
    spyOn(proxy, 'configure').mockImplementation(async () => {
      proxy.state.set('configured', true)
      return proxy
    })

    await proxy.start()
    const fs = c.feature('fs')
    expect(fs.exists(proxy.envFilePath)).toBe(true)

    await proxy.stop()
    expect(spies.stop).toHaveBeenCalledWith('luca-llm-proxy-19414')
    expect(spies.remove).toHaveBeenCalledWith('luca-llm-proxy-19414', { force: true })
    expect(fs.exists(proxy.envFilePath)).toBe(false)
    expect(proxy.isListening).toBe(false)
    expect(proxy.isStopped).toBe(true)
  })

  it('logs() passes through to docker getLogs with the container name', async () => {
    const proxy = c.server('llmProxy', { port: 19415 })
    const spies = mockDocker(proxy)
    const output = await proxy.logs({ tail: 10 })
    expect(output).toBe('litellm boot logs')
    expect(spies.logs).toHaveBeenCalledWith('luca-llm-proxy-19415', { tail: 10 })
  })
})
