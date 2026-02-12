/**
 * Telegram Bot → Expert Chat
 *
 * Discovers available experts from the experts/ folder and the built-in architect.
 * Use /experts to list them, /use <name> to switch, messages go to the active one.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=your_token bun run scripts/examples/telegram-bot.ts
 */
import container from '@/agi'
import '@/clients/comfyui'
import { InputFile } from 'grammy'
import { readdirSync, existsSync } from 'fs'
import { join, resolve } from 'path'

// ─── ComfyUI setup ───

const COMFY_URL = process.env.COMFY_URL || 'https://8bwb9v7oc9ao4h-8188.proxy.runpod.net'

const comfyui = container.client('comfyui', { baseURL: COMFY_URL })

const workflowPath = new URL('../../comfy-ui/simple-checkpoint-workflow.json', import.meta.url)
const baseWorkflow = JSON.parse(await Bun.file(workflowPath).text())

// Shared ref so tool handlers can send photos to the right chat
let _activeTgCtx: any = null

// ─── Discover experts from disk ───

interface Agent {
  name: string
  description: string
  ask: (text: string) => Promise<string>
  messages: () => any[]
  tokenUsage: () => { prompt: number; completion: number; total: number }
  model: () => string
  reset: () => void
}

function discoverExperts(): Map<string, () => Agent> {
  const agents = new Map<string, () => Agent>()
  const expertsDir = resolve(container.cwd, 'experts')

  // Built-in: architect
  agents.set('architect', () => {
    const convo = container.feature('conversation', {
      cached: false,
      model: 'o3',
      history: [{
        role: 'system',
        content: `You are a senior software architect. You think about the bigger picture: how components fit together, what patterns to use, how to structure files, and how to build things in a way that's reusable and maintainable.\n\nYou're chatting through Telegram so keep responses concise but thorough. Use markdown formatting that works in Telegram (bold, italic, code blocks). Break up walls of text.\n\nYou have a generate_image tool. When the user asks you to generate, create, draw, or make an image, use it. Craft a detailed prompt for the image based on what they asked for. The model is a photorealistic SDXL checkpoint so describe scenes like a photographer would.`
      }],
      tools: {
        generate_image: {
          description: 'Generate an image using a Stable Diffusion XL model via ComfyUI. The image will be sent as a photo in the chat.',
          parameters: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'Detailed positive prompt describing what to generate. Be descriptive like a photographer: subject, setting, lighting, mood, camera angle.'
              },
              negative_prompt: {
                type: 'string',
                description: 'What to avoid in the image. Defaults to standard quality negatives if not provided.'
              }
            },
            required: ['prompt']
          },
          handler: async (args: { prompt: string; negative_prompt?: string }) => {
            const ctx = _activeTgCtx
            if (ctx) await ctx.replyWithChatAction('upload_photo')

            console.log(`🎨 Generating image: ${args.prompt.slice(0, 80)}...`)

            const workflow = JSON.parse(JSON.stringify(baseWorkflow))
            const result = await comfyui.runWorkflow(workflow, {
              '3': { text: `${args.prompt}` },
              '4': { text: args.negative_prompt || 'low quality, blurry, deformed, ugly, bad anatomy, disfigured, poorly drawn' },
              '6': { seed: Math.floor(Math.random() * 2 ** 32) },
            }, {
              outputDir: './output',
              poll: true,
              pollInterval: 2000,
            })

            if (result.images?.length && ctx) {
              for (const img of result.images) {
                if (img.localPath) {
                  const file = Bun.file(img.localPath)
                  const buf = Buffer.from(await file.arrayBuffer())
                  await ctx.replyWithPhoto(new InputFile(buf, img.filename), {
                    caption: args.prompt.slice(0, 200),
                  })
                }
              }
              return `Image generated and sent to chat. prompt_id: ${result.promptId}`
            }

            return `Image generation completed (prompt_id: ${result.promptId}) but no images were returned.`
          }
        }
      }
    })
    return {
      name: 'architect',
      description: 'Senior software architect (o3)',
      ask: (text: string) => convo.ask(text),
      messages: () => convo.messages,
      tokenUsage: () => convo.state.get('tokenUsage') || { prompt: 0, completion: 0, total: 0 },
      model: () => convo.model,
      reset: () => {
        const sys = convo.messages[0]
        convo.state.set('messages', sys ? [sys] : [])
      }
    }
  })

  // Discover from experts/ folder
  if (existsSync(expertsDir)) {
    const folders = readdirSync(expertsDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .filter(d => existsSync(join(expertsDir, d.name, 'SYSTEM-PROMPT.md')))

    for (const folder of folders) {
      const name = folder.name
      agents.set(name, () => {
        const expert = container.feature('expert', {
          cached: false,
          name,
          folder: name,
        })

        // Read first line of system prompt for description
        const promptPath = join(expertsDir, name, 'SYSTEM-PROMPT.md')
        let desc = name
        try {
          const content = Bun.file(promptPath).text()
          // We'll just use the folder name and model for now
          desc = `${name} expert (gpt-5)`
        } catch {}

        return {
          name,
          description: desc,
          ask: async (text: string) => {
            const result = await expert.ask(text)
            return result || 'No response'
          },
          messages: () => expert.conversation?.messages || [],
          tokenUsage: () => expert.conversation?.state.get('tokenUsage') || { prompt: 0, completion: 0, total: 0 },
          model: () => expert.conversation?.model || 'gpt-5',
          reset: async () => {
            // Re-start creates a fresh conversation
            expert.state.set('started', false)
            expert.conversation = undefined
          }
        }
      })
    }
  }

  return agents
}

