import { describe, expect, it, afterAll } from 'bun:test'

import { NodeContainer } from '../src/node/container'
import {
  InternetMail,
  MAIL_PROVIDER_PRESETS,
  validateMailHeaders,
  parseMailAddress,
  type ResolvedMailConfig,
  type StandardMailMessage,
} from '../src/node/features/internet-mail'

// ── Fakes ─────────────────────────────────────────────────────────────────────

interface FakeMessage {
  uid: number
  from: string
  fromName?: string
  to?: string[]
  cc?: string[]
  subject?: string
  text?: string
  size?: number
  sourceSize?: number
  messageId?: string
  references?: string[]
  authenticationResults?: string
  malformed?: boolean
  flags?: string[]
  date?: string
}

class FakeImapClient {
  connected = false
  lockReleased = false
  loggedOut = false
  flagWrites: Array<{ uid: string; flags: string[] }> = []
  searches: any[] = []

  constructor(
    public store: { uidValidity: string; messages: FakeMessage[] },
  ) {}

  get mailbox() {
    const maxUid = this.store.messages.reduce((max, m) => Math.max(max, m.uid), 0)
    return { uidValidity: this.store.uidValidity, uidNext: maxUid + 1 }
  }

  async connect() { this.connected = true }
  async logout() { this.loggedOut = true }

  async getMailboxLock(_mailbox: string) {
    this.lockReleased = false
    return { release: () => { this.lockReleased = true } }
  }

  async search(query: any, _opts: any): Promise<number[]> {
    this.searches.push(query)
    let matches = [...this.store.messages]
    if (query.uid) {
      const [low] = String(query.uid).split(':')
      matches = matches.filter(m => m.uid >= Number(low))
    }
    // IMAP FROM is substring matching on the header
    if (query.from) matches = matches.filter(m => m.from.includes(query.from))
    if (query.subject) matches = matches.filter(m => (m.subject || '').toLowerCase().includes(String(query.subject).toLowerCase()))
    if (query.body) matches = matches.filter(m => (m.text || '').toLowerCase().includes(String(query.body).toLowerCase()))
    if (query.since) matches = matches.filter(m => m.date && new Date(m.date) >= new Date(query.since))
    if (query.before) matches = matches.filter(m => m.date && new Date(m.date) < new Date(query.before))
    return matches.map(m => m.uid)
  }

  private find(uid: string | number): FakeMessage | undefined {
    return this.store.messages.find(m => m.uid === Number(uid))
  }

  async fetchOne(uid: string, fields: any, _opts: any): Promise<any> {
    const message = this.find(uid)
    if (!message) return null
    if (fields.source) {
      const body = message.malformed ? Buffer.from('%%%not-mime%%%') : Buffer.from(`uid-${message.uid}`)
      const size = message.sourceSize ?? body.length
      return { uid: message.uid, source: Buffer.alloc(size, body), flags: message.flags || [] }
    }
    return {
      uid: message.uid,
      envelope: {
        from: [{ address: message.from, name: message.fromName || '' }],
        to: (message.to || []).map(address => ({ address })),
        subject: message.subject || '',
        date: message.date ? new Date(message.date) : undefined,
      },
      size: message.size ?? 100,
      flags: message.flags || [],
    }
  }

  async *fetch(range: string, fields: any, opts: any): AsyncGenerator<any> {
    const [low] = range.split(':')
    for (const message of this.store.messages.filter(m => m.uid >= Number(low))) {
      yield this.fetchOne(String(message.uid), fields, opts)
    }
  }

  async messageFlagsAdd(uid: string, flags: string[], _opts: any) {
    this.flagWrites.push({ uid, flags })
  }
}

class FakeSmtpTransport {
  sent: any[] = []
  closed = false
  verifyError: Error | null = null
  rejectNext: string[] = []

  async verify() {
    if (this.verifyError) throw this.verifyError
    return true
  }

  close() { this.closed = true }

  async sendMail(mail: any) {
    this.sent.push(mail)
    const to = Array.isArray(mail.to) ? mail.to : [mail.to]
    const cc = mail.cc ? (Array.isArray(mail.cc) ? mail.cc : [mail.cc]) : []
    const all = [...to, ...cc]
    const rejected = this.rejectNext
    this.rejectNext = []
    return {
      messageId: '<fake-id@local>',
      accepted: all.filter(a => !rejected.includes(a)),
      rejected,
    }
  }
}

