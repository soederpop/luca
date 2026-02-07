import { Feature, features, type FeatureOptions, type FeatureState } from '../feature.js'

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  ports: string[]
  created: string
}

export interface DockerImage {
  id: string
  repository: string
  tag: string
  size: string
  created: string
}

export interface DockerState extends FeatureState {
  containers: DockerContainer[]
  images: DockerImage[]
  isDockerAvailable: boolean
  lastError?: string
}

export interface DockerOptions extends FeatureOptions {
  dockerPath?: string // Path to docker executable
  timeout?: number // Command timeout in ms
  autoRefresh?: boolean // Auto refresh containers/images on operations
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
   * Execute a command inside a running container
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
    } = {}
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const args = ['exec']
    
    if (options.interactive) args.push('--interactive')
    if (options.tty) args.push('--tty')
    if (options.user) args.push('--user', options.user)
    if (options.workdir) args.push('--workdir', options.workdir)
    if (options.detach) args.push('--detach')
    
    args.push(containerIdOrName, ...command)
    
    const result = await this.executeDockerCommand(args)
    return result
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