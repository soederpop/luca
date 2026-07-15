import { z } from 'zod'
import { ServerStateSchema, ServerOptionsSchema } from '../schemas/base.js'
import { type StartOptions, Server } from '../server.js'

declare module '../server' {
  interface AvailableServers {
    llmProxy: typeof LlmProxyServer
  }
}

export const LlmProxyModelSchema = z.object({
  modelName: z.string().describe('The model name clients use to address this model through the proxy (e.g. "gpt-4o", "local-llama")'),
  provider: z.string().optional().describe('LiteLLM provider prefix (e.g. "openai", "anthropic", "ollama"). Combined with model as provider/model in litellm_params. For OpenAI-compatible local backends (LM Studio, vLLM, llama.cpp) use "openai" with an apiBase'),
  model: z.string().optional().describe('The upstream model id (e.g. "gpt-4o", "claude-sonnet-5"). Defaults to modelName when omitted'),
  apiBase: z.string().optional().describe('Base URL of the backend (e.g. "http://localhost:1234/v1"). localhost/127.0.0.1/0.0.0.0 hosts are rewritten to the container host gateway automatically, since the proxy runs inside a container where localhost is not the host machine'),
  apiKey: z.string().optional().describe('API key for the backend. Never written to the config file — injected via a 0600 env file and referenced as os.environ/LUCA_LLM_KEY_<n>'),
  extraParams: z.record(z.string(), z.string()).optional().describe('Additional litellm_params passed through verbatim (e.g. rpm/tpm limits, api_version)'),
})

export const LlmProxyOptionsSchema = ServerOptionsSchema.extend({
  image: z.string().optional().describe('LiteLLM docker image to run. Defaults to ghcr.io/berriai/litellm:main-stable'),
  masterKey: z.string().optional().describe('LiteLLM master key clients must present as a Bearer token. Injected via the env file as LITELLM_MASTER_KEY and referenced as os.environ/LITELLM_MASTER_KEY in the config — never written to disk in plaintext config'),
  models: z.array(LlmProxyModelSchema).optional().describe('The model routing table: each entry maps a client-facing model name to a backend (local OpenAI-compatible endpoint or paid API)'),
  litellmSettings: z.record(z.string(), z.string()).optional().describe('Passthrough for the litellm_settings section of the generated config (e.g. { drop_params: "true" })'),
  containerName: z.string().optional().describe('Override the container name. Defaults to luca-llm-proxy-<port>, which lets start() reclaim stale containers deterministically'),
  hostGatewayOverride: z.string().optional().describe('Hostname/IP containers use to reach the host machine. Defaults to host.docker.internal (Docker Desktop). Set this when using a runtime with a different host gateway (e.g. 192.168.64.1 for Apple container)'),
  healthCheckTimeoutMs: z.number().optional().describe('How long start() waits for the proxy /health/liveliness endpoint before failing (default 60000)'),
  configDir: z.string().optional().describe('Directory the generated config.yaml and env file are written to. Defaults to <os.tmpdir>/luca-llm-proxy/<containerName>'),
})
export type LlmProxyOptions = z.infer<typeof LlmProxyOptionsSchema>

export const LlmProxyStateSchema = ServerStateSchema.extend({
  containerId: z.string().optional().describe('ID of the running LiteLLM container'),
  containerName: z.string().optional().describe('Name of the LiteLLM container (deterministic, luca-llm-proxy-<port> by default)'),
  configPath: z.string().optional().describe('Absolute path of the generated LiteLLM config.yaml'),
  healthy: z.boolean().optional().describe('Whether the last health check against /health/liveliness passed'),
})
export type LlmProxyState = z.infer<typeof LlmProxyStateSchema>

