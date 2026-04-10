import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import os from 'os'
import { join } from 'path'

/** Information about a connected display. */
export interface DisplayInfo {
  name: string
  resolution: { width: number; height: number }
  retina: boolean
  main: boolean
  refreshRate?: number
  connectionType?: string
}

/**
 * The OS feature provides access to operating system utilities and information.
 * 
 * This feature wraps Node.js's built-in `os` module and provides convenient
 * getters for system information like architecture, platform, directories,
 * network interfaces, and hardware details.
 * 
 * @example
 * ```typescript
 * const osInfo = container.feature('os')
 * 
 * console.log(`Platform: ${osInfo.platform}`)
 * console.log(`Architecture: ${osInfo.arch}`)
 * console.log(`CPU cores: ${osInfo.cpuCount}`)
 * console.log(`Home directory: ${osInfo.homedir}`)
 * ```
 * 
 * @extends Feature
 */
export class OS extends Feature {
  static override shortcut = 'features.os' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static { Feature.register(this, 'os') }
  
  /**
   * Gets the operating system CPU architecture.
   * 
   * @returns {string} The CPU architecture (e.g., 'x64', 'arm64', 'arm', 'ia32')
   * 
   * @example
   * ```typescript
   * const arch = os.arch
   * console.log(`Running on ${arch} architecture`)
   * ```
   */
  get arch(): string {
    return os.arch()
  }
  
  /**
   * Gets the operating system's default directory for temporary files.
   * 
   * @returns {string} The path to the temporary directory
   * 
   * @example
   * ```typescript
   * const tempDir = os.tmpdir
   * console.log(`Temp directory: ${tempDir}`)
   * ```
   */
  get tmpdir(): string {
    return os.tmpdir()
  }
  
  /**
   * Gets the current user's home directory path.
   * 
   * @returns {string} The path to the user's home directory
   * 
   * @example
   * ```typescript
   * const home = os.homedir
   * console.log(`User home: ${home}`)
   * ```
   */
  get homedir(): string {
    return os.homedir()
  }
  
  /**
   * Gets the number of logical CPU cores available on the system.
   * 
   * @returns {number} The number of CPU cores
   * 
   * @example
   * ```typescript
   * const cores = os.cpuCount
   * console.log(`System has ${cores} CPU cores`)
   * ```
   */
  get cpuCount(): number {
    return os.cpus().length
  }

  /**
   * Gets the hostname of the operating system.
   * 
   * @returns {string} The system hostname
   * 
   * @example
   * ```typescript
   * const hostname = os.hostname
   * console.log(`Hostname: ${hostname}`)
   * ```
   */
  get hostname(): string {
    return os.hostname()
  }

  /**
   * Gets the operating system platform.
   * 
   * @returns {string} The platform identifier (e.g., 'darwin', 'linux', 'win32')
   * 
   * @example
   * ```typescript
   * const platform = os.platform
   * if (platform === 'darwin') {
   *   console.log('Running on macOS')
   * }
   * ```
   */
  get platform(): string {
    return os.platform()
  }
  
  /**
   * Gets information about the system's network interfaces.
   * 
   * @returns {NodeJS.Dict<os.NetworkInterfaceInfo[]>} Object containing network interface details
   * 
   * @example
   * ```typescript
   * const interfaces = os.networkInterfaces
   * Object.keys(interfaces).forEach(name => {
   *   console.log(`Interface ${name}:`, interfaces[name])
   * })
   * ```
   */
  get networkInterfaces(): NodeJS.Dict<os.NetworkInterfaceInfo[]> {
    return os.networkInterfaces()
  }
  
  /**
   * Gets an array of MAC addresses for non-internal IPv4 network interfaces.
   * 
   * This filters the network interfaces to only include external IPv4 interfaces
   * and returns their MAC addresses, which can be useful for system identification.
   * 
   * @returns {string[]} Array of MAC addresses for external IPv4 interfaces
   * 
   * @example
   * ```typescript
   * const macAddresses = os.macAddresses
   * console.log(`External MAC addresses: ${macAddresses.join(', ')}`)
   * ```
   */
  get macAddresses() : string[] {
    return Object.values(this.networkInterfaces).flat().filter(v => typeof v !== 'undefined' && v.internal === false && v.family === 'IPv4').map(v => v?.mac!).filter(Boolean)
  }

  // ── Cross-platform helpers ───────────────────────────────────────────

  /**
   * Whether the current platform is Windows.
   *
   * @returns {boolean}
   *
   * @example
   * ```typescript
   * if (os.isWindows) {
   *   console.log('Running on Windows')
   * }
   * ```
   */
  get isWindows(): boolean {
    return os.platform() === 'win32'
  }

  /**
   * Whether the current platform is macOS.
   *
   * @returns {boolean}
   *
   * @example
   * ```typescript
   * if (os.isMac) {
   *   console.log('Running on macOS')
   * }
   * ```
   */
  get isMac(): boolean {
    return os.platform() === 'darwin'
  }

  /**
   * Whether the current platform is Linux.
   *
   * @returns {boolean}
   *
   * @example
   * ```typescript
   * if (os.isLinux) {
   *   console.log('Running on Linux')
   * }
   * ```
   */
  get isLinux(): boolean {
    return os.platform() === 'linux'
  }

  /**
   * The platform's default shell for executing command strings.
   * Returns `cmd.exe` on Windows, `sh` on Unix.
   *
   * @returns {string}
   *
   * @example
   * ```typescript
   * // spawn a shell command cross-platform
   * await proc.spawnAndCapture(os.shell, [os.shellFlag, 'echo hello'])
   * ```
   */
  get shell(): string {
    return this.isWindows ? 'cmd.exe' : 'sh'
  }

