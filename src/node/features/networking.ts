import { z } from 'zod'
import net from 'net'
import detectPort from 'detect-port'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

const MAX_CIDR_HOSTS = 65536

const PORT_SERVICE_MAP: Record<number, string> = {
  20: 'ftp-data',
  21: 'ftp',
  22: 'ssh',
  23: 'telnet',
  25: 'smtp',
  53: 'dns',
  67: 'dhcp',
  68: 'dhcp',
  69: 'tftp',
  80: 'http',
  110: 'pop3',
  111: 'rpcbind',
  119: 'nntp',
  123: 'ntp',
  135: 'msrpc',
  137: 'netbios-ns',
  138: 'netbios-dgm',
  139: 'netbios-ssn',
  143: 'imap',
  161: 'snmp',
  389: 'ldap',
  443: 'https',
  445: 'microsoft-ds',
  465: 'smtps',
  514: 'syslog',
  515: 'printer',
  543: 'kerberos',
  587: 'submission',
  631: 'ipp',
  636: 'ldaps',
  873: 'rsync',
  993: 'imaps',
  995: 'pop3s',
  1080: 'socks',
  1194: 'openvpn',
  1433: 'ms-sql',
  1521: 'oracle',
  1723: 'pptp',
  1883: 'mqtt',
  2049: 'nfs',
  2375: 'docker',
  2376: 'docker-tls',
  3000: 'http-alt',
  3306: 'mysql',
  3389: 'rdp',
  4000: 'http-alt',
  5000: 'http-alt',
  5432: 'postgresql',
  5672: 'amqp',
  5900: 'vnc',
  5985: 'winrm',
  5986: 'winrm-https',
  6379: 'redis',
  7001: 'http-alt',
  8080: 'http-proxy',
  8081: 'http-alt',
  8443: 'https-alt',
  9000: 'http-alt',
  9092: 'kafka',
  9200: 'elasticsearch',
  11211: 'memcached',
  27017: 'mongodb',
}

const DEFAULT_PORTS = [22, 80, 443, 3000, 3306, 5432, 6379, 8080, 8443]

export const LocalNetworkSchema = z.object({
  interface: z.string().describe('Network interface name'),
  address: z.string().describe('IPv4 address for this interface'),
  netmask: z.string().describe('IPv4 netmask'),
  cidr: z.string().describe('Derived CIDR range for this interface'),
  mac: z.string().optional().describe('MAC address for this interface'),
})
export type LocalNetwork = z.infer<typeof LocalNetworkSchema>

export const ArpEntrySchema = z.object({
  ip: z.string().describe('IP address from ARP table'),
  mac: z.string().optional().describe('MAC address from ARP table'),
  interface: z.string().optional().describe('Interface name if available'),
})
export type ArpEntry = z.infer<typeof ArpEntrySchema>

export const DiscoverHostSchema = z.object({
  ip: z.string().describe('Host IP address'),
  mac: z.string().optional().describe('MAC address when available'),
  reachable: z.boolean().describe('Whether host appears reachable'),
  method: z.enum(['arp', 'tcp']).describe('Discovery method used for this host'),
})
export type DiscoverHost = z.infer<typeof DiscoverHostSchema>

export const PortScanResultSchema = z.object({
  port: z.number().int().min(1).max(65535).describe('Port number'),
  status: z.enum(['open', 'closed', 'filtered']).describe('TCP connect scan status'),
  service: z.string().optional().describe('Best-effort service guess by port'),
  banner: z.string().optional().describe('Banner text when captured'),
})
export type PortScanResult = z.infer<typeof PortScanResultSchema>

export const LocalNetworkScanHostSchema = z.object({
  ip: z.string().describe('Host IP address'),
  mac: z.string().optional().describe('MAC address when available'),
  hostname: z.string().optional().describe('Hostname when available'),
  openPorts: z.array(PortScanResultSchema).describe('Open ports discovered for this host'),
})
export type LocalNetworkScanHost = z.infer<typeof LocalNetworkScanHostSchema>

