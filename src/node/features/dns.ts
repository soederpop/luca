import { z } from 'zod'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/** Supported DNS record types. */
export type DnsRecordType = 'A' | 'AAAA' | 'CNAME' | 'MX' | 'NS' | 'TXT' | 'SOA' | 'PTR' | 'SRV' | 'CAA'

export const DnsRecordSchema = z.object({
  name: z.string().describe('The queried domain name'),
  ttl: z.number().describe('Time to live in seconds'),
  class: z.string().describe('Record class (usually IN)'),
  type: z.string().describe('DNS record type'),
  value: z.string().describe('Record value/data'),
})
export type DnsRecord = z.infer<typeof DnsRecordSchema>

export const MxRecordSchema = DnsRecordSchema.extend({
  priority: z.number().describe('MX priority value'),
  exchange: z.string().describe('Mail exchange hostname'),
})
export type MxRecord = z.infer<typeof MxRecordSchema>

export const SoaRecordSchema = DnsRecordSchema.extend({
  mname: z.string().describe('Primary nameserver'),
  rname: z.string().describe('Responsible party email (dot notation)'),
  serial: z.number().describe('Zone serial number'),
  refresh: z.number().describe('Refresh interval in seconds'),
  retry: z.number().describe('Retry interval in seconds'),
  expire: z.number().describe('Expire time in seconds'),
  minimum: z.number().describe('Minimum TTL in seconds'),
})
export type SoaRecord = z.infer<typeof SoaRecordSchema>

export const SrvRecordSchema = DnsRecordSchema.extend({
  priority: z.number().describe('SRV priority'),
  weight: z.number().describe('SRV weight'),
  port: z.number().describe('SRV port'),
  target: z.string().describe('SRV target hostname'),
})
export type SrvRecord = z.infer<typeof SrvRecordSchema>

export const CaaRecordSchema = DnsRecordSchema.extend({
  flags: z.number().describe('CAA flags'),
  tag: z.string().describe('CAA tag (issue, issuewild, iodef)'),
  issuer: z.string().describe('CAA value/issuer'),
})
export type CaaRecord = z.infer<typeof CaaRecordSchema>

export const DnsQueryResultSchema = z.object({
  domain: z.string().describe('The queried domain'),
  type: z.string().describe('The record type queried'),
  server: z.string().optional().describe('DNS server used for the query'),
  records: z.array(DnsRecordSchema).describe('Returned DNS records'),
  queryTime: z.number().optional().describe('Query time in milliseconds'),
})
export type DnsQueryResult = z.infer<typeof DnsQueryResultSchema>

export const DnsOverviewSchema = z.object({
  domain: z.string().describe('The queried domain'),
  a: z.array(DnsRecordSchema).describe('A records'),
  aaaa: z.array(DnsRecordSchema).describe('AAAA records'),
  cname: z.array(DnsRecordSchema).describe('CNAME records'),
  mx: z.array(MxRecordSchema).describe('MX records'),
  ns: z.array(DnsRecordSchema).describe('NS records'),
  txt: z.array(DnsRecordSchema).describe('TXT records'),
  soa: z.array(SoaRecordSchema).describe('SOA records'),
  caa: z.array(CaaRecordSchema).describe('CAA records'),
})
export type DnsOverview = z.infer<typeof DnsOverviewSchema>

export const DnsStateSchema = FeatureStateSchema.extend({
  lastQuery: z.object({
    domain: z.string(),
    type: z.string(),
    timestamp: z.number(),
  }).optional().describe('The most recent DNS query'),
})
export type DnsState = z.infer<typeof DnsStateSchema>

export const DnsOptionsSchema = FeatureOptionsSchema.extend({
  server: z.string().optional().describe('Default DNS server to use for queries'),
  timeout: z.number().optional().describe('Default timeout in seconds for dig queries'),
})
export type DnsOptions = z.infer<typeof DnsOptionsSchema>

type QueryOptions = {
  server?: string
  timeout?: number
  short?: boolean
}