  /**
   * The flag used to pass a command string to the platform shell.
   * Returns `/c` on Windows, `-c` on Unix.
   *
   * @returns {string}
   *
   * @example
   * ```typescript
   * await proc.spawnAndCapture(os.shell, [os.shellFlag, command])
   * ```
   */
  get shellFlag(): string {
    return this.isWindows ? '/c' : '-c'
  }

  /**
   * The separator used in the PATH environment variable.
   * Returns `;` on Windows, `:` on Unix.
   *
   * @returns {string}
   *
   * @example
   * ```typescript
   * const dirs = process.env.PATH?.split(os.pathSeparator) ?? []
   * ```
   */
  get pathSeparator(): string {
    return this.isWindows ? ';' : ':'
  }

  /**
   * Platform-appropriate cache directory for luca.
   * - Windows: `%LOCALAPPDATA%\luca`
   * - macOS/Linux: `~/.cache/luca` (respects `XDG_CACHE_HOME`)
   *
   * @returns {string}
   *
   * @example
   * ```typescript
   * const cachePath = os.cacheDir
   * // '/home/user/.cache/luca' on Linux
   * // 'C:\Users\user\AppData\Local\luca' on Windows
   * ```
   */
  get cacheDir(): string {
    if (this.isWindows) {
      return join(process.env.LOCALAPPDATA || join(os.homedir(), 'AppData', 'Local'), 'luca')
    }
    const xdg = process.env.XDG_CACHE_HOME || join(os.homedir(), '.cache')
    return join(xdg, 'luca')
  }

  /**
   * Platform-appropriate config directory for luca.
   * - Windows: `%APPDATA%\luca`
   * - macOS: `~/.luca`
   * - Linux: `~/.config/luca` (respects `XDG_CONFIG_HOME`)
   *
   * @returns {string}
   *
   * @example
   * ```typescript
   * const configPath = os.configDir
   * ```
   */
  get configDir(): string {
    if (this.isWindows) {
      return join(process.env.APPDATA || join(os.homedir(), 'AppData', 'Roaming'), 'luca')
    }
    if (this.isMac) {
      return join(os.homedir(), '.luca')
    }
    const xdg = process.env.XDG_CONFIG_HOME || join(os.homedir(), '.config')
    return join(xdg, 'luca')
  }

  /**
   * Resolve the absolute path to a binary using the platform's lookup command.
   * Uses `where` on Windows, `which` on Unix. Returns the binary name as-is
   * if resolution fails (so downstream code can still try the bare name).
   *
   * @param {string} bin - The binary name to look up (e.g. 'git', 'docker', 'ssh')
   * @returns {string} The resolved absolute path, or the bare binary name on failure
   *
   * @example
   * ```typescript
   * const gitPath = os.whichCommand('git')
   * // '/usr/bin/git' on macOS, 'C:\Program Files\Git\cmd\git.exe' on Windows
   * ```
   */
  whichCommand(bin: string): string {
    const proc = this.container.feature('proc')
    const cmd = this.isWindows ? `where ${bin}` : `which ${bin}`
    try {
      const result = proc.exec(cmd).trim()
      // `where` on Windows can return multiple lines; take the first
      return result.split(/\r?\n/)[0]!.trim()
    } catch {
      return bin
    }
  }

  /**
   * Gets information about all connected displays.
   *
   * Platform-specific: currently implemented for macOS (darwin).
   * Linux and Windows will throw with a clear "not yet implemented" message.
   *
   * @returns {DisplayInfo[]} Array of display information objects
   *
   * @example
   * ```typescript
   * const displays = os.getDisplayInfo()
   * displays.forEach(d => {
   *   console.log(`${d.name}: ${d.resolution.width}x${d.resolution.height}${d.retina ? ' (Retina)' : ''}`)
   * })
   * ```
   */
  getDisplayInfo(): DisplayInfo[] {
    const platform = this.platform as NodeJS.Platform
    const handler = this._displayHandlers[platform]

    if (!handler) {
      throw new Error(`getDisplayInfo() is not yet implemented for platform: ${platform}`)
    }

    return handler()
  }

  private _displayHandlers: Partial<Record<NodeJS.Platform, () => DisplayInfo[]>> = {
    darwin: (): DisplayInfo[] => {
      const proc = this.container.feature('proc')
      const raw = proc.exec('system_profiler SPDisplaysDataType -json')
      const data = JSON.parse(raw)
      const displays: DisplayInfo[] = []

      for (const gpu of data.SPDisplaysDataType ?? []) {
        for (const d of gpu.spdisplays_ndrvs ?? []) {
          const resStr: string = d._spdisplays_resolution ?? ''
          const resMatch = resStr.match(/(\d+)\s*x\s*(\d+)/)
          const hzMatch = resStr.match(/@\s*([\d.]+)\s*Hz/i)

          displays.push({
            name: d._name ?? 'Unknown',
            resolution: {
              width: resMatch ? parseInt(resMatch[1] ?? '0', 10) : 0,
              height: resMatch ? parseInt(resMatch[2] ?? '0', 10) : 0,
            },
            retina: /retina/i.test(d._spdisplays_resolution ?? '') || /retina/i.test(d.spdisplays_display_type ?? ''),
            main: d.spdisplays_main === 'spdisplays_yes' || /yes/i.test(d.spdisplays_main ?? ''),
            refreshRate: hzMatch ? parseFloat(hzMatch[1] ?? '0') : undefined,
            connectionType: d.spdisplays_connection_type ?? undefined,
          })
        }
      }

      return displays
    },

    linux: (): DisplayInfo[] => {
      throw new Error('getDisplayInfo() is not yet implemented for Linux')
    },

    win32: (): DisplayInfo[] => {
      throw new Error('getDisplayInfo() is not yet implemented for Windows')
    },
  }
}

export default OS