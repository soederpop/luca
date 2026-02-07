# Luca Experts Folder 

An Expert is an Agent that is loaded with a specialized prompt, context, and maybe tool calls.

These will exist as markdown or JSON files inside the folder.

## Creating An Expert

```typescript
import container from '@/agi/container.server'

const coreExpert = container.feature('expert', {
	folder: 'core',
})

await coreExpert.ask('Generate a new feature for me')
```

## Anatomy of an Expert

- SYSTEM-PROMPT.md 
- memories.json
- skills.ts

## Skills File

A Skills file exports functions, these functions will assume that certain globals are already defined, namely `expert` which will be the instance of the expert, and `container` which is an instance of the container.

The skills file is loaded by the container's VM, before exposing it as an object of functions on the expert.