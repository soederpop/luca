import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import * as readline from 'readline'
import * as fs from 'fs'
import { spawn } from 'child_process'
import * as path from 'path'

export const argsSchema = CommandOptionsSchema.extend({
  reset: z.boolean().default(false).describe('Reset all audit progress'),
  module: z.string().optional().describe('Jump directly to a specific module by shortcut'),
})

// ── Types ────────────────────────────────────────────────────────────────────

type ItemStatus = 'good' | 'needs_work' | 'skipped' | 'pending'

type ModuleProgress = {
  status: 'pending' | 'in_progress' | 'completed'
  items: Record<string, ItemStatus>
  lastItem?: string
}

type AuditProgress = {
  modules: Record<string, ModuleProgress>
  lastModule?: string
}

type AuditItem = {
  id: string
  kind: 'class_jsdoc' | 'static_description' | 'method_jsdoc' | 'method_param' | 'getter_jsdoc' | 'option_describe' | 'state_describe' | 'event_describe'
  label: string
  currentValue: string
  line: number
  filePath: string
}

type ModuleInfo = {
  shortcut: string
  registryName: string
  filePath: string
  mtime: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
}

function c(color: keyof typeof COLORS, text: string): string {
  return `${COLORS[color]}${text}${COLORS.reset}`
}

function statusIcon(status: ItemStatus): string {
  switch (status) {
    case 'good': return c('green', '✓')
    case 'needs_work': return c('yellow', '~')
    case 'skipped': return c('dim', '–')
    case 'pending': return c('dim', '○')
  }
}

function moduleStatusIcon(status: ModuleProgress['status']): string {
  switch (status) {
    case 'completed': return c('green', '✓')
    case 'in_progress': return c('yellow', '◐')
    case 'pending': return c('dim', '○')
  }
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim().toLowerCase()))
  })
}

function clearScreen() {
  process.stdout.write('\x1b[2J\x1b[H')
}

// ── Source file discovery ────────────────────────────────────────────────────

function discoverModules(container: any, fm: any): ModuleInfo[] {
  const registries = [
    { name: 'features', paths: ['src/node/features/*.ts', 'src/web/features/*.ts'] },
    { name: 'clients', paths: ['src/node/clients/*.ts', 'src/web/clients/*.ts', 'src/clients/*.ts'] },
    { name: 'servers', paths: ['src/node/servers/*.ts', 'src/servers/*.ts'] },
  ]

  const modules: ModuleInfo[] = []
  const seen = new Set<string>()

  for (const reg of registries) {
    const available: string[] = container[reg.name]?.available ?? []

    for (const pattern of reg.paths) {
      const files = fm.match(pattern) as string[]
      for (const relPath of files) {
        const absPath = path.resolve(container.cwd, relPath)
        let content: string
        try {
          content = fs.readFileSync(absPath, 'utf-8')
        } catch {
          continue
        }

        // Find which shortcut this file registers via the register() call
        // Pattern: .register('shortcut', Class) or .register("shortcut", Class)
        for (const shortcut of available) {
          const fullShortcut = `${reg.name}.${shortcut}`
          if (seen.has(fullShortcut)) continue

          // Look specifically for the register call or the static shortcut declaration
          const registerPattern = new RegExp(
            `\\.register\\(\\s*['"\`]${shortcut}['"\`]` +
            `|shortcut\\s*=\\s*['"\`]${fullShortcut}['"\`]`
          )

          if (registerPattern.test(content)) {
            let mtime = 0
            try {
              mtime = fs.statSync(absPath).mtimeMs
            } catch {}

            modules.push({
              shortcut,
              registryName: reg.name,
              filePath: absPath,
              mtime,
            })
            seen.add(fullShortcut)
          }
        }
      }
    }
  }

  // Sort by mtime descending (most recently edited first)
  modules.sort((a, b) => b.mtime - a.mtime)
  return modules
}

// ── Source file parsing for audit items ───────────────────────────────────────

function findClassEnd(lines: string[], classStartLine: number): number {
  // Find matching closing brace for the class. classStartLine is 0-indexed.
  let braceDepth = 0
  let foundOpen = false
  for (let i = classStartLine; i < lines.length; i++) {
    for (const ch of lines[i]!) {
      if (ch === '{') { braceDepth++; foundOpen = true }
      if (ch === '}') braceDepth--
      if (foundOpen && braceDepth === 0) return i
    }
  }
  return lines.length - 1
}

