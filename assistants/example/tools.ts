const { z } = require('zod')

async function greet({ name }) {
	return `Hello, ${name}! How can I help you today?`
}

async function currentTime() {
	return new Date().toISOString()
}

const schemas = {
	greet: z.object({
		name: z.string().describe('The name of the person to greet'),
	}).describe('Greet a person by name'),
	currentTime: z.object({}).describe('Get the current date and time'),
}

module.exports = { greet, currentTime, schemas }
