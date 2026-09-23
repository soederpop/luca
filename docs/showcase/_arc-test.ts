
const endpointsDir = container.paths.resolve('tmp', 'arc-test-' + Date.now(), 'endpoints')
fs.ensureFolder(endpointsDir)
const petsModule = "export const path = '/pets'\nconst pets = [{id: 1, name: 'Rex', species: 'dog'}, {id: 2, name: 'Whiskers', species: 'cat'}]\nexport async function get() { return { pets } }\nexport async function post(params) { const p = { id: pets.length+1, ...params, species: params.species || 'unknown' }; pets.push(p); return p }"
fs.writeFile(container.paths.resolve(endpointsDir, 'pets.ts'), petsModule)
const server = container.server('express')
await server.useEndpoints(endpointsDir)
const port = await container.feature('networking').findOpenPort(4320)
await server.start({ port })
console.log('listening on', port)
// consume the spec
const api = await container.feature('openapi', { url: 'http://localhost:' + port + '/openapi.json' }).load()
console.log('endpointNames:', api.endpointNames)
console.log('tools:', api.toOpenAITools().length)
// talk to it
const a = container.feature('assistant', { systemPrompt: 'You can query the pets API. Be terse.', maxTokens: 200 })
a.use(api)
const resp = await Promise.race([
  a.ask('How many pets are listed?'),
  new Promise(r => setTimeout(() => r('TIMEOUT'), 25000))
])
console.log('ANSWER:', JSON.stringify(resp))
await server.stop()