function extractAuditItems(filePath: string, shortcut: string, registryName: string): AuditItem[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  const items: AuditItem[] = []
  const prefix = `${registryName}:${shortcut}`
  const fullShortcut = `${registryName}.${shortcut}`

  // Find the class that declares this shortcut
  let classLine = -1  // 0-indexed
  let className = ''
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i]!.match(/^export\s+class\s+(\w+)\s+extends\s+\w*(?:Feature|Client|Server|Helper)/)
    if (match) {
      // Check if this class declares the shortcut we're looking for
      // by scanning its static shortcut property within the next ~15 lines
      for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
        if (
          lines[j]!.includes(`"${shortcut}"`) ||
          lines[j]!.includes(`'${shortcut}'`) ||
          lines[j]!.includes(`"${fullShortcut}"`) ||
          lines[j]!.includes(`'${fullShortcut}'`)
        ) {
          classLine = i
          className = match[1]!
          break
        }
      }
      if (classLine >= 0) break
    }
  }

  if (classLine === -1) return items

  const classEnd = findClassEnd(lines, classLine)

  // 1. Class JSDoc
  const classJsdoc = findJSDocAbove(lines, classLine)
  items.push({
    id: `${prefix}:class_jsdoc`,
    kind: 'class_jsdoc',
    label: `${className} class JSDoc`,
    currentValue: classJsdoc.text,
    line: classJsdoc.line > 0 ? classJsdoc.line : classLine + 1,
    filePath,
  })

  // 2. Static description
  for (let i = classLine; i <= classEnd; i++) {
    const descMatch = lines[i]!.match(/static\s+(?:override\s+)?description\s*[=:]\s*["'`](.*)["'`]/)
    if (descMatch) {
      items.push({
        id: `${prefix}:static_description`,
        kind: 'static_description',
        label: `static description`,
        currentValue: descMatch[1] || '',
        line: i + 1,
        filePath,
      })
      break
    }
  }

  // 3. Options schema .describe() calls
  findSchemaDescribes(lines, filePath, prefix, 'option', 'Options').forEach(item => items.push(item))

  // 4. State schema .describe() calls
  findSchemaDescribes(lines, filePath, prefix, 'state', 'State').forEach(item => items.push(item))

  // 5. Events schema .describe() calls
  findSchemaDescribes(lines, filePath, prefix, 'event', 'Events').forEach(item => items.push(item))

  // 6. Getters within class bounds
  for (let i = classLine + 1; i <= classEnd; i++) {
    const getterMatch = lines[i]!.match(/^\s+(?:override\s+)?get\s+(\w+)\s*\(/)
    if (getterMatch) {
      const name = getterMatch[1]!
      if (['initialState', 'container', 'options', 'context', 'cacheKey', 'isEnabled', 'shortcut'].includes(name)) continue
      const jsdoc = findJSDocAbove(lines, i)
      items.push({
        id: `${prefix}:getter:${name}`,
        kind: 'getter_jsdoc',
        label: `get ${name}()`,
        currentValue: jsdoc.text,
        line: jsdoc.line > 0 ? jsdoc.line : i + 1,
        filePath,
      })
    }
  }

  // 7. Methods within class bounds
  for (let i = classLine + 1; i <= classEnd; i++) {
    const line = lines[i]!
    // Match method declarations (with or without async)
    const methodMatch = line.match(/^\s+(?:async\s+)?(\w+)\s*\(/)
    if (methodMatch) {
      const name = methodMatch[1]!
      if (name === 'constructor' || name.startsWith('_') || name === 'afterInitialize' || name === 'enable') continue
      if (line.includes('private ') || line.includes('static ')) continue
      if (line.match(/^\s+(?:override\s+)?(?:get|set)\s+/)) continue

      const jsdoc = findJSDocAbove(lines, i)
      items.push({
        id: `${prefix}:method:${name}`,
        kind: 'method_jsdoc',
        label: `${name}()`,
        currentValue: jsdoc.text,
        line: jsdoc.line > 0 ? jsdoc.line : i + 1,
        filePath,
      })

      // Extract method params and their docs
      const paramNames = extractParamNames(lines, i)
      for (const pName of paramNames) {
        const paramDesc = jsdoc.text ? extractParamDescription(jsdoc.text, pName) : ''
        items.push({
          id: `${prefix}:method:${name}:param:${pName}`,
          kind: 'method_param',
          label: `  @param ${pName}`,
          currentValue: paramDesc,
          line: jsdoc.line > 0 ? jsdoc.line : i + 1,
          filePath,
        })
      }
    }
  }

  return items
}

function findJSDocAbove(lines: string[], lineIdx: number): { text: string; line: number } {
  // Walk backwards from lineIdx looking for a JSDoc block ending with */
  let i = lineIdx - 1
  // Skip blank lines
  while (i >= 0 && lines[i]!.trim() === '') i--

  if (i < 0 || !lines[i]!.trim().endsWith('*/')) {
    return { text: '', line: 0 }
  }

  // Found end of JSDoc, walk backwards to find /**
  const endLine = i
  while (i >= 0 && !lines[i]!.includes('/**')) i--

  if (i < 0) return { text: '', line: 0 }

  const startLine = i
  const jsdocLines = lines.slice(startLine, endLine + 1)
  const text = jsdocLines.join('\n')
  return { text, line: startLine + 1 } // 1-indexed
}

function findSchemaDescribes(
  lines: string[],
  filePath: string,
  prefix: string,
  kind: 'option' | 'state' | 'event',
  schemaKeyword: string,
): AuditItem[] {
  const items: AuditItem[] = []
  const auditKind = `${kind}_describe` as AuditItem['kind']

  // Look for schema definitions like FooOptionsSchema = ... .extend({
  // and then find individual .describe() calls within
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.includes(schemaKeyword) || !line.includes('Schema')) continue
    if (!line.includes('extend') && !line.includes('object')) continue

    // Scan forward within the schema block for property .describe() calls
    let braceDepth = 0
    let inSchema = false
    for (let j = i; j < lines.length; j++) {
      const sline = lines[j]!
      for (const ch of sline) {
        if (ch === '{') { braceDepth++; inSchema = true }
        if (ch === '}') braceDepth--
      }

      // Look for: propertyName: z.something().describe('...')
      const propMatch = sline.match(/^\s+(\w+)\s*:\s*z\./)
      if (propMatch && inSchema) {
        const propName = propMatch[1]!
        const describeMatch = sline.match(/\.describe\(\s*['"`](.*)['"`]\s*\)/)
        const descValue = describeMatch ? describeMatch[1] || '' : ''
        items.push({
          id: `${prefix}:${kind}:${propName}`,
          kind: auditKind,
          label: `${kind} schema: ${propName}`,
          currentValue: descValue ? `.describe('${descValue}')` : '',
          line: j + 1,
          filePath,
        })
      }

      if (inSchema && braceDepth === 0) break
    }
    break // only process first matching schema
  }

  return items
}

function extractParamNames(lines: string[], methodLine: number): string[] {
  // Read the method signature (possibly multi-line) and extract parameter names
  const params: string[] = []
  let parenDepth = 0
  let started = false

  for (let i = methodLine; i < Math.min(methodLine + 15, lines.length); i++) {
    const line = lines[i]!
    for (let j = 0; j < line.length; j++) {
      if (line[j] === '(') { parenDepth++; started = true }
      if (line[j] === ')') parenDepth--
      if (started && parenDepth === 0) {
        // Extract param names from the collected signature
        const sigStart = lines[methodLine]!.indexOf('(')
        let sig = ''
        for (let k = methodLine; k <= i; k++) {
          sig += lines[k]! + '\n'
        }
        const insideParens = sig.substring(sig.indexOf('(') + 1, sig.lastIndexOf(')'))
        // Split by commas (respecting nested generics/objects)
        const paramStrings = splitParams(insideParens)
        for (const ps of paramStrings) {
          const nameMatch = ps.trim().match(/^(\w+)/)
          if (nameMatch && nameMatch[1]) {
            params.push(nameMatch[1])
          }
        }
        return params
      }
    }
  }
  return params
}

function splitParams(sig: string): string[] {
  const results: string[] = []
  let depth = 0
  let current = ''
  for (const ch of sig) {
    if (ch === '<' || ch === '{' || ch === '(') depth++
    if (ch === '>' || ch === '}' || ch === ')') depth--
    if (ch === ',' && depth === 0) {
      results.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) results.push(current)
  return results
}

function extractParamDescription(jsdoc: string, paramName: string): string {
  const regex = new RegExp(`@param\\s+(?:\\{[^}]*\\}\\s+)?\\[?${paramName}[^\\n]*`, 'g')
  const match = jsdoc.match(regex)
  if (!match) return ''
  return match[0]!
}

// ── Display ──────────────────────────────────────────────────────────────────

function printHeader(title: string) {
  const line = '─'.repeat(60)
  console.log(`\n${c('cyan', line)}`)
  console.log(c('bold', `  ${title}`))
  console.log(`${c('cyan', line)}\n`)
}

function printModuleList(modules: ModuleInfo[], progress: AuditProgress) {
  printHeader('Audit Modules (sorted by last edit)')

  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i]!
    const key = `${mod.registryName}.${mod.shortcut}`
    const mp = progress.modules[key]
    const icon = mp ? moduleStatusIcon(mp.status) : c('dim', '○')
    const date = new Date(mod.mtime).toLocaleDateString()

    let itemCounts = ''
    if (mp) {
      const total = Object.keys(mp.items).length
      const good = Object.values(mp.items).filter(s => s === 'good').length
      const needs = Object.values(mp.items).filter(s => s === 'needs_work').length
      if (total > 0) {
        itemCounts = c('dim', ` (${good}/${total} good${needs > 0 ? `, ${needs} needs work` : ''})`)
      }
    }

    console.log(`  ${icon} ${c('bold', `${i + 1}.`)} ${c('white', key)} ${c('dim', date)}${itemCounts}`)
  }

  console.log()
}

function printAuditItem(item: AuditItem, status: ItemStatus, index: number, total: number) {
  const relPath = item.filePath.replace(process.cwd() + '/', '')
  console.log(c('dim', `  ${relPath}:${item.line}`))
  console.log(c('bold', `  [${index + 1}/${total}] ${item.label}`))
  console.log()

  if (!item.currentValue) {
    console.log(`  ${c('red', 'MISSING')} - No documentation found`)
  } else {
    // Display the current value, indented
    const displayLines = item.currentValue.split('\n')
    for (const dl of displayLines) {
      console.log(`  ${c('dim', '│')} ${dl}`)
    }
  }
  console.log()
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function auditDocs(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const { container } = context as any

  const cache = container.feature('diskCache')
  const fm = container.feature('fileManager')
  await fm.start({ exclude: ['node_modules', 'dist', '.cache', '.git'] })

  // Reset if requested
  if (options.reset) {
    await cache.rm('audit-docs:progress')
    console.log(c('green', 'Audit progress has been reset.'))
  }

  // Load progress
  let progress: AuditProgress
  if (await cache.has('audit-docs:progress')) {
    progress = await cache.get('audit-docs:progress', true) as AuditProgress
  } else {
    progress = { modules: {} }
  }

  // Discover all modules
  const modules = discoverModules(container, fm)

  if (modules.length === 0) {
    console.log(c('red', 'No helper modules found.'))
    return
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const saveProgress = async () => {
    await cache.set('audit-docs:progress', JSON.stringify(progress))
  }

  try {
    // If --module flag given, jump straight to it
    if (options.module) {
      const mod = modules.find(m =>
        m.shortcut === options.module ||
        `${m.registryName}.${m.shortcut}` === options.module
      )
      if (!mod) {
        console.log(c('red', `Module "${options.module}" not found.`))
        console.log('Available:', modules.map(m => `${m.registryName}.${m.shortcut}`).join(', '))
        return
      }
      await auditModule(mod, progress, rl, saveProgress)
      return
    }

    // Main menu loop
    while (true) {
      clearScreen()
      printModuleList(modules, progress)

      const completedCount = Object.values(progress.modules).filter(m => m.status === 'completed').length
      console.log(c('dim', `  Progress: ${completedCount}/${modules.length} modules completed`))
      console.log()
      console.log(c('dim', '  Enter a number to audit, ') + c('cyan', 'r') + c('dim', ' to resume last, ') + c('cyan', 'q') + c('dim', ' to quit'))

      const answer = await ask(rl, '  > ')

      if (answer === 'q' || answer === 'quit') {
        break
      }

      if (answer === 'r' || answer === 'resume') {
        // Resume last in-progress module
        const lastKey = progress.lastModule
        if (lastKey) {
          const mod = modules.find(m => `${m.registryName}.${m.shortcut}` === lastKey)
          if (mod) {
            await auditModule(mod, progress, rl, saveProgress)
            continue
          }
        }
        console.log(c('yellow', '  No module to resume.'))
        await ask(rl, '  Press enter to continue...')
        continue
      }

      const num = parseInt(answer, 10)
      if (num >= 1 && num <= modules.length) {
        await auditModule(modules[num - 1]!, progress, rl, saveProgress)
        continue
      }

      console.log(c('red', '  Invalid input.'))
      await ask(rl, '  Press enter to continue...')
    }
  } finally {
    rl.close()
    await saveProgress()
    console.log(c('dim', '\nProgress saved.\n'))
  }
}

async function auditModule(
  mod: ModuleInfo,
  progress: AuditProgress,
  rl: readline.Interface,
  saveProgress: () => Promise<void>,
) {
  const key = `${mod.registryName}.${mod.shortcut}`
  progress.lastModule = key

  // Initialize module progress if needed
  if (!progress.modules[key]) {
    progress.modules[key] = { status: 'pending', items: {} }
  }
  const mp = progress.modules[key]!
  mp.status = 'in_progress'
  await saveProgress()

  // Extract audit items from source
  let items = extractAuditItems(mod.filePath, mod.shortcut, mod.registryName)

  if (items.length === 0) {
    console.log(c('yellow', `\n  No auditable items found in ${mod.filePath}`))
    mp.status = 'completed'
    await saveProgress()
    await ask(rl, '  Press enter to continue...')
    return
  }

  // Initialize item statuses
  for (const item of items) {
    if (!mp.items[item.id]) {
      mp.items[item.id] = 'pending'
    }
  }

  // Find where to resume (first non-good item, or where we left off)
  let startIdx = 0
  if (mp.lastItem) {
    const lastIdx = items.findIndex(it => it.id === mp.lastItem)
    if (lastIdx >= 0) startIdx = lastIdx
  }

  for (let i = startIdx; i < items.length; i++) {
    const item = items[i]!
    const status = mp.items[item.id] || 'pending'

    // Skip already-approved items
    if (status === 'good') continue

    clearScreen()
    printHeader(`${key}`)
    printAuditItem(item, status, i, items.length)

    // Show quick status bar
    const good = Object.values(mp.items).filter(s => s === 'good').length
    const total = Object.keys(mp.items).length
    console.log(c('dim', `  ${good}/${total} items approved`))
    console.log()
    console.log(`  ${c('green', 'y')}=good  ${c('yellow', 'e')}=edit in cursor  ${c('dim', 's')}=skip  ${c('cyan', 'n')}=next module  ${c('red', 'q')}=quit`)

    const answer = await ask(rl, '  > ')

    if (answer === 'q' || answer === 'quit') {
      mp.lastItem = item.id
      await saveProgress()
      return
    }

    if (answer === 'n' || answer === 'next') {
      mp.lastItem = item.id
      await saveProgress()
      return
    }

    if (answer === 'y' || answer === 'yes' || answer === 'g' || answer === 'good') {
      mp.items[item.id] = 'good'
      mp.lastItem = item.id
      await saveProgress()
      continue
    }

    if (answer === 's' || answer === 'skip') {
      mp.items[item.id] = 'skipped'
      mp.lastItem = item.id
      await saveProgress()
      continue
    }

    if (answer === 'e' || answer === 'edit' || answer === '') {
      mp.items[item.id] = 'needs_work'

      // Open Cursor editor at the exact line and wait for file close
      await new Promise<void>((resolve) => {
        const child = spawn('cursor', ['--wait', '--goto', `${item.filePath}:${item.line}`], {
          stdio: 'inherit',
        })
        child.on('close', () => resolve())
        child.on('error', (err) => {
          console.log(c('red', `  Failed to open cursor: ${err.message}`))
          console.log(c('dim', '  Make sure "cursor" is in your PATH (Shell Command: Install from Cursor)'))
          resolve()
        })
      })

      // After vim exits, re-extract this item to show updated value
      items = extractAuditItems(mod.filePath, mod.shortcut, mod.registryName)
      const refreshed = items.find(it => it.id === item.id)

      if (refreshed) {
        clearScreen()
        printHeader(`${key} (refreshed)`)
        printAuditItem(refreshed, 'needs_work', i, items.length)
        console.log(`  ${c('green', 'y')}=good now  ${c('yellow', 'e')}=edit again  ${c('dim', 's')}=skip`)

        const answer2 = await ask(rl, '  > ')
        if (answer2 === 'y' || answer2 === 'yes' || answer2 === 'good') {
          mp.items[item.id] = 'good'
        } else if (answer2 === 'e' || answer2 === 'edit') {
          // Re-edit: go back one step
          i--
        } else if (answer2 === 'q') {
          mp.lastItem = item.id
          await saveProgress()
          return
        }
      }

      mp.lastItem = item.id
      await saveProgress()
      continue
    }

    // Default: treat as skip
    mp.lastItem = item.id
    await saveProgress()
  }

  // Check if all items are handled
  const allDone = Object.values(mp.items).every(s => s === 'good' || s === 'skipped')
  if (allDone) {
    mp.status = 'completed'
    console.log(c('green', `\n  ✓ Module ${key} audit complete!`))
  }
  await saveProgress()
  await ask(rl, '  Press enter to continue...')
}

export default {
  description: 'Begin or resume an audit of the various helper documentation and descriptions.',
  argsSchema,
  handler: auditDocs,
}
