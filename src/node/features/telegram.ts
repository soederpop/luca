import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { Bot, webhookCallback, type Context, type Middleware } from 'grammy'

type UserFromGetMe = Awaited<ReturnType<Bot['api']['getMe']>>

export const TelegramBotInfoSchema = z.object({
  id: z.number().describe('Bot user ID'),
  firstName: z.string().describe('Bot first name'),
  username: z.string().optional().describe('Bot username'),
  canJoinGroups: z.boolean().optional().describe('Whether the bot can be added to groups'),
  canReadAllGroupMessages: z.boolean().optional().describe('Whether the bot can read all group messages'),
})

export const TelegramStateSchema = FeatureStateSchema.extend({
  mode: z.enum(['polling', 'webhook', 'idle']).default('idle')
    .describe('Current operation mode'),
  isRunning: z.boolean().default(false)
    .describe('Whether the bot is currently receiving updates'),
  webhookUrl: z.string().optional()
    .describe('Active webhook URL if in webhook mode'),
  commandsRegistered: z.array(z.string()).default([])
    .describe('List of registered command names'),
  lastError: z.string().optional()
    .describe('Last error message'),
  botInfo: TelegramBotInfoSchema.optional()
    .describe('Bot user information from Telegram API'),
})
export type TelegramState = z.infer<typeof TelegramStateSchema>

export const TelegramOptionsSchema = FeatureOptionsSchema.extend({
  token: z.string().optional()
    .describe('Bot token from @BotFather (falls back to TELEGRAM_BOT_TOKEN env var)'),
  mode: z.enum(['polling', 'webhook']).default('polling')
    .describe('Update mode: polling for long-polling, webhook for HTTP callbacks'),
  webhookUrl: z.string().optional()
    .describe('Public HTTPS URL for webhook mode'),
  webhookPath: z.string().default('/telegram/webhook')
    .describe('HTTP path for the webhook endpoint'),
  webhookPort: z.number().optional()
    .describe('Port for webhook Express server'),
  autoStart: z.boolean().optional()
    .describe('Automatically start the bot when enabled'),
  dropPendingUpdates: z.boolean().optional()
    .describe('Drop pending updates on start (polling mode)'),
  pollingTimeout: z.number().min(0).default(1)
    .describe('Long-polling timeout in seconds. Lower = faster response. 0 = short polling (fastest, testing only). Default 1s.'),
  pollingLimit: z.number().min(1).max(100).optional()
    .describe('Max updates per polling request (1-100, default 100)'),
  allowedUpdates: z.array(z.string()).optional()
    .describe('Update types to receive (e.g. ["message", "callback_query"])'),
})
export type TelegramOptions = z.infer<typeof TelegramOptionsSchema>

export const TelegramEventsSchema = FeatureEventsSchema.extend({
  started: z.tuple([z.object({ mode: z.string() })]).describe('Bot started receiving updates'),
  stopped: z.tuple([]).describe('Bot stopped'),
  error: z.tuple([z.any()]).describe('Error occurred'),
  command: z.tuple([z.string(), z.any()]).describe('Command triggered: [name, Context]'),
  webhook_ready: z.tuple([z.string()]).describe('Webhook registered and ready'),
})

/**
 * Telegram bot feature powered by grammY.
 *
 * Supports both long-polling and webhook modes. Exposes the grammY Bot instance
 * directly for full API access while bridging events to Luca's event bus.
 *
 * @example
 * ```typescript
 * const tg = container.feature('telegram', { autoStart: true })
 * tg.command('start', (ctx) => ctx.reply('Hello!'))
 * tg.handle('message:text', (ctx) => ctx.reply(`Echo: ${ctx.message.text}`))
 * ```
 */
export class Telegram extends Feature<TelegramState, TelegramOptions> {
  static override shortcut = 'features.telegram' as const
  static override envVars = ['TELEGRAM_BOT_TOKEN']
  static override stateSchema = TelegramStateSchema
  static override optionsSchema = TelegramOptionsSchema
  static override eventsSchema = TelegramEventsSchema

  private _bot?: Bot

  override get initialState(): TelegramState {
    return {
      ...super.initialState,
      mode: 'idle',
      isRunning: false,
      commandsRegistered: [],
    }
  }