/**
 * The Dns feature provides structured DNS lookups by wrapping the `dig` CLI.
 *
 * All query methods parse dig output into typed JSON objects, making it easy
 * to explore and audit a domain's DNS configuration programmatically.
 *
 * @example
 * ```typescript
 * const dns = container.feature('dns')
 *
 * // Look up A records
 * const result = await dns.resolve('example.com', 'A')
 * console.log(result.records)
 *
 * // Get a full overview of all record types
 * const overview = await dns.overview('example.com')
 * console.log(overview.mx)  // mail servers
 * console.log(overview.ns)  // nameservers
 * console.log(overview.txt) // TXT records (SPF, DKIM, etc.)
 *
 * // Reverse lookup
 * const ptr = await dns.reverse('8.8.8.8')
 * console.log(ptr) // ['dns.google.']
 * ```
 *
 * @extends Feature
 */
export class Dns extends Feature<DnsState, DnsOptions> {
  static override shortcut = 'features.dns' as const
  static override description = 'DNS lookup utilities wrapping the dig CLI'
  static override stateSchema = DnsStateSchema
  static override optionsSchema = DnsOptionsSchema
  static { Feature.register(this, 'dns') }

  override get initialState(): DnsState {
    return {
      ...super.initialState,
      enabled: false,
      lastQuery: undefined,
    }
  }

  get proc() {
    return this.container.feature('proc')
  }

  /**
   * Checks whether the `dig` binary is available on the system.
   *
   * @returns True if dig is installed and accessible
   *
   * @example
   * ```typescript
   * if (await dns.isAvailable()) {
   *   const records = await dns.a('example.com')
   * }
   * ```
   */
  async isAvailable(): Promise<boolean> {
    const result = await this.proc.spawnAndCapture('dig', ['-v'])
    // dig -v prints version to stderr and exits 0
    return result.exitCode === 0
  }

  /**
   * Resolves DNS records of a given type for a domain.
   *
   * This is the core query method. All convenience methods (a, aaaa, mx, etc.)
   * delegate to this method.
   *
   * @param domain - The domain name to query
   * @param type - The DNS record type to look up
   * @param options - Optional query parameters
   * @param options.server - DNS server to use (e.g. '8.8.8.8')
   * @param options.timeout - Query timeout in seconds
   * @param options.short - If true, returns only values (no TTL, class, etc.)
   * @returns Parsed query result with typed records
   *
   * @example
   * ```typescript
   * const result = await dns.resolve('example.com', 'A')
   * for (const record of result.records) {
   *   console.log(`${record.name} -> ${record.value} (TTL: ${record.ttl}s)`)
   * }
   *
   * // Query a specific DNS server
   * const result = await dns.resolve('example.com', 'A', { server: '1.1.1.1' })
   * ```
   */
  async resolve(domain: string, type: DnsRecordType, options: QueryOptions = {}): Promise<DnsQueryResult> {
    const args = this.buildDigArgs(domain, type, options)
    const result = await this.proc.spawnAndCapture('dig', args)

    if (result.exitCode !== 0) {
      throw new Error(`dig query failed: ${result.stderr || 'unknown error'}`)
    }

    const records = this.parseDigAnswer(result.stdout)
    const queryTime = this.parseQueryTime(result.stdout)
    const server = options.server || this.options.server

    this.setState({
      lastQuery: {
        domain,
        type,
        timestamp: Date.now(),
      },
    })

    return {
      domain,
      type,
      server,
      records,
      queryTime,
    }
  }

  /**
   * Looks up A (IPv4 address) records for a domain.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of A records
   *
   * @example
   * ```typescript
   * const records = await dns.a('google.com')
   * // [{ name: 'google.com.', ttl: 300, class: 'IN', type: 'A', value: '142.250.x.x' }]
   * ```
   */
  async a(domain: string, options: QueryOptions = {}): Promise<DnsRecord[]> {
    const result = await this.resolve(domain, 'A', options)
    return result.records
  }

  /**
   * Looks up AAAA (IPv6 address) records for a domain.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of AAAA records
   *
   * @example
   * ```typescript
   * const records = await dns.aaaa('google.com')
   * // [{ name: 'google.com.', ttl: 300, class: 'IN', type: 'AAAA', value: '2607:f8b0:...' }]
   * ```
   */
  async aaaa(domain: string, options: QueryOptions = {}): Promise<DnsRecord[]> {
    const result = await this.resolve(domain, 'AAAA', options)
    return result.records
  }

