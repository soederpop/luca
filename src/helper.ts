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
  static tools: Record<string, { schema: z.ZodType, handler?: Function }> = {}

  protected readonly _context: ContainerContext
  protected readonly _events = new Bus<E>()
  protected readonly _options: K
  protected readonly _instanceTools: Record<string, { schema: z.ZodType, handler?: Function }> = {}

  readonly state: State<T>

  readonly uuid = uuid.v4()

  get initialState() : T {
    return {} as T
  }

  /** Alias for introspect */
  static inspect(section?: IntrospectionSection) : HelperIntrospection | undefined {
    return this.introspect(section)
  }

  static introspect(section?: IntrospectionSection) : HelperIntrospection | undefined {
    const data = introspect((this as any).shortcut || '')
    if (!data || !section) return data
    return filterIntrospection(data, section)
  }

  /** Alias for introspectAsText */
  static inspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) : string {
    return this.introspectAsText(sectionOrDepth, startHeadingDepth)
  }

  static introspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) : string {
    const { section, depth } = resolveIntrospectAsTextArgs(sectionOrDepth, startHeadingDepth)
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionJSONAsMarkdown(introspection, depth, section)
  }

  /**
   * Returns the introspection data formatted as a TypeScript interface declaration.
   * Useful for AI agents that reason better with structured type information,
   * or for generating `.d.ts` files that accurately describe a helper's public API.
   *
   * @example
   * ```ts
   * console.log(container.feature('fs').inspectAsType())
   * // interface FS {
   * //   readonly cwd: string;
   * //   readFile(path: string): Promise<string>;
   * //   ...
   * // }
   * ```
   */
  static inspectAsType(section?: IntrospectionSection) : string {
    return this.introspectAsType(section)
  }

  static introspectAsType(section?: IntrospectionSection) : string {
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionAsTypeScript(introspection, section)
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

  /** Alias for introspect */
  inspect(section?: IntrospectionSection) : HelperIntrospection | undefined {
    return this.introspect(section)
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

  /** Alias for introspectAsText */
  inspectAsText(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) : string {
    return this.introspectAsText(sectionOrDepth, startHeadingDepth)
  }

  /**
   * Returns the introspection data formatted as a TypeScript interface declaration.
   * Useful for AI agents that reason better with structured type information,
   * or for generating `.d.ts` files that accurately describe a helper's public API.
   */
  introspectAsType(section?: IntrospectionSection) : string {
    const introspection = this.introspect()
    if (!introspection) return ''
    return presentIntrospectionAsTypeScript(introspection, section)
  }

  /** Alias for introspectAsType */
  inspectAsType(section?: IntrospectionSection) : string {
    return this.introspectAsType(section)
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
    
    this.hide('_context', '_state', '_options', '_events', '_instanceTools', 'uuid')
    
    this.state.observe(() => {
      (this as any).emit('stateChange', this.state.current)
    })
    
    this.afterInitialize()

    this.container.emit('helperInitialized', this)
  }
  
  /**
   * The static shortcut identifier for this helper type, e.g. "features.assistant".
  */
  get shortcut(): string {
    return (this.constructor as any).shortcut || ''
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
   * Register a tool on this instance at runtime. Instance tools take precedence
   * over class-level static tools in toTools().
   */
  tool(name: string, options: { schema: z.ZodType, handler?: Function }): this {
    this._instanceTools[name] = options
    return this
  }

  /**
   * Called when another helper (e.g. an assistant) consumes this helper's
   * tools via `use()`. Override this to detect the consumer type and react —
   * for example, adding system prompt extensions to an assistant.
   *
   * Use `consumer.shortcut` to identify the consumer type:
   * ```typescript
   * override setupToolsConsumer(consumer: Helper) {
   *   if (consumer.shortcut === 'features.assistant') {
   *     (consumer as any).addSystemPromptExtension('myFeature', 'usage hints here')
   *   }
   * }
   * ```
   *
   * The default implementation is a no-op.
   *
   * @param consumer - The helper instance that is consuming this helper's tools
   */
  setupToolsConsumer(consumer: Helper): void {}

  /**
   * Collect all tools from the inheritance chain and instance, returning
   * { schemas, handlers } with matching keys. Walks the prototype chain
   * so subclass tools override parent tools. Instance tools win over all.
   *
   * If a tool has no explicit handler but this instance has a method with
   * the same name, a handler is auto-generated that delegates to that method.
   */
  toTools(options?: { only?: string[], except?: string[] }): { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> } {
    // Walk the prototype chain collecting static tools (parent-first, child overwrites)
    const merged: Record<string, { schema: z.ZodType, description?: string, handler?: Function }> = {}
    const chain: Function[] = []

    let current = this.constructor as any
    while (current && current !== Object) {
      if (Object.hasOwn(current, 'tools') && current.tools) {
        chain.unshift(current)
      }
      current = Object.getPrototypeOf(current)
    }

    for (const ctor of chain) {
      Object.assign(merged, (ctor as any).tools)
    }

    // Instance tools win over static
    Object.assign(merged, this._instanceTools)

    // Filter tools by only/except before building schemas and handlers
    let names = Object.keys(merged)
    if (options?.only) names = names.filter(n => options.only!.includes(n))
    if (options?.except) names = names.filter(n => !options.except!.includes(n))

    const schemas: Record<string, z.ZodType> = {}
    const handlers: Record<string, Function> = {}

    for (const name of names) {
      const entry = merged[name]!
      // If the tool entry has a description but the schema doesn't, attach it
      // so addTool() picks it up from jsonSchema.description.
      schemas[name] = entry.description && !entry.schema.description
        ? entry.schema.describe(entry.description)
        : entry.schema
      if (entry.handler) {
        handlers[name] = (args: any) => entry.handler!(args, this)
      } else if (typeof (this as any)[name] === 'function') {
        handlers[name] = (args: any) => (this as any)[name](args)
      }
    }

    return { schemas, handlers }
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
      const tableRows = [
        `**Parameters:**`,
        '',
        `| Name | Type | Required | Description |`,
        `|------|------|----------|-------------|`,
      ]

      for (const [paramName, paramInfo] of Object.entries(methodInfo.parameters)) {
        const isRequired = methodInfo.required?.includes(paramName) ? '✓' : ''
        const type = paramInfo.type || 'any'
        const description = paramInfo.description || ''
        tableRows.push(`| \`${paramName}\` | \`${type}\` | ${isRequired} | ${description} |`)

        // Render expanded type properties if available
        if (paramInfo.properties && Object.keys(paramInfo.properties).length > 0) {
          tableRows.push('')
          tableRows.push(`\`${type}\` properties:`)
          tableRows.push('')
          tableRows.push(`| Property | Type | Description |`)
          tableRows.push(`|----------|------|-------------|`)

          for (const [propName, propInfo] of Object.entries(paramInfo.properties)) {
            tableRows.push(`| \`${propName}\` | \`${propInfo.type || 'any'}\` | ${propInfo.description || ''} |`)
          }
        }
      }
      sections.push(tableRows.join('\n'))
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

  const tableRows = [
    `${heading(2)} Getters`,
    '',
    `| Property | Type | Description |`,
    `|----------|------|-------------|`,
  ]

  for (const [getterName, getterInfo] of Object.entries(introspection.getters)) {
    const type = getterInfo.returns || 'any'
    const description = getterInfo.description || ''
    tableRows.push(`| \`${getterName}\` | \`${type}\` | ${description} |`)
  }
  sections.push(tableRows.join('\n'))

  return sections
}

function renderEventsSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.events || Object.keys(introspection.events).length === 0) return sections

  sections.push(`${heading(2)} Events (Zod v4 schema)`)

  for (const [eventName, eventInfo] of Object.entries(introspection.events)) {
    sections.push(`${heading(3)} ${eventName}`)

    if (eventInfo.description) {
      sections.push(eventInfo.description)
    }

    if (eventInfo.arguments && Object.keys(eventInfo.arguments).length > 0) {
      const tableRows = [
        `**Event Arguments:**`,
        '',
        `| Name | Type | Description |`,
        `|------|------|-------------|`,
      ]

      for (const [argName, argInfo] of Object.entries(eventInfo.arguments)) {
        tableRows.push(`| \`${argName}\` | \`${argInfo.type || 'any'}\` | ${argInfo.description || ''} |`)
      }
      sections.push(tableRows.join('\n'))
    }

    sections.push('')
  }

  return sections
}

function renderStateSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.state || Object.keys(introspection.state).length === 0) return sections

  const tableRows = [
    `${heading(2)} State (Zod v4 schema)`,
    '',
    `| Property | Type | Description |`,
    `|----------|------|-------------|`,
  ]

  for (const [stateName, stateInfo] of Object.entries(introspection.state)) {
    tableRows.push(`| \`${stateName}\` | \`${stateInfo.type || 'any'}\` | ${stateInfo.description || ''} |`)
  }
  sections.push(tableRows.join('\n'))

  return sections
}

