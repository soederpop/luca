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

  it('rejects captureWindow for a window that does not exist', async () => {
    if (process.platform !== 'darwin') return
    const capture = container.feature('screenCapture')
    await expect(
      capture.captureWindow('definitely-not-a-real-app-xyz-123')
    ).rejects.toThrow(/no visible window matches/)
  })
})
