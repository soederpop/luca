import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { ContainerContext } from '../../container.js'

/** Connection settings for one transport. */
export interface MailTransportConfig {
  host: string
  port: number
  secure: boolean
  requireTLS?: boolean
}

/**
 * How a provider derives its login from the account address. iCloud wants the
 * local part for IMAP but the full address for SMTP; everyone else takes the
 * full address for both.
 */
export type MailUsernameStyle = 'address' | 'local-part'

export interface MailProviderPreset {
  imap: MailTransportConfig
  smtp: MailTransportConfig
  /** Login style per transport, applied when no explicit username is given. */
  usernames: { imap: MailUsernameStyle; smtp: MailUsernameStyle }
}

/**
 * Host/port presets for the common standards-based providers. Anything not
 * listed here works through explicit `imap:` / `smtp:` option overrides.
 *
 * Most of these require an app-specific password rather than the account
 * password — Google and Apple both refuse plain passwords over IMAP.
 */
export const MAIL_PROVIDER_PRESETS: Record<string, MailProviderPreset> = {
  icloud: {
    imap: { host: 'imap.mail.me.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.me.com', port: 587, secure: false, requireTLS: true },
    // iCloud's IMAP login is the local part alone, even for legacy @me.com
    usernames: { imap: 'local-part', smtp: 'address' },
  },
  gmail: {
    imap: { host: 'imap.gmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.gmail.com', port: 587, secure: false, requireTLS: true },
    usernames: { imap: 'address', smtp: 'address' },
  },
  fastmail: {
    imap: { host: 'imap.fastmail.com', port: 993, secure: true },
    smtp: { host: 'smtp.fastmail.com', port: 465, secure: true },
    usernames: { imap: 'address', smtp: 'address' },
  },
  outlook: {
    imap: { host: 'outlook.office365.com', port: 993, secure: true },
    smtp: { host: 'smtp.office365.com', port: 587, secure: false, requireTLS: true },
    usernames: { imap: 'address', smtp: 'address' },
  },
  yahoo: {
    imap: { host: 'imap.mail.yahoo.com', port: 993, secure: true },
    smtp: { host: 'smtp.mail.yahoo.com', port: 465, secure: true },
    usernames: { imap: 'address', smtp: 'address' },
  },
}

export interface ResolvedMailConfig {
  provider: string
  address: string
  imapUsername: string
  smtpUsername: string
  passwordEnv: string
  mailbox: string
  pollIntervalMs: number
  maxMessageBytes: number
  markAsRead: boolean
  outboundEnabled: boolean
  trustedSenders: string[]
  approvedRecipients: string[]
  imap: MailTransportConfig
  smtp: MailTransportConfig
}

export interface MailVerification {
  ok: boolean
  config: { ok: boolean; detail: string }
  secret: { ok: boolean; detail: string }
  imap: { ok: boolean; detail: string }
  smtp: { ok: boolean; detail: string }
}

export interface MailSummary {
  id: string
  uid: number
  uidValidity: string
  from: string
  to: string[]
  subject: string
  date?: string
  size?: number
  seen?: boolean
}

export interface StandardMailMessage {
  id: string
  uid: number
  uidValidity: string
  rfcMessageId?: string
  inReplyTo?: string
  references: string[]
  from: string
  to: string[]
  cc: string[]
  subject: string
  text: string
  html?: string
  date?: string
  authenticationResults?: string
  attachments: Array<{ filename?: string; contentType: string; size?: number }>
  validation?: MailValidation
}

export interface MailValidation {
  auth: { spf: string; dkim: string; dmarc: string; raw: string }
  flags: string[]
  trustScore: number
}

export interface MailPollResult {
  polled: boolean
  baselined: boolean
  emitted: number
  skippedUntrusted: number
  skippedOversized: number
  quarantined: number
  lastUid: number
}

export interface MailSearchQuery {
  from?: string
  to?: string
  subject?: string
  text?: string
  since?: string
  before?: string
}

export interface MailSendInput {
  to: string | string[]
  cc?: string | string[]
  subject: string
  text: string
  html?: string
}

export interface MailReplyInput {
  id: string
  text: string
  html?: string
}

export interface MailSendResult {
  messageId: string
  accepted: string[]
  rejected: string[]
}

interface MailCursor {
  account: string
  mailbox: string
  uidValidity: string
  lastUid: number
}

/** Extract a verdict for one mechanism from an Authentication-Results header. */
export function extractAuthVerdict(authResults: string, mechanism: string): string {
  const match = authResults.match(new RegExp(`${mechanism}=([a-zA-Z]+)`, 'i'))
  return match ? match[1]!.toLowerCase() : 'none'
}

/** Parse "Name <email>" (or a bare address) into its parts. */
export function parseMailAddress(raw: string): { name: string; address: string; domain: string } {
  const value = String(raw || '').trim()
  // \s+ (not \s*) after the display name — with \s* the engine prefers eating
  // the first character of a bare address as a one-letter "name"
  const match = value.match(/^(?:"?([^"<]*?)"?\s+)?<?([^\s>]+@([^\s>]+))>?$/)
  if (!match) return { name: '', address: value, domain: '' }
  return { name: (match[1] || '').trim(), address: match[2]!, domain: match[3]!.toLowerCase() }
}

