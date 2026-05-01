import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const positionals = ['name']

export const argsSchema = CommandOptionsSchema.extend({
  name: z.string().describe('Name of the binary to produce (e.g. loopy)'),
  source: z.string().describe('Path to the source project'),
  outdir: z.string().optional().describe('Output directory for the binary (default: dist/ within luca)'),
})

// Self-registering via static blocks — import alone is enough
const SELF_REGISTERING_DIRS = ['features', 'clients', 'servers'] as const
// Need explicit graftModule registration after import
const COMMAND_DIRS = ['commands'] as const

async function bundleConsumerProject(
  options: z.infer<typeof argsSchema>,
  context: ContainerContext,
) {
  const container = context.container as any
  const fs = container.feature('fs')
  const proc = container.feature('proc')
  const ui = container.feature('ui')
  const os = container.feature('os')

  const { name } = options
  const source = options.source.replace(/^~/, os.homedir)

  // All bundle work runs in luca's project root so tsconfig aliases resolve
  const lucaRoot = container.paths.resolve(os.homedir, '@soederpop/projects/luca')
  const bundleDir = container.paths.resolve(lucaRoot, 'src', 'cli', 'bundles', name)
  const outFile = options.outdir
    ? container.paths.resolve(options.outdir.replace(/^~/, os.homedir), name)
    : container.paths.resolve(lucaRoot, 'dist', name)

  ui.banner(`Bundling ${name}`)
  console.log(`  source : ${source}`)
  console.log(`  bundle : ${bundleDir}`)
  console.log(`  output : ${outFile}`)
  console.log()

  // ── 1. Collect helper files ───────────────────────────────────────────────

  console.log('→ Discovering source helpers...')

  const SKIP = ['**/*.test.ts', '**/*.spec.ts', '**/*.generated.ts', '**/*.generated.*.ts']

  // Features/clients/servers: static import is enough (self-register via Feature.register)
  const helperFiles: string[] = []
  for (const dir of SELF_REGISTERING_DIRS) {
    const dirPath = container.paths.resolve(source, dir)
    if (!fs.existsSync(dirPath)) continue
    const { files } = fs.walk(dirPath, { include: ['**/*.ts'], exclude: SKIP })
    for (const file of files) {
      helperFiles.push(file)
      console.log(`    + ${dir}/${file.split('/').pop()}`)
    }
  }

  // Commands: need explicit graftModule registration
  const commandFiles: Array<{ file: string; name: string }> = []
  for (const dir of COMMAND_DIRS) {
    const dirPath = container.paths.resolve(source, dir)
    if (!fs.existsSync(dirPath)) continue
    // Commands are top-level only (same as discovery)
    const { files } = fs.walk(dirPath, { include: ['*.ts'], exclude: SKIP })
    for (const file of files) {
      const basename = file.split('/').pop()!
      if (basename === 'index.ts') continue
      const cmdName = basename.replace(/\.ts$/, '')
      commandFiles.push({ file, name: cmdName })
      console.log(`    + commands/${basename}`)
    }
  }

  const total = helperFiles.length + commandFiles.length
  if (total === 0) {
    console.error('No helper files found in source project. Check --source path.')
    process.exit(1)
  }
  console.log(`  ${total} files total`)
  console.log()

  // ── 2. Merge package.json dependencies ───────────────────────────────────

  console.log('→ Merging dependencies...')
  const lucaPkg = JSON.parse(fs.readFile(container.paths.resolve(lucaRoot, 'package.json')))

  let sourceDeps: Record<string, string> = {}
  const sourcePkgPath = container.paths.resolve(source, 'package.json')
  if (fs.existsSync(sourcePkgPath)) {
    const sourcePkg = JSON.parse(fs.readFile(sourcePkgPath))
    sourceDeps = { ...sourcePkg.dependencies, ...sourcePkg.devDependencies }
  }

  const lucaAllDeps = {
    ...lucaPkg.dependencies,
    ...lucaPkg.devDependencies,
    ...lucaPkg.optionalDependencies,
  }
  const uniqueSourceDeps: Record<string, string> = {}
  for (const [pkg, ver] of Object.entries(sourceDeps)) {
    if (!lucaAllDeps[pkg]) {
      uniqueSourceDeps[pkg] = ver as string
      console.log(`    + ${pkg}@${ver}`)
    }
  }

  if (Object.keys(uniqueSourceDeps).length === 0) {
    console.log('  (no unique deps beyond luca)')
  }
  console.log()

  // ── 3. Set up bundle directory and install deps ───────────────────────────

  fs.ensureFolder(bundleDir)
  fs.writeFile(
    container.paths.resolve(bundleDir, 'package.json'),
    JSON.stringify({ name: `@soederpop/luca-bundle-${name}`, version: '0.0.1', type: 'module', dependencies: uniqueSourceDeps }, null, 2),
  )

  if (Object.keys(uniqueSourceDeps).length > 0) {
    console.log('→ Installing source dependencies...')
    const installResult = await proc.execAndCapture('bun install', { cwd: bundleDir, silent: false })
    if (installResult.exitCode !== 0) {
      console.error('bun install failed:\n', installResult.stderr)
      process.exit(1)
    }
    console.log()
  }

  // ── 4. Generate and compile entry ─────────────────────────────────────────

  console.log('→ Generating entry...')
  const entryPath = container.paths.resolve(bundleDir, 'entry.ts')
  fs.writeFile(entryPath, generateEntry(name, helperFiles, commandFiles))

  console.log('→ Compiling...')
  const compileCmd = `bun build ${entryPath} --compile --outfile ${outFile} --external node-llama-cpp`
  console.log(`  ${compileCmd}`)
  console.log()

  const result = await proc.execAndCapture(compileCmd, { cwd: lucaRoot, silent: false })
  if (result.exitCode !== 0) {
    console.error('Compilation failed:\n', result.stderr)
    process.exit(1)
  }

  console.log()
  console.log(ui.colors.green(`✓ Built → ${outFile}`))
  console.log()
  console.log(`  Run from any project — loads its luca.cli.ts and commands/ on top.`)
}