  /**
   * Looks up CNAME (canonical name) records for a domain.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of CNAME records
   *
   * @example
   * ```typescript
   * const records = await dns.cname('www.github.com')
   * // [{ name: 'www.github.com.', ttl: 3600, class: 'IN', type: 'CNAME', value: 'github.com.' }]
   * ```
   */
  async cname(domain: string, options: QueryOptions = {}): Promise<DnsRecord[]> {
    const result = await this.resolve(domain, 'CNAME', options)
    return result.records
  }

  /**
   * Looks up MX (mail exchange) records for a domain.
   *
   * Returns enriched records with parsed priority and exchange fields.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of MX records with priority and exchange
   *
   * @example
   * ```typescript
   * const records = await dns.mx('google.com')
   * // [{ name: 'google.com.', ttl: 300, type: 'MX', priority: 10, exchange: 'smtp.google.com.' }]
   * ```
   */
  async mx(domain: string, options: QueryOptions = {}): Promise<MxRecord[]> {
    const result = await this.resolve(domain, 'MX', options)
    return result.records.map((record) => {
      const parts = record.value.split(/\s+/)
      const priority = parseInt(parts[0] || '0', 10)
      const exchange = parts[1] || record.value
      return { ...record, priority, exchange }
    })
  }

  /**
   * Looks up NS (nameserver) records for a domain.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of NS records
   *
   * @example
   * ```typescript
   * const records = await dns.ns('google.com')
   * // [{ name: 'google.com.', ttl: 86400, type: 'NS', value: 'ns1.google.com.' }, ...]
   * ```
   */
  async ns(domain: string, options: QueryOptions = {}): Promise<DnsRecord[]> {
    const result = await this.resolve(domain, 'NS', options)
    return result.records
  }

  /**
   * Looks up TXT records for a domain.
   *
   * TXT records often contain SPF policies, DKIM keys, domain verification tokens,
   * and other metadata.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of TXT records
   *
   * @example
   * ```typescript
   * const records = await dns.txt('google.com')
   * const spf = records.find(r => r.value.includes('v=spf1'))
   * console.log(spf?.value) // 'v=spf1 include:_spf.google.com ~all'
   * ```
   */
  async txt(domain: string, options: QueryOptions = {}): Promise<DnsRecord[]> {
    const result = await this.resolve(domain, 'TXT', options)
    return result.records.map((record) => ({
      ...record,
      value: record.value.replace(/^"(.*)"$/, '$1'),
    }))
  }

  /**
   * Looks up the SOA (Start of Authority) record for a domain.
   *
   * Returns enriched records with parsed SOA fields including primary nameserver,
   * responsible party, serial number, and timing parameters.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of SOA records (typically one)
   *
   * @example
   * ```typescript
   * const records = await dns.soa('google.com')
   * console.log(records[0].mname)  // 'ns1.google.com.'
   * console.log(records[0].serial) // 879543655
   * ```
   */
  async soa(domain: string, options: QueryOptions = {}): Promise<SoaRecord[]> {
    const result = await this.resolve(domain, 'SOA', options)
    return result.records.map((record) => {
      const parts = record.value.split(/\s+/)
      return {
        ...record,
        mname: parts[0] || '',
        rname: parts[1] || '',
        serial: parseInt(parts[2] || '0', 10),
        refresh: parseInt(parts[3] || '0', 10),
        retry: parseInt(parts[4] || '0', 10),
        expire: parseInt(parts[5] || '0', 10),
        minimum: parseInt(parts[6] || '0', 10),
      }
    })
  }

  /**
   * Looks up SRV (service) records for a domain.
   *
   * SRV records specify the location of services. The domain should include
   * the service and protocol prefix (e.g. `_sip._tcp.example.com`).
   *
   * @param domain - The full SRV domain (e.g. `_sip._tcp.example.com`)
   * @param options - Optional query parameters
   * @returns Array of SRV records with priority, weight, port, and target
   *
   * @example
   * ```typescript
   * const records = await dns.srv('_sip._tcp.example.com')
   * // [{ priority: 10, weight: 60, port: 5060, target: 'sip.example.com.' }]
   * ```
   */
  async srv(domain: string, options: QueryOptions = {}): Promise<SrvRecord[]> {
    const result = await this.resolve(domain, 'SRV', options)
    return result.records.map((record) => {
      const parts = record.value.split(/\s+/)
      return {
        ...record,
        priority: parseInt(parts[0] || '0', 10),
        weight: parseInt(parts[1] || '0', 10),
        port: parseInt(parts[2] || '0', 10),
        target: parts[3] || '',
      }
    })
  }

