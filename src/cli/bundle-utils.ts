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

// ---------------------------------------------------------------------------
// Assistant bundling
// ---------------------------------------------------------------------------

/** A single file inside an assistant folder, embedded into the bundle. */
export interface BundleAssistantFile {
  /** Path relative to the assistant folder, posix separators. */
  path: string
  /** File contents — utf8 text, or base64 when the file is binary. */
  content: string
  encoding: 'utf8' | 'base64'
}

/** One assistant folder (a directory with a CORE.md) collected for embedding. */
export interface BundleAssistantEntry {
  name: string
  files: BundleAssistantFile[]
}

const BINARY_FILE_EXTENSIONS = new Set([
  '.mp3', '.wav', '.ogg', '.m4a', '.flac',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp',
  '.pdf', '.zip', '.gz', '.tar', '.br',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.sqlite', '.db', '.bin', '.wasm',
])

const EXCLUDED_ASSISTANT_DIRS = new Set(['node_modules', '.git', 'logs', 'dist', '.luca-bundle-build'])
const EXCLUDED_ASSISTANT_FILES = new Set(['.DS_Store', '.bundle-hash'])

/** Whether a file should be embedded as base64 rather than utf8 text. */
export function isBinaryAssistantFile(path: string): boolean {
  const dot = path.lastIndexOf('.')
  if (dot === -1) return false
  return BINARY_FILE_EXTENSIONS.has(path.slice(dot).toLowerCase())
}

/**
 * Whether a file inside an assistant folder should be embedded in the bundle.
 * Takes the path relative to the assistant folder.
 */
export function shouldIncludeAssistantFile(relPath: string): boolean {
  const segments = relPath.split('/')
  const base = segments[segments.length - 1] || ''
  if (EXCLUDED_ASSISTANT_FILES.has(base)) return false
  if (base.endsWith('.log')) return false
  return !segments.some((segment) => EXCLUDED_ASSISTANT_DIRS.has(segment))
}

/**
 * Reads every embeddable file in a single assistant folder, encoding binary
 * files as base64. Paths in the result are relative to the folder.
 */
export function collectAssistantFolderFiles(container: any, folder: string): BundleAssistantFile[] {
  const fs = container.feature('fs') as any
  const { files } = fs.walk(folder, { relative: true, exclude: ['node_modules', '.git'] })
  const collected: BundleAssistantFile[] = []

  for (const relPath of files as string[]) {
    const normalized = relPath.split('\\').join('/')
    if (!shouldIncludeAssistantFile(normalized)) continue

    const absPath = container.paths.resolve(folder, relPath)
    const encoding = isBinaryAssistantFile(normalized) ? 'base64' as const : 'utf8' as const
    const content = encoding === 'base64'
      ? (fs.readFile(absPath, null) as Buffer).toString('base64')
      : String(fs.readFile(absPath))

    collected.push({ path: normalized, content, encoding })
  }

  return collected
}

// ---------------------------------------------------------------------------
// Embedded runtime — install-free bundling
// ---------------------------------------------------------------------------

/**
 * Subpath exports for the synthesized node_modules/luca package written into
 * a bundle build dir. Each key mirrors a specifier the generated entry,
 * manifest, or consumer helper files may import; each value is a prebundled
 * runtime artifact produced from src/bundle-runtime/entries.
 */
export const RUNTIME_EXPORT_MAP: Record<string, string> = {
  '.': './index.js',
  './node': './index.js',
  './agi': './agi.js',
  './cli/runner': './cli-runner.js',
  './feature': './feature.js',
  './schemas': './schemas.js',
  './container': './container.js',
  './client': './client.js',
  './server': './server.js',
  './zod': './zod.js',
  './commands/*': './commands/*.js',
}

/** package.json for the synthesized node_modules/luca in a bundle build dir. */
export function generateRuntimePackageJson(version: string): string {
  return JSON.stringify({
    name: 'luca',
    version,
    type: 'module',
    exports: RUNTIME_EXPORT_MAP,
  }, null, 2)
}

