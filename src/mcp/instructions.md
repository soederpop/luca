# LUCA 

Luca is the name of a typescript container that you can talk to.

The container represents a running Bun process inside of a git repository, running on a Mac M2

The container exposes a `vm` that is able to execute JavaScript code.

The container also exposes various features inside of a `features` registry.

```typescript
import container from '@/node'
console.log(container.features.available) // ['git','fs','proc','networking',]
```