export const NetworkSnapshotSchema = z.object({
  cidr: z.string().describe('Scanned CIDR range'),
  hosts: z.array(LocalNetworkScanHostSchema).describe('Hosts discovered in this CIDR'),
})
export type NetworkSnapshot = z.infer<typeof NetworkSnapshotSchema>

export const NetworkingStateSchema = FeatureStateSchema.extend({
  lastScan: z.object({
    timestamp: z.number().describe('Unix epoch timestamp in ms'),
    target: z.string().describe('Primary scan target identifier'),
    type: z.string().describe('Scan type identifier'),
    networks: z.array(NetworkSnapshotSchema).describe('Last known scan results'),
  }).optional().describe('The most recent network scan result'),
})
export type NetworkingState = z.infer<typeof NetworkingStateSchema>

export const NetworkingOptionsSchema = FeatureOptionsSchema.extend({
  timeout: z.number().optional().describe('Default timeout in milliseconds for probing'),
  concurrency: z.number().optional().describe('Default concurrency for scanning operations'),
})
export type NetworkingOptions = z.infer<typeof NetworkingOptionsSchema>

type ScanPortsOptions = {
  ports?: string | number[]
  timeout?: number
  concurrency?: number
  banner?: boolean
  includeClosed?: boolean
}

type DiscoverHostsOptions = {
  timeout?: number
  concurrency?: number
  ports?: number[]
}

type ReachableHostOptions = {
  timeout?: number
  ports?: number[]
}

type ScanLocalNetworksOptions = {
  ports?: string | number[]
  timeout?: number
  concurrency?: number
  hostConcurrency?: number
  banner?: boolean
}

type NmapPort = {
  port: number
  state: string
  protocol: string
  service?: string
}

type NmapHost = {
  ip: string
  hostname?: string
  status?: string
  mac?: string
  ports: NmapPort[]
}

/**
 * The Networking feature provides utilities for network-related operations.
 * 
 * This feature includes utilities for port detection and availability checking,
 * which are commonly needed when setting up servers or network services.
 * 
 * @example
 * ```typescript
 * const networking = container.feature('networking')
 * 
 * // Find an available port starting from 3000
 * const port = await networking.findOpenPort(3000)
 * console.log(`Available port: ${port}`)
 * 
 * // Check if a specific port is available
 * const isAvailable = await networking.isPortOpen(8080)
 * if (isAvailable) {
 *   console.log('Port 8080 is available')
 * }
 * ```
 * 
 * @extends Feature
 */
export class Networking extends Feature<NetworkingState, NetworkingOptions> {
  static override shortcut = 'features.networking' as const
  static override stateSchema = NetworkingStateSchema
  static override optionsSchema = NetworkingOptionsSchema
  static { Feature.register(this, 'networking') }

  override get initialState(): NetworkingState {
    return {
      ...super.initialState,
      enabled: false,
      lastScan: undefined,
    }
  }

  get proc() {
    return this.container.feature('proc')
  }

  get os() {
    return this.container.feature('os')
  }
  
  /**
   * Finds the next available port starting from the specified port number.
   * 
   * This method will search for the first available port starting from the given
   * port number. If the specified port is available, it returns that port.
   * Otherwise, it returns the next available port.
   * 
   * @param {number} [startAt=0] - The port number to start searching from (0 means system will choose)
   * @returns {Promise<number>} Promise that resolves to an available port number
   * 
   * @example
   * ```typescript
   * // Find any available port
   * const anyPort = await networking.findOpenPort()
   * 
   * // Find an available port starting from 3000
   * const port = await networking.findOpenPort(3000)
   * console.log(`Server can use port: ${port}`)
   * ```
   */
  async findOpenPort(startAt = 0) {
    const nextPort = await detectPort(Number(startAt))
    return nextPort
  }
  
