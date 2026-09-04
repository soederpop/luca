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
  /** Stop automatically after this many seconds. Defaults to 300 (5 minutes) so a forgotten recording can't run forever; pass 0 for a truly open-ended recording ended only by stop(). */
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
  /**
   * Stop the recording early; resolves to the movie path once the file is
   * finalized. Works by pressing the system stop-recording hotkey (⌃⌘Esc) —
   * signals kill screencapture without saving — so the host app needs the
   * Accessibility permission. On failure it throws and leaves the recording
   * running, to be finalized by its duration cap.
   */
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

// ⌃⌘Esc — the system-wide "stop screen recording" hotkey. Since macOS 15
// (Sequoia), EVERY POSIX signal kills `screencapture -v` without finalizing
// the movie (verified empirically: SIGINT, SIGTERM, SIGHUP, SIGUSR1, SIGUSR2
// all leave no file behind — only a -V duration expiring writes one). Pressing
// this hotkey through System Events is the one way to stop a recording early
// and keep the footage. It needs the Accessibility permission.
const STOP_HOTKEY_SCRIPT = 'tell application "System Events" to key code 53 using {control down, command down}'

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
 * arrive empty. Grant the permission once and restart the host app. Stopping
 * a recording early additionally needs the Accessibility permission (stop()
 * presses the system ⌃⌘Esc hotkey — signals would discard the footage).
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

  // Agent tools, consumed only via assistant.use(screenCapture). Handlers wrap
  // the plain instance methods and return { path, images: [path] } — the
  // conversation's tool-image injection turns that into real image input, so a
  // vision-capable assistant (or one with visionSupport) SEES the capture. The
  // instance methods themselves stay assistant-agnostic and return plain paths.
  static override tools: Record<string, { schema: z.ZodType; description?: string; handler?: Function }> = {
    captureScreen: {
      description: 'Capture the entire screen as an image. The screenshot is attached to the conversation so you can see it and describe or reason about what is on screen.',
      schema: z.object({
        display: z.number().optional().describe('1-based display number for multi-monitor setups (default: main display)'),
      }).describe('Capture the entire screen and attach the image.'),
      handler: async (args: { display?: number }, capture: ScreenCapture) => {
        const path = await capture.captureScreen({ display: args.display })
        return { path, images: [path] }
      },
    },
    captureWindow: {
      description: 'Capture a single application window as an image, even when it is behind other windows. The screenshot is attached to the conversation so you can see it. Use listWindows first if you are unsure what is open.',
      schema: z.object({
        target: z.string().describe('App name or window title to match, case-insensitive substring (e.g. "Safari", "Terminal")'),
      }).describe('Capture one application window and attach the image.'),
      handler: async (args: { target: string }, capture: ScreenCapture) => {
        const path = await capture.captureWindow(args.target)
        return { path, images: [path] }
      },
    },
    captureRegion: {
      description: 'Capture a rectangular region of the screen as an image (coordinates in screen points, origin at the top-left of the main display). The screenshot is attached to the conversation so you can see it. Use listWindows to find window bounds when targeting an area like "the right half" or "where Safari is".',
      schema: z.object({
        x: z.number().describe('Left edge of the region, in screen points'),
        y: z.number().describe('Top edge of the region, in screen points'),
        width: z.number().describe('Width of the region, in screen points'),
        height: z.number().describe('Height of the region, in screen points'),
      }).describe('Capture a screen region and attach the image.'),
      handler: async (args: { x: number; y: number; width: number; height: number }, capture: ScreenCapture) => {
        const path = await capture.captureRegion(args)
        return { path, images: [path] }
      },
    },
    listWindows: {
      description: 'List the visible application windows (app name, window title, window id, position and size). Use this to find a capture target before captureWindow.',
      schema: z.object({}).describe('List visible application windows.'),
      handler: (_args: {}, capture: ScreenCapture) => capture.listWindows(),
    },
    recordScreen: {
      description: 'Start recording the screen (or a region of it) to a .mov video file. Returns immediately with a recordingId — the recording continues in the background while you do other work. It stops on its own after duration seconds (default 300); call stopRecording earlier to end it, or afterwards to confirm the finished file. To record an area like "the right half" or one app\'s area, use listWindows for bounds and pass a rect — window z-order does not matter, the recording shows the screen as the user sees it. NOTE: you cannot watch the video — report the path to the user.',
      schema: z.object({
        duration: z.number().optional().describe('Auto-stop after this many seconds (default 300 — every recording has a time limit)'),
        audio: z.boolean().optional().describe('Also record audio from the default input (default false)'),
        rect: z.object({
          x: z.number().describe('Left edge, in screen points'),
          y: z.number().describe('Top edge, in screen points'),
          width: z.number().describe('Width, in screen points'),
          height: z.number().describe('Height, in screen points'),
        }).optional().describe('Restrict the recording to this screen region (origin at the top-left of the main display); omit for the full screen'),
        display: z.number().optional().describe('1-based display number for multi-monitor setups (default: main display)'),
      }).describe('Start a background screen recording.'),
      handler: async (args: { duration?: number; audio?: boolean; rect?: CaptureRect; display?: number }, capture: ScreenCapture) => {
        // No open-ended recordings from the tool layer: a forgotten one must
        // always run out on its own, so 0/undefined becomes the default cap.
        const duration = args.duration && args.duration > 0 ? args.duration : 300
        const recording = await capture.record({ duration, audio: args.audio, rect: args.rect, display: args.display })
        const recordingId = capture.trackRecording(recording)
        return {
          recordingId,
          path: recording.path,
          status: 'recording',
          note: `Stops on its own after ${duration}s — call stopRecording with this recordingId to end it earlier or confirm the file is finished`,
        }
      },
    },
    stopRecording: {
      description: 'Stop a screen recording started by recordScreen (or confirm a fixed-duration one finished) and return the path of the finalized video file.',
      schema: z.object({
        recordingId: z.string().optional().describe('The id returned by recordScreen. Omit to stop the most recently started recording'),
      }).describe('Stop a screen recording and finalize the video file.'),
      handler: async (args: { recordingId?: string }, capture: ScreenCapture) => {
        const path = await capture.stopRecording(args.recordingId)
        return { path, status: 'stopped' }
      },
    },
  }

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
   * With `duration`, the recording stops on its own — await `done`. The
   * default is 300 seconds (5 minutes), a safety cap so a recording nobody
   * remembered to stop can't run forever; pass `duration: 0` to opt out and
   * record until `stop()`. Either way the resolved value is the absolute
   * path to the finished movie.
   *
   * Video is whole-screen or rect only — per-window video isn't supported by
   * the system tool.
   *
   * Stopping early (`stop()`) presses the system stop-recording hotkey
   * (⌃⌘Esc) via System Events — since macOS 15 every signal kills
   * `screencapture` without saving the movie. That keystroke needs the
   * Accessibility permission for the host app, and only one recording can
   * run at a time (the hotkey is global). Letting the duration expire needs
   * no extra permission.
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
    const duration = options.duration ?? 300
    if (duration > 0) args.push(`-V${duration}`)
    if (options.audio) args.push('-g')
    if (options.showClicks) args.push('-k')
    if (options.display) args.push(`-D${options.display}`)
    if (options.rect) args.push(`-R${options.rect.x},${options.rect.y},${options.rect.width},${options.rect.height}`)
    args.push(output)

    const child = proc.spawn('screencapture', args)
    let stderr = ''
    child.stderr?.on('data', (buf: Buffer) => { stderr += buf.toString() })

    // Without the Screen Recording TCC permission (or any window-server
    // access — daemons, SSH sessions), screencapture -v exits immediately
    // instead of failing at stop time. Catch that here so the caller learns
    // the recording never started, not minutes later when they stop it.
    await this.container.utils.sleep(600)
    if (child.exitCode !== null) {
      throw new Error(
        `record failed to start: screencapture exited ${child.exitCode} right away. ${stderr.trim()} ${PERMISSION_HINT} ` +
        'The permission belongs to the HOST APP of this process (the terminal, app, or daemon that launched luca) — a process with no GUI session (launchd daemon, SSH) cannot record at all.'
      )
    }

    const done = new Promise<string>((resolve, reject) => {
      child.on('exit', async () => {
        // screencapture finalizes the movie just after exiting; give the file
        // a few seconds to land (longer recordings take longer to write)
        const fs = this.container.fs
        for (let i = 0; i < 50 && !fs.exists(output); i++) {
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

    const stillRunning = duration > 0
      ? `The recording is still running and will finalize on its own after its ${duration}s duration cap.`
      : 'The recording is still running (no duration cap) — it can only finalize via the hotkey or the menu-bar stop button.'

    const stop = async (): Promise<string> => {
      if (child.exitCode === null) {
        // Signals abort screencapture without writing the movie (see
        // STOP_HOTKEY_SCRIPT above) — press the system hotkey instead. Note
        // it is global: it ends whatever screen recording is active, so don't
        // run two at once. On failure we deliberately do NOT kill the child:
        // the -V duration cap will still salvage the footage.
        const result = await proc.spawnAndCapture('osascript', ['-e', STOP_HOTKEY_SCRIPT])
        if (result.exitCode !== 0) {
          throw new Error(
            `stop failed: could not press the stop-recording hotkey (osascript exited ${result.exitCode}: ${result.stderr?.trim()}). ` +
            'Sending keystrokes needs the Accessibility permission for the host app: System Settings → Privacy & Security → Accessibility. ' +
            stillRunning
          )
        }
        for (let i = 0; i < 50 && child.exitCode === null; i++) {
          await this.container.utils.sleep(100)
        }
        if (child.exitCode === null) {
          throw new Error(`stop failed: the stop-recording hotkey had no effect after 5s. ${stillRunning}`)
        }
      }
      return done
    }

    return { path: output, done, stop }
  }

  /** Recordings started through trackRecording, newest last, keyed by id. */
  private _recordings = new Map<string, CaptureRecording>()

  /**
   * Register a recording handle under a generated id so it can be stopped
   * later by reference — across tool calls, or from a different code path
   * than the one that started it. Used by the recordScreen agent tool;
   * available to any caller juggling multiple recordings.
   *
   * @param recording - The handle returned by record()
   * @returns The generated recording id
   *
   * @example
   * ```typescript
   * // (no-run) records the screen
   * const capture = container.feature('screenCapture')
   * const id = capture.trackRecording(await capture.record())
   * // ... later, possibly elsewhere ...
   * const movie = await capture.stopRecording(id)
   * ```
   */
  trackRecording(recording: CaptureRecording): string {
    const id = this.container.utils.uuid().slice(0, 8)
    this._recordings.set(id, recording)
    return id
  }

  /**
   * Stop a tracked recording and return the finished movie's path. Safe to
   * call on a fixed-duration recording that already stopped on its own — it
   * just resolves with the finalized path.
   *
   * @param id - The id from trackRecording. Omit for the most recently started recording
   * @returns Absolute path to the finalized movie
   *
   * @throws {Error} When the id is unknown, or no recording was ever started
   */
  async stopRecording(id?: string): Promise<string> {
    const key = id ?? [...this._recordings.keys()].pop()
    const recording = key ? this._recordings.get(key) : undefined

    if (!recording) {
      const active = [...this._recordings.keys()].join(', ') || 'none'
      throw new Error(`stopRecording: no recording ${id ? `with id '${id}'` : 'in progress'} (tracked: ${active})`)
    }

    const path = await recording.stop()
    this._recordings.delete(key!)
    return path
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
