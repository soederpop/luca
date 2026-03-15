import { Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/**
 * The Opener feature opens files, URLs, desktop applications, and code editors.
 *
 * HTTP/HTTPS URLs are opened in Google Chrome. Desktop apps can be launched by name.
 * VS Code and Cursor can be opened to a specific path. All other paths are opened
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
 * // Open a desktop application
 * await opener.app('Slack')
 *
 * // Open VS Code at a project path
 * await opener.code('/Users/jon/projects/my-app')
 *
 * // Open Cursor at a project path
 * await opener.cursor('/Users/jon/projects/my-app')
 * ```
 *
 * @extends Feature
 */
export class Opener extends Feature {
  static override shortcut = "features.opener" as const
  static override description = "Opens files, URLs, desktop apps, and code editors"
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static { Feature.register(this, 'opener') }

  private _binCache: Record<string, string> = {}

  /** Resolve a binary path via `which`, caching the result. */
  private resolveBin(name: string): string {
    if (this._binCache[name]) return this._binCache[name]
    try {
      this._binCache[name] = this.container.proc.exec(`which ${name}`).trim()
    } catch {
      this._binCache[name] = name
    }
    return this._binCache[name]
  }

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
    const platform = this.container.os.platform 

    if (isUrl) {
      console.log(`Opening ${target} in Chrome`)
      await this.openInChrome(target, platform)
    } else {
      await this.openDefault(target, platform)
    }
  }

  private async openInChrome(url: string, platform: string = this.container.os.platform): Promise<void> {
    const proc = this.container.proc

    if (platform === 'darwin') {
      await proc.spawnAndCapture(this.resolveBin('open'), ['-a', 'Google Chrome', url])
    } else if (platform === 'win32') {
      await proc.spawnAndCapture(this.resolveBin('cmd'), ['/c', 'start', 'chrome', url])
    } else {
      // Linux - try google-chrome, then chromium, then fall back to xdg-open
      try {
        await proc.spawnAndCapture(this.resolveBin('google-chrome'), [url])
      } catch {
        try {
          await proc.spawnAndCapture(this.resolveBin('chromium'), [url])
        } catch {
          await proc.spawnAndCapture(this.resolveBin('xdg-open'), [url])
        }
      }
    }
  }

  /**
   * Opens a desktop application by name.
   *
   * On macOS, uses `open -a` to launch the app. On Windows, uses `start`.
   * On Linux, attempts to run the lowercase app name as a command.
   *
   * @param {string} name - The application name (e.g. "Slack", "Finder", "Safari")
   * @returns {Promise<void>}
   */
  async app(name: string): Promise<void> {
    const platform = this.container.os.platform
    const proc = this.container.proc

    if (platform === 'darwin') {
      await proc.spawnAndCapture(this.resolveBin('open'), ['-a', name])
    } else if (platform === 'win32') {
      await proc.spawnAndCapture(this.resolveBin('cmd'), ['/c', 'start', '', name])
    } else {
      await proc.spawnAndCapture(this.resolveBin(name.toLowerCase()), [])
    }
  }

  /**
   * Opens VS Code at the specified path.
   *
   * Uses the `code` CLI command. Falls back to `open -a "Visual Studio Code"` on macOS.
   *
   * @param {string} [path="."] - The file or folder path to open
   * @returns {Promise<void>}
   */
  async code(path: string = "."): Promise<void> {
    const proc = this.container.proc

    try {
      await proc.spawnAndCapture(this.resolveBin('code'), [path])
    } catch {
      if (this.container.os.platform === 'darwin') {
        await proc.spawnAndCapture(this.resolveBin('open'), ['-a', 'Visual Studio Code', path])
      } else {
        throw new Error('VS Code CLI (code) not found. Install it from VS Code: Command Palette > "Shell Command: Install code command in PATH"')
      }
    }
  }

  /**
   * Opens Cursor at the specified path.
   *
   * Uses the `cursor` CLI command. Falls back to `open -a "Cursor"` on macOS.
   *
   * @param {string} [path="."] - The file or folder path to open
   * @returns {Promise<void>}
   */
  async cursor(path: string = "."): Promise<void> {
    const proc = this.container.proc

    try {
      await proc.spawnAndCapture(this.resolveBin('cursor'), [path])
    } catch {
      if (this.container.os.platform === 'darwin') {
        await proc.spawnAndCapture(this.resolveBin('open'), ['-a', 'Cursor', path])
      } else {
        throw new Error('Cursor CLI (cursor) not found. Install it from Cursor: Command Palette > "Shell Command: Install cursor command in PATH"')
      }
    }
  }

  private async openDefault(target: string, platform: string): Promise<void> {
    const proc = this.container.proc

    if (platform === 'darwin') {
      await proc.spawnAndCapture(this.resolveBin('open'), [target])
    } else if (platform === 'win32') {
      await proc.spawnAndCapture(this.resolveBin('cmd'), ['/c', 'start', '', target])
    } else {
      await proc.spawnAndCapture(this.resolveBin('xdg-open'), [target])
    }
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    opener: typeof Opener
  }
}

export default Opener
