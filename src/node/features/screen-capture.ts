import { Feature, type FeatureState } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { z } from 'zod'

/** Information about an on-screen window, from the macOS window server. */
export interface CaptureWindowInfo {
  /** The CGWindowID — pass this to captureWindow() for an exact capture */
  id: number
  /** The owning application's name (e.g. 'Safari', 'Terminal') */
  app: string
  /** The window title (empty when the app doesn't publish one without Screen Recording permission) */
  title: string
  /** The owning application's process id */
  pid: number
  /** The window's frame in screen coordinates */
  bounds: { x: number; y: number; width: number; height: number }
}

/** A rectangle in screen coordinates, origin at the top-left of the main display. */
export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

/** Options shared by the still-image capture methods. */
export interface CaptureImageOptions {
  /** Where to save the image. Relative paths resolve against container.cwd. Defaults to a temp file. */
  output?: string
  /** Image format (default 'png') */
  format?: 'png' | 'jpg' | 'pdf' | 'tiff'
  /** 1-based display number for multi-monitor setups (screen captures only) */
  display?: number
  /** Include the mouse cursor in the capture (default false) */
  cursor?: boolean
  /** Include the window drop shadow in window captures (default true) */
  shadow?: boolean
}

/** Options for record(). */
export interface CaptureRecordOptions {
  /** Where to save the movie (.mov). Relative paths resolve against container.cwd. Defaults to a temp file. */
  output?: string
  /** Stop automatically after this many seconds. Omit for open-ended recording via stop(). */
  duration?: number
  /** Record audio from the default input alongside the video (default false) */
  audio?: boolean
  /** Visualize mouse clicks in the recording (default false) */
  showClicks?: boolean
  /** 1-based display number for multi-monitor setups */
  display?: number
  /** Restrict the recording to a screen rect instead of the full display */
  rect?: CaptureRect
}

/** Handle returned by record() while a recording is in progress. */
export interface CaptureRecording {
  /** Absolute path the movie will be written to */
  path: string
  /** Stop the recording; resolves to the movie path once the file is finalized */
  stop: () => Promise<string>
  /** Resolves to the movie path when the recording ends (duration elapsed or stop() called) */
  done: Promise<string>
}

export const ScreenCaptureOptionsSchema = FeatureOptionsSchema.extend({
  /** Default directory for captures when no output path is given (defaults to the OS temp dir) */
  outputDir: z.string().optional().describe('Default directory for captures when no output path is given'),
})

export type ScreenCaptureOptions = z.infer<typeof ScreenCaptureOptionsSchema>

const PERMISSION_HINT =
  'If the image is black or shows only the wallpaper, the host app (your terminal or the luca binary) ' +
  'needs Screen Recording permission: System Settings → Privacy & Security → Screen & System Audio Recording.'

// JXA one-liner: enumerate on-screen windows via CGWindowListCopyWindowInfo.
// castRefToObject is required — deepUnwrap on the raw CFArrayRef segfaults osascript.
const LIST_WINDOWS_JXA = `
ObjC.import('CoreGraphics');
const arr = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionOnScreenOnly | $.kCGWindowListExcludeDesktopElements, $.kCGNullWindowID);
const list = ObjC.deepUnwrap(ObjC.castRefToObject(arr)) || [];
JSON.stringify(list.filter(w => w.kCGWindowLayer === 0).map(w => ({
  id: w.kCGWindowNumber,
  app: w.kCGWindowOwnerName || '',
  title: w.kCGWindowName || '',
  pid: w.kCGWindowOwnerPID,
  bounds: {
    x: w.kCGWindowBounds.X, y: w.kCGWindowBounds.Y,
    width: w.kCGWindowBounds.Width, height: w.kCGWindowBounds.Height
  }
})));
`.trim()

/**
 * The ScreenCapture feature takes screenshots and screen recordings on macOS.
 *
 * It wraps the system `/usr/sbin/screencapture` tool (no dependencies, nothing
 * to install) and the window server's window list, so it can capture the full
 * screen, a region, or a single application window by name — plus video
 * recordings with optional audio.
 *
 * macOS only. Every method throws a clear error on other platforms.
 *
 * The first capture from a new host app needs the Screen Recording permission
 * (System Settings → Privacy & Security). Without it, captures still "succeed"
 * but come back black or wallpaper-only — window titles in listWindows() also
 * arrive empty. Grant the permission once and restart the host app.
 *
 * @example
 * ```typescript
 * // (no-run) interacts with the display server
 * const capture = container.feature('screenCapture')
 *
 * // Full screen to a temp file
 * const shot = await capture.captureScreen()
 *
 * // A specific app's frontmost window
 * const win = await capture.captureWindow('Safari', { output: 'safari.png' })
 *
 * // 10-second screen recording
 * const rec = await capture.record({ duration: 10 })
 * const movie = await rec.done
 * ```
 *
 * @extends Feature
 */
