import container from '@/node'
import { join } from 'path'

const { ui, fs, argv } = container

type HelperType = 'feature' | 'client' | 'server' | 'endpoint'

interface ScaffoldAnswers {
  type: HelperType
  name: string
  description: string
}

const toPascalCase = (str: string) =>
  str
    .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^(.)/, (_, c) => c.toUpperCase())

const toCamelCase = (str: string) => {
  const pascal = toPascalCase(str)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

const toKebabCase = (str: string) =>
  str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()

function generateFeature(name: string, description: string): string {
  const className = toPascalCase(name)
  const shortcut = toCamelCase(name)

  return ui.endent`
    import { Feature, features, type FeatureOptions, type FeatureState } from '../feature.js'

    /**
     * State interface for the ${className} feature.
     *
     * @interface ${className}State
     * @extends {FeatureState}
     */
    export interface ${className}State extends FeatureState {
      // TODO: add state properties
    }

    /**
     * Options interface for the ${className} feature.
     *
     * @interface ${className}Options
     * @extends {FeatureOptions}
     */
    export interface ${className}Options extends FeatureOptions {
      // TODO: add option properties
    }

    /**
     * ${description}
     *
     * @extends Feature
     */
    export class ${className} extends Feature<${className}State, ${className}Options> {
      static override shortcut = 'features.${shortcut}' as const

      override get initialState(): ${className}State {
        return {
          ...super.initialState,
          // TODO: add default state values
        }
      }

      /**
       * TODO: describe this method.
       *
       * @returns {Promise<void>}
       */
      async doSomething(): Promise<void> {
        // TODO: implement
      }
    }

    export default features.register('${shortcut}', ${className})
  `
}

function generateClient(name: string, description: string): string {
  const className = toPascalCase(name) + 'Client'
  const registryKey = toCamelCase(name)

  return ui.endent`
    import {
      type ClientOptions,
      type ClientState,
      type ClientsInterface,
      clients,
      RestClient,
    } from '@/client'
    import { type ContainerContext } from '@/container'

    declare module '@/client' {
      interface AvailableClients {
        ${registryKey}: typeof ${className}
      }
    }

    /**
     * State interface for the ${className}.
     *
     * @interface ${className}State
     * @extends {ClientState}
     */
    export interface ${className}State extends ClientState {
      // TODO: add state properties
    }

    /**
     * Options interface for the ${className}.
     *
     * @interface ${className}Options
     * @extends {ClientOptions}
     */
    export interface ${className}Options extends ClientOptions {
      // TODO: add option properties
    }

    /**
     * ${description}
     *
     * @extends RestClient
     */
    export class ${className}<T extends ${className}State = ${className}State> extends RestClient<T> {
      static override shortcut = 'clients.${registryKey}' as const

      constructor(options: ${className}Options, context: ContainerContext) {
        options = {
          ...options,
          baseURL: options.baseURL || 'https://api.example.com',
        }

        super(options as any, context)
      }

      /**
       * TODO: describe this method.
       *
       * @returns {Promise<any>}
       */
      async fetchSomething(): Promise<any> {
        const response = await this.get('/endpoint')
        return response.data
      }
    }

    export default clients.register('${registryKey}', ${className})
  `
}

function generateServer(name: string, description: string): string {
  const className = toPascalCase(name) + 'Server'
  const registryKey = toCamelCase(name)

  return ui.endent`
    import type { NodeContainer } from '../node/container.js'
    import { servers, Server, type ServersInterface, type ServerState, type ServerOptions, type StartOptions } from '../server/server.js'

    declare module '../server/index' {
      interface AvailableServers {
        ${registryKey}: typeof ${className}
      }
    }

    /**
     * Options interface for the ${className}.
     *
     * @interface ${className}Options
     * @extends {ServerOptions}
     */
    export interface ${className}Options extends ServerOptions {
      // TODO: add option properties
    }

    /**
     * ${description}
     *
     * @extends Server
     */
    export class ${className}<T extends ServerState = ServerState, K extends ${className}Options = ${className}Options> extends Server<T, K> {
      static override shortcut = 'servers.${registryKey}' as const

      override async start(options?: StartOptions) {
        if (this.isListening) {
          return this
        }

        // TODO: implement server start logic

        this.state.set('listening', true)
        return this
      }

      override async stop() {
        if (this.isStopped) {
          return this
        }

        // TODO: implement server stop logic

        this.state.set('stopped', true)
        return this
      }

      override async configure() {
        // TODO: implement server configuration

        this.state.set('configured', true)
        return this
      }
    }

    export default servers.register('${registryKey}', ${className})
  `
}

function generateEndpoint(name: string, description: string): string {
  const kebab = toKebabCase(name)
  const path = `/${kebab}`

  return ui.endent`
    import { z } from 'zod'
    import type { EndpointContext } from '../../endpoint.js'

    export const path = '${path}'
    export const description = '${description}'
    export const tags = ['${kebab}']

    export const postSchema = z.object({
      // TODO: define your parameters
    })

    export async function post(parameters: z.infer<typeof postSchema>, ctx: EndpointContext) {
      const { container } = ctx
      // TODO: implement
      return { ok: true }
    }
  `
}

const generators: Record<HelperType, (name: string, desc: string) => string> = {
  feature: generateFeature,
  client: generateClient,
  server: generateServer,
  endpoint: generateEndpoint,
}

const outputPaths: Record<HelperType, (name: string) => string> = {
  feature: (name) => join('src', 'node', 'features', `${toKebabCase(name)}.ts`),
  client: (name) => join('src', 'clients', toKebabCase(name), 'index.ts'),
  server: (name) => join('src', 'servers', `${toKebabCase(name)}.ts`),
  endpoint: (name) => join('src', 'agi', 'endpoints', `${toKebabCase(name)}.ts`),
}

async function main() {
  console.log(ui.banner('Scaffold', { font: 'Small', colors: ['cyan', 'blue', 'magenta'] }))
  console.log()

  // Support passing type and name as positional args: bun scripts/scaffold.ts feature myThing
  const positionalType = argv._?.[0] as HelperType | undefined
  const positionalName = argv._?.[1] as string | undefined

  const answers = await ui.wizard([
    {
      type: 'list',
      name: 'type',
      message: 'What do you want to scaffold?',
      choices: [
        { name: 'Feature  - registered in FeaturesRegistry, enable/disable lifecycle', value: 'feature' },
        { name: 'Client   - registered in ClientsRegistry, connect/configure lifecycle', value: 'client' },
        { name: 'Server   - registered in ServersRegistry, start/stop/configure lifecycle', value: 'server' },
        { name: 'Endpoint - file-based HTTP endpoint, Remix-like DX', value: 'endpoint' },
      ],
      when: () => !positionalType,
    },
    {
      type: 'input',
      name: 'name',
      message: 'Name (camelCase or kebab-case):',
      validate: (input: string) => (input.trim().length > 0 ? true : 'Name is required'),
      when: () => !positionalName,
    },
    {
      type: 'input',
      name: 'description',
      message: 'Short description:',
      default: 'TODO: describe this helper.',
    },
  ]) as Partial<ScaffoldAnswers>

  const type = positionalType || answers.type!
  const name = positionalName || answers.name!
  const description = answers.description || 'TODO: describe this helper.'

  if (!['feature', 'client', 'server', 'endpoint'].includes(type)) {
    ui.print.red(`Invalid type "${type}". Must be feature, client, server, or endpoint.`)
    process.exit(1)
  }

  const code = generators[type](name, description)
  const relativePath = outputPaths[type](name)
  const fullPath = container.paths.resolve(relativePath)

  if (await fs.existsAsync(fullPath)) {
    ui.print.red(`File already exists: ${relativePath}`)
    process.exit(1)
  }

  const dir = container.paths.dirname(fullPath)
  await fs.ensureFolder(dir)
  await fs.writeFileAsync(fullPath, code + '\n')

  console.log()
  ui.print.green(`Created ${relativePath}`)
  console.log()

  if (type === 'feature') {
    const className = toPascalCase(name)
    const shortcut = toCamelCase(name)
    const kebab = toKebabCase(name)

    ui.print.yellow('Next steps for your new Feature:')
    console.log()
    console.log(ui.endent`
      1. Add the side-effect import in src/node/container.ts:
         ${ui.colors.cyan(`import './features/${kebab}'`)}

      2. Add the type import:
         ${ui.colors.cyan(`import type { ${className} } from './features/${kebab}'`)}

      3. Add to NodeFeatures interface:
         ${ui.colors.cyan(`${shortcut}: typeof ${className}`)}

      4. Add to the export block:
         ${ui.colors.cyan(`type ${className}`)}

      5. Optionally add as a property on NodeContainer:
         ${ui.colors.cyan(`${shortcut}?: ${className}`)}
    `)
  } else if (type === 'client') {
    const className = toPascalCase(name) + 'Client'
    const kebab = toKebabCase(name)

    ui.print.yellow('Next steps for your new Client:')
    console.log()
    console.log(ui.endent`
      1. Update the baseURL in src/clients/${kebab}/index.ts

      2. Import and register in your script or container setup:
         ${ui.colors.cyan(`import '@/clients/${kebab}'`)}

      3. Use it:
         ${ui.colors.cyan(`const client = container.client('${toCamelCase(name)}', { ... })`)}
    `)
  } else if (type === 'server') {
    const className = toPascalCase(name) + 'Server'
    const kebab = toKebabCase(name)

    ui.print.yellow('Next steps for your new Server:')
    console.log()
    console.log(ui.endent`
      1. Import the server in src/server/index.ts:
         ${ui.colors.cyan(`import '../servers/${kebab}'`)}

      2. Add to the AvailableServers re-exports if needed.

      3. Use it:
         ${ui.colors.cyan(`const server = container.server('${toCamelCase(name)}', { port: 3000 })`)}
         ${ui.colors.cyan(`await server.configure()`)}
         ${ui.colors.cyan(`await server.start()`)}
    `)
  } else if (type === 'endpoint') {
    const kebab = toKebabCase(name)

    ui.print.yellow('Next steps for your new Endpoint:')
    console.log()
    console.log(ui.endent`
      1. Edit the endpoint file at src/agi/endpoints/${kebab}.ts

      2. Define your Zod schemas and handler functions (get, post, put, patch, delete)

      3. It will be auto-loaded when useEndpoints() scans the endpoints directory:
         ${ui.colors.cyan(`await expressServer.useEndpoints('src/agi/endpoints')`)}

      4. Or load it manually:
         ${ui.colors.cyan(`const ep = new Endpoint({ path: '/${kebab}', filePath: '...' }, container.context)`)}
         ${ui.colors.cyan(`await ep.load()`)}
         ${ui.colors.cyan(`expressServer.useEndpoint(ep)`)}
    `)
  }

  console.log()
}

main().catch((err) => {
  ui.print.red(err.message)
  process.exit(1)
})
