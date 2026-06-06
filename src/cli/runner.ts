import { homedir } from 'os'
import { join } from 'path'

// The runner dispatches to `help` for missing/empty commands, so consumer
// binaries that don't bake the full luca command index still need it.
import '../commands/help.js'

export interface CommandSources {
  builtinCommands: Set<string>
  projectCommands: Set<string>
  userCommands: Set<string>
}

export interface RunCliOptions {
  binaryName?: string
  loadGlobalCli?: boolean
  discoverLocalCommands?: boolean
  discoverUserHelpers?: boolean
  implicitRun?: boolean
  onBeforeDispatch?: (container: any) => Promise<void> | void
}

export function classifyCommandSources(
  builtinCommands: Set<string>,
  afterProject: Set<string>,
  afterUser: Set<string>,
): CommandSources {
  return {
    builtinCommands,
    projectCommands: new Set([...afterProject].filter((n) => !builtinCommands.has(n))),
    userCommands: new Set([...afterUser].filter((n) => !builtinCommands.has(n) && !afterProject.has(n))),
  }
}

export function resolveScriptCandidate(ref: string, container: any): string | null {
  const candidates = [ref, `${ref}.ts`, `${ref}.js`, `${ref}.md`]
  for (const candidate of candidates) {
    const resolved = container.paths.resolve(candidate)
    if (container.fs.exists(resolved)) return resolved
  }
  return null
}

export async function loadCliModule(container: any, modulePath: string) {
  if (!container.fs.exists(modulePath)) return
  const helpers = container.feature('helpers') as any
  const exports = await helpers.loadModuleExports(modulePath)
  if (typeof exports?.main === 'function') await exports.main(container)
  if (typeof exports?.onStart === 'function') container.once('started', () => exports.onStart(container))
}

export async function discoverProjectCommands(container: any) {
  const helpers = container.feature('helpers') as any
  await helpers.discover('commands')
}

const DISCOVERABLE_USER_TYPES = ['features', 'clients', 'servers', 'commands', 'selectors'] as const

export async function discoverUserHelpers(container: any) {
  const lucaHome = join(homedir(), '.luca')
  const helpers = container.feature('helpers') as any
  for (const type of DISCOVERABLE_USER_TYPES) {
    const dir = join(lucaHome, type)
    if (container.fs.exists(dir)) await helpers.discover(type, { directory: dir })
  }
}

async function loadProjectIntrospection(container: any) {
  const candidates = [
    'features/introspection.generated.ts',
    'src/introspection.generated.ts',
    'introspection.generated.ts',
  ]

  for (const candidate of candidates) {
    const filePath = container.paths.resolve(candidate)
    if (container.fs.exists(filePath)) {
      try {
        await import(filePath)
      } catch {
        // Generated file may be stale or malformed — skip silently
      }
      return
    }
  }
}

export async function runCli(container: any, options: RunCliOptions = {}) {
  const {
    loadGlobalCli: shouldLoadGlobalCli = true,
    discoverLocalCommands = true,
    discoverUserHelpers: shouldDiscoverUserHelpers = true,
    implicitRun = true,
  } = options

  ;(container as any)._binaryName = options.binaryName || 'luca'

  const discovery = process.env.LUCA_COMMAND_DISCOVERY || ''
  const builtinCommands = new Set(container.commands.available as string[])

  if (shouldLoadGlobalCli) {
    await loadCliModule(container, join(homedir(), '.luca', 'luca.cli.ts'))
  }

  await loadCliModule(container, container.paths.resolve('luca.cli.ts'))

  if (discoverLocalCommands && discovery !== 'disable' && discovery !== 'no-local') {
    await discoverProjectCommands(container)
  }

  const afterProject = new Set(container.commands.available as string[])

  if (shouldDiscoverUserHelpers && discovery !== 'disable' && discovery !== 'no-home') {
    await discoverUserHelpers(container)
  }

  const afterUser = new Set(container.commands.available as string[])
  ;(container as any)._commandSources = classifyCommandSources(builtinCommands, afterProject, afterUser)

  await loadProjectIntrospection(container)

  if (options.onBeforeDispatch) await options.onBeforeDispatch(container)

  const commandName = container.argv._[0] as string

  if (container.argv.help && !commandName) {
    delete container.argv.help
    container.argv._.splice(0, 0, 'help')
    await container.command('help' as any).dispatch()
    return
  }

  if (commandName && container.commands.has(commandName)) {
    await container.command(commandName as any).dispatch()
    return
  }

  if (commandName && implicitRun && resolveScriptCandidate(commandName, container)) {
    container.argv._.splice(0, 0, 'run')
    await container.command('run' as any).dispatch()
    return
  }

  if (commandName) {
    const phrase = container.argv._.join(' ')
    const missingCommandHandler = container.state.get('missingCommandHandler') as any
    if (typeof missingCommandHandler === 'function') {
      await missingCommandHandler({ words: container.argv._, phrase }).catch((err: any) => {
        console.error(`Missing command handler error: ${err.message}`, err)
      })
      return
    }
  }

  container.argv._.splice(0, 0, 'help')
  await container.command('help' as any).dispatch()
}
