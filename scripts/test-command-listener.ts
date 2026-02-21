import { NodeContainer } from '../src/node/container'

const container = new NodeContainer({ cwd: process.cwd() })
const listener = container.feature('launcherAppCommandListener', {
  autoListen: true,
})

const windowManager = container.feature('windowManager')

console.log('Listening on:', listener.state.get('socketPath'))
console.log('Waiting for native app to connect...\n')

listener.enable()

listener.on('clientConnected', () => {
  console.log('[connected] Native app connected')
})

listener.on('clientDisconnected', () => {
  console.log('[disconnected] Native app disconnected')
})

listener.on('command', async (cmd) => {
  console.log(`[command] "${cmd.text}" (source: ${cmd.source}, id: ${cmd.id})`)

  const normalizedText = String(cmd.text).toLowerCase()

  if (normalizedText.includes('terminal')) {
    await container.sleep(1000)
    cmd.ack('Sheeeeeeeit.  I got you fam!')
    await container.sleep(1000)
    console.log('Spawning terminal')
    const result = await windowManager.spawnTTY({ 
      command: '/Users/jon/.bun/bin/bun',
      args: ['run', '/Users/jon/@luca/src/cli/cli.ts', 'serve', '--force', '--port', '3080', '--no-open'],
      cwd: '/Users/jon/@soederpop/playground/writing-assistant',
      title: 'Writing Assistant Server',
      cols: 120,
      rows: 40,
      width: 1000,
      height: 700,
    })

    await container.sleep(4000)

    cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'Check that shit out playboy. Fuckin terminal output.' })

    return
  } else if (normalizedText.includes('web') || normalizedText.includes('browser')) {
    cmd.ack('YOOOOOO. Fuckin check this out, twin.')
    await container.sleep(1000)
    const result = await windowManager.spawn({
      url: 'https://google.com',
      width: 1000,
      height: 700,
    })

    console.log('Web browser spawned', result)

    await container.sleep(3000)
    cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'Motherfucker I can even launch web browsers' })
    return
  } else if (normalizedText.includes('write')) {
    await container.sleep(1000)
    cmd.ack('Writing? Sure thing, playBWAH!')
    const result = await windowManager.spawn({
      url: 'http://localhost:3080',
      width: 1200,
      height: 900,
    })
    
    await container.sleep(4000)
    cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'Let this motherfuckin boy COOK... SON.' })
    return
  }


  await container.sleep(4000)
  cmd.ack('Look unc. I dont know the fuck you talmbout.')
  cmd.finish({ result: { action: 'unknown' }})
})

listener.on('message', (msg) => {
  console.log('[message]', JSON.stringify(msg))
})