  /**
   * Checks if a specific port is available for use.
   * 
   * This method attempts to detect if the specified port is available.
   * It returns true if the port is available, false if it's already in use.
   * 
   * @param {number} [checkPort=0] - The port number to check for availability
   * @returns {Promise<boolean>} Promise that resolves to true if the port is available, false otherwise
   * 
   * @example
   * ```typescript
   * // Check if port 8080 is available
   * const isAvailable = await networking.isPortOpen(8080)
   * if (isAvailable) {
   *   console.log('Port 8080 is free to use')
   * } else {
   *   console.log('Port 8080 is already in use')
   * }
   * ```
   */
  async isPortOpen(checkPort = 0) {
    const nextPort = await detectPort(Number(checkPort))
    return nextPort && nextPort === Number(checkPort)    
  }

  /**
   * Returns local external IPv4 interfaces and their CIDR ranges.
   */
  getLocalNetworks(): LocalNetwork[] {
    const interfaces = this.os.networkInterfaces as Record<string, Array<{
      address: string
      netmask: string
      family: string | number
      mac?: string
      internal: boolean
    }> | undefined>
    const networks: LocalNetwork[] = []

    for (const [interfaceName, details] of Object.entries(interfaces)) {
      if (!details || details.length === 0) {
        continue
      }

      for (const detail of details) {
        if (!detail) {
          continue
        }

        const family = typeof detail.family === 'string' ? detail.family : detail.family === 4 ? 'IPv4' : 'IPv6'
        if (detail.internal || family !== 'IPv4') {
          continue
        }

        const cidr = this.computeCidr(detail.address, detail.netmask)
        networks.push({
          interface: interfaceName,
          address: detail.address,
          netmask: detail.netmask,
          cidr,
          mac: detail.mac,
        })
      }
    }

    return networks
  }

  /**
   * Expands a CIDR block to host IP addresses.
   * For /31 and /32, all addresses are returned. For all others, network/broadcast are excluded.
   */
  expandCidr(cidr: string): string[] {
    const [ipPart, maskPart] = cidr.split('/')
    if (!ipPart || !maskPart) {
      throw new Error(`Invalid CIDR: ${cidr}`)
    }

    const maskBits = Number(maskPart)
    if (!Number.isInteger(maskBits) || maskBits < 0 || maskBits > 32) {
      throw new Error(`Invalid CIDR mask: ${cidr}`)
    }

    const baseIpInt = this.ipToInt(ipPart)
    const networkMask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0
    const network = baseIpInt & networkMask
    const broadcast = (network | (~networkMask >>> 0)) >>> 0
    const totalAddresses = broadcast - network + 1

    if (totalAddresses > MAX_CIDR_HOSTS) {
      throw new Error(`CIDR ${cidr} is too large to expand safely (${totalAddresses} addresses)`)
    }

    const includeAll = maskBits >= 31
    const start = includeAll ? network : network + 1
    const end = includeAll ? broadcast : broadcast - 1
    const hosts: string[] = []

    if (end < start) {
      return []
    }

    for (let current = start; current <= end; current += 1) {
      hosts.push(this.intToIp(current >>> 0))
    }

    return hosts
  }

  /**
   * Reads and parses the system ARP cache.
   */
  async getArpTable(): Promise<ArpEntry[]> {
    const output = await this.proc.execAndCapture('arp -a')
    if (output.exitCode !== 0) {
      return []
    }

    return this.parseArpOutput(output.stdout)
  }

  /**
   * Performs a lightweight TCP reachability probe.
   */
  async isHostReachable(host: string, options: ReachableHostOptions = {}): Promise<boolean> {
    const timeout = options.timeout ?? this.options.timeout ?? 1000
    const ports = options.ports?.length ? options.ports : [80, 443]

    for (const port of ports) {
      const probe = await this.probeTcpPort(host, port, timeout, false)
      if (probe.status === 'open') {
        return true
      }
    }

    return false
  }

