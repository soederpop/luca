import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const container = new NodeContainer()
const tsf = container.feature('typescript')

const toolsSource = `import { z } from 'zod'

export const schemas = {
  greet: z.object({ name: z.string().describe('Who to greet') }),
  add: z.object({ a: z.number(), b: z.number() }),
}

/**
 * Greets a person by name.
 *
 * @param params - the tool params
 */
export async function greet(params: { name: string }) {
  return \`hello \${params.name}\`
}

/** Adds two numbers. */
export const add = async (params: { a: number; b: number }) => {
  return params.a + params.b
}

const helper = () => 'internal'

export { helper as utility }

function localFn() { return 1 }
export default localFn
`

const classSource = `/**
 * A widget that renders things.
 * @example
 * new Widget().render()
 */
export default class Widget {
  static kind = 'widget'
  #secret = 42
  private counter = 0

  /** Renders the widget. */
  render() { return 'rendered' }

  /** The widget's display name. */
  get name() { return 'widget' }

  set name(v: string) {}

  constructor() {}
}

export class Other {}
`

describe('typescript feature', () => {
  it('exposes the full compiler via framework', () => {
    expect(tsf.framework.version).toMatch(/^5\./)
    expect(typeof tsf.framework.createSourceFile).toBe('function')
  })

  it('parses source into a SourceFile with parent pointers', () => {
    const sf = tsf.parse('export const x = 1')
    expect(sf.statements.length).toBe(1)
    expect(sf.statements[0]!.getText()).toBe('export const x = 1')
  })

  it('lists all exports with kinds', () => {
    const names = tsf.exports(toolsSource).map((e: any) => `${e.name}:${e.kind}`)
    expect(names).toEqual([
      'schemas:variable',
      'greet:function',
      'add:function',
      'utility:function',
      'default:function',
    ])
  })

  it('marks arrow-const exports as functions', () => {
    const fns = tsf.functionExports(toolsSource).map((e: any) => e.name)
    expect(fns).toEqual(['greet', 'add', 'utility', 'default'])
  })

  it('resolves aliased re-exports to the local declaration', () => {
    const utility = tsf.exports(toolsSource).find((e: any) => e.name === 'utility')
    expect(utility?.localName).toBe('helper')
    expect(utility?.code).toContain("const helper = () => 'internal'")
  })

  it('resolves export default <identifier> to its declaration', () => {
    const def = tsf.defaultExport(toolsSource)
    expect(def?.kind).toBe('function')
    expect(def?.localName).toBe('localFn')
    expect(def?.code).toBe('function localFn() { return 1 }')
  })

  it('returns the full code of one export without its jsdoc', () => {
    const code = tsf.exportCode(toolsSource, 'greet')
    expect(code).toStartWith('export async function greet')
    expect(code).not.toContain('/**')
  })

  it('parses the leading jsdoc of an export', () => {
    const block = tsf.jsdoc(toolsSource, 'greet')
    expect(block?.description).toBe('Greets a person by name.')
    expect(block?.tags).toEqual([{ tag: 'param', text: 'params - the tool params' }])

    expect(tsf.jsdoc(toolsSource, 'add')?.description).toBe('Adds two numbers.')
    expect(tsf.jsdoc(toolsSource, 'schemas')).toBeNull()
  })

  it('lists class exports and reads the class jsdoc', () => {
    const classes = tsf.classExports(classSource)
    expect(classes.map((c: any) => c.name)).toEqual(['default', 'Other'])
    const block = tsf.jsdoc(classSource, 'default')
    expect(block?.description).toBe('A widget that renders things.')
    expect(block?.tags[0]?.tag).toBe('example')
  })

  it('lists class members with kind, static, and private flags', () => {
    const members = tsf.classMembers(classSource, 'Widget')
    const byName = Object.fromEntries(members.map((m: any) => [`${m.kind}:${m.name}`, m]))

    expect(byName['property:kind'].isStatic).toBe(true)
    expect(byName['property:#secret'].isPrivate).toBe(true)
    expect(byName['property:counter'].isPrivate).toBe(true)
    expect(byName['method:render'].jsdoc.description).toBe('Renders the widget.')
    expect(byName['getter:name']).toBeDefined()
    expect(byName['setter:name']).toBeDefined()
    expect(byName['constructor:constructor']).toBeDefined()
  })

  it('finds the default-exported class when no name is given', () => {
    const members = tsf.classMembers(classSource)
    expect(members.some((m: any) => m.name === 'render')).toBe(true)
    expect(tsf.memberJsdoc(classSource, 'name')?.description).toBe("The widget's display name.")
  })

  it('extracts a function body with its exact span', () => {
    const body = tsf.functionBody(toolsSource, 'greet')
    expect(body?.text).toContain('return `hello ${params.name}`')
    expect(body?.isExpression).toBe(false)
    expect(toolsSource.slice(body!.span.start, body!.span.end)).toBe(body!.text)
  })

  it('handles braceless arrow bodies as expressions', () => {
    const body = tsf.functionBody('export const twice = (n: number) => n * 2', 'twice')
    expect(body?.text).toBe('n * 2')
    expect(body?.isExpression).toBe(true)
  })

  it('replaces one function body and leaves every other byte alone', () => {
    const edit = tsf.replaceFunctionBody(toolsSource, 'greet', '\n  return `goodbye ${params.name}`\n')
    expect(edit.diagnostics).toEqual([])
    expect(edit.source).toContain('return `goodbye ${params.name}`')
    // everything before and after the body is untouched
    const original = tsf.functionBody(toolsSource, 'greet')!
    expect(edit.source.slice(0, original.span.start)).toBe(toolsSource.slice(0, original.span.start))
    expect(edit.source.slice(edit.source.length - (toolsSource.length - original.span.end)))
      .toBe(toolsSource.slice(original.span.end))
    // the edited file still lists the same exports
    expect(tsf.exports(edit.source).map((e: any) => e.name)).toEqual(tsf.exports(toolsSource).map((e: any) => e.name))
  })

  it('reports syntax errors on a broken edit instead of writing garbage', () => {
    const edit = tsf.replaceFunctionBody(toolsSource, 'greet', '\n  return {unclosed\n')
    expect(edit.diagnostics.length).toBeGreaterThan(0)
    expect(edit.diagnostics[0]!.line).toBeGreaterThan(0)
  })

  it('throws for an unknown function name', () => {
    expect(() => tsf.replaceFunctionBody(toolsSource, 'nope', 'x')).toThrow("No exported function named 'nope'")
  })

  it('diagnostics is empty for valid source', () => {
    expect(tsf.diagnostics('const a = 1')).toEqual([])
    expect(tsf.diagnostics('const a = ')).not.toEqual([])
  })
})
