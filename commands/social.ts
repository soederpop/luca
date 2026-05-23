import { z } from 'zod'
import { CommandOptionsSchema } from 'luca'
import type { ContainerContext } from 'luca'

export const argsSchema = CommandOptionsSchema.extend({
  name: z.string().default('luca-agent').describe('Agent name / identity to use'),
  bootstrap: z.string().optional().describe('JSON NodeAddr from another agent — enables immediate gossip connectivity'),
  subcommand: z.string().optional().describe('Subcommand: whoami | listen | send'),
  arg1: z.string().optional().describe('First positional argument'),
  arg2: z.string().optional().describe('Second positional argument'),
})

export const positionals = ['subcommand', 'arg1', 'arg2']

const USAGE = `
Usage:
  luca social whoami [--name <name>]                   Print this agent's identity
  luca social listen [--name <name>]                   Join the mesh and print incoming messages
  luca social send <pubkey> <msg> [--name <name>]      Send an encrypted message
`.trim()

export async function social(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any
  const ui = container.feature('ui')
  const subcommand = options.subcommand

  if (!subcommand || subcommand === 'help') {
    ui.print(USAGE)
    return
  }

  await container.helpers.discoverAll()
  const bootstrapAddrs = options.bootstrap ? [options.bootstrap] : []
  const agent = container.feature('cipherSocial', { name: options.name, bootstrapAddrs })

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

    agent.on('message', ({ from, payload }: any) => {
      const fromShort = from.slice(0, 12) + '...'
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
    const message = options.arg2

    if (!recipientKey || !message) {
      ui.print('Usage: luca social send <public-key> <message>')
      process.exit(1)
    }

    ui.print(`Connecting as "${options.name}"...`)
    await agent.connect()
    ui.print(`Sending to ${recipientKey.slice(0, 12)}...`)

    await agent.send(recipientKey, { type: 'text', text: message })

    // Brief wait for gossip broadcast to propagate
    await new Promise(resolve => setTimeout(resolve, 1500))
    await agent.disconnect()
    ui.print('Sent.')
    return
  }

  ui.print(`Unknown subcommand: ${subcommand}`)
  ui.print(USAGE)
}

export default {
  description: 'Encrypted P2P messaging between Luca agents via the Cipher social network.',
  argsSchema,
  handler: social,
}
