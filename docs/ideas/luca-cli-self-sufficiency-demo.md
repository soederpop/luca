# Luca CLI Self Sufficiency Demo

With the `luca` cli you can have a project folder like:

```
- public/
	- index.html
- commands/
	- setup-db.ts
- endpoints/
	- health.ts
- docs/
	- models.ts
- luca.cli.ts
```

This should work without there necessarily being a `node_modules` folder here, because each of these things are loaded by luca, transpiled, and run through the VM.

Even the `contentDb` feature which depends on contentbase should work here.

This is what I mean by luca being a dependency injection framework.

The only downside of this is - how do we provide type support without them installing '@soederpop/luca'
