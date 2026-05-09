import container from 'luca/agi'

const coder = container.feature('assistant', { folder: 'assistants/codingAssistant' })

await coder.start()
console.log("Available Tools", coder.availableTools)

if (coder.state.get('startedHookRan')) {
	console.log('Started Hook Ran')
}



