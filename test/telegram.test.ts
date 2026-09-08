import { afterEach, beforeEach, describe, expect, it, mock, spyOn, type Mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import type { Telegram } from '../src/node/features/telegram'
let c: NodeContainer
let telegram: Telegram
let log: Mock<typeof console.log>
let oldToken: string | undefined
const me = { id: 123, is_bot: true as const, first_name: 'Test Bot', username: 'test_bot', can_join_groups: true, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false }
const update = (text: string, command = false) => ({ update_id: 1, message: { message_id: 1, date: 1, chat: { id: 10, type: 'private' as const, first_name: 'Tester' }, from: { id: 20, is_bot: false, first_name: 'Tester' }, text, ...(command ? { entities: [{ offset: 0, length: text.length, type: 'bot_command' as const }] } : {}) } })
beforeEach(() => {
  oldToken = process.env.TELEGRAM_BOT_TOKEN; delete process.env.TELEGRAM_BOT_TOKEN
  c = new NodeContainer(); telegram = c.feature('telegram', { token: '123:fake-test-token' })
  log = spyOn(console, 'log').mockImplementation(() => {})
  telegram.bot.api.config.use(async (_prev, method) => {
    if (method === 'getMe') return { ok: true, result: me } as any
    throw new Error(`Unexpected Telegram request: ${method}`)
  })
})
afterEach(() => {
  log.mockRestore()
  if (oldToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN; else process.env.TELEGRAM_BOT_TOKEN = oldToken
})

describe('Telegram feature with an isolated bot', () => {
  it('requires a token and lets explicit configuration override environment', () => {
    expect(() => new NodeContainer().feature('telegram').token).toThrow('Telegram bot token required')
    process.env.TELEGRAM_BOT_TOKEN = '456:environment-test'
    expect(new NodeContainer().feature('telegram').token).toBe('456:environment-test')
    expect(telegram.token).toBe('123:fake-test-token')
    expect(telegram.bot).toBe(telegram.bot)
  })
  it('starts idle and stores normalized bot info when enabled', async () => {
    expect(telegram.isRunning).toBe(false); expect(telegram.mode).toBe('idle')
    expect(await telegram.enable()).toBe(telegram)
    expect(telegram.state.get('botInfo')).toEqual({ id: 123, firstName: 'Test Bot', username: 'test_bot', canJoinGroups: true, canReadAllGroupMessages: false })
    expect(await telegram.getMe()).toEqual(me)
  })
  it('records authentication failures without claiming bot metadata', async () => {
    telegram.bot.api.config.use(async () => { throw new Error('bad token') })
    await telegram.enable()
    expect(telegram.state.get('lastError')).toBe('bad token')
    expect(telegram.state.get('botInfo')).toBeUndefined()
  })
  it('registers command handlers, emits command events and deduplicates command names', async () => {
    const handler = mock(() => {}); const event = mock(() => {})
    telegram.on('command', event)
    expect(telegram.command('hello', handler)).toBe(telegram)
    telegram.command('hello', handler)
    expect(telegram.state.get('commandsRegistered')).toEqual(['hello'])
    await telegram.bot.init(); await telegram.bot.handleUpdate(update('/hello', true))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(event).toHaveBeenCalledWith('hello', expect.any(Object))
  })
  it('runs middleware and message filters in order', async () => {
    const seen: string[] = []
    expect(telegram.use(async (_ctx, next) => { seen.push('before'); await next(); seen.push('after') })).toBe(telegram)
    expect(telegram.handle('message:text', () => { seen.push('message') })).toBe(telegram)
    await telegram.bot.init(); await telegram.bot.handleUpdate(update('hello'))
    expect(seen).toEqual(['before', 'message', 'after'])
  })
  it('starts and stops polling idempotently without opening a polling loop', async () => {
    const start = spyOn(telegram.bot, 'start').mockResolvedValue(undefined)
    const stop = spyOn(telegram.bot, 'stop').mockResolvedValue(undefined)
    const started = mock(() => {}); const stopped = mock(() => {})
    telegram.on('started', started); telegram.on('stopped', stopped)
    try {
      expect(await telegram.start()).toBe(telegram); await telegram.start()
      expect(start).toHaveBeenCalledTimes(1)
      expect(start.mock.calls[0]![0]).toMatchObject({ drop_pending_updates: false, timeout: 1 })
      expect(telegram.mode).toBe('polling'); expect(telegram.isRunning).toBe(true)
      await telegram.stop(); await telegram.stop()
      expect(stop).toHaveBeenCalledTimes(1)
      expect(telegram.mode).toBe('idle'); expect(telegram.isRunning).toBe(false)
      expect(started).toHaveBeenCalledWith({ mode: 'polling' }); expect(stopped).toHaveBeenCalledTimes(1)
    } finally { start.mockRestore(); stop.mockRestore() }
  })
  it('passes explicit polling configuration and auto-starts only when requested', async () => {
    const bot = c.feature('telegram', { token: '456:another-test-token', autoStart: true, pollingTimeout: 0, pollingLimit: 5, dropPendingUpdates: true, allowedUpdates: ['message'] })
    bot.bot.api.config.use(async () => ({ ok: true, result: me }) as any)
    const start = spyOn(bot.bot, 'start').mockResolvedValue(undefined)
    try {
      await bot.enable()
      expect(start).toHaveBeenCalledWith({ drop_pending_updates: true, timeout: 0, limit: 5, allowed_updates: ['message'] })
    } finally { start.mockRestore() }
  })
  it('requires a public webhook URL before creating a server', async () => {
    await expect(telegram.setupWebhook()).rejects.toThrow('webhookUrl required')
  })
  it('registers webhook middleware and URL, then removes the remote webhook on stop', async () => {
    const use = mock(() => {}); const start = mock(async () => {})
    const server = spyOn(c, 'server').mockReturnValue({ app: { use }, isListening: true, start } as any)
    const api = mock(async (_method: string, _payload: any) => ({ ok: true, result: true }) as any)
    telegram.bot.api.config.use(async (_prev, method, payload) => api(method, payload))
    const ready = mock(() => {}); telegram.on('webhook_ready', ready)
    try {
      await telegram.setupWebhook('https://example.test/', '/hook')
      expect(use).toHaveBeenCalledWith('/hook', expect.any(Function))
      expect(start).not.toHaveBeenCalled()
      expect(api).toHaveBeenCalledWith('setWebhook', expect.objectContaining({ url: 'https://example.test/hook' }))
      expect(telegram.mode).toBe('webhook'); expect(ready).toHaveBeenCalledWith('https://example.test/hook')
      await telegram.stop()
      expect(api.mock.calls.at(-1)?.[0]).toBe('deleteWebhook')
      expect(telegram.state.get('webhookUrl')).toBeUndefined()
      expect(telegram.mode).toBe('idle')
    } finally { server.mockRestore() }
  })
  it('diagnostics summarize known state without fetching remote data', () => {
    telegram.state.set('lastError', 'last failure')
    expect(telegram.diagnostics()).toBe(telegram)
    expect(log.mock.calls.map(args => String(args[0])).join('\n')).toContain('last failure')
  })
})
