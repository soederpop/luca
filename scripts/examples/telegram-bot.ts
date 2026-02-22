import container from '@soederpop/luca/node'

const ui = container.feature('ui')
const tg = container.feature('telegram', {
  autoStart: false,
  mode: 'polling',
  webhookPath: '/telegram/webhook',
  pollingTimeout: 1,
})

function nowStamp(): string {
  const dt = new Date()
  const hh = String(dt.getHours()).padStart(2, '0')
  const mm = String(dt.getMinutes()).padStart(2, '0')
  const ss = String(dt.getSeconds()).padStart(2, '0')
  return `${hh}:${mm}:${ss}`
}

function log(line: string, color = 'white') {
  const stamp = ui.colors.dim(`[${nowStamp()}]`)
  const palette = ui.colors as any
  const painter = typeof palette[color] === 'function' ? palette[color] : ((value: string) => value)
  console.log(`${stamp} ${painter(line)}`)
}

tg.command('start', async (ctx) => {
  await ctx.reply('Neon channel online. Send any text and I will echo it back.')
})

tg.command('status', async (ctx) => {
  await ctx.reply(`running=${tg.isRunning} mode=${tg.mode}`)
})

tg.handle('message:text', async (ctx) => {
  const text = (ctx.message as any)?.text || ''
  const from = ctx.from?.username ? `@${ctx.from.username}` : String(ctx.from?.id || 'unknown')
  log(`message from ${from}: ${text}`, 'cyan')
  await ctx.reply(`echo: ${text}`)
})

tg.on('error', (err: any) => {
  log(`telegram error: ${err?.message || String(err)}`, 'red')
})

tg.on('command', (name: string, ctx: any) => {
  const from = ctx?.from?.username ? `@${ctx.from.username}` : String(ctx?.from?.id || 'unknown')
  log(`command /${name} by ${from}`, 'yellow')
})

process.on('SIGINT', async () => {
  log('shutting down telegram bot (SIGINT)', 'yellow')
  await tg.stop()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  log('shutting down telegram bot (SIGTERM)', 'yellow')
  await tg.stop()
  process.exit(0)
})

async function main() {
  log('starting telegram bot feature...', 'green')
  await tg.enable()
  await tg.start()

  const botInfo = tg.state.get('botInfo')
  if (botInfo?.username) {
    log(`bot is live as @${botInfo.username}`, 'green')
  }

  log('awaiting telegram updates...', 'magenta')

  await new Promise<void>(() => {
    // keep process alive while grammY polling runs
  })
}

await main()
