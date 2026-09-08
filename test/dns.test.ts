import { afterEach, beforeEach, describe, expect, it, spyOn, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'

let container: NodeContainer
let lookup: Mock<NodeContainer['proc']['execSync']>
let spawn: Mock<NodeContainer['proc']['spawnAndCapture']>
const response = (stdout: string, exitCode = 0, stderr = '') => ({ stdout, stderr, exitCode, error: null, pid: null })
const record = (type: string, value: string) => `example.test.\t300\tIN\t${type}\t${value}\n`

beforeEach(() => {
  container = new NodeContainer()
  lookup = spyOn(container.proc, 'execSync').mockReturnValue('/usr/bin/dig\n')
  spawn = spyOn(container.proc, 'spawnAndCapture').mockResolvedValue(response(''))
})
afterEach(() => { lookup.mockRestore(); spawn.mockRestore() })

describe('DNS queries without external DNS or dig', () => {
  it('parses answers and timing, ignores comments, and records successful queries', async () => {
    spawn.mockResolvedValue(response(`;; HEADER\r\n${record('A', '192.0.2.1')}not a record\n;; Query time: 17 msec\n`))
    const dns = container.feature('dns', { server: '192.0.2.53', timeout: 3 })
    const result = await dns.resolve('example.test', 'A')
    expect(result).toEqual({ domain: 'example.test', type: 'A', server: '192.0.2.53', queryTime: 17,
      records: [{ name: 'example.test.', ttl: 300, class: 'IN', type: 'A', value: '192.0.2.1' }] })
    expect(spawn).toHaveBeenCalledWith('/usr/bin/dig', ['@192.0.2.53', 'example.test', 'A', '+noall', '+answer', '+stats', '+time=3'])
    expect(dns.state.get('lastQuery')).toMatchObject({ domain: 'example.test', type: 'A' })
    expect(dns.state.get('lastQuery')!.timestamp).toBeGreaterThan(0)
  })

  it('per-query server and timeout override defaults', async () => {
    const dns = container.feature('dns', { server: '192.0.2.1', timeout: 9 })
    const result = await dns.resolve('example.test', 'AAAA', { server: '192.0.2.2', timeout: 1 })
    expect(result.server).toBe('192.0.2.2')
    expect(result.queryTime).toBeUndefined()
    expect(result.records).toEqual([])
    expect(spawn).toHaveBeenCalledWith('/usr/bin/dig', ['@192.0.2.2', 'example.test', 'AAAA', '+noall', '+answer', '+stats', '+time=1'])
  })

  it('caches binary discovery', async () => {
    const dns = container.feature('dns')
    expect(await dns.isAvailable()).toBe(true)
    await dns.isAvailable()
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(spawn).toHaveBeenCalledWith('/usr/bin/dig', ['-v'])
  })

  it('falls back to PATH when discovery fails and reports an unavailable executable', async () => {
    lookup.mockImplementation(() => { throw new Error('missing') })
    spawn.mockResolvedValue(response('', 127))
    expect(await container.feature('dns').isAvailable()).toBe(false)
    expect(spawn).toHaveBeenCalledWith('dig', ['-v'])
  })

  it.each(['connection refused', ''])('propagates query errors (%j) without recording success', async (stderr) => {
    spawn.mockResolvedValue(response('', 9, stderr))
    const dns = container.feature('dns')
    await expect(dns.resolve('example.test', 'A')).rejects.toThrow(stderr || 'unknown error')
    expect(dns.state.get('lastQuery')).toBeUndefined()
  })

  it.each([
    ['a', 'A', '192.0.2.1'], ['aaaa', 'AAAA', '2001:db8::1'],
    ['cname', 'CNAME', 'alias.example.test.'], ['ns', 'NS', 'ns.example.test.'],
  ] as const)('%s returns typed records', async (method, type, value) => {
    spawn.mockResolvedValue(response(record(type, value)))
    expect(await container.feature('dns')[method]('example.test')).toEqual([
      { name: 'example.test.', ttl: 300, class: 'IN', type, value },
    ])
  })

  it('parses structured MX, SOA, SRV and CAA fields', async () => {
    const dns = container.feature('dns')
    spawn.mockResolvedValueOnce(response(record('MX', '10 mail.example.test.')))
    expect((await dns.mx('example.test'))[0]).toMatchObject({ priority: 10, exchange: 'mail.example.test.' })
    spawn.mockResolvedValueOnce(response(record('SOA', 'ns.example.test. hostmaster.example.test. 20260101 3600 600 86400 300')))
    expect((await dns.soa('example.test'))[0]).toMatchObject({ mname: 'ns.example.test.', rname: 'hostmaster.example.test.', serial: 20260101, refresh: 3600, retry: 600, expire: 86400, minimum: 300 })
    spawn.mockResolvedValueOnce(response(record('SRV', '10 20 443 service.example.test.')))
    expect((await dns.srv('example.test'))[0]).toMatchObject({ priority: 10, weight: 20, port: 443, target: 'service.example.test.' })
    spawn.mockResolvedValueOnce(response(record('CAA', '0 issue "ca.example.test"')))
    expect((await dns.caa('example.test'))[0]).toMatchObject({ flags: 0, tag: 'issue', issuer: 'ca.example.test' })
  })

  it('supports TXT substring presence and absence', async () => {
    spawn.mockResolvedValue(response(record('TXT', '"v=spf1 -all"')))
    const dns = container.feature('dns')
    expect(await dns.hasTxtRecord('example.test', 'v=spf1')).toBe(true)
    expect(await dns.hasTxtRecord('example.test', 'google-site-verification')).toBe(false)
  })

  it('constructs reverse lookups and propagates errors', async () => {
    const dns = container.feature('dns')
    spawn.mockResolvedValueOnce(response(record('PTR', 'host.example.test.')))
    expect(await dns.reverse('192.0.2.1')).toEqual(['host.example.test.'])
    expect(spawn.mock.calls[0]![1].slice(0, 2)).toEqual(['-x', '192.0.2.1'])
    spawn.mockResolvedValueOnce(response('', 1, 'reverse failed'))
    await expect(dns.reverse('192.0.2.1')).rejects.toThrow('reverse failed')
  })

  it('compares record values independently of order and detects mismatches', async () => {
    const dns = container.feature('dns')
    spawn.mockResolvedValueOnce(response(record('A', '192.0.2.1') + record('A', '192.0.2.2')))
    spawn.mockResolvedValueOnce(response(record('A', '192.0.2.2') + record('A', '192.0.2.1')))
    expect((await dns.compare('example.test', 'A', '192.0.2.53', '192.0.2.54')).match).toBe(true)
    spawn.mockResolvedValueOnce(response(record('A', '192.0.2.1')))
    spawn.mockResolvedValueOnce(response(record('A', '192.0.2.2')))
    expect((await dns.compare('example.test', 'A', '192.0.2.53', '192.0.2.54')).match).toBe(false)
  })

  it('queries each authoritative server after stripping the trailing dot', async () => {
    spawn.mockResolvedValueOnce(response(record('NS', 'ns1.example.test.') + record('NS', 'ns2.example.test.')))
    const results = await container.feature('dns').queryAuthoritative('example.test', 'A')
    expect(results.map(r => r.server).sort()).toEqual(['ns1.example.test', 'ns2.example.test'])
    expect(spawn.mock.calls.slice(1).map(call => call[1][0]).sort()).toEqual(['@ns1.example.test', '@ns2.example.test'])
  })

  it('does not query authoritative servers when no NS records exist', async () => {
    expect(await container.feature('dns').queryAuthoritative('example.test', 'A')).toEqual([])
    expect(spawn).toHaveBeenCalledTimes(1)
  })

  it('collects all supported overview categories', async () => {
    const overview = await container.feature('dns').overview('example.test')
    expect(overview).toEqual({ domain: 'example.test', a: [], aaaa: [], cname: [], mx: [], ns: [], txt: [], soa: [], caa: [] })
    expect(spawn.mock.calls.map(call => call[1].find((arg: string) => /^[A-Z]+$/.test(arg))).sort()).toEqual(['A', 'AAAA', 'CAA', 'CNAME', 'MX', 'NS', 'SOA', 'TXT'])
  })
})
