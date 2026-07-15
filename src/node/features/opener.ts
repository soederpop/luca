import { Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/**
 * The Opener feature opens files, URLs, desktop applications, and code editors.
 *
 * HTTP/HTTPS URLs are opened in Google Chrome. Desktop apps can be launched by name.
 * VS Code and Cursor can be opened to a specific path. All other paths are opened
 * with the platform's default handler (e.g. Preview for images, Finder for folders).
 *
 * Under the hood it delegates to platform-appropriate commands (`open` on macOS,
 * `start` on Windows, `xdg-open` / direct binary invocation on Linux). Every method
 * triggers a side effect on the host — launching an application or browser — so
 * treat all of these as no-run in automated/headless contexts.
 *
 * @example
 * ```typescript
 * // (no-run) opens applications on the host
 * const opener = container.feature('opener')
 *
 * // Open a URL in Chrome (the default browser for HTTP/HTTPS targets)
 * await opener.open('https://github.com/soederpop/luca')
 *
 * // Open a file with the system default handler (e.g. Preview for a .png on macOS)
 * await opener.open('/Users/jon/screenshots/diagram.png')
 *
 * // Launch a desktop application by name
 * await opener.app('Slack')
 *
 * // Open VS Code at a project path
 * await opener.code('/Users/jon/projects/my-app')
 *
 * // Open Cursor at a specific file
 * await opener.cursor('/Users/jon/projects/my-app/src/index.ts')
 * ```
 *
 * @extends Feature
 */
export class Opener extends Feature {
  static override shortcut = "features.opener" as const
  static override description = "Opens files, URLs, desktop apps, and code editors"
  static override stability = 'stable' as const
  static override category = 'media-browser' as const
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
   * HTTP and HTTPS URLs are opened in Google Chrome (on Linux it tries
   * `google-chrome`, then `chromium`, then falls back to `xdg-open`).
   * Everything else is opened with the system default handler
   * (`open` on macOS, `start` on Windows, `xdg-open` on Linux).
   *
   * @param {string} target - A URL or file path to open
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // (no-run) opens applications on the host
   * await opener.open('https://github.com/soederpop/luca') // opens in Chrome
   * await opener.open('/Users/jon/screenshots/diagram.png') // default handler (Preview on macOS)
   * ```
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
   * On macOS, uses `open -a` to launch the app — the application name should match
   * what appears in `/Applications`. On Windows, uses `start`. On Linux, attempts
   * to run the lowercase app name as a command.
   *
   * @param {string} name - The application name (e.g. "Slack", "Finder", "Safari")
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // (no-run) opens applications on the host
   * await opener.app('Slack')
   * await opener.app('Finder')
   * ```
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
   * Uses the `code` CLI command if it is found in PATH. Falls back to
   * `open -a "Visual Studio Code"` on macOS; on other platforms a missing
   * CLI throws with install instructions.
   *
   * @param {string} [path="."] - The file or folder path to open
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // (no-run) opens applications on the host
   * await opener.code('/Users/jon/projects/my-app')
   * ```
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
   * Uses the `cursor` CLI command if it is found in PATH. Falls back to
   * `open -a "Cursor"` on macOS; on other platforms a missing CLI throws
   * with install instructions.
   *
   * @param {string} [path="."] - The file or folder path to open
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // (no-run) opens applications on the host
   * await opener.cursor('/Users/jon/projects/my-app/src/index.ts')
   * ```
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
