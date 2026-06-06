export function safeIdent(name: string): string {
  return name.replace(/[-./]/g, '_')
}

export function commandNameFromFile(file: string): string | null {
  const base = file.split('/').pop() || ''
  if (!base || base === 'index.ts') return null
  if (!base.endsWith('.ts')) return null
  return base.replace(/\.ts$/, '')
}

export function normalizeTargets(input: string): string[] {
  return input.split(',').map((s) => s.trim()).filter(Boolean)
}

export function quoteImportPath(path: string): string {
  return JSON.stringify(path)
}

export function shouldIncludeBundleFile(path: string): boolean {
  return path.endsWith('.ts')
    && !path.endsWith('.test.ts')
    && !path.endsWith('.spec.ts')
    && !path.includes('.generated')
}

export interface BundleCommandFile {
  file: string
  name: string
}

export interface ConsumerManifestInput {
  helperFiles: string[]
  commandFiles: BundleCommandFile[]
}

export function generateConsumerManifest(input: ConsumerManifestInput): string {
  const helperImports = input.helperFiles
    .map((file) => `import ${quoteImportPath(file)}`)
    .join('\n')

  const commandImports = input.commandFiles
    .map(({ file, name }) => `import * as _cmd_${safeIdent(name)} from ${quoteImportPath(file)}`)
    .join('\n')

  const registrations = input.commandFiles
    .map(({ name }) => `registerBundledCommand(${JSON.stringify(name)}, _cmd_${safeIdent(name)})`)
    .join('\n')

  return `import { Command, commands, graftModule, isNativeHelperClass } from 'luca'

${helperImports}

${commandImports}

function registerBundledCommand(name: string, mod: any) {
  if (commands.has(name)) return

  if (isNativeHelperClass(mod.default, Command)) {
    commands.register(name, mod.default)
    return
  }

  const commandModule = mod.default || mod

  if (typeof commandModule.run === 'function') {
    commands.register(name, graftModule(Command as any, commandModule, name, 'commands') as any)
    return
  }

  if (typeof commandModule.handler === 'function') {
    commands.register(name, graftModule(Command as any, {
      description: commandModule.description,
      argsSchema: commandModule.argsSchema,
      positionals: commandModule.positionals ?? mod.positionals,
      handler: commandModule.handler,
    }, name, 'commands') as any)
    return
  }

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

${registrations}
`
}

export function generateConsumerEntry(options: { binaryName: string; manifestPath: string }): string {
  return `#!/usr/bin/env bun
import container from 'luca/agi'
import ${JSON.stringify(options.manifestPath)}
import { runCli } from 'luca/cli/runner'

await runCli(container, {
  binaryName: ${JSON.stringify(options.binaryName)},
  discoverLocalCommands: true,
})
`
}
