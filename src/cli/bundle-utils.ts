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
// Runtime resolution
// ---------------------------------------------------------------------------

/**
 * Normalizes a --runtime package spec into a valid package.json dependency
 * value for the `luca` key: 'luca' → 'latest', 'luca@X' → 'X', and file:/
 * version/range specs pass through unchanged.
 */
export function normalizeRuntimeDependencySpec(spec: string): string {
  if (spec === 'luca') return 'latest'
  if (spec.startsWith('luca@')) return spec.slice('luca@'.length)
  return spec
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
  /** Path to the generated assets module, when the project embeds assets. */
  assetsPath?: string
  /** Path to the generated plugin module, when the project has a luca.plugin.ts. */
  pluginPath?: string
}

export function generateConsumerEntry(options: ConsumerEntryOptions): string {
  const builtinImports = (options.builtins ?? [])
    .map((name) => `import ${JSON.stringify(`luca/commands/${name}`)}`)
    .join('\n')

  // Order matters: manifest registers helpers, assistants/assets materialize
  // files on disk, then the plugin entry runs against them.
  const sideEffectImports = [options.assistantsPath, options.assetsPath, options.pluginPath]
    .filter((p): p is string => Boolean(p))
    .map((p) => `import ${JSON.stringify(p)}\n`)
    .join('')

  return `#!/usr/bin/env bun
import container from 'luca/agi'
${builtinImports ? builtinImports + '\n' : ''}import ${JSON.stringify(options.manifestPath)}
${sideEffectImports}import { runCli } from 'luca/cli/runner'

await runCli(container, {
  binaryName: ${JSON.stringify(options.binaryName)},
  discoverLocalCommands: true,
})
`
}

// ---------------------------------------------------------------------------
// Asset embedding + plugin entry
// ---------------------------------------------------------------------------

/** One embedded asset: a project-relative path and the files beneath it. */
export interface BundleAssetEntry {
  /** Project-relative path of the asset root (a directory or a single file). */
  path: string
  /** Files relative to the asset root; a single-file asset has one entry with path ''. */
  files: BundleAssistantFile[]
}

/**
 * Reads every embeddable file under a project-relative asset path. Shares the
 * assistant file filters so node_modules, logs and .DS_Store never ship.
 */