// A real container, so the poll cursor round-trips through the real store
// feature (tmp scope + a unique name per harness, cleaned up at the end).
const container = new NodeContainer()
const openedStores: any[] = []

afterAll(async () => {
  for (const handle of openedStores) {
    try { await handle.delete() } catch {}
  }
})

const PASSWORD = 's3cret-value-xyz'

interface HarnessOptions {
  config?: Record<string, any>
  store?: { uidValidity: string; messages: FakeMessage[] }
  /** Omit the password from the environment to exercise the missing-secret path */
  noSecret?: boolean
  /** Reuse another harness's cursor store — a "restart" against the same mailbox */
  cursorStore?: string
}

function createMail(opts: HarnessOptions = {}) {
  const store = opts.store ?? { uidValidity: '1000', messages: [] }
  const smtp = new FakeSmtpTransport()
  const clients: FakeImapClient[] = []
  const cursorStore = opts.cursorStore ?? `test-mail-${container.utils.uuid().slice(0, 8)}`

  const passwordEnv = opts.noSecret ? 'MISSING_MAIL_PASSWORD' : 'TEST_MAIL_PASSWORD'
  process.env.TEST_MAIL_PASSWORD = PASSWORD
  delete process.env.MISSING_MAIL_PASSWORD

  const mail = new InternetMail(
    { ...(opts.config ?? {}), passwordEnv, cursorStore, cursorScope: 'tmp' } as any,
    { container } as any,
  )
  openedStores.push(mail.cursorStore)

  ;(mail as any).createImapClient = async (_config: ResolvedMailConfig) => {
    const client = new FakeImapClient(store)
    clients.push(client)
    return client
  }
  ;(mail as any).createSmtpTransport = async (_config: ResolvedMailConfig) => smtp
  ;(mail as any).parseSource = async (source: Buffer) => {
    const text = source.toString('utf-8')
    if (text.includes('%%%not-mime%%%')) throw new Error('malformed MIME')
    const uid = Number(text.match(/uid-(\d+)/)?.[1])
    const message = store.messages.find(m => m.uid === uid)
    if (!message) throw new Error(`fake parse: no message for ${text.slice(0, 20)}`)
    return {
      messageId: message.messageId,
      inReplyTo: undefined,
      references: message.references,
      from: { value: [{ address: message.from, name: message.fromName || '' }] },
      to: { value: (message.to || []).map(address => ({ address })) },
      cc: { value: (message.cc || []).map(address => ({ address })) },
      subject: message.subject || '',
      text: message.text || '',
      headers: new Map(message.authenticationResults
        ? [['authentication-results', message.authenticationResults]]
        : []),
      attachments: [],
      date: message.date ? new Date(message.date) : undefined,
    }
  }

  return { mail, smtp, clients, store, cursorStore }
}

const baseConfig = {
  provider: 'icloud',
  address: 'jon@me.com',
  trustedSenders: ['trusted@example.com'],
  approvedRecipients: ['trusted@example.com'],
}

// ── Config & preset ───────────────────────────────────────────────────────────

