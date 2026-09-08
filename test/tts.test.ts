import { afterEach, beforeEach, describe, expect, it, mock, spyOn, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
let c: NodeContainer
let root: string
let fetchMock: Mock<typeof fetch>
let oldKey: string | undefined
beforeEach(() => {
  oldKey = process.env.RUNPOD_API_KEY; delete process.env.RUNPOD_API_KEY
  const host = new NodeContainer()
  root = host.paths.join(host.os.tmpdir, `luca-tts-${host.utils.uuid()}`)
  host.fs.ensureFolder(root); c = new NodeContainer({ cwd: root })
  fetchMock = spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network request'))
})
afterEach(() => {
  fetchMock.mockRestore(); c.fs.rmSync(root, { recursive: true, force: true })
  if (oldKey === undefined) delete process.env.RUNPOD_API_KEY; else process.env.RUNPOD_API_KEY = oldKey
})
const tts = (options = {}) => c.feature('tts', { apiKey: 'test-key', outputDir: root, ...options })
const success = () => fetchMock.mockResolvedValueOnce(Response.json({ output: { audio_url: 'https://audio.example.test/output' } })).mockResolvedValueOnce(new Response(new Uint8Array([0, 1, 128, 255])))

describe('TTS synthesis', () => {
  it('rejects missing credentials before attempting a request', async () => {
    await expect(c.feature('tts').synthesize('hello')).rejects.toThrow('RunPod API key')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('uses environment credentials only when options do not override them', () => {
    process.env.RUNPOD_API_KEY = 'environment-test-key'
    expect(c.feature('tts').apiKey).toBe('environment-test-key')
    expect(tts().apiKey).toBe('test-key')
    expect(tts().voices).toContain('lucy')
    expect(new Set(tts().voices).size).toBe(tts().voices.length)
  })
  it('saves exact audio bytes and publishes synthesis state and metadata', async () => {
    success(); const feature = tts(); const synthesized = mock(() => {}); feature.on('synthesized', synthesized)
    const file = await feature.synthesize('Hello')
    expect(file.startsWith(root)).toBe(true); expect(file.endsWith('.wav')).toBe(true)
    expect(c.fs.readFile(file, null)).toEqual(Buffer.from([0, 1, 128, 255]))
    expect(feature.state.get('generating')).toBe(false)
    expect(feature.state.get('lastText')).toBe('Hello'); expect(feature.state.get('lastFile')).toBe(file)
    expect(synthesized).toHaveBeenCalledWith('Hello', file, 'lucy', expect.any(Number))
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: 'POST', headers: { Authorization: 'Bearer test-key' } })
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ input: { prompt: 'Hello', format: 'wav', voice: 'lucy' } })
  })
  it('per-request format and voice override feature defaults', async () => {
    success(); const file = await tts({ voice: 'aaron', format: 'flac' }).synthesize('hello', { voice: 'laura', format: 'ogg' })
    expect(file.endsWith('.ogg')).toBe(true)
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).input).toEqual({ prompt: 'hello', format: 'ogg', voice: 'laura' })
  })
  it('sends a voice reference URL instead of a preset voice', async () => {
    success(); await tts().synthesize('hello', { voiceUrl: 'https://example.test/reference.wav' })
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body)).input).toEqual({ prompt: 'hello', format: 'wav', voice_url: 'https://example.test/reference.wav' })
  })
  it.each([
    [() => new Response('rate limited', { status: 429 }), '429'],
    [() => Response.json({ error: 'model unavailable' }), 'model unavailable'],
    [() => Response.json({ output: {} }), 'No audio_url'],
  ] as const)('resets generating and emits API failure %#', async (response, message) => {
    fetchMock.mockResolvedValueOnce(response())
    const feature = tts(); const failed = mock(() => {}); feature.on('error', failed)
    await expect(feature.synthesize('hello')).rejects.toThrow(message)
    expect(feature.state.get('generating')).toBe(false)
    expect(feature.state.get('lastFile')).toBeUndefined()
    expect(failed).toHaveBeenCalledTimes(1)
  })
  it('rejects failed audio downloads and transport failures', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ output: { audio_url: 'https://audio.example.test' } })).mockResolvedValueOnce(new Response('', { status: 404 }))
    const feature = tts()
    await expect(feature.synthesize('hello')).rejects.toThrow('Failed to download audio: 404')
    await expect(feature.synthesize('again')).rejects.toThrow('Unexpected network request')
    expect(feature.state.get('generating')).toBe(false)
  })
})
