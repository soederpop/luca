import { homedir } from 'os'
import { join } from 'path'
import minimist from 'minimist'
import { minimistOptionsFor } from '../command.js'

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

export async function discoverProjectCommands(container: any, options: { commandsOnly?: boolean } = {}) {
  const helpers = container.feature('helpers') as any
  if (options.commandsOnly) {
    await helpers.discover('commands')
  } else {
    // Discover everything (features, clients, servers, commands, endpoints,
    // selectors) so project commands can use project features without calling
    // discoverAll() themselves. Opt out with LUCA_COMMAND_DISCOVERY=commands-only.
    await helpers.discoverAll()
  }
}

/**
 * Re-parse process.argv with minimist options derived from the resolved
 * command's argsSchema, updating container.argv in place. This makes flag
 * parsing agree with the schema: boolean flags never consume a following
 * positional, and string-typed fields (including positionals) keep
 * numeric-looking values as strings.
 */
export function applySchemaAwareArgv(container: any, CommandClass: any) {
  if (typeof process === 'undefined' || !Array.isArray(process.argv)) return

  const parsed = minimist(process.argv.slice(2), minimistOptionsFor(CommandClass?.argsSchema)) as Record<string, any> & { _: any[] }
  const argv = container.argv

  // Positionals wholesale — the naive startup parse may have mis-attributed
  // some of them to boolean flags. Always strings; schemas coerce from there.
  argv._ = parsed._.map(String)

  for (const [key, value] of Object.entries(parsed)) {
    if (key === '_') continue
    argv[key] = value
    // Mirror the container's kebab → camelCase aliasing for flag keys
    const camel = key.replace(/-([a-z0-9])/g, (_m: string, c: string) => c.toUpperCase())
    if (camel !== key) argv[camel] = value
  }
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
    await discoverProjectCommands(container, { commandsOnly: discovery === 'commands-only' })
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
    applySchemaAwareArgv(container, container.commands.lookup(commandName))
    await container.command(commandName as any).dispatch()
    return
  }

  if (commandName && implicitRun && resolveScriptCandidate(commandName, container)) {
    if (container.commands.has('run')) applySchemaAwareArgv(container, container.commands.lookup('run'))
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
