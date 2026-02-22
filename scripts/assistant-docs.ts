import container from '@soederpop/luca/agi'

const assistant = await container.feature('assistant', {
	folder: "assistants/project-owner",
})

console.log(assistant.contentDb.modelNames)