  /**
   * Discovers hosts in a CIDR range by combining ARP cache and TCP probes.
   */
  async discoverHosts(cidr: string, options: DiscoverHostsOptions = {}): Promise<DiscoverHost[]> {
    const timeout = options.timeout ?? this.options.timeout ?? 1000
    const concurrency = Math.max(1, options.concurrency ?? this.options.concurrency ?? 200)
    const probePorts = options.ports?.length ? options.ports : [80, 443]
    const allIps = this.expandCidr(cidr)
    const arp = await this.getArpTable()
    const arpByIp = new Map<string, ArpEntry>(arp.map(entry => [entry.ip, entry]))

    this.emit('scan:start', { target: cidr, type: 'discoverHosts' })
    const startTime = Date.now()

    const discovered = await this.mapWithConcurrency(allIps, concurrency, async (ip): Promise<DiscoverHost | null> => {
      const arpHit = arpByIp.get(ip)
      if (arpHit) {
        const host: DiscoverHost = {
          ip,
          mac: arpHit.mac,
          reachable: true,
          method: 'arp',
        }
        this.emit('host:discovered', host)
        return host
      }

      const reachable = await this.isHostReachable(ip, { timeout, ports: probePorts })
      if (!reachable) {
        return null
      }

      const host: DiscoverHost = {
        ip,
        reachable: true,
        method: 'tcp',
      }
      this.emit('host:discovered', host)
      return host
    })

    const hosts = discovered.filter((value): value is DiscoverHost => value !== null)

    this.setState({
      lastScan: {
        timestamp: Date.now(),
        target: cidr,
        type: 'discoverHosts',
        networks: [
          {
            cidr,
            hosts: hosts.map(host => ({
              ip: host.ip,
              mac: host.mac,
              openPorts: [],
            })),
          },
        ],
      },
    })

    this.emit('scan:complete', {
      target: cidr,
      type: 'discoverHosts',
      duration: Date.now() - startTime,
      hostsFound: hosts.length,
      portsFound: 0,
    })

    return hosts
  }

  /**
   * TCP connect scan for a host. By default only returns open ports.
   */
  async scanPorts(host: string, options: ScanPortsOptions = {}): Promise<PortScanResult[]> {
    const timeout = options.timeout ?? this.options.timeout ?? 2000
    const concurrency = Math.max(1, options.concurrency ?? this.options.concurrency ?? 200)
    const includeBanner = !!options.banner
    const includeClosed = !!options.includeClosed
    const ports = this.parsePortsOption(options.ports)

    this.emit('scan:start', { target: host, type: 'scanPorts' })
    const startTime = Date.now()

    const scanned = await this.mapWithConcurrency(ports, concurrency, async (port): Promise<PortScanResult> => {
      const probe = await this.probeTcpPort(host, port, timeout, includeBanner)
      const result: PortScanResult = {
        port,
        status: probe.status,
      }

      if (probe.status === 'open') {
        result.service = PORT_SERVICE_MAP[port] || 'unknown'
        if (probe.banner) {
          result.banner = probe.banner
        }

        this.emit('port:open', {
          host,
          port,
          service: result.service,
          banner: result.banner,
        })
      }

      return result
    })

    const results = includeClosed ? scanned : scanned.filter(result => result.status === 'open')

    this.emit('scan:complete', {
      target: host,
      type: 'scanPorts',
      duration: Date.now() - startTime,
      hostsFound: 1,
      portsFound: results.filter(result => result.status === 'open').length,
    })

    return results
  }

