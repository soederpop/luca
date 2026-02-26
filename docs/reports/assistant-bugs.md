# Assistant systemPrompt Bug Fix Verification

The bug: class field initializers (`private _systemPrompt: string = ''`) on Feature subclasses
overwrite values set during `afterInitialize()` because ES2022 field initializers run AFTER `super()` returns.

Fix: use `declare private _systemPrompt: string` which emits no JavaScript, so afterInitialize values persist.

## Test

```ts
const assistant = container.feature('assistant', {
  folder: '/Users/jon/@soederpop/commands/voice/assistant'
})
```

systemPrompt should contain the CORE.md content (not be empty):

```ts
console.log("systemPrompt length:", assistant.systemPrompt.length)
console.log("contains omar:", assistant.systemPrompt.toLowerCase().includes("omar"))
console.log("first 80 chars:", assistant.systemPrompt.slice(0, 80))
```

Tools should have been loaded from tools.ts:

```ts
console.log("tools loaded:", Object.keys(assistant.tools))
```

Starting the assistant should pass the systemPrompt into the conversation:

```ts
await assistant.start()
const systemMsg = assistant.conversation.messages[0]
console.log("conversation has system message:", systemMsg.role === "system")
console.log("system message has content:", systemMsg.content.length > 0)
console.log("system message contains omar:", systemMsg.content.toLowerCase().includes("omar"))
```
