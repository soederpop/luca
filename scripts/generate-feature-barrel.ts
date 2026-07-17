/**
 * Generates the feature barrels:
 *
 *   - src/node/features.generated.ts  (type-only: side-effect imports + type re-exports)
 *   - src/agi/features.generated.ts   (value exports: agi consumers and VM module
 *     seeding need the actual classes, and importing them triggers registration)
 *
 * Scans each features directory for classes registered via
 * `Feature.register(this, 'id')` static blocks or top-level
 * `features.register('id', Class)` calls, and emits:
 *
 *   1. imports of every registered feature module (triggers registration)
 *   2. re-exports of every exported class / interface / type alias / enum
 *   3. a Generated*Features interface mapping registry ids to feature classes
 *
 * The container files consume these barrels, replacing the old hand-maintained
 * checklist (side-effect import, type import, re-export, interface entry).
 *
 * Files with no registration call (support modules) are skipped entirely.
 * Cross-module export name collisions within a barrel fail generation loudly.
 *
 * Run with: bun run build:feature-barrel
 */
import * as ts from 'typescript'
import { NodeContainer } from '../src/node/container.js'

const container = new NodeContainer()
const fs = container.fs

interface Target {
  dir: string
  outputPath: string
  interfaceName: string
  /** interface heritage clause, e.g. "extends AvailableFeatures" (with matching extra import) */
  interfaceExtends?: { clause: string; importLine: string }
  /** 'type' — type-only barrel; 'value' — value-export feature classes + exports record */
  exportStyle: 'type' | 'value'
  /** name of the emitted record of feature classes (value style only) */
  exportsRecordName?: string
}

const targets: Target[] = [
  {
    dir: 'src/node/features',
    outputPath: 'src/node/features.generated.ts',
    interfaceName: 'GeneratedNodeFeatures',
    interfaceExtends: {
      clause: ' extends AvailableFeatures',
      importLine: 'import type { AvailableFeatures } from "../feature";',
    },
    exportStyle: 'type',
  },
  {
    dir: 'src/agi/features',
    outputPath: 'src/agi/features.generated.ts',
    interfaceName: 'GeneratedAGIFeatures',
    exportStyle: 'value',
    exportsRecordName: 'generatedAgiFeatureExports',
  },
]

interface ModuleInfo {
  /** module specifier relative to the barrel, e.g. "./features/fs" */
  specifier: string
  /** registry id -> class name for each registration in the file */
  registrations: Array<{ id: string; className: string }>
  /** every exported class / interface / type alias / enum name */
  exportedTypes: string[]
}

function hasExportModifier(node: ts.HasModifiers): boolean {
  return !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
}

/** Find a `Feature.register(this, 'id')` call inside the class's static blocks. */
function findStaticRegistration(classNode: ts.ClassDeclaration, sourceFile: ts.SourceFile): string | null {
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

/**
 * Find top-level `features.register('id', ClassName)` calls
 * (e.g. model-providers.ts registers outside the class body).
 */
function findTopLevelRegistrations(sourceFile: ts.SourceFile): Array<{ id: string; className: string }> {
  const found: Array<{ id: string; className: string }> = []

  const inspect = (expr: ts.Expression) => {
    if (!ts.isCallExpression(expr)) return
    const text = expr.expression.getText(sourceFile)
    if (!text.endsWith('.register')) return
    const [first, second] = expr.arguments
    if (first && second && ts.isStringLiteralLike(first) && ts.isIdentifier(second)) {
      found.push({ id: first.text, className: second.text })
    } else if (first && second && ts.isIdentifier(first) && ts.isStringLiteralLike(second)) {
      found.push({ id: second.text, className: first.text })
    }
  }

  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement)) inspect(statement.expression)
    else if (ts.isExportAssignment(statement)) inspect(statement.expression)
  }

  return found
}