describe('internetMail configuration', () => {
  it('the icloud preset uses IMAP 993 implicit TLS and SMTP 587 required STARTTLS', () => {
    expect(MAIL_PROVIDER_PRESETS.icloud!.imap).toEqual({ host: 'imap.mail.me.com', port: 993, secure: true })
    expect(MAIL_PROVIDER_PRESETS.icloud!.smtp).toEqual({ host: 'smtp.mail.me.com', port: 587, secure: false, requireTLS: true })
  })

  it('every preset declares both transports and a username style', () => {
    for (const [name, preset] of Object.entries(MAIL_PROVIDER_PRESETS)) {
      expect(preset.imap.host, name).toBeTruthy()
      expect(preset.smtp.host, name).toBeTruthy()
      // Implicit TLS is 993/465; anything else must upgrade explicitly
      expect(preset.imap.secure || preset.imap.requireTLS, name).toBeTruthy()
      expect(preset.smtp.secure || preset.smtp.requireTLS, name).toBeTruthy()
      expect(['address', 'local-part'], name).toContain(preset.usernames.imap)
      expect(['address', 'local-part'], name).toContain(preset.usernames.smtp)
    }
  })

  it('derives usernames from the preset style and honors explicit overrides', () => {
    const { mail } = createMail({ config: baseConfig })
    const config = mail.resolveConfig()
    expect(config.imapUsername).toBe('jon')
    expect(config.smtpUsername).toBe('jon@me.com')

    const { mail: overridden } = createMail({
      config: { ...baseConfig, imapUsername: 'jon@me.com', smtpUsername: 'other@me.com' },
    })
    const overriddenConfig = overridden.resolveConfig()
    expect(overriddenConfig.imapUsername).toBe('jon@me.com')
    expect(overriddenConfig.smtpUsername).toBe('other@me.com')

    // Every other preset logs in with the full address on both transports
    const { mail: gmail } = createMail({ config: { provider: 'gmail', address: 'jon@gmail.com' } })
    expect(gmail.resolveConfig().imapUsername).toBe('jon@gmail.com')
    expect(gmail.resolveConfig().smtpUsername).toBe('jon@gmail.com')
  })

  it('accepts an unknown provider only with explicit transport overrides', async () => {
    const { mail: noHosts } = createMail({ config: { provider: 'mystery', address: 'jon@mystery.dev' } })
    await expect(noHosts.checkInbox()).rejects.toThrow('no transport settings for provider "mystery"')

    const { mail: overridden } = createMail({
      config: {
        provider: 'mystery',
        address: 'jon@mystery.dev',
        trustedSenders: ['trusted@example.com'],
        imap: { host: 'imap.mystery.dev', port: 993, secure: true },
        smtp: { host: 'smtp.mystery.dev', port: 465, secure: true },
      },
    })
    const config = overridden.resolveConfig()
    expect(config.imap.host).toBe('imap.mystery.dev')
    // No preset means no username style — the full address is the fallback
    expect(config.imapUsername).toBe('jon@mystery.dev')
    expect((await overridden.verify()).config.ok).toBe(true)
  })

  it('fails clearly on missing config and missing secret without leaking the value', async () => {
    const { mail } = createMail({ config: { provider: 'icloud' } })
    await expect(mail.poll()).rejects.toThrow('pass address to')

    const { mail: noSecret } = createMail({ config: baseConfig, noSecret: true })
    const error = await noSecret.poll().catch(err => err)
    expect(error.message).toContain('MISSING_MAIL_PASSWORD')
    expect(error.message).not.toContain(PASSWORD)
  })

  it('start() fails closed when trustedSenders is empty', async () => {
    const { mail } = createMail({ config: { ...baseConfig, trustedSenders: [] } })
    await expect(mail.start()).rejects.toThrow('trustedSenders is empty')
  })
})

// ── Polling & cursor ──────────────────────────────────────────────────────────