/**
 * Runs a [LiteLLM proxy](https://docs.litellm.ai/docs/proxy/quick_start) in a
 * docker container, exposing every configured backend — local GPU boxes running
 * OpenAI-compatible servers, LM Studio, paid APIs like OpenAI and Anthropic —
 * behind a single OpenAI-compatible endpoint on `http://localhost:<port>/v1`.
 *
 * `start()` generates a LiteLLM `config.yaml` from the `models` option into a
 * tmp directory, injects API keys through a 0600 env file (keys are referenced
 * in the config as `os.environ/...` and never written into it), and runs the
 * LiteLLM image with the config volume-mounted and the port published. It then
 * polls `/health/liveliness` until the proxy is up. `stop()` stops and removes
 * the container and deletes the env file.
 *
 * **Host networking:** the proxy runs inside a container, so a backend on the
 * host (e.g. LM Studio at `http://localhost:1234/v1`) is not reachable as
 * `localhost`. Any localhost `apiBase` is rewritten automatically to the host
 * gateway (`host.docker.internal` by default; override with
 * `hostGatewayOverride`, e.g. `192.168.64.1` for Apple's container runtime).
 *
 * Requires the docker CLI. Restarting always removes any stale
 * `luca-llm-proxy-<port>` container first, so the running config deterministically
 * matches the options you passed.
 *
 * @extends Server
 *
 * @example
 * ```typescript
 * // (no-run) requires docker and live backends
 * const proxy = container.server('llmProxy', {
 *   port: 4000,
 *   masterKey: 'sk-luca-dev',
 *   models: [
 *     // LM Studio on this machine — localhost is rewritten to the host gateway
 *     { modelName: 'local-qwen', provider: 'openai', model: 'qwen2.5-32b', apiBase: 'http://localhost:1234/v1', apiKey: 'lm-studio' },
 *     // A DGX box on the LAN serving an OpenAI-compatible endpoint
 *     { modelName: 'dgx-llama', provider: 'openai', model: 'llama-3.3-70b', apiBase: 'http://192.168.1.50:8000/v1', apiKey: 'none' },
 *     // A paid API
 *     { modelName: 'claude', provider: 'anthropic', model: 'claude-sonnet-5', apiKey: process.env.ANTHROPIC_API_KEY },
 *   ],
 * })
 * await proxy.start()
 *
 * // one OpenAI-compatible endpoint for everything
 * const client = container.client('rest', { baseURL: proxy.baseURL })
 * const models = await client.get('/v1/models', { headers: { Authorization: 'Bearer sk-luca-dev' } })
 *
 * await proxy.stop()
 * ```
 */
export class LlmProxyServer extends Server<LlmProxyState, LlmProxyOptions> {
  static override shortcut = 'servers.llmProxy' as const
  static override stability = 'experimental' as const
  static override category = 'ai-assistants' as const
  static override stateSchema = LlmProxyStateSchema
  static override optionsSchema = LlmProxyOptionsSchema

  static { Server.register(this, 'llmProxy') }

  /** The docker feature used to run and manage the LiteLLM container. */
  get docker() {
    return this.container.feature('docker')
  }

  get yaml() {
    return this.container.feature('yaml')
  }

  get fs() {
    return this.container.feature('fs')
  }

  get os() {
    return this.container.feature('os')
  }

  /** The OpenAI-compatible base URL of the running proxy, e.g. http://localhost:4000 */
  get baseURL(): string {
    return `http://localhost:${this.port}`
  }

  /** The port the proxy publishes on the host. Defaults to 4000. */
  override get port(): number {
    return this.state.get('port') || this.options.port || 4000
  }

  override get options(): LlmProxyOptions {
    return {
      port: 4000,
      host: '0.0.0.0',
      ...this._options,
    }
  }

  override get initialState(): LlmProxyState {
    return {
      ...super.initialState,
      healthy: false,
    } as LlmProxyState
  }

  /** LiteLLM docker image, ghcr.io/berriai/litellm:main-stable by default. */
  get image(): string {
    return this.options.image || 'ghcr.io/berriai/litellm:main-stable'
  }

  /** Deterministic container name so restarts can reclaim stale containers. */
  get containerName(): string {
    return this.state.get('containerName') || this.options.containerName || `luca-llm-proxy-${this.port}`
  }

  /** Hostname containers use to reach the host machine. */
  get hostGateway(): string {
    return this.options.hostGatewayOverride || 'host.docker.internal'
  }

  /** Directory the generated config.yaml and env file live in. */
  get configDir(): string {
    return this.options.configDir
      || this.container.paths.resolve(this.os.tmpdir, 'luca-llm-proxy', this.containerName)
  }

