import { features, Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/**
 * The Opener feature opens files and URLs using the system's default application.
 *
 * HTTP/HTTPS URLs are opened in Google Chrome. All other paths are opened
 * with the platform's default handler (e.g. Preview for images, Finder for folders).
 *
 * @example
 * ```typescript
 * const opener = container.feature('opener')
 *
 * // Open a URL in Chrome
 * await opener.open('https://www.google.com')
 *
 * // Open a file with the default application
 * await opener.open('/path/to/image.png')
 *
 * // Open a folder in Finder
 * await opener.open('/Users/jon/projects')
 * ```
 *
 * @extends Feature
 */
export class Opener extends Feature {
  static override shortcut = "features.opener" as const
  static override description = "Opens files and URLs with the system default application"
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  /**
   * Opens a path or URL with the appropriate application.
   *
   * HTTP and HTTPS URLs are opened in Google Chrome.
   * Everything else is opened with the system default handler via `open` (macOS).
   *
   * @param {string} target - A URL or file path to open
   * @returns {Promise<void>}
   */
  async open(target: string): Promise<void> {
    const isUrl = /^https?:\/\//i.test(target)
    const platform = process.platform

    if (isUrl) {
      await this.openInChrome(target, platform)
    } else {
      await this.openDefault(target, platform)
    }
  }

  private async openInChrome(url: string, platform: string): Promise<void> {
    const proc = this.container.proc

    if (platform === 'darwin') {
      await proc.execAndCapture(`open -a "Google Chrome" ${url}`)
    } else if (platform === 'win32') {
      await proc.execAndCapture(`start chrome ${url}`)
    } else {
      // Linux - try google-chrome, then chromium, then fall back to xdg-open
      try {
        await proc.execAndCapture(`google-chrome ${url}`)
      } catch {
        try {
          await proc.execAndCapture(`chromium ${url}`)
        } catch {
          await proc.execAndCapture(`xdg-open ${url}`)
        }
      }
    }
  }

  private async openDefault(target: string, platform: string): Promise<void> {
    const proc = this.container.proc

    if (platform === 'darwin') {
      await proc.execAndCapture(`open "${target}"`)
    } else if (platform === 'win32') {
      await proc.execAndCapture(`start "" "${target}"`)
    } else {
      await proc.execAndCapture(`xdg-open "${target}"`)
    }
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    opener: typeof Opener
  }
}

export default features.register("opener", Opener)
