# GoogleMail (features.googleMail)

Google Mail feature for searching, reading, and watching Gmail messages. Depends on the googleAuth feature for authentication. Creates a Gmail v1 API client lazily. Supports Gmail search query syntax, individual message reading, and polling-based new mail detection with event emission.

## Usage

```ts
container.feature('googleMail', {
  // An authorized instance of the googleAuth feature
  auth,
  // Gmail user ID (default: "me")
  userId,
  // Polling interval in ms for watching new mail (default: 30000)
  pollInterval,
  // Default message format when fetching (default: "full")
  format,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `any` | An authorized instance of the googleAuth feature |
| `userId` | `string` | Gmail user ID (default: "me") |
| `pollInterval` | `number` | Polling interval in ms for watching new mail (default: 30000) |
| `format` | `string` | Default message format when fetching (default: "full") |

## Methods

### search

Search for messages using Gmail query syntax and/or structured filters.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `SearchMailOptions` |  | Search filters including query, from, to, subject, date ranges |

`SearchMailOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `query` | `string` |  |
| `from` | `string` |  |
| `to` | `string` |  |
| `subject` | `string` |  |
| `after` | `string` |  |
| `before` | `string` |  |
| `hasAttachment` | `boolean` |  |
| `label` | `string` |  |
| `isUnread` | `boolean` |  |
| `maxResults` | `number` |  |
| `pageToken` | `string` |  |

**Returns:** `Promise<MailMessageList>`



### getMessage

Get a single message by ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messageId` | `string` | ✓ | The message ID |
| `format` | `'full' | 'metadata' | 'minimal' | 'raw'` |  | Message format (defaults to options.format or 'full') |

**Returns:** `Promise<MailMessage>`



### getThread

Get a full thread with all its messages.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `threadId` | `string` | ✓ | The thread ID |

**Returns:** `Promise<MailThread>`



### listLabels

List all labels for the authenticated user.

**Returns:** `Promise<MailLabel[]>`



### startWatching

Start watching for new mail by polling at a regular interval. Emits 'newMail' events with an array of new messages when they arrive. Uses Gmail history API to efficiently detect only new messages since the last check.

**Returns:** `Promise<void>`



### stopWatching

Stop watching for new mail.

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `auth` | `GoogleAuth` | Access the google-auth feature lazily. |
| `userId` | `string` | Default user ID from options or 'me'. |
| `defaultFormat` | `'full' | 'metadata' | 'minimal' | 'raw'` | Default message format from options or 'full'. |
| `pollInterval` | `number` | Polling interval from options or 30 seconds. |

## Events (Zod v4 schema)

### messagesFetched

Messages were fetched from Gmail

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Number of messages returned |



### error

Gmail API error occurred

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



### watchStarted

Mail watching has started



### watchStopped

Mail watching has stopped



### newMail

New mail arrived (emitted by watch)

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `array` | Array of new MailMessage objects |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `lastQuery` | `string` | Last search query used |
| `lastResultCount` | `number` | Number of messages returned in last search |
| `lastError` | `string` | Last Gmail API error message |
| `watchExpiration` | `string` | ISO timestamp when the current watch expires |

## Examples

**features.googleMail**

```ts
const mail = container.feature('googleMail')

// Search by sender
const fromBoss = await mail.search({ from: 'boss@company.com' })

// Use Gmail query string
const unread = await mail.search({ query: 'is:unread category:primary' })

// Read a specific message
const msg = await mail.getMessage('message-id-here')

// Get a full thread
const thread = await mail.getThread('thread-id-here')

// List labels
const labels = await mail.listLabels()

// Watch for new mail (polls and emits 'newMail' events)
mail.on('newMail', (messages) => {
 console.log(`Got ${messages.length} new messages!`)
})
await mail.startWatching()

// Stop watching
mail.stopWatching()
```

