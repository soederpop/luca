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
	console.log('Server Started')

	const portExposer = container.feature('portExposer', {
		port: 9000,
		authToken: process.env.NGROK_AUTHTOKEN!
	})

	await portExposer.expose()
	console.log(portExposer.getConnectionInfo())
	console.log(portExposer.isConnected())
	console.log("Port Exposed", portExposer.getPublicUrl())
}

main()