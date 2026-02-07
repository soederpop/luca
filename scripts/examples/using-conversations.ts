import container from '@/agi'

async function main() {
	const chat = container.feature('conversation', {
		cached: false,
		model: 'gpt-5',
		history: [{ role: 'system', content: 'You are a helpful assistant. Use your tools when asked about the weather.' }],
		tools: {
			get_weather: {
				handler: async ({ city }: { city: string }) => {
					console.log(`\n  [tool] get_weather called with city="${city}"`)
					const data = { city, temp: 62, conditions: 'foggy', humidity: 85 }
					console.log(`  [tool] returning:`, data, '\n')
					return data
				},
				description: 'Get the current weather for a given city',
				parameters: {
					type: 'object',
					properties: {
						city: { type: 'string', description: 'The city name' }
					},
					required: ['city']
				}
			}
		}
	})

	await chat.ask("What's the weather like in San Francisco, CA?")

	console.log(chat.messages)


}

main().catch(console.error)