/**
 * Port of the Gmail wing's Authentication-Results scoring: same verdict
 * extraction, same flags, same deductions. Provider headers may leave verdicts
 * sparse (iCloud often does) — the score reflects what the edge populated.
 */
export function validateMailHeaders(headers: {
  authenticationResults?: string
  from?: string
  replyTo?: string
  returnPath?: string
}): MailValidation {
  const authRaw = headers.authenticationResults || ''
  const auth = {
    spf: extractAuthVerdict(authRaw, 'spf'),
    dkim: extractAuthVerdict(authRaw, 'dkim'),
    dmarc: extractAuthVerdict(authRaw, 'dmarc'),
    raw: authRaw,
  }

  const from = parseMailAddress(headers.from || '')
  const replyTo = headers.replyTo ? parseMailAddress(headers.replyTo) : null
  const returnPath = headers.returnPath ? parseMailAddress(headers.returnPath) : null

  const flags: string[] = []
  if (auth.spf !== 'pass') flags.push(`spf-${auth.spf}`)
  if (auth.dkim !== 'pass') flags.push(`dkim-${auth.dkim}`)
  if (auth.dmarc !== 'pass') flags.push(`dmarc-${auth.dmarc}`)
  if (replyTo && replyTo.domain && replyTo.domain !== from.domain) {
    flags.push(`reply-to-mismatch: ${replyTo.address} vs ${from.domain}`)
  }
  if (returnPath && returnPath.domain && returnPath.domain !== from.domain) {
    flags.push(`return-path-mismatch: ${returnPath.address} vs ${from.domain}`)
  }
  if (from.name) {
    const embeddedEmail = from.name.match(/[\w.+-]+@[\w.-]+/)
    if (embeddedEmail) {
      const embeddedDomain = embeddedEmail[0].split('@')[1]?.toLowerCase()
      if (embeddedDomain && embeddedDomain !== from.domain) {
        flags.push(`display-name-spoofing: name contains ${embeddedEmail[0]}`)
      }
    }
  }

  let trustScore = 100
  if (auth.spf !== 'pass') trustScore -= 25
  if (auth.dkim !== 'pass') trustScore -= 25
  if (auth.dmarc !== 'pass') trustScore -= 25
  if (replyTo && replyTo.domain && replyTo.domain !== from.domain) trustScore -= 15
  if (returnPath && returnPath.domain && returnPath.domain !== from.domain) trustScore -= 10
  if (flags.some(f => f.startsWith('display-name-spoofing'))) trustScore -= 20
  trustScore = Math.max(0, trustScore)

  return { auth, flags, trustScore }
}

const TransportOverrideSchema = z.object({
  host: z.string().describe('Hostname of the mail server'),
  port: z.number().describe('Port to connect on'),
  secure: z.boolean().describe('true for implicit TLS (993/465), false to upgrade with STARTTLS'),
  requireTLS: z.boolean().optional().describe('Refuse to continue if STARTTLS is unavailable'),
})

export const InternetMailStateSchema = FeatureStateSchema.extend({
  started: z.boolean().default(false),
  polling: z.boolean().default(false),
  lastPollAt: z.string().nullable().default(null),
  emittedCount: z.number().default(0),
})
export type InternetMailState = z.infer<typeof InternetMailStateSchema>

export const InternetMailOptionsSchema = FeatureOptionsSchema.extend({
  provider: z.string().optional().describe(`Provider preset id: ${Object.keys(MAIL_PROVIDER_PRESETS).join(', ')}. Any other value needs explicit imap/smtp overrides`),
  address: z.string().optional().describe('The mailbox address; always used as the SMTP From'),
  imapUsername: z.string().optional().describe("IMAP login; defaults to the preset's username style"),
  smtpUsername: z.string().optional().describe("SMTP login; defaults to the preset's username style"),
  passwordEnv: z.string().optional().describe('Name of the env var holding the (app-specific) password'),
  password: z.string().optional().describe('The password itself, for callers that already hold the secret. Prefer passwordEnv'),
  mailbox: z.string().optional().describe('Mailbox to poll (default INBOX)'),
  pollIntervalMs: z.number().optional().describe('Poll interval in milliseconds (default 45000)'),
  maxMessageBytes: z.number().optional().describe('Skip messages larger than this (default 5 MiB)'),
  markAsRead: z.boolean().optional().describe('Add \\Seen after successful dispatch (default false)'),
  outboundEnabled: z.boolean().optional().describe('Master switch for all sends and replies (default false)'),
  trustedSenders: z.array(z.string()).optional().describe('Exact addresses whose inbound mail is emitted by poll()'),
  approvedRecipients: z.array(z.string()).optional().describe('Addresses outbound mail may be sent to'),
  cursorStore: z.string().optional().describe('Store name holding the poll cursor (default "internet-mail")'),
  cursorScope: z.enum(['project', 'machine', 'tmp']).optional().describe("Store scope for the cursor (default 'project')"),
  imap: TransportOverrideSchema.optional().describe('Explicit IMAP transport override'),
  smtp: TransportOverrideSchema.optional().describe('Explicit SMTP transport override'),
})
export type InternetMailOptions = z.infer<typeof InternetMailOptionsSchema>

