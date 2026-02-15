# Assistant Interface

The `Assistant` Feature should be part of the AGI Container.

An `Assistant` is a combination of a system prompt and tool calls, and has
a conversation with an LLM ( using our conversation feature ).  You `ask(question)` to the assistant and it has a streaming conversation, and emits events you can observe, changes its state, etc.  

You should be able to create it like 

```typescript
const assistant = container.feature('assistant', { 
	folder: "assistants/whatever",
	// optional values, defaults provider
	docsPath: "docs", // will resolve to assistants/whatever/docs but we could use anything,
	// gets appended to the system prompt
	appendPrompt: "",
	// gets prepended
	prependPrompt: "",

	tools: { 
		clobberWhateverExistsFromToolsTs
	},

	schemas: { 
		zodSchemasWhosKeysMatchTools
	}
})

const answer = await assistant.ask('What capabilities do you have?')
```

## Assistant Folder

```
- docs/
- CORE.md - used as the system prompt for the conversation
- hooks.ts
- tools.ts 
```

- `tools.ts` is a module that should export functions, and a `schemas` object whose keys are the names of the exported functions whose values are a Zod schema for the parameters and descriptions.  This `tools.ts` will be run through the container's `vm` feature, and can expect the `container` global to be defined as well as a `me` variable that is the assistant itself. 

- `hooks.ts` is a module whose exported function names should match events emitted by the assistant.  Any time these events get fired, these functions should get called.

- `docs/` is a folder of structured markdown.  The `Assistant` can interact with it through a `contentDb` feature.

## Assistant Design

In addition to the tools we give it and custom prompt, every Assistant should have core tools for interacting with its internal `docs/` folder.  An assistant will have an instance of the `docs-reader` feature attached to a `contentDb` backed by this `docs/` folder.  

Every assistant can `researchInternalDocs(question)` and ask the docs-reader a question.