/**
 * Files for the synthesized node_modules/zod shim. It re-exports the runtime's
 * own zod artifact so consumer helpers share the exact zod instance the
 * runtime uses (instanceof checks across schemas would break otherwise).
 */
export function generateZodShim(): { packageJson: string; index: string } {
  return {
    packageJson: JSON.stringify({
      name: 'zod',
      version: '0.0.0-luca-runtime',
      type: 'module',
      exports: { '.': './index.js' },
    }, null, 2),
    index: `export * from '../luca/zod.js'\nexport { default } from '../luca/zod.js'\n`,
  }
}

/**
 * Packages whose bundler-emitted form cannot survive a second bundling pass
 * (e.g. iroh reassigns `require`, which bun renames into an illegal import
 * assignment). They are kept external in the runtime prebundle and vendored
 * into the consumer build dir as their original npm package files, which bun
 * bundles cleanly from source during the consumer compile.
 */
export const VENDORED_RUNTIME_PACKAGES = ['@number0/iroh']

/** Specifiers every runtime prebundle and consumer compile must keep external. */
export const RUNTIME_EXTERNALS = ['node-llama-cpp', ...VENDORED_RUNTIME_PACKAGES]

/**
 * Expands the vendored package list with the napi-rs platform sibling packages
 * that are actually installed (e.g. @number0/iroh-darwin-arm64 next to
 * @number0/iroh) — the native .node bindings live in those, not in the base
 * package. Only host-platform siblings exist locally, so cross-target builds
 * carry only the platforms present at build time.
 */
export function expandVendorPackages(container: any, nodeModulesDir: string): string[] {
  const fs = container.feature('fs') as any
  const expanded: string[] = []

  for (const base of VENDORED_RUNTIME_PACKAGES) {
    expanded.push(base)

    const lastSlash = base.lastIndexOf('/')
    const parent = lastSlash === -1 ? '' : base.slice(0, lastSlash)
    const baseName = lastSlash === -1 ? base : base.slice(lastSlash + 1)
    const parentDir = parent
      ? container.paths.resolve(nodeModulesDir, parent)
      : nodeModulesDir

    if (!fs.existsSync(parentDir)) continue
    for (const entry of fs.readdirSync(parentDir) as string[]) {
      if (entry.startsWith(`${baseName}-`)) {
        expanded.push(parent ? `${parent}/${entry}` : entry)
      }
    }
  }

  return [...new Set(expanded)]
}

/** Maps each namespace exported by runtime-barrel.ts to its shim filename. */
export const RUNTIME_NAMESPACE_SHIMS: Record<string, string> = {
  lucaMain: 'index.js',
  lucaAgi: 'agi.js',
  lucaCliRunner: 'cli-runner.js',
  lucaFeature: 'feature.js',
  lucaSchemas: 'schemas.js',
  lucaContainer: 'container.js',
  lucaClient: 'client.js',
  lucaServer: 'server.js',
  lucaZod: 'zod.js',
}

const IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/**
 * Generates a specifier shim (e.g. node_modules/luca/agi.js) that statically
 * re-exports one namespace from the single-file runtime bundle. Names that are
 * not valid identifiers are skipped; `default` is forwarded explicitly.
 */
export function generateNamespaceShim(namespaceName: string, exportNames: string[]): string {
  const names = [...new Set(exportNames)]
    .filter((n) => n !== 'default' && IDENTIFIER_RE.test(n))
    .sort()
  const hasDefault = exportNames.includes('default')

  const lines = [
    `// Generated shim for the '${namespaceName}' namespace of the luca runtime.`,
    `import { ${namespaceName} as __ns } from './runtime-barrel.js'`,
  ]
  if (names.length > 0) {
    lines.push(`const { ${names.join(', ')} } = __ns`)
    lines.push(`export { ${names.join(', ')} }`)
  }
  if (hasDefault) {
    lines.push('export default __ns.default')
  }
  return lines.join('\n') + '\n'
}

/**
 * Generates a builtin-command shim (node_modules/luca/commands/<name>.js) that
 * registers the command as a side effect via the runtime's lazy loaders.
 */