describe('internetMail polling', () => {
  it('baselines on first run without emitting historical mail', async () => {
    const { mail } = createMail({
      config: baseConfig,
      store: { uidValidity: '1000', messages: [{ uid: 5, from: 'trusted@example.com', text: 'old' }] },
    })
    const emitted: any[] = []
    mail.on('message', m => emitted.push(m))

    const result = await mail.poll()
    expect(result.baselined).toBe(true)
    expect(emitted).toEqual([])
    expect(await mail.readCursor()).toEqual({
      account: 'jon@me.com', mailbox: 'INBOX', uidValidity: '1000', lastUid: 5,
    })
  })

  it('emits each later UID exactly once and survives restart', async () => {
    const harness = createMail({
      config: baseConfig,
      store: { uidValidity: '1000', messages: [{ uid: 5, from: 'trusted@example.com', text: 'old' }] },
    })
    const emitted: StandardMailMessage[] = []
    harness.mail.on('message', m => emitted.push(m))

    await harness.mail.poll() // baseline at 5
    harness.store.messages.push({ uid: 6, from: 'trusted@example.com', subject: 'hi', text: 'new mail', messageId: '<m6@me.com>' })
    const second = await harness.mail.poll()
    expect(second.emitted).toBe(1)
    expect(emitted[0].id).toBe('imap:INBOX:1000:6')
    expect(emitted[0].from).toBe('trusted@example.com')

    // Same UID again — nothing new
    const third = await harness.mail.poll()
    expect(third.emitted).toBe(0)

    // "Restart": a fresh instance reading the same cursor store off disk
    const { mail: restarted } = createMail({
      config: baseConfig,
      store: harness.store,
      cursorStore: harness.cursorStore,
    })

    harness.store.messages.push({ uid: 7, from: 'trusted@example.com', text: 'arrived while stopped' })
    const restartedEmitted: any[] = []
    restarted.on('message', m => restartedEmitted.push(m))
    const afterRestart = await restarted.poll()
    expect(afterRestart.emitted).toBe(1)
    expect(restartedEmitted[0].uid).toBe(7)
  })

  it('re-baselines without replay when uidValidity changes', async () => {
    const harness = createMail({
      config: baseConfig,
      store: { uidValidity: '1000', messages: [{ uid: 5, from: 'trusted@example.com' }] },
    })
    const logs: string[] = []
    harness.mail.on('log', m => logs.push(m))
    const emitted: any[] = []
    harness.mail.on('message', m => emitted.push(m))

    await harness.mail.poll()
    harness.store.uidValidity = '2000'
    harness.store.messages = [{ uid: 1, from: 'trusted@example.com', text: 'renumbered' }, { uid: 2, from: 'trusted@example.com', text: 'renumbered too' }]

    const result = await harness.mail.poll()
    expect(result.baselined).toBe(true)
    expect(emitted).toEqual([])
    expect(logs.some(l => l.includes('UIDVALIDITY changed'))).toBe(true)
    expect(await harness.mail.readCursor()).toMatchObject({ uidValidity: '2000', lastUid: 2 })
  })

  it('filters untrusted senders by exact parsed address without downloading source', async () => {
    const harness = createMail({
      config: baseConfig,
      store: { uidValidity: '1000', messages: [] },
    })
    const emitted: any[] = []
    harness.mail.on('message', m => emitted.push(m))
    await harness.mail.poll() // baseline at 0

    harness.store.messages.push(
      // Substring lookalike must NOT match the trusted list
      { uid: 1, from: 'evil-trusted@example.com.attacker.net', text: 'phish' },
      { uid: 2, from: 'nottrusted@example.com', text: 'nope' },
      { uid: 3, from: 'trusted@example.com', text: 'real' },
    )
    const result = await harness.mail.poll()
    expect(result.skippedUntrusted).toBe(2)
    expect(result.emitted).toBe(1)
    expect(emitted[0].uid).toBe(3)
  })

  it('skips oversized messages and quarantines malformed ones without blocking later UIDs', async () => {
    const harness = createMail({
      config: { ...baseConfig, maxMessageBytes: 1000 },
      store: { uidValidity: '1000', messages: [] },
    })
    const emitted: any[] = []
    harness.mail.on('message', m => emitted.push(m))
    await harness.mail.poll()

    harness.store.messages.push(
      { uid: 1, from: 'trusted@example.com', size: 5000, text: 'too big' },
      { uid: 2, from: 'trusted@example.com', malformed: true },
      { uid: 3, from: 'trusted@example.com', text: 'fine' },
    )
    const result = await harness.mail.poll()
    expect(result.skippedOversized).toBe(1)
    expect(result.quarantined).toBe(1)
    expect(result.emitted).toBe(1)
    expect(emitted[0].uid).toBe(3)
    // Cursor moved past the bad ones — nothing re-delivers
    expect((await harness.mail.poll()).emitted).toBe(0)
  })

  it('never writes \\Seen when markAsRead is false, writes it after dispatch when true', async () => {
    const offHarness = createMail({ config: baseConfig, store: { uidValidity: '1', messages: [] } })
    await offHarness.mail.poll()
    offHarness.store.messages.push({ uid: 1, from: 'trusted@example.com', text: 'x' })
    await offHarness.mail.poll()
    expect(offHarness.clients.flatMap(c => c.flagWrites)).toEqual([])

    const onHarness = createMail({ config: { ...baseConfig, markAsRead: true }, store: { uidValidity: '1', messages: [] } })
    await onHarness.mail.poll()
    onHarness.store.messages.push(
      { uid: 1, from: 'trusted@example.com', text: 'ok' },
      { uid: 2, from: 'trusted@example.com', malformed: true },
    )
    await onHarness.mail.poll()
    const writes = onHarness.clients.flatMap(c => c.flagWrites)
    // Only the successfully dispatched message gets \Seen — not the quarantined one
    expect(writes).toEqual([{ uid: '1', flags: ['\\Seen'] }])
  })

  it('releases the lock and logs out even when the poll fails', async () => {
    const harness = createMail({ config: baseConfig, store: { uidValidity: '1', messages: [] } })
    await harness.mail.poll()
    const client = new FakeImapClient(harness.store)
    client.search = async () => { throw new Error('boom') }
    ;(harness.mail as any).createImapClient = async () => client

    await expect(harness.mail.poll()).rejects.toThrow('boom')
    expect(client.lockReleased).toBe(true)
    expect(client.loggedOut).toBe(true)
  })
})

