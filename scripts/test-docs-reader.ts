import container from  'luca/agi'

const reader = container.feature('docsReader', {
	contentDb: (await container.docs.load())
})

const resp = await reader.ask('What tutorials are available? What are they about?')

console.log(resp)

