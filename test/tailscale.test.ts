import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { parseTailscalePing, tailscaleNodeFromStatus, type Tailscale } from '../src/node/features/tailscale'

const rawPeer = (id: string, name: string, ip: string, online: boolean) => ({
  ID: id, HostName: `${name} box`, DNSName: `${name}.tail.ts.net.`, OS: 'linux', Online: online,
  TailscaleIPs: [ip, 'fd7a::1'], ExitNode: false, ExitNodeOption: true, LastSeen: '2026-10-24T00:00:00Z',
})
const statusJson = (peers: any[]) => JSON.stringify({
  BackendState: 'Running',
  MagicDNSSuffix: 'tail.ts.net',
  Self: rawPeer('self', 'me', '100.64.0.1', true),
  Peer: Object.fromEntries(peers.map(peer => [peer.ID, peer])),
})
const ok = (stdout: string) => ({ stdout, stderr: '', exitCode: 0 })

let ts: Tailscale
let run: Mock<Tailscale['run']>
beforeEach(() => {
  ts = new NodeContainer().feature('tailscale', { binaryPath: '/nonexistent/luca-test-tailscale' })
  run = spyOn(ts, 'run').mockResolvedValue(ok(''))
})
afterEach(() => run.mockRestore())
const calls = () => run.mock.calls.map(call => call[0])

describe('Tailscale', () => {
  it('reports a missing binary and rejects unmocked execution', async () => {
    run.mockRestore()
    expect(await ts.ensureAvailable()).toBeNull()
    expect(ts.available).toBe(false)
    await expect(ts.run(['status'])).rejects.toThrow('tailscale is not installed')
  })

  it('maps status nodes, dropping the trailing dot and picking the v4 address', () => {
    const node = tailscaleNodeFromStatus(rawPeer('n1', 'chief', '100.64.0.2', true))
    expect(node).toMatchObject({ id: 'n1', dnsName: 'chief.tail.ts.net', shortName: 'chief', ipv4: '100.64.0.2', online: true, exitNodeOption: true, tags: [] })
  })

  it('refreshes into state and finds peers by short name, DNS name, hostname or IP', async () => {
    run.mockResolvedValueOnce(ok(statusJson([rawPeer('n1', 'chief', '100.64.0.2', true), rawPeer('n2', 'spark', '100.64.0.3', false)])))
    await ts.refresh()
    expect(ts.isRunning).toBe(true)
    expect(ts.self?.shortName).toBe('me')
    expect(ts.onlinePeers.map(peer => peer.shortName)).toEqual(['chief'])
    expect(ts.findPeer('CHIEF')?.id).toBe('n1')
    expect(ts.findPeer('chief.tail.ts.net.')?.id).toBe('n1')
    expect(ts.findPeer('spark box')?.id).toBe('n2')
    expect(ts.findPeer('100.64.0.3')?.id).toBe('n2')
    expect(ts.findPeer('nope')).toBeUndefined()
  })

  it('emits peer events on change, but not on the first refresh', async () => {
    const events: string[] = []
    ts.on('peer:online', peer => events.push(`online:${peer.shortName}`))
    ts.on('peer:offline', peer => events.push(`offline:${peer.shortName}`))
    run.mockResolvedValueOnce(ok(statusJson([rawPeer('n1', 'chief', '100.64.0.2', true), rawPeer('n2', 'spark', '100.64.0.3', false)])))
    await ts.refresh()
    expect(events).toEqual([])
    // chief leaves the tailnet, spark comes up, a new online peer joins
    run.mockResolvedValueOnce(ok(statusJson([rawPeer('n2', 'spark', '100.64.0.3', true), rawPeer('n3', 'vps', '100.64.0.4', true)])))
    await ts.refresh()
    expect(events.sort()).toEqual(['offline:chief', 'online:spark', 'online:vps'])
  })

  it('parses direct, relayed and failed pings', () => {
    expect(parseTailscalePing('pong from chief (100.64.0.2) via 192.168.4.30:41641 in 67ms')).toMatchObject({ ok: true, latencyMs: 67, via: '192.168.4.30:41641', direct: true })
    expect(parseTailscalePing('pong from chief (100.64.0.2) via DERP(nyc) in 120ms')).toMatchObject({ ok: true, latencyMs: 120, via: 'DERP(nyc)', direct: false })
    expect(parseTailscalePing('ping "chief" timed out')).toMatchObject({ ok: false })
  })

  it('serves and funnels in the background and builds the URL from the MagicDNS name', async () => {
    run.mockResolvedValueOnce(ok('')).mockResolvedValueOnce(ok(statusJson([])))
    expect(await ts.serve(3000)).toBe('https://me.tail.ts.net')
    expect(await ts.serve('http://localhost:8080', { https: 8443, path: '/api' })).toBe('https://me.tail.ts.net:8443/api')
    expect(await ts.funnel(3000, { https: 443 })).toBe('https://me.tail.ts.net')
    await ts.stopServe({ https: 8443, funnel: true })
    expect(calls()).toEqual([
      ['serve', '--bg', '--yes', '3000'],
      ['status', '--json'],
      ['serve', '--bg', '--yes', '--https', '8443', '--set-path', '/api', 'http://localhost:8080'],
      ['funnel', '--bg', '--yes', '--https', '443', '3000'],
      ['funnel', '--yes', '--https', '8443', 'off'],
    ])
  })

  it('kills serve at the enable prompt instead of hanging, and throws with the link', async () => {
    // pid 0 is never a real process group here, so process.kill throws and we fall back to child.kill
    const kill = { pid: 0x7fffffff, kill: () => { killed = true } }
    let killed = false
    run.mockImplementationOnce(async (_args, options) => {
      options?.onStart?.(kill)
      options?.onOutput?.('Serve is not enabled on your tailnet.\nTo enable, visit:\n\n         https://login.tailscale.com/f/serve?node=abc\n')
      return { stdout: '', stderr: '', exitCode: 143 }
    })
    await expect(ts.serve(3000)).rejects.toThrow('Serve is not enabled on your tailnet. Turn it on at https://login.tailscale.com/f/serve?node=abc')
    expect(killed).toBe(true)
  })

  it('throws with stderr when a command fails', async () => {
    run.mockResolvedValueOnce({ stdout: '', stderr: 'Funnel not available', exitCode: 1 })
    await expect(ts.funnel(3000)).rejects.toThrow('Funnel not available')
  })
})
