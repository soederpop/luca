import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'

let container: NodeContainer
let lookup: Mock<NodeContainer['proc']['execSync']>
let spawn: Mock<NodeContainer['proc']['spawnAndCapture']>
let log: Mock<typeof console.log>
beforeEach(() => {
  container = new NodeContainer()
  lookup = spyOn(container.proc, 'execSync').mockImplementation((command) => `/bin/${String(command).replace('which ', '')}\n`)
  spawn = spyOn(container.proc, 'spawnAndCapture').mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, error: null, pid: null })
  log = spyOn(console, 'log').mockImplementation(() => {})
})
afterEach(() => { lookup.mockRestore(); spawn.mockRestore(); log.mockRestore() })
function platform(value: string) { Object.defineProperty(container.os, 'platform', { value, configurable: true }) }

describe('Opener process dispatch', () => {
  it.each([
    ['darwin', 'open', ['-a', 'Google Chrome']],
    ['win32', 'cmd', ['/c', 'start', 'chrome']],
    ['linux', 'google-chrome', []],
  ] as const)('opens URLs on %s as a single argument', async (os, binary, prefix) => {
    platform(os)
    const url = 'https://example.test/?q=hello world&next=$HOME'
    await container.feature('opener').open(url)
    expect(spawn).toHaveBeenCalledWith(`/bin/${binary}`, [...prefix, url])
  })

  it.each([
    ['darwin', 'open', []], ['win32', 'cmd', ['/c', 'start', '']], ['linux', 'xdg-open', []],
  ] as const)('opens file paths on %s without splitting spaces or shell characters', async (os, binary, prefix) => {
    platform(os)
    const path = '/tmp/a folder/file; literal.txt'
    await container.feature('opener').open(path)
    expect(spawn).toHaveBeenCalledWith(`/bin/${binary}`, [...prefix, path])
  })

  it.each([
    ['darwin', 'open', ['-a', 'Calculator']], ['win32', 'cmd', ['/c', 'start', '', 'Calculator']], ['linux', 'calculator', []],
  ] as const)('launches applications on %s', async (os, binary, args) => {
    platform(os)
    await container.feature('opener').app('Calculator')
    expect(spawn).toHaveBeenCalledWith(`/bin/${binary}`, [...args])
  })

  it('uses chromium when Chrome cannot launch', async () => {
    platform('linux')
    spawn.mockRejectedValueOnce(new Error('Chrome missing'))
    await container.feature('opener').open('https://example.test')
    expect(spawn.mock.calls.map(call => call[0])).toEqual(['/bin/google-chrome', '/bin/chromium'])
  })

  it('falls back to the default browser when both Chrome variants cannot launch', async () => {
    platform('linux')
    spawn.mockRejectedValueOnce(new Error('Chrome missing')).mockRejectedValueOnce(new Error('Chromium missing'))
    await container.feature('opener').open('https://example.test')
    expect(spawn.mock.calls.map(call => call[0])).toEqual(['/bin/google-chrome', '/bin/chromium', '/bin/xdg-open'])
  })

  it.each(['code', 'cursor'] as const)('%s defaults to current directory and preserves custom paths', async (editor) => {
    const opener = container.feature('opener')
    await opener[editor]()
    await opener[editor]('/tmp/my project')
    expect(spawn.mock.calls.map(call => call[1])).toEqual([['.'], ['/tmp/my project']])
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it.each([['code', 'Visual Studio Code'], ['cursor', 'Cursor']] as const)('%s uses the macOS application fallback', async (editor, app) => {
    platform('darwin')
    spawn.mockRejectedValueOnce(new Error('missing editor CLI'))
    await container.feature('opener')[editor]('/tmp/project')
    expect(spawn).toHaveBeenLastCalledWith('/bin/open', ['-a', app, '/tmp/project'])
  })

  it.each(['code', 'cursor'] as const)('%s reports setup instructions when unavailable off macOS', async (editor) => {
    platform('linux')
    spawn.mockRejectedValueOnce(new Error('missing editor CLI'))
    await expect(container.feature('opener')[editor]()).rejects.toThrow('Command Palette')
  })

  it('uses and caches a bare executable name when which fails', async () => {
    platform('linux')
    lookup.mockImplementation(() => { throw new Error('not found') })
    const opener = container.feature('opener')
    await opener.open('file.txt')
    await opener.open('other.txt')
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenLastCalledWith('xdg-open', ['other.txt'])
  })

  it('propagates failures from the final launcher', async () => {
    platform('darwin')
    spawn.mockRejectedValueOnce(new Error('permission denied'))
    await expect(container.feature('opener').open('file.txt')).rejects.toThrow('permission denied')
  })
})
