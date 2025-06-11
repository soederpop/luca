import { NodeContainer } from './node/container.js'

const container = new NodeContainer()

export default container as NodeContainer

export const ui = container.feature('ui')
