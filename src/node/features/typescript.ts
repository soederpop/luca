import * as ts from 'typescript'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/** A character range in the original source string. `code.slice(start, end)` reproduces the text. */
export interface TsSpan {
  start: number
  end: number
}

/** A parsed leading JSDoc block. `raw` is the full comment including delimiters. */
export interface TsJsdocBlock {
  raw: string
  /** The prose before the first @tag, with comment asterisks stripped. */
  description: string
  /** Every @tag line, e.g. { tag: 'param', text: '{string} name - the name' }. */
  tags: Array<{ tag: string; text: string }>
  span: TsSpan
}

/** One export of a module — a declaration or default-export expression. */
export interface TsExportInfo {
  /** The exported name; 'default' for anonymous default exports. */
  name: string
  /** The local declaration name when it differs (aliased or default-exported identifier). */
  localName: string | null
  kind: 'function' | 'class' | 'variable' | 'interface' | 'typeAlias' | 'enum' | 'expression'
  isDefault: boolean
  /** Full source text of the declaration, excluding the leading JSDoc block. */
  code: string
  span: TsSpan
  jsdoc: TsJsdocBlock | null
}

/** One member of a class declaration. */
export interface TsClassMemberInfo {
  name: string
  kind: 'method' | 'getter' | 'setter' | 'property' | 'constructor' | 'staticBlock'
  isStatic: boolean
  /** True for the `private` modifier or a #name. */
  isPrivate: boolean
  /** Full source text of the member, excluding the leading JSDoc block. */
  code: string
  span: TsSpan
  jsdoc: TsJsdocBlock | null
}

/** The body of a function. For block bodies the span covers the text between the braces. */
export interface TsFunctionBody {
  /** The statements between the braces (or the expression of a braceless arrow). */
  text: string
  span: TsSpan
  /** True when the function is a braceless arrow — `text` is an expression, not statements. */
  isExpression: boolean
}

/** A syntax error found while parsing. */
export interface TsSyntaxDiagnostic {
  message: string
  /** 1-based line number. */
  line: number
  /** 1-based column number. */
  column: number
}

/** Result of an AST-guided source edit. */
export interface TsEditResult {
  /** The full module source after the splice. */
  source: string
  /** Syntax errors in the edited source. Empty means the edit parses cleanly. */
  diagnostics: TsSyntaxDiagnostic[]
}

type SourceInput = string | ts.SourceFile

/**
 * The typescript feature exposes the bundled TypeScript compiler for parsing
 * source files and working with their ASTs — no install required, the compiler
 * ships inside the luca binary.
 *
 * It has two layers. The `framework` getter hands you the entire `typescript`
 * module (`ts.createSourceFile`, `ts.SyntaxKind`, the works) so anything the
 * compiler can do, you can build on. On top of that sit purpose-built helpers
 * for the common structural questions: list a module's exports, pull the full
 * code of one export, read the leading JSDoc block on an export or a class
 * member, enumerate class members, and surgically read or replace a single
 * function body without disturbing any other byte of the file.
 *
 * Everything is syntax-only — files parse in isolation with no type checker,
 * so it is fast and needs no tsconfig or lib files. Edits are text splices at
 * AST-derived spans: formatting, comments, and untouched code stay
 * byte-identical, and `replaceFunctionBody` re-parses the result so you can
 * reject a broken edit before writing it.
 *
 * @example
 * ```typescript
 * const tsf = container.feature('typescript')
 *
 * const source = `
 * /** Adds two numbers. *\/
 * export function add(a: number, b: number) { return a + b }
 * export const nums = [1, 2, 3]
 * export default class Calculator {
 *   /** Runs the calculation. *\/
 *   run() { return 42 }
 * }
 * `
 *
 * // List every export with kind, code, and jsdoc
 * tsf.exports(source).map(e => `${e.name}:${e.kind}`)
 * // ['add:function', 'nums:variable', 'default:class']
 *
 * // Full code of one export
 * tsf.exportCode(source, 'add')
 * // 'export function add(a: number, b: number) { return a + b }'
 *
 * // Leading JSDoc of an export, and of a class member
 * tsf.jsdoc(source, 'add')?.description          // 'Adds two numbers.'
 * tsf.classMembers(source)[0].jsdoc?.description // 'Runs the calculation.'
 *
 * // Surgical function-body edit — only the body changes
 * const edit = tsf.replaceFunctionBody(source, 'add', ' return a * b ')
 * edit.diagnostics // [] — the edit parses cleanly
 *
 * // Drop to the raw compiler API for anything else
 * const ts = tsf.framework
 * const sf = tsf.parse(source)
 * ts.forEachChild(sf, node => console.log(ts.SyntaxKind[node.kind]))
 * ```
 *
 * @extends Feature
 */
