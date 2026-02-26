# Attach Pattern

Here is some problematic code:

```ts skip
const { container } = context
const { VoiceRouter } = await import(resolve(import.meta.dir, 'voice/router.ts'))
container.features.register('voiceRouter', VoiceRouter as any)
const router = container.feature('voiceRouter' as any, { enable: true }) as InstanceType<typeof VoiceRouter>
```

I'd rather see

```ts skip
// we know since we're inside a command this has to be our path anyway, relative to the container's cwd is how we're discovered
await import(container.paths.resolve('commands','voice','router.ts')).then(({ VoiceRouter }) => container.use(VoiceRouter))
```