export const InternetMailEventsSchema = FeatureEventsSchema.extend({
  message: z.tuple([z.custom<StandardMailMessage>()]).describe('One new message from a trusted sender, normalized. Emitted by poll()'),
  log: z.tuple([z.string()]).describe('Operational detail — baselining, skips, sends. Never contains the password'),
  'poll:error': z.tuple([z.custom<{ stage: string; uid?: number; message: string }>()]).describe('Recoverable poll failure, tagged with the stage it happened in'),
  started: z.tuple([]).describe('Emitted after start() arms the poll interval'),
  stopped: z.tuple([]).describe('Emitted after stop() clears the interval and closes SMTP'),
})

/**
 * Internet Mail Feature — standards-based email over IMAP and SMTP
 *
 * Any mailbox that speaks IMAP and SMTP, with host/port presets for iCloud,
 * Gmail, Fastmail, Outlook, and Yahoo. This is the protocol-level counterpart
 * to `googleMail`: no vendor API, no OAuth, just a username and an
 * (app-specific) password.
 *
 * **Configure it at construction** — the feature reads no config files:
 * ```ts
 * const mail = container.feature('internetMail', {
 *   provider: 'icloud',
 *   address: 'you@me.com',
 *   passwordEnv: 'ICLOUD_MAIL_APP_PASSWORD',
 *   trustedSenders: ['boss@example.com'],
 * })
 * ```
 *
 * **What it gives you:**
 * - `verify()` — config, secret, IMAP login, and SMTP login diagnostics, each
 *   as an independent verdict so a failure names the thing that failed
 * - `poll()` / `start()` / `stop()` — cursor-based inbound polling that emits
 *   one `message` event per new `StandardMailMessage` from a trusted sender.
 *   The cursor lives in `container.store()`, so a restart resumes rather than
 *   replaying, and a `UIDVALIDITY` change re-baselines instead of duplicating
 * - `checkInbox()` / `readMessage()` / `searchMessages()` — pull-based reads
 *   that never advance the poll cursor or alter unread state
 * - `sendMessage()` / `replyToMessage()` / `replyAllToMessage()` — outbound
 *   mail gated by `outboundEnabled` and the recipient allowlist
 *
 * **It fails closed on purpose.** Inbound needs a non-empty `trustedSenders`
 * list, outbound needs `outboundEnabled` plus an allowlisted recipient, and
 * the From is always the configured address. Mail is untrusted input: every
 * message carries a `validation` block scoring SPF/DKIM/DMARC and flagging
 * display-name spoofing and Reply-To mismatches.
 *
 * @example
 * ```typescript
 * const mail = container.feature('internetMail')
 * const report = await mail.verify()
 * const recent = await mail.checkInbox({ limit: 5 })
 * const hits = await mail.searchMessages({ from: 'example.com', text: 'invoice' })
 * ```
 *
 * @extends Feature
 */
export class InternetMail extends Feature<InternetMailState, InternetMailOptions> {
  static override shortcut = 'features.internetMail' as const
  static override stability = 'experimental' as const
  static override category = 'networking' as const
  static override stateSchema = InternetMailStateSchema
  static override optionsSchema = InternetMailOptionsSchema
  static override eventsSchema = InternetMailEventsSchema
  static override description = 'Standards-based IMAP/SMTP email with presets for the common providers'
  static { Feature.register(this, 'internetMail') }

  private _pollTimer: ReturnType<typeof setInterval> | null = null
  private _activePoll: Promise<MailPollResult> | null = null
  private _smtpTransport: any = null

  constructor(options: InternetMailOptions, context: ContainerContext) {
    super(options, context)
    this.hide('_pollTimer')
    this.hide('_activePoll')
    this.hide('_smtpTransport')
  }

  // ── Configuration ──────────────────────────────────────────────────────────

