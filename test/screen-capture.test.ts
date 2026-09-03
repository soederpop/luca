import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { ScreenCaptureOptionsSchema } from '../src/node/features/screen-capture'

const container = new NodeContainer()

// Everything that touches the display server (captures, recordings, the window
// list) needs a real macOS session with Screen Recording permission — CI has
// neither. These tests cover registration, options, and the pure logic.
describe('screenCapture feature', () => {
  it('is registered and creatable', () => {
    expect(container.features.available).toContain('screenCapture')
    const capture = container.feature('screenCapture')
    expect(typeof capture.captureScreen).toBe('function')
    expect(typeof capture.captureWindow).toBe('function')
    expect(typeof capture.captureRegion).toBe('function')
    expect(typeof capture.record).toBe('function')
    expect(typeof capture.listWindows).toBe('function')
  })

  it('accepts an outputDir option', () => {
    const parsed = ScreenCaptureOptionsSchema.parse({ outputDir: 'captures' })
    expect(parsed.outputDir).toBe('captures')
    expect(ScreenCaptureOptionsSchema.parse({}).outputDir).toBeUndefined()
  })

  it('throws a clear error on non-mac platforms', async () => {
    if (process.platform === 'darwin') return
    const capture = container.feature('screenCapture')
    await expect(capture.captureScreen()).rejects.toThrow(/only supported on macOS/)
  })

  it('lists visible windows on macOS', async () => {
    if (process.platform !== 'darwin') return
    const capture = container.feature('screenCapture')
    const windows = await capture.listWindows()
    expect(Array.isArray(windows)).toBe(true)
    for (const w of windows) {
      expect(typeof w.id).toBe('number')
      expect(typeof w.app).toBe('string')
      expect(typeof w.bounds.width).toBe('number')
    }
  })

  it('exposes agent tools whose capture handlers attach images', () => {
    const capture = container.feature('screenCapture')
    const { schemas, handlers } = capture.toTools()
    expect(Object.keys(schemas).sort()).toEqual(['captureScreen', 'captureWindow', 'listWindows', 'recordScreen', 'stopRecording'])
    expect(Object.keys(handlers).sort()).toEqual(Object.keys(schemas).sort())
  })

  it('tool handlers wrap plain methods with the { images } convention', async () => {
    const capture = container.feature('screenCapture')
    const fake = { captureScreen: async () => '/tmp/shot.png' }
    const handler = (capture.constructor as any).tools.captureScreen.handler
    const result = await handler({}, fake)
    // The instance method stays assistant-agnostic (plain path) — only the
    // tool layer adds the images array that triggers conversation injection.
    expect(result).toEqual({ path: '/tmp/shot.png', images: ['/tmp/shot.png'] })
  })

  it('recordScreen tool returns immediately; stopRecording finalizes by id', async () => {
    const capture = container.feature('screenCapture')
    let stopped = false
    const fakeRecording = {
      path: '/tmp/clip.mov',
      stop: async () => { stopped = true; return '/tmp/clip.mov' },
      done: new Promise<string>(() => {}), // never resolves — a blocking handler would hang here
    }
    const recordCalls: any[] = []
    const fake = { record: async (opts: any) => { recordCalls.push(opts); return fakeRecording }, trackRecording: capture.trackRecording.bind(capture), stopRecording: capture.stopRecording.bind(capture) }
    const tools = (capture.constructor as any).tools

    const started = await tools.recordScreen.handler({ }, fake)
    expect(started.status).toBe('recording')
    expect(typeof started.recordingId).toBe('string')
    expect(stopped).toBe(false)

    const result = await tools.stopRecording.handler({ recordingId: started.recordingId }, fake)
    expect(result).toEqual({ path: '/tmp/clip.mov', status: 'stopped' })
    expect(stopped).toBe(true)

    // The id is gone once stopped
    await expect(capture.stopRecording(started.recordingId)).rejects.toThrow(/no recording/)

    // The tool never starts an unlimited recording — omitted or 0 duration
    // becomes the 5-minute safety cap.
    expect(recordCalls[0].duration).toBe(300)
    const capped = await tools.recordScreen.handler({ duration: 0 }, fake)
    expect(recordCalls[1].duration).toBe(300)
    await tools.stopRecording.handler({ recordingId: capped.recordingId }, fake)
  })

  it('stopRecording without an id targets the most recent recording', async () => {
    const capture = container.feature('screenCapture')
    const make = (path: string) => ({ path, stop: async () => path, done: new Promise<string>(() => {}) })
    capture.trackRecording(make('/tmp/a.mov') as any)
    capture.trackRecording(make('/tmp/b.mov') as any)
    expect(await capture.stopRecording()).toBe('/tmp/b.mov')
    expect(await capture.stopRecording()).toBe('/tmp/a.mov')
    await expect(capture.stopRecording()).rejects.toThrow(/no recording in progress/)
  })

  it('rejects captureWindow for a window that does not exist', async () => {
    if (process.platform !== 'darwin') return
    const capture = container.feature('screenCapture')
    await expect(
      capture.captureWindow('definitely-not-a-real-app-xyz-123')
    ).rejects.toThrow(/no visible window matches/)
  })
})