export class ScreenCapture extends Feature<FeatureState, ScreenCaptureOptions> {
  static override shortcut = 'features.screenCapture' as const
  static override stability = 'experimental' as const
  static override category = 'media-browser' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = ScreenCaptureOptionsSchema
  static { Feature.register(this, 'screenCapture') }

  /**
   * Lists all visible windows known to the window server.
   *
   * Returns normal application windows only (layer 0 — menu bar items, docks,
   * and overlays are filtered out), front-to-back. Use the `id` with
   * captureWindow() for an exact capture, or just pass the app name.
   *
   * NOTE: `title` is empty for other apps' windows until the host app has the
   * Screen Recording permission — `app`, `pid`, and `bounds` are always present.
   *
   * @returns {Promise<CaptureWindowInfo[]>} Visible windows, frontmost first
   *
   * @example
   * ```typescript
   * // (no-run) interacts with the display server
   * const capture = container.feature('screenCapture')
   * const windows = await capture.listWindows()
   * windows.forEach(w => console.log(`${w.id} ${w.app} — ${w.title}`))
   * ```
   */
  async listWindows(): Promise<CaptureWindowInfo[]> {
    this.assertMac('listWindows')
    const proc = this.container.feature('proc')
    const result = await proc.spawnAndCapture('osascript', ['-l', 'JavaScript', '-e', LIST_WINDOWS_JXA])

    if (result.exitCode !== 0) {
      throw new Error(`listWindows failed: osascript exited ${result.exitCode} — ${result.stderr?.trim()}`)
    }

    return JSON.parse(result.stdout.trim())
  }

  /**
   * Captures the entire screen to an image file.
   *
   * @param {CaptureImageOptions} [options] - Output path, format, display, cursor
   * @returns {Promise<string>} Absolute path to the saved image
   *
   * @example
   * ```typescript
   * // (no-run) interacts with the display server
   * const capture = container.feature('screenCapture')
   *
   * const shot = await capture.captureScreen()
   * const second = await capture.captureScreen({ display: 2, format: 'jpg', output: 'screen2.jpg' })
   * ```
   */
  async captureScreen(options: CaptureImageOptions = {}): Promise<string> {
    this.assertMac('captureScreen')
    const args: string[] = []
    if (options.display) args.push(`-D${options.display}`)
    return this.runCapture(args, options)
  }

  /**
   * Captures a single application window to an image file.
   *
   * Pass a window id (from listWindows()) for an exact match, or a string to
   * match by app name or window title (case-insensitive substring). With a
   * string, the frontmost matching window wins. The window is captured even
   * when it's behind other windows — no need to bring it forward.
   *
   * @param {string | number} target - Window id, app name, or title substring (e.g. 'Safari', 81146)
   * @param {CaptureImageOptions} [options] - Output path, format, shadow
   * @returns {Promise<string>} Absolute path to the saved image
   *
   * @throws {Error} When no visible window matches the target
   *
   * @example
   * ```typescript
   * // (no-run) interacts with the display server
   * const capture = container.feature('screenCapture')
   *
   * const shot = await capture.captureWindow('Terminal')
   * const noShadow = await capture.captureWindow('Safari', { shadow: false, output: 'safari.png' })
   * ```
   */
  async captureWindow(target: string | number, options: CaptureImageOptions = {}): Promise<string> {
    this.assertMac('captureWindow')
    const windowId = typeof target === 'number' ? target : await this.findWindowId(target)
    const args = [`-l${windowId}`]
    if (options.shadow === false) args.push('-o')
    return this.runCapture(args, options)
  }

  /**
   * Captures a rectangular region of the screen to an image file.
   *
   * Coordinates are in screen points with the origin at the top-left of the
   * main display.
   *
   * @param {CaptureRect} rect - The region to capture
   * @param {CaptureImageOptions} [options] - Output path, format, cursor
   * @returns {Promise<string>} Absolute path to the saved image
   *
   * @example
   * ```typescript
   * // (no-run) interacts with the display server
   * const capture = container.feature('screenCapture')
   * const shot = await capture.captureRegion({ x: 0, y: 0, width: 800, height: 600 })
   * ```
   */
  async captureRegion(rect: CaptureRect, options: CaptureImageOptions = {}): Promise<string> {
    this.assertMac('captureRegion')
    return this.runCapture([`-R${rect.x},${rect.y},${rect.width},${rect.height}`], options)
  }

