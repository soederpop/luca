import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/**
 * A feature that provides file downloading capabilities from URLs.
 * 
 * The Downloader feature allows you to fetch files from remote URLs and save them
 * to the local filesystem. It handles the network request, buffering, and file writing
 * operations automatically. Use it when you need to programmatically pull remote
 * assets — images, documents, data files — into your project.
 *
 * When you call `download()`: (1) the URL is fetched, (2) the response body is
 * buffered fully into memory, (3) the buffer is written to the target path, which
 * is resolved relative to the container's working directory. The resolved absolute
 * path is returned.
 *
 * @example
 * ```typescript
 * // (no-run) fetches from the network
 * const downloader = container.feature('downloader')
 *
 * // Download a file — target path is resolved relative to container.cwd
 * const localPath = await downloader.download(
 *   'https://example.com/image.jpg',
 *   'downloads/image.jpg'
 * )
 * console.log(`File saved to: ${localPath}`) // absolute path to the saved file
 * ```
 *
 * @extends Feature
 */
export class Downloader extends Feature {
  static override shortcut = 'features.downloader' as const
  static override stability = 'stable' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static { Feature.register(this, 'downloader') }
  
  /**
   * Downloads a file from a URL and saves it to the specified local path.
   * 
   * This method fetches the file from the provided URL, buffers the entire response
   * body in memory, and writes it to the filesystem at the target path. The target
   * path is resolved relative to the container's working directory
   * (`container.paths.resolve(targetPath)`).
   *
   * Note: HTTP error statuses (404, 500, ...) do NOT throw — the response body is
   * written as-is, whatever it contains. Only network-level failures (DNS, refused
   * connection, invalid URL) reject. Check the URL is correct before trusting the
   * downloaded file.
   *
   * @param {string} url - The URL to download the file from. Must be a valid HTTP/HTTPS URL.
   * @param {string} targetPath - The local file path where the downloaded file should be saved.
   *   This path will be resolved relative to the container's base path.
   *
   * @returns {Promise<string>} A promise that resolves to the absolute path of the saved file.
   *
   * @throws {Error} Throws an error if the URL is invalid or the host is unreachable (network-level failure).
   * @throws {Error} Throws an error if the target directory doesn't exist or is not writable.
   *
   * @example
   * ```typescript
   * // (no-run) fetches from the network
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

export default Downloader