  /**
   * Convenience method: discover and port-scan hosts across all local networks.
   */
  async scanLocalNetworks(options: ScanLocalNetworksOptions = {}): Promise<LocalNetworkScanHost[]> {
    const networks = this.getLocalNetworks()
    const timeout = options.timeout ?? this.options.timeout ?? 1500
    const concurrency = Math.max(1, options.concurrency ?? this.options.concurrency ?? 200)
    const hostConcurrency = Math.max(1, options.hostConcurrency ?? 20)
    const targetLabel = networks.map(network => network.cidr).join(', ')
    const startTime = Date.now()

    this.emit('scan:start', { target: targetLabel, type: 'scanLocalNetworks' })

    const snapshots: NetworkSnapshot[] = []
    const mergedHosts = new Map<string, LocalNetworkScanHost>()

    for (const network of networks) {
      const discovered = await this.discoverHosts(network.cidr, { timeout, concurrency })
      const hosts = await this.mapWithConcurrency(discovered, hostConcurrency, async (host): Promise<LocalNetworkScanHost> => {
        const scan = await this.scanPorts(host.ip, {
          ports: options.ports,
          timeout,
          concurrency,
          banner: options.banner,
          includeClosed: false,
        })

        return {
          ip: host.ip,
          mac: host.mac,
          openPorts: scan.filter(port => port.status === 'open'),
        }
      })

      snapshots.push({
        cidr: network.cidr,
        hosts,
      })

      for (const host of hosts) {
        const existing = mergedHosts.get(host.ip)
        if (!existing) {
          mergedHosts.set(host.ip, host)
          continue
        }

        const portsByNumber = new Map<number, PortScanResult>()
        for (const port of existing.openPorts) {
          portsByNumber.set(port.port, port)
        }
        for (const port of host.openPorts) {
          portsByNumber.set(port.port, port)
        }

        mergedHosts.set(host.ip, {
          ip: host.ip,
          mac: host.mac || existing.mac,
          hostname: host.hostname || existing.hostname,
          openPorts: Array.from(portsByNumber.values()).sort((a, b) => a.port - b.port),
        })
      }
    }

    const results = Array.from(mergedHosts.values()).sort((a, b) => a.ip.localeCompare(b.ip))
    const portsFound = results.reduce((sum, host) => sum + host.openPorts.length, 0)

    this.setState({
      lastScan: {
        timestamp: Date.now(),
        target: targetLabel,
        type: 'scanLocalNetworks',
        networks: snapshots,
      },
    })

    this.emit('scan:complete', {
      target: targetLabel,
      type: 'scanLocalNetworks',
      duration: Date.now() - startTime,
      hostsFound: results.length,
      portsFound,
    })

    return results
  }

  /**
   * Optional nmap wrapper for users that already have nmap installed.
   */
  get nmap() {
    return {
      isAvailable: async () => this.isNmapAvailable(),
      scan: async (target: string, args: string[] = []) => this.runNmapScan(target, args),
      quickScan: async (cidr: string) => this.runNmapScan(cidr, ['-sn']),
      fullScan: async (target: string) => this.runNmapScan(target, ['-sV', '-O']),
    }
  }

  private async isNmapAvailable(): Promise<boolean> {
    const result = await this.proc.spawnAndCapture('nmap', ['--version'])
    return result.exitCode === 0
  }

  private async runNmapScan(target: string, args: string[] = []) {
    const available = await this.isNmapAvailable()
    if (!available) {
      throw new Error('nmap binary not found in PATH')
    }

    this.emit('scan:start', { target, type: 'nmap' })
    const startTime = Date.now()

    const cmdArgs = [...args, '-oG', '-', target]
    const result = await this.proc.spawnAndCapture('nmap', cmdArgs)

    if (result.exitCode !== 0) {
      throw new Error(result.stderr || 'nmap scan failed')
    }

    const hosts = this.parseNmapGrepable(result.stdout)
    const portsFound = hosts.reduce((sum, host) => sum + host.ports.filter(port => port.state === 'open').length, 0)

    this.emit('scan:complete', {
      target,
      type: 'nmap',
      duration: Date.now() - startTime,
      hostsFound: hosts.length,
      portsFound,
    })

    return {
      hosts,
      raw: result.stdout,
    }
  }