function generateEntry(
  name: string,
  helperFiles: string[],
  commandFiles: Array<{ file: string; name: string }>,
): string {
  const helperImports = helperFiles
    .map(f => `import '${f}'`)
    .join('\n')

  // Each command gets a namespace import + explicit registration
  const commandImports = commandFiles
    .map(({ file, name: n }) => `import * as _cmd_${safeIdent(n)} from '${file}'`)
    .join('\n')

  const commandRegistrations = commandFiles.map(({ name: n }) => {
    const id = safeIdent(n)
    return `  registerCommand('${n}', _cmd_${id})`
  }).join('\n')

  return `#!/usr/bin/env bun
// Generated by: luca bundle-consumer-project ${name}
// DO NOT EDIT — re-run the command to regenerate

import container from '@soederpop/luca/agi'
import { Command, commands, graftModule } from '@soederpop/luca'
import { homedir } from 'os'
import { join } from 'path'

// ── Self-registering helpers (features/clients/servers) ───────────────────
${helperImports}

// ── Commands — imported and explicitly registered ─────────────────────────
${commandImports}

function registerCommand(name: string, mod: any) {
  if (commands.has(name)) return
  const cmdMod = mod.default || mod
  // class-based
  if (typeof mod.default === 'function' && mod.default.prototype instanceof Command) {
    commands.register(name, mod.default)
    return
  }
  // run export
  if (typeof cmdMod.run === 'function') {
    commands.register(name, graftModule(Command as any, cmdMod, name, 'commands') as any)
    return
  }
  // handler export
  if (typeof cmdMod.handler === 'function') {
    commands.register(name, graftModule(Command as any, {
      description: cmdMod.description,
      argsSchema: cmdMod.argsSchema,
      positionals: cmdMod.positionals ?? mod.positionals,
      handler: cmdMod.handler,
    }, name, 'commands') as any)
    return
  }
  // plain default function
  if (typeof mod.default === 'function') {
    commands.register(name, graftModule(Command as any, {
      description: mod.description || '',
      argsSchema: mod.argsSchema,
      positionals: mod.positionals,
      handler: mod.default,
    }, name, 'commands') as any)
    return
  }
}

// ── Register all bundled commands ─────────────────────────────────────────
${commandRegistrations}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const discovery = process.env.LUCA_COMMAND_DISCOVERY || ''

  // Global user CLI module (~/.luca/luca.cli.ts)
  await loadCliModule(join(homedir(), '.luca', 'luca.cli.ts'))

  // Local project CLI module — layering hook (e.g. @north's luca.cli.ts)
  await loadCliModule(join(process.cwd(), 'luca.cli.ts'))

  // Discover local project commands/ on top of the bundled ones
  if (discovery !== 'disable' && discovery !== 'no-local') {
    await discoverProjectCommands()
  }

  // User-level helpers (~/.luca/)
  if (discovery !== 'disable' && discovery !== 'no-home') {
    await discoverUserHelpers()
  }

  // Dispatch
  const commandName = container.argv._[0] as string

  if (commandName && container.commands.has(commandName)) {
    await container.command(commandName as any).dispatch()
  } else if (commandName) {
    const phrase = container.argv._.join(' ')
    // @ts-ignore
    const missingCommandHandler = container.state.get('missingCommandHandler') as any
    if (typeof missingCommandHandler === 'function') {
      await missingCommandHandler({ words: container.argv._, phrase }).catch((err: any) => {
        console.error(\`Missing command handler error: \${err.message}\`, err)
      })
    } else {
      printHelp(container)
    }
  } else {
    printHelp(container)
  }
}

function printHelp(container: any) {
  const available = (container.commands.available as string[]).sort()
  console.log(\`\\nAvailable commands: \${available.join(', ')}\\n\`)
}

async function loadCliModule(modulePath: string) {
  if (!container.fs.exists(modulePath)) return
  const helpers = container.feature('helpers') as any
  const exports = await helpers.loadModuleExports(modulePath)
  if (typeof exports?.main === 'function') await exports.main(container)
  if (typeof exports?.onStart === 'function') container.once('started', () => exports.onStart(container))
}

async function discoverProjectCommands() {
  const helpers = container.feature('helpers') as any
  await helpers.discover('commands')
}

const DISCOVERABLE_TYPES = ['features', 'clients', 'servers', 'commands', 'selectors'] as const

async function discoverUserHelpers() {
  const lucaHome = join(homedir(), '.luca')
  const helpers = container.feature('helpers') as any
  for (const type of DISCOVERABLE_TYPES) {
    const dir = join(lucaHome, type)
    if (container.fs.exists(dir)) await helpers.discover(type, { directory: dir })
  }
}

main()
`
}

function safeIdent(name: string): string {
  return name.replace(/[-./]/g, '_')
}

export default {
  description: 'Bundle a source project\'s helpers into a standalone luca-based binary',
  argsSchema,
  positionals,
  handler: bundleConsumerProject,
}