  /**
   * Rewrite a localhost/127.0.0.1/0.0.0.0 apiBase to the host gateway, since
   * inside the container localhost refers to the container itself, not the
   * machine running backends like LM Studio.
   */
  rewriteApiBase(apiBase: string): string {
    try {
      const url = new URL(apiBase)
      if (['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) {
        url.hostname = this.hostGateway
        return url.toString().replace(/\/$/, apiBase.endsWith('/') ? '/' : '')
      }
    } catch {}
    return apiBase
  }

  /**
   * Generate the LiteLLM config.yaml and the 0600 env file holding the actual
   * API key values. The config references keys as os.environ/LUCA_LLM_KEY_<n>
   * so secrets never appear in the YAML.
   *
   * @returns The absolute path of the written config.yaml
   */
  async writeConfig(): Promise<string> {
    const models = this.options.models || []
    const env: Record<string, string> = {}

    const modelList = models.map((m, i) => {
      const litellmParams: Record<string, string> = {
        model: m.provider ? `${m.provider}/${m.model || m.modelName}` : (m.model || m.modelName),
      }
      if (m.apiBase) litellmParams.api_base = this.rewriteApiBase(m.apiBase)
      if (m.apiKey) {
        const varName = `LUCA_LLM_KEY_${i}`
        env[varName] = m.apiKey
        litellmParams.api_key = `os.environ/${varName}`
      }
      Object.assign(litellmParams, m.extraParams || {})
      return { model_name: m.modelName, litellm_params: litellmParams }
    })

    const config: Record<string, any> = { model_list: modelList }
    if (this.options.litellmSettings) {
      config.litellm_settings = this.options.litellmSettings
    }
    if (this.options.masterKey) {
      env.LITELLM_MASTER_KEY = this.options.masterKey
      config.general_settings = { master_key: 'os.environ/LITELLM_MASTER_KEY' }
    }

    const dir = this.configDir
    await this.fs.mkdirAsync(dir, { recursive: true })

    const configPath = this.container.paths.resolve(dir, 'config.yaml')
    await this.fs.writeFileAsync(configPath, this.yaml.stringify(config))

    const envPath = this.container.paths.resolve(dir, '.env')
    const envContent = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
    await this.fs.writeFileAsync(envPath, envContent)
    if (process.platform !== 'win32') {
      await this.container.feature('proc').spawnAndCapture('chmod', ['600', envPath])
    }

    this.state.set('configPath', configPath)
    return configPath
  }

  /** Path of the env file holding the injected secrets. */
  get envFilePath(): string {
    return this.container.paths.resolve(this.configDir, '.env')
  }

  /**
   * Check the proxy's /health/liveliness endpoint.
   * @returns true when the proxy responds with a 2xx status
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL}/health/liveliness`)
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Start the LiteLLM proxy container.
   *
   * Verifies a container runtime is available, reclaims any stale container
   * with the same name, writes the config + env file, runs the image with the
   * port published and config mounted, then polls /health/liveliness until
   * healthy or `healthCheckTimeoutMs` elapses (failing with the container's
   * recent log output embedded in the error).
   */
  override async start(options?: StartOptions): Promise<this> {
    if (this.isListening) {
      return this
    }

    await this._drainPendingPlugins()

    const available = await this.docker.checkDockerAvailability()
    if (!available) {
      const lastError = this.docker.state.get('lastError')
      throw new Error(`llmProxy requires docker to run the LiteLLM container. ${lastError || 'Docker is not available.'}`)
    }

    if (options?.port) {
      this.state.set('port', options.port)
    }
    if (!this.isConfigured || options?.port) {
      await this.configure()
    }

    const name = this.options.containerName || `luca-llm-proxy-${this.port}`
    this.state.set('containerName', name)

    // Deterministic restarts: remove any stale container with our name so the
    // running config always matches the options we were constructed with.
    const existing = await this.docker.listContainers({ all: true })
    if (existing.some((c) => c.name === name)) {
      await this.docker.removeContainer(name, { force: true })
    }

    const configPath = await this.writeConfig()

    // Pull explicitly when the image is missing so the health-check window
    // isn't silently consumed by a multi-GB download on first start.
    const images = await this.docker.listImages()
    const hasImage = images.some((img) => `${img.repository}:${img.tag}` === this.image)
    if (!hasImage) {
      await this.docker.pullImage(this.image)
    }

    const containerId = await this.docker.runContainer(this.image, {
      detach: true,
      name,
      ports: [`${this.port}:4000`],
      volumes: [`${configPath}:/app/config.yaml`],
      envFile: this.envFilePath,
      addHostGateway: true,
      command: ['--config', '/app/config.yaml', '--port', '4000'],
    })
    this.state.set('containerId', containerId)

    const timeoutMs = this.options.healthCheckTimeoutMs || 60000
    const deadline = Date.now() + timeoutMs
    let healthy = false
    while (Date.now() < deadline) {
      healthy = await this.checkHealth()
      if (healthy) break
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    if (!healthy) {
      let logTail = ''
      try {
        logTail = await this.docker.getLogs(name, { tail: 50 })
      } catch {}
      try {
        await this.docker.removeContainer(name, { force: true })
      } catch {}
      this.state.set('containerId', undefined)
      throw new Error(
        `llmProxy did not become healthy within ${timeoutMs}ms. Recent container logs:\n${logTail}`
      )
    }

    this.state.set('healthy', true)
    this.state.set('listening', true)
    this.state.set('stopped', false)
    return this
  }

  /**
   * Stop and remove the LiteLLM container and delete the env file holding
   * injected secrets. Tolerates the container already being gone.
   */
  override async stop(): Promise<this> {
    if (this.isStopped) {
      return this
    }

    const name = this.containerName
    try {
      await this.docker.stopContainer(name)
    } catch {}
    try {
      await this.docker.removeContainer(name, { force: true })
    } catch {}

    try {
      if (this.fs.exists(this.envFilePath)) {
        await this.fs.unlink(this.envFilePath)
      }
    } catch {}

    this.state.set('containerId', undefined)
    this.state.set('healthy', false)
    this.state.set('listening', false)
    this.state.set('stopped', true)
    return this
  }

  /**
   * Fetch logs from the LiteLLM container.
   *
   * @param options - Passed through to docker getLogs (follow, tail, since, timestamps)
   */
  async logs(options: { follow?: boolean; tail?: number; since?: string; timestamps?: boolean } = {}): Promise<string> {
    return this.docker.getLogs(this.containerName, options)
  }
}

export default LlmProxyServer
