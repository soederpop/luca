import { describe, it, expect } from 'bun:test'
import { generateScaffold, applyTemplate, escapeForStringLiteral } from '../src/scaffolds/template'
import { scaffolds } from '../src/scaffolds/generated'

/**
 * Regression tests for scaffold description escaping.
 *
 * Previously `luca scaffold <type> <name> --description "text with an apostrophe's"`
 * interpolated the description into single-quoted string literals without any
 * escaping, generating syntactically invalid TypeScript that then poisoned every
 * later `luca describe` run in the consumer project with a parse-error banner.
 */

const transpiler = new Bun.Transpiler({ loader: 'ts' })

const NASTY_DESCRIPTION = `It's a "tricky" description with a backslash \\ and \`backticks\` and \${interpolation}
spread across two lines`

describe('scaffold description escaping', () => {
  it('every scaffold type produces parseable TypeScript with a hostile description', () => {
    for (const type of Object.keys(scaffolds)) {
      const code = generateScaffold(type, 'trickyHelper', NASTY_DESCRIPTION)
      expect(code, `scaffold type "${type}" returned no code`).toBeTruthy()
      expect(
        () => transpiler.transformSync(code!),
        `scaffold type "${type}" generated invalid TypeScript`
      ).not.toThrow()
    }
  })

  it('an apostrophe in the description does not break the single-quoted description export', () => {
    const code = generateScaffold('command', 'myTask', "automate something that's useful")!
    expect(() => transpiler.transformSync(code)).not.toThrow()
    expect(code).toContain("automate something that\\'s useful")
  })

  it('the escaped description round-trips to the original string when evaluated', () => {
    const escaped = escapeForStringLiteral(NASTY_DESCRIPTION)
    // Evaluate the escaped text inside each literal style — all must reproduce the original
    expect(eval(`'${escaped}'`)).toBe(NASTY_DESCRIPTION)
    expect(eval(`"${escaped}"`)).toBe(NASTY_DESCRIPTION)
    expect(eval(`\`${escaped}\``)).toBe(NASTY_DESCRIPTION)
  })

  it('applyTemplate inserts $-sequences literally instead of as replacement patterns', () => {
    const result = applyTemplate(`before {{description}} after`, { description: 'costs $100 and $& more' })
    expect(result).toBe('before costs $100 and $& more after')
  })
})