// ── Search ────────────────────────────────────────────────────────────────────

describe('internetMail search', () => {
  const messages: FakeMessage[] = [
    { uid: 1, from: 'alice@corp.com', subject: 'Invoice March', text: 'please pay', date: '2026-03-01' },
    { uid: 2, from: 'bob@corp.com', subject: 'lunch', text: 'tacos?', date: '2026-04-01' },
    { uid: 3, from: 'alice@other.net', subject: 'Invoice April', text: 'please pay again', date: '2026-05-01' },
  ]

  it('maps query fields to IMAP SEARCH keys, exact address vs bare domain', async () => {
    const harness = createMail({ config: baseConfig, store: { uidValidity: '1', messages: [...messages] } })

    await harness.mail.searchMessages({ from: 'alice@corp.com' })
    await harness.mail.searchMessages({ from: 'corp.com', subject: 'invoice', text: 'pay', since: '2026-01-01', before: '2026-06-01' })

    const [exact, combined] = harness.clients.map(c => c.searches[0])
    expect(exact).toEqual({ from: 'alice@corp.com' })
    expect(combined.from).toBe('@corp.com')
    expect(combined.subject).toBe('invoice')
    expect(combined.body).toBe('pay')
    expect(combined.since).toEqual(new Date('2026-01-01'))
    expect(combined.before).toEqual(new Date('2026-06-01'))
  })

  it('returns metadata summaries and never advances the cursor', async () => {
    const harness = createMail({ config: baseConfig, store: { uidValidity: '1', messages: [...messages] } })
    await harness.mail.poll() // baseline lastUid=3
    const before = await harness.mail.readCursor()

    const results = await harness.mail.searchMessages({ subject: 'invoice' })
    expect(results.map(r => r.uid).sort()).toEqual([1, 3])
    expect(results[0]).toHaveProperty('subject')
    expect(results[0]).not.toHaveProperty('text')

    expect(await harness.mail.readCursor()).toEqual(before)
    // Search never writes flags either
    expect(harness.clients.flatMap(c => c.flagWrites)).toEqual([])
  })

  it('requires at least one criterion', async () => {
    const harness = createMail({ config: baseConfig })
    await expect(harness.mail.searchMessages({})).rejects.toThrow('at least one criterion')
  })
})

// ── Outbound ──────────────────────────────────────────────────────────────────