  /**
   * Apply the provider preset and its username style to the feature options.
   *
   * Never throws, so callers can inspect a half-configured account (that's
   * what `verify()` reports on); `requireConfig()` enforces the required
   * fields at the point of use. The password is deliberately absent from the
   * result — it is read only inside {@link readPassword}.
   */
  resolveConfig(): ResolvedMailConfig {
    const opts = this.options as Record<string, any>
    const pick = <T>(key: string, fallback: T): T =>
      (opts[key] !== undefined ? opts[key] : fallback) as T

    const provider = String(pick('provider', ''))
    const address = String(pick('address', ''))
    const preset = MAIL_PROVIDER_PRESETS[provider]
    const localPart = address.includes('@') ? address.split('@')[0] : address
    const login = (style: MailUsernameStyle | undefined) => (style === 'local-part' ? localPart : address)

    return {
      provider,
      address,
      imapUsername: String(pick('imapUsername', login(preset?.usernames.imap))),
      smtpUsername: String(pick('smtpUsername', login(preset?.usernames.smtp))),
      passwordEnv: String(pick('passwordEnv', '')),
      mailbox: String(pick('mailbox', 'INBOX')),
      pollIntervalMs: Number(pick('pollIntervalMs', 45_000)),
      maxMessageBytes: Number(pick('maxMessageBytes', 5_242_880)),
      markAsRead: Boolean(pick('markAsRead', false)),
      outboundEnabled: Boolean(pick('outboundEnabled', false)),
      trustedSenders: (pick<string[]>('trustedSenders', []) || []).map(s => String(s).toLowerCase().trim()).filter(Boolean),
      approvedRecipients: (pick<string[]>('approvedRecipients', []) || []).map(s => String(s).toLowerCase().trim()).filter(Boolean),
      imap: pick('imap', preset?.imap as any) as MailTransportConfig,
      smtp: pick('smtp', preset?.smtp as any) as MailTransportConfig,
    }
  }

  private requireConfig(): ResolvedMailConfig {
    const config = this.resolveConfig()
    const opts = this.options as Record<string, any>
    const missing: string[] = []
    if (!config.address) missing.push('address')
    if (!config.passwordEnv && !opts.password) missing.push('passwordEnv')
    if (missing.length) {
      throw new Error(`internetMail is not configured — pass ${missing.join(' and ')} to container.feature('internetMail', { ... })`)
    }
    if (!config.imap || !config.smtp) {
      const known = Object.keys(MAIL_PROVIDER_PRESETS).join(', ')
      throw new Error(`internetMail: no transport settings for provider "${config.provider}". Use one of the presets (${known}) or pass explicit imap and smtp options.`)
    }
    return config
  }

  /** Read the password. Names where it should come from, never prints the value. */
  private readPassword(config: ResolvedMailConfig): string {
    const opts = this.options as Record<string, any>
    const value = opts.password || (config.passwordEnv ? process.env[config.passwordEnv] : undefined)
    if (!value) {
      throw new Error(`internetMail: the ${config.passwordEnv} environment variable is not set. Most providers need an app-specific password here, not the account password.`)
    }
    return String(value)
  }

  // ── Client factories (overridable in tests) ────────────────────────────────

  /** Build a connected-ready ImapFlow client. Tests override this with a fake. */
  protected async createImapClient(config: ResolvedMailConfig): Promise<any> {
    const { ImapFlow } = await import('imapflow')
    return new ImapFlow({
      host: config.imap.host,
      port: config.imap.port,
      secure: config.imap.secure,
      auth: { user: config.imapUsername, pass: this.readPassword(config) },
      logger: false,
    })
  }

