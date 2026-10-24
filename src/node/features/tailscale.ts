import { z } from 'zod'
import { FeatureEventsSchema, FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

export const TailscaleNodeSchema = z.object({
  id: z.string().describe('Stable node ID from the tailnet'),
  hostname: z.string().describe('The machine hostname as the node reports it'),
  dnsName: z.string().describe('MagicDNS name without the trailing dot, e.g. chief.tailnet.ts.net'),
  shortName: z.string().describe('First label of the MagicDNS name, e.g. chief'),
  ips: z.array(z.string()).describe('All tailscale IPs (v4 and v6)'),
  ipv4: z.string().optional().describe('The tailscale IPv4 address, if any'),
  os: z.string().optional().describe('Operating system the node reports'),
  online: z.boolean().describe('Whether the coordination server sees the node as online'),
  exitNode: z.boolean().describe('Whether this node is the exit node in use right now'),
  exitNodeOption: z.boolean().describe('Whether this node offers itself as an exit node'),
  lastSeen: z.string().optional().describe('ISO timestamp the node was last seen'),
  tags: z.array(z.string()).describe('ACL tags on the node'),
}).describe('A machine on the tailnet')
export type TailscaleNode = z.infer<typeof TailscaleNodeSchema>

export const TailscaleStateSchema = FeatureStateSchema.extend({
  available: z.boolean().describe('Whether a working tailscale binary was found'),
  binaryPath: z.string().optional().describe('Path to the tailscale binary in use'),
  backendState: z.string().optional().describe('Daemon state from the last refresh, e.g. Running, Stopped, NeedsLogin'),
  tailnet: z.string().optional().describe('MagicDNS suffix of the tailnet, e.g. tailnet.ts.net'),
  self: TailscaleNodeSchema.optional().describe('This machine, from the last refresh'),
  peers: z.array(TailscaleNodeSchema).describe('Other machines on the tailnet, from the last refresh'),
  lastRefreshedAt: z.number().optional().describe('Timestamp (ms) of the last successful refresh'),
  watching: z.boolean().describe('Whether watch() is polling status'),
})
export type TailscaleState = z.infer<typeof TailscaleStateSchema>

export const TailscaleOptionsSchema = FeatureOptionsSchema.extend({
  binaryPath: z.string().optional().describe('Explicit path to the tailscale binary. Auto-detected if omitted'),
})
export type TailscaleOptions = z.infer<typeof TailscaleOptionsSchema>

export const TailscaleEventsSchema = FeatureEventsSchema.extend({
  refreshed: z.tuple([z.array(TailscaleNodeSchema).describe('The peers after the refresh')]).describe('Emitted after every successful status refresh'),
  'peer:online': z.tuple([TailscaleNodeSchema.describe('The peer that came online')]).describe('Emitted when a known or new peer goes online between refreshes'),
  'peer:offline': z.tuple([TailscaleNodeSchema.describe('The peer that went offline')]).describe('Emitted when a peer goes offline or leaves the tailnet between refreshes'),
}).describe('Tailscale events')

export interface TailscaleRunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface TailscalePingResult {
  /** Whether a pong came back before the timeout. */
  ok: boolean
  /** Round trip time in ms, when ok. */
  latencyMs?: number
  /** Path the pong took: an ip:port for a direct link, or DERP(region) for a relay. */
  via?: string
  /** True when the path is a direct link, false when relayed through DERP. */
  direct?: boolean
  /** Raw CLI output, for anything the parse missed. */
  output: string
}

export interface TailscaleServeOptions {
  /** HTTPS port to expose on the tailnet side. Defaults to 443. Funnel only allows 443, 8443 and 10000. */
  https?: number
  /** Expose plain HTTP on this port instead of HTTPS. Ignored by funnel. */
  http?: number
  /** Mount the target under this path, e.g. /api. */
  path?: string
}

// The mac App Store app doesn't put `tailscale` on PATH, so its bundled binary is the last resort.
const CANDIDATE_BINARIES = [
  'tailscale',
  '/usr/local/bin/tailscale',
  '/opt/homebrew/bin/tailscale',
  '/usr/bin/tailscale',
  '/Applications/Tailscale.app/Contents/MacOS/Tailscale',
]

const PONG_RE = /pong from \S+ \(([^)]+)\) via (.+?) in ([\d.]+)ms/

// ─── Tailscale ──────────────────────────────────────────────────────────────