describe('internetMail outbound', () => {
  const outboundConfig = {
    ...baseConfig,
    outboundEnabled: true,
    approvedRecipients: ['trusted@example.com', 'boss@example.com'],
  }

  it('fails closed while outboundEnabled is false', async () => {
    const harness = createMail({ config: baseConfig })
    await expect(
      harness.mail.sendMessage({ to: 'trusted@example.com', subject: 'x', text: 'y' }),
    ).rejects.toThrow('outbound mail is disabled')
    expect(harness.smtp.sent).toEqual([])
  })

  it('rejects unapproved To/CC recipients with exact case-insensitive matching', async () => {
    const harness = createMail({ config: outboundConfig })
    await expect(
      harness.mail.sendMessage({ to: 'stranger@example.com', subject: 'x', text: 'y' }),
    ).rejects.toThrow('not on approvedRecipients')
    await expect(
      harness.mail.sendMessage({ to: 'trusted@example.com', cc: 'stranger@example.com', subject: 'x', text: 'y' }),
    ).rejects.toThrow('stranger@example.com')

    const result = await harness.mail.sendMessage({ to: 'TRUSTED@Example.com', subject: 'x', text: 'y' })
    expect(result.accepted).toEqual(['trusted@example.com'])
    // From is always the configured address
    expect(harness.smtp.sent[0].from).toBe('jon@me.com')
  })

  it('surfaces SMTP-rejected recipients as failures', async () => {
    const harness = createMail({ config: outboundConfig })
    harness.smtp.rejectNext = ['trusted@example.com']
    await expect(
      harness.mail.sendMessage({ to: 'trusted@example.com', subject: 'x', text: 'y' }),
    ).rejects.toThrow('rejected trusted@example.com')
  })

  it('builds threaded replies with In-Reply-To, References, and a normalized subject', async () => {
    const harness = createMail({
      config: outboundConfig,
      store: {
        uidValidity: '1000',
        messages: [{
          uid: 9,
          from: 'trusted@example.com',
          to: ['jon@me.com'],
          subject: 'Question',
          text: 'hello?',
          messageId: '<orig@example.com>',
          references: ['<root@example.com>'],
        }],
      },
    })

    await harness.mail.replyToMessage({ id: 'imap:INBOX:1000:9', text: 'answer' })
    const sent = harness.smtp.sent[0]
    expect(sent.to).toEqual(['trusted@example.com'])
    expect(sent.subject).toBe('Re: Question')
    expect(sent.inReplyTo).toBe('<orig@example.com>')
    expect(sent.references).toBe('<root@example.com> <orig@example.com>')

    // An existing Re: is preserved, not doubled
    harness.store.messages[0].subject = 'Re: Question'
    await harness.mail.replyToMessage({ id: 'imap:INBOX:1000:9', text: 'again' })
    expect(harness.smtp.sent[1].subject).toBe('Re: Question')
  })

  it('reply-all expands To/Cc, drops unapproved addresses, and fails on an empty set', async () => {
    const harness = createMail({
      config: outboundConfig,
      store: {
        uidValidity: '1000',
        messages: [{
          uid: 9,
          from: 'trusted@example.com',
          to: ['jon@me.com', 'boss@example.com'],
          cc: ['outsider@evil.net'],
          subject: 'Thread',
          text: 'hi all',
          messageId: '<t@example.com>',
        }],
      },
    })

    const result = await harness.mail.replyAllToMessage({ id: 'imap:INBOX:1000:9', text: 'ack' })
    expect(result.accepted.sort()).toEqual(['boss@example.com', 'trusted@example.com'])
    expect(result.withheld).toEqual(['outsider@evil.net'])
    // Own address is excluded, not withheld
    expect(harness.smtp.sent[0].to).not.toContain('jon@me.com')

    harness.store.messages[0].from = 'outsider@evil.net'
    harness.store.messages[0].to = ['stranger@nowhere.org']
    harness.store.messages[0].cc = []
    await expect(
      harness.mail.replyAllToMessage({ id: 'imap:INBOX:1000:9', text: 'ack' }),
    ).rejects.toThrow('no approved recipients on this thread')
  })
})

// ── Validation scoring ────────────────────────────────────────────────────────

describe('validateMailHeaders', () => {
  it('scores full passes at 100 and deducts per the gmail wing rules', () => {
    const clean = validateMailHeaders({
      authenticationResults: 'mx.me.com; spf=pass; dkim=pass; dmarc=pass',
      from: 'Trusted <trusted@example.com>',
    })
    expect(clean.trustScore).toBe(100)
    expect(clean.flags).toEqual([])

    const sparse = validateMailHeaders({ from: 'someone@example.com' })
    expect(sparse.auth).toMatchObject({ spf: 'none', dkim: 'none', dmarc: 'none' })
    expect(sparse.trustScore).toBe(25)

    const spoofed = validateMailHeaders({
      authenticationResults: 'spf=pass; dkim=pass; dmarc=pass',
      from: '"boss@bank.com" <attacker@evil.net>',
      replyTo: 'other@elsewhere.org',
    })
    expect(spoofed.flags.some(f => f.startsWith('display-name-spoofing'))).toBe(true)
    expect(spoofed.flags.some(f => f.startsWith('reply-to-mismatch'))).toBe(true)
    expect(spoofed.trustScore).toBe(65)
  })

  it('parses names, addresses, and domains from address headers', () => {
    expect(parseMailAddress('Jon Soeder <jon@me.com>')).toEqual({ name: 'Jon Soeder', address: 'jon@me.com', domain: 'me.com' })
    expect(parseMailAddress('jon@me.com')).toEqual({ name: '', address: 'jon@me.com', domain: 'me.com' })
  })
})

// ── Verify & lifecycle ────────────────────────────────────────────────────────

