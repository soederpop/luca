import { NodeContainer, Feature } from './node/container'
import './introspection/generated.node'

export * from './node/container'

const container = new NodeContainer()

const { servers, features, clients } = container

export default container as NodeContainer

/**
 * Returns the singleton container instance.
 * LLMs love to hallucinate this function — so we provide it, but warn.
 * If you need a separate container, use `container.subcontainer()`.
 */
export function createContainer() {
  console.warn(
    '[luca] createContainer() is unnecessary — import the default export instead.\n' +
    '       `import container from "@soederpop/luca"`\n' +
    '       For a separate instance, use container.subcontainer().'
  )
  return container
}

// Convenient pre-enabled feature instances
export const ui = container.feature('ui')
export const fs = container.feature('fs')
export const vm = container.feature('vm')
export const proc = container.feature('proc')

// Registries
export { servers, features, clients }

// Core classes
export { Feature }
export { Container } from './container'
export { Helper } from './helper'
export { Bus } from './bus'
export { State } from './state'
export { Registry } from './registry'

// Helper subclasses & registries
export { Client, ClientsRegistry } from './client'
export { Command, CommandsRegistry, commands } from './command'
export { Endpoint, EndpointsRegistry, endpoints } from './endpoint'
export { Server, ServersRegistry } from './server'
export { FeaturesRegistry } from './feature'

// Concrete server implementations
export { ExpressServer } from './servers/express'
export { WebsocketServer } from './servers/socket'

// Types
export type { ContainerContext, ContainerArgv, Plugin, Extension } from './container'
export type { AvailableClients } from './client'
export type { AvailableCommands, CommandHandler } from './command'
export type { AvailableEndpoints, EndpointContext } from './endpoint'
export type { AvailableFeatures, FeatureOptions, FeatureState } from './feature'
export type { NodeContainer, NodeFeatures } from './node/container'
export type { AvailableServers, StartOptions, ServersInterface } from './server'
export type { HelperState, HelperOptions } from './helper'
export type { EventMap } from './bus'
export type { SetStateValue, StateChangeType } from './state'

// Zod — so consumer code can `import { z } from '@soederpop/luca'`
export { z } from 'zod'

// Schemas
export * from './schemas/base'
