# Telegram (features.telegram)

> Stability: `stable`

Telegram bot feature powered by grammY. Supports both long-polling and webhook modes. Exposes the grammY Bot instance directly (via `.bot`) for full API access while bridging Telegram events to Luca's event bus — `started`, `stopped`, `command`, `webhook_ready`, and `error` all fire as container events, so other features can react to bot activity. Requires a bot token from @BotFather: set the `TELEGRAM_BOT_TOKEN` environment variable (read automatically) or pass `token` explicitly as an option.

## Usage

```ts
container.feature('telegram', {
  // Bot token from @BotFather (falls back to TELEGRAM_BOT_TOKEN env var)
  token,
  // Update mode: polling for long-polling, webhook for HTTP callbacks
  mode,
  // Public HTTPS URL for webhook mode
  webhookUrl,
  // HTTP path for the webhook endpoint
  webhookPath,
  // Port for webhook Express server
  webhookPort,
  // Automatically start the bot when enabled
  autoStart,
  // Drop pending updates on start (polling mode)
  dropPendingUpdates,
  // Long-polling timeout in seconds. Lower = faster response. 0 = short polling (fastest, testing only). Default 1s.
  pollingTimeout,
  // Max updates per polling request (1-100, default 100)
  pollingLimit,
  // Update types to receive (e.g. ["message", "callback_query"])
  allowedUpdates,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `token` | `string` | Bot token from @BotFather (falls back to TELEGRAM_BOT_TOKEN env var) |
| `mode` | `string` | Update mode: polling for long-polling, webhook for HTTP callbacks |
| `webhookUrl` | `string` | Public HTTPS URL for webhook mode |
| `webhookPath` | `string` | HTTP path for the webhook endpoint |
| `webhookPort` | `number` | Port for webhook Express server |
| `autoStart` | `boolean` | Automatically start the bot when enabled |
| `dropPendingUpdates` | `boolean` | Drop pending updates on start (polling mode) |
| `pollingTimeout` | `number` | Long-polling timeout in seconds. Lower = faster response. 0 = short polling (fastest, testing only). Default 1s. |
| `pollingLimit` | `number` | Max updates per polling request (1-100, default 100) |
| `allowedUpdates` | `array` | Update types to receive (e.g. ["message", "callback_query"]) |

## Methods

### enable

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Parameter options |

**Returns:** `Promise<this>`



### start

Start the bot in the configured mode (polling or webhook). In polling mode the bot continuously fetches updates from Telegram until you call `stop()`. The `started` event fires on the Luca event bus with `{ mode }`. Calling `start()` while already running is a no-op.

**Returns:** `Promise<this>`

```ts
// (no-run) requires TELEGRAM_BOT_TOKEN
await tg.start()
console.log(tg.isRunning) // true
console.log(tg.mode)      // 'polling' (or 'webhook')
```



### stop

Stop the bot gracefully.

**Returns:** `Promise<this>`



### command

Register a command handler. Also emits 'command' on the Luca event bus, and tracks the command name in `state.get('commandsRegistered')`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `handler` | `(ctx: Context) => any` | ✓ | Parameter handler |

**Returns:** `this`

```ts
// (no-run) requires TELEGRAM_BOT_TOKEN
tg.command('start', (ctx) => ctx.reply('Welcome! I am your Luca bot.'))
tg.command('ping', (ctx) => ctx.reply('Pong!'))
console.log(tg.state.get('commandsRegistered')) // ['start', 'ping']
```



### handle

Register a grammY update handler (filter query). Named 'handle' to avoid collision with the inherited on() event bus method. Maps directly to grammY's `bot.on()` and supports all grammY filter queries, e.g. `message:text`, `message:photo`, `edited_message`, `callback_query:data`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filter` | `Parameters<Bot['on']>[0]` | ✓ | Parameter filter |
| `handler` | `(ctx: any) => any` | ✓ | Parameter handler |

**Returns:** `this`

