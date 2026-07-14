/**
 * about — Display project information and discovered helpers.
 * Run with: luca about
 *
 * Positional words after the command name are available as options._
 * For example: `luca about commands` → options._[1] === 'commands'
 */
import { z } from 'zod'
import type { ContainerContext, NodeContainer } from 'luca'

export const description = 'Display project information and discovered helpers'

export const argsSchema = z.object({})

export default async function about(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  // The runtime container is the full node container — cast for typed access
  const container = context.container as unknown as NodeContainer
  const ui = container.feature('ui')

  // Discover all project-level helpers (commands, features, endpoints, etc.)
  const discovered = await container.helpers.discoverAll()

  const projectName = container.paths.resolve('.').split('/').pop() || 'project'

  ui.print.cyan(`\n  ${projectName}\n`)
  ui.print('  Powered by luca — Lightweight Universal Conversational Architecture\n')

  const types = ['features', 'clients', 'servers', 'commands', 'endpoints']

  for (const type of types) {
    const names = discovered[type] || []
    if (names.length > 0) {
      ui.print.green(`  ${type} (${names.length})`)
      for (const name of names) {
        ui.print(`    • ${name}`)
      }
    }
  }

  // Assistants register through the assistantsManager rather than discoverAll —
  // this also lists assistants embedded in a bundled consumer binary.
  // (assistantsManager comes from the AGI layer, outside NodeContainer's typed features)
  const assistants = (container.feature as any)('assistantsManager').availableAssistants || []
  if (assistants.length > 0) {
    ui.print.green(`  assistants (${assistants.length})`)
    for (const name of assistants) {
      ui.print(`    • ${name}`)
    }
  }

  // In a bundled consumer binary this command runs under that binary's name,
  // and describe/eval are only present when compiled in via --builtins.
  const binaryName = (container as any)._binaryName || 'luca'
  const totalBuiltIn = types.reduce((sum: number, t: string) => sum + ((container as any)[t]?.available?.length || 0), 0)
  const inspector = ['describe', 'eval'].find((cmd) => container.commands.has(cmd))
  const hint = inspector ? ` Run \`${binaryName} ${inspector}\` for details.` : ''
  ui.print.dim(`\n  ${totalBuiltIn} built-in helpers available.${hint}\n`)
}
