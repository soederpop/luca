import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'

export const DockerContainerSchema = z.object({
  /** Container ID */
  id: z.string().describe('Container ID'),
  /** Container name */
  name: z.string().describe('Container name'),
  /** Image used to create the container */
  image: z.string().describe('Image used to create the container'),
  /** Current container status (e.g. running, exited) */
  status: z.string().describe('Current container status (e.g. running, exited)'),
  /** Published port mappings */
  ports: z.array(z.string()).describe('Published port mappings'),
  /** Container creation timestamp */
  created: z.string().describe('Container creation timestamp'),
})
export type DockerContainer = z.infer<typeof DockerContainerSchema>

export const DockerImageSchema = z.object({
  /** Image ID */
  id: z.string().describe('Image ID'),
  /** Image repository name */
  repository: z.string().describe('Image repository name'),
  /** Image tag */
  tag: z.string().describe('Image tag'),
  /** Image size */
  size: z.string().describe('Image size'),
  /** Image creation timestamp */
  created: z.string().describe('Image creation timestamp'),
})
export type DockerImage = z.infer<typeof DockerImageSchema>

export const DockerStateSchema = FeatureStateSchema.extend({
  /** List of known Docker containers */
  containers: z.array(DockerContainerSchema).describe('List of known Docker containers'),
  /** List of known Docker images */
  images: z.array(DockerImageSchema).describe('List of known Docker images'),
  /** Whether Docker CLI is available on this system */
  isDockerAvailable: z.boolean().describe('Whether Docker CLI is available on this system'),
  /** Last error message from a Docker operation */
  lastError: z.string().optional().describe('Last error message from a Docker operation'),
})
export type DockerState = z.infer<typeof DockerStateSchema>

export const DockerOptionsSchema = FeatureOptionsSchema.extend({
  /** Path to docker executable */
  dockerPath: z.string().optional().describe('Path to docker executable'),
  /** Command timeout in ms */
  timeout: z.number().optional().describe('Command timeout in milliseconds'),
  /** Auto refresh containers/images on operations */
  autoRefresh: z.boolean().optional().describe('Auto refresh containers/images after operations'),
})
export type DockerOptions = z.infer<typeof DockerOptionsSchema>

/** Shell-like interface for executing commands against a Docker container */
export interface DockerShell {
  /** The ID of the container being targeted */
  readonly containerId: string
  /** The result of the most recently executed command, or null if no command has been run */
  readonly last: { stdout: string; stderr: string; exitCode: number } | null
  /** Execute a command string in the container via sh -c */
  run(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>
  /** Destroy the shell container (only needed when volumes created a new container) */
  destroy(): Promise<void>
}

/**
 * Docker CLI interface feature for managing containers, images, and executing Docker commands.
 * 
 * Provides comprehensive Docker operations including:
 * - Container management (list, start, stop, create, remove)
 * - Image management (list, pull, build, remove)
 * - Command execution inside containers
 * - Docker system information
 */
export class Docker extends Feature<DockerState, DockerOptions> {
  static override shortcut = 'features.docker' as const
  static override stateSchema = DockerStateSchema
  static override optionsSchema = DockerOptionsSchema

  override get initialState(): DockerState {
    return {
      ...super.initialState,
      containers: [],
      images: [],
      isDockerAvailable: false
    }
  }

  /**
   * Get the proc feature for executing shell commands
   */
  get proc() {
    return this.container.feature('proc')
  }

  /**
   * Check if Docker is available and working
   */
  async checkDockerAvailability(): Promise<boolean> {
    try {
      const dockerPath = this.options.dockerPath || 'docker'
      const result = await this.proc.spawnAndCapture(dockerPath, ['--version'])
      
      if (result.exitCode === 0) {
        this.setState({ isDockerAvailable: true, lastError: undefined })
        return true
      } else {
        this.setState({ isDockerAvailable: false, lastError: 'Docker command failed' })
        return false
      }
    } catch (error) {
      this.setState({ 
        isDockerAvailable: false, 
        lastError: error instanceof Error ? error.message : 'Unknown error'
      })
      return false
    }
  }

  /**
   * Execute a Docker command and return the result
   */
  private async executeDockerCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!this.state.current.isDockerAvailable) {
      const available = await this.checkDockerAvailability()
      if (!available) {
        throw new Error('Docker is not available')
      }
    }

