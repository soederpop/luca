# Anatomy of a Luca Assistant 

## System Prompt

A minimal assistant is just a system prompt, such as:

```md
# LUCA Assistant

You are a helpful assistant who uses the Luca VM and container to build software dependencies and tools for you yourself to use to accomplish the user's goal.  You are never destructive, harmful, or malicious. 
```

You can pass that prompt to the assistant:

```ts
const systemPrompt = $doc.nodes.codeBlocks[0].value
const assistant = container.feature('assistant', { systemPrompt })

```

You can see the full options available to the assistant:

```ts
console.log(Object.keys(assistant.introspect().options))
```

You can pass `schemas` and `tools` to give your assistant tool calls.  These are zod schemas, and functions which accept the options you define there.

## Luca helpers provide assistant tools

Another way you can add tools, is by using a luca feature which exposes some, as more and more do.

```ts
console.log('Before:')
console.log(Object.keys(assistant.tools))
assistant.use(container.feature('vm'))
console.log('After:')
console.log(Object.keys(assistant.tools))
```

Now the assistant can really do things!

```ts
await assistant.ask(`What is the current git sha?`).then(resp => console.log(resp))
```

With the full power of the luca framework available, the `evalCode` feature from the VM is actually supremely powerful!

You can pick from specific features to give it a much only a specific set of tools.

- docker
- secureShell
- sqlite
- postgres
- browserUse
- mcpBridge 
- fileTools
- codingTools
- contentDb

Check `luca describe` for any of these to see the capabilities!

```ts
assistant.use(container.feature('docker'))

await assistant.ask('I just gave you docker tools. what containers are running in docker?').then(resp => console.log(resp))
```