  /** Bot token from options or TELEGRAM_BOT_TOKEN env var. */
  get token(): string {
    const token = this.options.token || process.env.TELEGRAM_BOT_TOKEN
    if (!token) {
      throw new Error('Telegram bot token required. Set options.token or TELEGRAM_BOT_TOKEN env var.')
    }
    return token
  }

  /** The grammY Bot instance. Created lazily on first access. */
  get bot(): Bot {
    if (!this._bot) {
      this._bot = new Bot(this.token)
      this._setupErrorHandling()
    }
    return this._bot
  }

  /** Whether the bot is currently receiving updates. */
  get isRunning(): boolean {
    return this.state.get('isRunning') || false
  }

  /** Current operation mode: 'polling', 'webhook', or 'idle'. */
  get mode(): 'polling' | 'webhook' | 'idle' {
    return this.state.get('mode') || 'idle'
  }

  /** Access chalk colors via the container's UI feature. */
  private get c() {
    return this.container.feature('ui').colors
  }

  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)

    const c = this.c
    console.log(c.cyan.bold('\n🤖 Telegram Bot'))
    console.log(c.dim('─'.repeat(40)))

    try {
      const me = await this.bot.api.getMe()
      this.setState({
        botInfo: {
          id: me.id,
          firstName: me.first_name,
          username: me.username,
          canJoinGroups: me.can_join_groups,
          canReadAllGroupMessages: me.can_read_all_group_messages,
        }
      })
      console.log(`${c.green('✓')} Authenticated as ${c.bold(`@${me.username}`)} ${c.dim(`(id: ${me.id})`)}`)
    } catch (err: any) {
      this.setState({ lastError: err.message })
      console.log(`${c.red('✗')} Auth failed: ${c.red(err.message)}`)
    }

    console.log(`${c.dim('  mode:')} ${this.options.mode || 'polling'}`)

    if (this.options.autoStart) {
      await this.start()
    }

    return this
  }

  /** Start the bot in the configured mode (polling or webhook). */
  async start(): Promise<this> {
    if (this.isRunning) return this

    if (this.options.mode === 'webhook') {
      await this.setupWebhook()
    } else {
      await this.startPolling()
    }

    return this
  }

  /** Stop the bot gracefully. */
  async stop(): Promise<this> {
    if (!this.isRunning) return this

    const c = this.c
    if (this.mode === 'polling') {
      await this.bot.stop()
    } else if (this.mode === 'webhook') {
      await this.deleteWebhook()
    }

    this.setState({ isRunning: false, mode: 'idle' })
    this.emit('stopped')
    console.log(`${c.yellow('⏹')} Bot stopped`)
    return this
  }

  /** Register a command handler. Also emits 'command' on the Luca event bus. */
  command(name: string, handler: (ctx: Context) => any): this {
    this.bot.command(name, async (ctx) => {
      this.emit('command', name, ctx)
      await handler(ctx)
    })

    const registered = this.state.get('commandsRegistered') || []
    if (!registered.includes(name)) {
      this.setState({ commandsRegistered: [...registered, name] })
    }
    return this
  }

  /**
   * Register a grammY update handler (filter query).
   * Named 'handle' to avoid collision with the inherited on() event bus method.
   *
   * @example
   * ```typescript
   * tg.handle('message:text', (ctx) => ctx.reply('Got text'))
   * tg.handle('callback_query:data', (ctx) => ctx.answerCallbackQuery('Clicked'))
   * ```
   */
  handle(filter: Parameters<Bot['on']>[0], handler: (ctx: any) => any): this {
    this.bot.on(filter, handler)
    return this
  }

  /** Add grammY middleware. */
  use(...middleware: Middleware[]): this {
    for (const mw of middleware) {
      this.bot.use(mw)
    }
    return this
  }

  /** Start long-polling mode. */
  async startPolling(dropPendingUpdates?: boolean): Promise<this> {
    const drop = dropPendingUpdates ?? this.options.dropPendingUpdates ?? false
    const c = this.c

    const timeout = this.options.pollingTimeout ?? 1
    const limit = this.options.pollingLimit

    // bot.start() is non-blocking internally (starts polling loop)
    this.bot.start({
      drop_pending_updates: drop,
      allowed_updates: this.options.allowedUpdates as any,
      timeout,
      ...(limit ? { limit } : {}),
    })

    this.setState({ isRunning: true, mode: 'polling' })
    this.emit('started', { mode: 'polling' })

    const cmds = this.state.get('commandsRegistered') || []
    console.log(`${c.green('▶')} Polling for updates ${c.dim(`(timeout: ${timeout}s)`)}${drop ? c.dim(' (dropped pending)') : ''}`)
    if (cmds.length) {
      console.log(`${c.dim('  commands:')} ${cmds.map(cmd => c.cyan(`/${cmd}`)).join(', ')}`)
    }
    console.log(c.dim('─'.repeat(40)))
    return this
  }

  /** Set up webhook mode with an Express server. */
  async setupWebhook(url?: string, path?: string): Promise<this> {
    const webhookUrl = url || this.options.webhookUrl
    const webhookPath = path || this.options.webhookPath || '/telegram/webhook'

    if (!webhookUrl) {
      throw new Error('webhookUrl required for webhook mode. Set options.webhookUrl or pass it to setupWebhook().')
    }

    const server = this.container.server('express', {
      port: this.options.webhookPort,
    }) as any

    server.app.use(webhookPath, webhookCallback(this.bot, 'express'))

    if (!server.isListening) {
      const port = this.options.webhookPort || await this.container.networking.findOpenPort(3000)
      await server.start({ port })
    }

    const fullUrl = `${webhookUrl.replace(/\/$/, '')}${webhookPath}`
    await this.bot.api.setWebhook(fullUrl, {
      allowed_updates: this.options.allowedUpdates as any,
    })

    this.setState({ isRunning: true, mode: 'webhook', webhookUrl: fullUrl })
    this.emit('webhook_ready', fullUrl)
    this.emit('started', { mode: 'webhook' })

    const c = this.c
    const cmds = this.state.get('commandsRegistered') || []
    console.log(`${c.green('▶')} Webhook active at ${c.underline(fullUrl)}`)
    if (cmds.length) {
      console.log(`${c.dim('  commands:')} ${cmds.map(cmd => c.cyan(`/${cmd}`)).join(', ')}`)
    }
    console.log(c.dim('─'.repeat(40)))
    return this
  }

  /** Remove the webhook from Telegram. */
  async deleteWebhook(): Promise<this> {
    await this.bot.api.deleteWebhook()
    this.setState({ webhookUrl: undefined })
    return this
  }

  /** Get bot info from Telegram API. */
  async getMe(): Promise<UserFromGetMe> {
    return await this.bot.api.getMe()
  }

  /** Print a diagnostic summary of the bot's current state. */
  diagnostics(): this {
    const c = this.c
    const info = this.state.get('botInfo')
    const cmds = this.state.get('commandsRegistered') || []
    const err = this.state.get('lastError')

    console.log(c.cyan.bold('\n🤖 Telegram Bot Diagnostics'))
    console.log(c.dim('─'.repeat(40)))
    console.log(`  ${c.dim('bot:')}       ${info ? `@${info.username} ${c.dim(`(${info.id})`)}` : c.yellow('not authenticated')}`)
    console.log(`  ${c.dim('status:')}    ${this.isRunning ? c.green('running') : c.yellow('stopped')}`)
    console.log(`  ${c.dim('mode:')}      ${this.mode}`)
    if (this.mode === 'webhook') {
      console.log(`  ${c.dim('webhook:')}   ${this.state.get('webhookUrl') || 'n/a'}`)
    }
    console.log(`  ${c.dim('commands:')}  ${cmds.length ? cmds.map(cmd => c.cyan(`/${cmd}`)).join(', ') : c.dim('none')}`)
    if (info?.canJoinGroups) {
      console.log(`  ${c.dim('groups:')}    ${c.green('can join')}`)
    }
    if (err) {
      console.log(`  ${c.dim('error:')}     ${c.red(err)}`)
    }
    console.log(c.dim('─'.repeat(40)))
    return this
  }

  private _setupErrorHandling(): void {
    this.bot.catch((err) => {
      this.setState({ lastError: err.message })
      this.emit('error', err)
    })
  }

}

export default features.register('telegram', Telegram)
