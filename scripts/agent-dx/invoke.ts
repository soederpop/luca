import container from '../../src/node'

// Each invocation is a fresh process: accidental in-memory persistence cannot pass.
const [solution, input, output] = process.argv.slice(2)
try {
  const mod = container.feature('vm').loadModule(solution!, { container })
  const value = await mod.default(container, JSON.parse(input!))
  container.fs.writeJson(output!, { value })
} catch (error) {
  container.fs.writeJson(output!, { error: String(error instanceof Error ? error.message : error) })
  process.exitCode = 1
}