  /**
   * Records the screen to a QuickTime movie (.mov).
   *
   * With `duration`, the recording stops on its own — await `done`. Without
   * it, the recording runs until you call `stop()`. Either way the resolved
   * value is the absolute path to the finished movie.
   *
   * Video is whole-screen or rect only — per-window video isn't supported by
   * the system tool.
   *
   * @param {CaptureRecordOptions} [options] - Duration, audio, clicks, display, rect
   * @returns {Promise<CaptureRecording>} Handle with `path`, `stop()`, and `done`
   *
   * @throws {Error} When the recorder exits without producing a file (usually the Screen Recording permission)
   *
   * @example
   * ```typescript
   * // (no-run) records the screen
   * const capture = container.feature('screenCapture')
   *
   * // Fixed-length recording
   * const rec = await capture.record({ duration: 10, audio: true })
   * const movie = await rec.done
   *
   * // Open-ended: stop it yourself
   * const live = await capture.record({ showClicks: true })
   * // ... do the thing being demonstrated ...
   * const path = await live.stop()
   * ```
   */
  async record(options: CaptureRecordOptions = {}): Promise<CaptureRecording> {
    this.assertMac('record')
    const proc = this.container.feature('proc')
    const output = this.resolveOutput(options.output, 'mov')

    const args = ['-x', '-v']
    if (options.duration) args.push(`-V${options.duration}`)
    if (options.audio) args.push('-g')
    if (options.showClicks) args.push('-k')
    if (options.display) args.push(`-D${options.display}`)
    if (options.rect) args.push(`-R${options.rect.x},${options.rect.y},${options.rect.width},${options.rect.height}`)
    args.push(output)

    const child = proc.spawn('screencapture', args)
    let stderr = ''
    child.stderr?.on('data', (buf: Buffer) => { stderr += buf.toString() })

    const done = new Promise<string>((resolve, reject) => {
      child.on('exit', async () => {
        // screencapture finalizes the movie after SIGINT; give the file a beat to land
        const fs = this.container.fs
        for (let i = 0; i < 20 && !fs.exists(output); i++) {
          await this.container.utils.sleep(100)
        }
        if (!fs.exists(output)) {
          reject(new Error(`record failed: no movie written to ${output}. ${stderr.trim()} ${PERMISSION_HINT}`))
          return
        }
        resolve(output)
      })
      child.on('error', (err: Error) => reject(new Error(`record failed to start: ${err.message}`)))
    })

    return {
      path: output,
      done,
      stop: () => {
        child.kill('SIGINT')
        return done
      },
    }
  }

  /** Resolve an app name or title substring to the frontmost matching window's id. */
  private async findWindowId(query: string): Promise<number> {
    const windows = await this.listWindows()
    const q = query.toLowerCase()
    const match = windows.find(w => w.app.toLowerCase().includes(q) || w.title.toLowerCase().includes(q))

    if (!match) {
      const apps = [...new Set(windows.map(w => w.app))].join(', ')
      throw new Error(`captureWindow: no visible window matches '${query}'. Visible apps: ${apps}`)
    }

    return match.id
  }

  /** Run screencapture with the given mode args plus shared image options, verify output. */
  private async runCapture(modeArgs: string[], options: CaptureImageOptions): Promise<string> {
    const proc = this.container.feature('proc')
    const format = options.format ?? 'png'
    const output = this.resolveOutput(options.output, format)

    const args = ['-x', `-t${format}`, ...modeArgs]
    if (options.cursor) args.push('-C')
    args.push(output)

    const result = await proc.spawnAndCapture('screencapture', args)

    if (result.exitCode !== 0) {
      throw new Error(`screencapture exited ${result.exitCode}: ${result.stderr?.trim()}. ${PERMISSION_HINT}`)
    }

    const stat = await this.container.fs.statAsync(output).catch(() => null)
    if (!stat || stat.size === 0) {
      throw new Error(`screencapture wrote no output to ${output}. ${PERMISSION_HINT}`)
    }

    return output
  }

  /** Resolve the output path: explicit path (relative to cwd), or a temp file. */
  private resolveOutput(output: string | undefined, ext: string): string {
    if (output) return this.container.paths.resolve(output)
    const dir = this.options.outputDir
      ? this.container.paths.resolve(this.options.outputDir)
      : this.container.feature('os').tmpdir
    return this.container.paths.resolve(dir, `luca-capture-${this.container.utils.uuid()}.${ext}`)
  }

  private assertMac(method: string): void {
    if (process.platform !== 'darwin') {
      throw new Error(`screenCapture.${method}() is only supported on macOS (platform: ${process.platform})`)
    }
  }
}

export default ScreenCapture
