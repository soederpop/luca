import { z } from 'zod'
import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import compromise from 'compromise'
import winkNLP from 'wink-nlp'
import model from 'wink-eng-lite-web-model'

export const NLPStateSchema = FeatureStateSchema.extend({
  parseCalls: z.number().default(0).describe('Total parse() invocations'),
  analyzeCalls: z.number().default(0).describe('Total analyze() invocations'),
})

export const NLPOptionsSchema = FeatureOptionsSchema.extend({})

export const ParsedCommandSchema = z.object({
  intent: z.string().nullable().describe('The normalized verb/action (infinitive form)'),
  target: z.string().nullable().describe('The primary noun/object'),
  subject: z.string().nullable().describe('Secondary noun from prepositional phrase'),
  modifiers: z.array(z.string()).describe('Adjectives and adverbs'),
  raw: z.string().describe('Original input text'),
})

export const AnalysisSchema = z.object({
  tokens: z.array(z.object({
    value: z.string(),
    pos: z.string(),
  })).describe('POS-tagged tokens (Universal POS tagset)'),
  entities: z.array(z.object({
    value: z.string(),
    type: z.string(),
  })).describe('Recognized named entities'),
  raw: z.string(),
})

export type ParsedCommand = z.infer<typeof ParsedCommandSchema>
export type Analysis = z.infer<typeof AnalysisSchema>

/**
 * The NLP feature provides natural language processing utilities for parsing
 * utterances into structured data. Combines two complementary libraries:
 *
 * - **compromise**: Verb normalization (toInfinitive), POS pattern matching
 * - **wink-nlp**: High-accuracy POS tagging (~95%), named entity recognition
 *
 * Three methods at increasing levels of detail:
 * - `parse()` — compromise-powered quick structure + verb normalization
 * - `analyze()` — wink-powered high-accuracy POS + entity extraction
 * - `understand()` — combined parse + analyze merged
 *
 * @example
 * ```typescript
 * const nlp = container.feature('nlp', { enable: true })
 *
 * nlp.parse("draw a diagram of the auth flow")
 * // { intent: "draw", target: "diagram", subject: "auth flow", modifiers: [], raw: "..." }
 *
 * nlp.analyze("meet john at 3pm about the deployment")
 * // { tokens: [{value:"meet",pos:"VERB"}, ...], entities: [{value:"john",type:"PERSON"}, ...] }
 *
 * nlp.understand("draw a diagram of the auth flow")
 * // { intent, target, subject, modifiers, tokens, entities, raw }
 * ```
 */
export class NLP extends Feature<z.infer<typeof NLPStateSchema>, z.infer<typeof NLPOptionsSchema>> {
  static override shortcut = 'features.nlp' as const
  static override stateSchema = NLPStateSchema
  static override optionsSchema = NLPOptionsSchema

  private _wink?: ReturnType<typeof winkNLP>

  /** Lazily initializes the wink-nlp instance on first use. */
  private get wink(): ReturnType<typeof winkNLP> {
    if (!this._wink) {
      this._wink = winkNLP(model)
    }
    return this._wink
  }

