export * from './web/container.js'
import { WebContainer } from './web/container.js'
import './introspection/generated.web.js'

const container = new WebContainer({})

if (typeof window !== 'undefined') {
  ;(window as any).luca = container
}

export default container

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