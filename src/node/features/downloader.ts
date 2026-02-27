import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import fetch from 'cross-fetch'

/**
 * A feature that provides file downloading capabilities from URLs.
 * 
 * The Downloader feature allows you to fetch files from remote URLs and save them
 * to the local filesystem. It handles the network request, buffering, and file writing
 * operations automatically.
 * 
 * @example
 * ```typescript
 * // Enable the downloader feature
 * const downloader = container.feature('downloader')
 * 
 * // Download a file
 * const localPath = await downloader.download(
 *   'https://example.com/image.jpg',
 *   'downloads/image.jpg'
 * )
 * console.log(`File saved to: ${localPath}`)
 * ```
 * 
 * @extends Feature
 */
export class Downloader extends Feature {
  /**
   * The shortcut path for accessing this feature through the container.
   *
   * @static
   * @readonly
   * @type {string}
   */
  static override shortcut = 'features.downloader' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  
  /**
   * Downloads a file from a URL and saves it to the specified local path.
   * 
   * This method fetches the file from the provided URL, converts it to a buffer,
   * and writes it to the filesystem at the target path. The target path is resolved
   * relative to the container's configured paths.
   * 
   * @param {string} url - The URL to download the file from. Must be a valid HTTP/HTTPS URL.
   * @param {string} targetPath - The local file path where the downloaded file should be saved.
   *   This path will be resolved relative to the container's base path.
   * 
   * @returns {Promise<string>} A promise that resolves to the absolute path of the saved file.
   * 
   * @throws {Error} Throws an error if the URL is invalid or unreachable.
   * @throws {Error} Throws an error if the target directory doesn't exist or is not writable.
   * @throws {Error} Throws an error if the network request fails or times out.
   * @throws {Error} Throws an error if there's insufficient disk space to save the file.
   * 
   * @example
   * ```typescript
   * // Download an image file
   * const imagePath = await downloader.download(
   *   'https://example.com/photo.jpg',
   *   'images/downloaded-photo.jpg'
   * )
   * 
   * // Download a document
   * const docPath = await downloader.download(
   *   'https://api.example.com/files/document.pdf',
   *   'documents/report.pdf'
   * )
   * ```
   * 
   * @since 1.0.0
   */
  async download(url: string, targetPath: string) {
    const buffer = await fetch(url).then(res => res.arrayBuffer())
    await this.container.fs.writeFileAsync(
      this.container.paths.resolve(targetPath),
      Buffer.from(buffer)
    )
    
    return this.container.paths.resolve(targetPath)
  }
  
}

/**
 * Registers the Downloader feature with the features registry.
 * This makes the feature available for use in containers via `container.use('downloader')`.
 * 
 * @type {typeof Downloader}
 */
export default features.register('downloader', Downloader)