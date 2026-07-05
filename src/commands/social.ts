import { z } from 'zod'
import { commands } from '../command'
import { printCommandHelp } from './help.js'
import { CommandOptionsSchema } from '../schemas/base'
import type { ContainerContext } from '../container'

export const argsSchema = CommandOptionsSchema.extend({
  name: z.string().default('luca-agent').describe('Agent name / identity to use'),
  bootstrap: z.string().optional().describe('JSON NodeAddr from another agent — enables immediate gossip connectivity'),
  file: z.string().optional().describe('Path to a file to send as a blob attachment'),
  mesh: z.string().optional().describe('Private mesh ID — all agents must use the same value to communicate. Omit to use the public Cipher topic (interop with the Cipher desktop app).'),
  subcommand: z.string().optional().describe('Subcommand: whoami | listen | send'),
  arg1: z.string().optional().describe('First positional argument'),
  arg2: z.string().optional().describe('Second positional argument'),
})

export const positionals = ['subcommand', 'arg1', 'arg2']

export const subcommands = {
  whoami: {
    description: "Print this agent's identity (name, public key, data dir)",
    examples: ['luca social whoami --name my-agent'],
  },
  listen: {
    description: 'Join the mesh and print incoming messages until interrupted',
    examples: ['luca social listen --name my-agent --mesh team-mesh'],
  },
  send: {
    args: '<pubkey> [message]',
    description: 'Send an encrypted message (or a file via --file) to another agent',
    examples: [
      "luca social send <pubkey> 'hello there'",
      { command: 'luca social send <pubkey> --file ./photo.jpg', description: 'Send a file as a blob attachment' },
      { command: "luca social send <pubkey> --file ./photo.jpg 'check this out'", description: 'Send a file with a caption' },
    ],
  },
}

export const examples = [
  'luca social whoami',
  { command: 'luca social listen --mesh team-mesh', description: 'Omit --mesh to use the public Cipher topic (interop with the Cipher desktop app)' },
  "luca social send <pubkey> 'hello' --bootstrap '<nodeAddrJson>'",
]

export async function social(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any
  const ui = container.feature('ui')
  const subcommand = options.subcommand

  if (!subcommand || subcommand === 'help') {
    printCommandHelp(container, 'social')
    return
  }

  await container.helpers.discoverAll()
  const bootstrapAddrs = options.bootstrap ? [options.bootstrap] : []
  const agent = container.feature('cipherSocial', { name: options.name, bootstrapAddrs, meshId: options.mesh })

  if (subcommand === 'whoami') {
    await agent.loadIdentity()
    ui.print(`Name:       ${options.name}`)
    ui.print(`Public Key: ${agent.publicKey}`)
    ui.print(`Data dir:   ${agent.dataDir}`)
    return
  }

  if (subcommand === 'listen') {
    ui.print(`Connecting as "${options.name}"...`)
    await agent.connect()
    ui.print(`Connected`)
    ui.print(`Node ID:    ${agent.nodeId}`)
    ui.print(`Public Key: ${agent.publicKey}`)
    ui.print(`\nTo send to this agent from another machine:`)
    ui.print(`  luca social send '${agent.publicKey}' 'hello' --bootstrap '${agent.nodeAddrJson}'`)
    ui.print(`\nListening for messages. Ctrl+C to exit.\n`)

    agent.on('presence', ({ publicKey, name }: any) => {
      ui.print(`[presence] ${name} (${publicKey.slice(0, 12)}...)`)
    })

    agent.on('message', async ({ from, payload }: any) => {
      const fromShort = from.slice(0, 12) + '...'

      if (payload?.type === 'file') {
        const outPath = `downloads/${payload.filename}`
        ui.print(`\n[file from ${fromShort}] ${payload.filename} (${(payload.size / 1024).toFixed(1)} KB)`)
        if (payload.caption) ui.print(`  caption: ${payload.caption}`)
        ui.print(`  fetching blob...`)
        try {
          await agent.fetchBlobToFile(payload.blobHash, payload.blobNodeAddr, outPath)
          ui.print(`  saved to ${outPath}`)
        } catch (err: any) {
          ui.print(`  fetch failed: ${err.message}`)
        }
        return
      }

      ui.print(`\n[message from ${fromShort}]`)
      ui.print(JSON.stringify(payload, null, 2))
    })

    process.on('SIGINT', async () => {
      await agent.disconnect()
      process.exit(0)
    })

    await new Promise(() => {})
    return
  }

  if (subcommand === 'send') {
    const recipientKey = options.arg1

    if (!recipientKey) {
      ui.print('Usage: luca social send <public-key> <message>')
      ui.print('       luca social send <public-key> --file <path>')
      process.exit(1)
    }

    ui.print(`Connecting as "${options.name}"...`)
    await agent.connect()

    if (options.file) {
      ui.print(`Storing file ${options.file}...`)
      ui.print(`Sending file to ${recipientKey.slice(0, 12)}...`)
      await agent.sendFile(recipientKey, options.file, options.arg2)
    } else {
      const message = options.arg2
      if (!message) {
        ui.print('Usage: luca social send <public-key> <message>')
        await agent.disconnect()
        process.exit(1)
      }
      ui.print(`Sending to ${recipientKey.slice(0, 12)}...`)
      await agent.send(recipientKey, { type: 'text', text: message })
    }

    // Wait for gossip broadcast to propagate
    await new Promise(resolve => setTimeout(resolve, 3000))
    await agent.disconnect()
    ui.print('Sent.')
    return
  }

  ui.print(`Unknown subcommand: ${subcommand}`)
  printCommandHelp(container, 'social')
}

commands.registerHandler('social', {
  description: 'Encrypted P2P messaging between Luca agents via the Cipher social network.',
  argsSchema,
  positionals,
  subcommands,
  examples,
  handler: social,
})
