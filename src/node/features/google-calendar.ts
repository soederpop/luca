import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { google, type calendar_v3 } from 'googleapis'
import type { GoogleAuth } from './google-auth.js'

export type CalendarInfo = {
  id: string
  summary: string
  description?: string
  timeZone: string
  primary?: boolean
  backgroundColor?: string
  accessRole: string
}

export type CalendarEvent = {
  id: string
  summary: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string; timeZone?: string }
  end: { dateTime?: string; date?: string; timeZone?: string }
  status: string
  htmlLink: string
  creator?: { email?: string; displayName?: string }
  organizer?: { email?: string; displayName?: string }
  attendees?: Array<{ email?: string; displayName?: string; responseStatus?: string }>
  recurrence?: string[]
}

export type CalendarEventList = {
  events: CalendarEvent[]
  nextPageToken?: string
  timeZone?: string
}

export type ListEventsOptions = {
  calendarId?: string
  timeMin?: string
  timeMax?: string
  maxResults?: number
  query?: string
  orderBy?: 'startTime' | 'updated'
  pageToken?: string
  singleEvents?: boolean
}

export const GoogleCalendarStateSchema = FeatureStateSchema.extend({
  lastCalendarId: z.string().optional()
    .describe('Last calendar ID queried'),
  lastEventCount: z.number().optional()
    .describe('Number of events returned in last query'),
  lastError: z.string().optional()
    .describe('Last Calendar API error message'),
})
export type GoogleCalendarState = z.infer<typeof GoogleCalendarStateSchema>

export const GoogleCalendarOptionsSchema = FeatureOptionsSchema.extend({
  auth: z.any().describe('An authorized instance of the googleAuth feature').optional(),
  defaultCalendarId: z.string().optional()
    .describe('Default calendar ID (default: "primary")'),
  timeZone: z.string().optional()
    .describe('Default timezone for event queries (e.g. "America/Chicago")'),
})
export type GoogleCalendarOptions = z.infer<typeof GoogleCalendarOptionsSchema>

export const GoogleCalendarEventsSchema = FeatureEventsSchema.extend({
  eventsFetched: z.tuple([z.number().describe('Number of events returned')])
    .describe('Events were fetched from Calendar'),
  error: z.tuple([z.any().describe('The error')]).describe('Calendar API error occurred'),
})

/**
 * Google Calendar feature for listing calendars and reading events.
 *
 * Depends on the googleAuth feature for authentication (requires Google OAuth2
 * credentials or a service account with Calendar access, e.g. the
 * `calendar.readonly` scope). Creates a Calendar v3 API client lazily.
 * Provides convenience methods for today's events and upcoming days alongside
 * the full `listEvents()` for custom time ranges.
 *
 * Event `start` and `end` are objects: timed events have `dateTime`, all-day
 * events have `date`. Pass a `timeZone` option (e.g. "America/Chicago") to
 * control the timezone used when rendering event times in queries.
 *
 * @example
 * ```typescript
 * // (no-run) requires Google OAuth credentials
 * // Authenticate once via googleAuth (cached tokens restore automatically)
 * const auth = container.feature('googleAuth', {
 *   scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
 * })
 * if (!(await auth.tryRestoreTokens())) await auth.authorize()
 *
 * const calendar = container.feature('googleCalendar', {
 *   defaultCalendarId: 'primary',
 *   timeZone: 'America/Chicago',
 * })
 *
 * // Today's events — start.dateTime for timed events, start.date for all-day
 * const today = await calendar.getToday()
 * today.forEach(e => console.log(e.start.dateTime || e.start.date, e.summary))
 *
 * // Next 7 days
 * const upcoming = await calendar.getUpcoming(7)
 * ```
 */
export class GoogleCalendar extends Feature<GoogleCalendarState, GoogleCalendarOptions> {
  static override shortcut = 'features.googleCalendar' as const
  static override stability = 'stable' as const
  static override category = 'google-workspace' as const
  static override stateSchema = GoogleCalendarStateSchema
  static override optionsSchema = GoogleCalendarOptionsSchema
  static override eventsSchema = GoogleCalendarEventsSchema
  static { Feature.register(this, 'googleCalendar') }

