# ScreenCapture (features.screenCapture)

> Stability: `experimental`

The ScreenCapture feature takes screenshots and screen recordings on macOS. It wraps the system `/usr/sbin/screencapture` tool (no dependencies, nothing to install) and the window server's window list, so it can capture the full screen, a region, or a single application window by name — plus video recordings with optional audio. macOS only. Every method throws a clear error on other platforms. The first capture from a new host app needs the Screen Recording permission (System Settings → Privacy & Security). Without it, captures still "succeed" but come back black or wallpaper-only — window titles in listWindows() also arrive empty. Grant the permission once and restart the host app. Stopping a recording early additionally needs the Accessibility permission (stop() presses the system ⌃⌘Esc hotkey — signals would discard the footage).

## Usage

```ts
container.feature('screenCapture', {
  // Default directory for captures when no output path is given
  outputDir,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `outputDir` | `string` | Default directory for captures when no output path is given |

## Methods

### listWindows

Lists all visible windows known to the window server. Returns normal application windows only (layer 0 — menu bar items, docks, and overlays are filtered out), front-to-back. Use the `id` with captureWindow() for an exact capture, or just pass the app name. NOTE: `title` is empty for other apps' windows until the host app has the Screen Recording permission — `app`, `pid`, and `bounds` are always present.

**Returns:** `Promise<CaptureWindowInfo[]>`

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')
const windows = await capture.listWindows()
windows.forEach(w => console.log(`${w.id} ${w.app} — ${w.title}`))
```



### captureScreen

Captures the entire screen to an image file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `CaptureImageOptions` |  | Output path, format, display, cursor |

`CaptureImageOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `output` | `string` | Where to save the image. Relative paths resolve against container.cwd. Defaults to a temp file. |
| `format` | `'png' | 'jpg' | 'pdf' | 'tiff'` | Image format (default 'png') |
| `display` | `number` | 1-based display number for multi-monitor setups (screen captures only) |
| `cursor` | `boolean` | Include the mouse cursor in the capture (default false) |
| `shadow` | `boolean` | Include the window drop shadow in window captures (default true) |

**Returns:** `Promise<string>`

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')

const shot = await capture.captureScreen()
const second = await capture.captureScreen({ display: 2, format: 'jpg', output: 'screen2.jpg' })
```



### captureWindow

Captures a single application window to an image file. Pass a window id (from listWindows()) for an exact match, or a string to match by app name or window title (case-insensitive substring). With a string, the frontmost matching window wins. The window is captured even when it's behind other windows — no need to bring it forward.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `string | number` | ✓ | Window id, app name, or title substring (e.g. 'Safari', 81146) |
| `options` | `CaptureImageOptions` |  | Output path, format, shadow |

`CaptureImageOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `output` | `string` | Where to save the image. Relative paths resolve against container.cwd. Defaults to a temp file. |
| `format` | `'png' | 'jpg' | 'pdf' | 'tiff'` | Image format (default 'png') |
| `display` | `number` | 1-based display number for multi-monitor setups (screen captures only) |
| `cursor` | `boolean` | Include the mouse cursor in the capture (default false) |
| `shadow` | `boolean` | Include the window drop shadow in window captures (default true) |

**Returns:** `Promise<string>`

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')

const shot = await capture.captureWindow('Terminal')
const noShadow = await capture.captureWindow('Safari', { shadow: false, output: 'safari.png' })
```



### captureRegion

Captures a rectangular region of the screen to an image file. Coordinates are in screen points with the origin at the top-left of the main display.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `rect` | `CaptureRect` | ✓ | The region to capture |

`CaptureRect` properties:

| Property | Type | Description |
|----------|------|-------------|
| `x` | `number` |  |
| `y` | `number` |  |
| `width` | `number` |  |
| `height` | `number` |  |
| `options` | `CaptureImageOptions` |  | Output path, format, cursor |

`CaptureImageOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `output` | `string` | Where to save the image. Relative paths resolve against container.cwd. Defaults to a temp file. |
| `format` | `'png' | 'jpg' | 'pdf' | 'tiff'` | Image format (default 'png') |
| `display` | `number` | 1-based display number for multi-monitor setups (screen captures only) |
| `cursor` | `boolean` | Include the mouse cursor in the capture (default false) |
| `shadow` | `boolean` | Include the window drop shadow in window captures (default true) |

**Returns:** `Promise<string>`

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')
const shot = await capture.captureRegion({ x: 0, y: 0, width: 800, height: 600 })
```



### record

