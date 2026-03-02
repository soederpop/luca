# COntainer `.use()` API

Can we find a way to support using dynamic imports

```ts
container.use(import("whatever))
```

these are promises, but the expectation is the default has an attach method.  if not, any function or class they export which has an attach property
