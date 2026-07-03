import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import '../src/introspection/scan'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeFileSync, mkdirSync, rmSync } from 'fs'

/**
 * Regression tests for introspection of function-valued properties.
 *
 * `ui.print` is a class property holding a function (with color methods
 * attached via Object.assign) rather than a prototype method. The scanner
 * only looked at MethodDeclarations and GetAccessorDeclarations, so `print`
 * never appeared in `luca describe ui` and `luca describe ui.print` threw
 * claiming the member did not exist.
 */
describe('introspection scanner: function-valued properties', () => {
  const container = new NodeContainer()

  it('surfaces ui.print as a method in the ui feature introspection output', async () => {
    const scanner = container.feature('introspectionScanner', {
      src: ['src/node/features/ui.ts'],
    })

    const results = await scanner.scan()
    const ui = results.find((r: any) => r.id === 'features.ui')

    expect(ui).toBeDefined()
    expect(ui!.methods).toHaveProperty('print')
    expect(ui!.methods.print.description).toContain('print function')
    // ...while regular methods are still extracted alongside it
    expect(ui!.methods).toHaveProperty('markdown')
  })

  it('extracts arrow-function and Object.assign properties, skipping private/internal ones', async () => {
    const dir = join(tmpdir(), `luca-scan-fnprops-${process.pid}-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    const file = join(dir, 'fn-props.ts')

    writeFileSync(file, `
      import { Feature } from '../feature.js'

      /** A fixture feature with function-valued properties */
      export class FnProps extends Feature {
        static override shortcut = "features.fnProps" as const

        /** A plain arrow-function property */
        greet = (name: string, excited?: boolean): string => 'hi ' + name

        /** A function with members attached via Object.assign */
        log = Object.assign((msg: string) => console.log(msg), {
          loud: (msg: string) => console.log(msg.toUpperCase()),
        }) as unknown as ((msg: string) => void) & { loud: (msg: string) => void }

        /** @internal not for public docs */
        hidden = () => 'secret'

        _alsoHidden = () => 'underscore-prefixed'

        /** A non-function property should not become a method */
        label: string = 'just data'
      }
    `)

    try {
      const scanner = container.feature('introspectionScanner', { src: [file] })
      const results = await scanner.scan()
      const fixture = results.find((r: any) => r.id === 'features.fnProps')

      expect(fixture).toBeDefined()
      expect(fixture!.methods).toHaveProperty('greet')
      expect(fixture!.methods.greet.description).toContain('arrow-function property')
      expect(fixture!.methods.greet.parameters).toHaveProperty('name')
      expect(fixture!.methods.greet.required).toEqual(['name'])
      expect(fixture!.methods.greet.returns).toBe('string')

      expect(fixture!.methods).toHaveProperty('log')
      expect(fixture!.methods.log.parameters).toHaveProperty('msg')

      expect(fixture!.methods).not.toHaveProperty('hidden')
      expect(fixture!.methods).not.toHaveProperty('_alsoHidden')
      expect(fixture!.methods).not.toHaveProperty('label')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
