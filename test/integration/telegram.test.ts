import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'

const telegramToken = requireEnv('TELEGRAM_BOT_TOKEN')

describeWithRequirements('Telegram Integration', [telegramToken], () => {
  let container: any
  let tg: any

  beforeAll(async () => {
    container = createAGIContainer()
    tg = container.feature('telegram', {
      token: telegramToken.value,
      autoStart: false,
      pollingTimeout: 0,
    })
    await tg.enable()
  })

  it(
    'getMe returns bot info',
    async () => {
      const me = await tg.getMe()
      expect(me).toBeDefined()
      expect(me.id).toBeDefined()
      expect(typeof me.first_name).toBe('string')
      expect(me.is_bot).toBe(true)
    },
    API_TIMEOUT
  )

  it('command registration works', () => {
    tg.command('test_integ', (ctx: any) => ctx.reply('test'))
    // If command registration didn't throw, it's working
    expect(true).toBe(true)
  })

  it('bot instance is accessible', () => {
    expect(tg.bot).toBeDefined()
    expect(tg.bot.api).toBeDefined()
  })
})
