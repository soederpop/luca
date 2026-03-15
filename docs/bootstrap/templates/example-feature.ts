import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    example: typeof Example
  }
}

const ExampleStateSchema = FeatureStateSchema.extend({
  greetCount: z.number().default(0).describe('Number of times greet() has been called'),
})
type ExampleState = z.infer<typeof ExampleStateSchema>

const ExampleOptionsSchema = FeatureOptionsSchema.extend({})
type ExampleOptions = z.infer<typeof ExampleOptionsSchema>

/**
 * An example feature demonstrating the luca feature pattern.
 *
 * Discovered automatically by `container.helpers.discoverAll()`
 * and available as `container.feature('example')`.
 *
 * To learn more: `luca scaffold feature --tutorial`
 *
 * @example
 * ```typescript
 * const example = container.feature('example')
 * example.greet('Luca') // => "Hello, Luca! (greeting #1)"
 * ```
 */
export class Example extends Feature<ExampleState, ExampleOptions> {
  static override shortcut = 'features.example' as const
  static override stateSchema = ExampleStateSchema
  static override optionsSchema = ExampleOptionsSchema
  static override description = 'An example feature demonstrating the luca feature pattern'
  static { Feature.register(this, 'example') }

  /**
   * A simple method to show the feature works.
   * @param name - Name to greet
   * @returns Greeting string
   */
  greet(name = 'World') {
    const count = (this.state.get('greetCount') || 0) + 1
    this.state.set('greetCount', count)
    return `Hello, ${name}! (greeting #${count})`
  }
}

export default Example