/**
 * Wraps the `tailscale` CLI so the tailnet becomes typed, observable container state.
 *
 * Call `refresh()` (or `watch()`) to load peers into state, then look machines up by
 * name with `findPeer()`. `serve()` and `funnel()` put a local server on an HTTPS URL,
 * private to the tailnet or public. The CLI's JSON is not a stable API, so the parse
 * reads only a few well-known fields and ignores the rest.
 *
 * @example
 * ```ts
 * const ts = container.feature('tailscale')
 * await ts.refresh()
 * const chief = ts.findPeer('chief')
 * console.log(chief?.ipv4, chief?.online)
 *
 * const url = await ts.serve(3000)   // https://this-machine.tailnet.ts.net
 * ```
 */
export class Tailscale extends Feature<TailscaleState, TailscaleOptions> {
  static override shortcut = 'features.tailscale' as const
  static override stability = 'experimental' as const
  static override category = 'networking' as const
  static override stateSchema = TailscaleStateSchema
  static override optionsSchema = TailscaleOptionsSchema
  static override eventsSchema = TailscaleEventsSchema
  static { Feature.register(this, 'tailscale') }

  private _stopWatch?: () => void
  private _resolving?: Promise<string | null>

  override get initialState(): TailscaleState {
    return {
      ...super.initialState,
      available: false,
      peers: [],
      watching: false,
    }
  }

  /** Whether a working tailscale binary was found. Only meaningful after `ensureAvailable()` or any CLI call. */
  get available(): boolean {
    return this.state.get('available') ?? false
  }

  /** This machine, from the last refresh. */
  get self(): TailscaleNode | undefined {
    return this.state.get('self')
  }

  /** All other machines on the tailnet, from the last refresh. */
  get peers(): TailscaleNode[] {
    return this.state.get('peers') ?? []
  }

  /** Peers the coordination server sees as online, from the last refresh. */
  get onlinePeers(): TailscaleNode[] {
    return this.peers.filter(peer => peer.online)
  }

  /** Whether the daemon reported Running on the last refresh. */
  get isRunning(): boolean {
    return this.state.get('backendState') === 'Running'
  }

  /**
   * Find a working tailscale binary and record it in state. Never throws.
   *
   * @returns The binary path, or null when tailscale is not installed
   *
   * @example
   * ```ts
   * if (!await ts.ensureAvailable()) console.log('install tailscale first')
   * ```
   */
  async ensureAvailable(): Promise<string | null> {
    const known = this.state.get('binaryPath')
    if (known) return known
    this._resolving ??= this._resolveBinary()
    return this._resolving
  }

  private async _resolveBinary(): Promise<string | null> {
    const candidates = this.options.binaryPath ? [this.options.binaryPath] : CANDIDATE_BINARIES
    const proc = this.container.feature('proc')
    for (const bin of candidates) {
      try {
        const result = await proc.spawnAndCapture(bin, ['version'])
        if (result.exitCode === 0 && result.stdout) {
          this.setState({ available: true, binaryPath: bin })
          return bin
        }
      } catch {
        // not at this path, try the next one
      }
    }
    this.setState({ available: false, binaryPath: undefined })
    return null
  }

  /**
   * Run any tailscale subcommand. The low-level escape hatch for anything the API doesn't cover.
   * Does not throw on a non-zero exit; check `exitCode`.
   *
   * @param args - Arguments after `tailscale`, e.g. `['netcheck']`
   *
   * @example
   * ```ts
   * const { stdout } = await ts.run(['netcheck'])
   * ```
   */
  async run(args: string[]): Promise<TailscaleRunResult> {
    const bin = await this.ensureAvailable()
    if (!bin) throw new Error('tailscale is not installed or not found. Install it from https://tailscale.com/download')
    const result = await this.container.feature('proc').spawnAndCapture(bin, args)
    return { stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode }
  }

  /** Run a subcommand and throw with its stderr when it fails. */
  private async _runOrThrow(args: string[]): Promise<string> {
    const result = await this.run(args)
    if (result.exitCode !== 0) {
      throw new Error(`tailscale ${args.join(' ')} failed (exit ${result.exitCode}): ${(result.stderr || result.stdout).trim()}`)
    }
    return result.stdout
  }

  /**
   * The raw parsed output of `tailscale status --json`. Prefer `refresh()` unless you need a field it drops.
   *
   * @example
   * ```ts
   * const raw = await ts.status()
   * console.log(raw.Health)
   * ```
   */
  async status(): Promise<any> {
    return JSON.parse(await this._runOrThrow(['status', '--json']))
  }

