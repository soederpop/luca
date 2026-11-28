import { describe, it, expect } from 'bun:test'
import { parseDevToolsActivePort, profileDirs, resolveBrowserWsUrl, findRealProfileBrowser, chromeExecutableCandidates } from '../src/agi/lib/cdp/discovery'
import { DomNode, NodeType, pyRound } from '../src/agi/lib/cdp/dom-tree'
import { buildAttributesString, isInteractive, DEFAULT_INCLUDE_ATTRIBUTES } from '../src/agi/lib/cdp/dom-serializer'

const el = (tag: string, attributes: Record<string, string> = {}) => {
  const n = new DomNode()
  n.nodeId = 1
  n.backendNodeId = 1
  n.nodeType = NodeType.ELEMENT
  n.nodeName = tag.toUpperCase()
  n.nodeValue = ''
  n.attributes = attributes
  return n
}

describe('browserUseV2 discovery', () => {
  it('parses DevToolsActivePort as port + ws path', () => {
    expect(parseDevToolsActivePort('9222\n/devtools/browser/abc\n')).toEqual({ port: '9222', wsPath: '/devtools/browser/abc' })
    expect(parseDevToolsActivePort('garbage')).toBeNull()
    expect(parseDevToolsActivePort(null)).toBeNull()
  })

  it('lists profile dirs per platform', () => {
    expect(profileDirs('darwin', {}, '/Users/x')[0]).toBe('/Users/x/Library/Application Support/Google/Chrome')
    expect(profileDirs('linux', {}, '/home/x')[0]).toBe('/home/x/.config/google-chrome')
    expect(profileDirs('win32', { LOCALAPPDATA: 'C:/L' }, 'C:/U')[0]).toBe('C:/L/Google/Chrome/User Data')
  })

  it('lists Chrome executables per platform', () => {
    expect(chromeExecutableCandidates('darwin', {}, '/Users/x')[0]).toBe('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
    expect(chromeExecutableCandidates('linux', {}, '/home/x')).toContain('chromium')
  })

  it('passes ws:// URLs through untouched', async () => {
    expect(await resolveBrowserWsUrl('ws://127.0.0.1:9222/devtools/browser/x')).toBe('ws://127.0.0.1:9222/devtools/browser/x')
  })

  it('tells you to turn on remote debugging when Local State says it is off', async () => {
    const files: Record<string, string> = { '/p/Local State': JSON.stringify({ devtools: { remote_debugging: { 'user-enabled': false } } }) }
    await expect(findRealProfileBrowser(['/p'], (f) => files[f] ?? null)).rejects.toThrow('chrome://inspect/#remote-debugging')
  })
})

describe('browserUseV2 serializer', () => {
  it('rounds like Python (half to even)', () => {
    expect(pyRound(0.25, 1)).toBe(0.2)
    expect(pyRound(0.35, 1)).toBe(0.4)
    expect(pyRound(1.26, 1)).toBe(1.3)
  })

  it('treats buttons as interactive and an empty div as not', () => {
    expect(isInteractive(el('button'))).toBe(true)
    expect(isInteractive(el('div'))).toBe(false)
  })

  it('skips labels that proxy another input via for=', () => {
    expect(isInteractive(el('label', { for: 'x' }))).toBe(false)
  })

  it('never shows password values', () => {
    const n = el('input', { type: 'password', value: 'hunter2' })
    n.axNode = { axNodeId: '1', ignored: false, role: 'textbox', name: null, description: null, properties: [{ name: 'value', value: 'hunter2' }], childIds: null }
    expect(buildAttributesString(n, DEFAULT_INCLUDE_ATTRIBUTES, '')).not.toContain('hunter2')
  })

  it('adds an ISO format hint to date inputs', () => {
    expect(buildAttributesString(el('input', { type: 'date' }), DEFAULT_INCLUDE_ATTRIBUTES, '')).toBe('type=date format=YYYY-MM-DD placeholder=YYYY-MM-DD')
  })
})
