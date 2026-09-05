import { z } from 'zod'
import * as prettierStandalone from 'prettier/standalone'
import * as pluginEstree from 'prettier/plugins/estree'
import * as pluginTypescript from 'prettier/plugins/typescript'
import * as pluginMarkdown from 'prettier/plugins/markdown'
import * as pluginYaml from 'prettier/plugins/yaml'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

// prettier/standalone with only the plugins we ship: typescript (+ its estree
// printer), markdown, and yaml. The full `prettier` package would drag every
// parser (css, flow, ...) into the compiled binary for ~5.5MB; this set costs
// well under 2MB.
const PLUGINS = [pluginEstree, pluginTypescript, pluginMarkdown, pluginYaml]

export type PrettierParser = 'typescript' | 'markdown' | 'yaml'

export const PrettierFormatOptionsSchema = z.object({
  parser: z
    .enum(['typescript', 'markdown', 'yaml'])
    .optional()
    .describe('Which prettier parser to use. Inferred from filepath when omitted; defaults to typescript'),
  filepath: z
    .string()
    .optional()
    .describe('A file path whose extension selects the parser (.ts/.tsx/.js → typescript, .md → markdown, .yml/.yaml → yaml)'),
  printWidth: z.number().optional().describe('Preferred line length before prettier wraps (default 80)'),
  tabWidth: z.number().optional().describe('Spaces per indentation level (default 2)'),
  semi: z.boolean().optional().describe('End statements with semicolons (default true)'),
  singleQuote: z.boolean().optional().describe('Prefer single quotes over double quotes (default false)'),
  trailingComma: z
    .enum(['all', 'es5', 'none'])
    .optional()
    .describe('Trailing comma style for multiline constructs (default all)'),
})

export type PrettierFormatOptions = z.infer<typeof PrettierFormatOptionsSchema>

const EXTENSION_PARSERS: Record<string, PrettierParser> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'typescript',
  jsx: 'typescript',
  mjs: 'typescript',
  cjs: 'typescript',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
}

/**
 * The Prettier feature formats TypeScript, Markdown, and YAML source with
 * prettier's standalone engine.
 *
 * It wraps `prettier/standalone` with exactly three parsers — typescript,
 * markdown, and yaml — so it stays lightweight in the compiled binary
 * (the full prettier package would cost ~5.5MB; this set is well under 2MB).
 * Markdown documents with YAML frontmatter are handled in one pass: the
 * frontmatter is formatted by the yaml parser and the body by the markdown
 * parser. There is no CSS, HTML, or flow support by design.
 *
 * All formatting is async (prettier v3), and the parser is inferred from a
 * `filepath` extension when you have one, so callers usually just hand over
 * source text. Feature options set project-wide defaults (quote style,
 * semicolons, print width) that every call inherits and can override.
 *
 * @example
 * ```typescript
 * const prettier = container.feature('prettier')
 *
 * // TypeScript — the default parser
 * const code = await prettier.format(`const x={a:1,b:2};function f(  ){return x}`)
 * console.log(code)
 * // const x = { a: 1, b: 2 };
 * // function f() {
 * //   return x;
 * // }
 *
 * // Markdown with YAML frontmatter — both parts formatted in one pass
 * const doc = await prettier.format(
 *   '---\ntitle:    Hello\ntags:   [a,b]\n---\n# Heading\n\nSome    text',
 *   { parser: 'markdown' },
 * )
 *
 * // Infer the parser from a file path
 * const yml = await prettier.format('a:   1', { filepath: 'config.yml' })
 *
 * // Project-wide defaults via feature options
 * const p2 = container.feature('prettier', { singleQuote: true, semi: false })
 * console.log(await p2.format('const s = "hi"')) // const s = 'hi'
 * ```
 *
 * @extends Feature
 */
export class Prettier extends Feature {
  static override shortcut = 'features.prettier' as const
  static override stability = 'stable' as const
  static override category = 'dev-tools' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema.extend({
    printWidth: z.number().optional().describe('Default preferred line length for every format call'),
    tabWidth: z.number().optional().describe('Default spaces per indentation level'),
    semi: z.boolean().optional().describe('Default: end statements with semicolons'),
    singleQuote: z.boolean().optional().describe('Default: prefer single quotes'),
    trailingComma: z
      .enum(['all', 'es5', 'none'])
      .optional()
      .describe('Default trailing comma style'),
  })
  static { Feature.register(this, 'prettier') }

