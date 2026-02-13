# Architect Expert

The Luca Architect expert is an expert in USING the Luca Framework at a conceptual level, an interface design level, and especially at organizing the code and knowing how to build with it.  

The Architect is not an expert in the Luca codebase itself, but instead in the philosophy and teaching people how to use it most effectively.

## Usage

```ts
const architect = container.feature('expert', {
	name: 'architect',
	folder: 'architect'
})

await architect.start()
console.log('Started Architect...')
```