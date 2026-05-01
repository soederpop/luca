import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const positionals = ['name']

export const argsSchema = CommandOptionsSchema.extend({
  name: z.string().describe('Name of the binary to produce (e.g. loopy)'),
  source: z.string().describe('Path to the source project'),
  outDir: z.string().optional().describe('Output directory (default: dist/<name>/ within luca)'),
  targets: z.string().default('darwin-arm64,darwin-x64,linux-arm64,linux-x64,windows-x64').describe('Comma-separated bun target platforms to compile for'),
  features:  z.boolean().default(true).describe('Include features/'),
  clients:   z.boolean().default(true).describe('Include clients/'),
  servers:   z.boolean().default(true).describe('Include servers/'),
  commands:  z.boolean().default(true).describe('Include commands/'),
  endpoints: z.boolean().default(true).describe('Include endpoints/'),
  selectors: z.boolean().default(true).describe('Include selectors/'),
})

// Self-registering via static blocks — import alone is enough
const SELF_REGISTERING_DIRS = ['features', 'clients', 'servers', 'endpoints', 'selectors'] as const
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
  const outDir = options.outDir
    ? container.paths.resolve(options.outDir.replace(/^~/, os.homedir))
    : container.paths.resolve(lucaRoot, 'dist', name)
  const outFile = container.paths.resolve(outDir, name)

  ui.banner(`Bundling ${name}`)
  console.log(`  source : ${source}`)
  console.log(`  bundle : ${bundleDir}`)
  console.log(`  output : ${outFile}`)
  console.log()

  // ── 1. Collect helper files ───────────────────────────────────────────────

  console.log('→ Discovering source helpers...')

  const SKIP = ['**/*.test.ts', '**/*.spec.ts', '**/*.generated.ts', '**/*.generated.*.ts']

  // Features/clients/servers/endpoints/selectors: self-register via static blocks
  const helperFiles: string[] = []
  for (const dir of SELF_REGISTERING_DIRS) {
    if (!options[dir as keyof typeof options]) continue
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
    if (!options[dir as keyof typeof options]) continue
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
    if (pkg.startsWith('@types/')) continue          // type-only, irrelevant in compiled binary
    if (pkg === '@soederpop/luca') continue          // already the runtime we're compiling from
    if (lucaAllDeps[pkg]) continue                   // already bundled by luca
    uniqueSourceDeps[pkg] = ver as string
    console.log(`    + ${pkg}@${ver}`)
  }

  if (Object.keys(uniqueSourceDeps).length === 0) {
    console.log('  (no unique deps beyond luca)')
  }
  console.log()

  // ── 3. Set up bundle directory and install deps ───────────────────────────

  fs.ensureFolder(bundleDir)
  // outDir may exist as a plain file from a previous run with the old layout — remove it
  if (fs.existsSync(outDir) && !fs.isDirectory(outDir)) {
    await fs.rm(outDir)
  }
  fs.ensureFolder(outDir)
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

  // ── 4. Generate entry ─────────────────────────────────────────────────────

  console.log('→ Generating entry...')
  const entryPath = container.paths.resolve(bundleDir, 'entry.ts')
  fs.writeFile(entryPath, generateEntry(name, helperFiles, commandFiles))

  // ── 5. Compile for each target platform ───────────────────────────────────

  const targets = options.targets.split(',').map(t => t.trim()).filter(Boolean)
  console.log(`→ Compiling for ${targets.length} target(s)...`)
  console.log()

  const built: string[] = []
  const failed: string[] = []

  for (const target of targets) {
    const suffix = target === 'windows-x64' ? '.exe' : ''
    const targetOutFile = container.paths.resolve(outDir, `${name}-${target}${suffix}`)
    const compileCmd = `bun build ${entryPath} --compile --target=bun-${target} --outfile ${targetOutFile} --external node-llama-cpp`
    process.stdout.write(`  ${ui.colors.dim(target.padEnd(18))} `)

    const result = await proc.execAndCapture(compileCmd, { cwd: lucaRoot, silent: true })
    if (result.exitCode !== 0) {
      console.log(ui.colors.red('✗'))
      console.error(result.stderr)
      failed.push(target)
    } else {
      console.log(ui.colors.green('✓') + ui.colors.dim(` → ${targetOutFile}`))
      built.push(targetOutFile)
    }
  }

  console.log()
  if (built.length > 0) console.log(ui.colors.green(`✓ ${built.length} binaries in ${outDir}`))
  if (failed.length > 0) console.log(ui.colors.red(`✗ ${failed.length} failed: ${failed.join(', ')}`))
  console.log()
  console.log(`  Each binary loads the runtime project's luca.cli.ts and commands/ on top.`)
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

