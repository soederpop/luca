import container from '@/agi'

const conversation = container.feature('conversation', {
	local: true,
	model: "qwen2.5:7b"
})

const response = await conversation.ask('What model am I using?')

console.log(response)