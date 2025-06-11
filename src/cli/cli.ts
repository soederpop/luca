#!/usr/bin/env bun 

import container, { ui } from '@/node'
import '@/introspection/generated'

async function main() {
	const server = container.server('express', { 
		port: 9000,
		create(app) {
			return app.get('/', (req,res) => {
				res.send('Hello!')
			})
		}
	})

	server.start()

	const portExposer = container.feature('portExposer', {
		port: 9000,
		authToken: process.env.NGROK_AUTHTOKEN!,
		domain: process.env.NGROK_DOMAIN || 'soederpop-local.ngrok.dev'
	})

	await portExposer.expose()

	ui.print.green(`Server is running at ${portExposer.getPublicUrl()}`)
}

main()