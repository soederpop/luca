import { describe, it, expect } from 'bun:test'
import { z } from 'zod'
import { NodeContainer } from '../src/node/container'
import { Endpoint } from '../src/endpoint'

/**
 * The generated spec is the contract we hand to API consumers, so these cover
 * the parts a generated client actually depends on: templated path keys, path
 * parameters marked `in: path`, typed responses, and multipart bodies.
 */
async function pathItem(mod: any) {
  const container = new NodeContainer()
  const endpoint = new Endpoint({ path: mod.path } as any, { container } as any)
  await endpoint.load(mod)
  return { item: endpoint.toOpenAPIPathItem(), endpoint }
}

describe('Endpoint OpenAPI generation', () => {
  it('templates route params in the path and marks them in: path', async () => {
    const { item, endpoint } = await pathItem({
      path: '/v1/text-extract/:resultId',
      getSchema: z.object({ resultId: z.string() }),
      get: async () => ({}),
    })

    expect(endpoint.openAPIPath).toBe('/v1/text-extract/{resultId}')

    const params = item.get.parameters
    expect(params).toHaveLength(1)
    expect(params[0]).toMatchObject({ name: 'resultId', in: 'path', required: true })
  })

  it('keeps genuine query params as query params alongside path params', async () => {
    const { item } = await pathItem({
      path: '/v1/jobs/:jobId',
      getSchema: z.object({ jobId: z.string(), verbose: z.boolean().optional() }),
      get: async () => ({}),
    })

    const byName = Object.fromEntries(item.get.parameters.map((p: any) => [p.name, p]))
    expect(byName.jobId.in).toBe('path')
    expect(byName.verbose.in).toBe('query')
    expect(byName.verbose.required).toBe(false)
  })

  it('marks an optional route param as not required', async () => {
    const { item, endpoint } = await pathItem({
      path: '/v1/reports/:period?',
      get: async () => ({}),
    })

    expect(endpoint.openAPIPath).toBe('/v1/reports/{period}')
    expect(item.get.parameters[0]).toMatchObject({ name: 'period', required: false })
  })

  it('types the 200 response from a <method>Response schema', async () => {
    const { item } = await pathItem({
      path: '/v1/text-extract/sync',
      postResponse: z.object({ text: z.string(), pages: z.number() }),
      post: async () => ({}),
    })

    const schema = item.post.responses['200'].content['application/json'].schema
    expect(schema.type).toBe('object')
    expect(Object.keys(schema.properties)).toEqual(['text', 'pages'])
  })

  it('falls back to an untyped object when no response schema is declared', async () => {
    const { item } = await pathItem({ path: '/v1/ping', get: async () => ({}) })
    expect(item.get.responses['200'].content['application/json'].schema).toEqual({ type: 'object' })
  })

  it('merges <method>Responses over the generated defaults', async () => {
    const { item } = await pathItem({
      path: '/v1/text-extract/async',
      postResponses: { '202': { description: 'Job accepted' } },
      post: async () => ({}),
    })

    expect(item.post.responses['202'].description).toBe('Job accepted')
    expect(item.post.responses['400']).toBeDefined()
  })

  it('describes an upload as multipart/form-data with a binary property', async () => {
    const { item } = await pathItem({
      path: '/v1/text-extract/sync',
      postUpload: {
        fields: { file: { accept: ['application/pdf'], required: true, description: 'The PDF' } },
      },
      postSchema: z.object({ mode: z.enum(['fast', 'accurate']).default('fast') }),
      post: async () => ({}),
    })

    const body = item.post.requestBody
    expect(Object.keys(body.content)).toEqual(['multipart/form-data'])

    const schema = body.content['multipart/form-data'].schema
    expect(schema.properties.file).toMatchObject({ type: 'string', format: 'binary' })
    expect(schema.properties.mode).toBeDefined()
    expect(schema.required).toContain('file')
    expect(body.content['multipart/form-data'].encoding.file.contentType).toBe('application/pdf')
  })

  it('describes a multiple-file field as an array of binaries', async () => {
    const { item } = await pathItem({
      path: '/v1/batch',
      postUpload: { fields: { pages: { multiple: true } } },
      post: async () => ({}),
    })

    const schema = item.post.requestBody.content['multipart/form-data'].schema
    expect(schema.properties.pages).toMatchObject({ type: 'array', items: { format: 'binary' } })
  })

  it('leaves route params out of the JSON request body schema', async () => {
    const { item } = await pathItem({
      path: '/v1/jobs/:jobId',
      putSchema: z.object({ jobId: z.string(), status: z.string() }),
      put: async () => ({}),
    })

    const body = item.put.requestBody.content['application/json'].schema
    expect(Object.keys(body.properties)).toEqual(['status'])
    expect(item.put.parameters[0].name).toBe('jobId')
  })

  it('carries a per-endpoint security requirement onto the operation', async () => {
    const { item } = await pathItem({ path: '/api/health', security: [], get: async () => ({}) })
    expect(item.get.security).toEqual([])
  })
})

describe('generateOpenAPISpec document', () => {
  it('keys paths by the templated path and documents security schemes', async () => {
    const container = new NodeContainer()
    const server = container.server('express')

    await server.useEndpointModules([
      { path: '/v1/jobs/:jobId', get: async () => ({}) },
      { path: '/api/health', security: [], get: async () => ({ ok: true }) },
    ])

    const spec = server.generateOpenAPISpec({
      title: 'AI Service',
      servers: [{ url: 'https://ai.example.com' }],
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
      security: [{ bearerAuth: [] }],
    })

    expect(Object.keys(spec.paths)).toContain('/v1/jobs/{jobId}')
    expect(Object.keys(spec.paths)).not.toContain('/v1/jobs/:jobId')
    expect(spec.servers).toEqual([{ url: 'https://ai.example.com' }])
    expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer')
    expect(spec.security).toEqual([{ bearerAuth: [] }])
    // an endpoint can opt out of the root requirement
    expect(spec.paths['/api/health'].get.security).toEqual([])
  })
})