export function generateCommandShim(commandName: string): string {
  return `// Generated shim registering the '${commandName}' builtin command.
import { commandLoaders } from '../runtime-barrel.js'
await commandLoaders[${JSON.stringify(commandName)}]()
`
}

/**
 * Prebundles runtime-barrel.ts into a single self-contained runtime-barrel.js
 * (plus any native-addon assets), then writes the specifier shims and
 * package.json that make it a complete synthesized node_modules/luca package.
 *
 * Used by `luca build-runtime` (output embedded into the compiled binary) and
 * by dev-mode `luca bundle` (fresh runtime straight into the build dir).
 * Returns the package's relative file list; vendored native packages are
 * resolved separately via expandVendorPackages().
 */
export async function buildRuntimePackage(
  container: any,
  options: { barrelPath: string; outDir: string; version: string },
): Promise<{ files: string[] }> {
  const fs = container.feature('fs') as any
  const proc = container.feature('proc') as any

  const args = [
    'build', options.barrelPath,
    '--outdir', options.outDir,
    '--target=bun',
    '--format=esm',
    ...RUNTIME_EXTERNALS.flatMap((e) => ['--external', e]),
  ]

  const result = await proc.spawnAndCapture('bun', args, { silent: true })
  if (result.exitCode !== 0) {
    throw new Error(`Runtime prebundle failed:\n${result.stderr || result.stdout}`)
  }

  // Introspect the barrel's namespaces from source to learn the export names
  // each shim must forward. This evaluates in the current (dev) process where
  // the modules are already loaded or loadable.
  const barrel = await import(options.barrelPath)

  for (const [namespaceName, shimFile] of Object.entries(RUNTIME_NAMESPACE_SHIMS)) {
    const ns = barrel[namespaceName]
    if (!ns) throw new Error(`runtime-barrel does not export namespace ${namespaceName}`)
    fs.writeFile(
      container.paths.resolve(options.outDir, shimFile),
      generateNamespaceShim(namespaceName, Object.keys(ns)),
    )
  }

  fs.ensureFolder(container.paths.resolve(options.outDir, 'commands'))
  for (const commandName of Object.keys(barrel.commandLoaders ?? {})) {
    fs.writeFile(
      container.paths.resolve(options.outDir, 'commands', `${commandName}.js`),
      generateCommandShim(commandName),
    )
  }

  fs.writeFile(
    container.paths.resolve(options.outDir, 'package.json'),
    generateRuntimePackageJson(options.version),
  )

  const { files } = fs.walk(options.outDir, { relative: true })
  return {
    files: (files as string[]).map((f) => f.split('\\').join('/')).sort(),
  }
}

/** One artifact's location within the concatenated runtime blob. */
export interface RuntimeBlobIndexEntry {
  path: string
  offset: number
  length: number
}

/**
 * Builds the offset index for a runtime blob from artifact sizes, in the
 * order the artifacts are concatenated.
 */
export function buildRuntimeBlobIndex(files: Array<{ path: string; size: number }>): RuntimeBlobIndexEntry[] {
  let offset = 0
  return files.map(({ path, size }) => {
    const entry = { path, offset, length: size }
    offset += size
    return entry
  })
}

/**
 * Generates src/bundle-runtime/embedded.generated.ts. The runtime artifacts
 * are concatenated into a single artifacts.blob which this module imports
 * with `{ type: 'file' }`, so `bun build --compile` embeds the bytes in the
 * luca binary; `luca bundle` slices files back out via the offset index to
 * materialize the runtime without any package installation.
 *
 * A single blob (rather than per-file imports) keeps tsc from pulling ~127MB
 * of bundled JS into its program (allowJs is on) and keeps the plain bun
 * runtime from trying to evaluate `.node` addon imports in dev.
 *
 * With an empty index the blob import is omitted entirely — the stub state
 * for fresh checkouts, where the blob file does not exist yet.
 */
