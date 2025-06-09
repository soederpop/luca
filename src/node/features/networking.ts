import { Feature, features } from '../feature.js'
import detectPort from 'detect-port'

/**
 * The Networking feature provides utilities for network-related operations.
 * 
 * This feature includes utilities for port detection and availability checking,
 * which are commonly needed when setting up servers or network services.
 * 
 * @example
 * ```typescript
 * const networking = container.feature('networking')
 * 
 * // Find an available port starting from 3000
 * const port = await networking.findOpenPort(3000)
 * console.log(`Available port: ${port}`)
 * 
 * // Check if a specific port is available
 * const isAvailable = await networking.isPortOpen(8080)
 * if (isAvailable) {
 *   console.log('Port 8080 is available')
 * }
 * ```
 * 
 * @extends Feature
 */
export class Networking extends Feature {
  static override shortcut = 'features.networking' as const
  
  /**
   * Finds the next available port starting from the specified port number.
   * 
   * This method will search for the first available port starting from the given
   * port number. If the specified port is available, it returns that port.
   * Otherwise, it returns the next available port.
   * 
   * @param {number} [startAt=0] - The port number to start searching from (0 means system will choose)
   * @returns {Promise<number>} Promise that resolves to an available port number
   * 
   * @example
   * ```typescript
   * // Find any available port
   * const anyPort = await networking.findOpenPort()
   * 
   * // Find an available port starting from 3000
   * const port = await networking.findOpenPort(3000)
   * console.log(`Server can use port: ${port}`)
   * ```
   */
  async findOpenPort(startAt = 0) {
    const nextPort = await detectPort(Number(startAt))
    return nextPort
  }
  
  /**
   * Checks if a specific port is available for use.
   * 
   * This method attempts to detect if the specified port is available.
   * It returns true if the port is available, false if it's already in use.
   * 
   * @param {number} [checkPort=0] - The port number to check for availability
   * @returns {Promise<boolean>} Promise that resolves to true if the port is available, false otherwise
   * 
   * @example
   * ```typescript
   * // Check if port 8080 is available
   * const isAvailable = await networking.isPortOpen(8080)
   * if (isAvailable) {
   *   console.log('Port 8080 is free to use')
   * } else {
   *   console.log('Port 8080 is already in use')
   * }
   * ```
   */
  async isPortOpen(checkPort = 0) {
    const nextPort = await detectPort(Number(checkPort))
    return nextPort && nextPort === Number(checkPort)    
  }
}

export default features.register('networking', Networking)