import { describe, it, expect, afterAll } from 'bun:test'
import { createNodeContainer, API_TIMEOUT } from './helpers'
import { z } from 'zod'

// Runs against the real needle engine. First run downloads ~36MB from
// Hugging Face (engine binary + needle3.cact weights) — gate on opt-in.
const enabled = process.env.LUCA_NEEDLE_INTEGRATION === '1'

const maybeDescribe = enabled ? describe : describe.skip

maybeDescribe('needle integration (LUCA_NEEDLE_INTEGRATION=1)', () => {
	const { container, cleanup } = createNodeContainer()
	const needle = (container as any).feature('needle', {
		// Off the default range so the test never reuses/steals an app's server
		basePort: 8580,
		portRange: 4,
	})

	afterAll(() => {
		needle.stopAll()
		cleanup()
	})

	it('installs, spawns a server, and dispatches a tool call', async () => {
		const agent = await needle.agent([
			{
				name: 'get_weather',
				description: 'Get the current weather for a city.',
				parameters: z.object({ city: z.string().describe('The city name') }),
			},
			{
				name: 'no_action',
				description: 'Use when the request matches no other tool.',
				parameters: z.object({}),
			},
		])

		const result = await agent.complete("what's the weather like in Lagos right now?", { fresh: true })
		expect(result.success).toBe(true)
		expect(result.function_calls[0]?.name).toBe('get_weather')
		expect(result.function_calls[0]?.arguments.city).toBe('Lagos')
		expect(result.confidence).toBeGreaterThan(0.5)

		// Same tool set from a second call reuses the same server
		const again = await needle.agent([
			{
				name: 'get_weather',
				description: 'Get the current weather for a city.',
				parameters: z.object({ city: z.string().describe('The city name') }),
			},
			{
				name: 'no_action',
				description: 'Use when the request matches no other tool.',
				parameters: z.object({}),
			},
		])
		expect(again.port).toBe(agent.port)
	}, API_TIMEOUT * 2)

	it('extracts typed data from unstructured text', async () => {
		const { data, confidence } = await needle.extract(
			'Invoice #4821 from Acme Corp, total $1,204.50 due March 3',
			z.object({
				invoiceNumber: z.string().describe('The invoice number'),
				vendor: z.string().describe('The company that issued the invoice'),
			}),
		)
		expect(data.invoiceNumber).toContain('4821')
		expect(data.vendor.toLowerCase()).toContain('acme')
		expect(confidence).toBeGreaterThan(0)
	}, API_TIMEOUT * 2)
})