  /**
   * Looks up CAA (Certificate Authority Authorization) records for a domain.
   *
   * CAA records specify which certificate authorities are allowed to issue
   * certificates for a domain.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters
   * @returns Array of CAA records with flags, tag, and issuer
   *
   * @example
   * ```typescript
   * const records = await dns.caa('google.com')
   * // [{ flags: 0, tag: 'issue', issuer: 'pki.goog' }]
   * ```
   */
  async caa(domain: string, options: QueryOptions = {}): Promise<CaaRecord[]> {
    const result = await this.resolve(domain, 'CAA', options)
    return result.records.map((record) => {
      const parts = record.value.split(/\s+/)
      return {
        ...record,
        flags: parseInt(parts[0] || '0', 10),
        tag: (parts[1] || '').replace(/"/g, ''),
        issuer: (parts.slice(2).join(' ') || '').replace(/"/g, ''),
      }
    })
  }

  /**
   * Performs a reverse DNS lookup for an IP address.
   *
   * Converts the IP to its in-addr.arpa form and queries for PTR records.
   *
   * @param ip - The IPv4 address to look up
   * @param options - Optional query parameters
   * @returns Array of hostnames (PTR record values)
   *
   * @example
   * ```typescript
   * const hostnames = await dns.reverse('8.8.8.8')
   * // ['dns.google.']
   * ```
   */
  async reverse(ip: string, options: QueryOptions = {}): Promise<string[]> {
    const args = this.buildDigArgs('', 'PTR', options)
    // Replace domain arg with -x flag
    const idx = args.indexOf('')
    if (idx !== -1) {
      args.splice(idx, 1)
    }
    args.unshift('-x', ip)

    const result = await this.proc.spawnAndCapture('dig', args)

    if (result.exitCode !== 0) {
      throw new Error(`dig reverse lookup failed: ${result.stderr || 'unknown error'}`)
    }

    const records = this.parseDigAnswer(result.stdout)
    return records.map((r) => r.value)
  }

  /**
   * Retrieves a comprehensive DNS overview for a domain.
   *
   * Queries all common record types (A, AAAA, CNAME, MX, NS, TXT, SOA, CAA)
   * in parallel and returns a consolidated view. This is the go-to method for
   * exploring a domain's full DNS configuration.
   *
   * @param domain - The domain name to query
   * @param options - Optional query parameters applied to all queries
   * @returns Complete DNS overview with all record types
   *
   * @example
   * ```typescript
   * const overview = await dns.overview('example.com')
   * console.log('IPs:', overview.a.map(r => r.value))
   * console.log('Mail:', overview.mx.map(r => r.exchange))
   * console.log('Nameservers:', overview.ns.map(r => r.value))
   * console.log('TXT:', overview.txt.map(r => r.value))
   * ```
   */
  async overview(domain: string, options: QueryOptions = {}): Promise<DnsOverview> {
    const [a, aaaa, cname, mx, ns, txt, soa, caa] = await Promise.all([
      this.a(domain, options),
      this.aaaa(domain, options),
      this.cname(domain, options),
      this.mx(domain, options),
      this.ns(domain, options),
      this.txt(domain, options),
      this.soa(domain, options),
      this.caa(domain, options),
    ])

    return { domain, a, aaaa, cname, mx, ns, txt, soa, caa }
  }

  /**
   * Compares DNS resolution between two nameservers for a given record type.
   *
   * Useful for verifying DNS propagation or checking for inconsistencies
   * between authoritative and recursive resolvers.
   *
   * @param domain - The domain name to query
   * @param type - The DNS record type to compare
   * @param serverA - First DNS server (e.g. '8.8.8.8')
   * @param serverB - Second DNS server (e.g. '1.1.1.1')
   * @returns Object with results from both servers and whether they match
   *
   * @example
   * ```typescript
   * const diff = await dns.compare('example.com', 'A', '8.8.8.8', '1.1.1.1')
   * console.log(diff.match)   // true if both return the same values
   * console.log(diff.serverA) // records from 8.8.8.8
   * console.log(diff.serverB) // records from 1.1.1.1
   * ```
   */
  async compare(
    domain: string,
    type: DnsRecordType,
    serverA: string,
    serverB: string,
  ): Promise<{ serverA: DnsQueryResult; serverB: DnsQueryResult; match: boolean }> {
    const [resultA, resultB] = await Promise.all([
      this.resolve(domain, type, { server: serverA }),
      this.resolve(domain, type, { server: serverB }),
    ])

    const valuesA = resultA.records.map((r) => r.value).sort()
    const valuesB = resultB.records.map((r) => r.value).sort()
    const match = JSON.stringify(valuesA) === JSON.stringify(valuesB)

    return { serverA: resultA, serverB: resultB, match }
  }

  /**
   * Queries a domain's authoritative nameservers directly.
   *
   * First resolves the NS records, then queries each nameserver for the
   * specified record type. Useful for bypassing caches and checking what
   * the authoritative servers actually report.
   *
   * @param domain - The domain name to query
   * @param type - The DNS record type to look up
   * @returns Array of results, one per authoritative nameserver
   *
   * @example
   * ```typescript
   * const results = await dns.queryAuthoritative('example.com', 'A')
   * for (const r of results) {
   *   console.log(`${r.server}: ${r.records.map(rec => rec.value).join(', ')}`)
   * }
   * ```
   */
  async queryAuthoritative(domain: string, type: DnsRecordType): Promise<DnsQueryResult[]> {
    const nsRecords = await this.ns(domain)

    if (nsRecords.length === 0) {
      return []
    }

    const results = await Promise.all(
      nsRecords.map((ns) => this.resolve(domain, type, { server: ns.value.replace(/\.$/, '') })),
    )

    return results
  }

  /**
   * Checks whether a domain has a specific TXT record containing the given text.
   *
   * Useful for verifying domain ownership tokens, SPF records, DKIM entries, etc.
   *
   * @param domain - The domain name to query
   * @param search - The text to search for in TXT record values
   * @returns True if any TXT record contains the search string
   *
   * @example
   * ```typescript
   * // Check for SPF record
   * const hasSPF = await dns.hasTxtRecord('google.com', 'v=spf1')
   *
   * // Check for domain verification
   * const verified = await dns.hasTxtRecord('example.com', 'google-site-verification=')
   * ```
   */
  async hasTxtRecord(domain: string, search: string): Promise<boolean> {
    const records = await this.txt(domain)
    return records.some((r) => r.value.includes(search))
  }

  /** Builds the dig CLI arguments for a query. */
  private buildDigArgs(domain: string, type: DnsRecordType | 'PTR', options: QueryOptions = {}): string[] {
    const args: string[] = []
    const server = options.server || this.options.server

    if (server) {
      args.push(`@${server}`)
    }

    if (domain) {
      args.push(domain)
    }

    args.push(type)

    if (options.short) {
      args.push('+short')
    } else {
      args.push('+noall', '+answer', '+stats')
    }

    const timeout = options.timeout ?? this.options.timeout
    if (timeout) {
      args.push(`+time=${timeout}`)
    }

    return args
  }

  /** Parses dig's answer section into structured records. */
  private parseDigAnswer(output: string): DnsRecord[] {
    const records: DnsRecord[] = []
    const lines = output.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      // Skip comments, empty lines, and non-record lines
      if (!trimmed || trimmed.startsWith(';') || trimmed.startsWith(';;')) {
        continue
      }

      // Record format: name ttl class type value...
      const match = trimmed.match(/^(\S+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/)
      if (!match) {
        continue
      }

      const [, name, ttlStr, cls, recordType, value] = match

      records.push({
        name: name!,
        ttl: parseInt(ttlStr!, 10),
        class: cls!,
        type: recordType!,
        value: value!.trim(),
      })
    }

    return records
  }

  /** Extracts query time from dig's stats section. */
  private parseQueryTime(output: string): number | undefined {
    const match = output.match(/;; Query time:\s+(\d+)\s+msec/)
    return match ? parseInt(match[1]!, 10) : undefined
  }
}

export default Dns
