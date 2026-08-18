import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * The openapi feature implements the standard toTools() contract, so
 * `assistant.use(container.feature('openapi', { url }))` gives an assistant
 * live, callable tools for every endpoint in the spec.
 */

const spec = {
	openapi: '3.0.0',
	info: {
		title: 'Pet API',
		version: '1.0.0',
		description: 'A store for pets. Use it to look up and register animals.',
	},
	tags: [{ name: 'pets', description: 'Everything about pets' }],
	externalDocs: { url: 'https://example.com/docs', description: 'Full reference' },
	paths: {
		'/pets/{petId}': {
			get: {
				operationId: 'getPetById',
				tags: ['pets'],
				summary: 'Fetch a pet',
				parameters: [
					{ name: 'petId', in: 'path', required: true, schema: { type: 'integer' } },
					{ name: 'verbose', in: 'query', required: false, schema: { type: 'boolean' } },
				],
				responses: { '200': { description: 'ok' } },
			},
		},
		'/pets': {
			post: {
				operationId: 'addPet',
				summary: 'Create a pet',
				requestBody: {
					content: {
						'application/json': {
							schema: {
								type: 'object',
								properties: { name: { type: 'string' } },
								required: ['name'],
							},
						},
					},
				},
				responses: { '200': { description: 'ok' } },
			},
		},
	},
}

let server: any
let baseUrl: string
let lastRequest: { method: string; path: string; body: any; headers: Record<string, string> } | null = null
let lastSpecFetchHeaders: Record<string, string> | null = null

beforeAll(() => {
	server = Bun.serve({
		port: 0,
		async fetch(req) {
			const url = new URL(req.url)
			if (url.pathname === '/openapi.json') {
				lastSpecFetchHeaders = Object.fromEntries(req.headers.entries())
				return Response.json({ ...spec, servers: [{ url: `http://localhost:${server.port}` }] })
			}
			lastRequest = {
				method: req.method,
				path: url.pathname + (url.search || ''),
				body: req.method === 'POST' ? await req.json() : null,
				headers: Object.fromEntries(req.headers.entries()),
			}
			if (url.pathname === '/pets/404') {
				return Response.json({ message: 'no such pet' }, { status: 404 })
			}
			if (url.pathname.startsWith('/pets/')) {
				return Response.json({ id: Number(url.pathname.split('/')[2]), name: 'Rex' })
			}
			if (url.pathname === '/pets' && req.method === 'POST') {
				return Response.json({ id: 99, ...lastRequest.body })
			}
			return new Response('not found', { status: 404 })
		},
	})
	baseUrl = `http://localhost:${server.port}`
})

afterAll(() => server?.stop())

describe('OpenAPI.toTools()', () => {
	it('exposes each endpoint as a schema + handler pair that calls the live API', async () => {
		const container = new AGIContainer()
		const api = container.feature('openapi', { url: baseUrl })
		await api.load()

		const tools = api.toTools()
		expect(Object.keys(tools.schemas).sort()).toEqual(['addPet', 'getPetById'])
		expect(Object.keys(tools.handlers).sort()).toEqual(['addPet', 'getPetById'])

		// Schemas satisfy the .toJSONSchema() duck type addTool() expects
		const jsonSchema = (tools.schemas.getPetById as any).toJSONSchema()
		expect(jsonSchema.type).toBe('object')
		expect(jsonSchema.properties.petId).toBeDefined()
		expect(jsonSchema.description).toContain('Fetch a pet')

		// Handlers execute the HTTP call: path + query params in the URL
		const pet = await (tools.handlers.getPetById as any)({ petId: 7, verbose: true })
		expect(pet).toEqual({ id: 7, name: 'Rex' })
		expect(lastRequest?.path).toBe('/pets/7?verbose=true')

		// Body args go out as JSON
		const created = await (tools.handlers.addPet as any)({ name: 'Fido' })
		expect(created).toEqual({ id: 99, name: 'Fido' })
		expect(lastRequest?.body).toEqual({ name: 'Fido' })
	})

	it('respects only/except filters', async () => {
		const container = new AGIContainer()
		const api = container.feature('openapi', { url: `${baseUrl}/openapi.json` })
		await api.load()

		expect(Object.keys(api.toTools({ only: ['addPet'] }).schemas)).toEqual(['addPet'])
		expect(Object.keys(api.toTools({ except: ['addPet'] }).schemas)).toEqual(['getPetById'])
	})

	it('options.headers ride on the spec fetch and every call()', async () => {
		const container = new AGIContainer()
		const api = container.feature('openapi', {
			url: baseUrl,
			headers: { authorization: 'Bearer sekrit', 'x-team': 'luca' },
		} as any)
		await api.load()

		expect(lastSpecFetchHeaders?.authorization).toBe('Bearer sekrit')

		await api.call('getPetById', { petId: 1 })
		expect(lastRequest?.headers.authorization).toBe('Bearer sekrit')
		expect(lastRequest?.headers['x-team']).toBe('luca')
	})

	it('options.beforeRequest can mutate the request or replace the url/init', async () => {
		const container = new AGIContainer()
		const seen: string[] = []
		const api = container.feature('openapi', {
			url: baseUrl,
			beforeRequest: ({ url, init, endpoint }: any) => {
				seen.push(endpoint)
				;(init.headers as Record<string, string>)['x-trace'] = 'abc123'
				// Replace the url for one endpoint to prove returned values win
				if (endpoint === 'getPetById') return { url: url.replace('/pets/1', '/pets/2') }
			},
		} as any)

		const pet = await api.call('getPetById', { petId: 1 })
		expect(seen).toEqual(['load', 'getPetById'])
		expect(pet.id).toBe(2)
		expect(lastRequest?.headers['x-trace']).toBe('abc123')
	})

	it('call() returns HTTP errors as data instead of throwing', async () => {
		const container = new AGIContainer()
		const api = container.feature('openapi', { url: baseUrl })

		const err = await api.call('getPetById', { petId: 404 })
		expect(err.error).toBe(true)
		expect(err.status).toBe(404)
		expect(err.data).toEqual({ message: 'no such pet' })
	})
})