  /**
   * Parse an utterance into structured command data using compromise.
   * Extracts intent (normalized verb), target noun, prepositional subject, and modifiers.
   *
   * @param text - The raw utterance to parse
   * @returns Parsed command structure with intent, target, subject, modifiers
   *
   * @example
   * ```typescript
   * nlp.parse("open the terminal")
   * // { intent: "open", target: "terminal", subject: null, modifiers: [], raw: "open the terminal" }
   *
   * nlp.parse("draw a diagram of the auth flow")
   * // { intent: "draw", target: "diagram", subject: "auth flow", modifiers: [], raw: "..." }
   * ```
   */
  parse(text: string): ParsedCommand {
    // Use a separate doc for verb normalization (toInfinitive modifies terms in place)
    const verbDoc = compromise(text)
    const verbs = verbDoc.verbs().toInfinitive()
    const verbArray = (verbs as any).out('array') as string[]
    // First verb phrase — take just the root verb word
    const firstVerb = verbArray.length > 0 ? verbArray[0] : null
    const intent = firstVerb
      ? firstVerb.trim().split(/\s+/)[0]!.toLowerCase()
      : null

    // Fresh doc for structure extraction
    const doc = compromise(text)

    let target: string | null = null
    let subject: string | null = null

    // Try prepositional structure: verb [det] noun+ prep [det] noun+
    const prepMatch = doc.match('#Verb #Determiner? #Noun+ (of|about|for|with) #Determiner? #Noun+')
    if ((prepMatch as any).found) {
      // Nouns before the preposition
      const beforePrep = doc.match('#Verb #Determiner? #Noun+ (of|about|for|with)')
      const targetNouns = (beforePrep as any).match('#Noun+')
      target = targetNouns.text().trim() || null

      // Nouns after the preposition
      const afterPrep = doc.match('(of|about|for|with) #Determiner? #Noun+')
      const subjectNouns = (afterPrep as any).match('#Noun+')
      subject = subjectNouns.text().trim() || null
    } else {
      // Simple: verb [det] noun+
      const simpleMatch = doc.match('#Verb #Determiner? #Noun+')
      if ((simpleMatch as any).found) {
        const targetNouns = (simpleMatch as any).match('#Noun+')
        target = targetNouns.text().trim() || null
      }
    }

    // Modifiers: adjectives and adverbs
    const adjectives = (doc as any).adjectives().out('array') as string[]
    const adverbs = (doc as any).adverbs().out('array') as string[]
    const modifiers = [...new Set([...adjectives, ...adverbs])].filter(Boolean)

    this.state.set('parseCalls', (this.state.get('parseCalls') || 0) + 1)

    return { intent, target, subject, modifiers, raw: text }
  }

  /**
   * Analyze text with high-accuracy POS tagging and named entity recognition using wink-nlp.
   *
   * @param text - The text to analyze
   * @returns Token-level POS tags (Universal POS tagset) and named entities
   *
   * @example
   * ```typescript
   * nlp.analyze("meet john at 3pm about the deployment")
   * // { tokens: [{value:"meet",pos:"VERB"}, {value:"john",pos:"PROPN"}, ...],
   * //   entities: [{value:"john",type:"PERSON"}, {value:"3pm",type:"TIME"}],
   * //   raw: "meet john at 3pm about the deployment" }
   * ```
   */
  analyze(text: string): Analysis {
    const doc = this.wink.readDoc(text)
    const its = this.wink.its

    // Get tokens with POS tags
    const values = doc.tokens().out(its.value) as string[]
    const posTags = doc.tokens().out(its.pos) as string[]

    const tokens = values.map((value, i) => ({
      value,
      pos: posTags[i] || 'X',
    }))

    // Get entities with types
    const entities: Array<{ value: string; type: string }> = []
    doc.entities().each((entity: any) => {
      entities.push({
        value: entity.out(),
        type: entity.out((its as any).type) || 'UNKNOWN',
      })
    })

    this.state.set('analyzeCalls', (this.state.get('analyzeCalls') || 0) + 1)

    return { tokens, entities, raw: text }
  }

  /**
   * Full understanding: combines compromise parsing with wink-nlp analysis.
   * Returns intent, target, subject, modifiers (from parse) plus tokens and entities (from analyze).
   *
   * @param text - The text to understand
   * @returns Combined parse + analyze result
   *
   * @example
   * ```typescript
   * nlp.understand("draw a diagram of the auth flow")
   * // { intent: "draw", target: "diagram", subject: "auth flow", modifiers: [],
   * //   tokens: [{value:"draw",pos:"VERB"}, ...], entities: [...], raw: "..." }
   * ```
   */
  understand(text: string): ParsedCommand & Analysis {
    const parsed = this.parse(text)
    const analysis = this.analyze(text)

    // parse() and analyze() each increment their counters,
    // so we correct the double-count by decrementing once
    this.state.set('parseCalls', (this.state.get('parseCalls') || 1) - 1)
    this.state.set('analyzeCalls', (this.state.get('analyzeCalls') || 1) - 1)

    return { ...parsed, ...analysis }
  }
}

export default features.register('nlp', NLP)