  private _calendar?: calendar_v3.Calendar

  override get initialState(): GoogleCalendarState {
    return { ...super.initialState }
  }

  /** Access the google-auth feature lazily. */
  get auth(): GoogleAuth {
    if (this.options.auth) {
      return this.options.auth as GoogleAuth
    }

    return this.container.feature('googleAuth') as unknown as GoogleAuth
  }

  /** Default calendar ID from options or 'primary'. */
  get defaultCalendarId(): string {
    return this.options.defaultCalendarId || 'primary'
  }

  /** Get or create the Calendar v3 API client. */
  private async getCalendar(): Promise<calendar_v3.Calendar> {
    if (this._calendar) return this._calendar
    const auth = await this.auth.getAuthClient()
    this._calendar = google.calendar({ version: 'v3', auth: auth as any })
    return this._calendar
  }

  /**
   * List all calendars accessible to the authenticated user.
   * Returns calendar metadata including id, summary, timeZone, and accessRole —
   * use the id to target specific calendars in the other methods.
   *
   * @returns Array of calendar info objects
   *
   * @example
   * ```typescript
   * // (no-run) requires Google OAuth credentials
   * const calendar = container.feature('googleCalendar')
   * const calendars = await calendar.listCalendars()
   * calendars.forEach(c => console.log(`${c.primary ? '*' : ' '} ${c.summary} (${c.id})`))
   * ```
   */
  async listCalendars(): Promise<CalendarInfo[]> {
    try {
      const cal = await this.getCalendar()
      const res = await cal.calendarList.list({ maxResults: 250 })
      return (res.data.items || []).map(c => ({
        id: c.id || '',
        summary: c.summary || '',
        description: c.description || undefined,
        timeZone: c.timeZone || '',
        primary: c.primary || undefined,
        backgroundColor: c.backgroundColor || undefined,
        accessRole: c.accessRole || '',
      }))
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * List events from a calendar within a time range.
   * Defaults: maxResults 250, orderBy 'startTime', singleEvents true (recurring
   * events are expanded into instances). Paginate via the returned nextPageToken.
   *
   * @param options - Filtering options including timeMin, timeMax, query, maxResults
   * @returns Events array with optional nextPageToken and timeZone
   *
   * @example
   * ```typescript
   * // (no-run) requires Google OAuth credentials
   * const calendar = container.feature('googleCalendar')
   * const { events, nextPageToken } = await calendar.listEvents({
   *   timeMin: '2026-03-01T00:00:00Z',
   *   timeMax: '2026-03-31T23:59:59Z',
   *   maxResults: 50,
   *   orderBy: 'startTime',
   * })
   * console.log(`March events: ${events.length}`)
   * ```
   */
  async listEvents(options: ListEventsOptions = {}): Promise<CalendarEventList> {
    const calendarId = options.calendarId || this.defaultCalendarId
    try {
      const cal = await this.getCalendar()
      const res = await cal.events.list({
        calendarId,
        timeMin: options.timeMin || undefined,
        timeMax: options.timeMax || undefined,
        maxResults: options.maxResults || 250,
        q: options.query || undefined,
        orderBy: options.orderBy || 'startTime',
        pageToken: options.pageToken || undefined,
        singleEvents: options.singleEvents !== false,
        timeZone: this.options.timeZone || undefined,
      })

      const events = (res.data.items || []).map(normalizeEvent)
      this.setState({ lastCalendarId: calendarId, lastEventCount: events.length })
      this.emit('eventsFetched', events.length)
      return {
        events,
        nextPageToken: res.data.nextPageToken || undefined,
        timeZone: res.data.timeZone || undefined,
      }
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Get today's events from a calendar — midnight to midnight in the server's local time.
   *
   * @param calendarId - Calendar ID (defaults to options.defaultCalendarId or 'primary')
   * @returns Array of today's calendar events
   *
   * @example
   * ```typescript
   * // (no-run) requires Google OAuth credentials
   * const calendar = container.feature('googleCalendar')
   * const today = await calendar.getToday()
   * today.forEach(e => {
   *   const time = e.start.dateTime
   *     ? new Date(e.start.dateTime).toLocaleTimeString()
   *     : 'All day'
   *   console.log(`${time} - ${e.summary}`)
   * })
   * ```
   */
  async getToday(calendarId?: string): Promise<CalendarEvent[]> {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

    const { events } = await this.listEvents({
      calendarId,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
    })
    return events
  }

  /**
   * Get upcoming events for the next N days, starting from now.
   *
   * @param days - Number of days to look ahead (default: 7)
   * @param calendarId - Calendar ID
   * @returns Array of upcoming calendar events
   *
   * @example
   * ```typescript
   * // (no-run) requires Google OAuth credentials
   * const calendar = container.feature('googleCalendar')
   * const week = await calendar.getUpcoming(7)
   * const month = await calendar.getUpcoming(30)
   * const work = await calendar.getUpcoming(7, 'work-calendar-id')
   * console.log(`Next 7 days: ${week.length} events`)
   * ```
   */
  async getUpcoming(days: number = 7, calendarId?: string): Promise<CalendarEvent[]> {
    const now = new Date()
    const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000)

    const { events } = await this.listEvents({
      calendarId,
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
    })
    return events
  }

  /**
   * Get a single event by ID.
   *
   * @param eventId - The event ID
   * @param calendarId - Calendar ID
   * @returns The calendar event
   */
  async getEvent(eventId: string, calendarId?: string): Promise<CalendarEvent> {
    const cid = calendarId || this.defaultCalendarId
    try {
      const cal = await this.getCalendar()
      const res = await cal.events.get({ calendarId: cid, eventId })
      return normalizeEvent(res.data)
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw err
    }
  }

  /**
   * Search events by text query across event summaries, descriptions, and locations.
   * Combine with timeMin/timeMax options for more precise results.
   *
   * @param query - Freetext search term
   * @param options - Additional listing options (timeMin, timeMax, calendarId, etc.)
   * @returns Array of matching calendar events
   *
   * @example
   * ```typescript
   * // (no-run) requires Google OAuth credentials
   * const calendar = container.feature('googleCalendar')
   * const standups = await calendar.searchEvents('standup')
   * const reviews = await calendar.searchEvents('review', {
   *   timeMin: '2026-03-01T00:00:00Z',
   *   timeMax: '2026-03-31T23:59:59Z',
   * })
   * console.log(`Found ${standups.length} standup events`)
   * ```
   */
  async searchEvents(query: string, options: ListEventsOptions = {}): Promise<CalendarEvent[]> {
    const { events } = await this.listEvents({ ...options, query })
    return events
  }
}

function normalizeEvent(e: calendar_v3.Schema$Event): CalendarEvent {
  return {
    id: e.id || '',
    summary: e.summary || '',
    description: e.description || undefined,
    location: e.location || undefined,
    start: {
      dateTime: e.start?.dateTime || undefined,
      date: e.start?.date || undefined,
      timeZone: e.start?.timeZone || undefined,
    },
    end: {
      dateTime: e.end?.dateTime || undefined,
      date: e.end?.date || undefined,
      timeZone: e.end?.timeZone || undefined,
    },
    status: e.status || '',
    htmlLink: e.htmlLink || '',
    creator: e.creator ? { email: e.creator.email || undefined, displayName: e.creator.displayName || undefined } : undefined,
    organizer: e.organizer ? { email: e.organizer.email || undefined, displayName: e.organizer.displayName || undefined } : undefined,
    attendees: e.attendees?.map(a => ({
      email: a.email || undefined,
      displayName: a.displayName || undefined,
      responseStatus: a.responseStatus || undefined,
    })) || undefined,
    recurrence: e.recurrence || undefined,
  }
}

declare module '../../feature' {
  interface AvailableFeatures {
    googleCalendar: typeof GoogleCalendar
  }
}

export default GoogleCalendar