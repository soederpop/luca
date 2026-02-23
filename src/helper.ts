import { Bus, type EventMap } from "./bus.js";
import { type SetStateValue, State } from "./state.js";
import type { ContainerContext } from './container.js'
import uuid from 'node-uuid'
import { get } from 'lodash-es'
import { introspect, type HelperIntrospection, type IntrospectionSection, type ExampleIntrospection } from "./introspection/index.js";
import { z } from 'zod'
import { HelperStateSchema, HelperOptionsSchema, HelperEventsSchema } from './schemas/base.js'

export type HelperState = z.infer<typeof HelperStateSchema>
export type HelperOptions = z.infer<typeof HelperOptionsSchema>

/**
 * Helpers are used to represent types of modules.
 *
 * You don't create instances of helpers directly, the container creates instances through
 * factory functions that use the subclasses of Helper as a template.  The container
 * provides dependency injection and injects a context object into the Helper constructor.
 * 
 * A Helper is something that can be introspected at runtime to learn about the interface.
 * 
 * A helper has state.
 * 
 * A helper is an event bus.
 * 
 * A helper is connected to the container and can access the container's state, events, shared context, or 
 * other helpers and features in the container's registry.
 */
export abstract class Helper<T extends HelperState = HelperState, K extends HelperOptions = any, E extends EventMap = EventMap> {
  static shortcut: string = "unspecified"

  static description: string = "No description provided"
  static envVars: string[] = []

  static stateSchema: z.ZodType = HelperStateSchema
  static optionsSchema: z.ZodType = HelperOptionsSchema
  static eventsSchema: z.ZodType = HelperEventsSchema

  protected readonly _context: ContainerContext
  protected readonly _events = new Bus<E>()
  protected readonly _options: K

  readonly state: State<T>

  readonly uuid = uuid.v4()

  get initialState() : T {
    return {} as T
  }

  static introspect(section?: IntrospectionSection) : HelperIntrospection | undefined {
    const data = introspect((this as any).shortcut || '')
    if (!data || !section) return data
    return filterIntrospection(data, section)
  }