export class TypeScriptAst extends Feature {
  static override shortcut = 'features.typescript' as const
  static override stability = 'stable' as const
  static override category = 'dev-tools' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static { Feature.register(this, 'typescript') }

  /**
   * The entire bundled TypeScript compiler API — the `typescript` module itself.
   *
   * Use this to build anything the helpers below don't cover: create source
   * files, walk nodes with `ts.forEachChild`, inspect `ts.SyntaxKind`, print
   * nodes, transform, and so on.
   *
   * @returns {typeof ts} The TypeScript compiler namespace
   *
   * @example
   * ```typescript
   * const ts = container.feature('typescript').framework
   * console.log(ts.version) // e.g. '5.9.3'
   * ```
   */
  get framework(): typeof ts {
    return ts
  }

  /**
   * Parses TypeScript (or TSX/JS) source into a `ts.SourceFile` AST.
   *
   * Parsing is syntactic only — no type checking, no file system access —
   * so it works on any string and is fast enough to call per keystroke.
   * Parent pointers are set, so `node.getText()` and `node.getSourceFile()`
   * work on every node.
   *
   * @param {string} source - The module source text
   * @param {string} [fileName] - Virtual file name; the extension picks the dialect (.ts, .tsx, .js)
   * @returns {ts.SourceFile} The parsed source file
   *
   * @example
   * ```typescript
   * const sf = container.feature('typescript').parse('export const x = 1')
   * console.log(sf.statements.length) // 1
   * ```
   */
  parse(source: string, fileName: string = 'module.ts'): ts.SourceFile {
    return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, this.scriptKindFor(fileName))
  }

  /**
   * Returns the syntax errors in a source string (or already-parsed file).
   *
   * Only parse errors are reported — this is not a type check. An empty
   * array means the source is syntactically valid.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @returns {TsSyntaxDiagnostic[]} Syntax errors with 1-based line/column positions
   *
   * @example
   * ```typescript
   * container.feature('typescript').diagnostics('function broken( {')
   * // [{ message: "'}' expected.", line: 1, column: 19 }]
   * ```
   */
  diagnostics(source: SourceInput): TsSyntaxDiagnostic[] {
    const sf = this.toSourceFile(source)
    // parseDiagnostics is internal but stable across every TS 5.x release, and
    // the only way to get parse errors without building a full Program.
    const parseDiagnostics: ts.DiagnosticWithLocation[] = (sf as any).parseDiagnostics ?? []
    return parseDiagnostics.map((d) => {
      const { line, character } = ts.getLineAndCharacterOfPosition(sf, d.start)
      return {
        message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
        line: line + 1,
        column: character + 1,
      }
    })
  }

  /**
   * Lists every export of a module: declarations marked `export`, the default
   * export, and `export { a, b as c }` clauses (resolved to their local
   * declarations).
   *
   * Each entry carries the export's full source code (JSDoc excluded), its
   * span in the original text, and its parsed leading JSDoc block. Variable
   * exports whose initializer is a function or arrow expression report
   * `kind: 'function'`.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @returns {TsExportInfo[]} All exports in declaration order
   *
   * @example
   * ```typescript
   * const tsf = container.feature('typescript')
   * const found = tsf.exports('export const go = async () => 1')
   * console.log(found[0].kind) // 'function' — arrow initializers count
   * ```
   */
  exports(source: SourceInput): TsExportInfo[] {
    const sf = this.toSourceFile(source)
    const results: TsExportInfo[] = []

    for (const statement of sf.statements) {
      const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined
      const isExported = modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false
      const isDefault = modifiers?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false

      if (isExported && ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name)) continue
          const init = decl.initializer
          const isFn = init != null && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
          results.push(this.exportInfoFor(sf, statement, decl.name.text, isFn ? 'function' : 'variable', false, null))
        }
        continue
      }

      if (isExported && (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) ||
          ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement))) {
        const name = statement.name?.getText(sf) ?? 'default'
        results.push(this.exportInfoFor(sf, statement, isDefault ? 'default' : name, this.declarationKind(statement), isDefault, isDefault && statement.name ? name : null))
        continue
      }

      // export default <expression> — resolve identifiers to their local declaration
      if (ts.isExportAssignment(statement) && !statement.isExportEquals) {
        const expr = statement.expression
        if (ts.isIdentifier(expr)) {
          const local = this.findLocalDeclaration(sf, expr.text)
          if (local) {
            results.push(this.exportInfoFor(sf, local.node, 'default', local.kind, true, expr.text))
            continue
          }
        }
        results.push({
          name: 'default',
          localName: null,
          kind: 'expression',
          isDefault: true,
          code: expr.getText(sf),
          span: { start: expr.getStart(sf), end: expr.getEnd() },
          jsdoc: this.jsdocFor(sf, statement),
        })
        continue
      }

      // export { a, b as c } with no module specifier
      if (ts.isExportDeclaration(statement) && !statement.moduleSpecifier &&
          statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        for (const specifier of statement.exportClause.elements) {
          const localName = (specifier.propertyName ?? specifier.name).text
          const local = this.findLocalDeclaration(sf, localName)
          if (!local) continue
          const info = this.exportInfoFor(sf, local.node, specifier.name.text, local.kind, false, null)
          info.localName = localName === specifier.name.text ? null : localName
          results.push(info)
        }
      }
    }

    return results
  }

  /**
   * Returns the default export of a module, or null when there is none.
   *
   * `export default class Foo {}`, `export default function () {}`, and
   * `export default Foo` (resolved to the local declaration) are all handled.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @returns {TsExportInfo | null} The default export, or null
   *
   * @example
   * ```typescript
   * const info = container.feature('typescript').defaultExport('class A {}\nexport default A')
   * console.log(info?.kind, info?.localName) // 'class' 'A'
   * ```
   */
  defaultExport(source: SourceInput): TsExportInfo | null {
    return this.exports(source).find((e) => e.isDefault) ?? null
  }

  /**
   * Returns only the class exports of a module (default export included when
   * it is a class).
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @returns {TsExportInfo[]} Exported classes
   *
   * @example
   * ```typescript
   * container.feature('typescript').classExports('export class A {}\nexport class B {}').length // 2
   * ```
   */
  classExports(source: SourceInput): TsExportInfo[] {
    return this.exports(source).filter((e) => e.kind === 'class')
  }

  /**
   * Returns only the function exports of a module — `export function` and
   * `export async function` declarations plus exported consts whose
   * initializer is a function or arrow expression.
   *
   * This is the shape of an assistant's tools.ts: each entry here whose name
   * matches a key of the `schemas` export is a tool handler.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @returns {TsExportInfo[]} Exported functions
   *
   * @example
   * ```typescript
   * const fns = container.feature('typescript').functionExports(await fs.readFile('tools.ts'))
   * console.log(fns.map(f => f.name))
   * ```
   */
  functionExports(source: SourceInput): TsExportInfo[] {
    return this.exports(source).filter((e) => e.kind === 'function')
  }

  /**
   * Returns the full source code of one export by name, or null when the
   * module has no export by that name. The leading JSDoc block is excluded —
   * fetch it with `jsdoc()`.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @param {string} name - The exported name ('default' for the default export)
   * @returns {string | null} The declaration's source text
   *
   * @example
   * ```typescript
   * container.feature('typescript').exportCode('export const x = 1', 'x')
   * // 'export const x = 1'
   * ```
   */
  exportCode(source: SourceInput, name: string): string | null {
    return this.exports(source).find((e) => e.name === name)?.code ?? null
  }

  /**
   * Returns the parsed leading JSDoc block of one export, or null when the
   * export doesn't exist or has no JSDoc.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @param {string} name - The exported name ('default' for the default export)
   * @returns {TsJsdocBlock | null} The JSDoc block with description and tags split out
   *
   * @example
   * ```typescript
   * const block = container.feature('typescript').jsdoc(src, 'searchDocs')
   * console.log(block?.description)
   * console.log(block?.tags) // [{ tag: 'param', text: '...' }]
   * ```
   */
  jsdoc(source: SourceInput, name: string): TsJsdocBlock | null {
    return this.exports(source).find((e) => e.name === name)?.jsdoc ?? null
  }

  /**
   * Lists the members of a class: methods, getters, setters, properties, the
   * constructor, and static blocks — each with its code, span, JSDoc, and
   * static/private flags.
   *
   * With no `className` the target is the default-exported class, or the
   * module's only class when there is exactly one.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @param {string} [className] - Which class to inspect; optional when unambiguous
   * @returns {TsClassMemberInfo[]} The class members in declaration order
   *
   * @example
   * ```typescript
   * const members = container.feature('typescript').classMembers(src, 'Widget')
   * members.filter(m => m.kind === 'getter').map(m => m.name)
   * ```
   */
  classMembers(source: SourceInput, className?: string): TsClassMemberInfo[] {
    const sf = this.toSourceFile(source)
    const classNode = this.findClass(sf, className)
    if (!classNode) return []

    return classNode.members.map((member): TsClassMemberInfo | null => {
      let name: string
      let kind: TsClassMemberInfo['kind']

      if (ts.isConstructorDeclaration(member)) {
        name = 'constructor'
        kind = 'constructor'
      } else if (ts.isClassStaticBlockDeclaration(member)) {
        name = 'static'
        kind = 'staticBlock'
      } else if (ts.isMethodDeclaration(member)) {
        name = member.name.getText(sf)
        kind = 'method'
      } else if (ts.isGetAccessorDeclaration(member)) {
        name = member.name.getText(sf)
        kind = 'getter'
      } else if (ts.isSetAccessorDeclaration(member)) {
        name = member.name.getText(sf)
        kind = 'setter'
      } else if (ts.isPropertyDeclaration(member)) {
        name = member.name.getText(sf)
        kind = 'property'
      } else {
        return null
      }

      const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined
      return {
        name,
        kind,
        isStatic: kind === 'staticBlock' || (modifiers?.some((m) => m.kind === ts.SyntaxKind.StaticKeyword) ?? false),
        isPrivate: name.startsWith('#') || (modifiers?.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword) ?? false),
        code: member.getText(sf),
        span: { start: member.getStart(sf), end: member.getEnd() },
        jsdoc: this.jsdocFor(sf, member),
      }
    }).filter((m): m is TsClassMemberInfo => m !== null)
  }

  /**
   * Returns the parsed leading JSDoc block of one class member, or null.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @param {string} memberName - The member's name ('constructor' for the constructor)
   * @param {string} [className] - Which class; optional when unambiguous
   * @returns {TsJsdocBlock | null} The member's JSDoc block
   *
   * @example
   * ```typescript
   * container.feature('typescript').memberJsdoc(src, 'render', 'Widget')?.description
   * ```
   */
  memberJsdoc(source: SourceInput, memberName: string, className?: string): TsJsdocBlock | null {
    return this.classMembers(source, className).find((m) => m.name === memberName)?.jsdoc ?? null
  }

  /**
   * Returns the body of an exported function — the text between the braces,
   * plus its exact span in the source. Works on `export function` declarations
   * and exported consts holding a function or arrow expression. A braceless
   * arrow reports its expression with `isExpression: true`.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @param {string} name - The exported function's name
   * @returns {TsFunctionBody | null} The body, or null when no such function exists
   *
   * @example
   * ```typescript
   * const body = container.feature('typescript').functionBody(src, 'searchDocs')
   * console.log(body?.text) // the statements between the braces
   * ```
   */
  functionBody(source: SourceInput, name: string): TsFunctionBody | null {
    const sf = this.toSourceFile(source)
    const fn = this.findFunctionLike(sf, name)
    if (!fn?.body) return null

    if (ts.isBlock(fn.body)) {
      const start = fn.body.getStart(sf) + 1
      const end = fn.body.getEnd() - 1
      return { text: sf.text.slice(start, end), span: { start, end }, isExpression: false }
    }
    const start = fn.body.getStart(sf)
    const end = fn.body.getEnd()
    return { text: sf.text.slice(start, end), span: { start, end }, isExpression: true }
  }

  /**
   * Replaces the body of one exported function and leaves every other byte of
   * the module untouched — a text splice at the AST-derived span, never a
   * re-print, so formatting and comments survive.
   *
   * For a braced function, `newBody` is the statement text that goes between
   * the braces (the braces stay). For a braceless arrow it replaces the
   * expression. The result is re-parsed: check `diagnostics` is empty before
   * writing the file, and throw away the edit when it isn't.
   *
   * @param {string | ts.SourceFile} source - Source text or a parsed source file
   * @param {string} name - The exported function's name
   * @param {string} newBody - Replacement body text (without braces)
   * @returns {TsEditResult} The edited source plus its syntax diagnostics
   * @throws {Error} When the module has no exported function by that name
   *
   * @example
   * ```typescript
   * const tsf = container.feature('typescript')
   * const edit = tsf.replaceFunctionBody(src, 'greet', `\n  return 'hi ' + params.name\n`)
   * if (edit.diagnostics.length === 0) await fs.writeFile('tools.ts', edit.source)
   * ```
   */
  replaceFunctionBody(source: SourceInput, name: string, newBody: string): TsEditResult {
    const sf = this.toSourceFile(source)
    const body = this.functionBody(sf, name)
    if (!body) throw new Error(`No exported function named '${name}' with a body`)

    const edited = sf.text.slice(0, body.span.start) + newBody + sf.text.slice(body.span.end)
    return { source: edited, diagnostics: this.diagnostics(edited) }
  }

  private toSourceFile(source: SourceInput): ts.SourceFile {
    return typeof source === 'string' ? this.parse(source) : source
  }

  private scriptKindFor(fileName: string): ts.ScriptKind {
    if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX
    if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX
    if (fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs')) return ts.ScriptKind.JS
    return ts.ScriptKind.TS
  }

  private declarationKind(node: ts.Statement): TsExportInfo['kind'] {
    if (ts.isFunctionDeclaration(node)) return 'function'
    if (ts.isClassDeclaration(node)) return 'class'
    if (ts.isInterfaceDeclaration(node)) return 'interface'
    if (ts.isTypeAliasDeclaration(node)) return 'typeAlias'
    if (ts.isEnumDeclaration(node)) return 'enum'
    return 'variable'
  }

  private exportInfoFor(
    sf: ts.SourceFile,
    node: ts.Statement,
    name: string,
    kind: TsExportInfo['kind'],
    isDefault: boolean,
    localName: string | null,
  ): TsExportInfo {
    return {
      name,
      localName,
      kind,
      isDefault,
      code: node.getText(sf),
      span: { start: node.getStart(sf), end: node.getEnd() },
      jsdoc: this.jsdocFor(sf, node),
    }
  }

  private findLocalDeclaration(sf: ts.SourceFile, name: string): { node: ts.Statement; kind: TsExportInfo['kind'] } | null {
    for (const statement of sf.statements) {
      if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) ||
           ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) ||
           ts.isEnumDeclaration(statement)) && statement.name?.getText(sf) === name) {
        return { node: statement, kind: this.declarationKind(statement) }
      }
      if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === name) {
            const init = decl.initializer
            const isFn = init != null && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))
            return { node: statement, kind: isFn ? 'function' : 'variable' }
          }
        }
      }
    }
    return null
  }

  private findClass(sf: ts.SourceFile, className?: string): ts.ClassDeclaration | null {
    const classes: ts.ClassDeclaration[] = sf.statements.filter(ts.isClassDeclaration)
    if (className) return classes.find((c) => c.name?.getText(sf) === className) ?? null

    const isDefault = (c: ts.ClassDeclaration) =>
      ts.getModifiers(c)?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword) ?? false
    const defaulted = classes.find(isDefault)
    if (defaulted) return defaulted

    // export default Foo — resolve the assignment back to its class
    for (const statement of sf.statements) {
      if (ts.isExportAssignment(statement) && !statement.isExportEquals && ts.isIdentifier(statement.expression)) {
        const match = classes.find((c) => c.name?.getText(sf) === (statement.expression as ts.Identifier).text)
        if (match) return match
      }
    }

    return classes.length === 1 ? classes[0]! : null
  }

  private findFunctionLike(sf: ts.SourceFile, name: string): ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression | null {
    for (const statement of sf.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name?.getText(sf) === name) return statement
      if (ts.isVariableStatement(statement)) {
        for (const decl of statement.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.name.text === name && decl.initializer &&
              (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
            return decl.initializer
          }
        }
      }
    }
    return null
  }

  private jsdocFor(sf: ts.SourceFile, node: ts.Node): TsJsdocBlock | null {
    const fullText = sf.getFullText()
    const ranges = ts.getLeadingCommentRanges(fullText, node.getFullStart())
    if (!ranges?.length) return null

    // The block immediately before the node wins when several comments stack up
    for (let i = ranges.length - 1; i >= 0; i--) {
      const range = ranges[i]!
      const raw = fullText.slice(range.pos, range.end)
      if (!raw.startsWith('/**') || raw.startsWith('/***')) continue

      const inner = raw.slice(3, -2)
      const lines = inner.split('\n').map((line) => line.replace(/^\s*\*\s?/, ''))

      const descriptionLines: string[] = []
      const tags: Array<{ tag: string; text: string }> = []
      let current: { tag: string; text: string } | null = null

      for (const line of lines) {
        const tagMatch = line.match(/^@(\w+)\s*(.*)$/)
        if (tagMatch) {
          current = { tag: tagMatch[1]!, text: tagMatch[2] ?? '' }
          tags.push(current)
        } else if (current) {
          current.text = (current.text + '\n' + line).trim()
        } else {
          descriptionLines.push(line)
        }
      }

      return {
        raw,
        description: descriptionLines.join('\n').trim(),
        tags,
        span: { start: range.pos, end: range.end },
      }
    }
    return null
  }
}

export default TypeScriptAst
