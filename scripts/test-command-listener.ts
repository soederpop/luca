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
      args: ['run', '/Users/jon/@luca/src/cli/cli.ts', 'console'],
      cwd: '/Users/jon/@soederpop',
      title: 'The Console',
      cols: 120,
      rows: 40,
      width: 1000,
      height: 700,
    })

    await container.sleep(4000)

    cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'Check that shit out playboy. Fuckin terminal output.' })

    return
  } else if (normalizedText.includes('code')) {
    await container.sleep(1000)
    cmd.ack('Real talk, I feel for the homies we told to learn to code.  Now that claude is on this shit?? I mean.')
    await container.sleep(1000)
    console.log('Spawning terminal')
    const result = await windowManager.spawnTTY({ 
      command: '/Users/jon/.bun/bin/claude',
      cwd: '/Users/jon/@soederpop',
      title: 'Claude',
      cols: 120,
      rows: 80,
      width: 1000,
      height: 700,
    })

    await container.sleep(4000)

    cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'Good luck with claude bro.' })

    return   
  } else if (normalizedText.includes('web') || normalizedText.includes('browser')) {
    cmd.ack('Yo.... Fuckin check this out, twin.')
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
    cmd.ack('Aight. Sheeeit. We got a real fuckin earnest hemmingway up in here.')
    const result = await windowManager.spawn({
      url: 'http://localhost:3080',
      width: 1200,
      height: 900,
    })
    
    await container.sleep(4000)
    cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'Let the boy COOK' })
    return
  } else if (normalizedText.includes('track')) {
    await container.sleep(1000)
    cmd.ack('Better believe it.  Aint nobody hiding from your boy.')

    container.proc.spawnAndCapture('luca', ['serve', '--force', '--port', '3969', '--no-open'], {
      cwd: '/Users/jon/@soederpop/playground/enemy-tracker'
    })

    await container.sleep(4000)

    const result = await windowManager.spawn({
      url: 'http://localhost:3969',
      width: 1400,
      height: 1000,
    })

    cmd.finish({ result: { action: 'completed', text: cmd.text }, speech: 'Get em dawg.  Me and the homies are ready.' })
    
    return
  }

  await container.sleep(4000)
  cmd.ack('Look unc. I dont know the fuck you talmbout.')
  cmd.finish({ result: { action: 'unknown' }})
})

listener.on('message', (msg) => {
  console.log('[message]', JSON.stringify(msg))
})
