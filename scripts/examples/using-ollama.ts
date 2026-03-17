import container from '@soederpop/luca/agi'

const conversation = container.feature('conversation', {
	local: true,
	model: "qwen/qwen3-coder-30b",
	api: "responses"
})

const response = await conversation.ask('What model am I using?')

console.log(response)