  /** Build a Nodemailer SMTP transport. Tests override this with a fake. */
  protected async createSmtpTransport(config: ResolvedMailConfig): Promise<any> {
    const nodemailer = await import('nodemailer')
    return (nodemailer.default || nodemailer).createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      requireTLS: config.smtp.requireTLS,
      auth: { user: config.smtpUsername, pass: this.readPassword(config) },
    })
  }

  /** Parse raw RFC 822 source. Tests override this to avoid mailparser. */
  protected async parseSource(source: Buffer | string): Promise<any> {
    const { simpleParser } = await import('mailparser')
    return simpleParser(source)
  }

  private async getSmtpTransport(config: ResolvedMailConfig): Promise<any> {
    if (!this._smtpTransport) this._smtpTransport = await this.createSmtpTransport(config)
    return this._smtpTransport
  }

  // ── Cursor persistence ─────────────────────────────────────────────────────

  /**
   * The store holding the poll cursor. A durable JSON document rather than
   * in-process state: two processes polling the same mailbox must agree on
   * what has already been delivered, and a restart has to resume rather
   * than replay.
   */
  get cursorStore(): any {
    const opts = this.options as any
    const name = opts.cursorStore || 'internet-mail'
    return this.container.store(name, { initial: { cursor: null }, scope: opts.cursorScope || 'project' })
  }

  /** The persisted cursor, or null before the first baseline. */
  async readCursor(): Promise<MailCursor | null> {
    const state = await this.cursorStore.read().catch(() => null)
    const cursor = state?.cursor
    if (typeof cursor?.lastUid !== 'number') return null
    return cursor as MailCursor
  }

  private async writeCursor(cursor: MailCursor): Promise<void> {
    await this.cursorStore.update((draft: any) => { draft.cursor = cursor })
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  get isStarted() {
    return !!this.state.get('started')
  }

  /**
   * Check the configuration, secret, IMAP login, and SMTP login independently.
   * Never throws — every failure becomes a structured verdict.
   */
  async verify(): Promise<MailVerification> {
    const result: MailVerification = {
      ok: false,
      config: { ok: false, detail: '' },
      secret: { ok: false, detail: '' },
      imap: { ok: false, detail: 'not attempted' },
      smtp: { ok: false, detail: 'not attempted' },
    }

    let config: ResolvedMailConfig
    try {
      config = this.requireConfig()
      const account = `${config.provider || 'custom'} ${config.address} (${config.mailbox})`
      // An empty allowlist is not a broken account — it only means inbound
      // polling will refuse to start. Outbound-only setups verify fine.
      result.config = {
        ok: true,
        detail: config.trustedSenders.length
          ? account
          : `${account} — trustedSenders is empty, so inbound polling fails closed and start() will refuse`,
      }
    } catch (err: any) {
      result.config = { ok: false, detail: err.message }
      return result
    }

    try {
      this.readPassword(config)
      result.secret = { ok: true, detail: `${config.passwordEnv} is set` }
    } catch (err: any) {
      result.secret = { ok: false, detail: err.message }
      return result
    }

    try {
      const client = await this.createImapClient(config)
      await client.connect()
      await client.logout()
      result.imap = { ok: true, detail: `${config.imap.host}:${config.imap.port} login ok as ${config.imapUsername}` }
    } catch (err: any) {
      result.imap = { ok: false, detail: `${config.imap.host}:${config.imap.port} — ${err.message}` }
    }

    try {
      const transport = await this.createSmtpTransport(config)
      await transport.verify()
      if (typeof transport.close === 'function') transport.close()
      result.smtp = { ok: true, detail: `${config.smtp.host}:${config.smtp.port} login ok as ${config.smtpUsername}` }
    } catch (err: any) {
      result.smtp = { ok: false, detail: `${config.smtp.host}:${config.smtp.port} — ${err.message}` }
    }

    result.ok = result.config.ok && result.secret.ok && result.imap.ok && result.smtp.ok
    return result
  }

  /** Validate config, then poll immediately and on the configured interval. */
  async start(): Promise<this> {
    if (this.isStarted) return this

    const config = this.requireConfig()
    this.readPassword(config)
    if (config.trustedSenders.length === 0) {
      throw new Error('internetMail: trustedSenders is empty. Email trust fails closed — pass at least one address to poll inbound mail.')
    }

    this.state.set('started', true)
    this.emit('log', `polling ${config.mailbox} on ${config.imap.host} every ${Math.round(config.pollIntervalMs / 1000)}s (${config.trustedSenders.length} trusted sender(s))`)

    await this.poll().catch(() => {})
    this._pollTimer = setInterval(() => { void this.poll().catch(() => {}) }, config.pollIntervalMs)
    this.emit('started')
    return this
  }

  /** Clear the interval, wait for an active poll, close SMTP. Cursor stays. */
  async stop(): Promise<this> {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
    if (this._activePoll) await this._activePoll.catch(() => {})
    if (this._smtpTransport && typeof this._smtpTransport.close === 'function') {
      this._smtpTransport.close()
    }
    this._smtpTransport = null
    this.state.set('started', false)
    this.emit('stopped')
    return this
  }

  // ── Inbound polling ────────────────────────────────────────────────────────

  /**
   * One poll pass: baseline or advance the UID cursor, emit each new trusted
   * message once. Overlapping calls coalesce onto the in-flight pass.
   */
  async poll(): Promise<MailPollResult> {
    if (this._activePoll) return this._activePoll
    this._activePoll = this._pollOnce().finally(() => { this._activePoll = null })
    return this._activePoll
  }

  private async _pollOnce(): Promise<MailPollResult> {
    const config = this.requireConfig()
    this.readPassword(config)
    const result: MailPollResult = {
      polled: false, baselined: false, emitted: 0,
      skippedUntrusted: 0, skippedOversized: 0, quarantined: 0, lastUid: 0,
    }

    let client: any
    try {
      client = await this.createImapClient(config)
      await client.connect()
    } catch (err: any) {
      this.emit('poll:error', { stage: 'connect', message: err.message })
      throw err
    }

    const lock = await client.getMailboxLock(config.mailbox)
    try {
      const uidValidity = String(client.mailbox.uidValidity)
      const currentMaxUid = Math.max(0, Number(client.mailbox.uidNext || 1) - 1)
      const cursor = await this.readCursor()

      const cursorMatches = cursor
        && cursor.account === config.address
        && cursor.mailbox === config.mailbox
        && cursor.uidValidity === uidValidity

      if (!cursorMatches) {
        if (cursor && cursor.account === config.address && cursor.mailbox === config.mailbox) {
          // uidValidity changed — UIDs were reassigned; replaying would duplicate.
          this.emit('log', `UIDVALIDITY changed for ${config.mailbox} (${cursor.uidValidity} → ${uidValidity}) — re-baselining at uid ${currentMaxUid}, historical mail is NOT replayed`)
        } else {
          this.emit('log', `first connection to ${config.mailbox} — baselining at uid ${currentMaxUid}, historical mail is not emitted`)
        }
        await this.writeCursor({ account: config.address, mailbox: config.mailbox, uidValidity, lastUid: currentMaxUid })
        result.polled = true
        result.baselined = true
        result.lastUid = currentMaxUid
        this.state.set('lastPollAt', new Date().toISOString())
        return result
      }

      let lastUid = cursor!.lastUid
      const advance = async (uid: number) => {
        lastUid = uid
        await this.writeCursor({ account: config.address, mailbox: config.mailbox, uidValidity, lastUid })
      }

      // Not UNSEEN — reading mail in another client must not hide it from the loop.
      const uids: number[] = ((await client.search({ uid: `${lastUid + 1}:*` }, { uid: true })) || [])
        .map((u: any) => Number(u))
        .filter((u: number) => u > lastUid)
        .sort((a: number, b: number) => a - b)

      for (const uid of uids) {
        let meta: any
        try {
          meta = await client.fetchOne(String(uid), { envelope: true, size: true }, { uid: true })
        } catch (err: any) {
          this.emit('log', `uid ${uid}: metadata fetch failed (${err.message}) — quarantined`)
          result.quarantined += 1
          await advance(uid)
          continue
        }

        const fromAddress = String(meta?.envelope?.from?.[0]?.address || '').toLowerCase().trim()
        if (!fromAddress || !config.trustedSenders.includes(fromAddress)) {
          result.skippedUntrusted += 1
          await advance(uid)
          continue
        }

        const size = Number(meta?.size || 0)
        if (size > config.maxMessageBytes) {
          this.emit('log', `uid ${uid} from ${fromAddress}: ${size} bytes exceeds maxMessageBytes (${config.maxMessageBytes}) — skipped`)
          result.skippedOversized += 1
          await advance(uid)
          continue
        }

        try {
          const message = await this._fetchAndNormalize(client, config, uidValidity, uid)
          this.emit('message', message)
          result.emitted += 1
          this.state.set('emittedCount', (this.state.get('emittedCount') || 0) + 1)
          if (config.markAsRead) {
            await client.messageFlagsAdd(String(uid), ['\\Seen'], { uid: true })
          }
        } catch (err: any) {
          this.emit('log', `uid ${uid} from ${fromAddress}: parse/dispatch failed (${err.message}) — quarantined`)
          this.emit('poll:error', { stage: 'message', uid, message: err.message })
          result.quarantined += 1
        }
        await advance(uid)
      }

      result.polled = true
      result.lastUid = lastUid
      this.state.set('lastPollAt', new Date().toISOString())
      return result
    } catch (err: any) {
      this.emit('poll:error', { stage: 'poll', message: err.message })
      throw err
    } finally {
      try { lock.release() } catch {}
      try { await client.logout() } catch {}
    }
  }

  /** Fetch full source for one UID and normalize it. Rejects oversized source. */
  private async _fetchAndNormalize(client: any, config: ResolvedMailConfig, uidValidity: string, uid: number): Promise<StandardMailMessage> {
    const full = await client.fetchOne(String(uid), { source: true, flags: true }, { uid: true })
    const source: Buffer = full?.source
    if (!source) throw new Error('no source returned')
    if (source.length > config.maxMessageBytes) {
      throw new Error(`source is ${source.length} bytes, over maxMessageBytes (${config.maxMessageBytes})`)
    }
    const parsed = await this.parseSource(source)
    return this._normalizeParsed(config, uidValidity, uid, parsed)
  }

  private _normalizeParsed(config: ResolvedMailConfig, uidValidity: string, uid: number, parsed: any): StandardMailMessage {
    const addressList = (value: any): string[] => {
      const entries = value?.value || (Array.isArray(value) ? value : [])
      return entries.map((entry: any) => String(entry?.address || '').toLowerCase()).filter(Boolean)
    }
    const authRaw = typeof parsed?.headers?.get === 'function'
      ? String(parsed.headers.get('authentication-results') || '')
      : ''
    const replyToRaw = addressList(parsed?.replyTo)[0]
    const returnPathRaw = typeof parsed?.headers?.get === 'function'
      ? String(parsed.headers.get('return-path') || '')
      : ''
    const fromEntry = parsed?.from?.value?.[0] || {}
    const from = String(fromEntry.address || '').toLowerCase()

    const validation = validateMailHeaders({
      authenticationResults: authRaw,
      from: fromEntry.name ? `${fromEntry.name} <${from}>` : from,
      replyTo: replyToRaw,
      returnPath: returnPathRaw.replace(/[<>]/g, ''),
    })

    return {
      id: `imap:${config.mailbox}:${uidValidity}:${uid}`,
      uid,
      uidValidity,
      rfcMessageId: parsed?.messageId || undefined,
      inReplyTo: parsed?.inReplyTo || undefined,
      references: Array.isArray(parsed?.references)
        ? parsed.references
        : parsed?.references ? [parsed.references] : [],
      from,
      to: addressList(parsed?.to),
      cc: addressList(parsed?.cc),
      subject: String(parsed?.subject || ''),
      text: String(parsed?.text || ''),
      html: typeof parsed?.html === 'string' ? parsed.html : undefined,
      date: parsed?.date ? new Date(parsed.date).toISOString() : undefined,
      authenticationResults: authRaw || undefined,
      // Metadata only — attachment bodies never enter the prompt in this slice.
      attachments: (parsed?.attachments || []).map((a: any) => ({
        filename: a?.filename || undefined,
        contentType: String(a?.contentType || 'application/octet-stream'),
        size: a?.size != null ? Number(a.size) : undefined,
      })),
      validation,
    }
  }

  // ── Pull-based reads ───────────────────────────────────────────────────────

  private parseMessageId(id: string): { mailbox: string; uidValidity: string; uid: number } {
    const match = String(id || '').match(/^imap:(.+):(\d+):(\d+)$/)
    if (!match) throw new Error(`internetMail: "${id}" is not an internet-mail message id (expected imap:<mailbox>:<uidValidity>:<uid>)`)
    return { mailbox: match[1]!, uidValidity: match[2]!, uid: Number(match[3]) }
  }

  private async withMailbox<T>(mailbox: string, work: (client: any) => Promise<T>): Promise<T> {
    const config = this.requireConfig()
    const client = await this.createImapClient(config)
    await client.connect()
    const lock = await client.getMailboxLock(mailbox || config.mailbox)
    try {
      return await work(client)
    } finally {
      try { lock.release() } catch {}
      try { await client.logout() } catch {}
    }
  }

  private summaryFromMeta(config: ResolvedMailConfig, uidValidity: string, meta: any): MailSummary {
    const uid = Number(meta?.uid)
    const envelope = meta?.envelope || {}
    return {
      id: `imap:${config.mailbox}:${uidValidity}:${uid}`,
      uid,
      uidValidity,
      from: String(envelope?.from?.[0]?.address || '').toLowerCase(),
      to: (envelope?.to || []).map((e: any) => String(e?.address || '').toLowerCase()).filter(Boolean),
      subject: String(envelope?.subject || ''),
      date: envelope?.date ? new Date(envelope.date).toISOString() : undefined,
      size: meta?.size != null ? Number(meta.size) : undefined,
      seen: Array.isArray(meta?.flags) ? meta.flags.includes('\\Seen') : meta?.flags?.has?.('\\Seen'),
    }
  }

  /** The most recent messages in the configured mailbox, metadata only. */
  async checkInbox(options: { limit?: number } = {}): Promise<MailSummary[]> {
    const config = this.requireConfig()
    const limit = options.limit ?? 10
    return this.withMailbox(config.mailbox, async client => {
      const uidValidity = String(client.mailbox.uidValidity)
      const maxUid = Math.max(0, Number(client.mailbox.uidNext || 1) - 1)
      if (maxUid === 0) return []
      const lowUid = Math.max(1, maxUid - limit * 4)
      const summaries: MailSummary[] = []
      for await (const meta of client.fetch(`${lowUid}:*`, { envelope: true, size: true, flags: true, uid: true }, { uid: true })) {
        summaries.push(this.summaryFromMeta(config, uidValidity, meta))
      }
      return summaries.sort((a, b) => b.uid - a.uid).slice(0, limit)
    })
  }

  /** Read one full message by opaque id. Never alters unread state. */
  async readMessage(id: string): Promise<StandardMailMessage> {
    const config = this.requireConfig()
    const { mailbox, uid } = this.parseMessageId(id)
    return this.withMailbox(mailbox, async client => {
      const uidValidity = String(client.mailbox.uidValidity)
      return this._fetchAndNormalize(client, config, uidValidity, uid)
    })
  }

  /**
   * Interrogate the full archive with IMAP SEARCH. Independent of the poll
   * cursor — never advances `lastUid`, never alters unread state. A `from`/`to`
   * value without an `@` is treated as a bare domain and matched as `@domain`.
   */
  async searchMessages(query: MailSearchQuery, options: { limit?: number } = {}): Promise<MailSummary[]> {
    const config = this.requireConfig()
    const limit = options.limit ?? 25

    const search: Record<string, any> = {}
    if (query.from) search.from = query.from.includes('@') ? query.from : `@${query.from}`
    if (query.to) search.to = query.to.includes('@') ? query.to : `@${query.to}`
    if (query.subject) search.subject = query.subject
    if (query.text) search.body = query.text
    if (query.since) search.since = new Date(query.since)
    if (query.before) search.before = new Date(query.before)
    if (!Object.keys(search).length) {
      throw new Error('internetMail.searchMessages needs at least one criterion (from, to, subject, text, since, before)')
    }

    return this.withMailbox(config.mailbox, async client => {
      const uidValidity = String(client.mailbox.uidValidity)
      const uids: number[] = ((await client.search(search, { uid: true })) || [])
        .map((u: any) => Number(u))
        .sort((a: number, b: number) => b - a)
        .slice(0, limit)
      if (!uids.length) return []

      const summaries: MailSummary[] = []
      for (const uid of uids) {
        const meta = await client.fetchOne(String(uid), { envelope: true, size: true, flags: true }, { uid: true })
        if (meta) summaries.push(this.summaryFromMeta(config, uidValidity, { ...meta, uid }))
      }
      return summaries
    })
  }

  // ── Outbound ───────────────────────────────────────────────────────────────

  private assertOutboundEnabled(config: ResolvedMailConfig) {
    if (!config.outboundEnabled) {
      throw new Error('internetMail: outbound mail is disabled. Pass outboundEnabled: true to enable sending.')
    }
  }

  private approvedAddresses(config: ResolvedMailConfig): string[] {
    return [...new Set([...config.approvedRecipients, ...config.trustedSenders])]
  }

  isApprovedRecipient(address: string): boolean {
    return this.approvedAddresses(this.requireConfig()).includes(String(address).toLowerCase().trim())
  }

  private assertApprovedRecipients(config: ResolvedMailConfig, addresses: string[]) {
    const approved = this.approvedAddresses(config)
    if (approved.length === 0) {
      throw new Error('internetMail: no approvedRecipients or trustedSenders configured — cannot send email without an allowlist.')
    }
    for (const address of addresses) {
      const normalized = String(address).toLowerCase().trim()
      if (!approved.includes(normalized)) {
        throw new Error(`internetMail: recipient "${normalized}" is not on approvedRecipients or trustedSenders.`)
      }
    }
  }

  private toList(value: string | string[] | undefined): string[] {
    if (!value) return []
    const items = Array.isArray(value) ? value : String(value).split(',')
    return items.map(s => String(s).toLowerCase().trim()).filter(Boolean)
  }

  private async deliver(config: ResolvedMailConfig, mail: Record<string, any>): Promise<MailSendResult> {
    const transport = await this.getSmtpTransport(config)
    // The configured address is always the From — callers cannot override it.
    const info = await transport.sendMail({ ...mail, from: config.address })
    const accepted = (info?.accepted || []).map(String)
    const rejected = (info?.rejected || []).map(String)
    if (rejected.length) {
      throw new Error(`internetMail: the SMTP server rejected ${rejected.join(', ')} (accepted: ${accepted.join(', ') || 'none'})`)
    }
    this.emit('log', `sent ${info?.messageId || '(no id)'} to ${accepted.join(', ')}`)
    return { messageId: String(info?.messageId || ''), accepted, rejected }
  }

  /** Send a new message. Requires `outboundEnabled` and approved recipients. */
  async sendMessage(input: MailSendInput): Promise<MailSendResult> {
    const config = this.requireConfig()
    this.assertOutboundEnabled(config)
    const to = this.toList(input.to)
    const cc = this.toList(input.cc)
    if (!to.length) throw new Error('internetMail.sendMessage: no recipients given')
    this.assertApprovedRecipients(config, [...to, ...cc])
    return this.deliver(config, {
      to, cc: cc.length ? cc : undefined,
      subject: input.subject, text: input.text, html: input.html,
    })
  }

  private replySubject(original: string): string {
    const subject = String(original || '').trim()
    return /^re:/i.test(subject) ? subject : `Re: ${subject}`
  }

  private replyHeaders(original: StandardMailMessage): { inReplyTo?: string; references?: string } {
    const references = [...new Set([...(original.references || []), original.rfcMessageId].filter(Boolean))] as string[]
    return {
      inReplyTo: original.rfcMessageId || undefined,
      references: references.length ? references.join(' ') : undefined,
    }
  }

  /** Threaded reply to the original sender only. */
  async replyToMessage(input: MailReplyInput): Promise<MailSendResult> {
    const config = this.requireConfig()
    this.assertOutboundEnabled(config)
    const original = await this.readMessage(input.id)
    if (!original.from) throw new Error('internetMail.replyToMessage: original message has no From address')
    this.assertApprovedRecipients(config, [original.from])
    return this.deliver(config, {
      to: [original.from],
      subject: this.replySubject(original.subject),
      text: input.text,
      html: input.html,
      ...this.replyHeaders(original),
    })
  }

  /**
   * Threaded reply to the full To/Cc set, minus anyone not on the allowlist.
   * Fails rather than sending to nobody when filtering empties the set.
   */
  async replyAllToMessage(input: MailReplyInput): Promise<MailSendResult & { withheld: string[] }> {
    const config = this.requireConfig()
    this.assertOutboundEnabled(config)
    const approved = this.approvedAddresses(config)
    if (approved.length === 0) {
      throw new Error('internetMail: no approvedRecipients or trustedSenders configured — cannot send email without an allowlist.')
    }

    const original = await this.readMessage(input.id)
    const self = config.address.toLowerCase()
    const participants = [...new Set([original.from, ...original.to, ...original.cc])]
      .filter(addr => addr && addr !== self)
    const recipients = participants.filter(addr => approved.includes(addr))
    const withheld = participants.filter(addr => !approved.includes(addr))

    if (!recipients.length) {
      throw new Error(`internetMail.replyAllToMessage: no approved recipients on this thread — nothing sent. Participants: ${participants.join(', ') || '(none)'}`)
    }
    if (withheld.length) {
      this.emit('log', `reply-all withheld from ${withheld.join(', ')} — not on the allowlist`)
    }

    const result = await this.deliver(config, {
      to: recipients,
      subject: this.replySubject(original.subject),
      text: input.text,
      html: input.html,
      ...this.replyHeaders(original),
    })
    return { ...result, withheld }
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    internetMail: typeof InternetMail
  }
}

export default InternetMail