```ts
// (no-run) requires TELEGRAM_BOT_TOKEN
tg.handle('message:text', (ctx) => ctx.reply(`Echo: ${ctx.message.text}`))
tg.handle('callback_query:data', (ctx) => ctx.answerCallbackQuery('Button clicked!'))
```



### use

Add grammY middleware.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `middleware` | `Middleware[]` | ✓ | Parameter middleware |

**Returns:** `this`



### startPolling

Start long-polling mode.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dropPendingUpdates` | `boolean` |  | Parameter dropPendingUpdates |

**Returns:** `Promise<this>`



### setupWebhook

Set up webhook mode with an Express server.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` |  | Parameter url |
| `path` | `string` |  | Parameter path |

**Returns:** `Promise<this>`



### deleteWebhook

Remove the webhook from Telegram.

**Returns:** `Promise<this>`



### getMe

Get bot info from Telegram API.

**Returns:** `Promise<UserFromGetMe>`



### diagnostics

Print a diagnostic summary of the bot's current state.

**Returns:** `this`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `token` | `string` | Bot token from options or TELEGRAM_BOT_TOKEN env var. |
| `bot` | `Bot` | The grammY Bot instance. Created lazily on first access. |
| `isRunning` | `boolean` | Whether the bot is currently receiving updates. |
| `mode` | `'polling' | 'webhook' | 'idle'` | Current operation mode: 'polling', 'webhook', or 'idle'. |

## Events (Zod v4 schema)

### stopped

Bot stopped



### command

Command triggered: [name, Context]

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` |  |
| `arg1` | `any` |  |



### started

Bot started receiving updates

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `mode` | `string` |  |



### webhook_ready

Webhook registered and ready

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` |  |



### error

Error occurred

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `mode` | `string` | Current operation mode |
| `isRunning` | `boolean` | Whether the bot is currently receiving updates |
| `webhookUrl` | `string` | Active webhook URL if in webhook mode |
| `commandsRegistered` | `array` | List of registered command names |
| `lastError` | `string` | Last error message |
| `botInfo` | `object` | Bot user information from Telegram API |

## Environment Variables

- `TELEGRAM_BOT_TOKEN`

## Examples

**features.telegram**

```ts
// (no-run) requires TELEGRAM_BOT_TOKEN
const tg = container.feature('telegram', {
 mode: 'polling',            // or 'webhook'
 dropPendingUpdates: true,   // skip updates queued while offline
})

// Register bot commands — each also emits a 'command' event on the Luca event bus
tg.command('start', (ctx) => ctx.reply('Welcome! I am your Luca bot.'))
tg.command('help', (ctx) => ctx.reply('Available: /start, /help, /ping'))
tg.command('ping', (ctx) => ctx.reply('Pong!'))

// Handle any grammY filter query (message:text, message:photo, callback_query:data, ...)
tg.handle('message:text', (ctx) => ctx.reply(`Echo: ${ctx.message.text}`))

// Start receiving updates; in polling mode this fetches continuously
await tg.start()
console.log('Bot is running:', tg.isRunning)   // true
console.log('Mode:', tg.mode)                  // 'polling'
console.log('Commands:', tg.state.get('commandsRegistered')) // ['start', 'help', 'ping']

// ... later, shut down gracefully (fires the 'stopped' event)
await tg.stop()
```



**start**

```ts
// (no-run) requires TELEGRAM_BOT_TOKEN
await tg.start()
console.log(tg.isRunning) // true
console.log(tg.mode)      // 'polling' (or 'webhook')
```



**command**

```ts
// (no-run) requires TELEGRAM_BOT_TOKEN
tg.command('start', (ctx) => ctx.reply('Welcome! I am your Luca bot.'))
tg.command('ping', (ctx) => ctx.reply('Pong!'))
console.log(tg.state.get('commandsRegistered')) // ['start', 'ping']
```



**handle**

```ts
// (no-run) requires TELEGRAM_BOT_TOKEN
tg.handle('message:text', (ctx) => ctx.reply(`Echo: ${ctx.message.text}`))
tg.handle('callback_query:data', (ctx) => ctx.answerCallbackQuery('Button clicked!'))
```