  /**
   * Load status into state, and emit `peer:online` / `peer:offline` for peers whose
   * state changed since the last refresh. The first refresh emits no peer events.
   *
   * @example
   * ```ts
   * const { self, peers } = await ts.refresh()
   * ```
   */
  async refresh(): Promise<{ self?: TailscaleNode; peers: TailscaleNode[] }> {
    const raw = await this.status()
    const self = raw?.Self ? tailscaleNodeFromStatus(raw.Self) : undefined
    const peers = Object.values((raw?.Peer ?? {}) as Record<string, any>).map(tailscaleNodeFromStatus)

    const firstRefresh = this.state.get('lastRefreshedAt') === undefined
    const before = new Map(this.peers.map(peer => [peer.id, peer]))

    this.setState({
      backendState: raw?.BackendState,
      tailnet: raw?.MagicDNSSuffix || undefined,
      self,
      peers,
      lastRefreshedAt: Date.now(),
    })

    if (!firstRefresh) {
      const after = new Set<string>()
      for (const peer of peers) {
        after.add(peer.id)
        const prev = before.get(peer.id)
        if (peer.online && !prev?.online) this.emit('peer:online', peer)
        if (!peer.online && prev?.online) this.emit('peer:offline', peer)
      }
      for (const [id, prev] of before) {
        if (!after.has(id) && prev.online) this.emit('peer:offline', { ...prev, online: false })
      }
    }
    this.emit('refreshed', peers)
    return { self, peers }
  }

  /**
   * Find a peer from the last refresh by hostname, MagicDNS name (short or full), or tailscale IP.
   * Matching is case-insensitive. Call `refresh()` first.
   *
   * @param query - e.g. `chief`, `chief.tailnet.ts.net`, or `100.64.0.2`
   *
   * @example
   * ```ts
   * await ts.refresh()
   * const box = ts.findPeer('chief')
   * ```
   */
  findPeer(query: string): TailscaleNode | undefined {
    const q = query.trim().toLowerCase().replace(/\.$/, '')
    return this.peers.find(peer =>
      peer.shortName.toLowerCase() === q ||
      peer.dnsName.toLowerCase() === q ||
      peer.hostname.toLowerCase() === q ||
      peer.ips.includes(q)
    )
  }

  /**
   * This machine's tailscale IPv4 address.
   *
   * @example
   * ```ts
   * const myIp = await ts.ip()
   * ```
   */
  async ip(): Promise<string | undefined> {
    const out = await this._runOrThrow(['ip', '-4'])
    return out.trim().split('\n')[0] || undefined
  }

  /**
   * Ping a peer through tailscale once and report latency and whether the path is direct.
   * Never throws for an unreachable peer; returns `ok: false`.
   *
   * @param target - Peer name or tailscale IP
   * @param options.timeout - Seconds to wait for a pong (default 5)
   *
   * @example
   * ```ts
   * const { ok, latencyMs, direct } = await ts.ping('chief')
   * ```
   */
  async ping(target: string, options: { timeout?: number } = {}): Promise<TailscalePingResult> {
    const result = await this.run(['ping', '--c', '1', '--timeout', `${options.timeout ?? 5}s`, target])
    return parseTailscalePing(`${result.stdout}\n${result.stderr}`.trim())
  }

  /**
   * Who owns a tailscale IP: the machine and the user. Useful to check who is calling an endpoint.
   *
   * @param ip - A tailscale IP, optionally with :port
   *
   * @example
   * ```ts
   * const who = await ts.whois('100.64.0.2')
   * console.log(who.UserProfile?.LoginName)
   * ```
   */
  async whois(ip: string): Promise<any> {
    return JSON.parse(await this._runOrThrow(['whois', '--json', ip]))
  }

  /**
   * Expose a local server on this machine's MagicDNS name over HTTPS, private to the tailnet.
   * Runs in the background and persists until `stopServe()` or `resetServe()`.
   * HTTPS certificates must be enabled for the tailnet in the admin console.
   *
   * @param target - A port (3000), host:port, or full URL of the local service
   * @returns The URL peers can use to reach it
   *
   * @example
   * ```ts
   * const url = await ts.serve(3000)
   * const api = await ts.serve('http://localhost:8080', { path: '/api' })
   * ```
   */
  async serve(target: number | string, options: TailscaleServeOptions = {}): Promise<string> {
    await this._runOrThrow(['serve', '--bg', '--yes', ...portFlags(options), String(target)])
    return this._serveUrl(options)
  }

  /**
   * Expose a local server on the public internet through Tailscale Funnel.
   * Anyone with the URL can reach it. Funnel must be allowed for this node in the tailnet ACLs.
   *
   * @param target - A port (3000), host:port, or full URL of the local service
   * @returns The public URL
   *
   * @example
   * ```ts
   * const publicUrl = await ts.funnel(3000)
   * ```
   */
  async funnel(target: number | string, options: Omit<TailscaleServeOptions, 'http'> = {}): Promise<string> {
    await this._runOrThrow(['funnel', '--bg', '--yes', ...portFlags(options), String(target)])
    return this._serveUrl(options)
  }