const LEGO_ROBOT = [
  ' ┌─○○─┐ ',
  ' │ ●● │ ',
  ' ├○──○┤ ',
  ' └─╨╨─┘ ',
]
const BANNER_COLORS = ['cyan', 'blue', 'magenta']

function stripAnsi(s: string): string {
  return s.replace(/\\x1B\\[[0-9;]*m/g, '')
}

function printHelp(container: any, bundledCommands: Set<string>, localCommands: Set<string>) {
  const ui = container.feature('ui') as any
  const c = ui.colors

  const args = container.argv._ as string[]
  const target = args[0] as string

  // help <command> — show single command detail
  if (target && container.commands.has(target)) {
    const Cmd = container.commands.lookup(target) as any
    const desc = Cmd.commandDescription || ''
    const schema = Cmd.argsSchema
    console.log()
    console.log(\`  \${c.cyan.bold('${name} ' + target)}  \${desc ? c.dim('— ') + desc : ''}\`)
    console.log()
    if (schema?.shape) {
      const opts = Object.entries(schema.shape)
        .filter(([k]) => !['_', 'name', '_cacheKey', 'dispatchSource'].includes(k))
        .map(([k, f]: [string, any]) => {
          let type = 'string'
          let cur = f
          let def: any
          while (cur) {
            const t = cur._def?.type || cur.type
            if (t === 'default') { def = cur._def?.defaultValue; if (typeof def === 'function') def = def() }
            if (t === 'boolean') { type = 'boolean'; break }
            if (t === 'string') { type = 'string'; break }
            if (t === 'number') { type = 'number'; break }
            if (t === 'enum') { type = cur.options?.join(' | ') || 'enum'; break }
            cur = cur._def?.innerType
          }
          return { flag: k, description: f.description || '', type, defaultValue: def }
        })
      const bools = opts.filter(o => o.type === 'boolean')
      const valued = opts.filter(o => o.type !== 'boolean')
      console.log(\`  \${c.white('Usage:')} \${c.cyan('${name} ' + target)} \${c.dim('[options]')}\`)
      if (valued.length) {
        console.log(); console.log(\`  \${c.white('Options:')}\`); console.log()
        const maxLen = Math.max(...valued.map(o => \`--\${o.flag} <\${o.type}>\`.length))
        for (const o of valued) {
          const flag = \`--\${o.flag} <\${o.type}>\`
          let line = \`    \${c.green(flag.padEnd(maxLen + 2))} \${o.description}\`
          if (o.defaultValue !== undefined && o.defaultValue !== false) line += \` \${c.dim(\`(default: \${o.defaultValue})\`)}\`
          console.log(line)
        }
      }
      if (bools.length) {
        console.log(); console.log(\`  \${c.white('Flags:')}\`); console.log()
        const maxLen = Math.max(...bools.map(o => \`--\${o.flag}\`.length))
        for (const o of bools) {
          let line = \`    \${c.green((\`--\${o.flag}\`).padEnd(maxLen + 2))} \${o.description}\`
          if (o.defaultValue === true) line += \` \${c.dim('(default: true)')}\`
          console.log(line)
        }
      }
    }
    console.log()
    return
  }

  // Main help — banner + command list
  const banner = ui.banner('${name}', { font: 'Small Slant', colors: BANNER_COLORS })
  const bannerLines = banner.split('\\n').filter((l: string) => l.trim())
  const coloredRobot = ui.applyGradient(LEGO_ROBOT.join('\\n'), BANNER_COLORS)
  const robotLines = coloredRobot.split('\\n') as string[]
  const robotWidth = Math.max(...LEGO_ROBOT.map(l => l.length))

  const headerLines: string[] = []
  const maxLines = Math.max(robotLines.length, bannerLines.length)
  for (let i = 0; i < maxLines; i++) {
    const rLine = robotLines[i] || ''
    const rPad = robotWidth - stripAnsi(rLine).length
    headerLines.push(rLine + ' '.repeat(rPad + 2) + (bannerLines[i] || ''))
  }

  console.log('\\n')
  console.log(headerLines.join('\\n'))
  console.log()
  console.log(c.white('  Usage: ') + c.cyan('${name}') + c.dim(' <command> [options]'))
  console.log()

  const allNames = (container.commands.available as string[]).sort()
  const maxNameLen = Math.max(...allNames.map((n: string) => n.length)) + 2

  const printCommands = (names: string[]) => {
    for (const n of names.sort()) {
      const Cmd = container.commands.lookup(n) as any
      const desc = Cmd?.commandDescription || ''
      console.log(\`    \${c.cyan(n.padEnd(maxNameLen))} \${c.dim(desc)}\`)
    }
  }

  const bundledNames = allNames.filter(n => bundledCommands.has(n))
  const localNames = allNames.filter(n => localCommands.has(n))
  const otherNames = allNames.filter(n => !bundledCommands.has(n) && !localCommands.has(n))

  if (bundledNames.length > 0) {
    console.log(c.white('  Commands:'))
    console.log()
    printCommands(bundledNames)
  }

  if (localNames.length > 0) {
    console.log()
    console.log(c.white('  Local Commands') + c.dim(' (./commands/*)'))
    console.log()
    printCommands(localNames)
  }

  if (otherNames.length > 0) {
    console.log()
    console.log(c.white('  Other Commands:'))
    console.log()
    printCommands(otherNames)
  }

  console.log()
  console.log(c.dim('  Run ') + c.cyan('${name} help <command>') + c.dim(' for detailed usage'))
  console.log()
}

async function main() {
  const discovery = process.env.LUCA_COMMAND_DISCOVERY || ''

  // Snapshot bundled commands before any local discovery
  const bundledCommands = new Set(container.commands.available as string[])

  // Global user CLI module (~/.luca/luca.cli.ts)
  await loadCliModule(join(homedir(), '.luca', 'luca.cli.ts'))

  // Local project CLI module — layering hook (e.g. @north's luca.cli.ts)
  await loadCliModule(join(process.cwd(), 'luca.cli.ts'))

  // Discover local project commands/ on top of the bundled ones
  if (discovery !== 'disable' && discovery !== 'no-local') {
    await discoverProjectCommands()
  }
  const afterLocal = new Set(container.commands.available as string[])
  const localCommands = new Set([...afterLocal].filter(n => !bundledCommands.has(n)))

  // User-level helpers (~/.luca/)
  if (discovery !== 'disable' && discovery !== 'no-home') {
    await discoverUserHelpers()
  }

  // Dispatch
  const args = container.argv._ as string[]
  const commandName = args[0] as string

  if (!commandName || commandName === 'help') {
    // help or no command: show main help, or help <target> for single command detail
    const target = commandName === 'help' ? args[1] : undefined
    if (target) container.argv._ = [target]
    printHelp(container, bundledCommands, localCommands)
  } else if (container.commands.has(commandName)) {
    await container.command(commandName as any).dispatch()
  } else {
    const phrase = args.join(' ')
    // @ts-ignore
    const missingCommandHandler = container.state.get('missingCommandHandler') as any
    if (typeof missingCommandHandler === 'function') {
      await missingCommandHandler({ words: args, phrase }).catch((err: any) => {
        console.error(\`Missing command handler error: \${err.message}\`, err)
      })
    } else {
      printHelp(container, bundledCommands, localCommands)
    }
  }
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
