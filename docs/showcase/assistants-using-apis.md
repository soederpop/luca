# Luca Assistants can use your API 

When you use Luca to build a REST API using the `endpoints/*.ts` modules, you will get a free `/openapi.json` spec for interacting with your API.

Luca provides a feature `openapi` which can consume these specs and turn them into a typed client capable of interacting with the API.

It can also turn that server into Luca `Assistant` tools.

```ts
const api = container.feature('openapi', { 
    url: 'http://localhost:7700/openapi.json' 
})

const assistant = container.feature('assistant', {
  systemPrompt: 'You interact with APIs using your tool calls',
})
```

So I call Luca: Lightweight Universal Conversational Architecture this is what I mean.  Everything you build, you can literally talk to!

```ts 
await api.load()
await assistant.use(api).start()
await assistant.ask('What tools do you have available?').then(resp => {
  console.log(resp)
})
```