export function generateEmbeddedRuntimeModule(index: RuntimeBlobIndexEntry[]): string {
  const header = `// Generated by \`luca build-runtime\`. Do not edit by hand.
// @ts-nocheck — the blob only exists after build-runtime has run`

  if (index.length === 0) {
    return `${header}

export const runtimeBlob: string | null = null

export const runtimeIndex: Array<{ path: string; offset: number; length: number }> = []
`
  }

  const entries = index
    .map((e) => `  { path: ${JSON.stringify(e.path)}, offset: ${e.offset}, length: ${e.length} },`)
    .join('\n')

  return `${header}
import _blob from './artifacts.blob' with { type: 'file' }

export const runtimeBlob: string | null = _blob

export const runtimeIndex: Array<{ path: string; offset: number; length: number }> = [
${entries}
]
`
}

export interface AssistantsModuleInput {
  binaryName: string
  assistants: BundleAssistantEntry[]
  /** Content hash of all embedded assistants — used to skip re-extraction on startup. */
  bundleHash: string
}

/**
 * Generates the module that embeds assistant folders into a consumer binary.
 * On import it materializes the assistant files to ~/.luca/bundles/<binary>/assistants
 * (skipped when the content hash matches a previous extraction) and registers the
 * folder with the assistantsManager, so bundled assistants behave exactly like
 * assistants discovered from a project's assistants/ directory.
 */
export function generateAssistantsModule(input: AssistantsModuleInput): string {
  const entries = input.assistants
    .map((assistant) => {
      const fileLines = assistant.files
        .map((f) => `    { path: ${JSON.stringify(f.path)}, encoding: ${JSON.stringify(f.encoding)}, content: ${JSON.stringify(f.content)} },`)
        .join('\n')
      return `  ${JSON.stringify(assistant.name)}: [\n${fileLines}\n  ],`
    })
    .join('\n')

  return `// Generated by \`luca bundle\`. Do not edit by hand.
// Importing this module materializes the embedded assistants on disk under
// ~/.luca/bundles/${input.binaryName}/assistants and registers that folder
// with the container's assistantsManager.

import container from 'luca/agi'

interface EmbeddedAssistantFile {
  path: string
  encoding: 'utf8' | 'base64'
  content: string
}

const BUNDLE_HASH = ${JSON.stringify(input.bundleHash)}

const ASSISTANTS: Record<string, EmbeddedAssistantFile[]> = {
${entries}
}

const fs = container.feature('fs') as any
const os = container.feature('os') as any

const root = container.paths.resolve(os.homedir, '.luca', 'bundles', ${JSON.stringify(input.binaryName)}, 'assistants')
const marker = container.paths.resolve(root, '.bundle-hash')
const existingHash = fs.exists(marker) ? String(fs.readFile(marker)).trim() : ''

if (existingHash !== BUNDLE_HASH) {
  fs.rmdirSync(root)
  for (const [name, files] of Object.entries(ASSISTANTS)) {
    for (const file of files) {
      const dest = container.paths.resolve(root, name, file.path)
      fs.ensureFolder(container.paths.resolve(dest, '..'))
      const data = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content
      fs.writeFile(dest, data)
    }
  }
  fs.writeFile(marker, BUNDLE_HASH)
}

const manager = container.feature('assistantsManager') as any
await manager.addDiscoveryFolder(root)

export const bundledAssistants = Object.keys(ASSISTANTS)
`
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

export interface ConsumerEntryOptions {
  binaryName: string
  manifestPath: string
  /** Luca built-in commands to compile into the binary (e.g. ['chat', 'assistant']). */
  builtins?: string[]
  /** Path to the generated assistants module, when the project bundles assistants. */
  assistantsPath?: string
}

export function generateConsumerEntry(options: ConsumerEntryOptions): string {
  const builtinImports = (options.builtins ?? [])
    .map((name) => `import ${JSON.stringify(`luca/commands/${name}`)}`)
    .join('\n')

  const assistantsImport = options.assistantsPath
    ? `import ${JSON.stringify(options.assistantsPath)}\n`
    : ''

  return `#!/usr/bin/env bun
import container from 'luca/agi'
${builtinImports ? builtinImports + '\n' : ''}import ${JSON.stringify(options.manifestPath)}
${assistantsImport}import { runCli } from 'luca/cli/runner'

await runCli(container, {
  binaryName: ${JSON.stringify(options.binaryName)},
  discoverLocalCommands: true,
})
`
}