describe('internetMail verify and lifecycle', () => {
  it('reports config, secret, IMAP, and SMTP verdicts independently', async () => {
    const good = createMail({ config: baseConfig, store: { uidValidity: '1', messages: [] } })
    const report = await good.mail.verify()
    expect(report.ok).toBe(true)
    expect(report.imap.ok).toBe(true)
    expect(report.smtp.ok).toBe(true)

    const badSmtp = createMail({ config: baseConfig, store: { uidValidity: '1', messages: [] } })
    badSmtp.smtp.verifyError = new Error('535 auth failed')
    const failed = await badSmtp.mail.verify()
    expect(failed.ok).toBe(false)
    expect(failed.imap.ok).toBe(true)
    expect(failed.smtp.ok).toBe(false)
    expect(failed.smtp.detail).toContain('535')

    // An empty allowlist blocks inbound but not outbound — verify says so
    // without calling the account broken
    const noTrust = createMail({ config: { ...baseConfig, trustedSenders: [] }, store: { uidValidity: '1', messages: [] } })
    const advisory = await noTrust.mail.verify()
    expect(advisory.config.ok).toBe(true)
    expect(advisory.config.detail).toContain('fails closed')
    expect(advisory.ok).toBe(true)
    await expect(noTrust.mail.start()).rejects.toThrow('trustedSenders is empty')
  })

  it('stop() clears polling, closes SMTP, and leaves the cursor intact', async () => {
    const harness = createMail({ config: outboundReadyConfig(), store: { uidValidity: '1', messages: [] } })
    await harness.mail.start()
    const cursorBefore = await harness.mail.readCursor()
    expect(cursorBefore).toBeTruthy()

    await harness.mail.sendMessage({ to: 'trusted@example.com', subject: 'x', text: 'y' }) // opens SMTP
    await harness.mail.stop()
    expect(harness.smtp.closed).toBe(true)
    expect(harness.mail.isStarted).toBe(false)
    expect(await harness.mail.readCursor()).toEqual(cursorBefore)
  })

  function outboundReadyConfig() {
    return { ...baseConfig, outboundEnabled: true, pollIntervalMs: 60_000 }
  }
})

// ── Real dependency wiring ────────────────────────────────────────────────────

/**
 * Everything above runs against fakes. This block builds the real imapflow and
 * nodemailer objects and parses real MIME — no network, but it fails loudly if
 * either library changes the API this feature calls.
 */
describe('internetMail real dependency wiring', () => {
  process.env.SMOKE_MAIL_PASSWORD = 'not-a-real-password'
  const mail = new InternetMail(
    { provider: 'icloud', address: 'jon@me.com', passwordEnv: 'SMOKE_MAIL_PASSWORD' } as any,
    { container } as any,
  )

  it('builds a real ImapFlow client from the preset', async () => {
    const client = await (mail as any).createImapClient(mail.resolveConfig())
    for (const method of ['connect', 'logout', 'getMailboxLock', 'search', 'fetch', 'fetchOne', 'messageFlagsAdd']) {
      expect(typeof client[method], method).toBe('function')
    }
  })

  it('builds a real nodemailer SMTP transport from the preset', async () => {
    const transport = await (mail as any).createSmtpTransport(mail.resolveConfig())
    expect(typeof transport.sendMail).toBe('function')
    expect(typeof transport.verify).toBe('function')
    expect(transport.options.host).toBe('smtp.mail.me.com')
    expect(transport.options.port).toBe(587)
    transport.close()
  })

  it('parses real RFC822 source with mailparser and normalizes it', async () => {
    const raw = [
      'From: Boss <boss@example.com>',
      'To: jon@me.com',
      'Subject: Real parse',
      'Message-ID: <abc@example.com>',
      'Authentication-Results: mx.me.com; spf=pass; dkim=pass; dmarc=pass',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'hello from a real MIME body',
      '',
    ].join('\r\n')
    const parsed = await (mail as any).parseSource(Buffer.from(raw))
    const message = (mail as any)._normalizeParsed(mail.resolveConfig(), '42', 7, parsed)
    expect(message.id).toBe('imap:INBOX:42:7')
    expect(message.from).toBe('boss@example.com')
    expect(message.subject).toBe('Real parse')
    expect(message.text.trim()).toBe('hello from a real MIME body')
    expect(message.rfcMessageId).toBe('<abc@example.com>')
    expect(message.validation.trustScore).toBe(100)
  })
})
