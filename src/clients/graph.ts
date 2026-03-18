import { z } from 'zod'
import { Client } from '../client.js'
import { RestClient } from './rest.js'
import type { ClientState } from '../client.js'
import {
  GraphClientOptionsSchema, GraphClientEventsSchema,
} from '../schemas/base.js'

export type GraphClientOptions = z.infer<typeof GraphClientOptionsSchema>

declare module '../client' {
  interface AvailableClients {
    graph: typeof GraphClient
  }
}

/**
 * GraphQL client that wraps RestClient with convenience methods for executing
 * queries and mutations. Automatically handles the GraphQL request envelope
 * (query/variables/operationName) and unwraps responses, extracting the `data`
 * field and emitting events for GraphQL-level errors.
 *
 * @example
 * ```typescript
 * const gql = container.client('graph', { baseURL: 'https://api.example.com' })
 * const data = await gql.query(`{ users { id name } }`)
 * await gql.mutate(`mutation($name: String!) { createUser(name: $name) { id } }`, { name: 'Alice' })
 * ```
 */
export class GraphClient<
  T extends ClientState = ClientState,
  K extends GraphClientOptions = GraphClientOptions
> extends RestClient<T, K> {
  static override shortcut = "clients.graph" as const
  static override optionsSchema = GraphClientOptionsSchema
  static override eventsSchema = GraphClientEventsSchema
  static { Client.register(this, 'graph') }

  /** The GraphQL endpoint path. Defaults to '/graphql'. */
  get endpoint() {
    return (this.options as GraphClientOptions).endpoint || '/graphql'
  }

  /**
   * Execute a GraphQL query and return the unwrapped data.
   * @param query - The GraphQL query string
   * @param variables - Optional variables for the query
   * @param operationName - Optional operation name when the query contains multiple operations
   */
  async query<R = any>(query: string, variables?: Record<string, any>, operationName?: string): Promise<R> {
    return this.execute<R>(query, variables, operationName)
  }

  /**
   * Execute a GraphQL mutation and return the unwrapped data.
   * Semantically identical to query() but named for clarity when performing mutations.
   * @param mutation - The GraphQL mutation string
   * @param variables - Optional variables for the mutation
   * @param operationName - Optional operation name when the mutation contains multiple operations
   */
  async mutate<R = any>(mutation: string, variables?: Record<string, any>, operationName?: string): Promise<R> {
    return this.execute<R>(mutation, variables, operationName)
  }

  /**
   * Execute a GraphQL operation, unwrap the response, and handle errors.
   * Posts to the configured endpoint with the standard GraphQL envelope.
   * If the response contains GraphQL-level errors, emits both 'graphqlError'
   * and 'failure' events before returning the data.
   */
  private async execute<R = any>(query: string, variables?: Record<string, any>, operationName?: string): Promise<R> {
    const body: Record<string, any> = { query }
    if (variables) body.variables = variables
    if (operationName) body.operationName = operationName

    const response = await this.post(this.endpoint, body)

    if (response?.errors?.length) {
      this.emit('graphqlError', response.errors)
      this.emit('failure', response.errors)
    }

    return response?.data as R
  }
}

export default GraphClient