  private parseNmapGrepable(output: string): NmapHost[] {
    const hostMap = new Map<string, NmapHost>()
    const lines = output.split('\n').map(line => line.trim()).filter(Boolean)

    for (const line of lines) {
      if (!line.startsWith('Host: ')) {
        continue
      }

      const hostMatch = line.match(/^Host:\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+\(([^)]*)\)/)
      if (!hostMatch) {
        continue
      }

      const ip = hostMatch[1]
      if (!ip) {
        continue
      }

      const hostname = hostMatch[2] || undefined
      const current: NmapHost = hostMap.get(ip) || { ip, hostname, ports: [] }

      const statusMatch = line.match(/Status:\s+([A-Za-z]+)/)
      if (statusMatch?.[1]) {
        current.status = statusMatch[1]
      }

      const macMatch = line.match(/MAC Address:\s+([0-9A-Fa-f:]+)/)
      if (macMatch?.[1]) {
        current.mac = macMatch[1].toLowerCase()
      }

      const portsMatch = line.match(/Ports:\s+(.+)$/)
      if (portsMatch?.[1]) {
        const parts = portsMatch[1].split(',').map(portSpec => portSpec.trim()).filter(Boolean)
        const ports: NmapPort[] = []

        for (const part of parts) {
          const portBits = part.split('/')
          const parsedPort = Number(portBits[0])
          if (!Number.isInteger(parsedPort) || parsedPort <= 0) {
            continue
          }

          ports.push({
            port: parsedPort,
            state: portBits[1] ?? 'unknown',
            protocol: portBits[2] ?? 'tcp',
            service: portBits[4] || undefined,
          })
        }

        current.ports = ports
      }

      hostMap.set(ip, current)
    }

