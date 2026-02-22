import container from '@soederpop/luca/agi'

const assistant = container.feature('assistant', {
  folder: 'assistants/example',
  appendPrompt: 'Always be brief. Search your internal docs to make sure you have all the info you need.',
	prependPrompt: 'You are speaking to a gentleman named Jon aka Soederpop aka J-Money.',
  model: 'gpt-4.1',
})

const secretAnswer = await assistant.ask('Research your internal docs before answering, what is the best city on earth?  Tell me that as well as the current time.  Make sure to greet me by name.')

console.log(container.ui.markdown(secretAnswer))