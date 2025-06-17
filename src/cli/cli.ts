#!/usr/bin/env bun 

import { __INTROSPECTION__ } from '@/introspection'
import '@/introspection/generated'

import container from '@/identities/bootstrapper'

async function main() {
	await container.start()
	const chat = container.feature('helperChat', {
		host: container.feature('proc')
	})

	await chat.start()

	const response = await chat.ask('What is your purpose? What methods are available on the ui feature?')

	container.ui.print(container.ui.markdown(response))
}

main()