    try {
      const dockerPath = this.options.dockerPath || 'docker'
      const result = await this.proc.spawnAndCapture(dockerPath, args)
      
      if (result.exitCode !== 0) {
        this.setState({ lastError: result.stderr })
      }
      
      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.setState({ lastError: message })
      throw error
    }
  }

  /**
   * List all containers (running and stopped)
   */
  async listContainers(options: { all?: boolean } = {}): Promise<DockerContainer[]> {
    const args = ['ps', '--format', 'json']
    if (options.all) {
      args.push('--all')
    }

    const result = await this.executeDockerCommand(args)
    
    if (result.exitCode === 0) {
      const containers: DockerContainer[] = []
      const lines = result.stdout.trim().split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const containerData = JSON.parse(line)
          containers.push({
            id: containerData.ID,
            name: containerData.Names,
            image: containerData.Image,
            status: containerData.Status,
            ports: containerData.Ports ? containerData.Ports.split(',').map((p: string) => p.trim()) : [],
            created: containerData.CreatedAt
          })
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
      
      if (this.options.autoRefresh) {
        this.setState({ containers })
      }
      
      return containers
    }
    
    throw new Error(`Failed to list containers: ${result.stderr}`)
  }

  /**
   * List all images
   */
  async listImages(): Promise<DockerImage[]> {
    const result = await this.executeDockerCommand(['images', '--format', 'json'])
    
    if (result.exitCode === 0) {
      const images: DockerImage[] = []
      const lines = result.stdout.trim().split('\n').filter(line => line.trim())
      
      for (const line of lines) {
        try {
          const imageData = JSON.parse(line)
          images.push({
            id: imageData.ID,
            repository: imageData.Repository,
            tag: imageData.Tag,
            size: imageData.Size,
            created: imageData.CreatedAt
          })
        } catch (e) {
          // Skip invalid JSON lines
        }
      }
      
      if (this.options.autoRefresh) {
        this.setState({ images })
      }
      
      return images
    }
    
    throw new Error(`Failed to list images: ${result.stderr}`)
  }

  /**
   * Start a container
   */
  async startContainer(containerIdOrName: string): Promise<void> {
    const result = await this.executeDockerCommand(['start', containerIdOrName])
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to start container: ${result.stderr}`)
    }
    
    if (this.options.autoRefresh) {
      await this.listContainers({ all: true })
    }
  }

  /**
   * Stop a container
   */
  async stopContainer(containerIdOrName: string, timeout?: number): Promise<void> {
    const args = ['stop']
    if (timeout) {
      args.push('--time', timeout.toString())
    }
    args.push(containerIdOrName)
    
    const result = await this.executeDockerCommand(args)
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to stop container: ${result.stderr}`)
    }
    
    if (this.options.autoRefresh) {
      await this.listContainers({ all: true })
    }
  }

  /**
   * Remove a container
   */
  async removeContainer(containerIdOrName: string, options: { force?: boolean } = {}): Promise<void> {
    const args = ['rm']
    if (options.force) {
      args.push('--force')
    }
    args.push(containerIdOrName)
    
    const result = await this.executeDockerCommand(args)
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to remove container: ${result.stderr}`)
    }
    
    if (this.options.autoRefresh) {
      await this.listContainers({ all: true })
    }
  }

  /**
   * Create and run a new container
   */
  async runContainer(
    image: string, 
    options: {
      name?: string
      ports?: string[]
      volumes?: string[]
      environment?: Record<string, string>
      detach?: boolean
      interactive?: boolean
      tty?: boolean
      command?: string[]
      workdir?: string
      user?: string
      entrypoint?: string
      network?: string
      restart?: string
    } = {}
  ): Promise<string> {
    const args = ['run']
    
    if (options.detach) args.push('--detach')
    if (options.interactive) args.push('--interactive')
    if (options.tty) args.push('--tty')
    if (options.name) args.push('--name', options.name)
    if (options.workdir) args.push('--workdir', options.workdir)
    if (options.user) args.push('--user', options.user)
    if (options.entrypoint) args.push('--entrypoint', options.entrypoint)
    if (options.network) args.push('--network', options.network)
    if (options.restart) args.push('--restart', options.restart)
    
    if (options.ports) {
      for (const port of options.ports) {
        args.push('--publish', port)
      }
    }
    
    if (options.volumes) {
      for (const volume of options.volumes) {
        args.push('--volume', volume)
      }
    }
    
    if (options.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        args.push('--env', `${key}=${value}`)
      }
    }
    
    args.push(image)
    
    if (options.command) {
      args.push(...options.command)
    }
    
    const result = await this.executeDockerCommand(args)
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to run container: ${result.stderr}`)
    }
    
    if (this.options.autoRefresh) {
      await this.listContainers({ all: true })
    }
    
    return result.stdout.trim()
  }

  /**
   * Execute a command inside a running container.
   *
   * When volumes are specified, uses `docker run --rm` with the container's image
   * instead of `docker exec`, since exec does not support volume mounts.
   */
  async execCommand(
    containerIdOrName: string,
    command: string[],
    options: {
      interactive?: boolean
      tty?: boolean
      user?: string
      workdir?: string
      detach?: boolean
      environment?: Record<string, string>
      volumes?: string[]
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    // docker exec does not support volume mounts; fall back to docker run --rm
    if (options.volumes?.length) {
      const image = await this.getContainerImage(containerIdOrName)

      const args = ['run', '--rm']
      for (const vol of options.volumes) { args.push('--volume', vol) }
      if (options.interactive) args.push('--interactive')
      if (options.tty) args.push('--tty')
      if (options.user) args.push('--user', options.user)
      if (options.workdir) args.push('--workdir', options.workdir)
      if (options.environment) {
        for (const [key, value] of Object.entries(options.environment)) {
          args.push('--env', `${key}=${value}`)
        }
      }
      args.push(image, ...command)
      return this.executeDockerCommand(args)
    }

    const args = ['exec']

    if (options.interactive) args.push('--interactive')
    if (options.tty) args.push('--tty')
    if (options.user) args.push('--user', options.user)
    if (options.workdir) args.push('--workdir', options.workdir)
    if (options.detach) args.push('--detach')
    if (options.environment) {
      for (const [key, value] of Object.entries(options.environment)) {
        args.push('--env', `${key}=${value}`)
      }
    }

    args.push(containerIdOrName, ...command)

    const result = await this.executeDockerCommand(args)
    return result
  }

  /**
   * Look up the image name for a running container via docker inspect.
   */
  private async getContainerImage(containerIdOrName: string): Promise<string> {
    const result = await this.executeDockerCommand([
      'inspect', '--format', '{{.Config.Image}}', containerIdOrName
    ])
    if (result.exitCode !== 0) {
      throw new Error(`Failed to inspect container ${containerIdOrName}: ${result.stderr}`)
    }
    return result.stdout.trim()
  }

  /**
   * Create a shell-like wrapper for executing multiple commands against a container.
   *
   * When volume mounts are specified, a new long-running container is created from
   * the same image with the mounts applied (since docker exec does not support volumes).
   * Call `destroy()` when finished to clean up the helper container.
   *
   * Returns an object with:
   * - `run(command)` — execute a shell command string via `sh -c`
   * - `last` — getter for the most recent command result
   * - `destroy()` — stop the helper container (no-op when no volumes were needed)
   */
  async createShell(
    containerIdOrName: string,
    options: {
      volumes?: string[]
      workdir?: string
      user?: string
      environment?: Record<string, string>
    } = {}
  ): Promise<DockerShell> {
    const docker = this
    let targetContainer = containerIdOrName
    let createdContainer: string | null = null

    if (options.volumes?.length) {
      const image = await this.getContainerImage(containerIdOrName)

      const runArgs = ['run', '-d', '--rm']
      for (const vol of options.volumes) { runArgs.push('--volume', vol) }
      if (options.workdir) runArgs.push('--workdir', options.workdir)
      if (options.user) runArgs.push('--user', options.user)
      if (options.environment) {
        for (const [key, value] of Object.entries(options.environment)) {
          runArgs.push('--env', `${key}=${value}`)
        }
      }
      runArgs.push(image, 'sleep', 'infinity')

      const runResult = await this.executeDockerCommand(runArgs)
      if (runResult.exitCode !== 0) {
        throw new Error(`Failed to create shell container: ${runResult.stderr}`)
      }
      targetContainer = runResult.stdout.trim()
      createdContainer = targetContainer
    }

    // Only pass workdir/user to exec when we didn't bake them into the container
    const execOpts: { workdir?: string; user?: string } = {}
    if (!createdContainer) {
      if (options.workdir) execOpts.workdir = options.workdir
      if (options.user) execOpts.user = options.user
    }

    let _last: { stdout: string; stderr: string; exitCode: number } | null = null

    return {
      get containerId() { return targetContainer },
      get last() { return _last },
      run: async (command: string) => {
        _last = await docker.execCommand(targetContainer, ['sh', '-c', command], execOpts)
        return _last
      },
      destroy: async () => {
        if (createdContainer) {
          await docker.executeDockerCommand(['stop', createdContainer])
          createdContainer = null
        }
      }
    }
  }

  /**
   * Pull an image from a registry
   */
  async pullImage(image: string): Promise<void> {
    const result = await this.executeDockerCommand(['pull', image])
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to pull image: ${result.stderr}`)
    }
    
    if (this.options.autoRefresh) {
      await this.listImages()
    }
  }

  /**
   * Remove an image
   */
  async removeImage(imageIdOrName: string, options: { force?: boolean } = {}): Promise<void> {
    const args = ['rmi']
    if (options.force) {
      args.push('--force')
    }
    args.push(imageIdOrName)
    
    const result = await this.executeDockerCommand(args)
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to remove image: ${result.stderr}`)
    }
    
    if (this.options.autoRefresh) {
      await this.listImages()
    }
  }

  /**
   * Build an image from a Dockerfile
   */
  async buildImage(
    contextPath: string, 
    options: {
      tag?: string
      dockerfile?: string
      buildArgs?: Record<string, string>
      target?: string
      nocache?: boolean
    } = {}
  ): Promise<void> {
    const args = ['build']
    
    if (options.tag) args.push('--tag', options.tag)
    if (options.dockerfile) args.push('--file', options.dockerfile)
    if (options.target) args.push('--target', options.target)
    if (options.nocache) args.push('--no-cache')
    
    if (options.buildArgs) {
      for (const [key, value] of Object.entries(options.buildArgs)) {
        args.push('--build-arg', `${key}=${value}`)
      }
    }
    
    args.push(contextPath)
    
    const result = await this.executeDockerCommand(args)
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to build image: ${result.stderr}`)
    }
    
    if (this.options.autoRefresh) {
      await this.listImages()
    }
  }

  /**
   * Get container logs
   */
  async getLogs(
    containerIdOrName: string, 
    options: {
      follow?: boolean
      tail?: number
      since?: string
      timestamps?: boolean
    } = {}
  ): Promise<string> {
    const args = ['logs']
    
    if (options.follow) args.push('--follow')
    if (options.tail) args.push('--tail', options.tail.toString())
    if (options.since) args.push('--since', options.since)
    if (options.timestamps) args.push('--timestamps')
    
    args.push(containerIdOrName)
    
    const result = await this.executeDockerCommand(args)
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to get logs: ${result.stderr}`)
    }
    
    return result.stdout
  }

  /**
   * Get Docker system information
   */
  async getSystemInfo(): Promise<any> {
    const result = await this.executeDockerCommand(['system', 'info', '--format', 'json'])
    
    if (result.exitCode !== 0) {
      throw new Error(`Failed to get system info: ${result.stderr}`)
    }
    
    return JSON.parse(result.stdout)
  }

  /**
   * Prune unused Docker resources
   */
  async prune(options: {
    containers?: boolean
    images?: boolean
    volumes?: boolean
    networks?: boolean
    all?: boolean
    force?: boolean
  } = {}): Promise<void> {
    const commands = []
    
    if (options.containers || options.all) {
      commands.push(['container', 'prune', '--force'])
    }
    
    if (options.images || options.all) {
      const args = ['image', 'prune']
      if (options.force) args.push('--force')
      commands.push(args)
    }
    
    if (options.volumes || options.all) {
      commands.push(['volume', 'prune', '--force'])
    }
    
    if (options.networks || options.all) {
      commands.push(['network', 'prune', '--force'])
    }
    
    if (commands.length === 0) {
      commands.push(['system', 'prune', '--force'])
    }
    
    for (const command of commands) {
      await this.executeDockerCommand(command)
    }
    
    if (this.options.autoRefresh) {
      await Promise.all([
        this.listContainers({ all: true }),
        this.listImages()
      ])
    }
  }

  /**
   * Initialize the Docker feature
   */
  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)
    
    // Check Docker availability on enable
    await this.checkDockerAvailability()
    
    // Initial refresh of containers and images if Docker is available
    if (this.state.current.isDockerAvailable && this.options.autoRefresh) {
      try {
        await Promise.all([
          this.listContainers({ all: true }),
          this.listImages()
        ])
      } catch (error) {
        // Don't fail enable if we can't list initially
        this.setState({ lastError: error instanceof Error ? error.message : 'Unknown error' })
      }
    }
    
    return this
  }
}

export default features.register('docker', Docker)