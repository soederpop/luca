import container from '@/agi'

const assistant = await container.feature('assistant', {
	folder: "assistants/project-owner",
})

console.log(assistant.contentDb.modelNames)