  /**
   * Turn off one serve or funnel mapping, by the same port and path it was started with.
   *
   * @example
   * ```ts
   * await ts.stopServe({ https: 8443 })
   * ```
   */
  async stopServe(options: TailscaleServeOptions & { funnel?: boolean } = {}): Promise<void> {
    await this._runOrThrow([options.funnel ? 'funnel' : 'serve', '--yes', ...portFlags(options), 'off'])
  }

  /**
   * Remove every serve and funnel mapping on this machine.
   *
   * @example
   * ```ts
   * await ts.resetServe()
   * ```
   */
  async resetServe(): Promise<void> {
    await this._runOrThrow(['serve', 'reset'])
  }

  /**
   * The current serve and funnel config as parsed JSON. An empty object means nothing is served.
   *
   * @example
   * ```ts
   * const config = await ts.serveStatus()
   * ```
   */
  async serveStatus(): Promise<any> {
    const out = (await this._runOrThrow(['serve', 'status', '--json'])).trim()
    return out ? JSON.parse(out) : {}
  }

  /**
   * Send a file to a peer with Taildrop.
   *
   * @param filePath - Local file to send
   * @param target - Peer name or tailscale IP
   *
   * @example
   * ```ts
   * await ts.sendFile('./build.zip', 'chief')
   * ```
   */
  async sendFile(filePath: string, target: string): Promise<void> {
    await this._runOrThrow(['file', 'cp', this.container.paths.resolve(filePath), `${target}:`])
  }

  /**
   * Poll status and emit `peer:online` / `peer:offline` as machines come and go.
   * Runs never overlap. A failed refresh is skipped, not fatal.
   *
   * @param options.interval - Milliseconds between refreshes (default 30000)
   * @returns A function that stops watching
   *
   * @example
   * ```ts
   * ts.on('peer:online', peer => console.log(`${peer.shortName} is up`))
   * ts.watch({ interval: 10_000 })
   * ```
   */
  watch(options: { interval?: number } = {}): () => void {
    this.unwatch()
    this._stopWatch = this.container.utils.every(options.interval ?? 30_000, async () => {
      try { await this.refresh() } catch { /* daemon down or CLI gone, try again next tick */ }
    })
    this.setState({ watching: true })
    return () => this.unwatch()
  }

  /** Stop the polling started by `watch()`. */
  unwatch(): void {
    this._stopWatch?.()
    this._stopWatch = undefined
    this.setState({ watching: false })
  }

  private async _serveUrl(options: TailscaleServeOptions): Promise<string> {
    if (!this.self) await this.refresh()
    const host = this.self?.dnsName
    if (!host) throw new Error('tailscale has no MagicDNS name for this machine; is MagicDNS enabled?')
    const scheme = options.http ? 'http' : 'https'
    const port = options.http ?? options.https ?? 443
    const defaultPort = scheme === 'https' ? 443 : 80
    return `${scheme}://${host}${port === defaultPort ? '' : `:${port}`}${options.path ?? ''}`
  }
}

// ─── Parsing ────────────────────────────────────────────────────────────────

/** Map one node from `tailscale status --json` to a TailscaleNode. Reads only well-known fields. */
export function tailscaleNodeFromStatus(raw: any): TailscaleNode {
  const ips: string[] = Array.isArray(raw?.TailscaleIPs) ? raw.TailscaleIPs : []
  const dnsName = String(raw?.DNSName ?? '').replace(/\.$/, '')
  return {
    id: String(raw?.ID ?? raw?.PublicKey ?? dnsName),
    hostname: String(raw?.HostName ?? ''),
    dnsName,
    shortName: dnsName.split('.')[0] ?? '',
    ips,
    ipv4: ips.find(ip => ip.includes('.')),
    os: raw?.OS || undefined,
    online: !!raw?.Online,
    exitNode: !!raw?.ExitNode,
    exitNodeOption: !!raw?.ExitNodeOption,
    lastSeen: raw?.LastSeen || undefined,
    tags: Array.isArray(raw?.Tags) ? raw.Tags : [],
  }
}

/** Parse `tailscale ping` output. */
export function parseTailscalePing(output: string): TailscalePingResult {
  const match = output.match(PONG_RE)
  if (!match) return { ok: false, output }
  const via = match[2]!.trim()
  return { ok: true, latencyMs: Number(match[3]), via, direct: !via.startsWith('DERP'), output }
}

function portFlags(options: TailscaleServeOptions): string[] {
  const flags: string[] = []
  if (options.http) flags.push('--http', String(options.http))
  else if (options.https) flags.push('--https', String(options.https))
  if (options.path) flags.push('--set-path', options.path)
  return flags
}

export default Tailscale