// ─── Main ───

async function main() {
  const tg = container.feature('telegram', {
    mode: 'polling',
    dropPendingUpdates: true,
  })

  const agentFactories = discoverExperts()
  const agentNames = [...agentFactories.keys()]

  // Active agent per chat (keyed by chat ID)
  const activeAgents = new Map<number, Agent>()

  function getAgent(chatId: number): Agent {
    if (!activeAgents.has(chatId)) {
      // Default to architect
      const factory = agentFactories.get('architect')!
      activeAgents.set(chatId, factory())
    }
    return activeAgents.get(chatId)!
  }

  // ─── Commands ───

  tg.command('start', (ctx) => {
    const names = agentNames.map(n => `• \`${n}\``).join('\n')
    return ctx.reply(
      `Hey! I've got ${agentNames.length} experts available:\n\n${names}\n\nCurrently talking to *${getAgent(ctx.chat.id).name}*.\nUse /use <name> to switch.`,
      { parse_mode: 'Markdown' }
    )
  })

  tg.command('help', (ctx) => ctx.reply(
    `/experts — List available experts\n` +
    `/use <name> — Switch to an expert\n` +
    `/who — Who am I talking to?\n` +
    `/reset — Clear conversation history\n` +
    `/status — Bot & agent stats\n` +
    `/help — This message`
  ))

  tg.command('experts', (ctx) => {
    const current = getAgent(ctx.chat.id)
    const lines = agentNames.map(name => {
      const marker = name === current.name ? ' ← active' : ''
      return `• \`${name}\`${marker}`
    })
    return ctx.reply(`Available experts:\n\n${lines.join('\n')}`, { parse_mode: 'Markdown' })
  })

  tg.command('use', (ctx) => {
    const text = ctx.message.text.replace(/^\/use\s*/, '').trim().toLowerCase()

    if (!text) {
      return ctx.reply(`Which expert? Pick one:\n${agentNames.map(n => `• \`${n}\``).join('\n')}`, { parse_mode: 'Markdown' })
    }

    // Fuzzy match: exact, starts-with, or includes
    const match = agentNames.find(n => n === text)
      || agentNames.find(n => n.startsWith(text))
      || agentNames.find(n => n.includes(text))

    if (!match) {
      return ctx.reply(`No expert matching "${text}". Available:\n${agentNames.map(n => `• \`${n}\``).join('\n')}`, { parse_mode: 'Markdown' })
    }

    const factory = agentFactories.get(match)!
    activeAgents.set(ctx.chat.id, factory())
    return ctx.reply(`Switched to *${match}*. Fresh conversation started.`, { parse_mode: 'Markdown' })
  })

  tg.command('who', (ctx) => {
    const agent = getAgent(ctx.chat.id)
    return ctx.reply(`You're talking to *${agent.name}*`, { parse_mode: 'Markdown' })
  })

  tg.command('reset', (ctx) => {
    const agent = getAgent(ctx.chat.id)
    agent.reset()
    return ctx.reply(`🧹 *${agent.name}* conversation cleared.`, { parse_mode: 'Markdown' })
  })

  tg.command('status', (ctx) => {
    tg.diagnostics()
    const info = tg.state.get('botInfo')
    const agent = getAgent(ctx.chat.id)
    const usage = agent.tokenUsage()
    const msgCount = agent.messages().length - 1
    return ctx.reply(
      `🤖 @${info?.username}\n` +
      `🧠 Agent: *${agent.name}* (${agent.model()})\n` +
      `💬 Messages: ${msgCount}\n` +
      `📊 Tokens: ${usage.total}\n` +
      `📋 Experts available: ${agentNames.length}`,
      { parse_mode: 'Markdown' }
    )
  })

  // ─── Message handler ───

  tg.handle('message:text', async (ctx) => {
    const text = ctx.message.text
    const user = ctx.from?.username || ctx.from?.first_name || 'someone'
    const agent = getAgent(ctx.chat.id)

    console.log(`💬 ${user} → ${agent.name}: ${text}`)
    await ctx.replyWithChatAction('typing')

    // Set context so tool handlers can send photos to this chat
    _activeTgCtx = ctx

    try {
      const reply = await agent.ask(text)
      console.log(`🧠 ${agent.name}: ${reply.slice(0, 80)}...`)

      if (reply.trim()) {
        try {
          await ctx.reply(reply, { parse_mode: 'Markdown' })
        } catch {
          await ctx.reply(reply)
        }
      }
    } catch (err: any) {
      console.error(`${agent.name} error:`, err.message)
      await ctx.reply(`⚠️ ${agent.name} error: ${err.message}`)
    } finally {
      _activeTgCtx = null
    }
  })

  // ─── Event logging ───

  tg.on('command', (name, ctx) => {
    console.log(`/${name} from @${ctx.from?.username || ctx.from?.id}`)
  })

  tg.on('error', (err) => {
    console.error('Bot error:', err.message)
  })

  await tg.enable()
  await tg.start()

  console.log(`Experts loaded: ${agentNames.join(', ')}`)
}

main()
