import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { googleTransport } from './support/google-transport'
let c: NodeContainer
let t: ReturnType<typeof googleTransport>
beforeEach(() => { c = new NodeContainer(); t = googleTransport() })
const calendar = (options = {}) => c.feature('googleCalendar', { auth: t.auth, ...options })

describe('Google Calendar', () => {
  it('normalizes calendars including sparse API responses', async () => {
    t.request.mockResolvedValue({ data: { items: [{ id: 'work', summary: 'Work', primary: true, timeZone: 'UTC', accessRole: 'owner' }, {}] } })
    expect(await calendar().listCalendars()).toEqual([
      { id: 'work', summary: 'Work', primary: true, timeZone: 'UTC', accessRole: 'owner', description: undefined, backgroundColor: undefined },
      { id: '', summary: '', timeZone: '', accessRole: '', primary: undefined, description: undefined, backgroundColor: undefined },
    ])
  })
  it('uses primary calendar and recurring-event expansion by default', async () => {
    const feature = calendar()
    expect(await feature.listEvents()).toEqual({ events: [], nextPageToken: undefined, timeZone: undefined })
    expect(String(t.request.mock.calls[0]![0].url)).toContain('/calendars/primary/events')
    expect(t.request.mock.calls[0]![0].params).toMatchObject({ maxResults: 250, orderBy: 'startTime', singleEvents: true })
    await feature.listCalendars()
    expect(t.getAuthClient).toHaveBeenCalledTimes(1)
  })
  it('preserves event metadata, pagination, all-day dates and explicit filters', async () => {
    t.request.mockResolvedValue({ data: { items: [{ id: 'e1', summary: 'Holiday', start: { date: '2026-01-01' }, end: { date: '2026-01-02' }, attendees: [{ email: 'guest@example.test', responseStatus: 'accepted' }], creator: { email: 'owner@example.test' }, organizer: {}, recurrence: ['RRULE:FREQ=YEARLY'] }], nextPageToken: 'next', timeZone: 'UTC' } })
    const feature = calendar({ defaultCalendarId: 'work', timeZone: 'UTC' })
    const fetched = mock(() => {})
    feature.on('eventsFetched', fetched)
    const result = await feature.listEvents({ calendarId: 'other', query: 'Holiday', maxResults: 5, pageToken: 'page', orderBy: 'updated', singleEvents: false, timeMin: '2026-01-01T00:00:00Z', timeMax: '2026-02-01T00:00:00Z' })
    expect(result).toMatchObject({ nextPageToken: 'next', timeZone: 'UTC', events: [{ id: 'e1', start: { date: '2026-01-01' }, attendees: [{ responseStatus: 'accepted' }], recurrence: ['RRULE:FREQ=YEARLY'] }] })
    expect(t.request.mock.calls[0]![0].params).toMatchObject({ q: 'Holiday', maxResults: 5, pageToken: 'page', singleEvents: false, timeZone: 'UTC', orderBy: 'updated' })
    expect(feature.state.get('lastCalendarId')).toBe('other')
    expect(fetched).toHaveBeenCalledWith(1)
  })
  it('normalizes a sparse event and uses the configured default calendar', async () => {
    const result = await calendar({ defaultCalendarId: 'work' }).getEvent('event')
    expect(result).toMatchObject({ id: '', summary: '', status: '', htmlLink: '', start: {}, end: {} })
    expect(String(t.request.mock.calls[0]![0].url)).toContain('/calendars/work/events/event')
  })
  it('search returns events and forwards the search text', async () => {
    t.request.mockResolvedValue({ data: { items: [{ id: 'found' }] } })
    expect((await calendar().searchEvents('planning', { maxResults: 2 }))[0]?.id).toBe('found')
    expect(t.request.mock.calls[0]![0].params).toMatchObject({ q: 'planning', maxResults: 2 })
  })
  it('today spans local calendar-day boundaries', async () => {
    const now = new Date()
    await calendar().getToday('work')
    const { timeMin, timeMax } = t.request.mock.calls[0]![0].params
    expect(timeMin).toBe(new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString())
    expect(timeMax).toBe(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString())
  })
  it.each([undefined, 3])('upcoming spans %j days from the same instant', async (days) => {
    await calendar().getUpcoming(days)
    const { timeMin, timeMax } = t.request.mock.calls[0]![0].params
    expect(Date.parse(timeMax) - Date.parse(timeMin)).toBe((days ?? 7) * 86400000)
  })
  it.each(['listCalendars', 'listEvents', 'getEvent'] as const)('%s preserves API errors and publishes failure state', async (method) => {
    const feature = calendar()
    const error = new Error('calendar denied')
    const failed = mock(() => {})
    feature.on('error', failed)
    t.request.mockRejectedValue(error)
    const result = method === 'getEvent' ? feature.getEvent('event') : feature[method]()
    await expect(result).rejects.toBe(error)
    expect(feature.state.get('lastError')).toBe(error.message)
    expect(failed).toHaveBeenCalledWith(error)
  })
})
