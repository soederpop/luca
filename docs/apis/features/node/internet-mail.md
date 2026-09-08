# InternetMail (features.internetMail)

> Stability: `experimental`

Internet Mail Feature — standards-based email over IMAP and SMTP Any mailbox that speaks IMAP and SMTP, with host/port presets for iCloud, Gmail, Fastmail, Outlook, and Yahoo. This is the protocol-level counterpart to `googleMail`: no vendor API, no OAuth, just a username and an (app-specific) password. **Configure it at construction** — the feature reads no config files: ```ts const mail = container.feature('internetMail', { provider: 'icloud', address: 'you@me.com', passwordEnv: 'ICLOUD_MAIL_APP_PASSWORD', trustedSenders: ['boss@example.com'], }) ``` **What it gives you:** - `verify()` — config, secret, IMAP login, and SMTP login diagnostics, each as an independent verdict so a failure names the thing that failed - `poll()` / `start()` / `stop()` — cursor-based inbound polling that emits one `message` event per new `StandardMailMessage` from a trusted sender. The cursor lives in `container.store()`, so a restart resumes rather than replaying, and a `UIDVALIDITY` change re-baselines instead of duplicating - `checkInbox()` / `readMessage()` / `searchMessages()` — pull-based reads that never advance the poll cursor or alter unread state - `sendMessage()` / `replyToMessage()` / `replyAllToMessage()` — outbound mail gated by `outboundEnabled` and the recipient allowlist **It fails closed on purpose.** Inbound needs a non-empty `trustedSenders` list, outbound needs `outboundEnabled` plus an allowlisted recipient, and the From is always the configured address. Mail is untrusted input: every message carries a `validation` block scoring SPF/DKIM/DMARC and flagging display-name spoofing and Reply-To mismatches.

## Usage

```ts
container.feature('internetMail', {
  // Provider preset id: icloud, gmail, fastmail, outlook, yahoo. Any other value needs explicit imap/smtp overrides
  provider,
  // The mailbox address; always used as the SMTP From
  address,
  // IMAP login; defaults to the preset's username style
  imapUsername,
  // SMTP login; defaults to the preset's username style
  smtpUsername,
  // Name of the env var holding the (app-specific) password
  passwordEnv,
  // The password itself, for callers that already hold the secret. Prefer passwordEnv
  password,
  // Mailbox to poll (default INBOX)
  mailbox,
  // Poll interval in milliseconds (default 45000)
  pollIntervalMs,
  // Skip messages larger than this (default 5 MiB)
  maxMessageBytes,
  // Add \Seen after successful dispatch (default false)
  markAsRead,
  // Master switch for all sends and replies (default false)
  outboundEnabled,
  // Exact addresses whose inbound mail is emitted by poll()
  trustedSenders,
  // Addresses outbound mail may be sent to
  approvedRecipients,
  // Store name holding the poll cursor (default "internet-mail")
  cursorStore,
  // Store scope for the cursor (default 'project')
  cursorScope,
  // Explicit IMAP transport override
  imap,
  // Explicit SMTP transport override
  smtp,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `string` | Provider preset id: icloud, gmail, fastmail, outlook, yahoo. Any other value needs explicit imap/smtp overrides |
| `address` | `string` | The mailbox address; always used as the SMTP From |
| `imapUsername` | `string` | IMAP login; defaults to the preset's username style |
| `smtpUsername` | `string` | SMTP login; defaults to the preset's username style |
| `passwordEnv` | `string` | Name of the env var holding the (app-specific) password |
| `password` | `string` | The password itself, for callers that already hold the secret. Prefer passwordEnv |
| `mailbox` | `string` | Mailbox to poll (default INBOX) |
| `pollIntervalMs` | `number` | Poll interval in milliseconds (default 45000) |
| `maxMessageBytes` | `number` | Skip messages larger than this (default 5 MiB) |
| `markAsRead` | `boolean` | Add \Seen after successful dispatch (default false) |
| `outboundEnabled` | `boolean` | Master switch for all sends and replies (default false) |
| `trustedSenders` | `array` | Exact addresses whose inbound mail is emitted by poll() |
| `approvedRecipients` | `array` | Addresses outbound mail may be sent to |
| `cursorStore` | `string` | Store name holding the poll cursor (default "internet-mail") |
| `cursorScope` | `string` | Store scope for the cursor (default 'project') |
| `imap` | `object` | Explicit IMAP transport override |
| `smtp` | `object` | Explicit SMTP transport override |

## Methods

### resolveConfig

Apply the provider preset and its username style to the feature options. Never throws, so callers can inspect a half-configured account (that's what `verify()` reports on); `requireConfig()` enforces the required fields at the point of use. The password is deliberately absent from the result — it is read only inside {@link readPassword}.

**Returns:** `ResolvedMailConfig`



### createImapClient

Build a connected-ready ImapFlow client. Tests override this with a fake.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `ResolvedMailConfig` | ✓ | Parameter config |

`ResolvedMailConfig` properties:

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `string` |  |
| `address` | `string` |  |
| `imapUsername` | `string` |  |
| `smtpUsername` | `string` |  |
| `passwordEnv` | `string` |  |
| `mailbox` | `string` |  |
| `pollIntervalMs` | `number` |  |
| `maxMessageBytes` | `number` |  |
| `markAsRead` | `boolean` |  |
| `outboundEnabled` | `boolean` |  |
| `trustedSenders` | `string[]` |  |
| `approvedRecipients` | `string[]` |  |
| `imap` | `MailTransportConfig` |  |
| `smtp` | `MailTransportConfig` |  |

**Returns:** `Promise<any>`



### createSmtpTransport

Build a Nodemailer SMTP transport. Tests override this with a fake.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `ResolvedMailConfig` | ✓ | Parameter config |

`ResolvedMailConfig` properties:

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `string` |  |
| `address` | `string` |  |
| `imapUsername` | `string` |  |
| `smtpUsername` | `string` |  |
| `passwordEnv` | `string` |  |
| `mailbox` | `string` |  |
| `pollIntervalMs` | `number` |  |
| `maxMessageBytes` | `number` |  |
| `markAsRead` | `boolean` |  |
| `outboundEnabled` | `boolean` |  |
| `trustedSenders` | `string[]` |  |
| `approvedRecipients` | `string[]` |  |
| `imap` | `MailTransportConfig` |  |
| `smtp` | `MailTransportConfig` |  |

**Returns:** `Promise<any>`



### parseSource

Parse raw RFC 822 source. Tests override this to avoid mailparser.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `Buffer | string` | ✓ | Parameter source |

**Returns:** `Promise<any>`



### readCursor

The persisted cursor, or null before the first baseline.

**Returns:** `Promise<MailCursor | null>`



### verify

Check the configuration, secret, IMAP login, and SMTP login independently. Never throws — every failure becomes a structured verdict.

**Returns:** `Promise<MailVerification>`



### start

Validate config, then poll immediately and on the configured interval.

**Returns:** `Promise<this>`



### stop

Clear the interval, wait for an active poll, close SMTP. Cursor stays.

**Returns:** `Promise<this>`



### poll

One poll pass: baseline or advance the UID cursor, emit each new trusted message once. Overlapping calls coalesce onto the in-flight pass.

**Returns:** `Promise<MailPollResult>`



### checkInbox

The most recent messages in the configured mailbox, metadata only.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ limit?: number }` |  | Parameter options |