describe('assistant.use(openapi) before the spec is loaded', () => {
	it('queues a pending plugin that loads the spec and registers the tools', async () => {
		const container = new AGIContainer()
		const api = container.feature('openapi', { url: baseUrl, cacheKey: 'deferred' } as any)
		const assistant = container.feature('assistant', { systemPrompt: 'test' })

		assistant.use(api)

		// Nothing registered yet — the spec hasn't loaded
		expect(Object.keys(assistant.tools)).toEqual([])
		const pending = assistant.state.get('pendingPlugins') as Promise<void>[]
		expect(pending.length).toBe(1)

		await Promise.all(pending)

		expect(Object.keys(assistant.tools).sort()).toEqual(['addPet', 'getPetById'])
		const pet = await assistant.tools.getPetById.handler({ petId: 3 })
		expect(pet).toEqual({ id: 3, name: 'Rex' })

		// The spec's own docs land in the system prompt
		const prompt = assistant.effectiveSystemPrompt
		expect(prompt).toContain('Pet API')
		expect(prompt).toContain('A store for pets')
	})
})

describe('OpenAPI.toSystemPrompt()', () => {
	it('assembles the info block, tags, and external docs into a brief', async () => {
		const container = new AGIContainer()
		const api = container.feature('openapi', { url: baseUrl })
		await api.load()

		const prompt = api.toSystemPrompt()
		expect(prompt).toContain('"Pet API" API (2 endpoints)')
		expect(prompt).toContain('A store for pets. Use it to look up and register animals.')
		// Deliberately just the info block — no tag or externalDocs dumps
		expect(prompt).not.toContain('Everything about pets')
		expect(prompt).not.toContain('example.com/docs')
	})

	it('options.info overrides the spec info block', async () => {
		const container = new AGIContainer()
		const api = container.feature('openapi', {
			url: baseUrl,
			info: {
				title: 'House Pets',
				summary: 'Only the good ones.',
				description: 'A hand-curated pet registry.',
			},
		})
		await api.load()

		expect(api.state.get('title')).toBe('House Pets')
		const prompt = api.toSystemPrompt()
		expect(prompt).toContain('"House Pets" API')
		expect(prompt).toContain('Only the good ones.')
		expect(prompt).toContain('A hand-curated pet registry.')
		expect(prompt).not.toContain('A store for pets')

		// Partial overrides keep the spec's other fields
		const partial = container.feature('openapi', { url: baseUrl, info: { title: 'Renamed' } })
		await partial.load()
		expect(partial.info.title).toBe('Renamed')
		expect(partial.info.version).toBe('1.0.0')
		expect(partial.info.description).toContain('A store for pets')
	})
})

describe('loading a spec from a local file path', () => {
	it('reads the file via the fs feature and calls the servers[] base URL', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'openapi-spec-'))
		const specPath = join(dir, 'openapi.json')
		writeFileSync(specPath, JSON.stringify({ ...spec, servers: [{ url: baseUrl }] }))

		const container = new AGIContainer()
		const api = container.feature('openapi', { url: specPath })
		await api.load()

		expect(api.state.get('title')).toBe('Pet API')
		expect(api.serverUrl).toBe(baseUrl)

		const pet = await api.call('getPetById', { petId: 5 })
		expect(pet).toEqual({ id: 5, name: 'Rex' })
	})
})
