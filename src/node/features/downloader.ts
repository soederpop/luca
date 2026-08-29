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
  static override category = 'media-browser' as const
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
   * NOTE: HTTP error statuses (404, 500, ...) do NOT throw — the response body is
   * written as-is, whatever it contains (a 404 HTML error page gets saved at your
   * target path as if it were the file). Only network-level failures (DNS, refused
   * connection, invalid URL) reject. Unless you specifically want that
   * write-whatever-came-back behavior, use `downloadFile()` (throws on 4xx/5xx and
   * empty bodies) or `downloadJson()` (for JSON API responses, no file written).
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

  /**
   * Fetches a URL expected to return JSON and returns the parsed value.
   *
   * The safe default for JSON APIs: unlike `download()`, a non-2xx response
   * THROWS — the error message includes the HTTP status and a truncated copy
   * of the response body, so the failure surfaces at the call site instead of
   * as a parse error far from the cause. No file is written.
   *
   * @param {string} url - The URL to fetch. Must be a valid HTTP/HTTPS URL returning JSON.
   * @param {RequestInit} [opts] - Optional fetch options (headers, method, body, ...) passed straight to `fetch()`.
   *
   * @returns {Promise<T>} A promise that resolves to the parsed JSON response body.
   *
   * @throws {Error} When the response status is not 2xx — the message includes the status code and the (truncated) response body.
   * @throws {Error} When the response body is not valid JSON.
   * @throws {Error} On network-level failures (DNS, refused connection, invalid URL).
   *
   * @example
   * ```typescript
   * // (no-run) fetches from the network
   * const downloader = container.feature('downloader')
   *
   * const release = await downloader.downloadJson<{ tag_name: string }>(
   *   'https://api.github.com/repos/oven-sh/bun/releases/latest',
   *   { headers: { 'User-Agent': 'luca' } }
   * )
   * console.log(release.tag_name)
   *
   * // A 404 throws with the status and body in the message:
   * // Error: downloadJson failed: HTTP 404 for https://... — body: {"message":"Not Found"...
   * ```
   */
  async downloadJson<T = any>(url: string, opts?: RequestInit): Promise<T> {
    const response = await fetch(url, opts)
    const body = await response.text()

    if (!response.ok) {
      throw new Error(`downloadJson failed: HTTP ${response.status} for ${url} — body: ${truncateBody(body)}`)
    }

    try {
      return JSON.parse(body) as T
    } catch (error: any) {
      throw new Error(`downloadJson failed: response from ${url} is not valid JSON (${error?.message || error}) — body: ${truncateBody(body)}`)
    }
  }

  /**
   * Downloads a file from a URL and saves it to the specified local path,
   * throwing on HTTP errors instead of writing the error page to disk.
   *
   * The safe default for file downloads: like `download()`, but a 4xx/5xx
   * response THROWS with the status code in the message (so a 404 HTML page
   * never gets saved as your file), and an empty response body also throws.
   * The target path is resolved relative to the container's working directory.
   *
   * @param {string} url - The URL to download the file from. Must be a valid HTTP/HTTPS URL.
   * @param {string} targetPath - The local file path where the downloaded file should be saved,
   *   resolved relative to the container's base path.
   * @param {RequestInit} [opts] - Optional fetch options (headers, method, ...) passed straight to `fetch()`.
   *
   * @returns {Promise<string>} A promise that resolves to the absolute path of the saved file.
   *
   * @throws {Error} When the response status is 4xx/5xx — the message includes the status code and the (truncated) response body.
   * @throws {Error} When the response body is empty (zero bytes) — nothing is written.
   * @throws {Error} On network-level failures, or when the target directory doesn't exist or is not writable.
   *
   * @example
   * ```typescript
   * // (no-run) fetches from the network
   * const downloader = container.feature('downloader')
   *
   * const localPath = await downloader.downloadFile(
   *   'https://example.com/data.json',
   *   'downloads/data.json'
   * )
   * console.log(`File saved to: ${localPath}`)
   *
   * // A misconfigured URL fails loudly instead of saving an error page:
   * // Error: downloadFile failed: HTTP 404 for https://... — body: <html>...
   * ```
   */
  async downloadFile(url: string, targetPath: string, opts?: RequestInit): Promise<string> {
    const response = await fetch(url, opts)

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`downloadFile failed: HTTP ${response.status} for ${url} — body: ${truncateBody(body)}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())

    if (buffer.length === 0) {
      throw new Error(`downloadFile failed: empty response body from ${url} — nothing written to ${targetPath}`)
    }

    const resolved = this.container.paths.resolve(targetPath)
    await this.container.fs.writeFileAsync(resolved, buffer)
    return resolved
  }

}

/** Truncates a response body for inclusion in an error message. */
function truncateBody(body: string, max = 500): string {
  if (!body) return '(empty)'
  return body.length > max ? `${body.slice(0, max)}… (${body.length} chars total)` : body
}

export default Downloader