function scanFile(filePath: string): ModuleInfo | null {
  const source = fs.readFile(filePath, 'utf-8') as string
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true)

  const registrations: ModuleInfo['registrations'] = []
  const exportedTypes: string[] = []

  for (const statement of sourceFile.statements) {
    if (ts.isClassDeclaration(statement) && statement.name && hasExportModifier(statement)) {
      exportedTypes.push(statement.name.text)
      const id = findStaticRegistration(statement, sourceFile)
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

  for (const reg of findTopLevelRegistrations(sourceFile)) {
    if (!registrations.some((r) => r.id === reg.id)) registrations.push(reg)
  }

  if (!registrations.length) return null

  const deduped = [...new Set(exportedTypes)]
  exportedTypes.length = 0
  exportedTypes.push(...deduped)

  const base = container.paths.basename(filePath).replace(/\.ts$/, '')
  return { specifier: `./features/${base}`, registrations, exportedTypes }
}

async function generateTarget(target: Target) {
  const featuresDir = container.paths.resolve(target.dir)
  const outputPath = container.paths.resolve(target.outputPath)

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

  const featureClassNames = new Set(modules.flatMap((m) => m.registrations.map((r) => r.className)))

  const lines: string[] = [
    '/**',
    ' * AUTO-GENERATED by scripts/generate-feature-barrel.ts — DO NOT EDIT.',
    ' *',
    ' * Regenerate with: bun run build:feature-barrel',
    ' *',
    ' * Adding a feature only requires the feature file itself (class + static',
    ' * stability + Feature.register static block). This barrel supplies the',
    ' * imports, re-exports, and the feature-id -> class interface the',
    ' * container builds its Features type from.',
    ' */',
  ]
  if (target.interfaceExtends) lines.push(target.interfaceExtends.importLine)
  lines.push('')

  if (target.exportStyle === 'type') {
    for (const mod of modules) lines.push(`import "${mod.specifier}";`)
    lines.push('')
    for (const mod of modules) {
      const classNames = mod.registrations.map((r) => r.className)
      lines.push(`import type { ${classNames.join(', ')} } from "${mod.specifier}";`)
    }
    lines.push('')
    for (const mod of modules) {
      lines.push(`export type { ${mod.exportedTypes.join(', ')} } from "${mod.specifier}";`)
    }
  } else {
    // Value style: import feature classes as values (triggers registration),
    // re-export them as values, everything else type-only.
    for (const mod of modules) {
      const classNames = mod.registrations.map((r) => r.className)
      lines.push(`import { ${classNames.join(', ')} } from "${mod.specifier}";`)
    }
    lines.push('')
    for (const mod of modules) {
      const classNames = mod.registrations.map((r) => r.className)
      lines.push(`export { ${classNames.join(', ')} } from "${mod.specifier}";`)
      const typeOnly = mod.exportedTypes.filter((n) => !featureClassNames.has(n))
      if (typeOnly.length) {
        lines.push(`export type { ${typeOnly.join(', ')} } from "${mod.specifier}";`)
      }
    }
  }
  lines.push('')

  lines.push(`export interface ${target.interfaceName}${target.interfaceExtends?.clause ?? ''} {`)
  const allRegistrations = modules.flatMap((m) => m.registrations).sort((a, b) => a.id.localeCompare(b.id))
  for (const { id, className } of allRegistrations) {
    lines.push(`  ${id}: typeof ${className};`)
  }
  lines.push('}')
  lines.push('')

  if (target.exportStyle === 'value' && target.exportsRecordName) {
    lines.push('/** Every registered feature class, keyed by class name — for use() loops and VM module seeding. */')
    lines.push(`export const ${target.exportsRecordName} = {`)
    const sortedClassNames = [...featureClassNames].sort()
    for (const className of sortedClassNames) {
      lines.push(`  ${className},`)
    }
    lines.push('} as const;')
    lines.push('')
  }

  fs.writeFile(outputPath, lines.join('\n'))

  console.log(`Wrote ${outputPath}`)
  console.log(`  ${modules.length} feature modules, ${allRegistrations.length} registrations`)
  if (skipped.length) console.log(`  Skipped (no registration call): ${skipped.join(', ')}`)
}

async function main() {
  for (const target of targets) {
    await generateTarget(target)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
