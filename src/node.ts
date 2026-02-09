import { NodeContainer } from './node/container.js'
import './introspection/generated.node.js'

const container = new NodeContainer()

const { servers, features, clients } = container

export default container as NodeContainer

export const ui = container.feature('ui')

export const fs = container.feature('fs')

export const vm = container.feature('vm')

export const proc = container.feature('proc')

export { servers, features, clients }