export function collectAsset(container: any, source: string, relPath: string): BundleAssetEntry | null {
  const fs = container.feature('fs') as any
  const normalized = relPath.replace(/^\.\//, '').replace(/\/+$/, '').split('\\').join('/')
  const abs = container.paths.resolve(source, normalized)
  if (!fs.existsSync(abs)) return null

  if (!fs.isDirectory(abs)) {
    const encoding = isBinaryAssistantFile(normalized) ? 'base64' as const : 'utf8' as const
    const content = encoding === 'base64'
      ? (fs.readFile(abs, null) as Buffer).toString('base64')
      : String(fs.readFile(abs))
    return { path: normalized, files: [{ path: '', content, encoding }] }
  }

  return { path: normalized, files: collectAssistantFolderFiles(container, abs) }
}

export interface AssetsModuleInput {
  binaryName: string
  assets: BundleAssetEntry[]
  /** Content hash of all embedded assets — used to skip re-extraction on startup. */
  bundleHash: string
}

/**
 * Generates the module that embeds arbitrary project assets (skills, docs,
 * workflows, templates — anything the code reads off disk at runtime) into a
 * consumer binary. On import it materializes them under
 * ~/.luca/bundles/<binary>/<path>, mirroring the project layout, so code that
 * resolved files against the project checkout keeps working when pointed at
 * the bundle root instead. Each asset root is replaced wholesale when the hash
 * changes; sibling folders owned by other modules (assistants/) are untouched.
 */
export function generateAssetsModule(input: AssetsModuleInput): string {
  const entries = input.assets
    .map((asset) => {
      const fileLines = asset.files
        .map((f) => `    { path: ${JSON.stringify(f.path)}, encoding: ${JSON.stringify(f.encoding)}, content: ${JSON.stringify(f.content)} },`)
        .join('\n')
      return `  ${JSON.stringify(asset.path)}: [\n${fileLines}\n  ],`
    })
    .join('\n')

  return `// Generated by \`luca bundle\`. Do not edit by hand.
// Importing this module materializes the embedded project assets on disk
// under ~/.luca/bundles/${input.binaryName}/ and exports that root.

import container from 'luca/agi'

interface EmbeddedFile {
  path: string
  encoding: 'utf8' | 'base64'
  content: string
}

const ASSETS_HASH = ${JSON.stringify(input.bundleHash)}

const ASSETS: Record<string, EmbeddedFile[]> = {
${entries}
}

const fs = container.feature('fs') as any
const os = container.feature('os') as any

export const bundleRoot: string = container.paths.resolve(os.homedir, '.luca', 'bundles', ${JSON.stringify(input.binaryName)})
const marker = container.paths.resolve(bundleRoot, '.assets-hash')
const existingHash = fs.exists(marker) ? String(fs.readFile(marker)).trim() : ''

if (existingHash !== ASSETS_HASH) {
  for (const [assetPath, files] of Object.entries(ASSETS)) {
    const target = container.paths.resolve(bundleRoot, assetPath)
    if (fs.exists(target)) fs.rmSync(target, { recursive: true, force: true })
    for (const file of files) {
      const dest = file.path ? container.paths.resolve(target, file.path) : target
      fs.ensureFolder(container.paths.resolve(dest, '..'))
      const data = file.encoding === 'base64' ? Buffer.from(file.content, 'base64') : file.content
      fs.writeFile(dest, data)
    }
  }
  fs.ensureFolder(bundleRoot)
  fs.writeFile(marker, ASSETS_HASH)
}

container.state.set('bundleRoot', bundleRoot)

export const bundledAssets = Object.keys(ASSETS)
`
}

export interface PluginModuleInput {
  binaryName: string
  /** Vendored path of the project's luca.plugin.ts, relative to the build dir. */
  pluginEntryPath: string
  /** Whether the assets module exists (it owns bundleRoot); otherwise derive it. */
  hasAssets: boolean
}

/**
 * Generates the module that runs the project's \`luca.plugin.ts\` entry inside
 * the binary, the same way \`helpers.usePlugin()\` would in a consumer project:
 * helpers are already registered by the manifest, so only \`attach()\` (or
 * \`main()\`) runs, with \`pluginDir\` pointing at the materialized bundle root.
 */
export function generatePluginModule(input: PluginModuleInput): string {
  const rootImport = input.hasAssets
    ? `import { bundleRoot } from './generated-consumer-assets.ts'`
    : `const os = container.feature('os') as any
const bundleRoot: string = container.paths.resolve(os.homedir, '.luca', 'bundles', ${JSON.stringify(input.binaryName)})`

  return `// Generated by \`luca bundle\`. Do not edit by hand.
// Runs the project's plugin entry against the bundle root, mirroring
// helpers.usePlugin(): discovery already happened via the manifest import.

import container from 'luca/agi'
import * as pluginModule from ${JSON.stringify(input.pluginEntryPath)}
${rootImport}

const mod: any = pluginModule
const exports = (mod?.default && (typeof mod.default.attach === 'function' || typeof mod.default.main === 'function'))
  ? mod.default
  : mod

const context = { pluginName: ${JSON.stringify(input.binaryName)}, pluginDir: bundleRoot, discovered: {}, bundled: true }

if (typeof exports?.attach === 'function') {
  await exports.attach(container, context)
} else if (typeof exports?.main === 'function') {
  await exports.main(container, context)
}
`
}

const RELATIVE_IMPORT_RE = /(?:import|export)\s*(?:[\s\S]*?\s+from\s*)?['"](\.{1,2}\/[^'"]+)['"]|import\s*\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g

/**
 * Relative import specifiers found in a TypeScript source: static imports,
 * re-exports, and dynamic \`import('./x')\` calls. Bare specifiers are the
 * package manager's problem and are skipped.
 */
export function relativeImportSpecifiers(source: string): string[] {
  const found = new Set<string>()
  for (const match of source.matchAll(RELATIVE_IMPORT_RE)) {
    const spec = match[1] || match[2]
    if (spec) found.add(spec)
  }
  return [...found]
}

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.js', '.mjs', '.json']

/**
 * Resolves a relative import the way bun does for a .ts project: exact path,
 * then with an extension appended, then as a directory index. A \`.js\`
 * specifier also tries the \`.ts\` sibling (TS-style extension rewriting).
 */
export function resolveRelativeImport(container: any, fromFile: string, spec: string): string | null {
  const fs = container.feature('fs') as any
  const base = container.paths.resolve(container.paths.dirname(fromFile), spec)
  const candidates = [base]
  if (/\.(js|mjs)$/.test(base)) candidates.push(base.replace(/\.(js|mjs)$/, '.ts'))
  for (const ext of RESOLVE_EXTENSIONS) candidates.push(base + ext)
  for (const ext of RESOLVE_EXTENSIONS) candidates.push(container.paths.resolve(base, 'index' + ext))
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && !fs.isDirectory(candidate)) return candidate
  }
  return null
}