**Returns:** `Promise<MailSummary[]>`



### readMessage

Read one full message by opaque id. Never alters unread state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | Parameter id |

**Returns:** `Promise<StandardMailMessage>`



### searchMessages

Interrogate the full archive with IMAP SEARCH. Independent of the poll cursor — never advances `lastUid`, never alters unread state. A `from`/`to` value without an `@` is treated as a bare domain and matched as `@domain`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `MailSearchQuery` | ✓ | Parameter query |

`MailSearchQuery` properties:

| Property | Type | Description |
|----------|------|-------------|
| `from` | `string` |  |
| `to` | `string` |  |
| `subject` | `string` |  |
| `text` | `string` |  |
| `since` | `string` |  |
| `before` | `string` |  |
| `options` | `{ limit?: number }` |  | Parameter options |

**Returns:** `Promise<MailSummary[]>`



### isApprovedRecipient

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `address` | `string` | ✓ | Parameter address |

**Returns:** `boolean`



### sendMessage

Send a new message. Requires `outboundEnabled` and approved recipients.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `MailSendInput` | ✓ | Parameter input |

`MailSendInput` properties:

| Property | Type | Description |
|----------|------|-------------|
| `to` | `string | string[]` |  |
| `cc` | `string | string[]` |  |
| `subject` | `string` |  |
| `text` | `string` |  |
| `html` | `string` |  |

**Returns:** `Promise<MailSendResult>`



### replyToMessage

Threaded reply to the original sender only.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `MailReplyInput` | ✓ | Parameter input |

`MailReplyInput` properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` |  |
| `text` | `string` |  |
| `html` | `string` |  |

**Returns:** `Promise<MailSendResult>`



### replyAllToMessage

Threaded reply to the full To/Cc set, minus anyone not on the allowlist. Fails rather than sending to nobody when filtering empties the set.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `MailReplyInput` | ✓ | Parameter input |

`MailReplyInput` properties:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` |  |
| `text` | `string` |  |
| `html` | `string` |  |

**Returns:** `Promise<MailSendResult & { withheld: string[] }>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `cursorStore` | `any` | The store holding the poll cursor. A durable JSON document rather than in-process state: two processes polling the same mailbox must agree on what has already been delivered, and a restart has to resume rather than replay. |
| `isStarted` | `any` |  |

## Events (Zod v4 schema)

### log

Event emitted by InternetMail



### started

Event emitted by InternetMail



### stopped

Event emitted by InternetMail



### poll:error

Event emitted by InternetMail



### message

Event emitted by InternetMail



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `started` | `boolean` |  |
| `polling` | `boolean` |  |
| `lastPollAt` | `any` |  |
| `emittedCount` | `number` |  |

## Examples

**features.internetMail**

```ts
const mail = container.feature('internetMail')
const report = await mail.verify()
const recent = await mail.checkInbox({ limit: 5 })
const hits = await mail.searchMessages({ from: 'example.com', text: 'invoice' })
```