function renderOptionsSection(introspection: HelperIntrospection, heading: (level: number) => string): string[] {
  const sections: string[] = []
  if (!introspection.options || Object.keys(introspection.options).length === 0) return sections

  const tableRows = [
    `${heading(2)} Options (Zod v4 schema)`,
    '',
    `| Property | Type | Description |`,
    `|----------|------|-------------|`,
  ]

  for (const [optName, optInfo] of Object.entries(introspection.options)) {
    tableRows.push(`| \`${optName}\` | \`${optInfo.type || 'any'}\` | ${optInfo.description || ''} |`)
  }
  sections.push(tableRows.join('\n'))

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
export { presentIntrospectionAsTypeScript, renderTypeScriptParams, normalizeTypeString, isGenericObjectType }

function presentIntrospectionJSONAsMarkdown(introspection: HelperIntrospection, startHeadingDepth: number = 1, section?: IntrospectionSection) {
  const sections: string[] = []
  const heading = (level: number) => '#'.repeat(Math.max(1, startHeadingDepth + level - 1))

  if (!section) {
    const title = introspection.className
      ? `${heading(1)} ${introspection.className} (${introspection.id})`
      : `${heading(1)} ${introspection.id}`
    sections.push(`${title}\n\n${introspection.description}`)
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

/**
 * Renders introspection data as a TypeScript interface declaration.
 * Produces a valid interface string that describes the helper's public API —
 * getters, methods, state shape, options shape, and event listener signatures.
 */
function presentIntrospectionAsTypeScript(introspection: HelperIntrospection, section?: IntrospectionSection): string {
  const interfaceName = introspection.className || introspection.id.split('.').pop() || 'Unknown'
  const members: string[] = []

  const shouldRender = (s: IntrospectionSection) => !section || section === s

  // Getters
  if (shouldRender('getters') && introspection.getters && Object.keys(introspection.getters).length > 0) {
    for (const [name, info] of Object.entries(introspection.getters)) {
      const returnType = normalizeTypeString(info.returns || 'any')
      if (info.description) {
        members.push(`  /** ${info.description} */`)
      }
      members.push(`  readonly ${name}: ${returnType};`)
    }
  }

  // Methods
  if (shouldRender('methods') && introspection.methods && Object.keys(introspection.methods).length > 0) {
    if (members.length > 0) members.push('')
    for (const [name, info] of Object.entries(introspection.methods)) {
      if (info.description) {
        members.push(`  /** ${info.description} */`)
      }
      const params = renderTypeScriptParams(info)
      const returnType = normalizeTypeString(info.returns || 'void')
      members.push(`  ${name}(${params}): ${returnType};`)
    }
  }

  // State — render as the observable State<T> object, not just currentState
  if (shouldRender('state') && introspection.state && Object.keys(introspection.state).length > 0) {
    if (members.length > 0) members.push('')
    const stateMembers = Object.entries(introspection.state)
      .map(([name, info]) => {
        const comment = info.description ? `      /** ${info.description} */\n` : ''
        return `${comment}      ${name}: ${normalizeTypeString(info.type || 'any')};`
      })
      .join('\n')
    const stateShape = `{\n${stateMembers}\n    }`
    members.push(`  state: {`)
    members.push(`    /** The current version number, incremented on each change */`)
    members.push(`    readonly version: number;`)
    members.push(`    /** Get the value of a state key */`)
    members.push(`    get<K extends keyof T>(key: K): T[K] | undefined;`)
    members.push(`    /** Set a state key to a new value, notifying observers */`)
    members.push(`    set<K extends keyof T>(key: K, value: T[K]): this;`)
    members.push(`    /** Delete a state key, notifying observers */`)
    members.push(`    delete<K extends keyof T>(key: K): this;`)
    members.push(`    /** Check if a state key exists */`)
    members.push(`    has<K extends keyof T>(key: K): boolean;`)
    members.push(`    /** Get all state keys */`)
    members.push(`    keys(): string[];`)
    members.push(`    /** Get the current state snapshot */`)
    members.push(`    readonly current: ${stateShape};`)
    members.push(`    /** Get all entries as [key, value] pairs */`)
    members.push(`    entries(): [string, any][];`)
    members.push(`    /** Get all state values */`)
    members.push(`    values(): any[];`)
    members.push(`    /** Register an observer callback for state changes. Returns an unsubscribe function. */`)
    members.push(`    observe(callback: (changeType: 'add' | 'update' | 'delete', key: string, value?: any) => void): () => void;`)
    members.push(`    /** Merge partial state, notifying observers for each changed key */`)
    members.push(`    setState(value: Partial<${stateShape}> | ((current: ${stateShape}, state: this) => Partial<${stateShape}>)): void;`)
    members.push(`    /** Clear all state, notifying observers */`)
    members.push(`    clear(): void;`)
    members.push(`  };`)
  }

  // Options
  if (shouldRender('options') && introspection.options && Object.keys(introspection.options).length > 0) {
    if (members.length > 0) members.push('')
    const optionMembers = Object.entries(introspection.options)
      .map(([name, info]) => {
        const comment = info.description ? `    /** ${info.description} */\n` : ''
        return `${comment}    ${name}?: ${normalizeTypeString(info.type || 'any')};`
      })
      .join('\n')
    members.push(`  options: {\n${optionMembers}\n  };`)
  }

  // Events — rendered as on() overloads
  if (shouldRender('events') && introspection.events && Object.keys(introspection.events).length > 0) {
    if (members.length > 0) members.push('')
    for (const [eventName, eventInfo] of Object.entries(introspection.events)) {
      const args = Object.entries(eventInfo.arguments || {})
      const listenerParams = args.length > 0
        ? args.map(([argName, argInfo]) => `${argName}: ${normalizeTypeString(argInfo.type || 'any')}`).join(', ')
        : ''
      if (eventInfo.description) {
        members.push(`  /** ${eventInfo.description} */`)
      }
      members.push(`  on(event: '${eventName}', listener: (${listenerParams}) => void): this;`)
    }
  }

  const description = introspection.description
    ? `/**\n * ${introspection.description.split('\n').join('\n * ')}\n */\n`
    : ''

  const mainInterface = `${description}interface ${interfaceName} {\n${members.join('\n')}\n}`

  // Emit referenced type declarations above the main interface
  const types = introspection.types
  if (types && Object.keys(types).length > 0) {
    const typeDeclarations = Object.entries(types).map(([typeName, typeInfo]) => {
      const typeDesc = typeInfo.description
        ? `/**\n * ${typeInfo.description.split('\n').join('\n * ')}\n */\n`
        : ''
      const props = Object.entries(typeInfo.properties)
        .map(([propName, propInfo]) => {
          const comment = propInfo.description ? `  /** ${propInfo.description} */\n` : ''
          const opt = propInfo.optional ? '?' : ''
          return `${comment}  ${propName}${opt}: ${normalizeTypeString(propInfo.type || 'any')};`
        })
        .join('\n')
      return `${typeDesc}interface ${typeName} {\n${props}\n}`
    })

    return typeDeclarations.join('\n\n') + '\n\n' + mainInterface
  }

  return mainInterface
}

/** Build a TypeScript parameter list string from method introspection */
function renderTypeScriptParams(method: { parameters: Record<string, { type: string, description?: string, properties?: Record<string, { type: string, description?: string }> }>, required: string[] }): string {
  const entries = Object.entries(method.parameters || {})
  if (entries.length === 0) return ''

  return entries.map(([name, info]) => {
    const isRequired = (method.required || []).includes(name)
    let type = normalizeTypeString(info.type || 'any')

    // If the parameter has expanded sub-properties but a generic type string,
    // render an inline object type from those properties instead
    if (info.properties && Object.keys(info.properties).length > 0 && isGenericObjectType(type)) {
      const props = Object.entries(info.properties)
        .map(([propName, propInfo]) => `${propName}?: ${normalizeTypeString(propInfo.type || 'any')}`)
        .join('; ')
      type = `{ ${props} }`
    }

    return `${name}${isRequired ? '' : '?'}: ${type}`
  }).join(', ')
}

/** Returns true if the type string looks like a generic object type that sub-properties would refine */
function isGenericObjectType(type: string): boolean {
  const lower = type.toLowerCase()
  return lower === 'object' || lower === 'any' || lower === 'record<string, any>' || lower === '{}'
}

/** Clean up type strings from introspection data for use in interface declarations */
function normalizeTypeString(type: string): string {
  if (!type) return 'any'
  // The AST scanner sometimes wraps types in quotes
  type = type.replace(/^["']|["']$/g, '')
  // Convert internal ReturnType<typeof this.container.feature<'name'>> to a clean import reference
  // e.g. ReturnType<typeof this.container.feature<'proc'>> → import('luca').Proc
  type = type.replace(
    /ReturnType<typeof this\.container\.(feature|client|server)<'([^']+)'>>/g,
    (_match, _kind, name) => {
      // Convert shortcut name to PascalCase class name
      const className = name.replace(/(^|[-_])(\w)/g, (_: string, _sep: string, ch: string) => ch.toUpperCase())
      return `import('@soederpop/luca').${className}`
    }
  )
  return type
}