    return Array.from(hostMap.values())
  }

  private parseArpOutput(output: string): ArpEntry[] {
    const entries = new Map<string, ArpEntry>()
    const lines = output.split('\n').map(line => line.trim()).filter(Boolean)
    let currentInterface: string | undefined

    for (const line of lines) {
      const ifaceMatch = line.match(/^Interface:\s+([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/i)
      if (ifaceMatch?.[1]) {
        currentInterface = ifaceMatch[1]
        continue
      }

      const unixMatch = line.match(/^\?\s+\(([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\)\s+at\s+([0-9a-fA-F:-]+|\(incomplete\))\s+on\s+([a-zA-Z0-9_.:-]+)/)
      if (unixMatch?.[1] && unixMatch?.[2] && unixMatch?.[3]) {
        const ip = unixMatch[1]
        const rawMac = unixMatch[2]
        const iface = unixMatch[3]
        const mac = rawMac === '(incomplete)' ? undefined : this.normalizeMac(rawMac)

        entries.set(ip, { ip, mac, interface: iface })
        continue
      }

      const winMatch = line.match(/^([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)\s+([0-9a-fA-F-]{17})\s+\w+/)
      if (winMatch?.[1] && winMatch?.[2]) {
        const ip = winMatch[1]
        entries.set(ip, {
          ip,
          mac: this.normalizeMac(winMatch[2]),
          interface: currentInterface,
        })
      }
    }

    return Array.from(entries.values())
  }

  private normalizeMac(mac: string): string {
    return mac.replaceAll('-', ':').toLowerCase()
  }

  private parsePortsOption(ports?: string | number[]): number[] {
    if (!ports) {
      return [...DEFAULT_PORTS]
    }

    if (Array.isArray(ports)) {
      const unique = Array.from(new Set(ports.map(port => Number(port)).filter(port => Number.isInteger(port) && port >= 1 && port <= 65535)))
      return unique.sort((a, b) => a - b)
    }

    const parsed = new Set<number>()
    for (const segment of ports.split(',').map(part => part.trim()).filter(Boolean)) {
      if (segment.includes('-')) {
        const [startRaw, endRaw] = segment.split('-')
        const start = Number(startRaw)
        const end = Number(endRaw)

        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end > 65535 || start > end) {
          continue
        }

        for (let current = start; current <= end; current += 1) {
          parsed.add(current)
        }
      } else {
        const value = Number(segment)
        if (Number.isInteger(value) && value >= 1 && value <= 65535) {
          parsed.add(value)
        }
      }
    }

    const values = Array.from(parsed.values()).sort((a, b) => a - b)
    return values.length ? values : [...DEFAULT_PORTS]
  }

  private async probeTcpPort(host: string, port: number, timeout: number, captureBanner: boolean): Promise<{ status: 'open' | 'closed' | 'filtered'; banner?: string }> {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      let settled = false
      let connected = false
      let banner = ''

      const done = (status: 'open' | 'closed' | 'filtered') => {
        if (settled) {
          return
        }
        settled = true

        try {
          socket.destroy()
        } catch {
          // no-op
        }

        resolve({
          status,
          banner: banner.length > 0 ? banner : undefined,
        })
      }

      socket.setTimeout(timeout)

      socket.on('connect', () => {
        connected = true

        if (!captureBanner) {
          done('open')
          return
        }

        if ([80, 3000, 4000, 5000, 8080, 8443, 9000].includes(port)) {
          socket.write('HEAD / HTTP/1.0\r\n\r\n')
        }

        setTimeout(() => done('open'), 300)
      })

      socket.on('data', (chunk: Buffer) => {
        if (!captureBanner) {
          return
        }

        banner = `${banner}${chunk.toString('utf8')}`.slice(0, 256).trim()
        done('open')
      })

      socket.on('timeout', () => {
        done(connected ? 'open' : 'filtered')
      })

      socket.on('error', (error: any) => {
        const code = String(error?.code || '')
        if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
          done('closed')
          return
        }

        done('filtered')
      })

      socket.on('close', () => {
        if (!settled) {
          done(connected ? 'open' : 'filtered')
        }
      })

      socket.connect(port, host)
    })
  }

  private computeCidr(address: string, netmask: string): string {
    const addressInt = this.ipToInt(address)
    const netmaskInt = this.ipToInt(netmask)
    const prefixLength = this.countMaskBits(netmaskInt)
    const network = addressInt & netmaskInt

    return `${this.intToIp(network >>> 0)}/${prefixLength}`
  }

  private ipToInt(ip: string): number {
    const parts = ip.split('.').map(part => Number(part))
    if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
      throw new Error(`Invalid IPv4 address: ${ip}`)
    }

    const a = parts[0]!
    const b = parts[1]!
    const c = parts[2]!
    const d = parts[3]!
    return (((a << 24) >>> 0) + (b << 16) + (c << 8) + d) >>> 0
  }

  private intToIp(value: number): string {
    const normalized = value >>> 0
    return [
      (normalized >>> 24) & 255,
      (normalized >>> 16) & 255,
      (normalized >>> 8) & 255,
      normalized & 255,
    ].join('.')
  }

  private countMaskBits(mask: number): number {
    let bits = 0
    let current = mask >>> 0
    while (current > 0) {
      bits += current & 1
      current >>>= 1
    }
    return bits
  }

  private async mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
    if (items.length === 0) {
      return []
    }

    const safeConcurrency = Math.min(Math.max(1, concurrency), items.length)
    const results = new Array<R>(items.length)
    let nextIndex = 0

    const runWorker = async () => {
      while (true) {
        const index = nextIndex
        nextIndex += 1
        if (index >= items.length) {
          return
        }
        const item = items[index] as T
        results[index] = await worker(item, index)
      }
    }

    await Promise.all(Array.from({ length: safeConcurrency }, () => runWorker()))
    return results
  }
}

export default Networking