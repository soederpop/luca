import { NodeContainer, Feature } from './node/container'
import './introspection/generated.node'

const container = new NodeContainer()

const { servers, features, clients } = container

export default container as NodeContainer

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

// Schemas
export * from './schemas/base'