Records the screen to a QuickTime movie (.mov). With `duration`, the recording stops on its own — await `done`. The default is 300 seconds (5 minutes), a safety cap so a recording nobody remembered to stop can't run forever; pass `duration: 0` to opt out and record until `stop()`. Either way the resolved value is the absolute path to the finished movie. Video is whole-screen or rect only — per-window video isn't supported by the system tool. Stopping early (`stop()`) presses the system stop-recording hotkey (⌃⌘Esc) via System Events — since macOS 15 every signal kills `screencapture` without saving the movie. That keystroke needs the Accessibility permission for the host app, and only one recording can run at a time (the hotkey is global). Letting the duration expire needs no extra permission.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `CaptureRecordOptions` |  | Duration, audio, clicks, display, rect |

`CaptureRecordOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `output` | `string` | Where to save the movie (.mov). Relative paths resolve against container.cwd. Defaults to a temp file. |
| `duration` | `number` | Stop automatically after this many seconds. Defaults to 300 (5 minutes) so a forgotten recording can't run forever; pass 0 for a truly open-ended recording ended only by stop(). |
| `audio` | `boolean` | Record audio from the default input alongside the video (default false) |
| `showClicks` | `boolean` | Visualize mouse clicks in the recording (default false) |
| `display` | `number` | 1-based display number for multi-monitor setups |
| `rect` | `CaptureRect` | Restrict the recording to a screen rect instead of the full display |

**Returns:** `Promise<CaptureRecording>`

```ts
// (no-run) records the screen
const capture = container.feature('screenCapture')

// Fixed-length recording
const rec = await capture.record({ duration: 10, audio: true })
const movie = await rec.done

// Open-ended: stop it yourself
const live = await capture.record({ showClicks: true })
// ... do the thing being demonstrated ...
const path = await live.stop()
```



### trackRecording

Register a recording handle under a generated id so it can be stopped later by reference — across tool calls, or from a different code path than the one that started it. Used by the recordScreen agent tool; available to any caller juggling multiple recordings.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `recording` | `CaptureRecording` | ✓ | The handle returned by record() |

`CaptureRecording` properties:

| Property | Type | Description |
|----------|------|-------------|
| `path` | `string` | Absolute path the movie will be written to |
| `stop` | `() => Promise<string>` | Stop the recording early; resolves to the movie path once the file is finalized. Works by pressing the system stop-recording hotkey (⌃⌘Esc) — signals kill screencapture without saving — so the host app needs the Accessibility permission. On failure it throws and leaves the recording running, to be finalized by its duration cap. |
| `done` | `Promise<string>` | Resolves to the movie path when the recording ends (duration elapsed or stop() called) |

**Returns:** `string`

```ts
// (no-run) records the screen
const capture = container.feature('screenCapture')
const id = capture.trackRecording(await capture.record())
// ... later, possibly elsewhere ...
const movie = await capture.stopRecording(id)
```



### stopRecording

Stop a tracked recording and return the finished movie's path. Safe to call on a fixed-duration recording that already stopped on its own — it just resolves with the finalized path.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` |  | The id from trackRecording. Omit for the most recently started recording |

**Returns:** `Promise<string>`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.screenCapture**

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')

// Full screen to a temp file
const shot = await capture.captureScreen()

// A specific app's frontmost window
const win = await capture.captureWindow('Safari', { output: 'safari.png' })

// 10-second screen recording
const rec = await capture.record({ duration: 10 })
const movie = await rec.done
```



**listWindows**

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')
const windows = await capture.listWindows()
windows.forEach(w => console.log(`${w.id} ${w.app} — ${w.title}`))
```



**captureScreen**

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')

const shot = await capture.captureScreen()
const second = await capture.captureScreen({ display: 2, format: 'jpg', output: 'screen2.jpg' })
```



**captureWindow**

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')

const shot = await capture.captureWindow('Terminal')
const noShadow = await capture.captureWindow('Safari', { shadow: false, output: 'safari.png' })
```



**captureRegion**

```ts
// (no-run) interacts with the display server
const capture = container.feature('screenCapture')
const shot = await capture.captureRegion({ x: 0, y: 0, width: 800, height: 600 })
```



**record**

```ts
// (no-run) records the screen
const capture = container.feature('screenCapture')

// Fixed-length recording
const rec = await capture.record({ duration: 10, audio: true })
const movie = await rec.done

// Open-ended: stop it yourself
const live = await capture.record({ showClicks: true })
// ... do the thing being demonstrated ...
const path = await live.stop()
```



**trackRecording**

```ts
// (no-run) records the screen
const capture = container.feature('screenCapture')
const id = capture.trackRecording(await capture.record())
// ... later, possibly elsewhere ...
const movie = await capture.stopRecording(id)
```

