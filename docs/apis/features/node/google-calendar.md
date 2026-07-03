# GoogleCalendar (features.googleCalendar)

> Stability: `stable`

Google Calendar feature for listing calendars and reading events. Depends on the googleAuth feature for authentication (requires Google OAuth2 credentials or a service account with Calendar access, e.g. the `calendar.readonly` scope). Creates a Calendar v3 API client lazily. Provides convenience methods for today's events and upcoming days alongside the full `listEvents()` for custom time ranges. Event `start` and `end` are objects: timed events have `dateTime`, all-day events have `date`. Pass a `timeZone` option (e.g. "America/Chicago") to control the timezone used when rendering event times in queries.

## Usage

```ts
container.feature('googleCalendar', {
  // An authorized instance of the googleAuth feature
  auth,
  // Default calendar ID (default: "primary")
  defaultCalendarId,
  // Default timezone for event queries (e.g. "America/Chicago")
  timeZone,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `any` | An authorized instance of the googleAuth feature |
| `defaultCalendarId` | `string` | Default calendar ID (default: "primary") |
| `timeZone` | `string` | Default timezone for event queries (e.g. "America/Chicago") |

## Methods

### listCalendars

List all calendars accessible to the authenticated user. Returns calendar metadata including id, summary, timeZone, and accessRole — use the id to target specific calendars in the other methods.

**Returns:** `Promise<CalendarInfo[]>`

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const calendars = await calendar.listCalendars()
calendars.forEach(c => console.log(`${c.primary ? '*' : ' '} ${c.summary} (${c.id})`))
```



### listEvents

List events from a calendar within a time range. Defaults: maxResults 250, orderBy 'startTime', singleEvents true (recurring events are expanded into instances). Paginate via the returned nextPageToken.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ListEventsOptions` |  | Filtering options including timeMin, timeMax, query, maxResults |

`ListEventsOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `calendarId` | `string` |  |
| `timeMin` | `string` |  |
| `timeMax` | `string` |  |
| `maxResults` | `number` |  |
| `query` | `string` |  |
| `orderBy` | `'startTime' | 'updated'` |  |
| `pageToken` | `string` |  |
| `singleEvents` | `boolean` |  |

**Returns:** `Promise<CalendarEventList>`

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const { events, nextPageToken } = await calendar.listEvents({
 timeMin: '2026-03-01T00:00:00Z',
 timeMax: '2026-03-31T23:59:59Z',
 maxResults: 50,
 orderBy: 'startTime',
})
console.log(`March events: ${events.length}`)
```



### getToday

Get today's events from a calendar — midnight to midnight in the server's local time.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `calendarId` | `string` |  | Calendar ID (defaults to options.defaultCalendarId or 'primary') |

**Returns:** `Promise<CalendarEvent[]>`

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const today = await calendar.getToday()
today.forEach(e => {
 const time = e.start.dateTime
   ? new Date(e.start.dateTime).toLocaleTimeString()
   : 'All day'
 console.log(`${time} - ${e.summary}`)
})
```



### getUpcoming

Get upcoming events for the next N days, starting from now.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `days` | `number` |  | Number of days to look ahead (default: 7) |
| `calendarId` | `string` |  | Calendar ID |

**Returns:** `Promise<CalendarEvent[]>`

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const week = await calendar.getUpcoming(7)
const month = await calendar.getUpcoming(30)
const work = await calendar.getUpcoming(7, 'work-calendar-id')
console.log(`Next 7 days: ${week.length} events`)
```



### getEvent

Get a single event by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `eventId` | `string` | ✓ | The event ID |
| `calendarId` | `string` |  | Calendar ID |

**Returns:** `Promise<CalendarEvent>`



### searchEvents

Search events by text query across event summaries, descriptions, and locations. Combine with timeMin/timeMax options for more precise results.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | Freetext search term |
| `options` | `ListEventsOptions` |  | Additional listing options (timeMin, timeMax, calendarId, etc.) |

`ListEventsOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `calendarId` | `string` |  |
| `timeMin` | `string` |  |
| `timeMax` | `string` |  |
| `maxResults` | `number` |  |
| `query` | `string` |  |
| `orderBy` | `'startTime' | 'updated'` |  |
| `pageToken` | `string` |  |
| `singleEvents` | `boolean` |  |

**Returns:** `Promise<CalendarEvent[]>`

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const standups = await calendar.searchEvents('standup')
const reviews = await calendar.searchEvents('review', {
 timeMin: '2026-03-01T00:00:00Z',
 timeMax: '2026-03-31T23:59:59Z',
})
console.log(`Found ${standups.length} standup events`)
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `GoogleAuth` | Access the google-auth feature lazily. |
| `defaultCalendarId` | `string` | Default calendar ID from options or 'primary'. |

## Events (Zod v4 schema)

### error

Calendar API error occurred

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



### eventsFetched

Events were fetched from Calendar

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Number of events returned |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `lastCalendarId` | `string` | Last calendar ID queried |
| `lastEventCount` | `number` | Number of events returned in last query |
| `lastError` | `string` | Last Calendar API error message |

## Examples

**features.googleCalendar**

```ts
// (no-run) requires Google OAuth credentials
// Authenticate once via googleAuth (cached tokens restore automatically)
const auth = container.feature('googleAuth', {
 scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
})
if (!(await auth.tryRestoreTokens())) await auth.authorize()

const calendar = container.feature('googleCalendar', {
 defaultCalendarId: 'primary',
 timeZone: 'America/Chicago',
})

// Today's events — start.dateTime for timed events, start.date for all-day
const today = await calendar.getToday()
today.forEach(e => console.log(e.start.dateTime || e.start.date, e.summary))

// Next 7 days
const upcoming = await calendar.getUpcoming(7)
```



**listCalendars**

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const calendars = await calendar.listCalendars()
calendars.forEach(c => console.log(`${c.primary ? '*' : ' '} ${c.summary} (${c.id})`))
```



**listEvents**

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const { events, nextPageToken } = await calendar.listEvents({
 timeMin: '2026-03-01T00:00:00Z',
 timeMax: '2026-03-31T23:59:59Z',
 maxResults: 50,
 orderBy: 'startTime',
})
console.log(`March events: ${events.length}`)
```



**getToday**

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const today = await calendar.getToday()
today.forEach(e => {
 const time = e.start.dateTime
   ? new Date(e.start.dateTime).toLocaleTimeString()
   : 'All day'
 console.log(`${time} - ${e.summary}`)
})
```



**getUpcoming**

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const week = await calendar.getUpcoming(7)
const month = await calendar.getUpcoming(30)
const work = await calendar.getUpcoming(7, 'work-calendar-id')
console.log(`Next 7 days: ${week.length} events`)
```



**searchEvents**

```ts
// (no-run) requires Google OAuth credentials
const calendar = container.feature('googleCalendar')
const standups = await calendar.searchEvents('standup')
const reviews = await calendar.searchEvents('review', {
 timeMin: '2026-03-01T00:00:00Z',
 timeMax: '2026-03-31T23:59:59Z',
})
console.log(`Found ${standups.length} standup events`)
```