  /**
   * Formats source text with prettier.
   *
   * The parser is chosen in this order: an explicit `parser` option, the
   * extension of a `filepath` option, then `typescript` as the fallback.
   * Options given here override the feature's own option defaults for this
   * one call. Malformed source throws a SyntaxError from prettier with line
   * and column info.
   *
   * @param {string} source - The source text to format
   * @param {PrettierFormatOptions} [options] - Parser selection and prettier style options
   * @returns {Promise<string>} The formatted source
   * @throws {SyntaxError} When the source cannot be parsed
   *
   * @example
   * ```typescript
   * const prettier = container.feature('prettier')
   *
   * const out = await prettier.format('const   x=1', { semi: false })
   * console.log(out) // 'const x = 1\n'
   *
   * // Parser inferred from a path — no need to name it
   * const md = await prettier.format('#    Title', { filepath: 'README.md' })
   * console.log(md) // '# Title\n'
   * ```
   */
  async format(source: string, options: PrettierFormatOptions = {}): Promise<string> {
    const { parser, filepath, ...style } = options
    return prettierStandalone.format(source, {
      ...this.styleDefaults,
      ...style,
      parser: parser ?? this.inferParser(filepath),
      plugins: PLUGINS,
    })
  }

  /**
   * Checks whether source text is already prettier-formatted.
   *
   * Useful as a cheap lint gate: it returns a boolean instead of the
   * formatted text, so you can report unformatted files without rewriting
   * them. Uses the same parser inference and defaults as `format()`.
   *
   * @param {string} source - The source text to check
   * @param {PrettierFormatOptions} [options] - Parser selection and prettier style options
   * @returns {Promise<boolean>} True when the source is already formatted
   *
   * @example
   * ```typescript
   * const prettier = container.feature('prettier')
   * console.log(await prettier.check('const x = 1;\n')) // true
   * console.log(await prettier.check('const   x=1'))    // false
   * ```
   */
  async check(source: string, options: PrettierFormatOptions = {}): Promise<boolean> {
    const { parser, filepath, ...style } = options
    return prettierStandalone.check(source, {
      ...this.styleDefaults,
      ...style,
      parser: parser ?? this.inferParser(filepath),
      plugins: PLUGINS,
    })
  }

  /**
   * Formats TypeScript (or JavaScript) source.
   *
   * A convenience wrapper over `format()` with the typescript parser pinned.
   *
   * @param {string} source - The TypeScript source to format
   * @param {PrettierFormatOptions} [options] - Prettier style options
   * @returns {Promise<string>} The formatted source
   *
   * @example
   * ```typescript
   * const prettier = container.feature('prettier')
   * const out = await prettier.formatTypeScript('type A={x:number}')
   * console.log(out) // 'type A = { x: number };\n'
   * ```
   */
  async formatTypeScript(source: string, options: PrettierFormatOptions = {}): Promise<string> {
    return this.format(source, { ...options, parser: 'typescript' })
  }

  /**
   * Formats a Markdown document, including any YAML frontmatter.
   *
   * The markdown parser hands the frontmatter block to the yaml parser, so a
   * contentDb-style document (frontmatter + body) comes back fully formatted
   * in one call. Fenced code blocks are left as-is — prettier does not
   * reformat embedded code without the matching language plugin.
   *
   * @param {string} source - The Markdown source to format
   * @param {PrettierFormatOptions} [options] - Prettier style options
   * @returns {Promise<string>} The formatted document
   *
   * @example
   * ```typescript
   * const prettier = container.feature('prettier')
   * const doc = await prettier.formatMarkdown('---\ntitle:   Hi\n---\n#  Heading')
   * console.log(doc)
   * // ---
   * // title: Hi
   * // ---
   * //
   * // # Heading
   * ```
   */
  async formatMarkdown(source: string, options: PrettierFormatOptions = {}): Promise<string> {
    return this.format(source, { ...options, parser: 'markdown' })
  }

  /**
   * Formats a standalone YAML document.
   *
   * @param {string} source - The YAML source to format
   * @param {PrettierFormatOptions} [options] - Prettier style options
   * @returns {Promise<string>} The formatted YAML
   *
   * @example
   * ```typescript
   * const prettier = container.feature('prettier')
   * const out = await prettier.formatYaml('a:    1\nb:   [1,2]')
   * console.log(out) // 'a: 1\nb: [1, 2]\n'
   * ```
   */
  async formatYaml(source: string, options: PrettierFormatOptions = {}): Promise<string> {
    return this.format(source, { ...options, parser: 'yaml' })
  }

  private get styleDefaults(): Record<string, any> {
    const { printWidth, tabWidth, semi, singleQuote, trailingComma } = (this.options ?? {}) as any
    const defaults: Record<string, any> = {}
    if (printWidth !== undefined) defaults.printWidth = printWidth
    if (tabWidth !== undefined) defaults.tabWidth = tabWidth
    if (semi !== undefined) defaults.semi = semi
    if (singleQuote !== undefined) defaults.singleQuote = singleQuote
    if (trailingComma !== undefined) defaults.trailingComma = trailingComma
    return defaults
  }

  private inferParser(filepath?: string): PrettierParser {
    if (filepath) {
      const ext = filepath.split('.').pop()?.toLowerCase() ?? ''
      const parser = EXTENSION_PARSERS[ext]
      if (parser) return parser
    }
    return 'typescript'
  }
}

export default Prettier
