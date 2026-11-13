---
agentOptions:
    permissionMode: bypassPermissions
---

# Check for undocumented features

The luca introspection and luca cli's describe command is powered by the JSDoc comments in the code base, and the values passed to the describe methods in the zod schema.  This documentation is what is fed to AI Coding assistants to be able to understand how to use the individual features

Please scan the following paths:

```ts
const fm = await container.feature('fileManager').start()
const results = fm.match(['src/node/features/*.ts', 'src/agi/features/*.ts', 'src/web/features/*.ts'])
console.log(results.join("\n"))
```

Please ensure every feature has accurate and valid JSDoc documentation for the class definitions, methods, and getters.

Validate the output of `bun run src/cli/cli.ts describe whatever` for each item you're working on, that it displays properly, is easy to understand, accurate, in terms of how your comments display there.  You may need to run `bun run src/cli/cli.ts introspect` to generate the build time data.

You can pass `--platform=web` to see web specific output.

## Quality not just Quantity

- The presence of documentation isn't sufficient.  Is it good documentation? Is it not overly verbose? Does it not explain stuff that doesn't matter? Is it accurate? If there are examples, do they work?
- The main consumer of `luca describe` will be an LLM so token budget matters.  Every word has to be doing work.  It should still be nice to look at for human coders too.
