import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import os from 'os'

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
  get arch() {
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
  get tmpdir() {
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
  get homedir() {
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
  get cpuCount() {
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
  get hostname() {
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
  get platform() {
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
  get networkInterfaces() {
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
}

export default OS