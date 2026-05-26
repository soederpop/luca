import { z } from 'zod'
import { CommandOptionsSchema } from 'luca'
import type { ContainerContext } from 'luca'

export const argsSchema = CommandOptionsSchema.extend({
  _: z.array(z.union([z.string(), z.number()])).default([]),
  count: z.coerce.number().optional().describe('Number of column panels (positional, default: 2)'),
  controlHeight: z.coerce.number().default(3).describe('Height of the control strip in rows'),
  cwd: z.string().optional().describe('Working directory for all panels'),
  commands: z.string().optional().describe('Comma-separated commands for each panel, in order (e.g. "claude,codex")'),
})

export const positionals = ['count']

export async function layout(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any

  if (!process.env.TMUX) {
    throw new Error('The layout command must be run inside a tmux session.')
  }

  const tmux = container.feature('tmux')

  const panelCount = options.count ?? 2
  if (panelCount < 1) {
    throw new Error(`Invalid panel count: ${options.count}`)
  }

  const commands = options.commands ? options.commands.split(',').map(s => s.trim()) : []

  const panels = Array.from({ length: panelCount }, (_, i) => ({
    name: `panel-${i + 1}`,
    cwd: options.cwd,
    command: commands[i],
  }))

  // Resolve which session we're currently in
  const sessionResult = await tmux.run(['display-message', '-p', '#{session_name}'])
  const sessionName = sessionResult.stdout.trim()
  const session = await tmux.session(sessionName)

  await session.createLayout({ panels, controlHeight: options.controlHeight })
}

export default layout