  static introspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) : string {
    const { section, depth } = resolveIntrospectAsTextArgs(sectionOrDepth, startHeadingDepth)
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionJSONAsMarkdown(introspection, depth, section)
  }


  /**
   * All Helpers can be introspect()ed and, assuming the introspection data has been loaded into the registry,
   * will report information about the Helper that can only get extracted by reading the code, e.g. the type interfaces
   * for the helper's options, state, and the events it emits, as well as the documentation from the helpers code for
   * each of the methods and properties.
   *
   * Pass a section name to get only that section: `'methods'`, `'getters'`, `'events'`, `'state'`, `'options'`, `'envVars'`
  */
  introspect(section?: IntrospectionSection) : HelperIntrospection | undefined {
    const base = (this.constructor as any).introspect()
    if (!base || !section) return base
    return filterIntrospection(base, section)
  }

  /**
   * Returns the introspection data formatted as a markdown string.
   *
   * The first argument can be a section name (`'methods'`, `'getters'`, etc.) to render only
   * that section, or a number for the starting heading depth (backward compatible).
   */
  introspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) : string {
    const { section, depth } = resolveIntrospectAsTextArgs(sectionOrDepth, startHeadingDepth)
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionJSONAsMarkdown(introspection, depth, section)
  }
  
  constructor(options: K, context: ContainerContext) {
    const optionSchema = (this.constructor as any).optionsSchema
    if (optionSchema && typeof optionSchema.safeParse === 'function') {
      const parsed = optionSchema.safeParse(options || {})
      if (parsed.success) {
        this._options = parsed.data as K
      } else {
        const details = parsed.error.issues.map((issue: any) => `${issue.path?.join('.') || 'options'}: ${issue.message}`).join('; ')
        throw new Error(`Invalid options for ${(this.constructor as any).shortcut || this.constructor.name}: ${details || parsed.error.message}`)
      }
    } else {
      this._options = options
    }
    this._context = context;
    this.state = new State<T>({ initialState: this.initialState });
    
    this.hide('_context', '_state', '_options', '_events', 'uuid')
    
    this.state.observe(() => {
      (this as any).emit('stateChange', this.state.current)
    })
    
    this.afterInitialize()

    this.container.emit('helperInitialized', this)
  }
  
  /** 
   * Every helper has a cache key which is computed at the time it is created through the container.
   * 
   * This ensures only a single instance of the helper exists for the requested options.
  */
  get cacheKey() {
    return this._options._cacheKey
  }

  /** 
   * This method will get called in the constructor and can be used instead of overriding the constructor
   * in your helper subclases.
  */
  afterInitialize() {
    // override this method to do something after the helper is initialized
  }
  
  setState(newState: SetStateValue<T>) {
    this.state.setState(newState)
    return this
  }

  /** 
   * Convenience method for putting properties on the helper that aren't enumerable,
   * which is a convenience for the REPL mainly.
  */
  hide(...propNames: string[]) {
    propNames.map((propName) => {
      Object.defineProperty(this, propName, { enumerable: false })
    })
    
    return this
  }
  
  /** 
   * python / lodash style get method, which will get a value from the container using dot notation
   * and will return a default value if the value is not found.
  */
  tryGet<K extends (string | string[]), T extends object = any>(key: K, defaultValue?: T) {
    return get(this, key, defaultValue)
  }

  /** 
   * The options passed to the helper when it was created.
  */
  get options() {
    return this._options;
  }

  /** 
   * The context object that was passed to the helper when it was created, this is decided by the container
   * and not something you would manipulate.
  */
  get context() {
    return this._context;
  }

  /** 
   * The container that the helper is connected to.
  */
  get container() {
    return this.context.container;
  }

  emit<Ev extends string & keyof E>(event: Ev, ...args: E[Ev]) {
    this._events.emit(event, ...args)
    return this
  }

  on<Ev extends string & keyof E>(event: Ev, listener: (...args: E[Ev]) => void) {
    this._events.on(event, listener)
    return this
  }

  off<Ev extends string & keyof E>(event: Ev, listener?: (...args: E[Ev]) => void) {
    this._events.off(event, listener)
    return this
  }

  once<Ev extends string & keyof E>(event: Ev, listener: (...args: E[Ev]) => void) {
      this._events.once(event, listener)
      return this
  }

  async waitFor<Ev extends string & keyof E>(event: Ev) {
    const resp = await this._events.waitFor(event)
    return resp
  }
}

const INTROSPECTION_SECTIONS: IntrospectionSection[] = ['methods', 'getters', 'events', 'state', 'options', 'envVars', 'examples', 'usage']

function filterIntrospection(data: HelperIntrospection, section: IntrospectionSection): HelperIntrospection {
  const filtered: HelperIntrospection = {
    id: data.id,
    description: data.description,
    shortcut: data.shortcut,
    methods: {},
    getters: {},
    events: {},
    state: {},
    options: {},
    envVars: [],
  }

  if (section === 'examples') {
    // For examples section, include class-level examples and full methods/getters (they carry inline examples)
    filtered.examples = data.examples
    filtered.methods = data.methods
    filtered.getters = data.getters
  } else if (section === 'usage') {
    // Usage is derived from options + shortcut, so pass those through
    filtered.options = data.options
  } else {
    filtered[section] = data[section] as any
  }

  return filtered
}

function resolveIntrospectAsTextArgs(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) {
  let section: IntrospectionSection | undefined
  let depth = 1

  if (typeof sectionOrDepth === 'string') {
    section = sectionOrDepth
    depth = startHeadingDepth ?? 1
  } else if (typeof sectionOrDepth === 'number') {
    depth = sectionOrDepth
  }

  return { section, depth }
}

function renderMethodsSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.methods || Object.keys(introspection.methods).length === 0) return sections

  sections.push(`${heading(2)} Methods`)

  for (const [methodName, methodInfo] of Object.entries(introspection.methods)) {
    sections.push(`${heading(3)} ${methodName}`)

    if (methodInfo.description) {
      sections.push(methodInfo.description)
    }

    if (methodInfo.parameters && Object.keys(methodInfo.parameters).length > 0) {
      sections.push(`**Parameters:**`)
      sections.push(`| Name | Type | Required | Description |`)
      sections.push(`|------|------|----------|-------------|`)

      for (const [paramName, paramInfo] of Object.entries(methodInfo.parameters)) {
        const isRequired = methodInfo.required?.includes(paramName) ? '✓' : ''
        const type = paramInfo.type || 'any'
        const description = paramInfo.description || ''
        sections.push(`| \`${paramName}\` | \`${type}\` | ${isRequired} | ${description} |`)

        // Render expanded type properties if available
        if (paramInfo.properties && Object.keys(paramInfo.properties).length > 0) {
          sections.push('')
          sections.push(`\`${type}\` properties:`)
          sections.push(`| Property | Type | Description |`)
          sections.push(`|----------|------|-------------|`)

          for (const [propName, propInfo] of Object.entries(paramInfo.properties)) {
            sections.push(`| \`${propName}\` | \`${propInfo.type || 'any'}\` | ${propInfo.description || ''} |`)
          }
        }
      }
    }

    if (methodInfo.returns) {
      sections.push(`**Returns:** \`${methodInfo.returns}\``)
    }

    if (methodInfo.examples && methodInfo.examples.length > 0) {
      for (const example of methodInfo.examples) {
        sections.push(`\`\`\`${normalizeLang(example.language)}\n${example.code}\n\`\`\``)
      }
    }

    sections.push('')
  }

  return sections
}

function renderGettersSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.getters || Object.keys(introspection.getters).length === 0) return sections

  sections.push(`${heading(2)} Getters`)
  sections.push(`| Property | Type | Description |`)
  sections.push(`|----------|------|-------------|`)

  for (const [getterName, getterInfo] of Object.entries(introspection.getters)) {
    const type = getterInfo.returns || 'any'
    const description = getterInfo.description || ''
    sections.push(`| \`${getterName}\` | \`${type}\` | ${description} |`)
  }

  return sections
}

function renderEventsSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.events || Object.keys(introspection.events).length === 0) return sections

  sections.push(`${heading(2)} Events`)

  for (const [eventName, eventInfo] of Object.entries(introspection.events)) {
    sections.push(`${heading(3)} ${eventName}`)

    if (eventInfo.description) {
      sections.push(eventInfo.description)
    }

    if (eventInfo.arguments && Object.keys(eventInfo.arguments).length > 0) {
      sections.push(`**Event Arguments:**`)
      sections.push(`| Name | Type | Description |`)
      sections.push(`|------|------|-------------|`)

      for (const [argName, argInfo] of Object.entries(eventInfo.arguments)) {
        sections.push(`| \`${argName}\` | \`${argInfo.type || 'any'}\` | ${argInfo.description || ''} |`)
      }
    }

    sections.push('')
  }

  return sections
}

function renderStateSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.state || Object.keys(introspection.state).length === 0) return sections

  sections.push(`${heading(2)} State`)
  sections.push(`| Property | Type | Description |`)
  sections.push(`|----------|------|-------------|`)

  for (const [stateName, stateInfo] of Object.entries(introspection.state)) {
    sections.push(`| \`${stateName}\` | \`${stateInfo.type || 'any'}\` | ${stateInfo.description || ''} |`)
  }

  return sections
}

function renderOptionsSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.options || Object.keys(introspection.options).length === 0) return sections

  sections.push(`${heading(2)} Options`)
  sections.push(`| Property | Type | Description |`)
  sections.push(`|----------|------|-------------|`)

  for (const [optName, optInfo] of Object.entries(introspection.options)) {
    sections.push(`| \`${optName}\` | \`${optInfo.type || 'any'}\` | ${optInfo.description || ''} |`)
  }

  return sections
}

function renderUsageSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []

  // Derive the factory method from the shortcut, e.g. "features.diskCache" -> container.feature('diskCache', { ... })
  const shortcut = introspection.shortcut || introspection.id || ''
  const parts = shortcut.split('.')
  if (parts.length < 2) return sections

  const scope = parts[0]! // e.g. "features"
  const name = parts.slice(1).join('.') // e.g. "diskCache"
  // Singular form: features -> feature, clients -> client, servers -> server, commands -> command, endpoints -> endpoint
  const factoryMethod = scope.endsWith('s') ? scope.slice(0, -1) : scope

  const options = introspection.options || {}
  const optionEntries = Object.entries(options)

  sections.push(`${heading(2)} Usage`)

  if (optionEntries.length === 0) {
    sections.push(`\`\`\`ts\ncontainer.${factoryMethod}('${name}')\n\`\`\``)
  } else {
    const optionLines = optionEntries.map(([optName, optInfo]) => {
      const desc = optInfo.description ? `// ${optInfo.description}` : ''
      return `  ${desc}\n  ${optName},`
    }).join('\n')

    sections.push(`\`\`\`ts\ncontainer.${factoryMethod}('${name}', {\n${optionLines}\n})\n\`\`\``)
  }

  return sections
}

function renderEnvVarsSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.envVars || introspection.envVars.length === 0) return sections

  sections.push(`${heading(2)} Environment Variables`)
  sections.push(introspection.envVars.map((envVar) => `- \`${envVar}\``).join('\n'))

  return sections
}

function renderExamplesSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []

  // Collect all examples: class-level, method-level, getter-level
  const allExamples: { source: string; examples: ExampleIntrospection[] }[] = []

  if (introspection.examples && introspection.examples.length > 0) {
    allExamples.push({ source: introspection.id, examples: introspection.examples })
  }

  for (const [name, method] of Object.entries(introspection.methods || {})) {
    if (method.examples && method.examples.length > 0) {
      allExamples.push({ source: name, examples: method.examples })
    }
  }

  for (const [name, getter] of Object.entries(introspection.getters || {})) {
    if (getter.examples && getter.examples.length > 0) {
      allExamples.push({ source: name, examples: getter.examples })
    }
  }

  if (allExamples.length === 0) return sections

  sections.push(`${heading(2)} Examples`)

  for (const { source, examples } of allExamples) {
    sections.push(`**${source}**`)
    for (const example of examples) {
      sections.push(`\`\`\`${normalizeLang(example.language)}\n${example.code}\n\`\`\``)
    }
    sections.push('')
  }

  return sections
}

/** Normalize verbose language names to short tags for code fences */
function normalizeLang(lang: string): string {
  if (lang === 'typescript') return 'ts'
  if (lang === 'javascript') return 'js'
  return lang
}

export { presentIntrospectionJSONAsMarkdown as presentIntrospectionAsMarkdown }

function presentIntrospectionJSONAsMarkdown(introspection: HelperIntrospection, startHeadingDepth: number = 1, section?: IntrospectionSection) {
  const sections: string[] = []
  const heading = (level: number) => '#'.repeat(Math.max(1, startHeadingDepth + level - 1))

  if (!section) {
    sections.push(`${heading(1)} ${introspection.id}\n\n${introspection.description}`)
  }

  const renderers: Record<IntrospectionSection, () => string[]> = {
    usage: () => renderUsageSection(introspection, heading),
    options: () => renderOptionsSection(introspection, heading),
    methods: () => renderMethodsSection(introspection, heading),
    getters: () => renderGettersSection(introspection, heading),
    events: () => renderEventsSection(introspection, heading),
    state: () => renderStateSection(introspection, heading),
    envVars: () => renderEnvVarsSection(introspection, heading),
    examples: () => renderExamplesSection(introspection, heading),
  }

  if (section) {
    sections.push(...renderers[section]())
  } else {
    for (const renderer of Object.values(renderers)) {
      sections.push(...renderer())
    }
  }

  return sections.join('\n\n')
}
