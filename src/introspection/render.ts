import type { HelperIntrospection, IntrospectionSection, ExampleIntrospection, ContainerIntrospection } from "./index.js";

export const INTROSPECTION_SECTIONS: IntrospectionSection[] = ['methods', 'getters', 'events', 'state', 'options', 'envVars', 'examples', 'usage']

export function filterIntrospection(data: HelperIntrospection, section: IntrospectionSection): HelperIntrospection {
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

export function resolveIntrospectAsTextArgs(sectionOrDepth?: IntrospectionSection | number, startHeadingDepth?: number) {
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

export function presentIntrospectionAsMarkdown(introspection: HelperIntrospection, startHeadingDepth: number = 1, section?: IntrospectionSection) {
  const sections: string[] = []
  const heading = (level: number) => '#'.repeat(Math.max(1, startHeadingDepth + level - 1))

  if (!section) {
    const title = introspection.className
      ? `${heading(1)} ${introspection.className} (${introspection.id})`
      : `${heading(1)} ${introspection.id}`
    const stability = introspection.stability ? `\n\n> Stability: \`${introspection.stability}\`` : ''
    sections.push(`${title}${stability}\n\n${introspection.description}`)
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
export function presentIntrospectionAsTypeScript(introspection: HelperIntrospection, section?: IntrospectionSection): string {
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
export function renderTypeScriptParams(method: { parameters: Record<string, { type: string, description?: string, properties?: Record<string, { type: string, description?: string }> }>, required: string[] }): string {
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
export function isGenericObjectType(type: string): boolean {
  const lower = type.toLowerCase()
  return lower === 'object' || lower === 'any' || lower === 'record<string, any>' || lower === '{}'
}

/** Clean up type strings from introspection data for use in interface declarations */
export function normalizeTypeString(type: string): string {
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
      return `import('luca').${className}`
    }
  )
  return type
}

export function presentContainerIntrospectionAsMarkdown(data: ContainerIntrospection, startHeadingDepth: number = 1, section?: IntrospectionSection): string {
  const sections: string[] = []
  const heading = (level: number) => '#'.repeat(Math.max(1, startHeadingDepth + level - 1))

  const shouldRender = (name: IntrospectionSection | string) => !section || section === name

  if (!section) {
    // Header
    sections.push(`${heading(1)} ${data.className}\n\n${data.description || ''}`)

    // Container Properties section — dynamic from getters data, not hardcoded
    // (cwd, paths, manifest, argv, utils etc. come through as getters from the introspection scanner)

    // Registries section
    if (data.registries && data.registries.length > 0) {
      sections.push(`${heading(2)} Registries`)

      for (const reg of data.registries) {
        sections.push(`${heading(3)} ${reg.name} (${reg.baseClass})`)
        if (reg.available.length > 0) {
          sections.push(reg.available.map(a => `- \`${a}\``).join('\n'))
        } else {
          sections.push('_No members registered_')
        }
      }
    }

    // Factories section
    if (data.factories && data.factories.length > 0) {
      sections.push(`${heading(2)} Factory Methods`)
      sections.push(data.factories.map(f => `- \`${f}()\``).join('\n'))
    }
  }

  // Methods section
  if (shouldRender('methods') && data.methods && Object.keys(data.methods).length > 0) {
    sections.push(`${heading(2)} Methods`)

    for (const [methodName, methodInfo] of Object.entries(data.methods)) {
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
          tableRows.push(`| \`${paramName}\` | \`${paramInfo.type || 'any'}\` | ${isRequired} | ${paramInfo.description || ''} |`)

          if (paramInfo.properties && Object.keys(paramInfo.properties).length > 0) {
            tableRows.push('')
            tableRows.push(`\`${paramInfo.type}\` properties:`)
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

      if ((methodInfo as any).examples && (methodInfo as any).examples.length > 0) {
        for (const example of (methodInfo as any).examples) {
          if (example.title) {
            sections.push(`**Example: ${example.title}**`)
          }
          sections.push(`\`\`\`${example.language || 'ts'}\n${example.code}\n\`\`\``)
        }
      }

      sections.push('')
    }
  }

  // Getters section
  if (shouldRender('getters') && data.getters && Object.keys(data.getters).length > 0) {
    const getterTableRows = [
      `${heading(2)} Getters`,
      '',
      `| Property | Type | Description |`,
      `|----------|------|-------------|`,
    ]

    const gettersWithExamples: [string, any][] = []

    for (const [getterName, getterInfo] of Object.entries(data.getters)) {
      // Truncate long descriptions in the table
      const desc = getterInfo.description || ''
      const shortDesc = desc.length > 120 ? desc.slice(0, 117) + '...' : desc
      getterTableRows.push(`| \`${getterName}\` | \`${getterInfo.returns || 'any'}\` | ${shortDesc} |`)
      if ((getterInfo as any).examples && (getterInfo as any).examples.length > 0) {
        gettersWithExamples.push([getterName, getterInfo])
      }
    }
    sections.push(getterTableRows.join('\n'))

    // Render examples for getters that have them
    if (gettersWithExamples.length > 0) {
      for (const [getterName, getterInfo] of gettersWithExamples) {
        for (const example of (getterInfo as any).examples) {
          sections.push(`\`\`\`${example.language || 'ts'}\n${example.code}\n\`\`\``)
        }
      }
    }
  }

  // Events section
  if (shouldRender('events') && data.events && Object.keys(data.events).length > 0) {
    sections.push(`${heading(2)} Events`)

    for (const [eventName, eventInfo] of Object.entries(data.events)) {
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
  }

  // State section
  if (shouldRender('state') && data.state && Object.keys(data.state).length > 0) {
    const stateTableRows = [
      `${heading(2)} State`,
      '',
      `| Property | Type | Description |`,
      `|----------|------|-------------|`,
    ]

    for (const [stateName, stateInfo] of Object.entries(data.state)) {
      stateTableRows.push(`| \`${stateName}\` | \`${stateInfo.type || 'any'}\` | ${stateInfo.description || ''} |`)
    }
    sections.push(stateTableRows.join('\n'))
  }

  if (!section) {
    // Enabled features section
    if (data.enabledFeatures && data.enabledFeatures.length > 0) {
      sections.push(`${heading(2)} Enabled Features`)
      sections.push(data.enabledFeatures.map(f => `- \`${f}\``).join('\n'))
    }

    // Environment section
    if (data.environment) {
      const envTableRows = [
        `${heading(2)} Environment`,
        '',
        `| Flag | Value |`,
        `|------|-------|`,
      ]
      for (const [key, value] of Object.entries(data.environment)) {
        envTableRows.push(`| \`${key}\` | ${value} |`)
      }
      sections.push(envTableRows.join('\n'))
    }
  }

  return sections.join('\n\n')
}

export function presentContainerIntrospectionAsTypeScript(data: ContainerIntrospection): string {
  const members: string[] = []

  // Getters
  if (data.getters && Object.keys(data.getters).length > 0) {
    for (const [name, info] of Object.entries(data.getters)) {
      if (info.description) {
        members.push(`  /** ${info.description} */`)
      }
      members.push(`  readonly ${name}: ${normalizeTypeString(info.returns || 'any')};`)
    }
  }

  // Methods
  if (data.methods && Object.keys(data.methods).length > 0) {
    if (members.length > 0) members.push('')
    for (const [name, info] of Object.entries(data.methods)) {
      if (info.description) {
        members.push(`  /** ${info.description} */`)
      }
      const params = renderTypeScriptParams(info)
      members.push(`  ${name}(${params}): ${normalizeTypeString(info.returns || 'void')};`)
    }
  }

  // Factory methods
  if (data.factories && data.factories.length > 0) {
    if (members.length > 0) members.push('')
    members.push('  // Factory methods')
    for (const factory of data.factories) {
      members.push(`  ${factory}(id: string, options?: Record<string, any>): any;`)
    }
  }

  // Registries
  if (data.registries && data.registries.length > 0) {
    if (members.length > 0) members.push('')
    members.push('  // Registries')
    for (const reg of data.registries) {
      const available = reg.available.length > 0
        ? reg.available.map(a => `'${a}'`).join(' | ')
        : 'string'
      members.push(`  readonly ${reg.name}: { available: (${available})[]; lookup(id: string): any; };`)
    }
  }

  // Events — as on() overloads
  if (data.events && Object.keys(data.events).length > 0) {
    if (members.length > 0) members.push('')
    for (const [eventName, eventInfo] of Object.entries(data.events)) {
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

  // State
  if (data.state && Object.keys(data.state).length > 0) {
    if (members.length > 0) members.push('')
    const stateMembers = Object.entries(data.state)
      .map(([name, info]) => {
        const comment = info.description ? `    /** ${info.description} */\n` : ''
        return `${comment}    ${name}: ${normalizeTypeString(info.type || 'any')};`
      })
      .join('\n')
    members.push(`  state: {\n${stateMembers}\n  };`)
  }

  const description = data.description
    ? `/**\n * ${data.description.split('\n').join('\n * ')}\n */\n`
    : ''

  return `${description}interface ${data.className} {\n${members.join('\n')}\n}`
}
