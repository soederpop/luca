#!/usr/bin/env bun 

import { __INTROSPECTION__ } from '@/introspection'
import '@/introspection/generated'

import container from '@/identities/bootstrapper'
import type OpenAIClient from '@/agi/openai-client'

async function main() {
	await container.start()
	const snippets = container.feature('snippets')
	const containerChat = container.feature('containerChat')	

	const response = await containerChat.generateSnippet('I want a script which will display a tree of the directories in the projects file manager.', ['fileManager', 'ui'])

	const ui = await container.feature('ui').enable()
	const fileManager = await container.feature('fileManager').enable()
	const vm = container.feature('vm')

	const result = await vm.run(response, { fileManager, ui })

	console.log(result)
}

main()