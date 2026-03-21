import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { google, type gmail_v1 } from 'googleapis'
import type { GoogleAuth } from './google-auth.js'

export type MailMessage = {
  id: string
  threadId: string
  labelIds: string[]
  snippet: string
  subject: string
  from: string
  to: string
  cc?: string
  date: string
  body: string
  bodyHtml?: string
  isUnread: boolean
  hasAttachments: boolean
  attachments: MailAttachment[]
}

export type MailAttachment = {
  filename: string
  mimeType: string
  size: number
  attachmentId: string
}

export type MailThread = {
  id: string
  snippet: string
  historyId: string
  messages: MailMessage[]
}

export type MailLabel = {
  id: string
  name: string
  type: string
  messagesTotal?: number
  messagesUnread?: number
}

export type SearchMailOptions = {
  query?: string
  from?: string
  to?: string
  subject?: string
  after?: string
  before?: string
  hasAttachment?: boolean
  label?: string
  isUnread?: boolean
  maxResults?: number
  pageToken?: string
}

export type MailMessageList = {
  messages: MailMessage[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

export const GoogleMailStateSchema = FeatureStateSchema.extend({
  lastQuery: z.string().optional()
    .describe('Last search query used'),
  lastResultCount: z.number().optional()
    .describe('Number of messages returned in last search'),
  lastError: z.string().optional()
    .describe('Last Gmail API error message'),
  watchExpiration: z.string().optional()
    .describe('ISO timestamp when the current watch expires'),
})
export type GoogleMailState = z.infer<typeof GoogleMailStateSchema>

export const GoogleMailOptionsSchema = FeatureOptionsSchema.extend({
  auth: z.any().describe('An authorized instance of the googleAuth feature').optional(),
  userId: z.string().optional()
    .describe('Gmail user ID (default: "me")'),
  pollInterval: z.number().optional()
    .describe('Polling interval in ms for watching new mail (default: 30000)'),
  format: z.enum(['full', 'metadata', 'minimal', 'raw']).optional()
    .describe('Default message format when fetching (default: "full")'),
})
export type GoogleMailOptions = z.infer<typeof GoogleMailOptionsSchema>

export const GoogleMailEventsSchema = FeatureEventsSchema.extend({
  messagesFetched: z.tuple([z.number().describe('Number of messages returned')])
    .describe('Messages were fetched from Gmail'),
  newMail: z.tuple([z.array(z.any()).describe('Array of new MailMessage objects')])
    .describe('New mail arrived (emitted by watch)'),
  watchStarted: z.tuple([]).describe('Mail watching has started'),
  watchStopped: z.tuple([]).describe('Mail watching has stopped'),
  error: z.tuple([z.any().describe('The error')]).describe('Gmail API error occurred'),
})

/**
 * Google Mail feature for searching, reading, and watching Gmail messages.
 *
 * Depends on the googleAuth feature for authentication. Creates a Gmail v1 API
 * client lazily. Supports Gmail search query syntax, individual message reading,
 * and polling-based new mail detection with event emission.
 *
 * @example
 * ```typescript
 * const mail = container.feature('googleMail')
 *
 * // Search by sender
 * const fromBoss = await mail.search({ from: 'boss@company.com' })
 *
 * // Use Gmail query string
 * const unread = await mail.search({ query: 'is:unread category:primary' })
 *
 * // Read a specific message
 * const msg = await mail.getMessage('message-id-here')
 *
 * // Get a full thread
 * const thread = await mail.getThread('thread-id-here')
 *
 * // List labels
 * const labels = await mail.listLabels()
 *
 * // Watch for new mail (polls and emits 'newMail' events)
 * mail.on('newMail', (messages) => {
 *   console.log(`Got ${messages.length} new messages!`)
 * })
 * await mail.startWatching()
 *
 * // Stop watching
 * mail.stopWatching()
 * ```
 */
export class GoogleMail extends Feature<GoogleMailState, GoogleMailOptions> {
  static override shortcut = 'features.googleMail' as const
  static override stateSchema = GoogleMailStateSchema
  static override optionsSchema = GoogleMailOptionsSchema
  static override eventsSchema = GoogleMailEventsSchema
  static { Feature.register(this, 'googleMail') }

  private _gmail?: gmail_v1.Gmail
  private _watchTimer?: ReturnType<typeof setInterval>
  private _lastHistoryId?: string

  override get initialState(): GoogleMailState {
    return { ...super.initialState }
  }

  /** Access the google-auth feature lazily. */
  get auth(): GoogleAuth {
    if (this.options.auth) {
      return this.options.auth as GoogleAuth
    }
    return this.container.feature('googleAuth') as unknown as GoogleAuth
  }

  /** Default user ID from options or 'me'. */
  get userId(): string {
    return this.options.userId || 'me'
  }

  /** Default message format from options or 'full'. */
  get defaultFormat(): 'full' | 'metadata' | 'minimal' | 'raw' {
    return this.options.format || 'full'
  }

  /** Polling interval from options or 30 seconds. */
  get pollInterval(): number {
    return this.options.pollInterval || 30_000
  }

  /** Get or create the Gmail v1 API client. */
  private async getGmail(): Promise<gmail_v1.Gmail> {
    if (this._gmail) return this._gmail
    const auth = await this.auth.getAuthClient()
    this._gmail = google.gmail({ version: 'v1', auth: auth as any })
    return this._gmail
  }

  /**
   * Search for messages using Gmail query syntax and/or structured filters.
   *
   * @param options - Search filters including query, from, to, subject, date ranges
   * @returns Messages array with optional nextPageToken
   */
  async search(options: SearchMailOptions = {}): Promise<MailMessageList> {
    const query = buildQuery(options)
    try {
      const gmail = await this.getGmail()
      const res = await gmail.users.messages.list({
        userId: this.userId,
        q: query || undefined,
        maxResults: options.maxResults || 20,
        pageToken: options.pageToken || undefined,
      })

      const messageRefs = res.data.messages || []
      const messages: MailMessage[] = []

      for (const ref of messageRefs) {
        if (ref.id) {
          const msg = await this.getMessage(ref.id)
          messages.push(msg)
        }
      }

      this.setState({ lastQuery: query, lastResultCount: messages.length })
      this.emit('messagesFetched', messages.length)

      return {
        messages,
        nextPageToken: res.data.nextPageToken || undefined,
        resultSizeEstimate: res.data.resultSizeEstimate || undefined,
      }
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Get a single message by ID.
   *
   * @param messageId - The message ID
   * @param format - Message format (defaults to options.format or 'full')
   * @returns The full mail message
   */
  async getMessage(messageId: string, format?: 'full' | 'metadata' | 'minimal' | 'raw'): Promise<MailMessage> {
    try {
      const gmail = await this.getGmail()
      const res = await gmail.users.messages.get({
        userId: this.userId,
        id: messageId,
        format: format || this.defaultFormat,
      })
      return normalizeMessage(res.data)
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Get a full thread with all its messages.
   *
   * @param threadId - The thread ID
   * @returns The thread with all messages
   */
  async getThread(threadId: string): Promise<MailThread> {
    try {
      const gmail = await this.getGmail()
      const res = await gmail.users.threads.get({
        userId: this.userId,
        id: threadId,
        format: this.defaultFormat,
      })
      return {
        id: res.data.id || '',
        snippet: res.data.snippet || '',
        historyId: res.data.historyId || '',
        messages: (res.data.messages || []).map(normalizeMessage),
      }
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * List all labels for the authenticated user.
   *
   * @returns Array of label objects
   */
  async listLabels(): Promise<MailLabel[]> {
    try {
      const gmail = await this.getGmail()
      const res = await gmail.users.labels.list({ userId: this.userId })
      const labels = res.data.labels || []

      // Fetch full label info for counts
      const detailed: MailLabel[] = []
      for (const label of labels) {
        if (label.id) {
          try {
            const full = await gmail.users.labels.get({ userId: this.userId, id: label.id })
            detailed.push({
              id: full.data.id || '',
              name: full.data.name || '',
              type: full.data.type || '',
              messagesTotal: full.data.messagesTotal || undefined,
              messagesUnread: full.data.messagesUnread || undefined,
            })
          } catch {
            detailed.push({
              id: label.id || '',
              name: label.name || '',
              type: label.type || '',
            })
          }
        }
      }
      return detailed
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Start watching for new mail by polling at a regular interval.
   * Emits 'newMail' events with an array of new messages when they arrive.
   *
   * Uses Gmail history API to efficiently detect only new messages since the last check.
   */
  async startWatching(): Promise<void> {
    if (this._watchTimer) return

    // Get initial history ID
    const gmail = await this.getGmail()
    const profile = await gmail.users.getProfile({ userId: this.userId })
    this._lastHistoryId = profile.data.historyId || undefined

    this._watchTimer = setInterval(async () => {
      try {
        await this._checkForNewMail()
      } catch (err: any) {
        this.setState({ lastError: err.message })
        this.emit('error', err)
      }
    }, this.pollInterval)

    this.emit('watchStarted')
  }

  /**
   * Stop watching for new mail.
   */
  stopWatching(): void {
    if (this._watchTimer) {
      clearInterval(this._watchTimer)
      this._watchTimer = undefined
      this._lastHistoryId = undefined
      this.setState({ watchExpiration: undefined })
      this.emit('watchStopped')
    }
  }

  /** Check for new messages since last history ID using Gmail history API. */
  private async _checkForNewMail(): Promise<void> {
    if (!this._lastHistoryId) return

    const gmail = await this.getGmail()
    try {
      const res = await gmail.users.history.list({
        userId: this.userId,
        startHistoryId: this._lastHistoryId,
        historyTypes: ['messageAdded'],
      })

      const history = res.data.history || []
      const newMessageIds = new Set<string>()

      for (const record of history) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) {
            newMessageIds.add(added.message.id)
          }
        }
      }

      if (res.data.historyId) {
        this._lastHistoryId = res.data.historyId
      }

      if (newMessageIds.size > 0) {
        const messages: MailMessage[] = []
        for (const id of newMessageIds) {
          try {
            const msg = await this.getMessage(id)
            messages.push(msg)
          } catch {
            // Message may have been deleted between detection and fetch
          }
        }
        if (messages.length > 0) {
          this.emit('newMail', messages)
        }
      }
    } catch (err: any) {
      // History ID may be expired — reset by fetching fresh profile
      if (err.code === 404 || err.message?.includes('historyId')) {
        const profile = await gmail.users.getProfile({ userId: this.userId })
        this._lastHistoryId = profile.data.historyId || undefined
      } else {
        throw err
      }
    }
  }
}

/** Build a Gmail query string from structured search options. */
function buildQuery(options: SearchMailOptions): string {
  const parts: string[] = []

  if (options.query) parts.push(options.query)
  if (options.from) parts.push(`from:${options.from}`)
  if (options.to) parts.push(`to:${options.to}`)
  if (options.subject) parts.push(`subject:${options.subject}`)
  if (options.after) parts.push(`after:${options.after}`)
  if (options.before) parts.push(`before:${options.before}`)
  if (options.hasAttachment) parts.push('has:attachment')
  if (options.label) parts.push(`label:${options.label}`)
  if (options.isUnread) parts.push('is:unread')

  return parts.join(' ')
}

/** Extract a header value from a Gmail message. */
function getHeader(headers: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!headers) return ''
  const h = headers.find(h => h.name?.toLowerCase() === name.toLowerCase())
  return h?.value || ''
}

/** Decode a base64url-encoded string. */
function decodeBody(encoded: string): string {
  try {
    return Buffer.from(encoded, 'base64url').toString('utf-8')
  } catch {
    return ''
  }
}

/** Extract the plain text body from a message payload. */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''

  // Simple body
  if (payload.body?.data) {
    return decodeBody(payload.body.data)
  }

  // Multipart — look for text/plain first, then text/html
  if (payload.parts) {
    const textPart = payload.parts.find(p => p.mimeType === 'text/plain')
    if (textPart?.body?.data) return decodeBody(textPart.body.data)

    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decodeBody(htmlPart.body.data)

    // Nested multipart
    for (const part of payload.parts) {
      const nested = extractBody(part)
      if (nested) return nested
    }
  }

  return ''
}

/** Extract HTML body from a message payload. */
function extractHtmlBody(payload: gmail_v1.Schema$MessagePart | undefined): string | undefined {
  if (!payload) return undefined

  if (payload.mimeType === 'text/html' && payload.body?.data) {
    return decodeBody(payload.body.data)
  }

  if (payload.parts) {
    const htmlPart = payload.parts.find(p => p.mimeType === 'text/html')
    if (htmlPart?.body?.data) return decodeBody(htmlPart.body.data)

    for (const part of payload.parts) {
      const nested = extractHtmlBody(part)
      if (nested) return nested
    }
  }

  return undefined
}

/** Extract attachment metadata from a message payload. */
function extractAttachments(payload: gmail_v1.Schema$MessagePart | undefined): MailAttachment[] {
  if (!payload) return []

  const attachments: MailAttachment[] = []

  if (payload.filename && payload.body?.attachmentId) {
    attachments.push({
      filename: payload.filename,
      mimeType: payload.mimeType || '',
      size: payload.body.size || 0,
      attachmentId: payload.body.attachmentId,
    })
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      attachments.push(...extractAttachments(part))
    }
  }

  return attachments
}

/** Normalize a raw Gmail message into our clean MailMessage type. */
function normalizeMessage(msg: gmail_v1.Schema$Message): MailMessage {
  const headers = msg.payload?.headers
  const attachments = extractAttachments(msg.payload)

  return {
    id: msg.id || '',
    threadId: msg.threadId || '',
    labelIds: msg.labelIds || [],
    snippet: msg.snippet || '',
    subject: getHeader(headers, 'Subject'),
    from: getHeader(headers, 'From'),
    to: getHeader(headers, 'To'),
    cc: getHeader(headers, 'Cc') || undefined,
    date: getHeader(headers, 'Date'),
    body: extractBody(msg.payload),
    bodyHtml: extractHtmlBody(msg.payload),
    isUnread: (msg.labelIds || []).includes('UNREAD'),
    hasAttachments: attachments.length > 0,
    attachments,
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    googleMail: typeof GoogleMail
  }
}

export default GoogleMail
