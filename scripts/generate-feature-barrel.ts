/**
 * Generates src/node/features.generated.ts — the node feature barrel.
 *
 * Scans src/node/features/*.ts for classes registered via `Feature.register(this, 'id')`
 * and emits a single committed file containing:
 *
 *   1. side-effect imports (triggers registration)
 *   2. type re-exports of every exported class / interface / type alias / enum
 *   3. the GeneratedNodeFeatures interface mapping registry ids to feature classes
 *
 * src/node/container.ts consumes this file, replacing the old hand-maintained
 * 4-step checklist (side-effect import, type import, re-export, interface entry).
 *
 * Files with no Feature.register call (support modules) are skipped entirely.
 * Cross-module export name collisions fail generation loudly.
 *
 * Run with: bun run build:feature-barrel
 */
import * as ts from 'typescript'
import { NodeContainer } from '../src/node/container.js'

const container = new NodeContainer()
const fs = container.fs
const featuresDir = container.paths.resolve('src/node/features')
const outputPath = container.paths.resolve('src/node/features.generated.ts')

interface ModuleInfo {
  /** module specifier relative to src/node, e.g. "./features/fs" */
  specifier: string
  /** registry id -> class name for each Feature.register call in the file */
  registrations: Array<{ id: string; className: string }>
  /** every exported class / interface / type alias / enum name */
  exportedTypes: string[]
}

function hasExportModifier(node: ts.HasModifiers): boolean {
  return !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/** Find a `Feature.register(this, 'id')` call inside the class's static blocks. */
function findRegistration(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): string | null {
  let id: string | null = null

  const visit = (node: ts.Node) => {
    if (id) return
    if (ts.isCallExpression(node)) {
      const text = node.expression.getText(sourceFile)
      if (text.endsWith('.register') || text === 'register') {
        const [, idArg] = node.arguments
        if (idArg && ts.isStringLiteralLike(idArg)) {
          id = idArg.text
        } else if (node.arguments.length === 1 && classNode.name) {
          // Feature.register(this) — default id is camelCase(className)
          id = container.utils.stringUtils.camelCase(classNode.name.text)
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  for (const member of classNode.members) {
    if (ts.isClassStaticBlockDeclaration(member)) visit(member)
  }

  return id
}

function scanFile(filePath: string): ModuleInfo | null {
  const source = fs.readFile(filePath, 'utf-8') as string
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)

  const registrations: ModuleInfo['registrations'] = []
  const exportedTypes: string[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name && hasExportModifier(statement)) {
      exportedTypes.push(statement.name.text)
      const id = findRegistration(statement, sourceFile)
      if (id) registrations.push({ id, className: statement.name.text })
    } else if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement) ||
        ts.isEnumDeclaration(statement)) &&
      hasExportModifier(statement)
    ) {
      exportedTypes.push(statement.name.text)
    } else if (
      ts.isExportDeclaration(statement) &&
      !statement.moduleSpecifier &&
      statement.exportClause &&
      ts.isNamedExports(statement.exportClause)
    ) {
      // export { RedisFeature as Redis } — collect the exported (aliased) names
      for (const element of statement.exportClause.elements) {
        exportedTypes.push(element.name.text)
      }
    }
  }

  if (!registrations.length) return null

  const deduped = [...new Set(exportedTypes)]
  exportedTypes.length = 0
  exportedTypes.push(...deduped)

  const base = container.paths.basename(filePath).replace(/\.ts$/, '')
  return { specifier: `./features/${base}`, registrations, exportedTypes }
}

async function main() {
  const entries = (await fs.readdir(featuresDir))
    .filter((f: string) => f.endsWith('.ts') && !f.includes('.generated'))
    .sort()

  const modules: ModuleInfo[] = []
  const skipped: string[] = []

  for (const entry of entries) {
    const info = scanFile(container.paths.resolve(featuresDir, entry))
    if (info) modules.push(info)
    else skipped.push(entry)
  }

  // Fail loudly on cross-module export name collisions — silent `export *`
  // drops would break consumer type imports.
  const seen = new Map<string, string>()
  for (const mod of modules) {
    for (const name of mod.exportedTypes) {
      const existing = seen.get(name)
      if (existing) {
        throw new Error(
          `Export name collision: "${name}" is exported by both ${existing} and ${mod.specifier}. ` +
            `Rename one of them — every feature-module export must be unique.`
        )
      }
      seen.set(name, mod.specifier)
    }
  }

  const duplicateIds = new Map<string, string>()
  for (const mod of modules) {
    for (const { id } of mod.registrations) {
      const existing = duplicateIds.get(id)
      if (existing) {
        throw new Error(`Registry id collision: "${id}" registered by both ${existing} and ${mod.specifier}.`)
      }
      duplicateIds.set(id, mod.specifier)
    }
  }

  const lines: string[] = [
    '/**',
    ' * AUTO-GENERATED by scripts/generate-feature-barrel.ts — DO NOT EDIT.',
    ' *',
    ' * Regenerate with: bun run build:feature-barrel',
    ' *',
    ' * Adding a feature only requires the feature file itself (class + static',
    ' * stability + Feature.register static block). This barrel supplies the',
    ' * side-effect imports, type re-exports, and the GeneratedNodeFeatures',
    ' * interface that src/node/container.ts builds NodeFeatures from.',
    ' */',
    'import type { AvailableFeatures } from "../feature";',
    '',
  ]

  for (const mod of modules) {
    lines.push(`import "${mod.specifier}";`)
  }
  lines.push('')

  for (const mod of modules) {
    const classNames = mod.registrations.map((r) => r.className)
    lines.push(`import type { ${classNames.join(', ')} } from "${mod.specifier}";`)
  }
  lines.push('')

  for (const mod of modules) {
    lines.push(`export type { ${mod.exportedTypes.join(', ')} } from "${mod.specifier}";`)
  }
  lines.push('')

  lines.push('export interface GeneratedNodeFeatures extends AvailableFeatures {')
  const allRegistrations = modules.flatMap((m) => m.registrations).sort((a, b) => a.id.localeCompare(b.id))
  for (const { id, className } of allRegistrations) {
    lines.push(`  ${id}: typeof ${className};`)
  }
  lines.push('}')
  lines.push('')

  fs.writeFile(outputPath, lines.join('\n'))

  console.log(`Wrote ${outputPath}`)
  console.log(`  ${modules.length} feature modules, ${allRegistrations.length} registrations`)
  if (skipped.length) console.log(`  Skipped (no Feature.register): ${skipped.join(', ')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
